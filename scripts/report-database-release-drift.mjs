// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { canonicalJson } from './database-contract-catalog.mjs'
import {
  buildDatabaseReleaseManifest,
  databaseReleaseManifestSha256,
  defaultDatabaseReleasePath
} from './database-release-contract.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const jsonOnly = process.argv.includes('--json-only')
const fixedPath = resolve(repoRoot, defaultDatabaseReleasePath)
const fixed = JSON.parse(readFileSync(fixedPath, 'utf8'))
const revisionResult = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true
})
if (revisionResult.status !== 0) throw new Error('unable to resolve current git revision')
const sourceRevision = revisionResult.stdout.trim()
const candidate = buildDatabaseReleaseManifest({
  repoRoot,
  releaseId: fixed.releaseId,
  sourceRevision,
  predecessorCatalogs: fixed.predecessors
    .filter(({ id }) => id !== 'eiscore-db-v1-runtime')
    .map(({ id, databaseCatalogSha256 }) => ({ id, databaseCatalogSha256 }))
})

const differences = []
const compare = (field, left, right) => {
  if (canonicalJson(left) !== canonicalJson(right)) differences.push({ field, frozen: left, candidate: right })
}
compare('releaseId', fixed.releaseId, candidate.releaseId)
compare('sourceRevision', fixed.sourceRevision, candidate.sourceRevision)
compare('images', fixed.images, candidate.images)
compare('baseline', fixed.baseline, candidate.baseline)
compare('migrationManifests', fixed.migrationManifests, candidate.migrationManifests)
compare('databaseContract', fixed.databaseContract, candidate.databaseContract)
compare('operationPolicy', fixed.operationPolicy, candidate.operationPolicy)
compare('releasePolicy', fixed.releasePolicy, candidate.releasePolicy)
compare('artifacts', fixed.artifacts, candidate.artifacts)

const report = {
  releasePath: defaultDatabaseReleasePath,
  frozenManifestSha256: databaseReleaseManifestSha256(fixed),
  candidateManifestSha256: databaseReleaseManifestSha256(candidate),
  sourceRevision,
  drift: differences
}
if (jsonOnly) process.stdout.write(JSON.stringify(report) + '\n')
else console.log(JSON.stringify(report, null, 2))
if (differences.length) process.exitCode = 1
