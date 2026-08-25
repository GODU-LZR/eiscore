// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const DEMO_STORAGE_KEY = 'eiscore.factory-demo.jly-ash-onepiece.v1'
export const DEFAULT_DEMO_STEP = 5

export const DATA_STATUS = Object.freeze({
  confirmed: { label: '已确认', note: '本轮讨论已确认，可作为演示主线。' },
  demo: { label: '演示', note: '仅用于演示流程，不代表真实经营结果。' },
  pending: { label: '待确认', note: '需要工厂补充，不参与正式承诺。' }
})

export const DEMO_PRODUCT = Object.freeze({
  orderNo: 'SO-DEMO-20260818-001',
  traceNo: 'TRACE-JLY-ASH-001',
  productCode: 'JLY-CUE-ASH-ONEPIECE-001',
  productName: '白蜡木纯木纹透明哑光通杆',
  customerName: '君乐缘球房',
  customerType: '球房批量采购',
  quantity: 20,
  leadTimeDays: 30,
  structure: '通杆',
  primaryMaterial: '白蜡木',
  appearance: '纯木纹',
  finish: '透明哑光',
  price: '待报价',
  sourceStatus: 'confirmed'
})

export const MODULE_ROUTES = Object.freeze({
  site: '/company/',
  sales: '/sales/cockpit',
  purchase: '/purchase/dashboard',
  warehouse: '/materials/inventory-dashboard',
  production: '/production/overview',
  bom: '/production/bom',
  quality: '/quality/dashboard',
  equipment: '/equipment/dashboard'
})

export const DEMO_ROLES = Object.freeze([
  { id: 'owner', label: '老板', focus: '订单、风险与跨部门协同', modules: ['sales', 'purchase', 'warehouse', 'production', 'quality', 'equipment'] },
  { id: 'sales', label: '销售', focus: '询盘、报价、合同与交付', modules: ['sales'] },
  { id: 'purchase', label: '采购', focus: '缺料、采购申请与到货', modules: ['purchase', 'warehouse'] },
  { id: 'production', label: '生产', focus: '排单、工序与在制进度', modules: ['production', 'equipment'] },
  { id: 'quality', label: '质检', focus: '来料、过程、涂装与终检', modules: ['quality'] },
  { id: 'warehouse', label: '仓储', focus: '原料、在制、成品与发货', modules: ['warehouse'] },
  { id: 'equipment', label: '设备', focus: '工作中心状态、停机与保养', modules: ['equipment'] }
])

export const WORKFLOW_STEPS = Object.freeze([
  { id: 'inquiry', day: 1, module: 'sales', short: '询盘', title: '独立站询盘进入', owner: '销售', detail: '识别为球房批量采购，数量 20 支。', sourceStatus: 'demo' },
  { id: 'quote', day: 2, module: 'sales', short: '报价', title: '生成报价草稿', owner: '销售', detail: '价格保持待报价，需人工确认后进入合同。', sourceStatus: 'pending' },
  { id: 'order', day: 3, module: 'sales', short: '订单', title: '确认演示订单', owner: '销售', detail: '订单数量 20 支，演示交期 30 天。', sourceStatus: 'confirmed' },
  { id: 'shortage', day: 4, module: 'purchase', short: '缺料', title: '库存检查与采购申请', owner: '采购 / 仓储', detail: '演示库存不足，系统生成缺料建议但不自动下单。', sourceStatus: 'demo' },
  { id: 'material', day: 8, module: 'warehouse', short: '备料', title: '木料到货与来料检', owner: '仓储 / 质检', detail: '白蜡木按演示批次入库并完成来料检。', sourceStatus: 'demo' },
  { id: 'production', day: 20, module: 'production', short: '生产', title: '三工作中心执行', owner: '生产 / 设备', detail: '车削、打磨、喷涂固化按演示排程推进。', sourceStatus: 'demo' },
  { id: 'quality', day: 27, module: 'quality', short: '终检', title: '终检与返工闭环', owner: '质检 / 生产', detail: '演示 18 支合格、2 支返工，数值不代表真实良率。', sourceStatus: 'demo' },
  { id: 'inbound', day: 28, module: 'warehouse', short: '入库', title: '成品入库与包装', owner: '仓储', detail: '终检完成后按成品序列号入库。', sourceStatus: 'demo' },
  { id: 'delivery', day: 30, module: 'sales', short: '交付', title: '发货与售后跟进', owner: '销售 / 仓储', detail: '发货信息和售后结果仍需真实订单补充。', sourceStatus: 'pending' }
])

export const BOM_ITEMS = Object.freeze([
  { code: 'MAT-ASH-BLANK', name: '白蜡木通杆坯', category: '主材', unitQty: '1 根', orderQty: '20 根', operation: '木料验收 / 车削', sourceStatus: 'confirmed' },
  { code: 'MAT-TIP-PENDING', name: '皮头', category: '功能件', unitQty: '1 个', orderQty: '20 个', operation: '皮头安装', sourceStatus: 'pending' },
  { code: 'MAT-FERRULE-PENDING', name: '先角', category: '功能件', unitQty: '1 个', orderQty: '20 个', operation: '先角安装', sourceStatus: 'pending' },
  { code: 'MAT-TAIL-PENDING', name: '尾部组件 / 胶塞', category: '功能件', unitQty: '1 套', orderQty: '20 套', operation: '尾部装配', sourceStatus: 'pending' },
  { code: 'MAT-SEALER-PENDING', name: '透明封闭底涂', category: '涂装辅料', unitQty: '待确认', orderQty: '待确认', operation: '封闭底涂', sourceStatus: 'pending' },
  { code: 'MAT-MATTE-PENDING', name: '透明哑光面涂', category: '涂装辅料', unitQty: '待确认', orderQty: '待确认', operation: '哑光面涂', sourceStatus: 'confirmed' },
  { code: 'MAT-SANDING-PENDING', name: '打磨耗材', category: '加工辅料', unitQty: '待确认', orderQty: '待确认', operation: '精细打磨', sourceStatus: 'pending' },
  { code: 'PACK-CUE-PENDING', name: '保护套、标签与外包装', category: '包装', unitQty: '1 套', orderQty: '20 套', operation: '包装入库', sourceStatus: 'pending' }
])

export const PRODUCTION_OPERATIONS = Object.freeze([
  { no: '10', name: '木料验收与分级', center: '原材料区', window: '第 4–8 天', standard: '木纹、缺陷和含水标准待确认', sourceStatus: 'pending' },
  { no: '20', name: '粗车、静置与校直', center: '车削加工中心', window: '第 9–14 天', standard: '静置周期和校直方法待确认', sourceStatus: 'demo' },
  { no: '30', name: '精车与锥度成形', center: '车削加工中心', window: '第 15–20 天', standard: '长度、杆径、锥度和直线度公差待确认', sourceStatus: 'pending' },
  { no: '40', name: '皮头、先角与尾部装配', center: '装配工位', window: '第 21 天', standard: '型号与装配标准待确认', sourceStatus: 'pending' },
  { no: '50', name: '精细打磨', center: '打磨处理中心', window: '第 21–22 天', standard: '砂纸目数和表面标准待确认', sourceStatus: 'pending' },
  { no: '60', name: '透明哑光涂装与固化', center: '喷涂固化中心', window: '第 23–25 天', standard: '涂层参数和固化时间待确认', sourceStatus: 'pending' },
  { no: '70', name: '成品终检与返工', center: '质检区', window: '第 26–27 天', standard: '按四道质量关卡执行', sourceStatus: 'confirmed' },
  { no: '80', name: '包装与成品入库', center: '成品区', window: '第 28 天', standard: '包装明细待确认', sourceStatus: 'pending' }
])

export const WORK_CENTERS = Object.freeze([
  { id: 'turning', name: '车削加工中心', equipmentNo: '待采集', responsibility: '粗车、校直、精车与锥度', sourceStatus: 'confirmed' },
  { id: 'sanding', name: '打磨处理中心', equipmentNo: '待采集', responsibility: '精细打磨与表面准备', sourceStatus: 'confirmed' },
  { id: 'coating', name: '喷涂固化中心', equipmentNo: '待采集', responsibility: '透明底涂、哑光面涂与固化', sourceStatus: 'confirmed' }
])

export const QUALITY_GATES = Object.freeze([
  { id: 'incoming', name: '白蜡木来料检', checks: '木纹、结疤、色差、含水状态', owner: '来料质检', sourceStatus: 'confirmed' },
  { id: 'machining', name: '精车后过程检', checks: '直线度、长度、杆径、锥度', owner: '过程质检', sourceStatus: 'confirmed' },
  { id: 'coating', name: '涂装后检', checks: '哑光一致性、露底、颗粒、流挂、木纹可见度', owner: '过程质检', sourceStatus: 'confirmed' },
  { id: 'final', name: '成品终检', checks: '重量、重心、皮头、表面、外观和包装', owner: '成品质检', sourceStatus: 'confirmed' }
])

export const WAREHOUSE_ZONES = Object.freeze([
  { id: 'raw', name: '原材料区', responsibility: '白蜡木杆坯与来料待检', sourceStatus: 'confirmed' },
  { id: 'wip', name: '在制品区', responsibility: '按工序与批次存放在制杆', sourceStatus: 'confirmed' },
  { id: 'finished', name: '成品区', responsibility: '按序列号存放合格成品', sourceStatus: 'confirmed' },
  { id: 'auxiliary', name: '辅料区', responsibility: '皮头、先角、涂装和包装辅料', sourceStatus: 'confirmed' }
])

const clampStep = (value) => Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, Number(value) || 0))

const statusForStep = (index, activeStep) => index < activeStep ? 'done' : index === activeStep ? 'active' : 'queued'

export const createDemoSnapshot = (step = DEFAULT_DEMO_STEP) => {
  const activeStep = clampStep(step)
  const stage = WORKFLOW_STEPS[activeStep]
  const atQuality = activeStep >= 6
  const inbound = activeStep >= 7
  const delivered = activeStep >= 8
  const materialReady = activeStep >= 4
  const inProduction = activeStep === 5
  const progress = Math.round((activeStep / (WORKFLOW_STEPS.length - 1)) * 100)

  return {
    activeStep,
    stage,
    progress,
    day: stage.day,
    workflow: WORKFLOW_STEPS.map((item, index) => ({ ...item, index, status: statusForStep(index, activeStep) })),
    metrics: {
      orderQuantity: DEMO_PRODUCT.quantity,
      materialGap: materialReady ? 0 : 8,
      workInProgress: inProduction ? 20 : atQuality && !inbound ? 2 : 0,
      passedQuantity: atQuality ? 18 : 0,
      reworkQuantity: atQuality && !inbound ? 2 : 0,
      finishedStock: inbound ? 20 : 0,
      deliveredQuantity: delivered ? 20 : 0
    },
    procurement: {
      requestNo: 'PR-DEMO-ASH-001',
      requestedQuantity: '演示缺口 8 根',
      supplier: '待确认',
      status: materialReady ? '演示到货完成' : activeStep >= 3 ? '演示采购处理中' : '等待库存检查',
      sourceStatus: 'demo'
    },
    equipment: WORK_CENTERS.map((center, index) => ({
      ...center,
      state: inProduction ? (index === 0 ? '演示运行' : index === 1 ? '等待工序' : '待机') : atQuality ? '待机' : '等待排产',
      maintenance: index === 0 ? '演示：7 天后点检' : '保养周期待确认'
    })),
    quality: QUALITY_GATES.map((gate, index) => ({
      ...gate,
      state: activeStep < 4 ? '等待' : index === 0 ? '演示合格' : activeStep < 6 ? (index === 1 && inProduction ? '演示检验中' : '等待') : index < 3 ? '演示合格' : atQuality ? '演示：18 合格 / 2 返工' : '等待'
    })),
    warehouse: WAREHOUSE_ZONES.map((zone) => ({
      ...zone,
      quantity: zone.id === 'raw' ? (materialReady && !inProduction && !atQuality ? '演示 20 根' : '演示 0 根') : zone.id === 'wip' ? (inProduction ? '演示 20 支' : atQuality && !inbound ? '演示 2 支返工' : '演示 0 支') : zone.id === 'finished' ? (inbound ? '演示 20 支' : '演示 0 支') : '数量待确认'
    })),
    risks: [
      { id: 'price', level: 'pending', title: '价格尚未确认', owner: '销售', action: '补充正式报价与审批依据' },
      ...(!materialReady ? [{ id: 'material', level: 'warning', title: '演示缺料 8 根', owner: '采购 / 仓储', action: '处理采购申请并完成来料检' }] : []),
      { id: 'spec', level: 'pending', title: '尺寸、容差和工时待采集', owner: '生产 / 质检', action: '补齐真实工艺与检验标准' },
      ...(atQuality && !inbound ? [{ id: 'rework', level: 'danger', title: '演示 2 支待返工', owner: '生产 / 质检', action: '关闭返工记录后允许入库' }] : []),
      { id: 'equipment', level: 'pending', title: '设备编号与产能待采集', owner: '设备', action: '补齐设备台账与保养周期' }
    ],
    nextAction: activeStep < WORKFLOW_STEPS.length - 1 ? WORKFLOW_STEPS[activeStep + 1] : null
  }
}

export const validateDemoModel = () => {
  const issues = []
  if (DEMO_PRODUCT.quantity !== 20) issues.push('ORDER_QUANTITY_INVALID')
  if (DEMO_PRODUCT.leadTimeDays !== 30) issues.push('LEAD_TIME_INVALID')
  if (DEMO_PRODUCT.structure !== '通杆') issues.push('PRODUCT_STRUCTURE_INVALID')
  if (DEMO_PRODUCT.primaryMaterial !== '白蜡木') issues.push('PRIMARY_MATERIAL_INVALID')
  if (DEMO_PRODUCT.appearance !== '纯木纹' || DEMO_PRODUCT.finish !== '透明哑光') issues.push('FINISH_INVALID')
  if (DEMO_PRODUCT.price !== '待报价') issues.push('PRICE_MUST_REMAIN_PENDING')
  if (WORK_CENTERS.length !== 3) issues.push('WORK_CENTER_COUNT_INVALID')
  if (QUALITY_GATES.length !== 4) issues.push('QUALITY_GATE_COUNT_INVALID')
  if (WAREHOUSE_ZONES.length !== 4) issues.push('WAREHOUSE_ZONE_COUNT_INVALID')
  if (WORKFLOW_STEPS.some((item) => !DATA_STATUS[item.sourceStatus])) issues.push('WORKFLOW_SOURCE_STATUS_INVALID')
  if (BOM_ITEMS.some((item) => !DATA_STATUS[item.sourceStatus])) issues.push('BOM_SOURCE_STATUS_INVALID')
  return issues
}
