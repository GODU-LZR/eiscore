// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAndValidateMigrationManifest } from './check-database-migrations.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..')
const defaultManifestPath = 'database/migrations/runtime-v2.json'
const maxCommandOutput = 64 * 1024 * 1024

const optionNames = new Map([
  ['-m', 'manifestPath'],
  ['--manifest', 'manifestPath'],
  ['-c', 'dbContainer'],
  ['--db-container', 'dbContainer'],
  ['-d', 'dbName'],
  ['--db-name', 'dbName'],
  ['-u', 'dbUser'],
  ['--db-user', 'dbUser'],
  ['--backup-evidence', 'backupEvidence'],
  ['--release-revision', 'releaseRevision'],
  ['--operator', 'operator']
])

export const parseRuntimeMigrationArgs = (argv) => {
  const options = {
    manifestPath: defaultManifestPath,
    dbContainer: 'eiscore-db',
    dbName: 'eiscore',
    dbUser: 'postgres',
    backupEvidence: '',
    releaseRevision: '',
    operator: '',
    dryRun: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }

    const optionName = optionNames.get(argument)
    if (!optionName) throw new Error(`unknown argument: ${argument}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`missing value for ${argument}`)
    options[optionName] = value
    index += 1
  }

  return options
}

export const quoteSqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`

const ledgerInsert = (migration, metadata) => [
  'INSERT INTO eiscore_meta.schema_migrations (',
  '  migration_id, checksum_sha256, source_path, rollback_strategy,',
  '  release_revision, applied_by, backup_evidence, execution_ms',
  ') VALUES (',
  `  ${quoteSqlLiteral(migration.id)},`,
  `  ${quoteSqlLiteral(migration.sha256)},`,
  `  ${quoteSqlLiteral(migration.path)},`,
  `  ${quoteSqlLiteral(migration.rollbackStrategy)},`,
  `  ${quoteSqlLiteral(metadata.releaseRevision)},`,
  `  ${quoteSqlLiteral(metadata.operator)},`,
  `  ${quoteSqlLiteral(metadata.backupEvidence)},`,
  '  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (clock_timestamp() - transaction_timestamp())) * 1000)::bigint)',
  ');'
].join('\n')

export const renderGovernedMigrationSql = ({ migration, sql, metadata }) => {
  const statement = ledgerInsert(migration, metadata)
  const source = String(sql).replace(/\s*$/, '\n')

  if (migration.transaction === 'runner') {
    return `BEGIN;\n${source}${statement}\nCOMMIT;\n`
  }

  if (migration.transaction === 'file') {
    const commits = source.match(/^\s*COMMIT\s*;/gim) || []
    if (commits.length !== 1) {
      throw new Error(`file-managed migration must contain exactly one COMMIT: ${migration.id}`)
    }
    return source.replace(/^\s*COMMIT\s*;/im, `${statement}\nCOMMIT;`)
  }

  throw new Error(`unsupported transaction mode: ${migration.transaction}`)
}

const requireExecutionValue = (name, value, maxLength = 512) => {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${name} is required for database execution`)
  if (normalized.length > maxLength) throw new Error(`${name} exceeds ${maxLength} characters`)
  return normalized
}

const gitRevision = (repoRoot) => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

export const resolveExecutionMetadata = (options, { repoRoot = defaultRepoRoot, env = process.env } = {}) => ({
  backupEvidence: requireExecutionValue(
    'backup evidence (--backup-evidence or EISCORE_BACKUP_EVIDENCE)',
    options.backupEvidence || env.EISCORE_BACKUP_EVIDENCE
  ),
  releaseRevision: requireExecutionValue(
    'release revision (--release-revision or EISCORE_RELEASE_REVISION)',
    options.releaseRevision || env.EISCORE_RELEASE_REVISION || gitRevision(repoRoot),
    128
  ),
  operator: requireExecutionValue(
    'operator (--operator, USERNAME or USER)',
    options.operator || env.USERNAME || env.USER,
    256
  )
})

const runDocker = (args, { input, label, quiet = false } = {}) => {
  const result = spawnSync('docker', args, {
    input,
    encoding: 'utf8',
    maxBuffer: maxCommandOutput,
    windowsHide: true
  })
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim()
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`)
  }
  if (!quiet && result.stdout) process.stdout.write(result.stdout)
  if (!quiet && result.stderr) process.stderr.write(result.stderr)
  return String(result.stdout || '').trim()
}

export class DockerPsqlAdapter {
  constructor({ dbContainer, dbName, dbUser }) {
    this.dbContainer = dbContainer
    this.dbName = dbName
    this.dbUser = dbUser
  }

  psqlArgs(extra = []) {
    return [
      'exec', '-i', this.dbContainer,
      'psql', '-v', 'ON_ERROR_STOP=1', '-U', this.dbUser, '-d', this.dbName,
      ...extra
    ]
  }

  ensureReady() {
    runDocker(['--version'], { label: 'docker command check', quiet: true })
    const names = runDocker(['ps', '--format', '{{.Names}}'], {
      label: 'docker container listing',
      quiet: true
    }).split(/\r?\n/)
    if (!names.includes(this.dbContainer)) throw new Error(`DB container is not running: ${this.dbContainer}`)
    runDocker(['exec', this.dbContainer, 'pg_isready', '-U', this.dbUser, '-d', this.dbName], {
      label: `database readiness check (${this.dbContainer}/${this.dbName})`,
      quiet: true
    })
  }

  executeSql(label, sql) {
    runDocker(this.psqlArgs(), { input: sql, label })
  }

  readChecksum(migrationId) {
    const query = `SELECT checksum_sha256 FROM eiscore_meta.schema_migrations WHERE migration_id = ${quoteSqlLiteral(migrationId)};`
    const output = runDocker(this.psqlArgs(['-Atc', query]), {
      label: `migration ledger lookup (${migrationId})`,
      quiet: true
    })
    const rows = output.split(/\r?\n/).filter(Boolean)
    if (rows.length > 1) throw new Error(`migration ledger returned duplicate rows: ${migrationId}`)
    return rows[0] || ''
  }

  readBaselineCoverage(migrationId) {
    const query = [
      'SELECT checksum_sha256',
      'FROM eiscore_meta.baseline_migration_coverage',
      `WHERE migration_id = ${quoteSqlLiteral(migrationId)}`,
      'ORDER BY baseline_id DESC;'
    ].join(' ')
    const output = runDocker(this.psqlArgs(['-Atc', query]), {
      label: `baseline migration coverage lookup (${migrationId})`,
      quiet: true
    })
    const rows = [...new Set(output.split(/\r?\n/).filter(Boolean))]
    if (rows.length > 1) throw new Error(`installed baselines disagree on migration checksum: ${migrationId}`)
    return rows[0] || ''
  }
}

export const loadRuntimeMigrationPlan = ({
  repoRoot = defaultRepoRoot,
  manifestPath = defaultManifestPath
} = {}) => {
  const result = loadAndValidateMigrationManifest({ repoRoot, manifestPath })
  if (result.errors.length) throw new Error(`migration governance validation failed:\n- ${result.errors.join('\n- ')}`)
  return {
    name: result.manifest.name,
    manifestPath,
    ledgerPath: resolve(repoRoot, result.manifest.ledger),
    postcheckPath: resolve(repoRoot, result.manifest.postcheck),
    migrations: result.migrations.map((migration) => ({
      ...migration,
      absolutePath: resolve(repoRoot, migration.path)
    }))
  }
}

export const executeRuntimeMigrationPlan = ({ plan, adapter, metadata, log = console.log }) => {
  adapter.ensureReady()
  adapter.executeSql('migration ledger initialization', readFileSync(plan.ledgerPath, 'utf8'))

  let applied = 0
  let skipped = 0
  for (const [index, migration] of plan.migrations.entries()) {
    const sequence = String(index + 1).padStart(2, '0')
    const existingChecksum = adapter.readChecksum(migration.id)
    if (existingChecksum === migration.sha256) {
      skipped += 1
      log(`[${sequence}] skip ${migration.id}: checksum already recorded`)
      continue
    }
    if (existingChecksum) {
      throw new Error(`migration checksum conflict: ${migration.id} (ledger ${existingChecksum}, manifest ${migration.sha256})`)
    }

    const baselineChecksum = typeof adapter.readBaselineCoverage === 'function'
      ? adapter.readBaselineCoverage(migration.id)
      : ''
    if (baselineChecksum === migration.sha256) {
      skipped += 1
      log(`[${sequence}] skip ${migration.id}: covered by installed baseline`)
      continue
    }
    if (baselineChecksum) {
      throw new Error(`baseline migration checksum conflict: ${migration.id} (baseline ${baselineChecksum}, manifest ${migration.sha256})`)
    }

    log(`[${sequence}] apply ${migration.id}: ${migration.path} (${migration.transaction})`)
    const sql = renderGovernedMigrationSql({
      migration,
      sql: readFileSync(migration.absolutePath, 'utf8'),
      metadata
    })
    adapter.executeSql(`migration execution (${migration.id})`, sql)
    applied += 1
  }

  const planLabel = plan.name === 'runtime-v2' ? 'Runtime V2' : plan.name
  const summaryLabel = plan.name === 'runtime-v2' ? 'Runtime migration' : `${plan.name} migration`
  adapter.executeSql(`${planLabel} postcheck`, readFileSync(plan.postcheckPath, 'utf8'))
  log(`${summaryLabel} execution passed: ${applied} applied, ${skipped} skipped, postcheck passed.`)
  return { applied, skipped }
}

export const runRuntimeMigrations = ({
  options,
  repoRoot = defaultRepoRoot,
  loadPlan = loadRuntimeMigrationPlan,
  adapterFactory = (adapterOptions) => new DockerPsqlAdapter(adapterOptions),
  env = process.env,
  log = console.log
}) => {
  const plan = loadPlan({ repoRoot, manifestPath: options.manifestPath })
  if (options.dryRun) {
    log(`Using governed manifest: ${options.manifestPath}`)
    for (const [index, migration] of plan.migrations.entries()) {
      log(`[${String(index + 1).padStart(2, '0')}] ${migration.id}\t${migration.transaction}\t${migration.path}`)
    }
    log(`Dry run passed: ${plan.migrations.length} governed migrations; no Docker or database connection attempted.`)
    return { applied: 0, skipped: 0, dryRun: true }
  }

  const metadata = resolveExecutionMetadata(options, { repoRoot, env })
  const adapter = adapterFactory(options)
  log(`Using governed manifest: ${options.manifestPath}`)
  log(`Target database: ${options.dbContainer}/${options.dbName} as ${options.dbUser}`)
  log(`Backup evidence: ${metadata.backupEvidence}`)
  return executeRuntimeMigrationPlan({ plan, adapter, metadata, log })
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const options = parseRuntimeMigrationArgs(process.argv.slice(2))
    runRuntimeMigrations({ options })
  } catch (error) {
    console.error(`[error] ${error.message}`)
    process.exitCode = 1
  }
}
