// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Module = require('node:module')

process.env.DOCUMENT_PLAN_POLL_INTERVAL_MS = 'bad-interval'
process.env.DOCUMENT_PLAN_PG_POOL_MAX = 'bad-pool'
process.env.PGPORT = 'bad-port'

const state = {
  poolOptions: null
}

class FakePool {
  constructor(options) {
    state.poolOptions = options
  }

  async end() {}
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') return { Pool: FakePool }
  return originalLoad.call(this, request, parent, isMain)
}

const modulePath = '../../realtime/document-planner.js'
delete require.cache[require.resolve(modulePath)]
const { chooseClassification, buildEntryPlan, resolveAppTable, extractColumnsFromApp } = require(modulePath)
Module._load = originalLoad

assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')
assert.equal(state.poolOptions.max, 3, 'invalid planner pool max env should fall back to 3')

const asset = {
  id: 'asset-1',
  original_filename: '送货单.xlsx'
}

const purchaseClassification = chooseClassification({
  asset,
  parseResult: {
    text_content: '供应商：南派食品 送货单号：DH001 物料 明细 入库 数量 仓库 批次',
    tables: [{ sheet_name: 'Sheet1', row_count: 4, rows: [['物料', '数量'], ['A', '10'], ['B', '20']] }],
    ocr_result: {},
    metadata: {}
  },
  apps: []
})

assert.equal(purchaseClassification.recognized, true, 'purchase-like text should be recognized')
assert.equal(purchaseClassification.targetModule, 'materials')
assert.equal(purchaseClassification.targetDocumentType, '采购入库单')
assert.ok(purchaseClassification.confidence >= 0.4)

const purchasePlan = buildEntryPlan(asset, { text_content: '供应商 送货单 物料 数量' }, purchaseClassification)
assert.equal(purchasePlan.target_kind, 'fixed_module_table')
assert.equal(purchasePlan.mode, 'one_document_with_lines')
assert.equal(purchasePlan.status, undefined, 'status is supplied by insert SQL, not the pure plan builder')

const dynamicApp = {
  id: '00000000-0000-4000-8000-000000000001',
  name: '外协加工入库',
  description: '外协加工单据',
  config: {
    table_name: 'outsourcing_receipts',
    columns: [
      { field: 'supplier_name', label: '外协供应商', aliases: ['加工商'] },
      { field: 'furnace_no', label: '炉号' },
      { field: 'package_method', label: '包装方式' }
    ]
  }
}

assert.equal(resolveAppTable(dynamicApp), 'outsourcing_receipts')
assert.equal(extractColumnsFromApp(dynamicApp).length, 3)

const dynamicClassification = chooseClassification({
  asset: { ...asset, original_filename: '外协加工单.pdf' },
  parseResult: {
    text_content: '外协加工入库 加工商 炉号 A-20260616 包装方式 纸箱 客户特殊要求',
    tables: [],
    ocr_result: {},
    metadata: {}
  },
  apps: [dynamicApp]
})

assert.equal(dynamicClassification.recognized, true, 'dynamic app fields should be recognized')
assert.equal(dynamicClassification.targetKind, 'data_app')
assert.equal(dynamicClassification.app.id, dynamicApp.id)

const dynamicPlan = buildEntryPlan(asset, { text_content: '外协加工入库 炉号 包装方式' }, dynamicClassification)
assert.equal(dynamicPlan.target_schema, 'app_data')
assert.equal(dynamicPlan.target_table, 'outsourcing_receipts')
assert.equal(dynamicPlan.columns_snapshot.length, 3)

const imageClassification = chooseClassification({
  asset: { ...asset, original_filename: '照片.png' },
  parseResult: {
    text_content: '',
    tables: [],
    ocr_result: { status: 'pending' },
    metadata: { parser_status: 'ocr_pending' }
  },
  apps: []
})

assert.equal(imageClassification.recognized, false)
assert.equal(buildEntryPlan(asset, { text_content: '' }, imageClassification), null)

console.log('PASS: document planner regression')
