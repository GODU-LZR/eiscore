// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const request = read('eiscore-purchase/src/utils/request.js')
assert.match(request, /shouldNotifyError:\s*\(config\)\s*=>\s*\(\s*config\.silentError !== true && config\.suppressErrorMessage !== true/)
assert.match(request, /onUnauthorized:\s*\(\)\s*=>\s*clearAuthAndRedirect\(['"]\/login['"]\)/)
assert.match(request, /defaultProfile:\s*['"]public['"]/)

const flow = read('eiscore-purchase/src/utils/business-flow.js')
assert.match(flow, /import request from ['"]@\/utils\/request['"]/)
assert.doesNotMatch(flow, /\bfetch\s*\(/)
assert.doesNotMatch(flow, /getAuthHeader/)

assert.match(flow, /request\(\{\s*url: path,\s*method: ['"]post['"]/)
assert.match(flow, /Prefer:\s*['"]return=representation['"]/)
assert.match(flow, /data:\s*payload/)
assert.match(flow, /silentError:\s*true/)
assert.match(flow, /suppressErrorMessage:\s*true/)
assert.match(flow, /url:\s*`\/document_links\?\$\{buildLinkQuery\(payload\)\}&select=id&limit=1`/)
assert.match(flow, /if \(Array\.isArray\(rows\) && rows\.length > 0\) return rows\[0\]/)
assert.match(flow, /return postOptionalRecord\(['"]\/document_links['"], payload\)/)

console.log('PASS: purchase business-flow uses platform Request')
