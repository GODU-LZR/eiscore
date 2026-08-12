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
  poolOptions: null,
  workerClient: null
}

class FakePool {
  constructor(options) {
    state.poolOptions = options
  }

  async connect() {
    if (!state.workerClient) throw new Error('No fake worker client configured')
    return state.workerClient
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
  createDocumentEntryWorker,
  buildRecordsFromPlan,
  sanitizeIdentifier,
  normalizeColumns,
  findHeaderMapping,
  makeAiSupplementRemark,
  buildBusinessDedupeSignature,
  findExistingBusinessDedupeLink,
  insertDuplicateBusinessLink
} = require(modulePath)
const { deriveBatchImportStatus, updateBatchStatusFromAssets } = require('../../realtime/document-batch-status')
Module._load = originalLoad

assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')
assert.equal(state.poolOptions.max, 3, 'invalid entry pool max env should fall back to 3')
assert.equal(deriveBatchImportStatus({ successCount: 2, remainingCount: 0 }), 'completed')
assert.equal(deriveBatchImportStatus({ successCount: 1, failedCount: 1, remainingCount: 0 }), 'partial')
assert.equal(deriveBatchImportStatus({ failedCount: 2, remainingCount: 0 }), 'failed')
assert.equal(deriveBatchImportStatus({ successCount: 1, remainingCount: 1 }), 'importing')

const batchStatusQueries = []
const batchStatusUpdate = await updateBatchStatusFromAssets({
  async query(sql, params = []) {
    batchStatusQueries.push({ sql, params })
    if (String(sql).includes('from public.document_assets')) {
      return {
        rows: [{
          file_count: 3,
          success_count: 1,
          partial_count: 1,
          failed_count: 1,
          duplicate_count: 0,
          remaining_count: 0
        }]
      }
    }
    return { rows: [] }
  }
}, 'batch-1', { worker: 'test-worker' })
assert.equal(batchStatusUpdate.status, 'partial')
assert.equal(batchStatusQueries.length, 2)
assert.equal(batchStatusQueries[1].params[6], 'partial', 'batch update should persist derived partial status')
assert.equal(batchStatusQueries[1].params[7], true, 'batch update should finish terminal batches')
assert.match(batchStatusQueries[1].params[8], /test-worker/)

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

const dedupeSignature = buildBusinessDedupeSignature({
  schemaName: 'app_data',
  tableName: 'purchase_receipts',
  appId: '11111111-1111-4111-8111-111111111111',
  payload: {
    supplier_name: '南派供应链',
    document_no: 'PO-2026-0617',
    quantity: 12.5,
    properties: { ignored: true }
  }
})
assert.ok(dedupeSignature, 'strong document number should produce a dynamic app business dedupe signature')
assert.equal(dedupeSignature.field, 'document_no')
assert.equal(dedupeSignature.fieldKey, 'documentno')
assert.match(dedupeSignature.key, /purchase_receipts/)
assert.match(dedupeSignature.key, /documentno=po20260617/)

const noDedupeSignature = buildBusinessDedupeSignature({
  schemaName: 'app_data',
  tableName: 'purchase_receipts',
  payload: {
    supplier_name: '南派供应链',
    batch_no: 'B-01',
    quantity: 12.5
  }
})
assert.equal(noDedupeSignature, null, 'batch and quantity alone should not block dynamic app import')

const duplicateQueries = []
const duplicateClient = {
  async query(sql, params = []) {
    duplicateQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from public.document_business_links')) {
      return {
        rows: [{
          id: 'business-link-original',
          asset_id: 'asset-original',
          batch_id: 'batch-original',
          entry_plan_id: 'plan-original',
          target_schema: 'app_data',
          target_table: 'purchase_receipts',
          target_record_id: 'receipt-001',
          target_module: 'app_data',
          target_document_type: '采购收货单',
          target_app_id: '11111111-1111-4111-8111-111111111111',
          ai_confidence: 0.91,
          metadata: { business_dedupe_key: dedupeSignature.key },
          created_at: '2026-06-17T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('insert into public.document_business_links')) {
      return { rows: [{ id: 'business-link-duplicate' }] }
    }
    throw new Error(`Unexpected dynamic duplicate query: ${normalized}`)
  }
}

const existingDynamicBusinessLink = await findExistingBusinessDedupeLink(duplicateClient, {
  schemaName: 'app_data',
  tableName: 'purchase_receipts',
  appId: '11111111-1111-4111-8111-111111111111',
  dedupeKey: dedupeSignature.key
})
assert.equal(existingDynamicBusinessLink.id, 'business-link-original')
assert.equal(existingDynamicBusinessLink.target_record_id, 'receipt-001')

const duplicateRecordId = await insertDuplicateBusinessLink(duplicateClient, {
  asset: {
    id: 'asset-duplicate',
    batch_id: 'batch-duplicate',
    original_filename: '重复采购收货单.xlsx'
  },
  entryPlan: {
    id: 'plan-duplicate',
    app_id: '11111111-1111-4111-8111-111111111111',
    target_module: 'app_data',
    target_document_type: '采购收货单',
    confidence: 0.88
  },
  existingLink: existingDynamicBusinessLink,
  schemaName: 'app_data',
  tableName: 'purchase_receipts',
  dedupeSignature,
  record: {
    source: 'table:Sheet1:row:2'
  }
})
assert.equal(duplicateRecordId, 'receipt-001')
const duplicateInsert = duplicateQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into public.document_business_links')
)
assert.ok(duplicateInsert, 'dynamic app duplicate source should be recorded as a business link')
assert.equal(duplicateInsert.params[0], 'asset-duplicate')
assert.equal(duplicateInsert.params[3], 'app_data')
assert.equal(duplicateInsert.params[4], 'purchase_receipts')
assert.equal(duplicateInsert.params[5], 'receipt-001')
const duplicateMetadata = JSON.parse(duplicateInsert.params[10])
assert.equal(duplicateMetadata.duplicate_business_source, true)
assert.equal(duplicateMetadata.duplicate_reason, 'business_dedupe_key_already_linked')
assert.equal(duplicateMetadata.duplicate_of_business_link_id, 'business-link-original')
assert.equal(duplicateMetadata.business_dedupe_key, dedupeSignature.key)
assert.equal(duplicateMetadata.business_dedupe_field, 'document_no')
assert.equal(duplicateMetadata.business_dedupe_value, 'PO-2026-0617')
assert.ok(
  !duplicateQueries.some((query) => String(query.sql).toLowerCase().includes('insert into app_data')),
  'dynamic app duplicate handling must not insert another app_data business record'
)

const workerQueries = []
const workerFinalPlanUpdates = []
state.workerClient = {
  async query(sql, params = []) {
    workerQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (['begin', 'commit', 'rollback'].includes(normalized)) return { rows: [] }
    if (
      normalized.includes('from public.document_entry_plans p') &&
      normalized.includes('join public.document_assets a') &&
      normalized.includes('for update of p skip locked')
    ) {
      return {
        rows: [{
          id: 'plan-worker-duplicate',
          batch_id: 'batch-worker',
          app_id: '11111111-1111-4111-8111-111111111111',
          target_kind: 'data_app',
          target_schema: 'app_data',
          target_table: 'purchase_receipts',
          target_module: 'app_data',
          target_document_type: '采购收货单',
          confidence: 0.9,
          columns_snapshot: [
            { field: 'document_no', label: '单据号', type: 'text' },
            { field: 'supplier_name', label: '供应商', type: 'text' },
            { field: 'quantity', label: '数量', type: 'number' }
          ],
          documents: [],
          asset_id: 'asset-worker-duplicate',
          asset_batch_id: 'batch-worker',
          device_id: 'device-worker',
          uploaded_by_user_id: 'user-worker',
          original_filename: '重复动态收货单.xlsx',
          text_content: '',
          tables: [
            {
              rows: [
                ['单据号', '供应商', '数量'],
                ['PO-2026-0617', '南派供应链', '12.5']
              ]
            }
          ],
          parse_metadata: {}
        }]
      }
    }
    if (normalized.includes('select app_center.create_data_app_table')) return { rows: [{ table_name: 'purchase_receipts' }] }
    if (normalized.includes('from information_schema.columns')) {
      return { rows: ['document_no', 'supplier_name', 'quantity', 'properties'].map((column_name) => ({ column_name })) }
    }
    if (normalized.includes('from public.document_business_links')) {
      return {
        rows: [{
          id: 'business-link-original',
          asset_id: 'asset-original',
          batch_id: 'batch-original',
          entry_plan_id: 'plan-original',
          target_schema: 'app_data',
          target_table: 'purchase_receipts',
          target_record_id: 'receipt-001',
          target_module: 'app_data',
          target_document_type: '采购收货单',
          target_app_id: '11111111-1111-4111-8111-111111111111',
          ai_confidence: 0.91,
          metadata: { business_dedupe_key: dedupeSignature.key },
          created_at: '2026-06-17T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('insert into public.document_business_links')) return { rows: [{ id: 'business-link-worker-duplicate' }] }
    if (normalized.includes('update public.document_entry_plans') && normalized.includes('set status = $2')) {
      workerFinalPlanUpdates.push(params)
      return { rows: [] }
    }
    if (normalized.includes('update public.document_entry_plans')) return { rows: [] }
    if (normalized.includes('update public.document_assets')) return { rows: [] }
    if (normalized.includes('count(*)::integer as file_count')) {
      return {
        rows: [{
          file_count: 1,
          success_count: 1,
          partial_count: 0,
          failed_count: 0,
          duplicate_count: 0,
          remaining_count: 0
        }]
      }
    }
    if (normalized.includes('update public.document_import_batches')) return { rows: [] }
    throw new Error(`Unexpected worker query: ${normalized}`)
  },
  release() {}
}

const worker = createDocumentEntryWorker({ log: { info() {}, warn() {} } })
const workerProcessed = await worker.processOne()
assert.equal(workerProcessed, true, 'worker should process the duplicate dynamic app plan')
assert.ok(
  !workerQueries.some((query) => String(query.sql).toLowerCase().includes('insert into app_data')),
  'worker duplicate branch should not insert another dynamic business row'
)
assert.equal(workerFinalPlanUpdates.length, 1)
assert.equal(workerFinalPlanUpdates[0][1], 'skipped_duplicate')
const workerPlanMetadata = JSON.parse(workerFinalPlanUpdates[0][2])
assert.equal(workerPlanMetadata.imported_count, 0)
assert.equal(workerPlanMetadata.duplicate_count, 1)
assert.deepEqual(workerPlanMetadata.duplicate_target_record_ids, ['receipt-001'])
state.workerClient = null

console.log('PASS: document entry regression')
