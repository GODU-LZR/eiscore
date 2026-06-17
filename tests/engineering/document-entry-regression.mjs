// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Module = require('node:module')

process.env.DOCUMENT_ENTRY_POLL_INTERVAL_MS = 'bad-interval'
process.env.DOCUMENT_ENTRY_PG_POOL_MAX = 'bad-pool'
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

const modulePath = '../../realtime/document-entry.js'
delete require.cache[require.resolve(modulePath)]
const {
  buildRecordsFromPlan,
  sanitizeIdentifier,
  normalizeColumns,
  findHeaderMapping,
  makeAiSupplementRemark
} = require(modulePath)
Module._load = originalLoad

assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')
assert.equal(state.poolOptions.max, 3, 'invalid entry pool max env should fall back to 3')

assert.equal(sanitizeIdentifier('供应商 Name'), 'name')
assert.equal(sanitizeIdentifier('supplier-name'), 'supplier_name')

const asset = {
  id: 'asset-1',
  batch_id: 'batch-1',
  device_id: 'device-1',
  uploaded_by_user_id: 'u-1',
  original_filename: '外协加工单.xlsx'
}

const entryPlan = {
  id: 'plan-1',
  batch_id: 'batch-1',
  confidence: 0.88,
  columns_snapshot: [
    { field: 'supplier_name', label: '供应商', aliases: ['加工商'], type: 'text' },
    { field: 'furnace_no', label: '炉号', type: 'text' },
    { field: 'quantity', label: '数量', type: 'number' },
    { field: 'remark', label: '备注', type: 'text' }
  ],
  documents: []
}

const columns = normalizeColumns(entryPlan.columns_snapshot)
const mapping = findHeaderMapping(['加工商', '炉号', '数量', '客户特殊要求'], columns)
assert.equal(mapping.get('supplier_name'), 0)
assert.equal(mapping.get('furnace_no'), 1)
assert.equal(mapping.get('quantity'), 2)

const tableRecords = buildRecordsFromPlan({
  asset,
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        sheet_name: 'Sheet1',
        row_count: 3,
        rows: [
          ['加工商', '炉号', '数量', '客户特殊要求'],
          ['南派外协', 'A-01', '12.5', '出货前拍照'],
          ['北区外协', 'B-02', '8', '加贴标签']
        ]
      }
    ]
  },
  availableColumnNames: ['id', 'supplier_name', 'furnace_no', 'quantity', 'remark', 'properties']
})

assert.equal(tableRecords.length, 2)
assert.equal(tableRecords[0].payload.supplier_name, '南派外协')
assert.equal(tableRecords[0].payload.quantity, 12.5)
assert.match(tableRecords[0].payload.remark, /客户特殊要求/)
assert.equal(tableRecords[0].payload.properties.ai_generated, true)
assert.equal(tableRecords[0].payload.properties.__ai_unmapped_fields[0].name, '客户特殊要求')

const noRemarkRecords = buildRecordsFromPlan({
  asset,
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        rows: [
          ['供应商', '炉号', '数量', '未匹配字段'],
          ['南派外协', 'A-01', '12.5', '纸箱']
        ]
      }
    ]
  },
  availableColumnNames: ['supplier_name', 'furnace_no', 'quantity', 'properties']
})

assert.equal(noRemarkRecords.length, 1)
assert.equal(noRemarkRecords[0].payload.remark, undefined)
assert.equal(noRemarkRecords[0].payload.properties.__ai_unmapped_fields[0].value, '纸箱')

const textRecords = buildRecordsFromPlan({
  asset,
  entryPlan,
  parseResult: {
    text_content: '供应商：南派外协\n炉号：A-03\n数量：5\n包装方式：纸箱',
    tables: []
  },
  availableColumnNames: ['supplier_name', 'furnace_no', 'quantity', 'properties']
})

assert.equal(textRecords.length, 1)
assert.equal(textRecords[0].payload.supplier_name, '南派外协')
assert.equal(textRecords[0].payload.furnace_no, 'A-03')
assert.equal(textRecords[0].payload.quantity, 5)
assert.match(textRecords[0].payload.properties.__ai_unmapped_fields[0].value, /包装方式/)

const remark = makeAiSupplementRemark([{ name: '包装方式', value: '纸箱' }], 'source.pdf')
assert.match(remark, /AI未匹配字段/)
assert.match(remark, /source.pdf/)

console.log('PASS: document entry regression')
