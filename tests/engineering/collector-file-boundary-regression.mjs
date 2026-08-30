// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const fileService = readFileSync(
  resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorFileService.cs'),
  'utf8'
)

const emptyFileGuard = fileService.match(
  /var info = new FileInfo\(filePath\);[\s\S]*?if \(info\.Length == 0\)[\s\S]*?return null;/
)

assert.ok(emptyFileGuard, 'CollectorFileService should guard zero-byte files before queue insertion.')
assert.match(emptyFileGuard[0], /"file_ignored"/, 'Zero-byte files should be logged as ignored input.')
assert.match(emptyFileGuard[0], /file_size/, 'Zero-byte rejection should include file-size evidence.')

const guardEnd = fileService.indexOf(emptyFileGuard[0]) + emptyFileGuard[0].length
const hashIndex = fileService.indexOf('ComputeSha256Async', guardEnd)
const insertIndex = fileService.indexOf('InsertAsync', guardEnd)
assert.ok(hashIndex > guardEnd, 'Zero-byte guard should run before hashing.')
assert.ok(insertIndex > guardEnd, 'Zero-byte guard should run before queue insertion.')

console.log('PASS: collector zero-byte file boundary regression')
