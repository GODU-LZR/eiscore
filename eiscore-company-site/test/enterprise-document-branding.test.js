// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveEnterpriseFaviconUrl,
  resolveEnterpriseOperationsTitle
} from '../src/domain/enterprise-document-branding.js'

test('operations document title follows the active enterprise profile', () => {
  assert.equal(resolveEnterpriseOperationsTitle({ brandName: '案例食品' }), '案例食品｜企业站点运营｜EISCore')
  assert.equal(resolveEnterpriseOperationsTitle({}), '企业站点运营｜EISCore')
})

test('package favicon paths resolve to the public enterprise asset mount', () => {
  assert.equal(
    resolveEnterpriseFaviconUrl({ trademark: { faviconAssetPath: 'assets/site/favicon.svg' } }),
    '/company-site/enterprise-assets/site/favicon.svg'
  )
  assert.equal(resolveEnterpriseFaviconUrl({ trademark: { faviconAssetPath: 'assets/../secret.svg' } }), '')
  assert.equal(resolveEnterpriseFaviconUrl({ trademark: { faviconUrl: 'http://unsafe.example/icon.svg' } }), '')
})
