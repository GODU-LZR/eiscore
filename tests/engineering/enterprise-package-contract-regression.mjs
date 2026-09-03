// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { parseEnterpriseConfig } from '../../packages/eiscore-platform/src/enterprise-config.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const packRoot = resolve(repoRoot, 'enterprise-packs/example')
const manifest = JSON.parse(readFileSync(resolve(packRoot, 'manifest.json'), 'utf8'))
const schema = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise-package.schema.json'), 'utf8'))
const adr = readFileSync(resolve(repoRoot, 'docs/engineering/adr/0012-isolated-single-tenant-enterprise-packages.md'), 'utf8')
const readme = readFileSync(resolve(repoRoot, 'enterprise-packs/README.md'), 'utf8')

const listFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name)
  return entry.isDirectory() ? listFiles(path) : [path]
})
const posixRelative = (path) => relative(packRoot, path).split(sep).join('/')
const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const safeRelativePath = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/

assert.equal(schema.properties.packageSchemaVersion.const, 1)
assert.equal(schema.properties.coreCompatibility.properties.enterpriseConfigSchemaVersion.const, 2)
assert.equal(schema.properties.runtime.properties.mountPath.const, '/config/eiscore-enterprise.json')
assert.equal(manifest.packageSchemaVersion, 1)
assert.equal(manifest.status, 'template')
assert.equal(manifest.governance.productionApproved, false)
assert.equal(manifest.coreCompatibility.enterpriseConfigSchemaVersion, 2)
assert.equal(manifest.runtime.mountPath, '/config/eiscore-enterprise.json')

const paths = manifest.files.map((entry) => entry.path)
assert.equal(new Set(paths).size, paths.length, 'enterprise package manifest paths must be unique')
assert.deepEqual(
  listFiles(packRoot).map(posixRelative).filter((path) => path !== 'manifest.json').sort(),
  [...paths].sort(),
  'enterprise package manifest must enumerate every payload file exactly once'
)

for (const entry of manifest.files) {
  assert.match(entry.path, safeRelativePath)
  const absolutePath = resolve(packRoot, ...entry.path.split('/'))
  const content = readFileSync(absolutePath)
  assert.equal(statSync(absolutePath).size, entry.bytes, `enterprise package byte count drifted: ${entry.path}`)
  assert.equal(sha256(content), entry.sha256, `enterprise package hash drifted: ${entry.path}`)
}

const runtimePath = resolve(packRoot, ...manifest.runtime.configPath.split('/'))
const runtimeConfig = parseEnterpriseConfig(JSON.parse(readFileSync(runtimePath, 'utf8')), {
  source: 'example enterprise package runtime config'
})
assert.equal(runtimeConfig.schemaVersion, 2)
assert.equal(runtimeConfig.enterprise.id, manifest.enterprise.id)
assert.equal('login' in runtimeConfig.branding, false)
assert.equal(manifest.files.filter((entry) => entry.kind === 'runtime-config').length, 1)

for (const marker of ['状态：接受', '独立数据库', '同一核心制品', '企业包', 'v1', 'v2', '回退']) {
  assert.ok(adr.includes(marker), `ADR-0012 lost enterprise package boundary: ${marker}`)
}
for (const marker of ['template', 'draft', 'candidate', 'approved', 'company_site.site_config', '不得猜测']) {
  assert.ok(readme.includes(marker), `enterprise package guide lost governance marker: ${marker}`)
}

console.log(`PASS: enterprise package v${manifest.packageSchemaVersion} boundary (${manifest.files.length} payload file)`)
