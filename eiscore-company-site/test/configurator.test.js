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
import { createHash } from 'node:crypto'
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

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

test('君乐缘 V1 sources and V2/V3 derivatives are complete', () => {
  assert.equal(JUNLEYUAN_MATERIAL_ASSETS.length, 14)
  for (const asset of JUNLEYUAN_MATERIAL_ASSETS) {
    const files = [
      path.resolve('public/assets/junleyuan-materials', asset.fallbackPreviewFile),
      path.resolve('public/assets/junleyuan-materials-v2/cards', asset.previewFile),
      path.resolve('public/assets/junleyuan-materials-v2/textures', asset.lightweightTextureFile),
      path.resolve('public/assets/junleyuan-materials-v2/textures', asset.textureFile)
    ]
    files.forEach((file) => assert.equal(fs.existsSync(file), true, `${asset.assetId}: ${file}`))
    assert.match(asset.previewAssetId, /-CARD-V002$/)
    assert.match(asset.textureAssetId, /-TEXTURE-HQ-V003$/)
  }
})

test('君乐缘 derivative manifest is complete, immutable and non-production', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve('assets/manifests/asset_manifest.json'), 'utf8'))
  const sourceIds = new Set(manifest.assets.map((asset) => asset.asset_id))
  const derivatives = manifest.material_derivatives || []
  const derivativeIds = new Set(derivatives.map((asset) => asset.asset_id))

  assert.equal(manifest.manifestVersion, 2)
  assert.equal(derivatives.length, 42)
  assert.equal(derivativeIds.size, 42)
  assert.deepEqual(
    Object.fromEntries(['selection_card', 'texture_lightweight', 'texture_high_quality'].map((role) => [role, derivatives.filter((asset) => asset.role === role).length])),
    { selection_card: 14, texture_lightweight: 14, texture_high_quality: 14 }
  )

  for (const derivative of derivatives) {
    assert.equal(sourceIds.has(derivative.parent_asset_id), true, derivative.asset_id)
    assert.equal(derivative.status, 'candidate', derivative.asset_id)
    assert.equal(derivative.approved, false, derivative.asset_id)
    assert.equal(derivative.commercial_use, false, derivative.asset_id)
    assert.equal(derivative.license_id, 'supplier_authorization_pending', derivative.asset_id)
    const file = path.resolve('public', derivative.web_path)
    assert.equal(fs.existsSync(file), true, derivative.asset_id)
    assert.equal(sha256(file), derivative.sha256, derivative.asset_id)
  }

  for (const asset of JUNLEYUAN_MATERIAL_ASSETS) {
    const family = derivatives.filter((candidate) => candidate.parent_asset_id === asset.assetId)
    assert.deepEqual(family.map((candidate) => candidate.role).sort(), ['selection_card', 'texture_high_quality', 'texture_lightweight'])
    assert.equal(derivativeIds.has(asset.previewAssetId), true, asset.previewAssetId)
    assert.equal(derivativeIds.has(asset.textureAssetId), true, asset.textureAssetId)
  }
})

test('catalog material references resolve to source and derivative manifests', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve('assets/manifests/asset_manifest.json'), 'utf8'))
  const sourceIds = new Set(manifest.assets.map((asset) => asset.asset_id))
  const derivativeIds = new Set((manifest.material_derivatives || []).map((asset) => asset.asset_id))
  const variants = [
    ...BASE_MODELS,
    ...Object.values(COMPONENT_VARIANTS).flat()
  ]
  const sourceReferences = variants.map((variant) => variant.materialAssetId).filter(Boolean)
  const derivativeReferences = variants.flatMap((variant) => [variant.materialPreviewAssetId, variant.materialTextureAssetId]).filter(Boolean)

  assert.deepEqual([...new Set(sourceReferences)].filter((assetId) => !sourceIds.has(assetId)), [])
  assert.deepEqual([...new Set(derivativeReferences)].filter((assetId) => !derivativeIds.has(assetId)), [])
  variants.filter((variant) => variant.materialTextureAssetId).forEach((variant) => {
    assert.match(variant.materialPreviewUrl, /^assets\/junleyuan-materials-v2\/cards\/.+-V002\.webp$/)
    assert.match(variant.materialTextureUrl, /^assets\/junleyuan-materials-v2\/textures\/.+-V003\.webp$/)
    assert.match(variant.materialPreviewFallbackUrl, /^assets\/junleyuan-materials\/.+-V001\.jpg$/)
    assert.equal(variant.assetStatus, 'candidate')
    assert.equal(variant.approved, false)
  })
})
