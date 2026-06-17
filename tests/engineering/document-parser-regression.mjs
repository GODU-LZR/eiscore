// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Module = require('node:module')

process.env.DOCUMENT_PARSE_POLL_INTERVAL_MS = 'bad-interval'
process.env.DOCUMENT_PARSE_MAX_RETRIES = 'bad-retries'
process.env.DOCUMENT_PARSE_MAX_TEXT_CHARS = 'bad-text-limit'
process.env.DOCUMENT_PARSE_MAX_TABLE_ROWS_PER_SHEET = 'bad-table-limit'
process.env.DOCUMENT_PARSE_PG_POOL_MAX = 'bad-pool-max'
process.env.PGPORT = 'bad-port'

const state = {
  poolOptions: null
}

class FakePool {
  constructor(options) {
    state.poolOptions = options
  }

  async end() {}
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') return { Pool: FakePool }
  return originalLoad.call(this, request, parent, isMain)
}

const modulePath = '../../realtime/document-parser.js'
delete require.cache[require.resolve(modulePath)]
const { parseAsset, resolveParserType } = require(modulePath)
Module._load = originalLoad

assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')
assert.equal(state.poolOptions.max, 3, 'invalid parser pool max env should fall back to 3')

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eiscore-document-parser-'))

try {
  const textPath = path.join(tmpRoot, 'sample.txt')
  await fs.writeFile(textPath, '第一行\n第二行', 'utf8')

  assert.equal(resolveParserType({ file_ext: '.txt', mime_type: 'text/plain' }), 'text')
  const textResult = await parseAsset({
    storage_path: textPath,
    file_ext: '.txt',
    mime_type: 'text/plain',
    original_filename: 'sample.txt'
  })
  assert.equal(textResult.status, 'success')
  assert.equal(textResult.parserType, 'text')
  assert.match(textResult.textContent, /第一行/)

  const imagePath = path.join(tmpRoot, 'photo.png')
  await fs.writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

  assert.equal(resolveParserType({ file_ext: '.png', mime_type: 'image/png' }), 'image')
  const imageResult = await parseAsset({
    storage_path: imagePath,
    file_ext: '.png',
    mime_type: 'image/png',
    original_filename: 'photo.png'
  })
  assert.equal(imageResult.status, 'partial')
  assert.equal(imageResult.parserType, 'image')
  assert.equal(imageResult.ocrResult.status, 'pending')

  const unsupportedResult = await parseAsset({
    storage_path: imagePath,
    file_ext: '.bin',
    mime_type: 'application/octet-stream',
    original_filename: 'raw.bin'
  })
  assert.equal(unsupportedResult.status, 'partial')
  assert.equal(unsupportedResult.parserType, 'unsupported')

  console.log('PASS: document parser regression')
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true })
}
