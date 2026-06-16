// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const SMART_BI_OUTPUT_SECTIONS = [
  '关键指标',
  '指标图表',
  '风险提醒',
  '行动建议'
]

export const SMART_BI_DOMAINS = [
  {
    key: 'sales',
    label: '销售',
    aliases: ['销售', '客户', '订单', '回款', '应收', '商机', '成交', '发货', '收入', '业绩'],
    metrics: [
      '销售额/订单金额',
      '订单数量与订单状态',
      '客户数量与客户分层',
      '销售商机金额与阶段转化',
      '回款金额与应收余额',
      '交付延期与客户跟进风险'
    ],
    charts: ['销售趋势', '订单状态分布', '客户区域/负责人结构', '商机漏斗', '应收风险排行']
  },
  {
    key: 'purchase',
    label: '采购',
    aliases: ['采购', '供应商', '到货', '采购订单', '采购需求', '来料', 'iqc', '供应', '交期'],
    metrics: [
      '采购金额',
      '采购需求数量与状态',
      '采购订单数量与履约状态',
      '到货数量与到货达成',
      'IQC 检验状态',
      '供应商交期与异常风险'
    ],
    charts: ['采购金额趋势', '订单状态分布', '供应商结构', '到货达成对比', 'IQC 状态分布']
  },
  {
    key: 'inventory',
    label: '库存',
    aliases: ['库存', '仓库', '物料', '批次', '低库存', '呆滞', '效期', '出入库', '盘点', '库位'],
    metrics: [
      '实时库存数量',
      '物料数量与分类结构',
      '仓库/库位库存分布',
      '近期出入库次数与数量',
      '盘点任务与差异数量',
      '低库存、效期、呆滞和占用风险'
    ],
    charts: ['仓库库存分布', '物料分类占比', '出入库趋势', '库存 Top 排行', '盘点状态分布']
  },
  {
    key: 'production',
    label: '生产',
    aliases: ['生产', '工单', '排产', '齐套', '缺料', '领料', '完工', '产能', '计划', 'bom'],
    metrics: [
      '生产工单数量',
      '计划生产数量',
      '工单状态与优先级',
      '齐套率/缺料项',
      '领料状态',
      '计划开工与计划完工风险'
    ],
    charts: ['工单状态分布', '产品计划数量排行', '缺料项排行', '优先级结构', '计划完成节奏']
  },
  {
    key: 'quality',
    label: '质量',
    aliases: ['质量', '质检', '检验', '不良', '合格率', '不合格', '整改', '异常', '审核', 'ncr'],
    metrics: [
      '检验批次数',
      '合格率/不良率',
      '质量异常数量与严重等级',
      '整改任务数量与闭环状态',
      '审核发现项',
      '待判定、待整改和待验证风险'
    ],
    charts: ['检验结果分布', '不良率趋势', '异常等级分布', '整改状态分布', '审核发现项排行']
  },
  {
    key: 'equipment',
    label: '设备',
    aliases: ['设备', '点检', '巡检', '保养', '维保', '维修', '故障', '停机', '健康', '稼动'],
    metrics: [
      '设备总数与运行状态',
      '设备健康评分',
      '点检完成与异常数量',
      '设备故障/异常数量',
      '维保工单与停机时长',
      '保养计划达成与逾期风险'
    ],
    charts: ['设备运行状态分布', '健康评分排行', '点检结果分布', '异常等级分布', '维保工单状态']
  }
]

export const SMART_BI_METRIC_DEFINITIONS = {
  sales: [
    { key: 'order_amount', label: '销售额', formula: '销售订单 total_amount 汇总', chart: '按订单日期生成销售趋势柱线图', riskRule: '订单金额下降或交付延期增加时预警', owner: '销售负责人' },
    { key: 'receivable_balance', label: '应收余额', formula: '客户 receivable_balance 汇总', chart: '按客户生成应收风险排行', riskRule: '应收余额超过授信额度或持续上升时预警', owner: '销售/财务负责人' },
    { key: 'opportunity_amount', label: '商机金额', formula: '销售商机 expected_amount 汇总，并按 stage 分组', chart: '生成商机阶段漏斗', riskRule: '高金额商机长期停留在早期阶段时预警', owner: '销售负责人' }
  ],
  purchase: [
    { key: 'purchase_amount', label: '采购金额', formula: '采购订单 total_amount 汇总', chart: '按订单日期生成采购金额趋势', riskRule: '采购金额异常放大或集中于单一供应商时预警', owner: '采购负责人' },
    { key: 'arrival_acceptance_rate', label: '到货合格率', formula: 'accepted_quantity / arrival_quantity * 100%', chart: '生成到货数量与合格数量对比图', riskRule: '到货合格率低于 95% 时预警', owner: '采购/IQC 负责人' },
    { key: 'pending_arrivals', label: '待跟到货', formula: '采购订单中未到货、未关闭、未取消的订单数量', chart: '按供应商或预计到货日生成待跟排行', riskRule: '预计到货日临近或逾期仍未到货时预警', owner: '采购负责人' }
  ],
  inventory: [
    { key: 'available_qty', label: '实时库存数量', formula: '库存视图 available_qty 汇总', chart: '按仓库生成库存分布柱状图', riskRule: '库存过高占用或库存不足时预警', owner: '仓储负责人' },
    { key: 'material_count', label: '物料数', formula: '按 material_code 去重统计', chart: '按物料分类生成结构占比图', riskRule: '关键物料缺失或分类异常集中时预警', owner: '仓储/计划负责人' },
    { key: 'inventory_check_diff', label: '盘点差异', formula: '盘点单 diff_count 与状态汇总', chart: '生成盘点状态分布和差异排行', riskRule: '盘亏盘盈差异持续出现时预警', owner: '仓储负责人' }
  ],
  production: [
    { key: 'planned_qty', label: '计划生产数量', formula: '生产工单 planned_qty 汇总', chart: '按产品生成计划数量排行', riskRule: '计划集中但缺料项较多时预警', owner: '生产计划负责人' },
    { key: 'work_order_status', label: '工单状态', formula: '按 work_order_status 汇总工单数量', chart: '生成工单状态分布图', riskRule: '待排产/生产中积压过多时预警', owner: '生产负责人' },
    { key: 'shortage_order_count', label: '缺料工单', formula: 'shortage_item_count > 0 的工单数量', chart: '生成缺料工单排行', riskRule: '缺料工单数大于 0 且临近计划完工日时预警', owner: '计划/仓储负责人' }
  ],
  quality: [
    { key: 'pass_rate', label: '检验合格率', formula: '合格或让步接收检验批次 / 检验总批次 * 100%', chart: '生成检验结果分布图', riskRule: '合格率低于 98% 时预警', owner: '质量负责人' },
    { key: 'defect_rate', label: '不良率', formula: 'defect_qty / sample_qty * 100%', chart: '生成不良率趋势或物料排行', riskRule: '不良率超过 2% 时预警', owner: '质量负责人' },
    { key: 'open_ncrs', label: '未关闭异常', formula: '质量异常中 ncr_status 不等于已关闭的数量', chart: '按严重等级生成异常分布图', riskRule: '严重/关键异常未闭环时预警', owner: '质量/责任部门负责人' }
  ],
  equipment: [
    { key: 'avg_health_score', label: '设备健康评分', formula: '设备台账 health_score 平均值', chart: '生成设备健康评分排行', riskRule: '平均评分低于 80 或关键设备低于 80 时预警', owner: '设备负责人' },
    { key: 'open_issue_count', label: '未关闭设备异常', formula: '设备异常中 issue_status 不等于已关闭的数量', chart: '按异常等级生成分布图', riskRule: '紧急异常未关闭或停机设备存在时预警', owner: '设备负责人' },
    { key: 'downtime_hours', label: '停机时长', formula: '维保工单 downtime_hours 汇总', chart: '按设备生成停机时长排行', riskRule: '停机时长持续增加时预警', owner: '设备/生产负责人' }
  ]
}

export const SMART_BI_COMMON_QUESTIONS = [
  { key: 'overview', label: '经营总览', prompt: '生成一份企业经营总览，覆盖销售、采购、库存、生产、质量和设备，必须包含关键指标、图表、风险和建议。' },
  { key: 'sales', label: '销售分析', prompt: '销售现在怎么样？请分析销售额、订单、客户、商机、回款和应收风险，并生成图表。' },
  { key: 'purchase', label: '采购分析', prompt: '采购现在怎么样？请分析采购需求、采购订单、到货、供应商和 IQC 风险，并生成图表。' },
  { key: 'inventory', label: '库存风险', prompt: '库存风险怎么样？请分析库存占用、低库存、出入库趋势、盘点差异和效期风险，并生成图表。' },
  { key: 'production', label: '生产进度', prompt: '生产进度怎么样？请分析工单状态、计划数量、缺料齐套、优先级和交付风险，并生成图表。' },
  { key: 'quality', label: '质量异常', prompt: '质量情况怎么样？请分析检验结果、不良率、质量异常、整改闭环和审核风险，并生成图表。' },
  { key: 'equipment', label: '设备健康', prompt: '设备健康怎么样？请分析运行状态、点检异常、故障维修、停机时长和保养计划，并生成图表。' },
  { key: 'upload', label: '上传表格分析', prompt: '请基于我上传的数据表生成智能 BI 分析，包含关键指标、图表、风险和行动建议。' }
]

const getQuestionPrompt = (key) => SMART_BI_COMMON_QUESTIONS.find((item) => item.key === key)?.prompt || ''

const formatCompactNumber = (value, suffix = '') => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return `--${suffix}`
  const abs = Math.abs(numeric)
  if (abs >= 100000000) return `${(numeric / 100000000).toFixed(1).replace(/\.0$/, '')}亿${suffix}`
  if (abs >= 10000) return `${(numeric / 10000).toFixed(1).replace(/\.0$/, '')}万${suffix}`
  return `${Math.round(numeric * 100) / 100}${suffix}`
}

const countSnapshotSections = (snapshot = {}) => SMART_BI_DOMAINS
  .filter((domain) => snapshot?.[domain.key] || (domain.key === 'inventory' && snapshot?.inventory))
  .length

export const getSmartBiMetricDefinitions = (domainKey = 'overview') => {
  if (domainKey && domainKey !== 'overview') return SMART_BI_METRIC_DEFINITIONS[domainKey] || []
  return SMART_BI_DOMAINS.flatMap((domain) => SMART_BI_METRIC_DEFINITIONS[domain.key] || [])
}

const SMART_BI_OVERVIEW_CARD_METRIC = {
  formula: '已接入销售、采购、库存、生产、质量、设备六大领域快照数量',
  chart: '生成六大领域经营健康概览图',
  riskRule: '领域数据缺失或关键风险集中时预警',
  owner: '经营管理层'
}

const getPrimarySmartBiMetric = (domainKey) => {
  if (domainKey === 'overview') return SMART_BI_OVERVIEW_CARD_METRIC
  return getSmartBiMetricDefinitions(domainKey)[0] || null
}

export const getSmartBiWorkbenchCards = (snapshot = {}) => {
  const sales = snapshot?.sales || {}
  const purchase = snapshot?.purchase || {}
  const inventory = snapshot?.inventory || {}
  const production = snapshot?.production || {}
  const quality = snapshot?.quality || {}
  const equipment = snapshot?.equipment || {}
  const overviewCount = countSnapshotSections(snapshot)
  const attachMetric = (key, card) => {
    const metric = getPrimarySmartBiMetric(key)
    return {
      ...card,
      metricDefinition: metric?.formula || '按系统当前业务快照统计',
      chartTemplate: metric?.chart || '按业务场景生成结构/趋势图',
      riskRule: metric?.riskRule || '按异常变化和业务风险提示',
      owner: metric?.owner || '业务负责人'
    }
  }

  return [
    attachMetric('overview', {
      key: 'overview',
      label: '经营总览',
      desc: '跨销售、采购、库存、生产、质量、设备看经营状态',
      metricLabel: '已接入领域',
      metricValue: overviewCount ? `${overviewCount}/6` : '--',
      subLabel: '快照时间',
      subValue: snapshot?.snapshotTime ? new Date(snapshot.snapshotTime).toLocaleString('zh-CN', { hour12: false }) : '待刷新',
      riskLabel: '入口',
      riskValue: '全局分析',
      prompt: getQuestionPrompt('overview')
    }),
    attachMetric('sales', {
      key: 'sales',
      label: '销售分析',
      desc: '销售额、订单、客户、商机、回款和应收风险',
      metricLabel: '订单金额',
      metricValue: formatCompactNumber(sales.orderAmount),
      subLabel: '订单数',
      subValue: formatCompactNumber(sales.ordersTotal, '单'),
      riskLabel: '应收余额',
      riskValue: formatCompactNumber(sales.receivableBalance),
      prompt: getQuestionPrompt('sales')
    }),
    attachMetric('purchase', {
      key: 'purchase',
      label: '采购分析',
      desc: '采购需求、订单履约、到货、供应商和 IQC',
      metricLabel: '采购金额',
      metricValue: formatCompactNumber(purchase.purchaseAmount),
      subLabel: '到货合格率',
      subValue: Number.isFinite(Number(purchase.acceptanceRate)) ? `${purchase.acceptanceRate}%` : '--',
      riskLabel: '待跟到货',
      riskValue: formatCompactNumber(purchase.pendingArrivals?.length || 0, '单'),
      prompt: getQuestionPrompt('purchase')
    }),
    attachMetric('inventory', {
      key: 'inventory',
      label: '库存风险',
      desc: '库存占用、物料结构、出入库、盘点和效期风险',
      metricLabel: '库存数量',
      metricValue: formatCompactNumber(inventory.totalQty),
      subLabel: '物料数',
      subValue: formatCompactNumber(inventory.materialCount, '种'),
      riskLabel: '仓库数',
      riskValue: formatCompactNumber(inventory.warehouseNames?.length || 0, '个'),
      prompt: getQuestionPrompt('inventory')
    }),
    attachMetric('production', {
      key: 'production',
      label: '生产进度',
      desc: '工单状态、计划数量、齐套缺料和交付风险',
      metricLabel: '计划数量',
      metricValue: formatCompactNumber(production.plannedQty),
      subLabel: '工单数',
      subValue: formatCompactNumber(production.workOrdersTotal, '单'),
      riskLabel: '缺料工单',
      riskValue: formatCompactNumber(production.shortageOrderCount, '单'),
      prompt: getQuestionPrompt('production')
    }),
    attachMetric('quality', {
      key: 'quality',
      label: '质量异常',
      desc: '检验结果、不良率、异常、整改闭环和审核',
      metricLabel: '检验合格率',
      metricValue: Number.isFinite(Number(quality.passRate)) ? `${quality.passRate}%` : '--',
      subLabel: '异常数',
      subValue: formatCompactNumber(quality.ncrsTotal, '条'),
      riskLabel: '不良率',
      riskValue: Number.isFinite(Number(quality.defectRate)) ? `${quality.defectRate}%` : '--',
      prompt: getQuestionPrompt('quality')
    }),
    attachMetric('equipment', {
      key: 'equipment',
      label: '设备健康',
      desc: '运行状态、点检异常、故障维修、停机和保养',
      metricLabel: '健康评分',
      metricValue: Number.isFinite(Number(equipment.avgHealthScore)) ? `${equipment.avgHealthScore}` : '--',
      subLabel: '设备数',
      subValue: formatCompactNumber(equipment.assetsTotal, '台'),
      riskLabel: '未关闭异常',
      riskValue: formatCompactNumber(equipment.openIssueCount, '条'),
      prompt: getQuestionPrompt('equipment')
    })
  ]
}

export const findSmartBiDomain = (key) => SMART_BI_DOMAINS.find((domain) => domain.key === key) || null

export const routeSmartBiQuestion = (text = '') => {
  const normalized = String(text || '').toLowerCase()
  const scores = SMART_BI_DOMAINS.map((domain) => {
    const matchedKeywords = domain.aliases.filter((keyword) => normalized.includes(String(keyword).toLowerCase()))
    return {
      key: domain.key,
      label: domain.label,
      score: matchedKeywords.length,
      matchedKeywords
    }
  }).filter((item) => item.score > 0)

  scores.sort((a, b) => b.score - a.score)
  const top = scores[0]
  if (!top) {
    return {
      key: 'overview',
      label: '经营总览',
      confidence: 'low',
      matchedKeywords: []
    }
  }

  return {
    key: top.key,
    label: top.label,
    confidence: top.score >= 2 ? 'high' : 'medium',
    matchedKeywords: top.matchedKeywords
  }
}

export const buildSmartBiContext = (text = '') => {
  const route = routeSmartBiQuestion(text)
  const domain = findSmartBiDomain(route.key)
  const metricDefinitions = getSmartBiMetricDefinitions(route.key)
  return {
    route,
    metricCatalog: domain ? [domain] : SMART_BI_DOMAINS,
    metricDefinitions,
    outputSections: SMART_BI_OUTPUT_SECTIONS,
    outputTemplate: '每次回答必须稳定包含：关键指标、指标图表、风险提醒、行动建议。关键指标要给数值/口径/结论；图表优先按默认图表模板输出 ECharts JSON；风险要按阈值和业务影响分级；建议要包含负责人方向、时间节点和目标。'
  }
}

export const formatSmartBiCatalogForPrompt = () => SMART_BI_DOMAINS
  .map((domain) => `【${domain.label}】核心指标：${domain.metrics.join('、')}。常用图表：${domain.charts.join('、')}。问题关键词：${domain.aliases.join('、')}。`)
  .join('\n')

export const formatSmartBiMetricDefinitionsForPrompt = (domainKey = 'overview') => {
  const definitions = getSmartBiMetricDefinitions(domainKey)
  return definitions
    .map((item) => `- ${item.label}：口径=${item.formula}；默认图表=${item.chart}；风险阈值=${item.riskRule}；负责方向=${item.owner}`)
    .join('\n')
}

export const getSmartBiCommonQuestions = () => SMART_BI_COMMON_QUESTIONS.map((item) => item.prompt)
