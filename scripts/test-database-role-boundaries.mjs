// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`
const dbContainer = `eiscore-db2-db-${suffix}`
const apiContainer = `eiscore-db2-api-${suffix}`
const networkName = `eiscore-db2-net-${suffix}`
const postgresImage = 'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f'
const postgrestImage = 'postgrest/postgrest@sha256:00c1ec8a9339f52a7e765cb3bd3ab5b001f0b5dd954cfb69b43b9de494a9a0aa'
const rootPassword = randomBytes(32).toString('base64url')
const postgrestPassword = randomBytes(32).toString('base64url')
const agentPassword = randomBytes(32).toString('base64url')
const jwtSecret = randomBytes(40).toString('base64url')

const command = (args, { input = undefined, allowFailure = false, timeout = 120_000 } = {}) => {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args.slice(0, 3).join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result
}

const psql = (user, sql, { password = '', allowFailure = false, host = '' } = {}) => command([
  'exec', ...(password ? ['-e', `PGPASSWORD=${password}`] : []), '-i', dbContainer,
  'psql', '-v', 'ON_ERROR_STOP=1', '-At', ...(host ? ['-h', host] : []), '-U', user, '-d', 'eiscore'
], { input: sql, allowFailure })

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const availablePort = () => new Promise((resolvePromise, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    server.close((error) => error ? reject(error) : resolvePromise(address.port))
  })
})

const waitForDatabase = async () => {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const inspect = command(['inspect', '-f', '{{.State.Running}}', dbContainer], { allowFailure: true })
    if (inspect.status === 0 && inspect.stdout.trim() !== 'true') break
    const logs = command(['logs', dbContainer], { allowFailure: true }).stdout + command(['logs', dbContainer], { allowFailure: true }).stderr
    if (logs.includes('PostgreSQL init process complete; ready for start up.')) {
      const ready = command(['exec', dbContainer, 'pg_isready', '-U', 'postgres', '-d', 'eiscore'], { allowFailure: true })
      if (ready.status === 0) return
    }
    await sleep(250)
  }
  const logs = command(['logs', dbContainer], { allowFailure: true })
  throw new Error(`database did not complete isolated initialization:\n${logs.stderr || logs.stdout}`)
}

const waitForApi = async (baseUrl) => {
  let lastError
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`)
      if (response.ok) return
      lastError = new Error(`PostgREST returned ${response.status}: ${await response.text()}`)
    } catch (error) {
      lastError = error
    }
    await sleep(250)
  }
  const logs = command(['logs', apiContainer], { allowFailure: true })
  throw new Error(`PostgREST did not become ready: ${lastError?.message || 'unknown'}\n${logs.stderr || logs.stdout}`)
}

const token = (claims) => {
  const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`
  return `${body}.${createHmac('sha256', jwtSecret).update(body).digest('base64url')}`
}

const assertDenied = (label, user, sql) => {
  const result = psql(user, sql, { allowFailure: true })
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`)
  assert.match(`${result.stdout}\n${result.stderr}`, /permission denied|must be owner/i, `${label} failed for an unexpected reason`)
}

const mount = (repoPath, containerPath) => `${resolve(repoRoot, repoPath)}:${containerPath}:ro`

try {
  command(['version'])
  command(['network', 'create', networkName])
  command([
    'run', '-d', '--name', dbContainer, '--network', networkName,
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=2g',
    '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
    '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore', '-e', `POSTGRES_PASSWORD=${rootPassword}`,
    '-e', `PGRST_JWT_SECRET=${jwtSecret}`, '-e', `POSTGREST_DB_PASSWORD=${postgrestPassword}`,
    '-e', `AGENT_DB_PASSWORD=${agentPassword}`,
    '-v', mount('database/bootstrap/roles-v2.sql', '/docker-entrypoint-initdb.d/00_roles.sql'),
    '-v', mount('database/baselines/eiscore-db-v1/schema.sql', '/docker-entrypoint-initdb.d/01_schema.sql'),
    '-v', mount('database/baselines/eiscore-db-v1/register.sql', '/docker-entrypoint-initdb.d/02_register.sql'),
    '-v', mount('database/migrations/sql/core-002-role-boundaries.sql', '/docker-entrypoint-initdb.d/03_role_boundaries.sql'),
    '-v', mount('scripts/configure-database-runtime-secrets-v2.sh', '/docker-entrypoint-initdb.d/04_runtime_secrets.sh'),
    postgresImage
  ])
  await waitForDatabase()

  const migration = spawnSync(process.execPath, [
    'scripts/apply-runtime-migrations.mjs', '--manifest', 'database/migrations/core.json',
    '--db-container', dbContainer, '--db-name', 'eiscore', '--db-user', 'postgres',
    '--backup-evidence', 'test://isolated-tmpfs', '--release-revision', 'db2-contract-test',
    '--operator', 'database-role-contract'
  ], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true })
  assert.equal(migration.status, 0, migration.stderr || migration.stdout)

  const postcheck = readFileSync(resolve(repoRoot, 'database/migrations/postchecks/core.sql'), 'utf8')
  assert.equal(psql('postgres', postcheck).status, 0)

  const agentPositive = psql('eiscore_agent', `
    SELECT session_user, current_user, public.document_intake_can_manage();
    SELECT count(*) FROM public.document_assets;
    UPDATE workflow.instances SET status = status WHERE id = -1;
  `)
  assert.match(agentPositive.stdout, /eiscore_agent\|eiscore_agent\|t/)
  assertDenied('agent DELETE', 'eiscore_agent', 'DELETE FROM public.document_assets WHERE false;')
  assertDenied('agent public DDL', 'eiscore_agent', 'CREATE TABLE public.db2_forbidden(id integer);')
  assertDenied('authenticator owner escalation', 'eiscore_authenticator', 'SET ROLE eiscore_owner;')

  assert.equal(psql('eiscore_agent', 'SELECT current_user;', { password: agentPassword, host: '127.0.0.1' }).stdout.trim(), 'eiscore_agent')
  assert.match(
    psql('eiscore_authenticator', 'SET ROLE web_user; SELECT current_user;', { password: postgrestPassword, host: '127.0.0.1' }).stdout,
    /web_user/
  )

  psql('postgres', `
    INSERT INTO public.document_assets (original_filename, storage_path, file_hash)
    VALUES ('db2-contract.txt', '/isolated/db2-contract.txt', 'db2-contract-hash');
  `)

  const apiPort = await availablePort()
  command([
    'run', '-d', '--name', apiContainer, '--network', networkName, '-p', `127.0.0.1:${apiPort}:3000`,
    '-e', `PGRST_DB_URI=postgres://eiscore_authenticator:${postgrestPassword}@${dbContainer}:5432/eiscore`,
    '-e', 'PGRST_DB_SCHEMAS=public,hr,scm,app_center,workflow,app_data,company_site',
    '-e', 'PGRST_DB_ANON_ROLE=web_anon', '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
    postgrestImage
  ])
  const baseUrl = `http://127.0.0.1:${apiPort}`
  await waitForApi(baseUrl)

  const anonRead = await fetch(`${baseUrl}/sales_customers?select=id&limit=1`)
  assert.equal(anonRead.status, 200, await anonRead.text())
  const anonProtected = await fetch(`${baseUrl}/document_assets?select=id&limit=1`)
  assert.ok([401, 403].includes(anonProtected.status), `anonymous protected read returned ${anonProtected.status}`)
  const anonWrite = await fetch(`${baseUrl}/sales_customers`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'forbidden' })
  })
  assert.ok([401, 403].includes(anonWrite.status), `anonymous write returned ${anonWrite.status}`)

  const now = Math.floor(Date.now() / 1000)
  const userHeaders = { authorization: `Bearer ${token({ role: 'web_user', app_role: 'employee', username: 'db2-user', exp: now + 300 })}` }
  const adminHeaders = { authorization: `Bearer ${token({ role: 'web_user', app_role: 'super_admin', username: 'db2-admin', exp: now + 300 })}` }
  const userRead = await fetch(`${baseUrl}/document_assets?select=id`, { headers: userHeaders })
  const userReadBody = await userRead.text()
  assert.equal(userRead.status, 200, userReadBody)
  assert.deepEqual(JSON.parse(userReadBody), [], 'ordinary user must not bypass document RLS')
  const adminRead = await fetch(`${baseUrl}/document_assets?select=id`, { headers: adminHeaders })
  const adminReadBody = await adminRead.text()
  assert.equal(adminRead.status, 200, adminReadBody)
  assert.equal(JSON.parse(adminReadBody).length, 1, 'admin claim should pass the document RLS policy')

  const runtimeUsers = psql('postgres', `
    SELECT usename, count(*)
    FROM pg_stat_activity
    WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()
    GROUP BY usename ORDER BY usename;
  `).stdout
  assert.match(runtimeUsers, /eiscore_authenticator\|[1-9]/)
  assert.doesNotMatch(runtimeUsers, /^postgres\|/m, 'a runtime service opened a superuser connection')

  const roleFlags = psql('postgres', `
    SELECT count(*) FROM pg_roles
    WHERE rolname IN ('eiscore_owner','eiscore_migrator','eiscore_authenticator','eiscore_agent','web_anon','web_user')
      AND (rolsuper OR rolbypassrls);
  `).stdout.trim()
  assert.equal(roleFlags, '0')

  console.log('PASS: isolated DB2 PostgreSQL/PostgREST roles, RLS, password authentication and denial contracts')
} finally {
  command(['rm', '-f', apiContainer], { allowFailure: true })
  command(['rm', '-f', dbContainer], { allowFailure: true })
  command(['network', 'rm', networkName], { allowFailure: true })
}
