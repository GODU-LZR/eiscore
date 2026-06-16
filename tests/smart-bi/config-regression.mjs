// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sourcePath = resolve('shared/smart-bi-config.js')
const source = await readFile(sourcePath, 'utf8')
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const smartBi = await import(moduleUrl)

const {
  SMART_BI_DOMAINS,
  SMART_BI_OUTPUT_SECTIONS,
  getSmartBiWorkbenchCards,
  routeSmartBiQuestion,
  buildSmartBiContext,
  getSmartBiCommonQuestions,
  getSmartBiMetricDefinitions,
  formatSmartBiMetricDefinitionsForPrompt,
  getSmartBiCardRisk
} = smartBi

assert.equal(SMART_BI_DOMAINS.length, 6, 'smart BI should keep six core business domains')
assert.deepEqual(
  SMART_BI_OUTPUT_SECTIONS,
  ['关键指标', '指标图表', '风险提醒', '行动建议'],
  'smart BI output sections should stay stable'
)

const salesRoute = routeSmartBiQuestion('销售回款和应收风险怎么样')
assert.equal(salesRoute.key, 'sales', 'sales question should route to sales domain')
assert.equal(salesRoute.confidence, 'high', 'sales question with multiple keywords should be high confidence')

const inventoryRoute = routeSmartBiQuestion('低库存、效期和仓库占用风险')
assert.equal(inventoryRoute.key, 'inventory', 'inventory risk question should route to inventory domain')
assert.equal(inventoryRoute.confidence, 'high', 'inventory question with multiple keywords should be high confidence')

const fallbackRoute = routeSmartBiQuestion('帮我看一下整体情况')
assert.equal(fallbackRoute.key, 'overview', 'generic question should fall back to overview')
assert.equal(fallbackRoute.confidence, 'low', 'generic question should be low confidence')

const equipmentContext = buildSmartBiContext('设备点检异常和停机风险')
assert.equal(equipmentContext.route.key, 'equipment', 'equipment question should build equipment context')
assert.equal(equipmentContext.metricCatalog.length, 1, 'domain context should only include the routed domain')
assert.equal(equipmentContext.metricCatalog[0].key, 'equipment', 'equipment context should expose equipment metrics')
assert.equal(equipmentContext.metricDefinitions.length, 3, 'domain context should expose fixed metric definitions')
assert.ok(equipmentContext.outputTemplate.includes('默认图表模板'), 'output template should require chart templates')

const overviewContext = buildSmartBiContext('')
assert.equal(overviewContext.route.key, 'overview', 'empty context should route to overview')
assert.equal(overviewContext.metricCatalog.length, 6, 'overview context should expose all domains')
assert.equal(overviewContext.metricDefinitions.length, 18, 'overview context should expose all domain metric definitions')

const cards = getSmartBiWorkbenchCards({
  snapshotTime: '2026-06-16T00:00:00.000Z',
  sales: { orderAmount: 128000, ordersTotal: 7, receivableBalance: 32000 },
  purchase: { purchaseAmount: 88000, acceptanceRate: 96.5, pendingArrivals: [{ id: 1 }] },
  inventory: { totalQty: 2300, materialCount: 42, warehouseNames: ['A', 'B'] },
  production: { plannedQty: 560, workOrdersTotal: 8, shortageOrderCount: 2 },
  quality: { passRate: 98.2, ncrsTotal: 3, defectRate: 1.8 },
  equipment: { avgHealthScore: 91, assetsTotal: 18, openIssueCount: 1 }
})

assert.equal(cards.length, 7, 'workbench should include overview plus six domain cards')
assert.equal(cards[0].key, 'overview', 'first card should be overview')
assert.equal(cards[0].metricValue, '6/6', 'overview card should count connected domains')
assert.ok(cards[0].metricDefinition.includes('六大领域'), 'overview card should use overview-specific metric definition')
assert.ok(cards.every((card) => card.prompt && card.metricLabel && card.metricValue), 'each card should be actionable and display metrics')
assert.ok(
  cards.every((card) => card.metricDefinition && card.chartTemplate && card.riskRule && card.owner),
  'each card should carry fixed metric definition, chart template, risk rule, and owner'
)
assert.ok(
  cards.every((card) => card.riskLevel && card.riskStatusLabel && card.riskReason),
  'each card should carry computed risk state'
)
assert.equal(cards[0].riskLevel, 'warning', 'overview should aggregate warning domain risk')

const emptyRisk = getSmartBiCardRisk('sales')
assert.equal(emptyRisk.riskLevel, 'focus', 'empty snapshot should wait for realtime data')
assert.equal(emptyRisk.riskStatusLabel, '待刷新', 'empty snapshot should display waiting status')

const salesCriticalRisk = getSmartBiCardRisk('sales', {
  snapshotTime: '2026-06-16T00:00:00.000Z',
  sales: { orderAmount: 100000, receivableBalance: 20000, receivableRisk: [{ overCredit: true }] }
})
assert.equal(salesCriticalRisk.riskLevel, 'critical', 'sales over-credit receivables should be critical')

const productionWarningRisk = getSmartBiCardRisk('production', {
  snapshotTime: '2026-06-16T00:00:00.000Z',
  production: { shortageOrderCount: 2, shortageItemCount: 4 }
})
assert.equal(productionWarningRisk.riskLevel, 'warning', 'production shortages should be warning risk')

for (const domain of SMART_BI_DOMAINS) {
  const definitions = getSmartBiMetricDefinitions(domain.key)
  assert.equal(definitions.length, 3, `${domain.key} should keep three fixed metric definitions`)
  assert.ok(definitions.every((item) => item.key && item.label && item.formula && item.chart && item.riskRule && item.owner), `${domain.key} metric definitions should be complete`)
}

const metricPrompt = formatSmartBiMetricDefinitionsForPrompt('sales')
assert.ok(metricPrompt.includes('销售额'), 'metric prompt should include sales metric labels')
assert.ok(metricPrompt.includes('风险阈值'), 'metric prompt should include risk thresholds')
assert.ok(metricPrompt.includes('负责方向'), 'metric prompt should include ownership direction')

const commonQuestions = getSmartBiCommonQuestions()
assert.ok(commonQuestions.length >= 7, 'common questions should cover common BI entry points')
assert.ok(commonQuestions.some((prompt) => prompt.includes('上传')), 'common questions should include upload analysis')

console.log('PASS: smart BI config regression')
