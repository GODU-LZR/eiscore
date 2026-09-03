// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..')
const defaultManifestPath = 'database/migrations/runtime-v2.json'
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const shaPattern = /^[0-9a-f]{64}$/

const normalizeRepoPath = (value) => String(value || '').replaceAll('\\', '/').replace(/^\.\//, '')
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const canonicalSqlBytes = (source, lineEnding) => {
  const lf = String(source).replace(/\r\n/g, '\n')
  return Buffer.from(lineEnding === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf, 'utf8')
}

const resolveInsideRepo = (repoRoot, repoPath) => {
  const absolute = resolve(repoRoot, repoPath)
  const relation = relative(repoRoot, absolute)
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new Error(`path must be a file inside the repository: ${repoPath}`)
  }
  return absolute
}

const readLegacyManifest = (absolutePath) => readFileSync(absolutePath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*$/, '').trim())
  .filter(Boolean)
  .map(normalizeRepoPath)

const countDirectSqlFiles = (absoluteDirectory) => readdirSync(absoluteDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
  .length

export const validateMigrationManifestData = (manifest, { repoRoot = defaultRepoRoot } = {}) => {
  const errors = []
  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion must equal 1')
  const manifestName = String(manifest?.name || '')
  if (!namePattern.test(manifestName)) errors.push('name must be a lowercase kebab-case identifier')
  const checksumLineEnding = manifest?.checksumLineEnding
  if (!['lf', 'crlf'].includes(checksumLineEnding)) errors.push('checksumLineEnding must equal lf or crlf')

  for (const field of ['ledger', 'postcheck']) {
    const repoPath = normalizeRepoPath(manifest?.[field])
    try {
      const absolute = resolveInsideRepo(repoRoot, repoPath)
      if (!existsSync(absolute)) errors.push(`${field} does not exist: ${repoPath}`)
    } catch (error) {
      errors.push(error.message)
    }
  }

  const hasLegacyManifest = typeof manifest?.legacyManifest === 'string' && manifest.legacyManifest.trim() !== ''
  if (hasLegacyManifest) {
    const repoPath = normalizeRepoPath(manifest.legacyManifest)
    try {
      const absolute = resolveInsideRepo(repoRoot, repoPath)
      if (!existsSync(absolute)) errors.push(`legacyManifest does not exist: ${repoPath}`)
    } catch (error) {
      errors.push(error.message)
    }
  }

  const inventory = Array.isArray(manifest?.legacyInventory) ? manifest.legacyInventory : []
  if (hasLegacyManifest && inventory.length !== 5) {
    errors.push('legacyInventory must contain the five accepted SQL roots')
  }
  if (!hasLegacyManifest && inventory.length) {
    errors.push('legacyInventory requires legacyManifest')
  }
  let legacySqlCount = 0
  for (const entry of inventory) {
    const repoPath = normalizeRepoPath(entry?.path)
    try {
      const absolute = repoPath === '.' ? repoRoot : resolveInsideRepo(repoRoot, repoPath)
      const actual = countDirectSqlFiles(absolute)
      legacySqlCount += actual
      if (entry.recursive !== false) errors.push(`legacy SQL root must be non-recursive: ${repoPath}`)
      if (actual !== entry.expectedSqlFiles) {
        errors.push(`legacy SQL inventory drift for ${repoPath}: expected ${entry.expectedSqlFiles}, received ${actual}`)
      }
    } catch (error) {
      errors.push(`legacy SQL root invalid (${repoPath}): ${error.message}`)
    }
  }

  const migrations = Array.isArray(manifest?.migrations) ? manifest.migrations : []
  if (migrations.length === 0) errors.push('migrations must not be empty')
  const ids = new Set()
  const paths = new Set()
  const validated = []

  migrations.forEach((entry, index) => {
    const expectedId = `${manifestName}-${String(index + 1).padStart(3, '0')}`
    const id = String(entry?.id || '')
    if (id !== expectedId) errors.push(`migration ${index + 1} id must be ${expectedId}`)
    if (ids.has(id)) errors.push(`duplicate migration id: ${id}`)
    ids.add(id)

    const repoPath = normalizeRepoPath(entry?.path)
    if (paths.has(repoPath)) errors.push(`duplicate migration path: ${repoPath}`)
    paths.add(repoPath)

    let sql = ''
    let actualSha = ''
    try {
      const absolute = resolveInsideRepo(repoRoot, repoPath)
      if (!existsSync(absolute)) {
        errors.push(`migration file does not exist: ${repoPath}`)
      } else {
        const bytes = readFileSync(absolute)
        sql = bytes.toString('utf8')
        actualSha = sha256(canonicalSqlBytes(sql, checksumLineEnding))
      }
    } catch (error) {
      errors.push(error.message)
    }

    const expectedSha = String(entry?.sha256 || '')
    if (!shaPattern.test(expectedSha)) errors.push(`migration checksum is invalid: ${id}`)
    if (actualSha && actualSha !== expectedSha) errors.push(`migration checksum drift: ${id} (${repoPath})`)

    const transaction = entry?.transaction
    const beginCount = (sql.match(/^\s*BEGIN\s*;/gim) || []).length
    const commitCount = (sql.match(/^\s*COMMIT\s*;/gim) || []).length
    if (!['runner', 'file'].includes(transaction)) errors.push(`invalid transaction mode: ${id}`)
    if (transaction === 'runner' && (beginCount !== 0 || commitCount !== 0)) {
      errors.push(`runner-managed migration must not contain BEGIN/COMMIT: ${id}`)
    }
    if (transaction === 'file' && (beginCount !== 1 || commitCount !== 1)) {
      errors.push(`file-managed migration must contain exactly one BEGIN/COMMIT pair: ${id}`)
    }

    const rollback = entry?.rollback || {}
    let rollbackPath = ''
    if (rollback.strategy === 'backup-restore') {
      if (rollback.backupRequired !== true) {
        errors.push(`backup-restore rollback must require backup evidence: ${id}`)
      }
    } else if (rollback.strategy === 'sql') {
      rollbackPath = normalizeRepoPath(rollback.path)
      try {
        const absoluteRollbackPath = resolveInsideRepo(repoRoot, rollbackPath)
        if (!existsSync(absoluteRollbackPath)) {
          errors.push(`rollback file does not exist: ${rollbackPath}`)
        } else {
          const rollbackSource = readFileSync(absoluteRollbackPath, 'utf8')
          const actualRollbackSha = sha256(canonicalSqlBytes(rollbackSource, checksumLineEnding))
          const expectedRollbackSha = String(rollback.sha256 || '')
          if (!shaPattern.test(expectedRollbackSha)) errors.push(`rollback checksum is invalid: ${id}`)
          if (actualRollbackSha !== expectedRollbackSha) errors.push(`rollback checksum drift: ${id} (${rollbackPath})`)
        }
      } catch (error) {
        errors.push(error.message)
      }
    } else {
      errors.push(`unsupported rollback strategy: ${id}`)
    }

    validated.push({
      id,
      path: repoPath,
      sha256: expectedSha,
      transaction,
      rollbackStrategy: rollback.strategy || '',
      rollbackPath
    })
  })

  if (hasLegacyManifest) {
    try {
      const legacyPaths = readLegacyManifest(resolveInsideRepo(repoRoot, manifest.legacyManifest))
      const governedPaths = validated.map((entry) => entry.path)
      if (JSON.stringify(legacyPaths) !== JSON.stringify(governedPaths)) {
        errors.push('JSON migration order differs from legacy manifest')
      }
    } catch (error) {
      errors.push(`legacy manifest cannot be read: ${error.message}`)
    }
  }

  return { errors, migrations: validated, legacySqlCount }
}

export const loadAndValidateMigrationManifest = ({
  repoRoot = defaultRepoRoot,
  manifestPath = defaultManifestPath
} = {}) => {
  const absoluteManifest = resolveInsideRepo(repoRoot, normalizeRepoPath(manifestPath))
  const manifest = JSON.parse(readFileSync(absoluteManifest, 'utf8'))
  return { manifest, ...validateMigrationManifestData(manifest, { repoRoot }) }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const formatArg = process.argv.find((arg) => arg.startsWith('--format='))
  const format = formatArg ? formatArg.slice('--format='.length) : 'text'
  const manifestArg = process.argv.find((arg) => arg.startsWith('--manifest='))
  const manifestPath = manifestArg ? manifestArg.slice('--manifest='.length) : defaultManifestPath

  try {
    const result = loadAndValidateMigrationManifest({ manifestPath })
    if (result.errors.length) {
      for (const error of result.errors) console.error(`[error] ${error}`)
      process.exitCode = 1
    } else if (format === 'tsv') {
      for (const entry of result.migrations) {
        console.log([entry.id, entry.path, entry.sha256, entry.transaction, entry.rollbackStrategy].join('\t'))
      }
    } else if (format === 'json') {
      console.log(JSON.stringify(result.migrations, null, 2))
    } else {
      console.log(`PASS: database migration governance (${result.migrations.length} ordered/checksummed migrations, ${result.legacySqlCount} legacy SQL files inventoried)`)
    }
  } catch (error) {
    console.error(`[error] ${error.message}`)
    process.exitCode = 1
  }
}
