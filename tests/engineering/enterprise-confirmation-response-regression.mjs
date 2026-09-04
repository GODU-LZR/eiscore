// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  applyEnterpriseConfirmationResponse,
  computeEnterpriseConfirmationResponseSha256,
  validateEnterpriseConfirmationResponse
} from '../../scripts/enterprise-confirmation-response.mjs'
import { validateEnterpriseHandoff } from '../../scripts/validate-enterprise-handoff.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const requestReference = 'enterprise-handoffs/first-wave-confirmation-request.json'
const request = JSON.parse(readFileSync(resolve(repoRoot, requestReference), 'utf8'))
const schema = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise-package-handoff.schema.json'), 'utf8'))
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
const handoffReadme = readFileSync(resolve(repoRoot, 'enterprise-handoffs/README.md'), 'utf8')
const readinessDoc = readFileSync(resolve(repoRoot, 'docs/engineering/G4_2_HANDOFF_READINESS.md'), 'utf8')
const tempRoot = mkdtempSync(resolve(tmpdir(), 'eiscore-confirmation-response-'))

const enterpriseSource = (overrides = {}) => ({
  sourceId: 'test-enterprise-confirmation',
  type: 'enterprise-confirmation',
  authority: 'enterprise-confirmed',
  externalReference: 'approval-case-2026-0001',
  assessedAt: '2026-09-04T12:00:00.000Z',
  factUse: 'confirmation',
  containsSensitiveData: false,
  status: 'available',
  notes: 'Synthetic non-sensitive confirmation metadata used only by the regression fixture.',
  ...overrides
})

const createResponse = ({ sources = [enterpriseSource()], enterprises } = {}) => {
  const response = {
    $schema: '../config/enterprise-package-handoff.schema.json',
    documentType: 'enterprise-package-confirmation-response',
    schemaVersion: 1,
    responseId: 'test-first-wave-response',
    respondedAt: '2026-09-04T12:00:00.000Z',
    request: {
      path: requestReference,
      requestId: request.requestId,
      requestSha256: request.requestSha256
    },
    responsePolicy: {
      containsFieldValues: false,
      secretsForbidden: true,
      applyMode: 'new-snapshot-only',
      productionApprovalNotImplied: true
    },
    sources,
    enterprises: enterprises || [{
      trackingId: 'lundu-electromechanical',
      fieldDecisions: [{
        fieldId: 'content.cases',
        decision: 'confirm-not-applicable',
        sourceId: 'test-enterprise-confirmation',
        notes: 'The authoritative respondent marked this conditional field as not applicable.'
      }],
      assetDecisions: []
    }]
  }
  response.responseSha256 = computeEnterpriseConfirmationResponseSha256(response)
  return response
}

const writeResponse = (name, response) => {
  const path = resolve(tempRoot, `${name}.json`)
  writeFileSync(path, `${JSON.stringify(response, null, 2)}\n`, 'utf8')
  return path
}
const mutateResponse = (name, mutate, { refreshHash = true } = {}) => {
  const response = createResponse()
  mutate(response)
  if (refreshHash) response.responseSha256 = computeEnterpriseConfirmationResponseSha256(response)
  return validateEnterpriseConfirmationResponse({ responsePath: writeResponse(name, response), repoRoot })
}
const codes = (result) => new Set(result.issues.map(({ code }) => code))

try {
  assert.equal(schema.oneOf.length, 4)
  assert.equal(schema.$defs.confirmationResponseDocument.properties.documentType.const, 'enterprise-package-confirmation-response')
  assert.equal(schema.$defs.confirmationResponseDocument.properties.responsePolicy.properties.applyMode.const, 'new-snapshot-only')
  assert.equal(schema.$defs.confirmationResponseDocument.properties.responsePolicy.properties.containsFieldValues.const, false)
  assert.ok(schema.$defs.source.properties.type.enum.includes('implementation-confirmation'))
  assert.ok(schema.$defs.source.properties.type.enum.includes('product-engineering-confirmation'))

  const response = createResponse()
  const responsePath = writeResponse('valid', response)
  const valid = validateEnterpriseConfirmationResponse({ responsePath, repoRoot })
  assert.equal(valid.ok, true, valid.issues.map(({ code, path }) => `${path}:${code}`).join('\n'))
  assert.equal(response.responseSha256, computeEnterpriseConfirmationResponseSha256(response))

  const applied = applyEnterpriseConfirmationResponse({ responsePath, repoRoot })
  assert.equal(applied.ok, true, applied.issues.map(({ code, path }) => `${path}:${code}`).join('\n'))
  const lundu = applied.snapshot.enterprises.find(({ trackingId }) => trackingId === 'lundu-electromechanical')
  const cases = lundu.fieldReadiness.find(({ fieldId }) => fieldId === 'content.cases')
  assert.equal(cases.status, 'not-applicable')
  assert.deepEqual(cases.blockers, [])
  assert.ok(cases.sourceIds.includes('test-enterprise-confirmation'))
  assert.equal(lundu.packageStatus, 'not-created')
  assert.equal(lundu.productionEligible, false)
  assert.equal(applied.snapshot.appliedResponses[0].responseSha256, response.responseSha256)
  assert.equal(validateEnterpriseHandoff({ snapshotInput: applied.snapshot, repoRoot }).ok, true)
  const authorityDrift = structuredClone(applied.snapshot)
  authorityDrift.sources.find(({ sourceId }) => sourceId === 'test-enterprise-confirmation').authority = 'deployment-confirmed'
  assert.ok(codes(validateEnterpriseHandoff({ snapshotInput: authorityDrift, repoRoot })).has('confirmation-source-authority-mismatch'))
  const plan = spawnSync(process.execPath, [
    resolve(repoRoot, 'scripts/enterprise-confirmation-response.mjs'),
    'plan',
    responsePath
  ], { cwd: repoRoot, encoding: 'utf8' })
  assert.equal(plan.status, 0, plan.stderr)
  assert.equal(JSON.parse(plan.stdout).changes[0].action, 'not-applicable')
  const overwrite = spawnSync(process.execPath, [
    resolve(repoRoot, 'scripts/enterprise-confirmation-response.mjs'),
    'apply',
    responsePath,
    requestReference
  ], { cwd: repoRoot, encoding: 'utf8' })
  assert.equal(overwrite.status, 1)
  assert.match(overwrite.stderr, /output-exists/)

  const staleHash = mutateResponse('stale-hash', (input) => {
    input.enterprises[0].fieldDecisions[0].notes = 'changed without updating the response hash'
  }, { refreshHash: false })
  assert.ok(codes(staleHash).has('response-hash-drift'))

  const requestDrift = mutateResponse('request-drift', (input) => {
    input.request.requestSha256 = '0'.repeat(64)
  })
  assert.ok(codes(requestDrift).has('request-hash-mismatch'))

  const unrequestedDecision = mutateResponse('unrequested-decision', (input) => {
    input.enterprises[0].fieldDecisions[0].decision = 'confirm'
  })
  assert.ok(codes(unrequestedDecision).has('decision-not-requested'))

  const wrongOwner = mutateResponse('wrong-owner', (input) => {
    input.sources[0] = enterpriseSource({
      type: 'deployment-confirmation',
      authority: 'deployment-confirmed'
    })
  })
  assert.ok(codes(wrongOwner).has('field-source-owner-mismatch'))

  const collision = mutateResponse('source-collision', (input) => {
    input.sources[0].sourceId = 'junleyuan-legacy-seed'
    input.enterprises[0].fieldDecisions[0].sourceId = 'junleyuan-legacy-seed'
  })
  assert.ok(codes(collision).has('source-id-collision'))

  const leakedSecret = mutateResponse('secret-key', (input) => {
    input.sources[0].apiToken = 'forbidden'
  })
  assert.ok(codes(leakedSecret).has('secret-key-forbidden'))
  assert.ok(codes(leakedSecret).has('unknown-key'))

  const assetResponse = createResponse({
    sources: [enterpriseSource({
      sourceId: 'test-rights-holder-authorization',
      type: 'asset-authorization',
      authority: 'rights-holder',
      externalReference: 'rights-case-2026-0001'
    })],
    enterprises: [{
      trackingId: 'junleyuan',
      fieldDecisions: [],
      assetDecisions: [{
        assetSetId: 'junleyuan-source-materials-v1',
        decision: 'authorize',
        sourceId: 'test-rights-holder-authorization',
        notes: 'Synthetic authorization used only to verify the guarded transition.'
      }]
    }]
  })
  assetResponse.responseId = 'test-asset-authorization-response'
  assetResponse.responseSha256 = computeEnterpriseConfirmationResponseSha256(assetResponse)
  const assetApplied = applyEnterpriseConfirmationResponse({ responsePath: writeResponse('asset', assetResponse), repoRoot })
  assert.equal(assetApplied.ok, true, assetApplied.issues.map(({ code, path }) => `${path}:${code}`).join('\n'))
  const asset = assetApplied.snapshot.enterprises.find(({ trackingId }) => trackingId === 'junleyuan')
    .assetSets.find(({ assetSetId }) => assetSetId === 'junleyuan-source-materials-v1')
  assert.equal(asset.status, 'authorized')
  assert.equal(asset.authorizationStatus, 'confirmed')
  assert.equal(asset.commercialUse, true)
  assert.equal(assetApplied.snapshot.enterprises.find(({ trackingId }) => trackingId === 'junleyuan').productionEligible, false)

  const governanceResponse = createResponse({
    sources: [enterpriseSource({
      sourceId: 'test-implementation-confirmation',
      type: 'implementation-confirmation',
      authority: 'implementation-confirmed',
      externalReference: 'implementation-review-2026-0001'
    })],
    enterprises: [{
      trackingId: 'lundu-electromechanical',
      fieldDecisions: [{
        fieldId: 'governance.factStatus',
        decision: 'review-and-confirm',
        sourceId: 'test-implementation-confirmation',
        notes: 'Synthetic premature governance review used to prove the dependency gate.'
      }],
      assetDecisions: []
    }]
  })
  governanceResponse.responseId = 'test-premature-governance-response'
  governanceResponse.responseSha256 = computeEnterpriseConfirmationResponseSha256(governanceResponse)
  const governancePath = writeResponse('governance', governanceResponse)
  assert.equal(validateEnterpriseConfirmationResponse({ responsePath: governancePath, repoRoot }).ok, true)
  const governanceApplied = applyEnterpriseConfirmationResponse({ responsePath: governancePath, repoRoot })
  assert.equal(governanceApplied.ok, false)
  assert.ok(codes(governanceApplied).has('fact-readiness-incomplete'))

  for (const marker of ['new-snapshot-only', 'externalReference', '不会原地覆盖']) {
    assert.ok(handoffReadme.includes(marker), `handoff README lost response boundary: ${marker}`)
  }
  for (const marker of ['确认响应', '受控回填', '不会创建企业包']) {
    assert.ok(readinessDoc.includes(marker), `G4.2 doc lost response boundary: ${marker}`)
  }
  assert.match(packageJson.scripts?.['enterprise-response:validate'] || '', /enterprise-confirmation-response\.mjs validate/)
  assert.match(packageJson.scripts?.['enterprise-response:plan'] || '', /enterprise-confirmation-response\.mjs plan/)
  assert.match(packageJson.scripts?.['enterprise-response:apply'] || '', /enterprise-confirmation-response\.mjs apply/)
  assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:enterprise-response/)

  console.log('PASS: confirmation responses bind authoritative decisions to the request and only create validated successor readiness snapshots')
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
