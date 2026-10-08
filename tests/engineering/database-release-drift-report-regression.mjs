import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '../..')
const fixedPath = resolve(repoRoot, 'database/releases/eiscore-db-v6/manifest.json')
const before = readFileSync(fixedPath)
const result = spawnSync(process.execPath, ['scripts/report-database-release-drift.mjs', '--json-only'], {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true
})
assert.equal(result.status, 1, 'current v6 provenance drift must fail closed')
const report = JSON.parse(result.stdout)
assert.equal(report.releasePath, 'database/releases/eiscore-db-v6/manifest.json')
assert.match(report.frozenManifestSha256, /^[0-9a-f]{64}$/)
assert.match(report.candidateManifestSha256, /^[0-9a-f]{64}$/)
assert.ok(report.drift.some(({ field }) => field === 'migrationManifests'))
const migrationDrift = report.drift.find(({ field }) => field === 'migrationManifests')
assert.equal(migrationDrift.candidate.find(({ name }) => name === 'core').terminal.id, 'core-011')
assert.equal(readFileSync(fixedPath).toString(), before.toString(), 'drift report must not rewrite frozen manifest')
assert.ok(statSync(fixedPath).isFile())
console.log('PASS: database release drift report is read-only and exposes the core-011 provenance gap')
