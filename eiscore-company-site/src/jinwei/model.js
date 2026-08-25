// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const JINWEI_DEMO_STORAGE_KEY = 'eiscore.jinwei.manufacturing-demo.v1'
export const JINWEI_DEFAULT_STEP = 3

export const JINWEI_SOURCE_STATUS = Object.freeze({
  observed: { label: '现场证据', note: '由调研照片或现场记录直接证实。' },
  workbook: { label: '历史样表', note: '来自历史排产 Excel 的字段或流程。' },
  demo: { label: '演示', note: '仅用于验证交互和流程，不代表真实经营数据。' },
  pending: { label: '待确认', note: '需经纬网厂业务负责人确认后才能进入正式主数据。' }
})

export const JINWEI_RESEARCH_SUMMARY = Object.freeze({
  totalFiles: 80,
  uniqueFiles: 77,
  images: 72,
  uniqueImages: 70,
  wordReports: 3,
  uniqueWordReports: 2,
  workbooks: 4,
  legacyProcessDocuments: 1
})

// Publicly verifiable references used as an implementation baseline. These are
// not certificates or a claim that every product is already compliant.
export const JINWEI_COMPLIANCE_STANDARDS = Object.freeze([
  {
    code: 'GB/T 18673-2024',
    title: '渔用机织网片',
    status: '现行',
    effectiveDate: '2024-10-01',
    source: '国家标准全文公开系统',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=665D978DF8B22C3BE52CEFA6704FEF55',
    implementationUse: '建立有结/无结网片的规格版本、批次检验和放行字段。'
  },
  {
    code: 'GB/T 6964-2010',
    title: '渔网网目尺寸测量方法',
    status: '现行',
    effectiveDate: '2011-05-01',
    source: '国家标准全文公开系统',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=7BB234C1FA2B3F0FEC0A3538B32709E4',
    implementationUse: '把网眼/目数的测量方法、单位和抽检结果纳入质量记录。'
  },
  {
    code: 'GB/T 30892-2014',
    title: '渔网 有结网片的类型和标示',
    status: '现行',
    effectiveDate: '2015-03-01',
    source: '国家标准全文公开系统',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=81796775CF10D659CE460D7F22DC0DE2',
    implementationUse: '规范有结网片的类型、标示和规格版本字段，供报价与包装标签复用。'
  },
  {
    code: 'GB/T 4925-2008',
    title: '渔网 合成纤维网片强力与断裂伸长率试验方法',
    status: '现行',
    effectiveDate: '2008-12-01',
    source: '国家标准全文公开系统',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=8796138D4FB4F343AB05BCF5AC325C8F',
    implementationUse: '为合成纤维网片的强力、断裂伸长率检验项目预留方法和结果字段。'
  },
  {
    code: 'GB/T 21292-2007',
    title: '渔网 网目断裂强力的测定',
    status: '现行',
    effectiveDate: '2008-03-01',
    source: '国家标准全文公开系统',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=60896C275AB3382C21422C8E5BB8FE6C',
    implementationUse: '为网目断裂强力抽检、样品编号和质量放行建立可追溯记录。'
  },
  {
    code: 'GB/T 18674-2018',
    title: '渔用绳索通用技术条件',
    status: '现行',
    effectiveDate: '2018-09-01',
    source: '国家标准全文公开系统',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=3D3C89BEA1EFBDB54F6955B85D6C3CB7',
    implementationUse: '为绳索规格、重量/长度、检验和包装单元建立产品族字段。'
  },
  {
    code: 'GB/T 40749-2021',
    title: '海水重力式网箱设计技术规范',
    status: '现行',
    effectiveDate: '2022-05-01',
    source: '国家标准全文公开系统',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=11AFAF25435392CC266948C4358DAD2B',
    implementationUse: '为养殖网箱 BOM、框架/浮子/连接件和整体检验建立设计输入清单。'
  }
])

// Online research is intentionally separated from the local photo/workbook
// evidence. Secondary summaries remain pending until the factory confirms them.
export const JINWEI_EXTERNAL_RESEARCH = Object.freeze([
  {
    id: 'official-line-expansion-approval',
    tier: 'official',
    title: '制线生产线扩建项目环评批复',
    publishedAt: '2026-02-26',
    finding: '建设单位为湛江市经纬网厂，地点为湛江经济技术开发区东海岛中线公路民安渔网工业城北侧、规划科技大道南侧，批复文号湛开环建〔2026〕4号。',
    url: 'https://www.zhanjiang.gov.cn/zdlyxxgk/sthj/jsxmhjyx/content/post_2152033.html',
    implementationUse: '将制线/拉丝作为独立工作中心，先采集原料批次、机台、温度和产出重量。'
  },
  {
    id: 'official-line-expansion-acceptance',
    tier: 'official',
    title: '制线生产线扩建环评受理公告',
    publishedAt: '2025-11-25',
    finding: '公告记载项目建设地点为开发区东海岛民安中线公路渔网工业城北侧规划科技大道南侧车间，环评单位为湛江天惠生态环境有限公司。',
    url: 'https://www.zhanjiang.gov.cn/zdlyxxgk/sthj/jsxmhjyx/content/post_2121847.html',
    implementationUse: '把车间、项目和资料来源登记为主数据证据，不把环评信息当作产能承诺。'
  },
  {
    id: 'official-boiler-upgrade-approval',
    tier: 'official',
    title: '锅炉改造项目环评审批公告',
    publishedAt: '2026-08-07',
    finding: '公告记载湛江市经纬网厂锅炉改造项目，审批文号湛开环建[2026]13号，地点为开发区民安街道三角路口“调军湖”渔网工业城三号。',
    url: 'https://www.zhanjiang.gov.cn/zdlyxxgk/sthj/jsxmhjyx/content/post_2210607.html',
    implementationUse: '在设备模块预留锅炉/能源设备台账、点检、维护和能耗记录；具体参数待现场确认。'
  },
  {
    id: 'industry-cluster-report',
    tier: 'secondary',
    title: '民安渔网产业集群公开报道',
    publishedAt: '2024-11-13',
    finding: '湛江日报报道民安渔网工业区有多家市场主体及网具产业链数据；这些是产业集群统计，不是经纬网厂单厂经营数据。',
    url: 'https://www.gdzjdaily.com.cn/p/2901527.html',
    implementationUse: '用于独立站的行业背景叙事，禁止直接写成经纬网厂的企业规模、产值或专利数量。'
  },
  {
    id: 'company-registry-search-summary',
    tier: 'secondary',
    title: '企业登记搜索摘要',
    publishedAt: '待确认',
    finding: '公开搜索摘要出现成立日期、法定代表人、注册资本和经营范围等字段，但不同页面存在注册资本等信息冲突。',
    url: 'https://www.qcc.com/',
    implementationUse: '仅作为待核验线索；公司名称、英文名、联系人、注册信息不得在独立站发布，直至工厂书面确认。'
  }
])

export const JINWEI_PRODUCT_FAMILIES = Object.freeze([
  {
    id: 'knotted-net',
    name: '有结网',
    short: '有结',
    description: '支持材质、股数、网目、网眼、长宽、颜色与定型方向等组合规格。',
    route: ['制线 / 拉丝', '织网', '拼网', '补网', '执头', '染色可选', '定型', '包装'],
    asset: 'mesh-on-loom.webp',
    sourceStatus: 'workbook'
  },
  {
    id: 'knotless-net',
    name: '无结网',
    short: '无结',
    description: '以涤纶、尼龙等纱线整经后经编织造，支持硬度、颜色与多单位包装。',
    route: ['原料齐套', '整经 / 盘头', '无结织造', '补网', '染色可选', '定型', '剪断', '包装'],
    asset: 'hero-net.webp',
    sourceStatus: 'observed'
  },
  {
    id: 'rope',
    name: '绳索',
    short: '绳索',
    description: '由细丝、纱线或半成品线经并线、加捻和成绳，按规格、重量和包装单元管理。',
    route: ['原料领用', '并线', '捻线', '成绳', '检验', '盘卷', '包装'],
    asset: 'rope-coils.webp',
    sourceStatus: 'observed'
  },
  {
    id: 'cage-net',
    name: '养殖网箱',
    short: '网箱',
    description: '将网片、绳索、框架、浮子与连接件按 BOM 进行裁剪、缝合与组装。',
    route: ['网片齐套', '绳索齐套', '裁剪', '缝合', '组装', '整体检验', '包装'],
    asset: 'weaving-floor.webp',
    sourceStatus: 'workbook'
  }
])

export const JINWEI_SPEC_FIELDS = Object.freeze([
  { key: 'material', label: '材质', examples: '聚乙烯 / 尼龙 / 涤纶 / 超高分子量聚乙烯', required: true, sourceStatus: 'observed' },
  { key: 'construction', label: '网结类型', examples: '单结 / 双结 / 无结', required: true, sourceStatus: 'workbook' },
  { key: 'yarnSpec', label: '线规格', examples: 'D 数 / PLY 股数 / 捻度', required: true, sourceStatus: 'workbook' },
  { key: 'meshSize', label: '网眼 / 目数', examples: '英寸、MD 或客户指定口径', required: true, sourceStatus: 'workbook' },
  { key: 'dimensions', label: '成品尺寸', examples: '长度 x 宽度 x 深度，支持 MTRS / YDS', required: true, sourceStatus: 'workbook' },
  { key: 'color', label: '颜色', examples: '原白 / 深黑青 / 蓝 / 棕 / 客户色', required: true, sourceStatus: 'workbook' },
  { key: 'finish', label: '后处理', examples: '染色 / 硬度 / 电热或蒸汽定型', required: false, sourceStatus: 'observed' },
  { key: 'weight', label: '重量标准', examples: 'KG/PC 与允许偏差', required: true, sourceStatus: 'workbook' },
  { key: 'packing', label: '包装与唇头', examples: '条/件、袋色、印刷版、唇头、侧边编号', required: true, sourceStatus: 'workbook' }
])

export const JINWEI_ROLES = Object.freeze([
  { id: 'owner', label: '经营者', focus: '交期、阻塞与跨部门闭环', modules: ['sales', 'planning', 'warehouse', 'production', 'quality'] },
  { id: 'planner', label: '计划员', focus: '规格锁定、齐套检查与机台排程', modules: ['planning', 'warehouse', 'production'] },
  { id: 'workshop', label: '车间', focus: '待办工单、扫码过站与产量报工', modules: ['production'] },
  { id: 'warehouse', label: '仓库', focus: '合同归属、批次、库位与收发交接', modules: ['warehouse'] },
  { id: 'quality', label: '质检', focus: '来料、过程、补网和成品检验', modules: ['quality', 'production'] },
  { id: 'sales', label: '销售', focus: '客户规格、分批交付与发货状态', modules: ['sales', 'planning'] }
])

export const JINWEI_MODULE_ROUTES = Object.freeze({
  site: '/company-site/jinwei',
  sales: '/sales/cockpit',
  planning: '/production/overview',
  production: '/production/overview',
  warehouse: '/materials/inventory-dashboard',
  quality: '/quality/dashboard',
  purchase: '/purchase/dashboard',
  equipment: '/equipment/dashboard'
})

export const JINWEI_DEMO_ORDER = Object.freeze({
  orderNo: 'JW-DEMO-20260826-001',
  traceNo: 'JW-WIP-KNL-0001',
  productFamily: 'knotless-net',
  productName: '涤纶无结网',
  customer: '演示客户（未写入正式客户档案）',
  quantityPieces: 240,
  packageCount: 48,
  deliveryBatches: 4,
  dueDate: '待计划员确认',
  sourceStatus: 'demo',
  spec: {
    material: '涤纶',
    construction: '无结',
    yarnSpec: 'PLY3',
    meshSize: '3/8"',
    dimensions: '400MD x 100YDS',
    color: '原白',
    finish: '特硬（参数待确认）',
    weight: '9.5 KG/PC 演示值',
    packing: '5 条/件，唇头待确认'
  }
})

export const JINWEI_WORKFLOW = Object.freeze([
  { id: 'order', sequence: 1, short: '订单', title: '订单与分批交付', owner: '销售', module: 'sales', detail: '一张合同可含多规格、多产品并分 4-7 批交付。', sourceStatus: 'workbook' },
  { id: 'spec', sequence: 2, short: '规格', title: '规格审核与版本锁定', owner: '销售 / 计划', module: 'planning', detail: '校验材质、股数、网眼、长宽、颜色、重量和包装要求。', sourceStatus: 'workbook' },
  { id: 'readiness', sequence: 3, short: '齐套', title: '库存、采购和机台齐套', owner: '计划 / 仓库', module: 'warehouse', detail: '同时核对原料、半成品、包材、外购到货和机台倍数。', sourceStatus: 'observed' },
  { id: 'yarn', sequence: 4, short: '制线', title: '拉丝、并线或整经备料', owner: '制线 / 整经', module: 'production', detail: '根据产品路线生成丝卷、纱筒或盘头，交接时记录机台、规格、数量和净重。', sourceStatus: 'observed' },
  { id: 'weaving', sequence: 5, short: '织网', title: '本厂织网 / 外厂回网', owner: '织网车间', module: 'production', detail: '机台任务必须绑定合同、规格版本和上料批次。', sourceStatus: 'workbook' },
  { id: 'repair', sequence: 6, short: '补网', title: '补网、执头与过程检', owner: '补网 / 质检', module: 'quality', detail: '记录领用人、数量、缺陷、修补结果并反向追溯织网机台。', sourceStatus: 'observed' },
  { id: 'finishing', sequence: 7, short: '后处理', title: '委外染色、定型与剪断', owner: '收发 / 定型', module: 'production', detail: '委外发出与交回成对记录，定型后按订单米数或码数剪断。', sourceStatus: 'workbook' },
  { id: 'packing', sequence: 8, short: '包装', title: '包装、标签和成品入库', owner: '包装 / 仓库', module: 'warehouse', detail: '按条/件换算，生成唯一包装码并绑定唇头、重量和合同归属。', sourceStatus: 'workbook' },
  { id: 'delivery', sequence: 9, short: '交付', title: '分批拣货与销售出库', owner: '销售 / 仓库', module: 'sales', detail: '只能从当前合同可用库存中拣货，扫描包装码后完成发货。', sourceStatus: 'workbook' }
])

export const JINWEI_WORK_CENTERS = Object.freeze([
  { id: 'drawing', name: '拉丝 / 挤出', evidence: '多温区 HMI、处理槽与卷绕机组', capture: '投料批次、温度、机台、产出 kg', sourceStatus: 'observed' },
  { id: 'warping', name: '络筒 / 整经', evidence: '筒管架、盘头、整经机与手写看板', capture: '纱筒批次、根数、长度、盘头码', sourceStatus: 'observed' },
  { id: 'twisting', name: '捻线 / 成绳', evidence: '数控捻线设备与绳索成品卷', capture: '锭位、倍数、捻度、长度或重量', sourceStatus: 'observed' },
  { id: 'weaving', name: '有结 / 无结织造', evidence: '大型织网机、经编机与机台日任务板', capture: '合同、规格版本、机台、班次、产量', sourceStatus: 'observed' },
  { id: 'repair', name: '补网 / 执头', evidence: '大面积人工铺网检验与修补现场', capture: '缺陷类型、修补数量、人员、来源机台', sourceStatus: 'observed' },
  { id: 'setting', name: '电热 / 蒸汽定型', evidence: '旧工艺图明确记载电热/蒸汽定型', capture: '批次、温度、时间、硬度、领用/移交', sourceStatus: 'workbook' },
  { id: 'packing', name: '包装 / 入库', evidence: '液压打包机、编织袋与手写标识', capture: '条/件、净重、包装码、唇头、库位', sourceStatus: 'observed' }
])

export const JINWEI_HANDOFFS = Object.freeze([
  { id: 'HO-DEMO-001', code: 'JW-WIP-WARP-0008', from: '整经', to: '无结织造', item: '涤纶盘头', quantity: '8 盘', contract: JINWEI_DEMO_ORDER.orderNo, state: 'ready', sourceStatus: 'demo' },
  { id: 'HO-DEMO-002', code: 'JW-WIP-NET-0016', from: '织网', to: '补网', item: '无结网片', quantity: '80 条', contract: JINWEI_DEMO_ORDER.orderNo, state: 'waiting', sourceStatus: 'demo' },
  { id: 'HO-DEMO-003', code: 'JW-OUT-DYE-0003', from: '补网', to: '委外染色', item: '待染网片', quantity: '40 条', contract: JINWEI_DEMO_ORDER.orderNo, state: 'outsource', sourceStatus: 'demo' }
])

export const JINWEI_TRACE_SAMPLE = Object.freeze({
  code: JINWEI_DEMO_ORDER.traceNo,
  contract: JINWEI_DEMO_ORDER.orderNo,
  product: JINWEI_DEMO_ORDER.productName,
  specVersion: 'SPEC-DEMO-V1',
  materialBatch: 'MAT-DEMO-PET-01',
  machine: '无结织网 06#（演示）',
  operator: '演示操作员',
  currentStep: '补网待接收',
  quality: '过程检待录入',
  packageCode: '待生成',
  sourceStatus: 'demo'
})

// These rows are deliberately limited to fields needed to validate the new UI.
// They replay the supplied workbooks without treating historical orders as live data.
export const JINWEI_HISTORICAL_ORDERS = Object.freeze([
  {
    sourceFile: '240805.xls',
    contract: 'JW-240805',
    dueDate: '2024-10-10 前',
    product: '聚乙烯网 · JW-01 深黑青色',
    construction: '三股线 / 单结',
    spec: '380D/6 × 50MTRS × 300MD',
    quantity: '多规格 / 条、件',
    route: '本厂织网 + 拼网 + 补网 + 定型 + 包装',
    status: '历史样表',
    sourceStatus: 'workbook'
  },
  {
    sourceFile: '250419.xls',
    contract: 'JW-250419',
    dueDate: '2025-06-30 前',
    product: '尼龙渔网',
    construction: '双结',
    spec: '190D/2 × 24MD × 45MTRS',
    quantity: '25 件 / 5,000 条（示例规格行）',
    route: '外厂织网回网 + 补网 + 染色 + 定型',
    status: '历史样表',
    sourceStatus: 'workbook'
  },
  {
    sourceFile: '250506.xls',
    contract: 'JWI-250506',
    dueDate: '2025-08-20',
    product: '涤纶无结网',
    construction: '无结',
    spec: 'PLY3 × 400MD × 100YDS · 原白 · 特硬',
    quantity: '48 件 / 240 条（示例规格行）',
    route: '本厂织网 + 染色 + 定型 + 包装',
    status: '历史样表',
    sourceStatus: 'workbook'
  }
])

export const JINWEI_TRACE_CHAIN = Object.freeze([
  { no: '01', label: '原料批次', value: 'MAT-DEMO-PET-01', detail: '涤纶原料 / 批次待接入', sourceStatus: 'demo' },
  { no: '02', label: '盘头 / 上料', value: 'JW-WIP-WARP-0008', detail: '8 盘 / 整经工序', sourceStatus: 'demo' },
  { no: '03', label: '织网机台', value: '无结织网 06#', detail: '班次与操作员待扫码', sourceStatus: 'observed' },
  { no: '04', label: '补网记录', value: 'JW-WIP-NET-0016', detail: '80 条 / 缺陷与修补结果待录入', sourceStatus: 'demo' },
  { no: '05', label: '定型 / 委外', value: 'JW-OUT-DYE-0003', detail: '发出、交回和定型参数待闭环', sourceStatus: 'workbook' },
  { no: '06', label: '包装码', value: '待生成', detail: '入库时绑定合同、唛头和库位', sourceStatus: 'pending' }
])

export const calcJinweiAttentionScore = (item, context = {}) => {
  const urgency = Number(item.urgency || 0)
  const impact = Number(item.businessImpact || 0)
  const risk = Number(item.risk || 0)
  const frequency = Number(item.frequency || 0)
  const roleBoost = !item.roles?.length || item.roles.includes(context.role) || context.role === 'owner' ? 8 : 0
  return Math.max(0, Math.min(100, Math.round(urgency * 0.35 + impact * 0.30 + risk * 0.25 + frequency * 0.10 + roleBoost)))
}

export const scoreToJinweiAttention = (score) => {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'warning'
  if (score >= 45) return 'focus'
  if (score >= 20) return 'normal'
  return 'silent'
}

export const JINWEI_ATTENTION_ITEMS = Object.freeze([
  { id: 'spec-lock', title: '包装唇头未锁定', owner: '销售 / 计划', nextAction: '补齐唇头、袋色和印刷版后锁定 SPEC-DEMO-V1', urgency: 100, businessImpact: 95, risk: 100, frequency: 80, roles: ['sales', 'planner'], module: 'planning', sourceStatus: 'pending' },
  { id: 'handoff', title: '织网到补网尚未扫码接收', owner: '车间 / 质检', nextAction: '扫描 JW-WIP-NET-0016 并确认实收数量', urgency: 78, businessImpact: 76, risk: 72, frequency: 65, roles: ['workshop', 'quality'], module: 'production', sourceStatus: 'demo' },
  { id: 'outsource', title: '委外染色需建立发出/交回对账', owner: '收发 / 计划', nextAction: '确认外协单、批次和预计返回日期', urgency: 70, businessImpact: 82, risk: 78, frequency: 55, roles: ['planner', 'warehouse'], module: 'planning', sourceStatus: 'workbook' },
  { id: 'contract-stock', title: '成品库存必须保留合同归属', owner: '仓库', nextAction: '上架时同时扫描包装码、库位和合同', urgency: 48, businessImpact: 88, risk: 90, frequency: 82, roles: ['warehouse'], module: 'warehouse', sourceStatus: 'workbook' },
  { id: 'machine-data', title: '机台状态仍以人工上报为主', owner: '车间 / 设备', nextAction: '第一阶段先规范报工，不将 PLC 采集作为上线前置', urgency: 25, businessImpact: 58, risk: 42, frequency: 70, roles: ['workshop'], module: 'equipment', sourceStatus: 'pending' }
])

const clampStep = (value) => Math.max(0, Math.min(JINWEI_WORKFLOW.length - 1, Number(value) || 0))

export const createJinweiSnapshot = (step = JINWEI_DEFAULT_STEP, role = 'owner') => {
  const activeStep = clampStep(step)
  const stage = JINWEI_WORKFLOW[activeStep]
  const progress = Math.round((activeStep / (JINWEI_WORKFLOW.length - 1)) * 100)
  const attention = JINWEI_ATTENTION_ITEMS
    .map((item) => {
      const score = calcJinweiAttentionScore(item, { role })
      return { ...item, score, level: scoreToJinweiAttention(score) }
    })
    .filter((item) => role === 'owner' || item.roles.includes(role) || item.level === 'critical')
    .sort((left, right) => right.score - left.score)

  return {
    activeStep,
    stage,
    progress,
    workflow: JINWEI_WORKFLOW.map((item, index) => ({
      ...item,
      index,
      state: index < activeStep ? 'done' : index === activeStep ? 'active' : 'queued'
    })),
    attention,
    metrics: {
      plannedPieces: JINWEI_DEMO_ORDER.quantityPieces,
      completedPieces: activeStep < 4 ? 0 : activeStep === 4 ? 80 : activeStep < 7 ? 160 : 240,
      wipPieces: activeStep < 3 || activeStep >= 7 ? 0 : activeStep === 3 ? 240 : 160,
      finishedPieces: activeStep >= 7 ? 240 : 0,
      deliveredPieces: activeStep >= 8 ? 240 : 0,
      unresolvedSpecs: activeStep < 2 ? 3 : 1,
      openHandoffs: activeStep < 4 || activeStep > 6 ? 0 : 2
    },
    nextAction: activeStep < JINWEI_WORKFLOW.length - 1 ? JINWEI_WORKFLOW[activeStep + 1] : null
  }
}

export const validateJinweiModel = () => {
  const issues = []
  const requiredSpecKeys = ['material', 'construction', 'yarnSpec', 'meshSize', 'dimensions', 'color', 'weight', 'packing']
  if (JINWEI_PRODUCT_FAMILIES.length !== 4) issues.push('PRODUCT_FAMILY_COVERAGE_INVALID')
  if (requiredSpecKeys.some((key) => !JINWEI_SPEC_FIELDS.some((field) => field.key === key))) issues.push('SPEC_FIELD_COVERAGE_INVALID')
  if (JINWEI_WORKFLOW.length !== 9) issues.push('WORKFLOW_LENGTH_INVALID')
  if (!JINWEI_WORKFLOW.some((step) => step.id === 'repair') || !JINWEI_WORKFLOW.some((step) => step.id === 'packing')) issues.push('CORE_WORKFLOW_MISSING')
  if (JINWEI_WORK_CENTERS.length < 7) issues.push('WORK_CENTER_COVERAGE_INVALID')
  if (JINWEI_COMPLIANCE_STANDARDS.length < 7 || JINWEI_COMPLIANCE_STANDARDS.some((item) => item.status !== '现行' || !item.url?.startsWith('https://') || !item.implementationUse)) issues.push('COMPLIANCE_BASELINE_INVALID')
  if (JINWEI_COMPLIANCE_STANDARDS.some((item) => item.code === 'GB/T 18673-2008')) issues.push('SUPERSEDED_STANDARD_MUST_NOT_BE_BASELINE')
  if (JINWEI_EXTERNAL_RESEARCH.filter((item) => item.tier === 'official').some((item) => !item.url?.startsWith('https://') || !item.finding)) issues.push('EXTERNAL_RESEARCH_SOURCE_INVALID')
  if (JINWEI_ATTENTION_ITEMS.some((item) => !JINWEI_SOURCE_STATUS[item.sourceStatus])) issues.push('ATTENTION_SOURCE_STATUS_INVALID')
  if (JINWEI_WORKFLOW.some((item) => !JINWEI_SOURCE_STATUS[item.sourceStatus])) issues.push('WORKFLOW_SOURCE_STATUS_INVALID')
  if (JINWEI_DEMO_ORDER.orderNo.startsWith('JW-24') || JINWEI_DEMO_ORDER.orderNo.startsWith('JW-25')) issues.push('HISTORICAL_ORDER_MUST_NOT_BE_ACTIVE_DEMO')
  return issues
}
