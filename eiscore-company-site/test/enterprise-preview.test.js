// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEnterprisePreview } from '../src/domain/enterprise-preview.js'

test('enterprise preview uses package data without embedding an enterprise in product code', () => {
  const preview = normalizeEnterprisePreview({
    manifest: { status: 'draft', governance: { productionApproved: false } },
    runtime: { enterprise: { displayName: '示例食品企业', shortName: '示例食品' } },
    seed: {
      site: { legalName: '示例食品企业', brandName: '示例食品', settings: { previewLabel: '本地预览' } },
      content: {
        pages: [{ slug: 'home', title: '稳定交付', blocks: { homepage: { hero: { titleLines: ['从原料，', '到交付。'] } } } }],
        products: [{ productCode: 'DEMO-001', name: '水果制品', applications: ['茶饮'] }]
      },
      governance: { factStatus: 'pending' }
    }
  })

  assert.equal(preview.enterpriseName, '示例食品企业')
  assert.deepEqual(preview.hero.titleLines, ['从原料，', '到交付。'])
  assert.equal(preview.products[0].code, 'DEMO-001')
  assert.deepEqual(preview.products[0].applications, ['茶饮'])
  assert.equal(preview.isProductionApproved, false)
})

test('enterprise preview has safe fallbacks for an incomplete draft', () => {
  const preview = normalizeEnterprisePreview({})
  assert.equal(preview.enterpriseName, '企业案例')
  assert.equal(preview.packageStatus, 'draft')
  assert.equal(preview.factStatus, 'pending')
  assert.equal(preview.isProductionApproved, false)
})
