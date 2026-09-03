// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDatabaseObjectCatalog, serializeDatabaseObjectCatalog } from './build-database-object-catalog.mjs'
import { computeBaselineFingerprint, sha256File } from './database-baseline-contract.mjs'
import { scanTextLine } from './scan-secrets.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const defaultManifestPath = 'database/baselines/eiscore-db-v1/manifest.json'
const shaPattern = /^[0-9a-f]{64}$/

const normalizeRepoPath = (value) => String(value || '').replaceAll('\\', '/').replace(/^\.\//, '')
const resolveInsideRepo = (root, repoPath) => {
  const absolute = resolve(root, normalizeRepoPath(repoPath))
  const relation = relative(root, absolute)
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new Error(`path must be a file inside the repository: ${repoPath}`)
  }
  return absolute
}

const checkFile = ({ root, descriptor, label, errors }) => {
  const path = normalizeRepoPath(descriptor?.path)
  const expectedSha = String(descriptor?.sha256 || '')
  if (!shaPattern.test(expectedSha)) errors.push(`${label} checksum is invalid`)
  try {
    const absolute = resolveInsideRepo(root, path)
    if (!existsSync(absolute)) {
      errors.push(`${label} does not exist: ${path}`)
      return null
    }
    const bytes = readFileSync(absolute)
    const portableSha = String(descriptor?.portableSha256 || '')
    const portableBytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
    if (!shaPattern.test(portableSha)) errors.push(`${label} portable checksum is invalid`)
    if (createHash('sha256').update(portableBytes).digest('hex') !== portableSha) {
      errors.push(`${label} portable checksum drift: ${path}`)
    }
    return { absolute, path, buffer: bytes }
  } catch (error) {
    errors.push(error.message)
    return null
  }
}

export const validateDatabaseBaseline = ({
  root = repoRoot,
  manifestPath = defaultManifestPath
} = {}) => {
  const errors = []
  const absoluteManifest = resolveInsideRepo(root, manifestPath)
  const manifest = JSON.parse(readFileSync(absoluteManifest, 'utf8'))
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must equal 1')
  if (!/^eiscore-db-v[1-9][0-9]*$/.test(manifest.baselineId || '')) errors.push('baselineId is invalid')
  if (manifest.postgres?.major !== 16 || !String(manifest.postgres?.image || '').includes('@sha256:')) {
    errors.push('PostgreSQL baseline image must pin major 16 by digest')
  }
  if (!/^[A-Za-z0-9]{32,64}$/.test(manifest.postgres?.restrictKey || '')) errors.push('pg_dump restrict key is invalid')
  if (!shaPattern.test(manifest.sourceEvidence?.sha256 || '') || manifest.sourceEvidence?.releaseInput !== false) {
    errors.push('source dump must be checksum evidence and excluded from release inputs')
  }

  const schemaFile = checkFile({ root, descriptor: manifest.schema, label: 'schema', errors })
  const catalogFile = checkFile({ root, descriptor: manifest.objectCatalog, label: 'object catalog', errors })
  const registrationFile = checkFile({ root, descriptor: manifest.registration, label: 'registration', errors })
  checkFile({ root, descriptor: manifest.roleBootstrap, label: 'role bootstrap', errors })
  checkFile({ root, descriptor: manifest.runtimeSecretBootstrap, label: 'runtime secret bootstrap', errors })
  for (const adoption of manifest.legacySchemaAdoptions || []) {
    checkFile({ root, descriptor: adoption, label: `legacy schema adoption ${adoption?.id || '<missing>'}`, errors })
    if (adoption?.releaseInput !== false) errors.push(`legacy schema adoption must not be a release input: ${adoption?.id}`)
  }

  if (schemaFile) {
    const portableSchemaBytes = Buffer.from(schemaFile.buffer.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
    if (portableSchemaBytes.length !== manifest.schema.portableBytes) errors.push('schema portable byte count drift')
    const schemaText = schemaFile.buffer.toString('utf8')
    for (const [pattern, label] of [
      [/^-- Data for Name:/m, 'table data marker'],
      [/^COPY\s/m, 'COPY data'],
      [/OWNER TO/i, 'object owner'],
      [/君乐缘|经纬|伦度|junleyuan|jinwei|lundun|nanpai|eissys/i, 'customer binding']
    ]) if (pattern.test(schemaText)) errors.push(`schema contains ${label}`)
    if (!schemaText.includes(`\\restrict ${manifest.postgres.restrictKey}`)
        || !schemaText.includes(`\\unrestrict ${manifest.postgres.restrictKey}`)) {
      errors.push('schema does not use the deterministic pg_dump restrict key')
    }
    for (const marker of [
      'CREATE TABLE eiscore_meta.schema_migrations',
      'CREATE TABLE eiscore_meta.database_baselines',
      'CREATE TABLE eiscore_meta.baseline_migration_coverage',
      "current_setting('app.jwt_secret', true)",
      'gen_random_bytes(32)'
    ]) if (!schemaText.includes(marker)) errors.push(`schema lost required marker: ${marker}`)
    const secretFindings = schemaText.split(/\r?\n/).flatMap((line, index) => scanTextLine({
      path: schemaFile.path,
      line,
      lineNumber: index + 1
    }))
    if (secretFindings.length) errors.push(`schema contains ${secretFindings.length} secret finding(s)`)
    const privilegeStatements = (schemaText.match(/^(?:GRANT|REVOKE)\s/gim) || []).length
    if (manifest.contentGuarantees?.privilegeStatements !== privilegeStatements || privilegeStatements === 0) {
      errors.push('schema privilege statement count drift')
    }

    try {
      const expectedCatalogText = serializeDatabaseObjectCatalog(buildDatabaseObjectCatalog(schemaFile.buffer))
      const normalizedCatalog = catalogFile && Buffer.from(catalogFile.buffer.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
      if (!normalizedCatalog || !normalizedCatalog.equals(Buffer.from(expectedCatalogText, 'utf8'))) {
        errors.push('object catalog does not exactly match schema.sql')
      }
    } catch (error) {
      errors.push(`object catalog rebuild failed: ${error.message}`)
    }
  }

  if (catalogFile) {
    const catalog = JSON.parse(catalogFile.buffer.toString('utf8'))
    if (catalog.objectCount !== manifest.objectCatalog.objectCount || catalog.objectCount !== catalog.objects?.length) {
      errors.push('object catalog count drift')
    }
    if (catalog.schemaSha256 !== manifest.schema.sha256) errors.push('object catalog schema checksum drift')
  }

  const coveredMigrations = Array.isArray(manifest.coveredMigrations) ? manifest.coveredMigrations : []
  const coveredIds = new Set()
  for (const entry of coveredMigrations) {
    if (coveredIds.has(entry.id)) errors.push(`duplicate covered migration: ${entry.id}`)
    coveredIds.add(entry.id)
    if (!shaPattern.test(entry.sha256 || '')) errors.push(`invalid covered migration checksum: ${entry.id}`)
  }
  const sourceManifests = [...new Set(coveredMigrations.map(({ sourceManifest }) => sourceManifest))]
  const sourceMigrations = new Map()
  for (const sourceManifest of sourceManifests) {
    try {
      const data = JSON.parse(readFileSync(resolveInsideRepo(root, sourceManifest), 'utf8'))
      sourceMigrations.set(sourceManifest, new Map(data.migrations.map((entry) => [entry.id, entry.sha256])))
    } catch (error) {
      errors.push(`covered migration manifest cannot be read (${sourceManifest}): ${error.message}`)
    }
  }
  for (const entry of coveredMigrations) {
    const sourceChecksum = sourceMigrations.get(entry.sourceManifest)?.get(entry.id)
    if (sourceChecksum !== entry.sha256) {
      errors.push(`baseline-covered migration differs from source manifest: ${entry.id}`)
    }
  }

  const expectedFingerprint = computeBaselineFingerprint(manifest)
  if (manifest.fingerprintSha256 !== expectedFingerprint) errors.push('baseline fingerprint drift')
  if (manifest.upgradeProfiles?.[0]?.equivalenceTargetSha256 !== manifest.schema.sha256) {
    errors.push('upgrade equivalence target differs from schema checksum')
  }
  if (JSON.stringify(manifest.installOrder) !== JSON.stringify([
    manifest.roleBootstrap?.path,
    manifest.schema?.path,
    manifest.registration?.path,
    manifest.runtimeSecretBootstrap?.path
  ])) errors.push('baseline install order must be role bootstrap, schema, registration, runtime secret bootstrap')
  for (const excluded of ['db_schema_and_data.sql', 'tests/.artifacts/eiscore-g35-baseline.dump', 'sql/company_site_platform_v1.sql']) {
    if (!manifest.excludedReleaseInputs?.includes(excluded)) errors.push(`excluded release input is missing: ${excluded}`)
  }

  if (registrationFile) {
    const registration = registrationFile.buffer.toString('utf8')
    for (const value of [
      manifest.baselineId,
      manifest.fingerprintSha256,
      manifest.schema.sha256,
      manifest.objectCatalog.sha256,
      ...coveredMigrations.flatMap(({ id, sha256: checksum, sourceManifest }) => [id, checksum, sourceManifest])
    ]) if (!registration.includes(value)) errors.push(`registration lost declared value: ${value}`)
    if (/INSERT\s+INTO\s+eiscore_meta\.schema_migrations/i.test(registration)) {
      errors.push('registration must not claim baseline-covered migrations were executed')
    }
    const insertTargets = [...registration.matchAll(/INSERT\s+INTO\s+([^\s(]+)/gi)].map((match) => match[1])
    if (JSON.stringify(insertTargets) !== JSON.stringify([
      'eiscore_meta.database_baselines',
      'eiscore_meta.baseline_migration_coverage'
    ])) errors.push('registration writes outside the baseline metadata tables')
    if (manifest.registration.rows !== coveredMigrations.length + 1) errors.push('registration row count declaration drift')
  }

  return { errors, manifest }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const manifestArg = process.argv.find((argument) => argument.startsWith('--manifest='))
  try {
    const result = validateDatabaseBaseline({
      manifestPath: manifestArg?.slice('--manifest='.length) || defaultManifestPath
    })
    if (result.errors.length) {
      for (const error of result.errors) console.error(`[error] ${error}`)
      process.exitCode = 1
    } else {
      console.log(`PASS: ${result.manifest.baselineId} contract (${result.manifest.objectCatalog.objectCount} objects, ${result.manifest.coveredMigrations.length} covered migrations)`)
    }
  } catch (error) {
    console.error(`[error] ${error.message}`)
    process.exitCode = 1
  }
}
