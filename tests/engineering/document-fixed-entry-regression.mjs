// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Module = require('node:module')

process.env.DOCUMENT_FIXED_ENTRY_POLL_INTERVAL_MS = 'bad-interval'
process.env.DOCUMENT_FIXED_ENTRY_PG_POOL_MAX = 'bad-pool'
process.env.PGPORT = 'bad-port'
process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_OPERATOR = 'AI采集员'
process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_IO_TYPE = '采购入库'

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

const modulePath = '../../realtime/document-fixed-entry.js'
delete require.cache[require.resolve(modulePath)]
const {
  buildStockInRowsFromPlan,
  findStockInHeaderMapping,
  parseQuantity,
  normalizeDate,
  validateStockInLine,
  buildStockInPayload,
  buildRpcRemark,
  normalizeKey
} = require(modulePath)
Module._load = originalLoad

assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')
assert.equal(state.poolOptions.max, 3, 'invalid fixed entry pool max env should fall back to 3')

assert.equal(normalizeKey('采购 单价'), '采购单价')
assert.equal(parseQuantity('1,250.5 kg'), 1250.5)
assert.equal(parseQuantity('abc'), null)
assert.equal(normalizeDate('2026年6月17日'), '2026-06-17')
assert.equal(normalizeDate('2026-02-31'), null)

const header = ['物料编码', '物料名称', '仓库编码', '入库数量', '单位', '批次号', '生产日期', '供应商', '采购单价', '备注']
const mapping = findStockInHeaderMapping(header)
assert.equal(mapping.get('materialCode'), 0)
assert.equal(mapping.get('warehouseCode'), 2)
assert.equal(mapping.get('quantity'), 3)
assert.equal(mapping.get('batchNo'), 5)
assert.equal(mapping.get('supplier'), 7)
assert.equal(mapping.get('purchasePrice'), 8)

const asset = {
  id: 'asset-1',
  batch_id: 'batch-1',
  original_filename: '采购入库单.xlsx'
}
const entryPlan = {
  id: 'plan-1',
  batch_id: 'batch-1',
  documents: []
}

const rows = buildStockInRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        sheet_name: 'Sheet1',
        rows: [
          header,
          ['RM-001', '冷轧钢卷', 'WH001', '1,250.5', 'kg', 'B20260617', '2026/06/17', '南派供应链', '12.3', '加急入库'],
          ['', '', '', '', '', '', '', '', '', '']
        ]
      }
    ]
  }
})

assert.equal(rows.length, 1)
assert.equal(rows[0].line.materialCode, 'RM-001')
assert.equal(rows[0].line.materialName, '冷轧钢卷')
assert.equal(rows[0].line.warehouseCode, 'WH001')
assert.equal(rows[0].line.quantity, 1250.5)
assert.equal(rows[0].line.unit, 'kg')
assert.equal(rows[0].line.batchNo, 'B20260617')
assert.equal(rows[0].line.productionDate, '2026-06-17')
assert.equal(rows[0].line.supplier, '南派供应链')
assert.equal(rows[0].line.purchasePrice, 12.3)
assert.equal(rows[0].line.operator, 'AI采集员')
assert.equal(rows[0].line.ioType, '采购入库')
assert.ok(rows[0].unmappedFields.some((field) => field.name === '供应商'))
assert.ok(rows[0].unmappedFields.some((field) => field.name === '采购单价'))

const validationErrors = validateStockInLine(rows[0].line, {})
assert.ok(validationErrors.includes('未匹配到物料主数据'))
assert.ok(validationErrors.includes('未匹配到仓库/库位'))

const validErrors = validateStockInLine(rows[0].line, {
  material: { id: 11 },
  warehouse: { id: '00000000-0000-0000-0000-000000000001' }
})
assert.deepEqual(validErrors, [])

const payload = buildStockInPayload({
  line: rows[0].line,
  material: { id: 11 },
  warehouse: { id: '00000000-0000-0000-0000-000000000001' },
  asset,
  source: rows[0].source
})
assert.equal(payload.p_material_id, 11)
assert.equal(payload.p_warehouse_id, '00000000-0000-0000-0000-000000000001')
assert.equal(payload.p_quantity, 1250.5)
assert.equal(payload.p_unit, 'kg')
assert.equal(payload.p_batch_no, 'B20260617')
assert.equal(payload.p_operator, 'AI采集员')
assert.equal(payload.p_io_type, '采购入库')
assert.match(payload.p_remark, /供应商：南派供应链/)
assert.match(payload.p_remark, /采购单价：12.3/)
assert.match(payload.p_remark, /采购入库单.xlsx/)

const fallbackTextRows = buildStockInRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '物料编码：RM-002\n仓库编码：WH002\n数量：5箱\n单位：箱\n批次：B-02\n供应商：北区供应商',
    tables: []
  }
})
assert.equal(fallbackTextRows.length, 1)
assert.equal(fallbackTextRows[0].line.materialCode, 'RM-002')
assert.equal(fallbackTextRows[0].line.warehouseCode, 'WH002')
assert.equal(fallbackTextRows[0].line.quantity, 5)
assert.equal(fallbackTextRows[0].line.batchNo, 'B-02')
assert.ok(fallbackTextRows[0].unmappedFields.some((field) => field.name === '原文摘录'))

const remark = buildRpcRemark({
  line: rows[0].line,
  asset,
  source: 'table:Sheet1:row:2'
})
assert.match(remark, /AI来源位置/)

console.log('PASS: document fixed entry regression')
