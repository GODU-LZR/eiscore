// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 EISCore contributors

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const source = readFileSync(new URL('../../scripts/static-spa-server.mjs', import.meta.url), 'utf8')
const routeFunctions = source.slice(source.indexOf('function getMicroProxy('), source.indexOf('function shouldRedirectMobileRequest('))
const root = path.resolve('virtual-dist')
const packaged = new Set(['index.html', 'mobile/index.html', 'apps/index.html', 'mobile/assets/main.js'].map((file) => path.join(root, file)))
let served
const createSubject = new Function('path', 'root', 'base', 'microTargets', 'existsFile', 'sendFile', 'sendText', 'redirect', 'acceptsHtml', 'isStandaloneAppsPreviewPath', `${routeFunctions}; return { getMicroProxy, serveStatic };`)
const subject = createSubject(path, root, '/', [
  { prefix: '/mobile', target: 'dev-mobile' },
  { prefix: '/apps', target: 'dev-apps' }
], (file) => packaged.has(file), (_req, _res, file) => { served = path.relative(root, file).split(path.sep).join('/') }, () => {}, () => {}, () => true, (route) => route.startsWith('/apps/preview/'))

for (const route of ['/mobile', '/mobile/', '/mobile/login', '/mobile/inventory']) {
  assert.equal(subject.getMicroProxy(route), null)
  subject.serveStatic({ method: 'GET' }, {}, route)
  assert.equal(served, 'mobile/index.html', `${route} must load the standalone mobile entry`)
}
assert.equal(subject.getMicroProxy('/mobile/assets/main.js'), null)
subject.serveStatic({ method: 'GET' }, {}, '/mobile/assets/main.js')
assert.equal(served, 'mobile/assets/main.js')
subject.serveStatic({ method: 'GET' }, {}, '/hr/app/employees')
assert.equal(served, 'index.html', 'hosted micro-app deep links must retain the host entry')
subject.serveStatic({ method: 'GET' }, {}, '/apps/preview/flash-draft')
assert.equal(served, 'apps/index.html')
packaged.delete(path.join(root, 'mobile/index.html'))
assert.equal(subject.getMicroProxy('/mobile/login')?.target, 'dev-mobile', 'absent standalone bundle must retain the dev fallback')
console.log('PASS: packaged static routes preserve mobile deep links, local assets and the host entry without starting a server')
