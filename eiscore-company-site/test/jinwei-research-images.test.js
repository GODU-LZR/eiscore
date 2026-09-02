// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JINWEI_RESEARCH_GROUPS, JINWEI_RESEARCH_IMAGES } from '../src/jinwei/research-images.js'
import { JINWEI_PRODUCT_FAMILIES, JINWEI_PUBLIC_PROJECTS, JINWEI_PUBLIC_SOLUTIONS } from '../src/jinwei/model.js'

test('independent-site research pack keeps every curated image locally available', () => {
  assert.equal(JINWEI_RESEARCH_IMAGES.length, 31)
  assert.equal(JINWEI_RESEARCH_GROUPS.length, 11)
  for (const item of JINWEI_RESEARCH_IMAGES) {
    assert.match(item.src, /^research-gallery\/gallery-\d{3}\.(?:jpg|jpeg|png|webp)$/)
    assert.equal(fs.existsSync(path.resolve('public/assets/jinwei', item.src)), true, item.src)
    assert.ok(item.source.startsWith('https://'))
    assert.ok(item.rights)
  }
})

test('Jinwei public model assets stay inside the independent-site gallery', () => {
  const assets = [
    ...JINWEI_PRODUCT_FAMILIES,
    ...JINWEI_PUBLIC_SOLUTIONS,
    ...JINWEI_PUBLIC_PROJECTS
  ].map((item) => item.asset)

  assert.ok(assets.length > 0)
  assert.ok(assets.every((asset) => asset.startsWith('research-gallery/gallery-')))
  for (const asset of assets) {
    assert.equal(fs.existsSync(path.resolve('public/assets/jinwei', asset)), true, asset)
  }
})
