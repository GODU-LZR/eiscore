// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAndValidateDatabaseRelease } from './database-release-contract.mjs'
import { loadAndValidateDatabaseBackupEvidence } from './restore-database-release-backup.mjs'

const repoRoot = resolve(import.meta.dirname, '..')

export const evaluateDatabaseBackupInventory = ({
  backupRoot,
  environment = 'isolated',
  releasePath = process.env.DB_RELEASE_PATH,
  now = Date.now()
}) => {
  const policy = JSON.parse(readFileSync(resolve(repoRoot, 'database/operations/policy.json'), 'utf8'))
  const release = loadAndValidateDatabaseRelease({ repoRoot, ...(releasePath ? { releasePath } : {}) })
  const errors = [...release.errors]
  const warnings = []
  const root = resolve(backupRoot)
  const evidencePaths = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(root, entry.name, 'backup-evidence.json'))
      .filter(existsSync)
    : []
  const backups = evidencePaths.map((evidencePath) => {
    const result = loadAndValidateDatabaseBackupEvidence({ evidencePath, release })
    errors.push(...result.errors.map((error) => `${evidencePath}: ${error}`))
    const createdAt = Date.parse(result.evidence.createdAt)
    if (!Number.isFinite(createdAt)) errors.push(`${evidencePath}: createdAt is invalid`)
    if (environment === 'production' && (
      !result.evidence.storageEncryptionEvidence
      || result.evidence.storageEncryptionEvidence.startsWith('isolated://')
    )) {
      errors.push(`${evidencePath}: production storage encryption evidence is required`)
    }
    return {
      evidencePath,
      evidenceSha256: result.evidenceSha256,
      createdAt: result.evidence.createdAt,
      ageSeconds: Number.isFinite(createdAt) ? Math.max(0, Math.floor((now - createdAt) / 1000)) : null,
      databaseDumpSha256: result.evidence.databaseDump?.sha256 || ''
    }
  }).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt), 'en'))
  if (backups.length === 0) errors.push('no verified database backup evidence found')
  const latest = backups[0]
  if (latest?.ageSeconds > policy.backup.recoveryPointObjectiveSeconds) {
    errors.push(`latest verified backup exceeds RPO (${latest.ageSeconds}s)`)
  }
  if (environment !== 'production') warnings.push('isolated backup evidence does not prove production storage encryption')
  return {
    schemaVersion: 1,
    policyId: policy.policyId,
    environment,
    status: errors.length ? 'failed' : 'healthy',
    checkedAt: new Date(now).toISOString(),
    recoveryPointObjectiveSeconds: policy.backup.recoveryPointObjectiveSeconds,
    retention: policy.backup.retention,
    backups,
    errors,
    warnings
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const rootArgument = process.argv.find((argument) => argument.startsWith('--backup-root='))
    const environmentArgument = process.argv.find((argument) => argument.startsWith('--environment='))
    const releaseArgument = process.argv.find((argument) => argument.startsWith('--release='))
    if (!rootArgument) throw new Error('--backup-root=<path> is required')
    const report = evaluateDatabaseBackupInventory({
      backupRoot: rootArgument.slice('--backup-root='.length),
      environment: environmentArgument?.slice('--environment='.length) || 'isolated',
      releasePath: releaseArgument?.slice('--release='.length)
    })
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (report.errors.length) process.exitCode = 1
  } catch (error) {
    console.error(`[error] ${error.message}`)
    process.exitCode = 1
  }
}
