// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildConfigurationSnapshot,
  calculateQuote,
  compileManufacturingBom,
  compileVisualBom,
  createDefaultDesign,
  isVariantCompatible,
  snapshotHash,
  updateComponent,
  validateDesign
} from '../src/configurator/engine.js'
import { BASE_MODELS, COMPONENT_VARIANTS, JUNLEYUAN_MATERIAL_ASSETS } from '../src/configurator/catalog.js'
import fs from 'node:fs'
import path from 'node:path'

const componentId = (design, slot) => design.components.find((item) => item.slot === slot)?.variantId

test('default cue design passes prototype rules and exposes both BOMs', () => {
  const design = createDefaultDesign()
  const validation = validateDesign(design)
  const visualBom = compileVisualBom(design)
  const manufacturingBom = compileManufacturingBom(design)

  assert.equal(validation.valid, true)
  assert.equal(validation.errors.length, 0)
  assert.equal(visualBom.length, 14)
  assert.equal(manufacturingBom.designId, design.designId)
  assert.equal(manufacturingBom.revision, design.revision)
  assert.ok(manufacturingBom.items.some((item) => item.operation === 'joint_installation'))
  assert.ok(manufacturingBom.items.some((item) => item.operation === 'inlay_installation' && item.quantity === 0))
})

test('shaft change reconciles tip and joint to compatible variants', () => {
  const design = createDefaultDesign()
  const next = updateComponent(design, 'SHAFT', 'SHAFT-MAPLE-1175-JF02')

  assert.equal(componentId(next, 'SHAFT'), 'SHAFT-MAPLE-1175-JF02')
  assert.equal(componentId(next, 'TIP'), 'TIP-LAYERED-MEDIUM-1175-01')
  assert.equal(componentId(next, 'JOINT'), 'JOINT-JF02-BRASS')
  assert.equal(validateDesign(next).valid, true)
})

test('incompatible variants are rejected by the selection rule', () => {
  const design = createDefaultDesign()

  assert.equal(isVariantCompatible(design, 'JOINT', 'JOINT-JF02-BRASS'), false)
  assert.equal(isVariantCompatible(design, 'TIP', 'TIP-LAYERED-MEDIUM-1175-01'), false)
  assert.equal(componentId(updateComponent(design, 'JOINT', 'JOINT-JF02-BRASS'), 'JOINT'), componentId(design, 'JOINT'))

  const invalid = {
    ...design,
    components: design.components.map((item) => item.slot === 'SHAFT'
      ? { ...item, variantId: 'SHAFT-MAPLE-1175-JF02' }
      : item)
  }
  const validation = validateDesign(invalid)
  assert.equal(validation.valid, false)
  assert.ok(validation.errors.some((issue) => issue.code === 'JOINT_INCOMPATIBLE'))
})

test('quote and snapshot respond to a material upgrade without changing the contract', () => {
  const design = createDefaultDesign()
  const defaultQuote = calculateQuote(design)
  const upgraded = updateComponent(design, 'SHAFT', 'SHAFT-CARBON-125-JF01')
  const upgradedQuote = calculateQuote(upgraded)
  const snapshot = buildConfigurationSnapshot(upgraded)

  assert.ok(upgradedQuote.subtotal > defaultQuote.subtotal)
  assert.equal(upgradedQuote.status, 'indicative')
  assert.equal(snapshot.design.designId, design.designId)
  assert.equal(snapshot.visualBom.length, 14)
  assert.equal(snapshot.manufacturingBom.designId, design.designId)
  assert.notEqual(snapshotHash(design), snapshotHash(upgraded))
  assert.equal(snapshotHash(upgraded), snapshotHash(upgraded))
})

test('base-family price delta is applied exactly once', () => {
  const breakModel = BASE_MODELS.find((model) => model.id === 'BASE-BREAK_CUE-OEM-P01')
  const quote = calculateQuote({ baseModel: breakModel.variantId, productFamily: 'break_cue' })

  assert.equal(quote.base, 490)
  assert.equal(quote.subtotal, 619)
})

test('君乐缘 candidate previews are present and traceable', () => {
  assert.equal(JUNLEYUAN_MATERIAL_ASSETS.length, 14)
  for (const asset of JUNLEYUAN_MATERIAL_ASSETS) {
    const file = path.resolve('public/assets/junleyuan-materials', asset.previewFile)
    assert.equal(fs.existsSync(file), true, asset.assetId)
  }
})

test('catalog material references resolve to manifest assets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve('assets/manifests/asset_manifest.json'), 'utf8'))
  const manifestIds = new Set(manifest.assets.map((asset) => asset.asset_id))
  const references = [
    ...BASE_MODELS,
    ...Object.values(COMPONENT_VARIANTS).flat()
  ].map((variant) => variant.materialAssetId).filter(Boolean)

  assert.deepEqual([...new Set(references)].filter((assetId) => !manifestIds.has(assetId)), [])
})
