// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash, randomBytes } from 'node:crypto'
import { dirname, relative, resolve, sep } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sha256CanonicalJson } from './database-contract-catalog.mjs'
import { databaseReleaseManifestSha256, loadAndValidateDatabaseRelease } from './database-release-contract.mjs'
import {
  DatabaseReleaseDockerAdapter,
  resolveDatabaseReleaseExecution,
  verifyReleasedPostgrest
} from './deploy-database-release.mjs'
import { quoteSqlLiteral } from './apply-runtime-migrations.mjs'
import { withDatabaseOperationLock } from './database-operation-lock.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const maxOutput = 512 * 1024 * 1024
const optionNames = new Map([
  ['--evidence', 'evidencePath'],
  ['--release', 'releasePath'],
  ['--db-container', 'dbContainer'],
  ['--db-name', 'dbName'],
  ['--db-user', 'dbUser'],
  ['--api-container', 'apiContainer'],
  ['--api-url', 'apiUrl'],
  ['--operator', 'operator'],
  ['--confirm-empty-target', 'confirmation']
])

export const parseDatabaseRestoreArgs = (argv) => {
  const options = {
    evidencePath: '',
    releasePath: 'database/releases/eiscore-db-v6/manifest.json',
    dbContainer: 'eiscore-db-recovery',
    dbName: 'eiscore',
    dbUser: 'postgres',
    apiContainer: 'eiscore-api-recovery',
    apiUrl: '',
    operator: '',
    confirmation: '',
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

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const required = (label, value) => {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label} is required for database recovery`)
  return normalized
}

const containedBackupPath = (evidencePath, artifactPath) => {
  const evidenceDirectory = dirname(evidencePath)
  const absolute = resolve(required('backup artifact path', artifactPath))
  const inside = relative(evidenceDirectory, absolute)
  if (!inside || inside === '..' || inside.startsWith(`..${sep}`)) {
    throw new Error('backup artifacts must be siblings of the evidence file')
  }
  return absolute
}

export const loadAndValidateDatabaseBackupEvidence = ({ evidencePath, release }) => {
  const absoluteEvidencePath = resolve(required('--evidence', evidencePath))
  if (!existsSync(absoluteEvidencePath)) throw new Error('backup evidence file does not exist')
  const evidenceBytes = readFileSync(absoluteEvidencePath)
  const evidence = JSON.parse(evidenceBytes.toString('utf8'))
  const errors = []
  if (evidence.schemaVersion !== 1) errors.push('backup evidence schemaVersion must be 1')
  if (evidence.releaseId !== release.manifest.releaseId) errors.push('backup release id mismatch')
  if (evidence.releaseManifestSha256 !== release.manifestSha256) errors.push('backup release manifest checksum mismatch')
  if (evidence.sourceRevision !== release.manifest.sourceRevision) errors.push('backup source revision mismatch')
  if (evidence.verifiedBy !== 'pg_restore --list') errors.push('backup has no pg_restore verification evidence')
  if (evidence.globals?.passwordsIncluded !== false) errors.push('role backup must exclude passwords')
  for (const [label, descriptor] of [['database dump', evidence.databaseDump], ['globals', evidence.globals]]) {
    try {
      if (!/^[0-9a-f]{64}$/.test(descriptor?.sha256 || '')) throw new Error(`${label} checksum is invalid`)
      const path = containedBackupPath(absoluteEvidencePath, descriptor.path)
      if (!existsSync(path)) throw new Error(`${label} file does not exist`)
      if (sha256(readFileSync(path)) !== descriptor.sha256) throw new Error(`${label} checksum drift`)
      descriptor.path = path
    } catch (error) {
      errors.push(error.message)
    }
  }
  return {
    errors,
    evidence,
    evidencePath: absoluteEvidencePath,
    evidenceSha256: sha256(evidenceBytes)
  }
}

const docker = (args, { input, encoding = 'utf8', allowFailure = false, timeout = 300_000 } = {}) => {
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
    const detail = encoding ? String(result.stderr || result.stdout || '').trim() : 'binary restore command failed'
    throw new Error(`docker ${args.slice(0, 4).join(' ')} failed${detail ? `: ${detail}` : ''}`)
  }
  return result
}

export class DatabaseRecoveryDockerAdapter extends DatabaseReleaseDockerAdapter {
  assertEmptyTarget() {
    const objectCount = Number(this.query(`
      SELECT count(*)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S');
    `))
    if (objectCount !== 0) throw new Error(`recovery target is not empty (${objectCount} objects)`)
  }

  verifyArchive(databaseDump) {
    const result = docker([
      'exec', '-i', this.dbContainer, 'pg_restore', '--list'
    ], { input: databaseDump })
    if (!String(result.stdout).includes('TABLE')) throw new Error('database recovery archive catalog is incomplete')
  }

  bootstrapRoles(globalsSql) {
    if (/PASSWORD\s+'[^']+'/i.test(globalsSql)) throw new Error('role backup unexpectedly contains passwords')
    for (const role of [
      'eiscore_owner', 'eiscore_migrator', 'eiscore_authenticator',
      'eiscore_agent', 'web_anon', 'web_user'
    ]) {
      if (!globalsSql.includes(`CREATE ROLE ${role}`)) throw new Error(`role backup is missing ${role}`)
    }
    // A pg_dumpall globals file also contains the target cluster's built-in
    // postgres role. Replaying it into another cluster would conflict, so the
    // governed v2 bootstrap recreates only application roles and memberships.
    this.executeSql('governed application role bootstrap', readFileSync(resolve(repoRoot, 'database/bootstrap/roles-v2.sql'), 'utf8'))
  }

  restoreDatabase(databaseDump) {
    docker([
      'exec', '-i', this.dbContainer, 'pg_restore', '--exit-on-error',
      '-U', this.dbUser, '-d', this.dbName
    ], { input: databaseDump, encoding: null, timeout: 600_000 })
  }

  normalizeRestoredCatalog() {
    this.executeSql(
      'database v2 post-restore normalization',
      readFileSync(resolve(repoRoot, 'database/recovery/post-restore-v2.sql'), 'utf8')
    )
  }

  initializeRecoveryLedger() {
    this.executeSql('database recovery ledger initialization', readFileSync(resolve(repoRoot, 'database/recovery-ledger.sql'), 'utf8'))
  }

  recordRecovery({ release, backup, operator, recoveryMs }) {
    const recoveryId = `${release.manifest.releaseId}-${Date.now()}-${randomBytes(4).toString('hex')}`
    this.executeSql('database recovery success record', `
      INSERT INTO eiscore_meta.database_recoveries (
        recovery_id, release_id, release_manifest_sha256, backup_evidence_sha256,
        database_dump_sha256, recovered_by, recovery_ms
      ) VALUES (
        ${quoteSqlLiteral(recoveryId)},
        ${quoteSqlLiteral(release.manifest.releaseId)},
        ${quoteSqlLiteral(release.manifestSha256)},
        ${quoteSqlLiteral(backup.evidenceSha256)},
        ${quoteSqlLiteral(backup.evidence.databaseDump.sha256)},
        ${quoteSqlLiteral(operator)},
        ${Math.max(0, Math.floor(recoveryMs))}
      );
    `)
    return recoveryId
  }
}

export const executeDatabaseRecovery = async ({
  release,
  backup,
  contract,
  options,
  execution,
  adapter,
  log = console.log
}) => {
  const postgrestPolicy = release.manifest.operationPolicy.postgrest
  if (options.confirmation !== release.manifest.releaseId) {
    throw new Error(`--confirm-empty-target must equal ${release.manifest.releaseId}`)
  }
  adapter.assertOperationBudget?.('empty target preflight')
  adapter.preflight(release.manifest)
  adapter.assertEmptyTarget()
  const databaseDump = readFileSync(backup.evidence.databaseDump.path)
  const globalsSql = readFileSync(backup.evidence.globals.path, 'utf8')
  adapter.verifyArchive(databaseDump)
  adapter.assertOperationBudget?.('database restore')
  const started = process.hrtime.bigint()
  adapter.bootstrapRoles(globalsSql)
  adapter.restoreDatabase(databaseDump)
  adapter.normalizeRestoredCatalog()
  adapter.configureRuntimeSecrets(execution.secrets)
  adapter.assertOperationBudget?.('recovered database contract verification')
  const catalogSha256 = sha256CanonicalJson(adapter.readCatalog())
  if (catalogSha256 !== contract.databaseCatalog.sha256) {
    throw new Error(`recovered database catalog drift: ${catalogSha256}`)
  }
  await adapter.ensureApi(release.manifest, options.apiContainer, execution.apiUrl, postgrestPolicy)
  await verifyReleasedPostgrest({
    adapter,
    apiContainer: options.apiContainer,
    apiUrl: execution.apiUrl,
    contract,
    jwtSecret: execution.secrets.jwtSecret,
    policy: postgrestPolicy
  })
  adapter.assertOperationBudget?.('recovery record')
  adapter.initializeRecoveryLedger()
  const recoveryMs = Number(process.hrtime.bigint() - started) / 1_000_000
  const recoveryId = adapter.recordRecovery({
    release, backup, operator: execution.operator, recoveryMs
  })
  log(`Database recovery passed: ${recoveryId} (${Math.round(recoveryMs)} ms)`)
  return { recoveryId, recoveryMs, catalogSha256 }
}

export const runDatabaseRecovery = async ({
  options,
  root = repoRoot,
  env = process.env,
  adapterFactory = (adapterOptions) => new DatabaseRecoveryDockerAdapter(adapterOptions),
  log = console.log
}) => {
  const release = loadAndValidateDatabaseRelease({ repoRoot: root, releasePath: options.releasePath })
  if (release.errors.length) throw new Error(`database release validation failed:\n- ${release.errors.join('\n- ')}`)
  const backup = loadAndValidateDatabaseBackupEvidence({ evidencePath: options.evidencePath, release })
  if (backup.errors.length) throw new Error(`database backup validation failed:\n- ${backup.errors.join('\n- ')}`)
  if (options.dryRun) {
    log(`Database recovery dry run passed: ${backup.evidencePath}`)
    log('No Docker, database restore, secret injection, API request or traffic switch attempted.')
    return { dryRun: true, evidenceSha256: backup.evidenceSha256 }
  }
  const execution = resolveDatabaseReleaseExecution({
    ...options,
    backupDir: dirname(backup.evidencePath),
    environment: backup.evidence.environment,
    backupStorageEvidence: backup.evidence.storageEncryptionEvidence
  }, env)
  const contract = JSON.parse(readFileSync(resolve(root, release.manifest.databaseContract.path), 'utf8'))
  const adapter = adapterFactory({
    dbContainer: options.dbContainer, dbName: options.dbName, dbUser: options.dbUser
  })
  return withDatabaseOperationLock({
    adapter,
    policy: release.manifest.operationPolicy,
    operation: 'recovery',
    log,
    task: () => executeDatabaseRecovery({ release, backup, contract, options, execution, adapter, log })
  })
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    await runDatabaseRecovery({ options: parseDatabaseRestoreArgs(process.argv.slice(2)) })
  } catch (error) {
    console.error(`[error] ${error.message}`)
    process.exitCode = 1
  }
}
