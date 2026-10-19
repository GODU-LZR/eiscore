// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileHashes, protectedPath, sha256, stampRelease, treeSha256, validateSite } from '../../scripts/stage-lundu-web-release.mjs'

const root = mkdtempSync(join(tmpdir(), 'lundu-release-'))
const put = (name, value) => { mkdirSync(join(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), value) }
const policy = { enterpriseId: 'lundu', carouselCount: 6, mounts: ['', 'mobile'], favicon: '/enterprise-assets/site/icon.png' }
try {
  const slides = Array.from({ length: 6 }, (_, i) => `/enterprise-assets/site/${i}.jpg`)
  for (const name of [...slides, policy.favicon]) put(name, 'art')
  put('assets/PumpBomViewer-123.js', 'viewer')
  put('assets/index-123.js', 'app')
  put('index.html', `<script src="/assets/index-123.js"></script>${`<link href="${policy.favicon}">`.repeat(3)}`)
  put('mobile/index.html', '<script src="./main.js"></script>')
  put('mobile/main.js', 'mobile')
  put('config/eiscore-enterprise.json', JSON.stringify({ enterprise: { id: 'lundu' }, branding: { login: { carouselImages: slides } } }))
  const baseline = Object.fromEntries(Object.entries(fileHashes(root)).filter(([name]) => protectedPath(name)))
  validateSite(root, baseline, policy)
  put('enterprise-assets/site/0.jpg', 'replaced art')
  assert.throws(() => validateSite(root, baseline, policy), /protected file changed/)
  put('enterprise-assets/site/0.jpg', 'art')
  rmSync(join(root, 'mobile/main.js'))
  assert.throws(() => validateSite(root, baseline, policy), /protected file changed/)
  put('mobile/main.js', 'mobile')
  put('assets/index-123.js', 'junleyuan')
  assert.throws(() => validateSite(root, baseline, policy), /wrong public brand/)
  put('assets/index-123.js', 'app')
  rmSync(join(root, 'assets/PumpBomViewer-123.js'))
  assert.throws(() => validateSite(root, baseline, policy), /missing 3D/)
  const old = "const RELEASE_VERSION = 'old'"
  assert.equal(stampRelease(old, 'new'), "const RELEASE_VERSION = 'new'")
  assert.notEqual(sha256(old), sha256(stampRelease(old, 'new')))
  assert.throws(() => stampRelease('no version', 'new'), /exactly one/)
  assert.equal(treeSha256({ b: '2', a: '1' }), sha256('a\x001\nb\x002\n'))
  assert.notEqual(treeSha256({ a: '1' }), treeSha256({ a: '2' }))
  console.log('lundu-web-stage-regression: PASS (art/module loss, wrong brand, missing 3D, SW stamp and byte binding)')
} finally {
  rmSync(root, { recursive: true, force: true })
}
