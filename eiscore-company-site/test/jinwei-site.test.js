// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const siteSource = fs.readFileSync(new URL('../src/views/JinweiSite.vue', import.meta.url), 'utf8')
const siteBehaviorSource = fs.readFileSync(new URL('../src/composables/use-jinwei-site.js', import.meta.url), 'utf8')

test('production Jinwei home starts with the factory entrance carousel', () => {
  assert.match(siteBehaviorSource, /id: 'entrance',[\s\S]*?image: 'research-gallery\/gallery-001\.png'/)
  assert.match(siteSource, /class="hero-slides"/)
  assert.match(siteSource, /class="hero-controls"/)
})

test('production Jinwei home does not render the research archive section', () => {
  assert.doesNotMatch(siteSource, /id="archive"/)
  assert.doesNotMatch(siteSource, /copy\.sections\.archive/)
  assert.doesNotMatch(siteSource, /independent-site research pack/i)
})

test('published enterprise profile overrides duplicated public identity fields', () => {
  assert.match(siteBehaviorSource, /enterpriseProfileFromSiteConfig/)
  assert.match(siteBehaviorSource, /publishedEnterpriseProfile\.value = profile/)
  assert.match(siteBehaviorSource, /profile\?\.seo\?\.title/)
  assert.match(siteBehaviorSource, /profile\?\.publicSiteUrl/)
  assert.match(siteBehaviorSource, /profile\?\.contact\?\.email/)
  assert.match(siteSource, /profileThemeStyle/)
})
