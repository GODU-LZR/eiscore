// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (file) => readFileSync(resolve(file), 'utf8')
const host = read('eiscore-base/src/components/harness/BusinessHarnessHost.vue')
const frame = read('eiscore-base/src/components/harness/BusinessHarnessFrame.vue')

assert.match(host, /@dragenter="handleHostDragEnter"/)
assert.match(host, /@dragover="handleHostDragOver"/)
assert.match(host, /@drop="handleHostDrop"/)
assert.match(host, /释放文件以添加/)
assert.match(host, /event\.preventDefault\(\)/)
assert.match(host, /harnessFrameRef\.value\.acceptDroppedFiles\(files\)/)
assert.match(host, /@file-drop-finished="fileDropActive = false"/)
assert.match(frame, /async function processFileDrop\(files, id = createFileDropId\(\)\)/)
assert.match(frame, /async function acceptDroppedFiles\(fileList\)/)
assert.match(frame, /defineExpose\(\{ acceptDroppedFiles \}\)/)
assert.match(frame, /await processFileDrop\(message\.files, id\)/)
assert.match(frame, /emit\('file-drop-finished'\)/)
const receiveFileDrop = frame.slice(frame.indexOf('async function receiveFileDrop'), frame.indexOf('async function acceptDroppedFiles'))
assert.ok(receiveFileDrop.indexOf("emit('file-drop-finished')") < receiveFileDrop.indexOf('await processFileDrop(message.files, id)'), 'the host overlay must clear before upload begins')

console.log('PASS: Yayu Harness accepts file drops on the outer assistant panel and reuses the iframe upload path')
