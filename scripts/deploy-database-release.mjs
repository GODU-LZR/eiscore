// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  applicationSchemas,
  createDatabaseCatalog,
  databaseCatalogQueries,
  normalizePostgrestOpenApi,
  sha256CanonicalJson
} from './database-contract-catalog.mjs'
import {
  databaseReleaseManifestSha256,
  defaultDatabaseReleasePath,
  loadAndValidateDatabaseRelease
} from './database-release-contract.mjs'
import {
  DockerPsqlAdapter,
  executeRuntimeMigrationPlan,
  loadRuntimeMigrationPlan,
  quoteSqlLiteral
} from './apply-runtime-migrations.mjs'
import {
  validatePublicSchemaCatalog,
  validatePublicSchemaRatchet
} from './public-schema-ratchet.mjs'
import {
  acquirePostgresAdvisoryLock,
  withDatabaseOperationLock
} from './database-operation-lock.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const maxOutput = 256 * 1024 * 1024
const optionNames = new Map([
  ['--release', 'releasePath'],
  ['--db-container', 'dbContainer'],
  ['--db-name', 'dbName'],
  ['--db-user', 'dbUser'],
  ['--api-container', 'apiContainer'],
  ['--api-url', 'apiUrl'],
  ['--backup-dir', 'backupDir'],
  ['--environment', 'environment'],
  ['--backup-storage-evidence', 'backupStorageEvidence'],
  ['--operator', 'operator']
])

export const parseDatabaseReleaseArgs = (argv) => {
  const options = {
    releasePath: defaultDatabaseReleasePath,
    dbContainer: 'eiscore-db',
    dbName: 'eiscore',
    dbUser: 'postgres',
    apiContainer: 'eiscore-api',
    apiUrl: '',
    backupDir: '',
    environment: '',
    backupStorageEvidence: '',
    operator: '',
    dryRun: false
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    const name = optionNames.get(argument)
    if (!name) throw new Error(`unknown argument: ${argument}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`missing value for ${argument}`)
    options[name] = value
    index += 1
  }
  return options
}

const requireValue = (label, value, maxLength = 512) => {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label} is required for database release execution`)
  if (normalized.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters`)
  return normalized
}

const validateSecret = (name, value, minimum) => {
  const secret = requireValue(name, value, 4096)
  if (secret.length < minimum) throw new Error(`${name} must contain at least ${minimum} characters`)
  if (!/^[A-Za-z0-9_-]+$/.test(secret)) throw new Error(`${name} must use Base64URL characters only`)
  if (/^(postgres|postgres123|replace_me|change_me)/i.test(secret)) throw new Error(`${name} contains a weak or placeholder value`)
  return secret
}

export const resolveDatabaseReleaseExecution = (options, env = process.env) => {
  const postgrestPassword = validateSecret('POSTGREST_DB_PASSWORD', env.POSTGREST_DB_PASSWORD, 24)
  const agentPassword = validateSecret('AGENT_DB_PASSWORD', env.AGENT_DB_PASSWORD, 24)
  const jwtSecret = validateSecret('PGRST_JWT_SECRET', env.PGRST_JWT_SECRET, 32)
  if (postgrestPassword === agentPassword) throw new Error('database service passwords must be independent')
  if (env.POSTGRES_PASSWORD && [postgrestPassword, agentPassword].includes(env.POSTGRES_PASSWORD)) {
    throw new Error('database service passwords must not reuse POSTGRES_PASSWORD')
  }
  const environment = requireValue('--environment', options.environment)
  if (!['isolated', 'production'].includes(environment)) throw new Error('--environment must be isolated or production')
  const backupStorageEvidence = requireValue('--backup-storage-evidence', options.backupStorageEvidence, 1024)
  if (!/^(isolated|kms|vault|volume):\/\/.+/.test(backupStorageEvidence)) {
    throw new Error('--backup-storage-evidence must be an isolated/kms/vault/volume evidence URI')
  }
  if (environment === 'production' && backupStorageEvidence.startsWith('isolated://')) {
    throw new Error('production backup storage evidence must prove encrypted storage')
  }
  return {
    backupDir: resolve(requireValue('--backup-dir', options.backupDir)),
    apiUrl: requireValue('--api-url', options.apiUrl).replace(/\/+$/, ''),
    operator: requireValue('--operator, USERNAME or USER', options.operator || env.USERNAME || env.USER, 256),
    environment,
    backupStorageEvidence,
    secrets: { postgrestPassword, agentPassword, jwtSecret, postgresPassword: env.POSTGRES_PASSWORD || '' }
  }
}

const execute = (args, { input, encoding = 'utf8', allowFailure = false, timeout = 120_000 } = {}) => {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    input,
    encoding,
    maxBuffer: maxOutput,
    timeout,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    const output = encoding ? String(result.stderr || result.stdout || '').trim() : 'binary command failed'
    throw new Error(`docker ${args.slice(0, 4).join(' ')} failed${output ? `: ${output}` : ''}`)
  }
  return result
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const parseJsonLines = (text) => String(text).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))

export class DatabaseReleaseDockerAdapter extends DockerPsqlAdapter {
  constructor(options) {
    super(options)
    this.options = options
    this.operationDeadline = 0
    this.operationName = ''
  }

  acquireOperationLock(policy) {
    return acquirePostgresAdvisoryLock({
      dbContainer: this.dbContainer,
      dbName: this.dbName,
      dbUser: this.dbUser,
      key: policy.advisoryLockKey,
      waitTimeoutMs: policy.lockWaitTimeoutMs,
      holderExitTimeoutMs: policy.holderExitTimeoutMs,
      operation: policy.operation,
      cwd: repoRoot
    })
  }

  beginOperationBudget({ operation, timeoutMs }) {
    this.operationName = operation
    this.operationDeadline = Date.now() + timeoutMs
  }

  assertOperationBudget(stage) {
    this.operationLockGuard?.assertHeld()
    if (this.operationDeadline && Date.now() > this.operationDeadline) {
      throw new Error(`database ${this.operationName} timeout exceeded at ${stage}`)
    }
  }

  query(sql, { user = this.dbUser, password = '', host = '' } = {}) {
    const result = execute([
      'exec', ...(password ? ['-e', `PGPASSWORD=${password}`] : []), '-i', this.dbContainer,
      'psql', '-v', 'ON_ERROR_STOP=1', '-At', ...(host ? ['-h', host] : []),
      '-U', user, '-d', this.dbName
    ], { input: sql })
    return String(result.stdout || '').trim()
  }

  containerImage(name) {
    return String(execute(['inspect', '-f', '{{.Config.Image}}', name]).stdout).trim()
  }

  inspectState(name) {
    return String(execute(['inspect', '-f', '{{.State.Status}}', name]).stdout).trim()
  }

  preflight(manifest) {
    super.ensureReady()
    if (this.containerImage(this.dbContainer) !== manifest.images.postgres) {
      throw new Error('target PostgreSQL container image does not match the release manifest')
    }
    const serverVersion = Number(this.query('SHOW server_version_num;'))
    if (!Number.isInteger(serverVersion) || Math.floor(serverVersion / 10000) !== 16) {
      throw new Error(`unsupported PostgreSQL server version: ${serverVersion || 'unknown'}`)
    }
    if (this.query('SELECT current_database();') !== this.dbName) throw new Error('target database identity mismatch')
  }

  readCatalog() {
    const sections = {}
    for (const [section, sql] of Object.entries(databaseCatalogQueries)) {
      sections[section] = parseJsonLines(this.query(sql))
    }
    return createDatabaseCatalog(sections)
  }

  readGovernanceState() {
    return {
      baselines: parseJsonLines(this.query(`
        SELECT jsonb_build_object(
          'id', baseline_id,
          'fingerprintSha256', baseline_fingerprint_sha256,
          'schemaSha256', schema_sha256,
          'objectCatalogSha256', object_catalog_sha256
        )::text FROM eiscore_meta.database_baselines ORDER BY baseline_id;
      `)),
      migrations: parseJsonLines(this.query(`
        SELECT jsonb_build_object('id', migration_id, 'sha256', checksum_sha256)::text
        FROM eiscore_meta.schema_migrations ORDER BY migration_id;
      `)),
      coverage: parseJsonLines(this.query(`
        SELECT jsonb_build_object('id', migration_id, 'sha256', checksum_sha256)::text
        FROM eiscore_meta.baseline_migration_coverage ORDER BY migration_id;
      `))
    }
  }

  createBackup({ backupRoot, manifest, manifestSha256, operator, environment, backupStorageEvidence }) {
    const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`
    const directory = resolve(backupRoot, `${manifest.releaseId}-${suffix}`)
    mkdirSync(directory, { recursive: true })
    const databaseDump = execute([
      'exec', this.dbContainer, 'pg_dump', '-U', this.dbUser, '-d', this.dbName,
      '--format=custom', '--compress=6'
    ], { encoding: null, timeout: 300_000 }).stdout
    if (!Buffer.isBuffer(databaseDump) || databaseDump.length === 0) throw new Error('database backup is empty')
    const verification = execute([
      'exec', '-i', this.dbContainer, 'pg_restore', '--list'
    ], { input: databaseDump, timeout: 300_000 })
    if (!String(verification.stdout).includes('TABLE')) throw new Error('database backup catalog is incomplete')
    const globals = String(execute([
      'exec', this.dbContainer, 'pg_dumpall', '-U', this.dbUser,
      '--globals-only', '--no-role-passwords'
    ], { timeout: 300_000 }).stdout)
    if (!globals.includes('CREATE ROLE') || /PASSWORD\s+'[^']+'/i.test(globals)) {
      throw new Error('password-free role backup verification failed')
    }
    const dumpPath = resolve(directory, 'database.dump')
    const globalsPath = resolve(directory, 'globals-without-passwords.sql')
    writeFileSync(dumpPath, databaseDump)
    writeFileSync(globalsPath, globals, 'utf8')
    const evidence = {
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      releaseManifestSha256: manifestSha256,
      sourceRevision: manifest.sourceRevision,
      database: this.dbName,
      databaseDump: { path: dumpPath, sha256: sha256(databaseDump), bytes: databaseDump.length },
      globals: { path: globalsPath, sha256: sha256(Buffer.from(globals, 'utf8')), passwordsIncluded: false },
      verifiedBy: 'pg_restore --list',
      environment,
      storageEncryptionEvidence: backupStorageEvidence,
      operator,
      createdAt: new Date().toISOString()
    }
    const evidencePath = resolve(directory, 'backup-evidence.json')
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    return { ...evidence, evidencePath }
  }

  initializeReleaseLedger() {
    this.executeSql('database release ledger initialization', readFileSync(resolve(repoRoot, 'database/release-ledger.sql'), 'utf8'))
  }

  configureRuntimeSecrets(secrets) {
    const args = [
      'exec', '-i',
      '-e', `POSTGRES_USER=${this.dbUser}`,
      '-e', `POSTGRES_DB=${this.dbName}`,
      '-e', `PGRST_JWT_SECRET=${secrets.jwtSecret}`,
      '-e', `POSTGREST_DB_PASSWORD=${secrets.postgrestPassword}`,
      '-e', `AGENT_DB_PASSWORD=${secrets.agentPassword}`
    ]
    if (secrets.postgresPassword) args.push('-e', `POSTGRES_PASSWORD=${secrets.postgresPassword}`)
    args.push(this.dbContainer, 'bash', '-s')
    execute(args, { input: readFileSync(resolve(repoRoot, 'scripts/configure-database-runtime-secrets-v2.sh'), 'utf8') })
    const agent = this.query('SELECT current_user;', {
      user: 'eiscore_agent', password: secrets.agentPassword, host: '127.0.0.1'
    })
    if (agent !== 'eiscore_agent') throw new Error('agent service password verification failed')
    const authenticator = this.query('SET ROLE web_user; SELECT current_user;', {
      user: 'eiscore_authenticator', password: secrets.postgrestPassword, host: '127.0.0.1'
    })
    if (!authenticator.split(/\r?\n/).includes('web_user')) throw new Error('PostgREST role-switch verification failed')
  }

  readPostgrestSchemaCacheEvents(apiContainer, since) {
    const result = execute(['logs', '--since', since, apiContainer], { allowFailure: true })
    const output = `${result.stdout || ''}\n${result.stderr || ''}`
    return (output.match(/schema cache loaded/gi) || []).length
  }

  createPostgrestReloadMarker(apiContainer) {
    const since = new Date(Date.now() - 1_000).toISOString()
    return { since, count: this.readPostgrestSchemaCacheEvents(apiContainer, since) }
  }

  hasPostgrestReloaded(apiContainer, marker) {
    return this.readPostgrestSchemaCacheEvents(apiContainer, marker.since) > marker.count
  }

  async ensureApi(manifest, apiContainer, apiUrl, policy) {
    if (this.containerImage(apiContainer) !== manifest.images.postgrest) {
      throw new Error('target PostgREST container image does not match the release manifest')
    }
    if (this.inspectState(apiContainer) !== 'running') execute(['start', apiContainer])
    let lastError
    let stableResponses = 0
    const deadline = Date.now() + policy.readinessTimeoutMs
    while (Date.now() <= deadline) {
      try {
        const response = await fetch(`${apiUrl}/`, {
          signal: AbortSignal.timeout(policy.httpRequestTimeoutMs)
        })
        const body = await response.text()
        if (response.ok) {
          stableResponses += 1
          if (stableResponses >= policy.stableFingerprintSamples) return
        } else {
          stableResponses = 0
          lastError = new Error(`HTTP ${response.status}: ${body}`)
        }
      } catch (error) {
        stableResponses = 0
        lastError = error
      }
      await sleep(policy.pollIntervalMs)
    }
    throw new Error(
      `PostgREST candidate did not become stably ready within ${policy.readinessTimeoutMs} ms: ${lastError?.message || 'unknown error'}`
    )
  }

  recordRelease({ manifest, manifestSha256, contract, backupEvidence, operator }) {
    const evidenceJson = JSON.stringify(backupEvidence)
    const sql = `
      DO $$
      DECLARE existing_record eiscore_meta.database_releases%ROWTYPE;
      BEGIN
        SELECT * INTO existing_record
        FROM eiscore_meta.database_releases
        WHERE release_id = ${quoteSqlLiteral(manifest.releaseId)};
        IF FOUND THEN
          IF existing_record.manifest_sha256 <> ${quoteSqlLiteral(manifestSha256)}
             OR existing_record.source_revision <> ${quoteSqlLiteral(manifest.sourceRevision)}
             OR existing_record.database_catalog_sha256 <> ${quoteSqlLiteral(contract.databaseCatalog.sha256)}
             OR existing_record.postgrest_openapi_sha256 <> ${quoteSqlLiteral(contract.postgrestOpenApi.sha256)} THEN
            RAISE EXCEPTION 'database release ledger conflict for %', ${quoteSqlLiteral(manifest.releaseId)};
          END IF;
        ELSE
          INSERT INTO eiscore_meta.database_releases (
            release_id, manifest_sha256, source_revision, database_catalog_sha256,
            postgrest_openapi_sha256, backup_evidence, applied_by
          ) VALUES (
            ${quoteSqlLiteral(manifest.releaseId)}, ${quoteSqlLiteral(manifestSha256)},
            ${quoteSqlLiteral(manifest.sourceRevision)}, ${quoteSqlLiteral(contract.databaseCatalog.sha256)},
            ${quoteSqlLiteral(contract.postgrestOpenApi.sha256)},
            ${quoteSqlLiteral(evidenceJson)}::jsonb, ${quoteSqlLiteral(operator)}
          );
        END IF;
      END
      $$;
    `
    this.executeSql('database release success record', sql)
  }
}

const releaseMigrations = (manifest) => new Map(manifest.migrationManifests
  .flatMap(({ migrations }) => migrations.map(({ id, sha256: checksum }) => [id, checksum])))

export const validateDatabaseReleasePreflight = ({ manifest, catalogSha256, governanceState }) => {
  const errors = []
  const allowedCatalogs = new Set([
    manifest.databaseContract.databaseCatalogSha256,
    ...manifest.predecessors.map(({ databaseCatalogSha256 }) => databaseCatalogSha256)
  ])
  if (!allowedCatalogs.has(catalogSha256)) errors.push(`schema drift: unrecognized database catalog ${catalogSha256}`)
  const baseline = governanceState.baselines.find(({ id }) => id === manifest.baseline.id)
  if (!baseline) errors.push(`required baseline is not installed: ${manifest.baseline.id}`)
  else {
    if (baseline.fingerprintSha256 !== manifest.baseline.fingerprintSha256) errors.push('installed baseline fingerprint conflict')
    if (baseline.schemaSha256 !== manifest.baseline.schemaSha256) errors.push('installed baseline schema checksum conflict')
    if (baseline.objectCatalogSha256 !== manifest.baseline.objectCatalogSha256) errors.push('installed baseline object catalog checksum conflict')
  }
  const expectedMigrations = releaseMigrations(manifest)
  for (const [source, entries] of [['migration ledger', governanceState.migrations], ['baseline coverage', governanceState.coverage]]) {
    for (const entry of entries) {
      if (!expectedMigrations.has(entry.id)) errors.push(`${source} contains an unknown migration: ${entry.id}`)
      else if (expectedMigrations.get(entry.id) !== entry.sha256) errors.push(`${source} checksum conflict: ${entry.id}`)
    }
  }
  return errors
}

const token = (claims, secret) => {
  const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

const fetchOpenApi = async (apiUrl, schema, authorization = '', timeoutMs = 5_000) => {
  const headers = { accept: 'application/openapi+json', 'accept-profile': schema }
  if (authorization) headers.authorization = authorization
  const response = await fetch(`${apiUrl}/`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  })
  const body = await response.text()
  assert.equal(response.status, 200, body)
  return normalizePostgrestOpenApi(JSON.parse(body))
}

const fetchOpenApiCatalog = async (apiUrl, authorization, timeoutMs) => ({
  web_anon: Object.fromEntries(await Promise.all(applicationSchemas.map(async (schema) => [
    schema, await fetchOpenApi(apiUrl, schema, '', timeoutMs)
  ]))),
  web_user: Object.fromEntries(await Promise.all(applicationSchemas.map(async (schema) => [
    schema, await fetchOpenApi(apiUrl, schema, authorization, timeoutMs)
  ])))
})

export const describePostgrestContractDifference = (contract, catalog) => {
  const differences = []
  for (const role of ['web_anon', 'web_user']) {
    const actualRole = sha256CanonicalJson(catalog?.[role] || {})
    const expectedRole = contract.postgrestOpenApi.roleSha256?.[role]
    if (expectedRole && actualRole !== expectedRole) {
      differences.push(`${role}: expected ${expectedRole}, received ${actualRole}`)
    }
    for (const schema of applicationSchemas) {
      const actualSchema = sha256CanonicalJson(catalog?.[role]?.[schema] || {})
      const expectedSchema = contract.postgrestOpenApi.schemaSha256?.[role]?.[schema]
      if (expectedSchema && actualSchema !== expectedSchema) {
        differences.push(`${role}/${schema}: expected ${expectedSchema}, received ${actualSchema}`)
      }
    }
  }
  return differences
}

export const verifyReleasedPostgrest = async ({
  adapter,
  apiContainer,
  apiUrl,
  contract,
  jwtSecret,
  policy
}) => {
  const reloadMarker = adapter.createPostgrestReloadMarker(apiContainer)
  adapter.executeSql('PostgREST schema cache reload', "NOTIFY pgrst, 'reload schema';")
  const claims = {
    role: 'web_user', app_role: 'employee', username: 'db4-release-verifier',
    exp: Math.floor(Date.now() / 1000) + 300
  }
  const authorization = `Bearer ${token(claims, jwtSecret)}`
  let catalog
  let actualHash = ''
  let stableSamples = 0
  let reloadAcknowledged = false
  let lastError
  const deadline = Date.now() + policy.reloadTimeoutMs
  while (Date.now() <= deadline) {
    reloadAcknowledged = reloadAcknowledged || adapter.hasPostgrestReloaded(apiContainer, reloadMarker)
    try {
      catalog = await fetchOpenApiCatalog(apiUrl, authorization, policy.httpRequestTimeoutMs)
      actualHash = sha256CanonicalJson(catalog)
      stableSamples = reloadAcknowledged && actualHash === contract.postgrestOpenApi.sha256
        ? stableSamples + 1
        : 0
      if (stableSamples >= policy.stableFingerprintSamples) break
    } catch (error) {
      stableSamples = 0
      lastError = error
    }
    await sleep(policy.pollIntervalMs)
  }
  if (!reloadAcknowledged || stableSamples < policy.stableFingerprintSamples) {
    const differences = catalog ? describePostgrestContractDifference(contract, catalog) : []
    throw new Error([
      `PostgREST schema-cache readiness failed within ${policy.reloadTimeoutMs} ms`,
      `reloadAcknowledged=${reloadAcknowledged}`,
      `stableSamples=${stableSamples}/${policy.stableFingerprintSamples}`,
      `expected=${contract.postgrestOpenApi.sha256}`,
      `actual=${actualHash || '<unavailable>'}`,
      ...(lastError ? [`lastError=${lastError.message}`] : []),
      ...differences
    ].join('; '))
  }
  const rpc = await fetch(`${apiUrl}/rpc/ontology_current_claims`, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json', 'content-profile': 'public' },
    body: '{}',
    signal: AbortSignal.timeout(policy.httpRequestTimeoutMs)
  })
  const body = await rpc.text()
  assert.equal(rpc.status, 200, body)
  assert.deepEqual(JSON.parse(body), claims)
}

export const executeDatabaseRelease = async ({
  manifest,
  manifestSha256,
  contract,
  options,
  execution,
  adapter,
  log = console.log
}) => {
  const postgrestPolicy = manifest.operationPolicy.postgrest
  adapter.assertOperationBudget?.('preflight')
  adapter.preflight(manifest)
  const publicRatchet = validatePublicSchemaRatchet({ repoRoot })
  if (publicRatchet.errors.length) {
    throw new Error(`public Schema ratchet is invalid:\n- ${publicRatchet.errors.join('\n- ')}`)
  }
  const beforeCatalog = adapter.readCatalog()
  const beforePublicErrors = validatePublicSchemaCatalog({
    catalog: beforeCatalog,
    descriptor: publicRatchet.descriptor,
    baselineCatalog: publicRatchet.baselineCatalog
  }).errors
  if (beforePublicErrors.length) {
    throw new Error(`public Schema preflight failed:\n- ${beforePublicErrors.join('\n- ')}`)
  }
  const beforeCatalogSha256 = sha256CanonicalJson(beforeCatalog)
  const preflightErrors = validateDatabaseReleasePreflight({
    manifest,
    catalogSha256: beforeCatalogSha256,
    governanceState: adapter.readGovernanceState()
  })
  if (preflightErrors.length) throw new Error(`database release preflight failed:\n- ${preflightErrors.join('\n- ')}`)
  log(`Preflight passed: ${beforeCatalogSha256}`)
  adapter.assertOperationBudget?.('backup')

  const backupEvidence = adapter.createBackup({
    backupRoot: execution.backupDir,
    manifest,
    manifestSha256,
    operator: execution.operator,
    environment: execution.environment,
    backupStorageEvidence: execution.backupStorageEvidence
  })
  const backupReference = `backup://${manifest.releaseId}/${backupEvidence.databaseDump.sha256}`
  log(`Verified backup: ${backupEvidence.evidencePath}`)

  for (const descriptor of manifest.migrationManifests) {
    adapter.assertOperationBudget?.(`migration manifest ${descriptor.name}`)
    const plan = loadRuntimeMigrationPlan({ repoRoot, manifestPath: descriptor.path })
    executeRuntimeMigrationPlan({
      plan,
      adapter,
      metadata: {
        backupEvidence: backupReference,
        releaseRevision: manifest.sourceRevision,
        operator: execution.operator
      },
      log
    })
  }
  // The predecessor may not have eiscore_owner yet. Initialise this ledger
  // only after role migrations so its final owner is always non-login.
  adapter.initializeReleaseLedger()
  adapter.configureRuntimeSecrets(execution.secrets)
  adapter.assertOperationBudget?.('database contract verification')

  const afterCatalog = adapter.readCatalog()
  const afterPublicErrors = validatePublicSchemaCatalog({
    catalog: afterCatalog,
    descriptor: publicRatchet.descriptor,
    baselineCatalog: publicRatchet.baselineCatalog
  }).errors
  if (afterPublicErrors.length) {
    throw new Error(`public Schema post-release check failed:\n- ${afterPublicErrors.join('\n- ')}`)
  }
  const afterCatalogSha256 = sha256CanonicalJson(afterCatalog)
  if (afterCatalogSha256 !== contract.databaseCatalog.sha256) {
    throw new Error(`post-release database catalog drift: ${afterCatalogSha256}`)
  }
  await adapter.ensureApi(manifest, options.apiContainer, execution.apiUrl, postgrestPolicy)
  await verifyReleasedPostgrest({
    adapter,
    apiContainer: options.apiContainer,
    apiUrl: execution.apiUrl,
    contract,
    jwtSecret: execution.secrets.jwtSecret,
    policy: postgrestPolicy
  })
  adapter.assertOperationBudget?.('release record')
  adapter.recordRelease({
    manifest, manifestSha256, contract, backupEvidence, operator: execution.operator
  })
  log(`Database release passed: ${manifest.releaseId} (${manifestSha256})`)
  return { releaseId: manifest.releaseId, manifestSha256, backupEvidence, beforeCatalogSha256, afterCatalogSha256 }
}

export const runDatabaseRelease = async ({
  options,
  root = repoRoot,
  env = process.env,
  adapterFactory = (adapterOptions) => new DatabaseReleaseDockerAdapter(adapterOptions),
  log = console.log
}) => {
  const release = loadAndValidateDatabaseRelease({ repoRoot: root, releasePath: options.releasePath })
  if (release.errors.length) throw new Error(`database release validation failed:\n- ${release.errors.join('\n- ')}`)
  if (options.dryRun) {
    log(`Database release dry run passed: ${release.manifest.releaseId} (${release.manifestSha256})`)
    log('No Docker, database, backup, secret rotation, API request or traffic switch attempted.')
    return { dryRun: true, releaseId: release.manifest.releaseId, manifestSha256: release.manifestSha256 }
  }
  const execution = resolveDatabaseReleaseExecution(options, env)
  const contract = JSON.parse(readFileSync(resolve(root, release.manifest.databaseContract.path), 'utf8'))
  const adapter = adapterFactory({
    dbContainer: options.dbContainer, dbName: options.dbName, dbUser: options.dbUser
  })
  return withDatabaseOperationLock({
    adapter,
    policy: release.manifest.operationPolicy,
    operation: 'release',
    log,
    task: () => executeDatabaseRelease({
      manifest: release.manifest,
      manifestSha256: databaseReleaseManifestSha256(release.manifest),
      contract,
      options,
      execution,
      adapter,
      log
    })
  })
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    await runDatabaseRelease({ options: parseDatabaseReleaseArgs(process.argv.slice(2)) })
  } catch (error) {
    console.error(`[error] ${error.message}`)
    process.exitCode = 1
  }
}
