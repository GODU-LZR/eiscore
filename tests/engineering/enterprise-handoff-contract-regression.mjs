// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateEnterpriseHandoff } from '../../scripts/validate-enterprise-handoff.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const snapshotPath = resolve(repoRoot, 'enterprise-handoffs/first-wave-readiness.json')
const schema = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise-package-handoff.schema.json'), 'utf8'))
const catalogBuffer = readFileSync(resolve(repoRoot, 'config/enterprise-package-handoff-fields.json'))
const catalog = JSON.parse(catalogBuffer.toString('utf8'))
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
const audit = readFileSync(resolve(repoRoot, 'docs/engineering/G4_2_HANDOFF_READINESS.md'), 'utf8')
const guide = readFileSync(resolve(repoRoot, 'docs/engineering/ENTERPRISE_SITE_CONFIGURATION.md'), 'utf8')
const handoffReadme = readFileSync(resolve(repoRoot, 'enterprise-handoffs/README.md'), 'utf8')
const index = readFileSync(resolve(repoRoot, 'docs/engineering/README.md'), 'utf8')
const progress = readFileSync(resolve(repoRoot, 'docs/engineering/REFACTOR_PROGRESS.md'), 'utf8')
const finalReport = readFileSync(resolve(repoRoot, 'docs/engineering/REFACTOR_FINAL_REPORT.md'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
const result = validateEnterpriseHandoff({ snapshotPath, repoRoot })

assert.equal(schema.oneOf.length, 2)
assert.equal(schema.$defs.fieldCatalogDocument.properties.documentType.const, 'enterprise-package-handoff-field-catalog')
assert.equal(schema.$defs.readinessSnapshotDocument.properties.documentType.const, 'enterprise-package-readiness-snapshot')
assert.equal(schema.$defs.readinessSnapshotDocument.properties.handoffPolicy.properties.siteKey.const, 'primary')
assert.equal(schema.$defs.readinessSnapshotDocument.properties.handoffPolicy.properties.applyMode.const, 'initialize-only')
assert.equal(schema.$defs.readinessSnapshotDocument.properties.handoffPolicy.properties.initialStatus.const, 'draft')
assert.equal(schema.$defs.readinessSnapshotDocument.properties.handoffPolicy.properties.productionRequiresExplicitApproval.const, true)

assert.equal(catalog.documentType, 'enterprise-package-handoff-field-catalog')
assert.equal(catalog.mappingVersion, 1)
assert.equal(catalog.fields.length, 33)
assert.deepEqual(catalog.fields.map(({ fieldId }) => fieldId), [...catalog.fields.map(({ fieldId }) => fieldId)].sort())
assert.equal(new Set(catalog.fields.flatMap(({ targetFile, targetPaths }) => targetPaths.map((path) => `${targetFile}:${path}`))).size, catalog.fields.flatMap(({ targetPaths }) => targetPaths).length)
assert.ok(catalog.fields.some(({ fieldId, targetFile }) => fieldId === 'runtime.modules' && targetFile === 'runtime/eiscore-enterprise.json'))
assert.ok(catalog.fields.some(({ fieldId, targetFile }) => fieldId === 'content.products' && targetFile === 'data/company-site.json'))
assert.ok(catalog.fields.some(({ fieldId, targetFile }) => fieldId === 'governance.productionApproval' && targetFile === 'manifest.json'))
assert.ok(catalog.fields.some(({ fieldId, targetFile }) => fieldId === 'migration.scope' && targetFile === 'evidence/handoff.json'))

assert.equal(snapshot.mapping.sha256, createHash('sha256').update(catalogBuffer).digest('hex'))
assert.equal(snapshot.handoffPolicy.controller, 'implementation-operations-console')
assert.equal(snapshot.handoffPolicy.runtimeConsumer, 'eiscore')
assert.deepEqual(snapshot.enterprises.map(({ trackingId }) => trackingId), ['jinwei-netting', 'junleyuan', 'lundu-electromechanical'])
assert.ok(snapshot.enterprises.every(({ packageStatus, productionEligible }) => packageStatus === 'not-created' && productionEligible === false))
assert.ok(snapshot.enterprises.every(({ fieldReadiness }) => fieldReadiness.length === catalog.fields.length))

const jinwei = snapshot.enterprises.find(({ trackingId }) => trackingId === 'jinwei-netting')
const junleyuan = snapshot.enterprises.find(({ trackingId }) => trackingId === 'junleyuan')
const lundu = snapshot.enterprises.find(({ trackingId }) => trackingId === 'lundu-electromechanical')
assert.deepEqual(jinwei.assetSets.map(({ declaredFileCount, presentFileCount }) => [declaredFileCount, presentFileCount]), [[31, 28]])
assert.deepEqual(junleyuan.assetSets.map(({ declaredFileCount, presentFileCount }) => [declaredFileCount, presentFileCount]), [[42, 42], [14, 14]])
assert.equal(lundu.assetSets[0].status, 'absent')
assert.equal(lundu.fieldReadiness.find(({ fieldId }) => fieldId === 'content.products').status, 'missing')
assert.equal(junleyuan.fieldReadiness.find(({ fieldId }) => fieldId === 'content.products').status, 'candidate')
assert.equal(jinwei.fieldReadiness.find(({ fieldId }) => fieldId === 'runtime.modules').status, 'missing')

for (const marker of ['33 组字段', '28/31', '14/14', '42/42', 'initialStatus=draft', 'published', '三家企业包尚未创建']) {
  assert.ok(audit.includes(marker), `G4.2 readiness audit lost marker: ${marker}`)
}
for (const marker of ['实施运营台交接', 'missing/candidate/confirmed/not-applicable', '不会自动生成企业包']) {
  assert.ok(guide.includes(marker), `enterprise site guide lost handoff marker: ${marker}`)
}
for (const marker of ['不是企业包 payload', 'trackingId', 'enterprise-handoff:validate']) {
  assert.ok(handoffReadme.includes(marker), `enterprise handoff README lost boundary: ${marker}`)
}
assert.match(index, /G4\.2 已建立 33 组实施运营台字段映射/)
for (const marker of ['e2665c7', 'G4.2 已建立交接/readiness 基线', '继续 G4.2']) {
  assert.ok(progress.includes(marker), `progress ledger lost G4.2 handoff checkpoint: ${marker}`)
}
assert.match(finalReport, /G4\.2 已建立 33 组实施运营台字段映射/)
assert.match(finalReport, /三家企业包仍等待权威确认/)
assert.match(packageJson.scripts?.['enterprise-handoff:validate'] || '', /validate-enterprise-handoff\.mjs/)
assert.match(packageJson.scripts?.['test:enterprise-handoff'] || '', /enterprise-handoff-validator-regression\.mjs/)
assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:enterprise-handoff/)

assert.equal(result.ok, true, result.issues.map(({ code, path }) => `${path}:${code}`).join('\n'))
console.log('PASS: enterprise handoff maps 33 field groups and records evidence-bounded readiness for three isolated enterprises')
