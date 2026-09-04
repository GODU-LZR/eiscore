// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { validateEnterpriseHandoff } from '../../scripts/validate-enterprise-handoff.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const sourcePath = resolve(repoRoot, 'enterprise-handoffs/first-wave-readiness.json')
const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const tempRoot = mkdtempSync(resolve(tmpdir(), 'eiscore-enterprise-handoff-'))
const clone = () => structuredClone(source)
const validateMutation = (name, mutate) => {
  const input = clone()
  mutate(input)
  const path = resolve(tempRoot, `${name}.json`)
  writeFileSync(path, `${JSON.stringify(input, null, 2)}\n`, 'utf8')
  return validateEnterpriseHandoff({ snapshotPath: path, repoRoot })
}
const issueCodes = (result) => new Set(result.issues.map(({ code }) => code))

try {
  assert.equal(validateEnterpriseHandoff({ snapshotPath: sourcePath, repoRoot }).ok, true)

  const missingField = validateMutation('missing-field', (input) => {
    input.enterprises[0].fieldReadiness.pop()
  })
  assert.equal(missingField.ok, false)
  assert.ok(issueCodes(missingField).has('field-coverage-mismatch'))

  const sourceLessCandidate = validateMutation('source-less-candidate', (input) => {
    input.enterprises[0].fieldReadiness.find(({ status }) => status === 'candidate').sourceIds = []
  })
  assert.equal(sourceLessCandidate.ok, false)
  assert.ok(issueCodes(sourceLessCandidate).has('candidate-source-required'))

  const falseConfirmation = validateMutation('false-confirmation', (input) => {
    const field = input.enterprises[1].fieldReadiness.find(({ status }) => status === 'candidate')
    field.status = 'confirmed'
    field.blockers = []
  })
  assert.equal(falseConfirmation.ok, false)
  assert.ok(issueCodes(falseConfirmation).has('confirmation-source-required'))

  const productionShortcut = validateMutation('production-shortcut', (input) => {
    input.enterprises[1].productionEligible = true
  })
  assert.equal(productionShortcut.ok, false)
  assert.ok(issueCodes(productionShortcut).has('production-package-not-approved'))
  assert.ok(issueCodes(productionShortcut).has('production-field-not-ready'))
  assert.ok(issueCodes(productionShortcut).has('production-assets-not-ready'))

  const unauthorizedAsset = validateMutation('unauthorized-asset', (input) => {
    const assetSet = input.enterprises[1].assetSets[0]
    assetSet.status = 'authorized'
    assetSet.authorizationStatus = 'confirmed'
    assetSet.commercialUse = true
  })
  assert.equal(unauthorizedAsset.ok, false)
  assert.ok(issueCodes(unauthorizedAsset).has('asset-authorization-source-required'))

  const inventoryDrift = validateMutation('inventory-drift', (input) => {
    input.enterprises[0].assetSets[0].presentFileCount = 29
  })
  assert.equal(inventoryDrift.ok, false)
  assert.ok(issueCodes(inventoryDrift).has('inventory-file-count-drift'))

  const sensitiveRepositoryCopy = validateMutation('sensitive-repository-copy', (input) => {
    input.sources.find(({ sourceId }) => sourceId === 'lundu-intake-audit').repositoryPath = 'config/enterprise.v2.example.json'
  })
  assert.equal(sensitiveRepositoryCopy.ok, false)
  assert.ok(issueCodes(sensitiveRepositoryCopy).has('sensitive-source-cannot-be-repository-bound'))

  const localPathLeak = validateMutation('local-path-leak', (input) => {
    input.sources[0].notes = 'C:\\private\\handoff.xlsx'
  })
  assert.equal(localPathLeak.ok, false)
  assert.ok(issueCodes(localPathLeak).has('local-path-forbidden'))

  const digestDrift = validateMutation('digest-drift', (input) => {
    input.mapping.sha256 = '0'.repeat(64)
  })
  assert.equal(digestDrift.ok, false)
  assert.ok(issueCodes(digestDrift).has('mapping-hash-drift'))

  console.log('PASS: enterprise handoff validator fails closed on incomplete evidence, false approval, asset drift, sensitive paths and mapping drift')
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
