// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { canonicalJson } from './database-contract-catalog.mjs'
import { loadAndValidateMigrationManifest } from './check-database-migrations.mjs'
import { validateDatabaseBaseline } from './check-database-baseline.mjs'

export const defaultDatabaseReleasePath = 'database/releases/eiscore-db-v6/manifest.json'
export const defaultDatabaseContractPath = 'database/contracts/eiscore-db-contract-v3.json'
export const defaultMigrationManifestPaths = [
  'database/migrations/runtime-v2.json',
  'database/migrations/company-site.json',
  'database/migrations/core.json'
]

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export const portableTextSha256 = (value) => sha256(Buffer.from(
  Buffer.from(value).toString('utf8').replaceAll('\r\n', '\n').replaceAll('\r', '\n'),
  'utf8'
))
export const databaseReleaseManifestSha256 = (manifest) => sha256(Buffer.from(canonicalJson(manifest), 'utf8'))

const safeRepoPath = (repoRoot, path) => {
  const normalized = String(path || '').replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`release artifact path must stay inside the repository: ${path}`)
  }
  const absolute = resolve(repoRoot, normalized)
  const within = relative(repoRoot, absolute)
  if (!within || within === '..' || within.startsWith(`..${sep}`)) {
    throw new Error(`release artifact path must stay inside the repository: ${path}`)
  }
  return { normalized, absolute }
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const gitBlob = (repoRoot, revision, path) => {
  const result = spawnSync('git', ['show', `${revision}:${path}`], {
    cwd: repoRoot,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`source revision does not contain release artifact: ${path}`)
  return result.stdout
}

const addArtifact = (artifacts, repoRoot, path, purpose) => {
  const { normalized, absolute } = safeRepoPath(repoRoot, path)
  const existing = artifacts.get(normalized)
  if (existing && existing.purpose !== purpose) existing.purpose = 'execution-and-verification'
  if (!existing) artifacts.set(normalized, {
    path: normalized,
    purpose,
    portableSha256: portableTextSha256(readFileSync(absolute))
  })
}

export const buildDatabaseReleaseManifest = ({
  repoRoot,
  releaseId,
  sourceRevision,
  predecessorCatalogs,
  migrationManifestPaths = defaultMigrationManifestPaths,
  contractPath = defaultDatabaseContractPath
}) => {
  if (!repoRoot) throw new Error('repoRoot is required')
  const baselinePath = 'database/baselines/eiscore-db-v1/manifest.json'
  const baseline = readJson(resolve(repoRoot, baselinePath))
  const contract = readJson(resolve(repoRoot, contractPath))
  const operationsPolicy = readJson(resolve(repoRoot, 'database/operations/policy.json'))
  const artifacts = new Map()

  for (const path of [
    'database/bootstrap/roles-v2.sql',
    'scripts/configure-database-runtime-secrets-v2.sh',
    'database/migration-ledger.sql',
    'database/release-ledger.sql',
    baselinePath,
    baseline.schema.path,
    baseline.objectCatalog.path,
    baseline.registration.path,
    contractPath,
    'scripts/database-contract-catalog.mjs',
    'scripts/database-release-contract.mjs',
    'scripts/database-baseline-contract.mjs',
    'scripts/check-database-baseline.mjs',
    'scripts/check-database-migrations.mjs',
    'scripts/apply-runtime-migrations.mjs',
    'scripts/deploy-database-release.mjs',
    'scripts/database-operation-lock.mjs',
    'scripts/restore-database-release-backup.mjs',
    'scripts/check-database-backups.mjs',
    'scripts/audit-database-runtime.mjs',
    'database/recovery-ledger.sql',
    'database/recovery/post-restore-v2.sql',
    'database/operations/policy.json',
    'database/legacy-sql-resolution.json',
    'database/public-schema-ratchet.json',
    'scripts/public-schema-ratchet.mjs'
  ]) addArtifact(artifacts, repoRoot, path, 'execution')

  for (const descriptor of [
    baseline.roleBootstrap,
    baseline.runtimeSecretBootstrap,
    ...(baseline.legacySchemaAdoptions || [])
  ]) addArtifact(artifacts, repoRoot, descriptor.path, 'verification-only')

  const migrationManifests = migrationManifestPaths.map((path) => {
    const result = loadAndValidateMigrationManifest({ repoRoot, manifestPath: path })
    if (result.errors.length) throw new Error(`${path}: ${result.errors.join('; ')}`)
    addArtifact(artifacts, repoRoot, path, 'execution')
    addArtifact(artifacts, repoRoot, result.manifest.ledger, 'execution')
    addArtifact(artifacts, repoRoot, result.manifest.postcheck, 'execution')
    for (const migration of result.migrations) {
      addArtifact(artifacts, repoRoot, migration.path, 'execution')
      if (migration.rollbackPath) addArtifact(artifacts, repoRoot, migration.rollbackPath, 'execution')
    }
    const terminal = result.migrations.at(-1)
    return {
      path,
      name: result.manifest.name,
      portableSha256: portableTextSha256(readFileSync(resolve(repoRoot, path))),
      terminal: { id: terminal.id, sha256: terminal.sha256 },
      postcheck: {
        path: result.manifest.postcheck,
        portableSha256: portableTextSha256(readFileSync(resolve(repoRoot, result.manifest.postcheck)))
      },
      migrations: result.migrations.map(({ id, sha256: migrationSha256 }) => ({ id, sha256: migrationSha256 }))
    }
  })

  return {
    schemaVersion: 2,
    releaseId,
    sourceRevision,
    images: { postgres: contract.postgresImage, postgrest: contract.postgrestImage },
    baseline: {
      path: baselinePath,
      id: baseline.baselineId,
      fingerprintSha256: baseline.fingerprintSha256,
      schemaSha256: baseline.schema.sha256,
      objectCatalogSha256: baseline.objectCatalog.sha256
    },
    migrationManifests,
    databaseContract: {
      path: contractPath,
      id: contract.contractId,
      databaseCatalogSha256: contract.databaseCatalog.sha256,
      postgrestOpenApiSha256: contract.postgrestOpenApi.sha256
    },
    predecessors: predecessorCatalogs,
    operationPolicy: operationsPolicy.operationControl,
    releasePolicy: {
      backupRequired: true,
      backupStorageEvidenceRequired: true,
      rollbackStrategy: 'backup-restore',
      schemaDrift: 'fail',
      ledgerConflict: 'fail',
      postcheckFailure: 'fail',
      trafficSwitch: 'external-after-release-record'
    },
    artifacts: [...artifacts.values()].sort((left, right) => left.path.localeCompare(right.path, 'en'))
  }
}

export const validateDatabaseReleaseManifest = ({
  repoRoot,
  manifest,
  verifySourceRevision = true
}) => {
  const errors = []
  const fail = (message) => errors.push(message)
  if (![1, 2].includes(manifest?.schemaVersion)) fail('release schemaVersion must be 1 or 2')
  if (!/^eiscore-db-v[1-9][0-9]*$/.test(manifest?.releaseId || '')) fail('releaseId is invalid')
  if (!/^[0-9a-f]{40}$/.test(manifest?.sourceRevision || '')) fail('sourceRevision must be a full Git commit SHA')
  if (!String(manifest?.images?.postgres || '').includes('@sha256:')) fail('PostgreSQL image must be digest-pinned')
  if (!String(manifest?.images?.postgrest || '').includes('@sha256:')) fail('PostgREST image must be digest-pinned')
  for (const [key, value] of Object.entries(manifest?.releasePolicy || {})) {
    if (key === 'backupRequired' && value !== true) fail('release backup must be required')
  }
  if (manifest?.releasePolicy?.backupStorageEvidenceRequired !== true) fail('backup storage evidence must be required')
  if (manifest?.releasePolicy?.rollbackStrategy !== 'backup-restore') fail('release rollback strategy must be backup-restore')
  if (manifest?.releasePolicy?.schemaDrift !== 'fail') fail('schema drift policy must fail closed')
  if (manifest?.releasePolicy?.ledgerConflict !== 'fail') fail('ledger conflict policy must fail closed')
  if (manifest?.releasePolicy?.postcheckFailure !== 'fail') fail('postcheck policy must fail closed')
  if (!Array.isArray(manifest?.predecessors) || manifest.predecessors.length === 0) fail('at least one predecessor catalog is required')
  for (const predecessor of manifest?.predecessors || []) {
    if (!predecessor?.id || !/^[0-9a-f]{64}$/.test(predecessor?.databaseCatalogSha256 || '')) {
      fail('predecessor catalog entry is invalid')
    }
  }

  if (manifest?.schemaVersion === 2) {
    const operation = manifest.operationPolicy || {}
    try {
      const key = BigInt(operation.advisoryLockKey)
      if (key < -(2n ** 63n) || key > (2n ** 63n) - 1n) throw new Error()
    } catch {
      fail('operation advisory lock key must be a signed 64-bit integer')
    }
    for (const [field, minimum, maximum] of [
      ['lockWaitTimeoutMs', 100, 300_000],
      ['holderExitTimeoutMs', 100, 30_000],
      ['releaseTimeoutMs', 60_000, 7_200_000],
      ['recoveryTimeoutMs', 60_000, 14_400_000]
    ]) {
      const value = operation[field]
      if (!Number.isInteger(value) || value < minimum || value > maximum) {
        fail(`operation ${field} is invalid`)
      }
    }
    const postgrest = operation.postgrest || {}
    for (const [field, minimum, maximum] of [
      ['httpRequestTimeoutMs', 100, 30_000],
      ['readinessTimeoutMs', 1_000, 300_000],
      ['reloadTimeoutMs', 1_000, 300_000],
      ['pollIntervalMs', 50, 5_000],
      ['stableFingerprintSamples', 2, 10]
    ]) {
      const value = postgrest[field]
      if (!Number.isInteger(value) || value < minimum || value > maximum) {
        fail(`PostgREST ${field} is invalid`)
      }
    }
    try {
      const governedPolicy = readJson(resolve(repoRoot, 'database/operations/policy.json')).operationControl
      if (canonicalJson(operation) !== canonicalJson(governedPolicy)) {
        fail('release operation policy drift')
      }
    } catch (error) {
      fail(`release operation policy validation failed: ${error.message}`)
    }
  }

  const artifacts = new Map()
  for (const artifact of manifest?.artifacts || []) {
    try {
      const { normalized, absolute } = safeRepoPath(repoRoot, artifact.path)
      if (artifacts.has(normalized)) fail(`duplicate release artifact: ${normalized}`)
      artifacts.set(normalized, artifact)
      if (!['execution', 'verification-only', 'execution-and-verification'].includes(artifact.purpose)) {
        fail(`invalid artifact purpose: ${normalized}`)
      }
      if (!/^[0-9a-f]{64}$/.test(artifact.portableSha256 || '')) fail(`invalid artifact checksum: ${normalized}`)
      else if (portableTextSha256(readFileSync(absolute)) !== artifact.portableSha256) fail(`release artifact drift: ${normalized}`)
      if (verifySourceRevision && /^[0-9a-f]{40}$/.test(manifest?.sourceRevision || '')) {
        if (portableTextSha256(gitBlob(repoRoot, manifest.sourceRevision, normalized)) !== artifact.portableSha256) {
          fail(`source revision artifact drift: ${normalized}`)
        }
      }
    } catch (error) {
      fail(error.message)
    }
  }
  if (artifacts.size === 0) fail('release artifacts are missing')

  try {
    const baselineResult = validateDatabaseBaseline({ root: repoRoot })
    if (baselineResult.errors.length) fail(`baseline validation failed: ${baselineResult.errors.join('; ')}`)
    const expected = manifest.baseline || {}
    if (baselineResult.manifest.baselineId !== expected.id) fail('release baseline id drift')
    if (baselineResult.manifest.fingerprintSha256 !== expected.fingerprintSha256) fail('release baseline fingerprint drift')
    if (baselineResult.manifest.schema.sha256 !== expected.schemaSha256) fail('release baseline schema checksum drift')
    if (baselineResult.manifest.objectCatalog.sha256 !== expected.objectCatalogSha256) fail('release baseline object catalog checksum drift')
  } catch (error) {
    fail(`baseline validation failed: ${error.message}`)
  }

  for (const descriptor of manifest?.migrationManifests || []) {
    try {
      const result = loadAndValidateMigrationManifest({ repoRoot, manifestPath: descriptor.path })
      if (result.errors.length) {
        fail(`${descriptor.path}: ${result.errors.join('; ')}`)
        continue
      }
      if (descriptor.name !== result.manifest.name) fail(`${descriptor.path}: release name drift`)
      if (portableTextSha256(readFileSync(resolve(repoRoot, descriptor.path))) !== descriptor.portableSha256) {
        fail(`${descriptor.path}: release manifest checksum drift`)
      }
      const terminal = result.migrations.at(-1)
      if (descriptor.terminal?.id !== terminal.id || descriptor.terminal?.sha256 !== terminal.sha256) {
        fail(`${descriptor.path}: terminal migration drift`)
      }
      const actualMigrations = result.migrations.map(({ id, sha256: migrationSha256 }) => ({ id, sha256: migrationSha256 }))
      if (canonicalJson(descriptor.migrations) !== canonicalJson(actualMigrations)) fail(`${descriptor.path}: migration list drift`)
    } catch (error) {
      fail(`${descriptor.path}: ${error.message}`)
    }
  }

  try {
    const contract = readJson(resolve(repoRoot, manifest?.databaseContract?.path || ''))
    if (contract.contractId !== manifest.databaseContract.id) fail('database contract id drift')
    if (contract.databaseCatalog.sha256 !== manifest.databaseContract.databaseCatalogSha256) fail('database catalog checksum drift')
    if (contract.postgrestOpenApi.sha256 !== manifest.databaseContract.postgrestOpenApiSha256) fail('PostgREST contract checksum drift')
    if (contract.postgresImage !== manifest.images.postgres) fail('PostgreSQL release image drift')
    if (contract.postgrestImage !== manifest.images.postgrest) fail('PostgREST release image drift')
  } catch (error) {
    fail(`database contract validation failed: ${error.message}`)
  }

  return { errors, manifestSha256: databaseReleaseManifestSha256(manifest) }
}

export const loadAndValidateDatabaseRelease = ({
  repoRoot,
  releasePath = defaultDatabaseReleasePath,
  verifySourceRevision = true
}) => {
  const { absolute, normalized } = safeRepoPath(repoRoot, releasePath)
  const manifest = readJson(absolute)
  const result = validateDatabaseReleaseManifest({ repoRoot, manifest, verifySourceRevision })
  return { ...result, manifest, releasePath: normalized }
}
