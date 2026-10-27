// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  resolveFilePreviewKind,
  selectFilesForUpload,
  serializeFileItem,
  shouldDeleteStoredFile,
  shouldUploadFileToDatabase
} from '../../shared/eis-data-grid-v2/file-dialog-policy.mjs'

const file = (name, type = '', size = 1) => ({ name, type, size })

const previewCases = [
  ['photo.JPG', '', 'image'],
  ['scan.pdf', 'application/pdf', 'pdf'],
  ['clip.mp4', '', 'video'],
  ['voice.mp3', 'audio/mpeg', 'audio'],
  ['contract.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'office'],
  ['sheet.xlsx', '', 'office'],
  ['deck.pptx', '', 'office'],
  ['archive.zip', 'application/zip', 'unsupported']
]

for (const [name, type, expected] of previewCases) {
  assert.equal(resolveFilePreviewKind(file(name, type)), expected, `${name} preview kind`)
}

const selected = selectFilesForUpload([
  file('ok.pdf', 'application/pdf', 100),
  file('wrong.exe', 'application/octet-stream', 100),
  file('large.pdf', 'application/pdf', 2048),
  file('second.pdf', 'application/pdf', 100),
  file('third.pdf', 'application/pdf', 100)
], {
  currentCount: 1,
  maxCount: 3,
  maxSizeBytes: 1024,
  acceptRules: ['.pdf']
})

assert.deepEqual(selected.accepted.map(item => item.name), ['ok.pdf', 'second.pdf'])
assert.equal(selected.skippedType, 1)
assert.equal(selected.skippedSize, 1)
assert.equal(selected.skippedCount, 1)

const wildcard = selectFilesForUpload([file('anything.bin', 'application/octet-stream', 10)], {
  currentCount: 0,
  maxCount: 1,
  maxSizeBytes: 20,
  acceptRules: ['*/*']
})
assert.equal(wildcard.accepted.length, 1)
assert.equal(wildcard.skippedType, 0)

const exhausted = selectFilesForUpload([file('a.pdf', 'application/pdf', 1)], {
  currentCount: 2,
  maxCount: 2,
  maxSizeBytes: 20,
  acceptRules: ['.pdf']
})
assert.equal(exhausted.accepted.length, 0)
assert.equal(exhausted.skippedCount, 1)

assert.equal(shouldUploadFileToDatabase('reference-list'), true)
assert.equal(shouldUploadFileToDatabase('url'), true)
assert.equal(shouldUploadFileToDatabase('list'), false)
assert.equal(shouldDeleteStoredFile('reference-list', { url: 'file:abc' }), true)
assert.equal(shouldDeleteStoredFile('list', { url: 'file:abc' }), false)
const reference = serializeFileItem({
  id: 'file-1',
  name: '合同.pdf',
  type: 'application/pdf',
  size: 1024,
  url: 'file:abc',
  dataUrl: 'data:application/pdf;base64,large-payload',
  ext: 'pdf'
})
assert.deepEqual(reference.url, 'file:abc')
assert.equal(Object.hasOwn(reference, 'dataUrl'), false, 'reference-list cell values do not duplicate file bytes')

console.log('file-dialog policy regression checks passed')
