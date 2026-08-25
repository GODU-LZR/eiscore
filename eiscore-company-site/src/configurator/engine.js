// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  BASE_MODELS,
  DEFAULT_COMPONENTS,
  PRICE_RULES,
  PRODUCT_FAMILIES,
  SLOT_DEFINITIONS,
  getBaseModel,
  getVariant,
  getVariants
} from './catalog.js'

export const DESIGN_SCHEMA_VERSION = 1

const text = (value, fallback = '') => {
  const result = String(value ?? '').trim()
  return result || fallback
}

const number = (value, fallback = 0) => {
  const result = Number(value)
  return Number.isFinite(result) ? result : fallback
}

export const createDesignId = (now = new Date()) => {
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('')
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `CUE-${date}-${suffix}`
}

export const createDefaultDesign = (overrides = {}) => normalizeDesign({
  designId: createDesignId(),
  productFamily: 'playing_cue',
  baseModel: BASE_MODELS[0].variantId,
  dimensions: {
    totalLengthMm: 1473,
    targetWeightOz: 19,
    tipDiameterMm: 12.25
  },
  components: Object.entries(DEFAULT_COMPONENTS).map(([slot, variantId]) => ({ slot, variantId })),
  customization: {
    engravingText: '',
    logoAssetId: '',
    artworkApprovalStatus: 'not_requested'
  },
  pricingCurrency: PRICE_RULES.currency,
  revision: 1,
  ...overrides
})

export const normalizeDesign = (input = {}) => {
  const sourceComponents = Array.isArray(input.components) ? input.components : []
  const componentMap = new Map(sourceComponents.map((item) => [text(item?.slot), text(item?.variantId)]))
  const components = Object.entries(DEFAULT_COMPONENTS).map(([slot, defaultVariantId]) => ({
    slot,
    variantId: componentMap.get(slot) || defaultVariantId
  }))
  const family = PRODUCT_FAMILIES.some((item) => item.id === input.productFamily) ? input.productFamily : 'playing_cue'
  const base = getBaseModel(input.baseModel)
  const targetWeight = number(input.dimensions?.targetWeightOz, getVariant('WEIGHT_SYSTEM', componentMap.get('WEIGHT_SYSTEM') || DEFAULT_COMPONENTS.WEIGHT_SYSTEM)?.weightOz || 19)
  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    designId: text(input.designId, createDesignId()),
    productFamily: family,
    baseModel: base.variantId,
    dimensions: {
      totalLengthMm: number(input.dimensions?.totalLengthMm, 1473),
      targetWeightOz: targetWeight,
      tipDiameterMm: number(input.dimensions?.tipDiameterMm, 12.25)
    },
    components,
    customization: {
      engravingText: text(input.customization?.engravingText).slice(0, 32),
      logoAssetId: text(input.customization?.logoAssetId),
      artworkApprovalStatus: text(input.customization?.artworkApprovalStatus, 'not_requested')
    },
    pricingCurrency: text(input.pricingCurrency, PRICE_RULES.currency),
    revision: Math.max(1, Math.floor(number(input.revision, 1)))
  }
}

export const updateComponent = (design, slot, variantId) => {
  const next = normalizeDesign(design)
  const nextVariant = getVariant(slot, variantId)
  if (!nextVariant) return next
  if (['TIP', 'JOINT', 'BUMPER', 'EXTENSION_INTERFACE'].includes(slot) && !isVariantCompatible(next, slot, variantId)) return next
  const componentMap = new Map(next.components.map((item) => [item.slot, item.variantId]))
  componentMap.set(slot, variantId)

  if (slot === 'SHAFT') {
    const compatibleTip = getVariants('TIP').find((variant) => nextVariant.allowedTipDiameters?.includes(variant.diameterMm))
    const compatibleJoint = getVariants('JOINT').find((variant) => nextVariant.jointFamilyIds?.includes(variant.jointFamily))
    if (compatibleTip) componentMap.set('TIP', compatibleTip.variantId)
    if (compatibleJoint) componentMap.set('JOINT', compatibleJoint.variantId)
  }
  if (slot === 'EXTENSION_INTERFACE' && variantId !== 'EXT-NONE-01') {
    const compatibleBumper = getVariants('BUMPER').find((variant) => variant.extensionInterface === variantId)
    if (compatibleBumper) componentMap.set('BUMPER', compatibleBumper.variantId)
  }

  const components = next.components.map((item) => ({ slot: item.slot, variantId: componentMap.get(item.slot) || item.variantId }))
  const dimensions = slot === 'WEIGHT_SYSTEM' && nextVariant?.weightOz
    ? { ...next.dimensions, targetWeightOz: nextVariant.weightOz }
    : next.dimensions
  return normalizeDesign({ ...next, components, dimensions, revision: next.revision + 1 })
}

export const updateBaseModel = (design, baseModelId) => {
  const model = getBaseModel(baseModelId)
  return normalizeDesign({ ...design, baseModel: model.variantId, productFamily: model.id.replace(/^BASE-/, '').replace(/-OEM-P01$/, '').toLowerCase(), revision: number(design?.revision, 1) + 1 })
}

export const setCustomization = (design, customization) => normalizeDesign({
  ...design,
  customization: { ...design.customization, ...customization },
  revision: number(design?.revision, 1) + 1
})

export const componentVariant = (design, slot) => {
  const selected = design?.components?.find((item) => item.slot === slot)
  return getVariant(slot, selected?.variantId)
}

export const isVariantCompatible = (input, slot, variantId) => {
  const design = normalizeDesign(input)
  const variant = getVariant(slot, variantId)
  if (!variant) return false
  if (slot === 'TIP') {
    const shaft = componentVariant(design, 'SHAFT')
    return !shaft || shaft.allowedTipDiameters.includes(variant.diameterMm)
  }
  if (slot === 'JOINT') {
    const shaft = componentVariant(design, 'SHAFT')
    return !shaft || shaft.jointFamilyIds.includes(variant.jointFamily)
  }
  if (slot === 'BUMPER') {
    const extension = componentVariant(design, 'EXTENSION_INTERFACE')
    return !extension || extension.variantId === 'EXT-NONE-01' || variant.extensionInterface === extension.variantId
  }
  if (slot === 'EXTENSION_INTERFACE') {
    const bumper = componentVariant(design, 'BUMPER')
    return variant.variantId === 'EXT-NONE-01' || !bumper || bumper.extensionInterface === variant.variantId
  }
  return true
}

const stableValue = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export const stableStringify = (value) => stableValue(value)

export const snapshotHash = (value) => {
  let hash = 2166136261
  const source = stableStringify(value)
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const validateDesign = (input) => {
  const design = normalizeDesign(input)
  const errors = []
  const warnings = []
  const shaft = componentVariant(design, 'SHAFT')
  const joint = componentVariant(design, 'JOINT')
  const tip = componentVariant(design, 'TIP')
  const wrap = componentVariant(design, 'WRAP')
  const bumper = componentVariant(design, 'BUMPER')
  const extension = componentVariant(design, 'EXTENSION_INTERFACE')
  const targetWeight = number(design.dimensions.targetWeightOz)

  if (!shaft || !joint || !tip) errors.push({ code: 'MISSING_CORE_COMPONENT', level: 'error', message: 'Shaft, joint and tip are required.' })
  if (shaft && joint && !shaft.jointFamilyIds.includes(joint.jointFamily)) {
    errors.push({ code: 'JOINT_INCOMPATIBLE', level: 'error', slot: 'JOINT', message: `${shaft.displayName} does not support ${joint.displayName}.` })
  }
  if (shaft && tip && !shaft.allowedTipDiameters.includes(tip.diameterMm)) {
    errors.push({ code: 'TIP_DIAMETER_MISMATCH', level: 'error', slot: 'TIP', message: `${tip.displayName} does not match the selected shaft diameter.` })
  }
  if (targetWeight < 18 || targetWeight > 21) {
    errors.push({ code: 'WEIGHT_OUT_OF_RANGE', level: 'error', slot: 'WEIGHT_SYSTEM', message: 'Prototype target weight must be between 18 oz and 21 oz.' })
  }
  if (wrap?.materialFamily === 'none' && design.components.some((item) => item.slot === 'HANDLE' && item.variantId === 'HANDLE-EBONY-DARK-01')) {
    warnings.push({ code: 'NO_WRAP_FINISH_REVIEW', level: 'warning', slot: 'WRAP', message: 'No-wrap with the dark handle needs a finish and comfort review.' })
  }
  if (extension?.variantId !== 'EXT-NONE-01' && bumper && bumper.extensionInterface !== extension.variantId) {
    errors.push({ code: 'EXTENSION_BUMPER_MISMATCH', level: 'error', slot: 'EXTENSION_INTERFACE', message: 'The selected bumper does not expose the selected extension interface.' })
  }
  if (design.customization.logoAssetId && design.customization.artworkApprovalStatus !== 'approved') {
    warnings.push({ code: 'ARTWORK_REVIEW_REQUIRED', level: 'warning', slot: 'BUTT_PLATE', message: 'Logo/artwork preview is not production-approved.' })
  }
  warnings.push({ code: 'PROTOTYPE_CATALOG', level: 'warning', message: 'All current variants are prototype placeholders pending factory confirmation.' })
  return { valid: errors.length === 0, design, errors, warnings }
}

export const calculateQuote = (input) => {
  const design = normalizeDesign(input)
  const baseModel = getBaseModel(design.baseModel)
  const selectedVariants = design.components.map((item) => getVariant(item.slot, item.variantId)).filter(Boolean)
  const optionTotal = selectedVariants.reduce((sum, variant) => sum + number(variant.priceDelta), 0)
  const engravingTotal = design.customization.engravingText ? PRICE_RULES.engraving : 0
  const artworkTotal = design.customization.logoAssetId ? PRICE_RULES.artworkReview : 0
  // BASE_MODELS already carries the product-family delta. Adding the family
  // delta again would double-charge Break, Jump and Snooker prototypes.
  const base = PRICE_RULES.baseModel + number(baseModel.priceDelta)
  const subtotal = base + optionTotal + engravingTotal + artworkTotal
  const leadTimeDays = Math.max(number(baseModel.leadTimeDays, 28), ...selectedVariants.map((variant) => number(variant.leadTimeDays, 0)), 28) + (design.customization.logoAssetId ? 5 : 0)
  return {
    currency: design.pricingCurrency || PRICE_RULES.currency,
    base,
    options: optionTotal,
    engraving: engravingTotal,
    artworkReview: artworkTotal,
    subtotal,
    leadTimeDays,
    status: validateDesign(design).valid ? 'indicative' : 'blocked'
  }
}

const visualName = (slot) => SLOT_DEFINITIONS.find((item) => item.slot === slot)

export const compileVisualBom = (input) => {
  const design = normalizeDesign(input)
  return [
    { slot: 'CUE_ROOT', componentCode: 'CUE_ROOT', variantId: design.baseModel, quantity: 1, uom: 'pcs', label: 'Cue root', labelZh: '整杆容器' },
    ...design.components.map((item) => {
      const variant = getVariant(item.slot, item.variantId)
      const definition = visualName(item.slot)
      return {
        slot: item.slot,
        componentCode: item.slot,
        variantId: item.variantId,
        quantity: 1,
        uom: 'pcs',
        label: definition?.label || item.slot,
        labelZh: definition?.labelZh || item.slot,
        materialAssetId: variant?.materialAssetId || '',
        materialPreviewUrl: variant?.materialPreviewUrl || '',
        sourceId: variant?.sourceId || '',
        sourceCell: variant?.sourceCell || '',
        assetStatus: variant?.assetStatus || (variant?.approved ? 'approved' : 'prototype'),
        geometryAssetId: variant?.geometryAssetId || 'GEO_PROTO_CUE_PARAMETRIC_V001',
        approved: Boolean(variant?.approved)
      }
    })
  ]
}

export const compileManufacturingBom = (input) => {
  const design = normalizeDesign(input)
  const quote = calculateQuote(design)
  const items = [
    { code: `RAW-SHAFT-${componentVariant(design, 'SHAFT')?.materialFamily || 'TBD'}`, description: 'Shaft blank / 前节坯料', quantity: 1, uom: 'pcs', operation: 'turning' },
    { code: `RAW-FOREARM-${componentVariant(design, 'FOREARM')?.variantId || 'TBD'}`, description: 'Forearm blank / 前把坯料', quantity: 1, uom: 'pcs', operation: 'splicing' },
    { code: `RAW-BUTT-${componentVariant(design, 'BUTT_SLEEVE')?.variantId || 'TBD'}`, description: 'Butt sleeve blank / 后把坯料', quantity: 1, uom: 'pcs', operation: 'assembly' },
    { code: `RAW-INLAY-${componentVariant(design, 'INLAY')?.variantId || 'TBD'}`, description: 'Inlay / 高插与镶嵌材料', quantity: componentVariant(design, 'INLAY')?.variantId === 'INLAY-NONE-01' ? 0 : 1, uom: 'set', operation: 'inlay_installation' },
    { code: `CONSUMABLE-WRAP-${componentVariant(design, 'WRAP')?.variantId || 'TBD'}`, description: 'Wrap material / 缠把材料', quantity: componentVariant(design, 'WRAP')?.variantId === 'WRAP-NONE-01' ? 0 : 1, uom: 'set', operation: 'wrapping' },
    { code: `HARDWARE-JOINT-${componentVariant(design, 'JOINT')?.variantId || 'TBD'}`, description: 'Joint and collar / 接牙与接环', quantity: 1, uom: 'set', operation: 'joint_installation' },
    { code: `HARDWARE-WEIGHT-${componentVariant(design, 'WEIGHT_SYSTEM')?.variantId || 'TBD'}`, description: 'Weight system / 配重系统', quantity: 1, uom: 'set', operation: 'weight_adjustment' },
    { code: `FINISH-BUTT-${componentVariant(design, 'BUTT_PLATE')?.variantId || 'TBD'}`, description: 'Butt plate and finish / 尾板与涂装', quantity: 1, uom: 'set', operation: 'finishing' }
  ]
  if (design.customization.engravingText) items.push({ code: 'SERVICE-ENGRAVING', description: 'Custom engraving / 个性化刻字', quantity: 1, uom: 'service', operation: 'engraving' })
  return {
    type: 'manufacturing',
    designId: design.designId,
    revision: design.revision,
    snapshotHash: snapshotHash(design),
    indicativeQuote: quote,
    items
  }
}

export const buildConfigurationSnapshot = (input) => {
  const validation = validateDesign(input)
  const design = validation.design
  const quote = calculateQuote(design)
  const visualBom = compileVisualBom(design)
  const manufacturingBom = compileManufacturingBom(design)
  return {
    design,
    validation: { valid: validation.valid, errors: validation.errors, warnings: validation.warnings },
    quote,
    visualBom,
    manufacturingBom,
    snapshotHash: snapshotHash({ design, quote, visualBom, manufacturingBom })
  }
}
