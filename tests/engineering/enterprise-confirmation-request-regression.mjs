// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  buildEnterpriseConfirmationRequest,
  computeEnterpriseConfirmationRequestSha256,
  validateEnterpriseConfirmationRequest
} from '../../scripts/enterprise-confirmation-request.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const snapshotReference = 'enterprise-handoffs/first-wave-readiness.json'
const snapshotPath = resolve(repoRoot, snapshotReference)
const requestPath = resolve(repoRoot, 'enterprise-handoffs/first-wave-confirmation-request.json')
const schema = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise-package-handoff.schema.json'), 'utf8'))
const request = JSON.parse(readFileSync(requestPath, 'utf8'))
const handoffReadme = readFileSync(resolve(repoRoot, 'enterprise-handoffs/README.md'), 'utf8')
const readinessDoc = readFileSync(resolve(repoRoot, 'docs/engineering/G4_2_HANDOFF_READINESS.md'), 'utf8')
const siteGuide = readFileSync(resolve(repoRoot, 'docs/engineering/ENTERPRISE_SITE_CONFIGURATION.md'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
const tempRoot = mkdtempSync(resolve(tmpdir(), 'eiscore-confirmation-request-'))

const writeMutation = (name, mutate) => {
  const input = structuredClone(request)
  mutate(input)
  const path = resolve(tempRoot, `${name}.json`)
  writeFileSync(path, `${JSON.stringify(input, null, 2)}\n`, 'utf8')
  return validateEnterpriseConfirmationRequest({ requestPath: path, repoRoot })
}
const codes = (result) => new Set(result.issues.map(({ code }) => code))

try {
  assert.equal(schema.oneOf.length, 4)
  assert.equal(schema.$defs.confirmationRequestDocument.properties.documentType.const, 'enterprise-package-confirmation-request')
  assert.equal(schema.$defs.confirmationRequestDocument.properties.responsePolicy.properties.responseMustReferenceRequest.const, true)
  assert.equal(schema.$defs.confirmationRequestDocument.properties.responsePolicy.properties.secretsForbidden.const, true)
  assert.equal(schema.$defs.confirmationRequestDocument.properties.responsePolicy.properties.productionApprovalNotImplied.const, true)

  const generated = buildEnterpriseConfirmationRequest({ snapshotPath, snapshotReference, repoRoot })
  assert.deepEqual(generated, request)
  assert.deepEqual(buildEnterpriseConfirmationRequest({ snapshotPath, snapshotReference, repoRoot }), generated)
  assert.equal(request.requestSha256, computeEnterpriseConfirmationRequestSha256(request))
  assert.equal(request.documentType, 'enterprise-package-confirmation-request')
  assert.equal(request.responsePolicy.candidateSourcesCannotConfirm, true)
  assert.deepEqual(request.enterprises.map(({ trackingId }) => trackingId), ['jinwei-netting', 'junleyuan', 'lundu-electromechanical'])
  assert.equal(request.enterprises.reduce((sum, enterprise) => sum + enterprise.fieldRequests.length, 0), 99)
  assert.equal(request.enterprises.reduce((sum, enterprise) => sum + enterprise.assetRequests.length, 0), 4)
  assert.ok(request.enterprises.flatMap(({ fieldRequests }) => fieldRequests).every((entry) => !('value' in entry)))

  const jinwei = request.enterprises.find(({ trackingId }) => trackingId === 'jinwei-netting')
  const junleyuan = request.enterprises.find(({ trackingId }) => trackingId === 'junleyuan')
  const lundu = request.enterprises.find(({ trackingId }) => trackingId === 'lundu-electromechanical')
  assert.deepEqual(jinwei.assetRequests[0].decisionOptions, ['complete-inventory', 'reject', 'replace'])
  assert.ok(junleyuan.assetRequests.every(({ decisionOptions }) => decisionOptions.includes('authorize')))
  assert.deepEqual(lundu.assetRequests[0].decisionOptions, ['confirm-not-applicable', 'provide-inventory', 'reject'])
  assert.deepEqual(
    junleyuan.fieldRequests.find(({ fieldId }) => fieldId === 'governance.productionApproval').decisionOptions,
    ['approve', 'reject']
  )
  assert.deepEqual(
    lundu.fieldRequests.find(({ fieldId }) => fieldId === 'content.cases').decisionOptions,
    ['confirm-not-applicable', 'provide-and-confirm', 'reject']
  )

  const valid = validateEnterpriseConfirmationRequest({ requestPath, repoRoot })
  assert.equal(valid.ok, true, valid.issues.map(({ code, path }) => `${path}:${code}`).join('\n'))

  for (const marker of ['99 个字段决策', '4 个素材决策', '不包含待确认字段值', 'authorize', 'approve']) {
    assert.ok(handoffReadme.includes(marker), `handoff README lost confirmation boundary: ${marker}`)
  }
  for (const marker of ['99 个字段决策', '4 个素材决策', '确认响应须经过失败关闭校验和受控回填']) {
    assert.ok(readinessDoc.includes(marker), `G4.2 readiness doc lost confirmation boundary: ${marker}`)
  }
  assert.match(siteGuide, /确认请求由 readiness 确定生成/)
  assert.match(packageJson.scripts?.['enterprise-confirmation:generate'] || '', /enterprise-confirmation-request\.mjs generate/)
  assert.match(packageJson.scripts?.['enterprise-confirmation:validate'] || '', /enterprise-confirmation-request\.mjs validate/)
  assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:enterprise-confirmation/)

  const staleHash = writeMutation('stale-hash', (input) => {
    input.enterprises[0].displayName = 'changed'
  })
  assert.equal(staleHash.ok, false)
  assert.ok(codes(staleHash).has('request-hash-drift'))

  const missingRequest = writeMutation('missing-request', (input) => {
    input.enterprises[0].fieldRequests.pop()
    input.requestSha256 = computeEnterpriseConfirmationRequestSha256(input)
  })
  assert.equal(missingRequest.ok, false)
  assert.ok(codes(missingRequest).has('confirmation-request-drift'))

  const snapshotDrift = writeMutation('snapshot-drift', (input) => {
    input.snapshot.sha256 = '0'.repeat(64)
    input.requestSha256 = computeEnterpriseConfirmationRequestSha256(input)
  })
  assert.equal(snapshotDrift.ok, false)
  assert.ok(codes(snapshotDrift).has('snapshot-hash-drift'))

  const unsafeSnapshot = writeMutation('unsafe-snapshot', (input) => {
    input.snapshot.path = '../outside.json'
    input.requestSha256 = computeEnterpriseConfirmationRequestSha256(input)
  })
  assert.equal(unsafeSnapshot.ok, false)
  assert.ok(codes(unsafeSnapshot).has('unsafe-snapshot-path'))

  console.log('PASS: deterministic confirmation request binds 99 field decisions and 4 asset decisions to the governed readiness snapshot')
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
