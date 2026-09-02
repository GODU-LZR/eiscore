// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  COMPANY_SITE_CAPABILITIES,
  isCompanyContentTypeEnabled
} from '../src/domain/company-site-capabilities.js'

const operationsSource = fs.readFileSync(new URL('../src/composables/use-company-site-operations.js', import.meta.url), 'utf8')

test('only runtime-backed operations are enabled during the profile merge', () => {
  assert.equal(COMPANY_SITE_CAPABILITIES.salesDrafts, false)
  assert.equal(COMPANY_SITE_CAPABILITIES.customerMatch, false)
  assert.equal(COMPANY_SITE_CAPABILITIES.keywordMapReport, false)
  assert.equal(COMPANY_SITE_CAPABILITIES.factGovernance, false)
  assert.equal(isCompanyContentTypeEnabled('pages'), true)
  assert.equal(isCompanyContentTypeEnabled('knowledge'), true)
  assert.equal(isCompanyContentTypeEnabled('certificates'), false)
  assert.equal(isCompanyContentTypeEnabled('externalProfiles'), false)
})

test('operations use the modular runtime contract without optional startup requests', () => {
  assert.match(operationsSource, /Promise\.allSettled\(\[loadSite\(\), loadContentCatalog\(\), loadLeads\(\), loadSeoChecks\(\)\]\)/)
  assert.match(operationsSource, /`\/company-site\/admin\/content\/\$\{editingType\.value\}/)
  assert.match(operationsSource, /request\.post\('\/company-site\/admin\/content\/publish', \{ objectType, id: row\.id, status \}\)/)
  assert.match(operationsSource, /request\.post\('\/company-site\/admin\/seo\/check'/)
  assert.match(operationsSource, /trademark:\s*\{[\s\S]*asset:\s*siteForm\.logoUrl/)
  assert.doesNotMatch(operationsSource, /\/company-site\/admin\/seo\/audit/)
})
