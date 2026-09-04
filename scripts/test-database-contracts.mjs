// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  applicationSchemas,
  canonicalJson,
  createDatabaseCatalog,
  databaseCatalogQueries,
  normalizePostgrestOpenApi,
  sha256CanonicalJson,
  summarizeDatabaseCatalog,
  summarizePostgrestOpenApiCatalog
} from './database-contract-catalog.mjs'
import {
  validatePublicSchemaCatalog,
  validatePublicSchemaRatchet
} from './public-schema-ratchet.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const expectedPath = resolve(repoRoot, 'database/contracts/eiscore-db-contract-v3.json')
const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`
const networkName = `eiscore-db3-net-${suffix}`
const freshContainer = `eiscore-db3-fresh-${suffix}`
const upgradeContainer = `eiscore-db3-upgrade-${suffix}`
const apiContainer = `eiscore-db3-api-${suffix}`
const postgresImage = 'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f'
const postgrestImage = 'postgrest/postgrest@sha256:00c1ec8a9339f52a7e765cb3bd3ab5b001f0b5dd954cfb69b43b9de494a9a0aa'
const jwtSecret = randomBytes(40).toString('base64url')
const rootPassword = randomBytes(32).toString('base64url')
const postgrestPassword = randomBytes(32).toString('base64url')
const agentPassword = randomBytes(32).toString('base64url')
const maxOutput = 128 * 1024 * 1024

const execute = (program, args, { input, allowFailure = false, timeout = 120_000 } = {}) => {
  const result = spawnSync(program, args, {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
    maxBuffer: maxOutput,
    timeout,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${program} ${args.slice(0, 4).join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result
}
const docker = (args, options) => execute('docker', args, options)
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const availablePort = () => new Promise((resolvePromise, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    server.close((error) => error ? reject(error) : resolvePromise(address.port))
  })
})

const startDatabase = async (name) => {
  docker([
    'run', '-d', '--name', name, '--network', networkName, '--read-only',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=2g',
    '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--shm-size', '256m',
    '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore',
    '-e', `POSTGRES_PASSWORD=${rootPassword}`,
    '--mount', `type=bind,source=${repoRoot},target=/repo,readonly`,
    postgresImage
  ])
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const inspect = docker(['inspect', '-f', '{{.State.Running}}', name], { allowFailure: true })
    if (inspect.status === 0 && inspect.stdout.trim() !== 'true') break
    const logsResult = docker(['logs', name], { allowFailure: true })
    const logs = `${logsResult.stdout}\n${logsResult.stderr}`
    if (logs.includes('PostgreSQL init process complete; ready for start up.')) {
      const ready = docker(['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'eiscore'], { allowFailure: true })
      if (ready.status === 0) return
    }
    await sleep(250)
  }
  const logs = docker(['logs', name], { allowFailure: true })
  throw new Error(`${name} did not initialize:\n${logs.stderr || logs.stdout}`)
}

const psql = (name, sql, { user = 'postgres', allowFailure = false } = {}) => docker([
  'exec', '-i', name, 'psql', '-v', 'ON_ERROR_STOP=1', '-At', '-U', user, '-d', 'eiscore'
], { input: sql, allowFailure })

const psqlFile = (name, path) => docker([
  'exec', name, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'eiscore', '-f', `/repo/${path}`
])

const runManifest = (name) => execute(process.execPath, [
  'scripts/apply-runtime-migrations.mjs', '--manifest', 'database/migrations/core.json',
  '--db-container', name, '--db-name', 'eiscore', '--db-user', 'postgres',
  '--backup-evidence', 'test://db3-isolated-tmpfs', '--release-revision', 'db3-contract-test',
  '--operator', 'database-contract-test'
])

const configureSecrets = (name) => docker([
  'exec', '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore',
  '-e', `POSTGRES_PASSWORD=${rootPassword}`, '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
  '-e', `POSTGREST_DB_PASSWORD=${postgrestPassword}`, '-e', `AGENT_DB_PASSWORD=${agentPassword}`,
  name, 'bash', '/repo/scripts/configure-database-runtime-secrets-v2.sh'
])

const installPath = (name, roleBootstrap) => {
  psqlFile(name, roleBootstrap)
  psqlFile(name, 'database/baselines/eiscore-db-v1/schema.sql')
  psqlFile(name, 'database/baselines/eiscore-db-v1/register.sql')
  runManifest(name)
  configureSecrets(name)
  psql(name, readFileSync(resolve(repoRoot, 'database/migrations/postchecks/core.sql'), 'utf8'))
}

const readCatalog = (name) => {
  const sections = {}
  for (const [section, sql] of Object.entries(databaseCatalogQueries)) {
    const result = psql(name, sql)
    sections[section] = result.stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  }
  return createDatabaseCatalog(sections)
}

const catalogSectionHashes = (catalog) => Object.fromEntries(
  Object.entries(catalog).map(([section, value]) => [section, sha256CanonicalJson(value)])
)

const describeCatalogDifference = (left, right) => {
  const leftHashes = catalogSectionHashes(left)
  const rightHashes = catalogSectionHashes(right)
  return Object.keys(leftHashes)
    .filter((section) => leftHashes[section] !== rightHashes[section])
    .map((section) => `${section}: ${leftHashes[section]} != ${rightHashes[section]}`)
    .join('; ')
}

const startApi = async (databaseContainer) => {
  const port = await availablePort()
  docker([
    'run', '-d', '--name', apiContainer, '--network', networkName, '-p', `127.0.0.1:${port}:3000`,
    '-e', `PGRST_DB_URI=postgres://eiscore_authenticator:${postgrestPassword}@${databaseContainer}:5432/eiscore`,
    '-e', `PGRST_DB_SCHEMAS=${applicationSchemas.join(',')}`,
    '-e', 'PGRST_DB_ANON_ROLE=web_anon', '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
    postgrestImage
  ])
  const baseUrl = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`)
      if (response.ok) return baseUrl
    } catch {}
    await sleep(250)
  }
  const logs = docker(['logs', apiContainer], { allowFailure: true })
  throw new Error(`PostgREST did not initialize:\n${logs.stderr || logs.stdout}`)
}

const schemaCacheLoadCount = () => {
  const logs = docker(['logs', apiContainer], { allowFailure: true })
  return (`${logs.stdout}\n${logs.stderr}`.match(/schema cache loaded/gi) || []).length
}

const waitForSchemaCacheReload = async (previousCount) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (schemaCacheLoadCount() > previousCount) return
    await sleep(250)
  }
  throw new Error('PostgREST did not acknowledge the requested schema-cache reload')
}

const jwt = (claims) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`
  return `${body}.${createHmac('sha256', jwtSecret).update(body).digest('base64url')}`
}

const fetchOpenApi = async (baseUrl, schema, headers = {}) => {
  const response = await fetch(`${baseUrl}/`, {
    headers: { accept: 'application/openapi+json', 'accept-profile': schema, ...headers }
  })
  const body = await response.text()
  assert.equal(response.status, 200, body)
  return normalizePostgrestOpenApi(JSON.parse(body))
}

const fetchOpenApiCatalog = async (baseUrl, headers = {}) => Object.fromEntries(await Promise.all(
  applicationSchemas.map(async (schema) => [schema, await fetchOpenApi(baseUrl, schema, headers)])
))

const fetchRoleOpenApiCatalog = async (baseUrl, authorization) => ({
  web_anon: await fetchOpenApiCatalog(baseUrl),
  web_user: await fetchOpenApiCatalog(baseUrl, { authorization })
})
const describeOpenApiDifference = (left, right) => Object.keys(left).flatMap((role) =>
  Object.keys(left[role]).filter((schema) =>
    sha256CanonicalJson(left[role][schema]) !== sha256CanonicalJson(right[role][schema])
  ).map((schema) => `${role}/${schema}: ${sha256CanonicalJson(left[role][schema])} != ${sha256CanonicalJson(right[role][schema])}`)
).join('; ')

const terminalMigrations = () => Object.fromEntries(
  ['runtime-v2', 'company-site', 'core'].map((name) => {
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, `database/migrations/${name}.json`), 'utf8'))
    const terminal = manifest.migrations.at(-1)
    return [name, { id: terminal.id, sha256: terminal.sha256 }]
  })
)

try {
  docker(['version'])
  docker(['network', 'create', networkName])
  await startDatabase(freshContainer)
  await startDatabase(upgradeContainer)

  installPath(freshContainer, 'database/bootstrap/roles-v2.sql')
  installPath(upgradeContainer, 'env/init_roles.sql')

  const freshCatalog = readCatalog(freshContainer)
  const upgradeCatalog = readCatalog(upgradeContainer)
  const publicRatchet = validatePublicSchemaRatchet({ repoRoot })
  assert.deepEqual(publicRatchet.errors, [])
  assert.deepEqual(validatePublicSchemaCatalog({
    catalog: freshCatalog,
    descriptor: publicRatchet.descriptor,
    baselineCatalog: publicRatchet.baselineCatalog
  }).errors, [])
  const freshHash = sha256CanonicalJson(freshCatalog)
  assert.equal(
    sha256CanonicalJson(upgradeCatalog),
    freshHash,
    `fresh install and role-upgrade catalogs differ (${describeCatalogDifference(freshCatalog, upgradeCatalog)})`
  )

  runManifest(freshContainer)
  assert.equal(sha256CanonicalJson(readCatalog(freshContainer)), freshHash, 'repeated migrations changed the database contract')

  const baseUrl = await startApi(freshContainer)
  const now = Math.floor(Date.now() / 1000)
  const claims = { role: 'web_user', app_role: 'employee', username: 'db3-contract-user', exp: now + 300 }
  const authorization = `Bearer ${jwt(claims)}`
  // The first root response only proves the public profile is serving.  Ask
  // PostgREST to finish one explicit all-profile cache generation before the
  // catalog snapshot so a concurrent startup reload cannot become the fixture.
  const startupCacheLoads = schemaCacheLoadCount()
  psql(freshContainer, "NOTIFY pgrst, 'reload schema';")
  await waitForSchemaCacheReload(startupCacheLoads)
  let hrContractReady = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const hrDocument = await fetchOpenApi(baseUrl, 'hr', { authorization })
    if (hrDocument.paths?.['/user_employee_links']
      && hrDocument.paths?.['/rpc/current_employee_archive_id']) {
      hrContractReady = true
      break
    }
    await sleep(250)
  }
  assert.equal(hrContractReady, true, 'PostgREST did not publish the core-005 HR contract')
  const openApiCatalog = await fetchRoleOpenApiCatalog(baseUrl, authorization)
  const initialApiHash = sha256CanonicalJson(openApiCatalog)

  const authHeaders = {
    authorization,
    'content-type': 'application/json',
    'content-profile': 'public'
  }
  const claimsResponse = await fetch(`${baseUrl}/rpc/ontology_current_claims`, {
    method: 'POST', headers: authHeaders, body: '{}'
  })
  const claimsBody = await claimsResponse.text()
  assert.equal(claimsResponse.status, 200, claimsBody)
  assert.deepEqual(JSON.parse(claimsBody), claims)

  const wrongRpc = await fetch(`${baseUrl}/rpc/ontology_current_claims`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ unknown_parameter: true })
  })
  const wrongRpcBody = await wrongRpc.text()
  assert.equal(wrongRpc.status, 404, wrongRpcBody)
  assert.equal(JSON.parse(wrongRpcBody).code, 'PGRST202')

  psql(freshContainer, "NOTIFY pgrst, 'reload schema';")
  let reloadedApi
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(250)
    reloadedApi = await fetchRoleOpenApiCatalog(baseUrl, authorization)
    if (sha256CanonicalJson(reloadedApi) === initialApiHash) break
  }
  assert.equal(
    sha256CanonicalJson(reloadedApi),
    initialApiHash,
    `schema-cache reload changed the API contract (${describeOpenApiDifference(openApiCatalog, reloadedApi)})`
  )

  const baseline = JSON.parse(readFileSync(resolve(repoRoot, 'database/baselines/eiscore-db-v1/manifest.json'), 'utf8'))
  const actualContract = {
    schemaVersion: 1,
    contractId: 'eiscore-db-contract-v3',
    postgresImage,
    postgrestImage,
    exposedSchemas: applicationSchemas,
    baseline: { id: baseline.baselineId, fingerprintSha256: baseline.fingerprintSha256 },
    terminalMigrations: terminalMigrations(),
    databaseCatalog: { sha256: freshHash, counts: summarizeDatabaseCatalog(freshCatalog) },
    postgrestOpenApi: {
      sha256: initialApiHash,
      roleSha256: Object.fromEntries(
        Object.entries(openApiCatalog).map(([role, documents]) => [role, sha256CanonicalJson(documents)])
      ),
      schemaSha256: Object.fromEntries(Object.entries(openApiCatalog).map(([role, documents]) => [
        role,
        Object.fromEntries(
          Object.entries(documents).map(([schema, document]) => [schema, sha256CanonicalJson(document)])
        )
      ])),
      counts: summarizePostgrestOpenApiCatalog(openApiCatalog)
    }
  }

  // Dynamic DDL is exercised only after the immutable contract snapshot so
  // the temporary table cannot become part of the release fingerprint.
  const dynamicAppId = '00000000-0000-4000-8000-000000000071'
  const serviceAppId = '00000000-0000-4000-8000-000000000072'
  const dynamicTable = 'db7_dynamic_orders'
  const serviceTable = 'data_app_00000000'
  psql(freshContainer, `
    INSERT INTO app_center.apps (id, name, app_type, config, created_by)
    VALUES
      ('${dynamicAppId}', 'DB7 governed DDL test', 'data', '{}'::jsonb, 'database-contract-test'),
      ('${serviceAppId}', 'DB7 service DDL test', 'data', '{}'::jsonb, 'database-contract-test');
  `)

  const rpc = (authorizationHeader, body) => fetch(`${baseUrl}/rpc/create_data_app_table`, {
    method: 'POST',
    headers: {
      authorization: authorizationHeader,
      'content-type': 'application/json',
      'accept-profile': 'app_center',
      'content-profile': 'app_center'
    },
    body: JSON.stringify(body)
  })
  const ddlRequest = {
    app_id: dynamicAppId,
    table_name: dynamicTable,
    columns: [{ field: 'order_no', type: 'text', label: 'Order number' }, { field: 'amount', type: 'numeric' }]
  }
  const deniedDdl = await rpc(authorization, ddlRequest)
  assert.equal(deniedDdl.status, 403, await deniedDdl.text())
  assert.equal(psql(freshContainer, `SELECT to_regclass('app_data.${dynamicTable}') IS NULL;`).stdout.trim(), 't')

  const adminAuthorization = `Bearer ${jwt({
    role: 'web_user', app_role: 'super_admin', username: 'db7-contract-admin', exp: now + 300
  })}`
  const dynamicCacheLoads = schemaCacheLoadCount()
  const createdDdl = await rpc(adminAuthorization, ddlRequest)
  assert.equal(createdDdl.status, 200, await createdDdl.text())
  await waitForSchemaCacheReload(dynamicCacheLoads)
  assert.equal(psql(freshContainer, `
    SELECT concat_ws('|', r.app_id, r.lifecycle, c.relrowsecurity,
      has_table_privilege('web_anon', c.oid, 'SELECT'),
      has_table_privilege('web_user', c.oid, 'SELECT'))
    FROM app_center.data_app_table_registry r
    JOIN pg_class c ON c.oid = to_regclass(format('%I.%I', r.table_schema, r.table_name))
    WHERE r.table_name = '${dynamicTable}';
  `).stdout.trim(), `${dynamicAppId}|managed|t|f|t`)
  assert.equal(psql(freshContainer, `
    SELECT count(*) FROM pg_policy
    WHERE polrelid = 'app_data.${dynamicTable}'::regclass
      AND polname IN ('dynamic_data_app_web_user', 'dynamic_data_app_agent');
  `).stdout.trim(), '2')

  const anonymousRead = await fetch(`${baseUrl}/${dynamicTable}`, {
    headers: { 'accept-profile': 'app_data' }
  })
  assert.notEqual(anonymousRead.status, 200, 'anonymous role must not read dynamic data-app tables')
  const authenticatedInsert = await fetch(`${baseUrl}/${dynamicTable}`, {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
      'content-profile': 'app_data',
      prefer: 'return=representation'
    },
    body: JSON.stringify({ order_no: 'DB7-001', amount: 17.5 })
  })
  assert.equal(authenticatedInsert.status, 201, await authenticatedInsert.text())

  const repeatedDdl = await rpc(adminAuthorization, ddlRequest)
  assert.equal(repeatedDdl.status, 200, await repeatedDdl.text())
  assert.equal(psql(freshContainer, `
    SELECT count(*) FROM app_center.data_app_ddl_audit
    WHERE app_id = '${dynamicAppId}' AND table_name = '${dynamicTable}';
  `).stdout.trim(), '2')

  const collision = await rpc(adminAuthorization, { ...ddlRequest, app_id: serviceAppId })
  assert.equal(collision.status, 409, await collision.text())
  const invalidIdentifier = await rpc(adminAuthorization, {
    ...ddlRequest,
    columns: [{ field: 'unsafe-column', type: 'text' }]
  })
  assert.equal(invalidIdentifier.status, 400, await invalidIdentifier.text())
  const typeConflict = await rpc(adminAuthorization, {
    ...ddlRequest,
    columns: [{ field: 'amount', type: 'text' }]
  })
  assert.equal(typeConflict.status, 400, await typeConflict.text())
  assert.equal(psql(freshContainer, `
    SELECT format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
    WHERE a.attrelid = 'app_data.${dynamicTable}'::regclass
      AND a.attname = 'amount';
  `).stdout.trim(), 'numeric')

  assert.equal(psql(freshContainer, `
    SET SESSION AUTHORIZATION eiscore_agent;
    SELECT app_center.create_data_app_table('${serviceAppId}'::uuid, NULL, '[{"field":"source_ref","type":"text"}]'::jsonb);
  `).stdout.trim().split(/\r?\n/).at(-1), `app_data.${serviceTable}`)
  assert.equal(psql(freshContainer, `
    SELECT count(*) FROM app_center.data_app_table_registry
    WHERE lifecycle = 'quarantined' AND app_id IS NULL;
  `).stdout.trim(), '10')

  psql(freshContainer, `
    DELETE FROM app_center.data_app_ddl_audit WHERE app_id IN ('${dynamicAppId}', '${serviceAppId}');
    DELETE FROM app_center.data_app_table_registry WHERE app_id IN ('${dynamicAppId}', '${serviceAppId}');
    DROP TABLE app_data.${dynamicTable};
    DROP TABLE app_data.${serviceTable};
    DELETE FROM app_center.apps WHERE id IN ('${dynamicAppId}', '${serviceAppId}');
  `)

  if (process.argv.includes('--print-contract')) {
    process.stdout.write(`${JSON.stringify(actualContract, null, 2)}\n`)
  } else {
    assert.ok(existsSync(expectedPath), 'database contract fixture is missing; inspect --print-contract output before adding it')
    const expectedContract = JSON.parse(readFileSync(expectedPath, 'utf8'))
    assert.equal(canonicalJson(actualContract), canonicalJson(expectedContract), 'database/PostgREST contract fingerprint drift')
    console.log(`PASS: DB3 fresh/upgrade/repeat catalog and PostgREST contract (${freshHash})`)
  }
} finally {
  docker(['rm', '-f', apiContainer], { allowFailure: true })
  docker(['rm', '-f', freshContainer], { allowFailure: true })
  docker(['rm', '-f', upgradeContainer], { allowFailure: true })
  docker(['network', 'rm', networkName], { allowFailure: true })
}
