// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

/**
 * Prototype catalog for the first Cue Builder slice.
 *
 * This is deliberately data-only. Values are placeholders for interaction,
 * validation and BOM tests until the factory confirms real component SKUs,
 * dimensions, costs, lead times and license-backed assets.
 */

export const PRODUCT_FAMILIES = [
  { id: 'playing_cue', name: 'Playing cue', nameZh: '九球 / 斯诺克球杆', priceDelta: 0, leadTimeDays: 28 },
  { id: 'break_cue', name: 'Break cue', nameZh: '开球杆', priceDelta: 70, leadTimeDays: 30 },
  { id: 'jump_cue', name: 'Jump cue', nameZh: '跳杆', priceDelta: 90, leadTimeDays: 32 },
  { id: 'snooker_cue', name: 'Snooker cue', nameZh: '斯诺克球杆', priceDelta: 45, leadTimeDays: 30 }
]

export const CUE_BUILDER_STEPS = [
  { id: 'base', number: '01', label: 'Choose base', labelZh: '选择基础型号', slot: 'CUE_ROOT', focusSlot: 'CUE_ROOT' },
  { id: 'shaft', number: '02', label: 'Shaft & tip', labelZh: '前节与皮头', slot: 'SHAFT', focusSlot: 'SHAFT' },
  { id: 'joint', number: '03', label: 'Joint', labelZh: '接牙与接环', slot: 'JOINT', focusSlot: 'JOINT' },
  { id: 'forearm', number: '04', label: 'Forearm & wood', labelZh: '前把与木材', slot: 'FOREARM', focusSlot: 'FOREARM' },
  { id: 'grip', number: '05', label: 'Grip', labelZh: '握把缠把', slot: 'WRAP', focusSlot: 'WRAP' },
  { id: 'butt', number: '06', label: 'Butt & details', labelZh: '后把与细节', slot: 'BUTT_SLEEVE', focusSlot: 'BUTT_SLEEVE' },
  { id: 'personalize', number: '07', label: 'Personalize', labelZh: '个性化', slot: null, focusSlot: 'BUTT_PLATE' },
  { id: 'review', number: '08', label: 'Review', labelZh: '检查配置', slot: null, focusSlot: 'CUE_ROOT' }
]

export const SLOT_DEFINITIONS = [
  { slot: 'TIP', label: 'Tip', labelZh: '皮头', step: 'shaft' },
  { slot: 'FERRULE', label: 'Ferrule', labelZh: '先角', step: 'shaft' },
  { slot: 'SHAFT', label: 'Shaft', labelZh: '前节', step: 'shaft' },
  { slot: 'JOINT', label: 'Joint', labelZh: '接牙 / 接环', step: 'joint' },
  { slot: 'FOREARM', label: 'Forearm', labelZh: '前把', step: 'forearm' },
  { slot: 'INLAY', label: 'Inlay', labelZh: '镶嵌 / 高插', step: 'forearm' },
  { slot: 'HANDLE', label: 'Handle', labelZh: '握把基体', step: 'grip' },
  { slot: 'WRAP', label: 'Wrap', labelZh: '缠把', step: 'grip' },
  { slot: 'BUTT_SLEEVE', label: 'Butt sleeve', labelZh: '后把', step: 'butt' },
  { slot: 'BUTT_PLATE', label: 'Butt plate', labelZh: '尾板', step: 'butt' },
  { slot: 'WEIGHT_SYSTEM', label: 'Weight system', labelZh: '配重', step: 'butt' },
  { slot: 'BUMPER', label: 'Bumper', labelZh: '胶塞', step: 'butt' },
  { slot: 'EXTENSION_INTERFACE', label: 'Extension interface', labelZh: '延长把接口', step: 'butt' }
]

// These are factory-supplied preview crops from 君乐缘素材.xlsx. They are
// candidate references for the internal prototype, not approved PBR assets.
export const JUNLEYUAN_MATERIAL_ASSETS = [
  { assetId: 'JLY-MAT-PURPLEHEART-ROD-V001', name: 'Purpleheart', nameZh: '紫心木', previewFile: 'JLY-MAT-PURPLEHEART-ROD-V001.jpg', sourceCell: 'B13', sourceMedia: 'image24.png' },
  { assetId: 'JLY-MAT-EBONY-V001', name: 'Ebony', nameZh: '黑檀', previewFile: 'JLY-MAT-EBONY-V001.jpg', sourceCell: 'B10', sourceMedia: 'image17.png' },
  { assetId: 'JLY-MAT-MAPLE-V001', name: 'Maple', nameZh: '枫木', previewFile: 'JLY-MAT-MAPLE-V001.jpg', sourceCell: 'B15', sourceMedia: 'image28.png' },
  { assetId: 'JLY-MAT-BOCOTE-V001', name: 'Bocote', nameZh: '可可木', previewFile: 'JLY-MAT-BOCOTE-V001.jpg', sourceCell: 'B20', sourceMedia: 'image42.png' },
  { assetId: 'JLY-MAT-PEACOCK-V001', name: 'Peacock wood', nameZh: '孔雀木', previewFile: 'JLY-MAT-PEACOCK-V001.jpg', sourceCell: 'B9', sourceMedia: 'image16.png' },
  { assetId: 'JLY-MAT-SNAKEWOOD-INLAY-V001', name: 'Snakewood eight-point', nameZh: '蛇纹木八插', previewFile: 'JLY-MAT-SNAKEWOOD-INLAY-V001.jpg', sourceCell: 'B12', sourceMedia: 'image23.png' },
  { assetId: 'JLY-MAT-TECHWOOD-TULIP-V001', name: 'Techwood tulip', nameZh: '科技木郁金香', previewFile: 'JLY-MAT-TECHWOOD-TULIP-V001.jpg', sourceCell: 'B5', sourceMedia: 'image8.jpeg' },
  { assetId: 'JLY-MAT-HUANGHUALI-V001', name: 'Hainan huanghuali', nameZh: '海南黄花梨', previewFile: 'JLY-MAT-HUANGHUALI-V001.jpg', sourceCell: 'B21', sourceMedia: 'image43.png' },
  { assetId: 'JLY-MAT-BRAZILIAN-ROSEWOOD-V001', name: 'Brazilian rosewood', nameZh: '巴西花梨木', previewFile: 'JLY-MAT-BRAZILIAN-ROSEWOOD-V001.jpg', sourceCell: 'B27', sourceMedia: 'image52.png' },
  { assetId: 'JLY-MAT-MICROCONCAVE-ROSEWOOD-V001', name: 'Microconcave rosewood', nameZh: '微凹黄檀', previewFile: 'JLY-MAT-MICROCONCAVE-ROSEWOOD-V001.jpg', sourceCell: 'B30', sourceMedia: 'image59.png' },
  { assetId: 'JLY-MAT-GOLDEN-CAMPHOR-V001', name: 'Golden camphor', nameZh: '黄金樟', previewFile: 'JLY-MAT-GOLDEN-CAMPHOR-V001.jpg', sourceCell: 'B24', sourceMedia: 'image47.png' },
  { assetId: 'JLY-MAT-DRAGON-SCALE-INLAY-V001', name: 'Dragon-scale inlay', nameZh: '龙鳞插片', previewFile: 'JLY-MAT-DRAGON-SCALE-INLAY-V001.jpg', sourceCell: 'B22', sourceMedia: 'image45.png' },
  { assetId: 'JLY-MAT-BLACKWHITE-SANDAL-INLAY-V001', name: 'Black-white sandal eight-point', nameZh: '黑白檀高插', previewFile: 'JLY-MAT-BLACKWHITE-SANDAL-INLAY-V001.jpg', sourceCell: 'B8', sourceMedia: 'image14.png' },
  { assetId: 'JLY-MAT-TULIP-INLAY-V001', name: 'Tulip eight-point', nameZh: '郁金香高插', previewFile: 'JLY-MAT-TULIP-INLAY-V001.jpg', sourceCell: 'B11', sourceMedia: 'image18.png' }
]

const JUNLEYUAN_ASSET_BY_ID = Object.fromEntries(JUNLEYUAN_MATERIAL_ASSETS.map((asset) => [asset.assetId, asset]))

const jlyMaterialVariant = ({ variantId, assetId, displayName, displayNameZh, slot = 'FOREARM', color = '#a77750', materialFamily = 'wood', weightG = 0 }) => {
  const asset = JUNLEYUAN_ASSET_BY_ID[assetId]
  return {
    variantId,
    slot,
    displayName,
    displayNameZh,
    color,
    materialFamily,
    materialAssetId: assetId,
    materialPreviewUrl: `assets/junleyuan-materials/${asset?.previewFile || ''}`,
    sourceId: 'SRC-SUPPLIER-JLY-MATERIAL-WORKBOOK-20260813',
    sourceCell: asset?.sourceCell || '',
    sourceMedia: asset?.sourceMedia || '',
    assetStatus: 'candidate',
    priceLabel: 'RFQ',
    priceDelta: 0,
    weightG,
    approved: false
  }
}

export const BASE_MODELS = PRODUCT_FAMILIES.map((family) => ({
  ...family,
  id: `BASE-${family.id.toUpperCase()}-OEM-P01`,
  slot: 'CUE_ROOT',
  variantId: `BASE-${family.id.toUpperCase()}-OEM-P01`,
  displayName: `${family.name} / OEM-P01`,
  displayNameZh: `${family.nameZh} / OEM-P01`,
  materialAssetId: 'JLY-MAT-MAPLE-V001',
  materialPreviewUrl: 'assets/junleyuan-materials/JLY-MAT-MAPLE-V001.jpg',
  sourceId: 'SRC-SUPPLIER-JLY-MATERIAL-WORKBOOK-20260813',
  geometryAssetId: 'GEO_PROTO_CUE_PARAMETRIC_V001',
  priceDelta: family.priceDelta,
  leadTimeDays: family.leadTimeDays,
  approved: false
}))

export const COMPONENT_VARIANTS = {
  TIP: [
    { variantId: 'TIP-LAYERED-MEDIUM-01', slot: 'TIP', displayName: 'Layered leather / medium', displayNameZh: '复合皮头 / 中硬', color: '#d8c3a5', diameterMm: 12.25, priceDelta: 0, weightG: 1, approved: false },
    { variantId: 'TIP-LAYERED-MEDIUM-1175-01', slot: 'TIP', displayName: 'Layered leather / 11.75 mm', displayNameZh: '复合皮头 / 11.75 mm', color: '#cbb18f', diameterMm: 11.75, priceDelta: 8, weightG: 1, approved: false },
    { variantId: 'TIP-PHENOLIC-HARD-01', slot: 'TIP', displayName: 'Phenolic / hard', displayNameZh: '酚醛 / 硬', color: '#eee7d5', diameterMm: 12.75, priceDelta: 18, weightG: 1, approved: false }
  ],
  FERRULE: [
    { variantId: 'FERRULE-IVORY-10', slot: 'FERRULE', displayName: 'Ivory tone / 10 mm', displayNameZh: '象牙白 / 10 mm', color: '#f1ead8', lengthMm: 10, priceDelta: 0, weightG: 2, approved: false },
    { variantId: 'FERRULE-COMPOSITE-10', slot: 'FERRULE', displayName: 'Composite / 10 mm', displayNameZh: '复合材料 / 10 mm', color: '#d8dde0', lengthMm: 10, priceDelta: 12, weightG: 2, approved: false }
  ],
  SHAFT: [
    { variantId: 'SHAFT-MAPLE-125-JF01', slot: 'SHAFT', displayName: 'Hard maple / 12.5 mm / JF01', displayNameZh: '硬枫木 / 12.5 mm / JF01', color: '#d8b887', materialFamily: 'maple', allowedTipDiameters: [12.25, 12.75], jointFamilyIds: ['JF01'], priceDelta: 0, weightG: 125, lengthMm: 737, approved: false },
    { variantId: 'SHAFT-CARBON-125-JF01', slot: 'SHAFT', displayName: 'Matte carbon / 12.5 mm / JF01', displayNameZh: '哑光碳纤维 / 12.5 mm / JF01', color: '#31353a', materialFamily: 'carbon', allowedTipDiameters: [12.25, 12.75], jointFamilyIds: ['JF01'], priceDelta: 180, weightG: 115, lengthMm: 737, approved: false },
    { variantId: 'SHAFT-MAPLE-1175-JF02', slot: 'SHAFT', displayName: 'Hard maple / 11.75 mm / JF02', displayNameZh: '硬枫木 / 11.75 mm / JF02', color: '#caa371', materialFamily: 'maple', allowedTipDiameters: [11.75], jointFamilyIds: ['JF02'], priceDelta: 35, weightG: 120, lengthMm: 737, approved: false }
  ],
  JOINT: [
    { variantId: 'JOINT-JF01-SS', slot: 'JOINT', displayName: 'JF01 / stainless collar', displayNameZh: 'JF01 / 不锈钢接环', color: '#a9b0b3', jointFamily: 'JF01', materialFamily: 'stainless_steel', priceDelta: 0, weightG: 18, approved: false },
    { variantId: 'JOINT-JF02-BRASS', slot: 'JOINT', displayName: 'JF02 / brass collar', displayNameZh: 'JF02 / 黄铜接环', color: '#b18a4b', jointFamily: 'JF02', materialFamily: 'brass', priceDelta: 32, weightG: 20, approved: false }
  ],
  FOREARM: [
    { variantId: 'WOOD-MAPLE-NAT-01', slot: 'FOREARM', displayName: 'Birdseye maple / natural', displayNameZh: '鸟眼枫 / 原色', color: '#c89b63', materialAssetId: 'JLY-MAT-MAPLE-V001', materialPreviewUrl: 'assets/junleyuan-materials/JLY-MAT-MAPLE-V001.jpg', sourceId: 'SRC-SUPPLIER-JLY-MATERIAL-WORKBOOK-20260813', sourceCell: 'B15', assetStatus: 'candidate', priceDelta: 0, weightG: 210, approved: false },
    { variantId: 'WOOD-EBONY-DARK-01', slot: 'FOREARM', displayName: 'Ebony / satin black', displayNameZh: '乌木 / 哑光黑', color: '#252322', materialAssetId: 'JLY-MAT-EBONY-V001', materialPreviewUrl: 'assets/junleyuan-materials/JLY-MAT-EBONY-V001.jpg', sourceId: 'SRC-SUPPLIER-JLY-MATERIAL-WORKBOOK-20260813', sourceCell: 'B10', assetStatus: 'candidate', priceDelta: 120, weightG: 235, approved: false },
    { variantId: 'WOOD-BOCOTE-CLR-01', slot: 'FOREARM', displayName: 'Bocote / clear coat', displayNameZh: '可可木 / 透明漆', color: '#80573d', materialAssetId: 'JLY-MAT-BOCOTE-V001', materialPreviewUrl: 'assets/junleyuan-materials/JLY-MAT-BOCOTE-V001.jpg', sourceId: 'SRC-SUPPLIER-JLY-MATERIAL-WORKBOOK-20260813', sourceCell: 'B20', assetStatus: 'candidate', priceDelta: 160, weightG: 225, approved: false },
    jlyMaterialVariant({ variantId: 'WOOD-PURPLEHEART-JLY-01', assetId: 'JLY-MAT-PURPLEHEART-ROD-V001', displayName: 'Purpleheart / factory sample', displayNameZh: '紫心木 / 工厂样本', color: '#714257', weightG: 220 }),
    jlyMaterialVariant({ variantId: 'WOOD-PEACOCK-JLY-01', assetId: 'JLY-MAT-PEACOCK-V001', displayName: 'Peacock wood / factory sample', displayNameZh: '孔雀木 / 工厂样本', color: '#3d715f', weightG: 220 }),
    jlyMaterialVariant({ variantId: 'WOOD-HUANGHUALI-JLY-01', assetId: 'JLY-MAT-HUANGHUALI-V001', displayName: 'Hainan huanghuali / sample', displayNameZh: '海南黄花梨 / 样本', color: '#8b5a35', weightG: 220 }),
    jlyMaterialVariant({ variantId: 'WOOD-BRAZILIAN-ROSEWOOD-JLY-01', assetId: 'JLY-MAT-BRAZILIAN-ROSEWOOD-V001', displayName: 'Brazilian rosewood / sample', displayNameZh: '巴西花梨木 / 样本', color: '#835044', weightG: 220 }),
    jlyMaterialVariant({ variantId: 'WOOD-MICROCONCAVE-ROSEWOOD-JLY-01', assetId: 'JLY-MAT-MICROCONCAVE-ROSEWOOD-V001', displayName: 'Microconcave rosewood / sample', displayNameZh: '微凹黄檀 / 样本', color: '#6e4939', weightG: 220 }),
    jlyMaterialVariant({ variantId: 'WOOD-GOLDEN-CAMPHOR-JLY-01', assetId: 'JLY-MAT-GOLDEN-CAMPHOR-V001', displayName: 'Golden camphor / sample', displayNameZh: '黄金樟 / 样本', color: '#a77b39', weightG: 220 })
  ],
  INLAY: [
    { variantId: 'INLAY-NONE-01', slot: 'INLAY', displayName: 'No inlay', displayNameZh: '无镶嵌', color: '#8b6a4d', materialFamily: 'none', priceDelta: 0, weightG: 0, approved: false },
    jlyMaterialVariant({ variantId: 'INLAY-TECHWOOD-TULIP-JLY-01', assetId: 'JLY-MAT-TECHWOOD-TULIP-V001', displayName: 'Techwood tulip / sample', displayNameZh: '科技木郁金香 / 样本', slot: 'INLAY', color: '#b84154', materialFamily: 'inlay', weightG: 8 }),
    jlyMaterialVariant({ variantId: 'INLAY-SNAKEWOOD-8POINT-JLY-01', assetId: 'JLY-MAT-SNAKEWOOD-INLAY-V001', displayName: 'Snakewood eight-point / sample', displayNameZh: '蛇纹木八插 / 样本', slot: 'INLAY', color: '#6e382d', materialFamily: 'inlay', weightG: 8 }),
    jlyMaterialVariant({ variantId: 'INLAY-BLACKWHITE-SANDAL-JLY-01', assetId: 'JLY-MAT-BLACKWHITE-SANDAL-INLAY-V001', displayName: 'Black-white sandal / sample', displayNameZh: '黑白檀高插 / 样本', slot: 'INLAY', color: '#d0b897', materialFamily: 'inlay', weightG: 8 }),
    jlyMaterialVariant({ variantId: 'INLAY-DRAGON-SCALE-JLY-01', assetId: 'JLY-MAT-DRAGON-SCALE-INLAY-V001', displayName: 'Dragon-scale / sample', displayNameZh: '龙鳞插片 / 样本', slot: 'INLAY', color: '#b14d3e', materialFamily: 'inlay', weightG: 8 }),
    jlyMaterialVariant({ variantId: 'INLAY-TULIP-8POINT-JLY-01', assetId: 'JLY-MAT-TULIP-INLAY-V001', displayName: 'Tulip eight-point / sample', displayNameZh: '郁金香高插 / 样本', slot: 'INLAY', color: '#a77b52', materialFamily: 'inlay', weightG: 8 })
  ],
  HANDLE: [
    { variantId: 'HANDLE-MAPLE-NAT-01', slot: 'HANDLE', displayName: 'Maple handle core', displayNameZh: '枫木握把基体', color: '#b98251', priceDelta: 0, weightG: 95, approved: false },
    { variantId: 'HANDLE-EBONY-DARK-01', slot: 'HANDLE', displayName: 'Ebony handle core', displayNameZh: '乌木握把基体', color: '#282524', priceDelta: 80, weightG: 120, approved: false }
  ],
  WRAP: [
    { variantId: 'WRAP-NONE-01', slot: 'WRAP', displayName: 'No wrap', displayNameZh: '无缠把', color: '#7d5436', materialFamily: 'none', priceDelta: 0, weightG: 0, approved: false },
    { variantId: 'WRAP-LINEN-BLK-01', slot: 'WRAP', displayName: 'Irish linen / black', displayNameZh: '爱尔兰麻 / 黑色', color: '#24282b', materialFamily: 'linen', priceDelta: 24, weightG: 12, approved: false },
    { variantId: 'WRAP-LEATHER-BRN-01', slot: 'WRAP', displayName: 'Leather / saddle brown', displayNameZh: '皮革 / 马鞍棕', color: '#7a4930', materialFamily: 'leather', priceDelta: 75, weightG: 28, approved: false }
  ],
  BUTT_SLEEVE: [
    { variantId: 'WOOD-WALNUT-DARK-01', slot: 'BUTT_SLEEVE', displayName: 'Walnut / dark clear coat', displayNameZh: '胡桃木 / 深色透明漆', color: '#4a2b21', materialAssetId: 'MAT_PROTO_WALNUT_CLR_V001', priceDelta: 40, weightG: 175, approved: false },
    { variantId: 'WOOD-EBONY-SATIN-01', slot: 'BUTT_SLEEVE', displayName: 'Ebony / satin', displayNameZh: '乌木 / 哑光', color: '#211f1e', materialAssetId: 'JLY-MAT-EBONY-V001', materialPreviewUrl: 'assets/junleyuan-materials/JLY-MAT-EBONY-V001.jpg', sourceId: 'SRC-SUPPLIER-JLY-MATERIAL-WORKBOOK-20260813', sourceCell: 'B10', assetStatus: 'candidate', priceDelta: 120, weightG: 195, approved: false },
    { variantId: 'WOOD-BIRDSEYE-NAT-01', slot: 'BUTT_SLEEVE', displayName: 'Maple / natural sample', displayNameZh: '枫木 / 原色样本', color: '#bd8e5d', materialAssetId: 'JLY-MAT-MAPLE-V001', materialPreviewUrl: 'assets/junleyuan-materials/JLY-MAT-MAPLE-V001.jpg', sourceId: 'SRC-SUPPLIER-JLY-MATERIAL-WORKBOOK-20260813', sourceCell: 'B15', assetStatus: 'candidate', priceDelta: 70, weightG: 165, approved: false },
    jlyMaterialVariant({ variantId: 'WOOD-HUANGHUALI-BUTT-JLY-01', assetId: 'JLY-MAT-HUANGHUALI-V001', displayName: 'Hainan huanghuali / sample', displayNameZh: '海南黄花梨 / 样本', color: '#8b5a35', slot: 'BUTT_SLEEVE', weightG: 180 }),
    jlyMaterialVariant({ variantId: 'WOOD-BRAZILIAN-ROSEWOOD-BUTT-JLY-01', assetId: 'JLY-MAT-BRAZILIAN-ROSEWOOD-V001', displayName: 'Brazilian rosewood / sample', displayNameZh: '巴西花梨木 / 样本', color: '#835044', slot: 'BUTT_SLEEVE', weightG: 180 }),
    jlyMaterialVariant({ variantId: 'WOOD-GOLDEN-CAMPHOR-BUTT-JLY-01', assetId: 'JLY-MAT-GOLDEN-CAMPHOR-V001', displayName: 'Golden camphor / sample', displayNameZh: '黄金樟 / 样本', color: '#a77b39', slot: 'BUTT_SLEEVE', weightG: 180 })
  ],
  BUTT_PLATE: [
    { variantId: 'BUTT-PLATE-BLK-01', slot: 'BUTT_PLATE', displayName: 'Black polymer', displayNameZh: '黑色聚合物', color: '#17191b', priceDelta: 0, weightG: 8, approved: false },
    { variantId: 'BUTT-PLATE-SS-01', slot: 'BUTT_PLATE', displayName: 'Stainless steel', displayNameZh: '不锈钢', color: '#a9b0b3', priceDelta: 35, weightG: 20, approved: false }
  ],
  WEIGHT_SYSTEM: [
    { variantId: 'WEIGHT-19OZ-01', slot: 'WEIGHT_SYSTEM', displayName: 'Target 19 oz', displayNameZh: '目标 19 oz', weightOz: 19, priceDelta: 0, weightG: 539, approved: false },
    { variantId: 'WEIGHT-20OZ-01', slot: 'WEIGHT_SYSTEM', displayName: 'Target 20 oz', displayNameZh: '目标 20 oz', weightOz: 20, priceDelta: 10, weightG: 567, approved: false },
    { variantId: 'WEIGHT-21OZ-01', slot: 'WEIGHT_SYSTEM', displayName: 'Target 21 oz', displayNameZh: '目标 21 oz', weightOz: 21, priceDelta: 20, weightG: 595, approved: false }
  ],
  BUMPER: [
    { variantId: 'BUMPER-STANDARD-01', slot: 'BUMPER', displayName: 'Standard bumper', displayNameZh: '标准胶塞', color: '#191b1e', priceDelta: 0, weightG: 10, extensionInterface: 'EXT-JF01-01', approved: false },
    { variantId: 'BUMPER-EXT-READY-01', slot: 'BUMPER', displayName: 'Extension-ready bumper', displayNameZh: '延长把兼容胶塞', color: '#272a2d', priceDelta: 20, weightG: 12, extensionInterface: 'EXT-JF01-01', approved: false }
  ],
  EXTENSION_INTERFACE: [
    { variantId: 'EXT-NONE-01', slot: 'EXTENSION_INTERFACE', displayName: 'No extension interface', displayNameZh: '无延长把接口', color: '#202226', priceDelta: 0, approved: false },
    { variantId: 'EXT-JF01-01', slot: 'EXTENSION_INTERFACE', displayName: 'JF01 extension interface', displayNameZh: 'JF01 延长把接口', color: '#767d81', priceDelta: 45, approved: false }
  ]
}

export const DEFAULT_COMPONENTS = {
  TIP: 'TIP-LAYERED-MEDIUM-01',
  FERRULE: 'FERRULE-IVORY-10',
  SHAFT: 'SHAFT-MAPLE-125-JF01',
  JOINT: 'JOINT-JF01-SS',
  FOREARM: 'WOOD-MAPLE-NAT-01',
  INLAY: 'INLAY-NONE-01',
  HANDLE: 'HANDLE-MAPLE-NAT-01',
  WRAP: 'WRAP-LINEN-BLK-01',
  BUTT_SLEEVE: 'WOOD-WALNUT-DARK-01',
  BUTT_PLATE: 'BUTT-PLATE-BLK-01',
  WEIGHT_SYSTEM: 'WEIGHT-19OZ-01',
  BUMPER: 'BUMPER-EXT-READY-01',
  EXTENSION_INTERFACE: 'EXT-JF01-01'
}

export const PRICE_RULES = {
  baseModel: 420,
  engraving: 35,
  artworkReview: 60,
  currency: 'USD'
}

export const getVariants = (slot) => COMPONENT_VARIANTS[slot] || []

export const getVariant = (slot, variantId) => getVariants(slot).find((variant) => variant.variantId === variantId) || null

export const getBaseModel = (variantId) => BASE_MODELS.find((model) => model.variantId === variantId) || BASE_MODELS[0]
