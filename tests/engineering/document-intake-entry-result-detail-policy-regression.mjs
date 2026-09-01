// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const policyPath = resolve(repoRoot, 'eiscore-base/src/domain/document-intake-entry-result-detail-policy.js')
const viewPath = resolve(repoRoot, 'eiscore-base/src/views/DocumentIntakeCenter.vue')
const policySource = readFileSync(policyPath, 'utf8')
const viewSource = readFileSync(viewPath, 'utf8')
const policy = await import(pathToFileURL(policyPath).href)

const fallback = { id: 'fallback', metadata: { rejected_rows: [{ reason: 'fallback rejection' }] } }
const entryResult = { id: 'detail', metadata: { rejected_rows: [{ reason: 'detail metadata rejection' }] } }
const detail = {
  entryResult,
  businessLinks: [{ id: 'link-1' }],
  businessCorrections: [{ id: 'correction-1' }],
  relatedLogs: [{ id: 'log-1' }],
  unmappedFields: [{ name: 'supplier' }],
  rejectedRows: [{ reason: 'server rejection' }]
}
const projection = policy.buildDocumentIntakeEntryResultDetailProjection(detail, fallback)

assert.equal(projection.entryResult, entryResult)
assert.equal(projection.businessLinks, detail.businessLinks)
assert.equal(projection.businessCorrections, detail.businessCorrections)
assert.equal(projection.relatedLogs, detail.relatedLogs)
assert.equal(projection.unmappedFields, detail.unmappedFields)
assert.equal(projection.rejectedRows, detail.rejectedRows)

assert.deepEqual(policy.buildDocumentIntakeEntryResultDetailProjection(null, fallback), {
  entryResult: fallback,
  businessLinks: [],
  businessCorrections: [],
  relatedLogs: [],
  unmappedFields: [],
  rejectedRows: fallback.metadata.rejected_rows
})
assert.deepEqual(policy.buildDocumentIntakeEntryResultDetailProjection({
  entryResult,
  businessLinks: {},
  businessCorrections: null,
  relatedLogs: 'invalid',
  unmappedFields: false
}), {
  entryResult,
  businessLinks: [],
  businessCorrections: [],
  relatedLogs: [],
  unmappedFields: [],
  rejectedRows: entryResult.metadata.rejected_rows
})
assert.deepEqual(
  policy.buildDocumentIntakeEntryResultDetailProjection({ entryResult, rejectedRows: [] }, fallback).rejectedRows,
  []
)
assert.deepEqual(policy.buildDocumentIntakeEntryResultDetailProjection(), {
  entryResult: null,
  businessLinks: [],
  businessCorrections: [],
  relatedLogs: [],
  unmappedFields: [],
  rejectedRows: []
})

assert.doesNotMatch(policySource, /from\s*['"](?:vue|element-plus|@element-plus\/icons-vue)['"]/)
assert.doesNotMatch(policySource, /\b(?:window|navigator|globalThis|document)\s*\./)
assert.doesNotMatch(policySource, /\b(?:localStorage|sessionStorage|XMLHttpRequest)\b|\bfetch\s*\(|\bRequest\s*\(/)
assert.doesNotMatch(policySource, /\bnew\s+Date\b|\bDate\s*\.|\b(?:setTimeout|setInterval)\s*\(/)
assert.ok(viewSource.includes("from '@/domain/document-intake-entry-result-detail-policy.js'"))
assert.ok(viewSource.includes('buildDocumentIntakeEntryResultDetailProjection('))
for (const property of ['entryResult', 'businessLinks', 'businessCorrections', 'relatedLogs', 'unmappedFields', 'rejectedRows']) {
  assert.ok(viewSource.includes(`entryResultDetailProjection.${property}`), `missing detail projection: ${property}`)
}
assert.ok(viewSource.split(/\r?\n/).length <= 2024, 'DocumentIntakeCenter must not grow beyond its entry-result-detail baseline')

console.log('PASS: document intake entry result detail policy regression')
