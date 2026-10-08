// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validatePublicServiceContent, localizedPublicServices } from '../../eiscore-base/src/services/public-service-content.js'

const path = new URL('../../eiscore-base/public/enterprise-assets/site/service-pages.json', import.meta.url)
const content = JSON.parse(readFileSync(path, 'utf8'))
assert.equal(validatePublicServiceContent(content), content)
assert.equal(localizedPublicServices(content, 'en-GB'), content.locales['en-US'])
assert.equal(localizedPublicServices(content, 'fr-FR'), content.locales['zh-CN'])
assert.equal(localizedPublicServices(null), null)
assert.deepEqual(readFileSync(path), readFileSync(new URL('../../enterprise-packs/lundu/assets/site/service-pages.json', import.meta.url)))

for (const imageUrl of ['javascript:alert(1)', '//other.example/image.png', '/enterprise-assets/../private.png']) {
  const unsafe = structuredClone(content)
  unsafe.locales['zh-CN'].pages[0].imageUrl = imageUrl
  assert.throws(() => validatePublicServiceContent(unsafe))
}
const invalidSections = structuredClone(content)
invalidSections.locales['en-US'].pages[0].sections[0].items = null
assert.throws(() => validatePublicServiceContent(invalidSections))
const duplicates = structuredClone(content)
duplicates.locales['zh-CN'].pages[1].id = duplicates.locales['zh-CN'].pages[0].id
assert.throws(() => validatePublicServiceContent(duplicates))
assert.throws(() => validatePublicServiceContent({ schemaVersion: 1, locales: {} }))
console.log('PASS: localized public service content, asset boundaries and synchronized resources')
