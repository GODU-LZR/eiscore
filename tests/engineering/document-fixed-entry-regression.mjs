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
process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_STOCK_OUT_IO_TYPE = '销售出库'

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
  buildSalesStockOutRowsFromPlan,
  findSalesStockOutHeaderMapping,
  validateSalesStockOutLine,
  buildStockOutPayload,
  buildStockOutRpcRemark,
  buildProductionWorkReportRowsFromPlan,
  findProductionWorkReportHeaderMapping,
  validateProductionWorkReportLine,
  buildProductionWorkReportPayload,
  findExistingProductionWorkReport,
  insertDuplicateProductionWorkReportBusinessLink,
  buildEquipmentCheckRowsFromPlan,
  findEquipmentCheckHeaderMapping,
  normalizeEquipmentCheckType,
  normalizeEquipmentCheckResult,
  validateEquipmentCheckLine,
  buildEquipmentCheckPayload,
  findExistingEquipmentCheck,
  insertDuplicateEquipmentCheckBusinessLink,
  buildHrRecordRowsFromPlan,
  findHrRecordHeaderMapping,
  normalizeHrEventType,
  normalizeHrRecordStatus,
  validateHrRecordLine,
  buildHrRecordPayload,
  isHrAttendanceSyncCandidate,
  buildHrAttendanceSyncPayload,
  syncHrAttendanceFromRecord,
  markHrAttendanceSyncStatus,
  findExistingHrRecord,
  insertDuplicateHrRecordBusinessLink,
  buildQualityInspectionRowsFromPlan,
  findQualityHeaderMapping,
  normalizeQualityInspectionType,
  normalizeQualityResult,
  validateQualityInspectionLine,
  buildQualityInspectionPayload,
  findExistingQualityInspection,
  insertDuplicateQualityBusinessLink,
  findExistingBusinessLink,
  insertDuplicateBusinessLink,
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

const basicTextRows = buildStockInRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        name: 'table_1',
        columns: ['物料', '数量', '单位', '批次号'],
        rows: [
          { '物料': '冷轧钢卷', '数量': '12', '单位': 'kg', '批次号': 'BASIC-01' }
        ]
      }
    ]
  }
})
assert.equal(basicTextRows.length, 1, 'fixed entry should consume basic parser object-row tables')
assert.equal(basicTextRows[0].line.materialName, '冷轧钢卷')
assert.equal(basicTextRows[0].line.quantity, 12)
assert.equal(basicTextRows[0].line.unit, 'kg')
assert.equal(basicTextRows[0].line.batchNo, 'BASIC-01')

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

const salesHeader = ['出库单号', '销售订单号', '产品编码', '产品名称', '仓库编码', '出库数量', '单位', '批次号', '客户', '收货人', '送货地址', '备注']
const salesMapping = findSalesStockOutHeaderMapping(salesHeader)
assert.equal(salesMapping.get('transactionNo'), 0)
assert.equal(salesMapping.get('salesOrderNo'), 1)
assert.equal(salesMapping.get('materialCode'), 2)
assert.equal(salesMapping.get('warehouseCode'), 4)
assert.equal(salesMapping.get('quantity'), 5)
assert.equal(salesMapping.get('customer'), 8)

const salesRows = buildSalesStockOutRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        sheet_name: '发货',
        rows: [
          salesHeader,
          ['OUT-20260617-001', 'SO-20260617-001', 'FG-001', '香辣虾仁预制菜', 'FG-C02', '160', '盒', 'FG20260617', '广州湾区盒马鲜配', '陈经理', '广州番禺冷链仓', '首批发货'],
          ['', '', '', '', '', '', '', '', '', '', '', '']
        ]
      }
    ]
  }
})
assert.equal(salesRows.length, 1, 'fixed entry should build one sales stock-out row from table data')
assert.equal(salesRows[0].line.transactionNo, 'OUT-20260617-001')
assert.equal(salesRows[0].line.salesOrderNo, 'SO-20260617-001')
assert.equal(salesRows[0].line.materialCode, 'FG-001')
assert.equal(salesRows[0].line.materialName, '香辣虾仁预制菜')
assert.equal(salesRows[0].line.warehouseCode, 'FG-C02')
assert.equal(salesRows[0].line.quantity, 160)
assert.equal(salesRows[0].line.unit, '盒')
assert.equal(salesRows[0].line.batchNo, 'FG20260617')
assert.equal(salesRows[0].line.customer, '广州湾区盒马鲜配')
assert.equal(salesRows[0].line.receiver, '陈经理')
assert.equal(salesRows[0].line.deliveryAddress, '广州番禺冷链仓')
assert.equal(salesRows[0].line.operator, 'AI采集员')
assert.equal(salesRows[0].line.ioType, '销售出库')
assert.ok(salesRows[0].unmappedFields.some((field) => field.name === '客户'))
assert.ok(salesRows[0].unmappedFields.some((field) => field.name === '收货人'))
assert.ok(salesRows[0].unmappedFields.some((field) => field.name === '送货地址'))

const salesTextRows = buildSalesStockOutRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '出库单号：OUT-TEXT-001\n销售订单号：SO-TEXT-001\n产品编码：FG-002\n仓库编码：FG-C01\n数量：12箱\n单位：箱\n批次：FG-B-02\n客户：南派客户',
    tables: []
  }
})
assert.equal(salesTextRows.length, 1)
assert.equal(salesTextRows[0].line.transactionNo, 'OUT-TEXT-001')
assert.equal(salesTextRows[0].line.salesOrderNo, 'SO-TEXT-001')
assert.equal(salesTextRows[0].line.materialCode, 'FG-002')
assert.equal(salesTextRows[0].line.quantity, 12)
assert.equal(salesTextRows[0].line.batchNo, 'FG-B-02')

const salesValidationErrors = validateSalesStockOutLine(salesRows[0].line, {})
assert.ok(salesValidationErrors.includes('未匹配到物料主数据'))
assert.ok(salesValidationErrors.includes('未匹配到仓库/库位'))
assert.deepEqual(validateSalesStockOutLine(salesRows[0].line, {
  material: { id: 21 },
  warehouse: { id: '00000000-0000-0000-0000-000000000002' }
}), [])

const stockOutPayload = buildStockOutPayload({
  line: salesRows[0].line,
  material: { id: 21 },
  warehouse: { id: '00000000-0000-0000-0000-000000000002' },
  asset: { ...asset, original_filename: '销售出库单.xlsx' },
  entryPlan: { ...entryPlan, id: 'sales-plan-1' },
  source: salesRows[0].source,
  index: salesRows[0].rowIndex
})
assert.equal(stockOutPayload.p_material_id, 21)
assert.equal(stockOutPayload.p_warehouse_id, '00000000-0000-0000-0000-000000000002')
assert.equal(stockOutPayload.p_quantity, 160)
assert.equal(stockOutPayload.p_unit, '盒')
assert.equal(stockOutPayload.p_batch_no, 'FG20260617')
assert.equal(stockOutPayload.p_transaction_no, 'OUT-20260617-001')
assert.equal(stockOutPayload.p_operator, 'AI采集员')
assert.equal(stockOutPayload.p_io_type, '销售出库')
assert.equal(stockOutPayload.sales_order_no, 'SO-20260617-001')
assert.equal(stockOutPayload.customer, '广州湾区盒马鲜配')
assert.match(stockOutPayload.p_remark, /客户：广州湾区盒马鲜配/)
assert.match(stockOutPayload.p_remark, /销售出库单.xlsx/)

const generatedStockOutPayload = buildStockOutPayload({
  line: { ...salesRows[0].line, transactionNo: '' },
  material: { id: 21 },
  warehouse: { id: '00000000-0000-0000-0000-000000000002' },
  asset,
  entryPlan: { ...entryPlan, id: 'sales-plan-1' },
  source: 'table:发货:row:3',
  index: 2
})
assert.match(generatedStockOutPayload.p_transaction_no, /^AI-SO-salesplan1-003$/)

const stockOutRemark = buildStockOutRpcRemark({
  line: salesRows[0].line,
  asset,
  source: 'table:发货:row:2'
})
assert.match(stockOutRemark, /销售订单号：SO-20260617-001/)
assert.match(stockOutRemark, /送货地址：广州番禺冷链仓/)

const productionHeader = ['报工单号', '报工日期', '工单号', '产品编码', '产品名称', '工序', '车间', '产线', '班次', '班组', '完工数量', '合格数量', '不良数量', '报废数量', '单位', '报工人', '备注']
const productionMapping = findProductionWorkReportHeaderMapping(productionHeader)
assert.equal(productionMapping.get('reportNo'), 0)
assert.equal(productionMapping.get('reportDate'), 1)
assert.equal(productionMapping.get('workOrderNo'), 2)
assert.equal(productionMapping.get('materialCode'), 3)
assert.equal(productionMapping.get('processName'), 5)
assert.equal(productionMapping.get('completedQty'), 10)
assert.equal(productionMapping.get('defectQty'), 12)

const productionRows = buildProductionWorkReportRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        sheet_name: '生产日报',
        rows: [
          productionHeader,
          ['PR-20260617-001', '2026年6月17日', 'WO-20260617-001', 'FG-001', '香辣虾仁预制菜', '包装', '一车间', '预制菜一线', '白班', 'A组', '300', '292', '6', '2', '盒', '许计划', '订单补货'],
          ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
        ]
      }
    ]
  }
})
assert.equal(productionRows.length, 1, 'fixed entry should build one production work report row from table data')
assert.equal(productionRows[0].line.reportNo, 'PR-20260617-001')
assert.equal(productionRows[0].line.reportDate, '2026-06-17')
assert.equal(productionRows[0].line.workOrderNo, 'WO-20260617-001')
assert.equal(productionRows[0].line.materialCode, 'FG-001')
assert.equal(productionRows[0].line.materialName, '香辣虾仁预制菜')
assert.equal(productionRows[0].line.processName, '包装')
assert.equal(productionRows[0].line.workshopName, '一车间')
assert.equal(productionRows[0].line.productionLine, '预制菜一线')
assert.equal(productionRows[0].line.shiftName, '白班')
assert.equal(productionRows[0].line.teamName, 'A组')
assert.equal(productionRows[0].line.completedQty, 300)
assert.equal(productionRows[0].line.goodQty, 292)
assert.equal(productionRows[0].line.defectQty, 6)
assert.equal(productionRows[0].line.scrapQty, 2)
assert.equal(productionRows[0].line.unit, '盒')
assert.equal(productionRows[0].line.operator, '许计划')

const productionTextRows = buildProductionWorkReportRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '报工单号：PR-TEXT-001\n日期：2026/06/18\n工单号：WO-TEXT-001\n产品编码：FG-002\n工序：蒸煮\n完工数量：120盒\n不良数量：4\n报废数量：1\n单位：盒\n报工人：许计划',
    tables: []
  }
})
assert.equal(productionTextRows.length, 1)
assert.equal(productionTextRows[0].line.reportNo, 'PR-TEXT-001')
assert.equal(productionTextRows[0].line.reportDate, '2026-06-18')
assert.equal(productionTextRows[0].line.workOrderNo, 'WO-TEXT-001')
assert.equal(productionTextRows[0].line.completedQty, 120)
assert.equal(productionTextRows[0].line.goodQty, 115)

const productionValidationErrors = validateProductionWorkReportLine(productionRows[0].line, {})
assert.ok(productionValidationErrors.includes('未匹配到产品/物料主数据'))
assert.deepEqual(validateProductionWorkReportLine(productionRows[0].line, {
  material: { id: 31 },
  workOrder: { unit: '盒' }
}), [])
assert.ok(validateProductionWorkReportLine({ ...productionRows[0].line, defectQty: 301 }, {
  material: { id: 31 },
  workOrder: { unit: '盒' }
}).includes('不良数量和报废数量之和不能大于完工数量'))

const productionPayload = buildProductionWorkReportPayload({
  line: productionRows[0].line,
  material: { id: 31, batch_no: 'FG-001', name: '香辣虾仁预制菜' },
  workOrder: {
    id: '00000000-0000-0000-0000-000000000031',
    work_order_no: 'WO-20260617-001',
    product_material_code: 'FG-001',
    product_material_name: '香辣虾仁预制菜',
    unit: '盒'
  },
  asset: { ...asset, original_filename: '生产日报.xlsx' },
  entryPlan: { ...entryPlan, id: 'production-plan-1' },
  source: productionRows[0].source,
  index: productionRows[0].rowIndex
})
assert.equal(productionPayload.report_no, 'PR-20260617-001')
assert.equal(productionPayload.work_order_id, '00000000-0000-0000-0000-000000000031')
assert.equal(productionPayload.work_order_no, 'WO-20260617-001')
assert.equal(productionPayload.product_material_id, 31)
assert.equal(productionPayload.completed_qty, 300)
assert.equal(productionPayload.good_qty, 292)
assert.equal(productionPayload.defect_qty, 6)
assert.equal(productionPayload.scrap_qty, 2)
assert.equal(productionPayload.properties.ai_generated, true)

const generatedProductionPayload = buildProductionWorkReportPayload({
  line: { ...productionRows[0].line, reportNo: '' },
  material: { id: 31, batch_no: 'FG-001', name: '香辣虾仁预制菜' },
  workOrder: null,
  asset,
  entryPlan: { ...entryPlan, id: 'production-plan-1' },
  source: 'table:生产日报:row:3',
  index: 2
})
assert.match(generatedProductionPayload.report_no, /^AI-PR-productionplan1-003$/)

const equipmentHeader = ['点检单号', '设备编号', '设备名称', '点检类型', '项目数', '异常项数', '点检结果', '点检人', '点检日期', '备注', '温度', '振动']
const equipmentMapping = findEquipmentCheckHeaderMapping(equipmentHeader)
assert.equal(equipmentMapping.get('checkNo'), 0)
assert.equal(equipmentMapping.get('assetNo'), 1)
assert.equal(equipmentMapping.get('assetName'), 2)
assert.equal(equipmentMapping.get('checkItemCount'), 4)
assert.equal(equipmentMapping.get('abnormalCount'), 5)
assert.equal(equipmentMapping.get('checkResult'), 6)
assert.equal(normalizeEquipmentCheckType('开机点检'), '班前点检')
assert.equal(normalizeEquipmentCheckType('专项巡检'), '专项点检')
assert.equal(normalizeEquipmentCheckResult('停线'), '停机')
assert.equal(normalizeEquipmentCheckResult('', { abnormalCount: 2 }), '异常')

const equipmentRows = buildEquipmentCheckRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        sheet_name: '点检',
        rows: [
          equipmentHeader,
          ['EC-20260617-001', 'EQ-FILL-002', '二号灌装机', '班前点检', '18', '1', '异常', '刘铭', '2026年6月17日', '旋盖扭矩偏低', '32', '2.1'],
          ['', '', '', '', '', '', '', '', '', '', '', '']
        ]
      }
    ]
  }
})
assert.equal(equipmentRows.length, 1, 'fixed entry should build one equipment check row from table data')
assert.equal(equipmentRows[0].line.checkNo, 'EC-20260617-001')
assert.equal(equipmentRows[0].line.assetNo, 'EQ-FILL-002')
assert.equal(equipmentRows[0].line.assetName, '二号灌装机')
assert.equal(equipmentRows[0].line.checkType, '班前点检')
assert.equal(equipmentRows[0].line.checkItemCount, 18)
assert.equal(equipmentRows[0].line.abnormalCount, 1)
assert.equal(equipmentRows[0].line.checkResult, '异常')
assert.equal(equipmentRows[0].line.checker, '刘铭')
assert.equal(equipmentRows[0].line.checkDate, '2026-06-17')
assert.ok(equipmentRows[0].unmappedFields.some((field) => field.name === '温度'))
assert.ok(equipmentRows[0].unmappedFields.some((field) => field.name === '振动'))

const equipmentTextRows = buildEquipmentCheckRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '点检单号：EC-TEXT-001\n设备编号：EQ-COLD-001\n设备名称：一号冷库压缩机\n点检类型：日常巡检\n项目数：12\n异常数量：0\n结果：正常\n检查人：陈雨\n日期：2026/06/18',
    tables: []
  }
})
assert.equal(equipmentTextRows.length, 1)
assert.equal(equipmentTextRows[0].line.checkNo, 'EC-TEXT-001')
assert.equal(equipmentTextRows[0].line.assetNo, 'EQ-COLD-001')
assert.equal(equipmentTextRows[0].line.checkResult, '正常')
assert.equal(equipmentTextRows[0].line.checkDate, '2026-06-18')

assert.deepEqual(validateEquipmentCheckLine(equipmentRows[0].line), [])
assert.ok(validateEquipmentCheckLine({ ...equipmentRows[0].line, abnormalCount: 19 }).includes('异常数量不能大于点检项目数'))
assert.ok(validateEquipmentCheckLine({ ...equipmentRows[0].line, assetNo: '', assetName: '' }).includes('缺少设备编号/名称'))

const equipmentPayload = buildEquipmentCheckPayload({
  line: equipmentRows[0].line,
  equipmentAsset: {
    id: '00000000-0000-0000-0000-000000000041',
    asset_no: 'EQ-FILL-002',
    asset_name: '二号灌装机'
  },
  asset: { ...asset, original_filename: '设备点检记录.xlsx' },
  entryPlan: { ...entryPlan, id: 'equipment-plan-1' },
  source: equipmentRows[0].source,
  index: equipmentRows[0].rowIndex,
  unmappedFields: equipmentRows[0].unmappedFields
})
assert.equal(equipmentPayload.check_no, 'EC-20260617-001')
assert.equal(equipmentPayload.asset_id, '00000000-0000-0000-0000-000000000041')
assert.equal(equipmentPayload.asset_no, 'EQ-FILL-002')
assert.equal(equipmentPayload.asset_name, '二号灌装机')
assert.equal(equipmentPayload.check_result, '异常')
assert.equal(equipmentPayload.properties.ai_generated, true)
assert.equal(equipmentPayload.properties.unresolved_asset, false)
assert.ok(equipmentPayload.properties.__ai_unmapped_fields.some((field) => field.name === '温度'))

const generatedEquipmentPayload = buildEquipmentCheckPayload({
  line: { ...equipmentRows[0].line, checkNo: '' },
  equipmentAsset: null,
  asset,
  entryPlan: { ...entryPlan, id: 'equipment-plan-1' },
  source: 'table:点检:row:3',
  index: 2,
  unmappedFields: []
})
assert.match(generatedEquipmentPayload.check_no, /^AI-EC-equipmentplan1-003$/)
assert.equal(generatedEquipmentPayload.properties.unresolved_asset, true)

const hrHeader = ['人事单号', '日期', '员工编号', '员工姓名', '部门', '岗位', '事项', '时长', '加班时长', '请假时长', '缺勤时长', '状态', '经办人', '备注', '餐补']
const hrMapping = findHrRecordHeaderMapping(hrHeader)
assert.equal(hrMapping.get('recordNo'), 0)
assert.equal(hrMapping.get('eventDate'), 1)
assert.equal(hrMapping.get('employeeNo'), 2)
assert.equal(hrMapping.get('employeeName'), 3)
assert.equal(hrMapping.get('eventType'), 6)
assert.equal(hrMapping.get('overtimeHours'), 8)
assert.equal(hrMapping.get('leaveHours'), 9)
assert.equal(normalizeHrEventType('年假申请'), '请假')
assert.equal(normalizeHrEventType('部门调整'), '调岗')
assert.equal(normalizeHrEventType('打卡异常'), '考勤')
assert.equal(normalizeHrRecordStatus('审批通过'), 'confirmed')
assert.equal(normalizeHrRecordStatus('待HR确认'), 'pending_review')

const hrRows = buildHrRecordRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        sheet_name: '人事',
        rows: [
          hrHeader,
          ['HR-20260617-001', '2026年6月17日', 'NP2024030', '宋入职', '人事行政部', '人事专员', '入职', '8', '', '', '', '已确认', '何HR', '资料齐全', '20'],
          ['HR-20260617-002', '2026/06/17', 'NP2024001', '张生产', '生产一部', '操作员', '', '', '2.5', '', '', '待确认', '何HR', '订单赶工', ''],
          ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
        ]
      }
    ]
  }
})
assert.equal(hrRows.length, 2, 'fixed entry should build HR records from table data')
assert.equal(hrRows[0].line.recordNo, 'HR-20260617-001')
assert.equal(hrRows[0].line.eventDate, '2026-06-17')
assert.equal(hrRows[0].line.employeeNo, 'NP2024030')
assert.equal(hrRows[0].line.employeeName, '宋入职')
assert.equal(hrRows[0].line.department, '人事行政部')
assert.equal(hrRows[0].line.position, '人事专员')
assert.equal(hrRows[0].line.eventType, '入职')
assert.equal(hrRows[0].line.hours, 8)
assert.equal(hrRows[0].line.status, 'confirmed')
assert.ok(hrRows[0].unmappedFields.some((field) => field.name === '餐补'))
assert.equal(hrRows[1].line.eventType, '加班', 'overtime hours should infer event type when事项 is blank')
assert.equal(hrRows[1].line.overtimeHours, 2.5)
assert.equal(hrRows[1].line.status, 'pending_review')

const hrTextRows = buildHrRecordRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '员工姓名：李考勤\n员工编号：NP2024002\n日期：2026/06/18\n事项：请假\n请假时长：4小时\n部门：生产一部\n岗位：班长\n状态：审批通过\n经办人：何HR\n备注：病假半天',
    tables: []
  }
})
assert.equal(hrTextRows.length, 1)
assert.equal(hrTextRows[0].line.employeeName, '李考勤')
assert.equal(hrTextRows[0].line.eventDate, '2026-06-18')
assert.equal(hrTextRows[0].line.eventType, '请假')
assert.equal(hrTextRows[0].line.leaveHours, 4)
assert.equal(hrTextRows[0].line.status, 'confirmed')
assert.ok(hrTextRows[0].unmappedFields.some((field) => field.name === '原文摘录'))

assert.deepEqual(validateHrRecordLine(hrRows[0].line), [])
assert.ok(validateHrRecordLine({ ...hrRows[0].line, employeeNo: '', employeeName: '' }).includes('缺少员工编号/姓名'))
assert.ok(validateHrRecordLine({ ...hrRows[0].line, hours: -1 }).includes('hours 不能小于 0'))

const hrPayload = buildHrRecordPayload({
  line: hrRows[0].line,
  asset: { ...asset, original_filename: '人事记录.xlsx' },
  entryPlan: { ...entryPlan, id: 'hr-plan-1', target_module: 'hr', target_document_type: '人事记录' },
  source: hrRows[0].source,
  index: hrRows[0].rowIndex,
  unmappedFields: hrRows[0].unmappedFields
})
assert.equal(hrPayload.record_no, 'HR-20260617-001')
assert.equal(hrPayload.record_date, '2026-06-17')
assert.equal(hrPayload.employee_no, 'NP2024030')
assert.equal(hrPayload.employee_name, '宋入职')
assert.equal(hrPayload.event_type, '入职')
assert.equal(hrPayload.hours, 8)
assert.equal(hrPayload.record_status, 'confirmed')
assert.equal(hrPayload.properties.ai_generated, true)
assert.ok(hrPayload.properties.__ai_unmapped_fields.some((field) => field.name === '餐补'))

const generatedHrPayload = buildHrRecordPayload({
  line: { ...hrRows[1].line, recordNo: '' },
  asset,
  entryPlan: { ...entryPlan, id: 'hr-plan-1' },
  source: 'table:人事:row:3',
  index: 2,
  unmappedFields: []
})
assert.match(generatedHrPayload.record_no, /^AI-HR-hrplan1-003$/)
assert.equal(generatedHrPayload.event_type, '加班')
assert.equal(generatedHrPayload.hours, 2.5)
assert.equal(generatedHrPayload.overtime_hours, 2.5)
assert.equal(isHrAttendanceSyncCandidate(generatedHrPayload), true)
assert.equal(isHrAttendanceSyncCandidate({ ...hrPayload, event_type: '入职' }), false)

const attendanceSyncPayload = buildHrAttendanceSyncPayload({
  payload: generatedHrPayload,
  archive: {
    id: 1001,
    employee_no: 'NP2024001',
    name: '张生产',
    department: '生产一部',
    position: '操作员'
  },
  record: {
    id: '00000000-0000-0000-0000-000000000101'
  }
})
assert.equal(attendanceSyncPayload.att_date, '2026-06-17')
assert.equal(attendanceSyncPayload.employee_id, 1001)
assert.equal(attendanceSyncPayload.employee_no, 'NP2024001')
assert.equal(attendanceSyncPayload.employee_name, '张生产')
assert.equal(attendanceSyncPayload.dept_name, '生产一部')
assert.equal(attendanceSyncPayload.shift_name, '加班补录')
assert.equal(attendanceSyncPayload.overtime_minutes, 150)
assert.equal(attendanceSyncPayload.leave_flag, false)
assert.equal(attendanceSyncPayload.properties.source_hr_record_no, generatedHrPayload.record_no)

const leaveAttendancePayload = buildHrAttendanceSyncPayload({
  payload: {
    ...hrTextRows[0].line,
    ...buildHrRecordPayload({
      line: hrTextRows[0].line,
      asset,
      entryPlan: { ...entryPlan, id: 'hr-plan-leave' },
      source: hrTextRows[0].source,
      index: 0
    })
  },
  archive: {
    id: 1002,
    employee_no: 'NP2024002',
    name: '李考勤',
    department: '生产一部',
    position: '班长'
  },
  record: { id: '00000000-0000-0000-0000-000000000102' }
})
assert.equal(leaveAttendancePayload.shift_name, '请假补录')
assert.equal(leaveAttendancePayload.leave_flag, true)
assert.equal(leaveAttendancePayload.overtime_minutes, 0)

const qualityHeader = ['检验单号', '检验类型', '来源单号', '物料编码', '物料名称', '供应商', '批次号', '抽样数量', '不良数量', '判定', '检验员', '检验日期', '备注', '储存温度']
const qualityMapping = findQualityHeaderMapping(qualityHeader)
assert.equal(qualityMapping.get('docNo'), 0)
assert.equal(qualityMapping.get('inspectionType'), 1)
assert.equal(qualityMapping.get('itemName'), 4)
assert.equal(qualityMapping.get('sampleQty'), 7)
assert.equal(qualityMapping.get('defectQty'), 8)
assert.equal(qualityMapping.get('result'), 9)
assert.equal(normalizeQualityInspectionType('IPQC巡检'), '过程巡检')
assert.equal(normalizeQualityInspectionType('出货抽检'), '成品抽检')
assert.equal(normalizeQualityResult('NG'), '不合格')
assert.equal(normalizeQualityResult('特采放行'), '让步接收')

const qualityRows = buildQualityInspectionRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '',
    tables: [
      {
        sheet_name: 'IQC',
        rows: [
          qualityHeader,
          ['QC-20260617-001', '来料', 'PO-20260617', 'RM-001', '冷轧钢卷', '南派供应链', 'B20260617', '20', '2', '不合格', '马质检', '2026年6月17日', '外观划伤', '-18C'],
          ['', '', '', '', '', '', '', '', '', '', '', '', '', '']
        ]
      }
    ]
  }
})
assert.equal(qualityRows.length, 1, 'fixed entry should build one quality inspection row from table data')
assert.equal(qualityRows[0].line.docNo, 'QC-20260617-001')
assert.equal(qualityRows[0].line.inspectionType, '来料检验')
assert.equal(qualityRows[0].line.sourceDocNo, 'PO-20260617')
assert.equal(qualityRows[0].line.itemCode, 'RM-001')
assert.equal(qualityRows[0].line.itemName, '冷轧钢卷')
assert.equal(qualityRows[0].line.sourceName, '南派供应链')
assert.equal(qualityRows[0].line.batchNo, 'B20260617')
assert.equal(qualityRows[0].line.sampleQty, 20)
assert.equal(qualityRows[0].line.defectQty, 2)
assert.equal(qualityRows[0].line.result, '不合格')
assert.equal(qualityRows[0].line.inspector, '马质检')
assert.equal(qualityRows[0].line.inspectionDate, '2026-06-17')
assert.ok(qualityRows[0].unmappedFields.some((field) => field.name === '储存温度'))

const qualityTextRows = buildQualityInspectionRowsFromPlan({
  entryPlan,
  parseResult: {
    text_content: '检验单号：QC-TEXT-001\n检验类型：首件\n物料名称：虾仁预制菜\n抽样数量：5盒\n不良数量：0\n判定：合格\n检验员：夏检验',
    tables: []
  }
})
assert.equal(qualityTextRows.length, 1)
assert.equal(qualityTextRows[0].line.inspectionType, '首件检验')
assert.equal(qualityTextRows[0].line.itemName, '虾仁预制菜')
assert.equal(qualityTextRows[0].line.sampleQty, 5)
assert.equal(qualityTextRows[0].line.result, '合格')

assert.deepEqual(validateQualityInspectionLine(qualityRows[0].line), [])
assert.ok(validateQualityInspectionLine({ ...qualityRows[0].line, defectQty: 21 }).includes('不良数量不能大于抽样数量'))
assert.ok(validateQualityInspectionLine({ ...qualityRows[0].line, itemName: '' }).includes('缺少检验对象/物料名称'))

const qualityPayload = buildQualityInspectionPayload({
  line: qualityRows[0].line,
  entryPlan: { ...entryPlan, id: 'quality-plan-1', target_module: 'quality', target_document_type: '质量检验单' },
  asset: { ...asset, original_filename: '质检记录.xlsx' },
  source: qualityRows[0].source,
  index: 0
})
assert.equal(qualityPayload.doc_no, 'QC-20260617-001')
assert.equal(qualityPayload.inspection_type, '来料检验')
assert.equal(qualityPayload.item_name, '冷轧钢卷')
assert.equal(qualityPayload.result, '不合格')
assert.equal(qualityPayload.properties.ai_generated, true)

const generatedQualityPayload = buildQualityInspectionPayload({
  line: { ...qualityRows[0].line, docNo: '' },
  entryPlan: { ...entryPlan, id: 'quality-plan-1' },
  asset,
  source: 'table:IQC:row:3',
  index: 2
})
assert.match(generatedQualityPayload.doc_no, /^AI-QC-qualityplan1-003$/)

const remark = buildRpcRemark({
  line: rows[0].line,
  asset,
  source: 'table:Sheet1:row:2'
})
assert.match(remark, /AI来源位置/)

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
          target_schema: 'scm',
          target_table: 'inventory_transactions',
          target_record_id: 'PO-20260617',
          target_module: 'materials',
          target_document_type: '采购入库单',
          target_app_id: null,
          ai_confidence: 0.87,
          metadata: { ai_generated: true },
          created_at: '2026-06-17T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('insert into public.document_business_links')) {
      return { rows: [{ id: 'business-link-duplicate' }] }
    }
    throw new Error(`Unexpected duplicate test query: ${normalized}`)
  }
}

const existingBusinessLink = await findExistingBusinessLink(duplicateClient, {
  targetSchema: 'scm',
  targetTable: 'inventory_transactions',
  targetRecordId: 'PO-20260617'
})
assert.equal(existingBusinessLink.id, 'business-link-original')
assert.equal(existingBusinessLink.target_record_id, 'PO-20260617')

const duplicateQueryCount = duplicateQueries.length
const emptyBusinessLink = await findExistingBusinessLink(duplicateClient, {
  targetSchema: 'scm',
  targetTable: 'inventory_transactions',
  targetRecordId: ''
})
assert.equal(emptyBusinessLink, null, 'blank business record id should not query the link table')
assert.equal(duplicateQueries.length, duplicateQueryCount)

const duplicateTargetRecordId = await insertDuplicateBusinessLink(duplicateClient, {
  asset: {
    id: 'asset-duplicate',
    batch_id: 'batch-duplicate',
    original_filename: '重复采购入库单.xlsx'
  },
  entryPlan: {
    id: 'plan-duplicate',
    batch_id: 'batch-duplicate',
    target_module: 'materials',
    target_document_type: '采购入库单',
    confidence: 0.93
  },
  existingLink: existingBusinessLink,
  targetSchema: 'scm',
  targetTable: 'inventory_transactions',
  targetRecordId: 'PO-20260617',
  payload: {
    p_material_id: 11,
    p_warehouse_id: '00000000-0000-0000-0000-000000000001',
    p_batch_no: 'B20260617'
  },
  row: {
    source: 'table:Sheet1:row:2'
  }
})
assert.equal(duplicateTargetRecordId, 'PO-20260617')

const duplicateInsert = duplicateQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into public.document_business_links')
)
assert.ok(duplicateInsert, 'duplicate business source should be recorded as a trace link')
assert.equal(duplicateInsert.params[0], 'asset-duplicate')
assert.equal(duplicateInsert.params[3], 'scm')
assert.equal(duplicateInsert.params[4], 'inventory_transactions')
assert.equal(duplicateInsert.params[5], 'PO-20260617')
const duplicateMetadata = JSON.parse(duplicateInsert.params[10])
assert.equal(duplicateMetadata.duplicate_business_source, true)
assert.equal(duplicateMetadata.duplicate_reason, 'target_record_already_linked')
assert.equal(duplicateMetadata.duplicate_of_business_link_id, 'business-link-original')
assert.equal(duplicateMetadata.duplicate_of_asset_id, 'asset-original')
assert.equal(duplicateMetadata.skipped_rpc, 'scm.stock_in')

const salesDuplicateTargetRecordId = await insertDuplicateBusinessLink(duplicateClient, {
  asset: {
    id: 'asset-sales-duplicate',
    batch_id: 'batch-sales-duplicate',
    original_filename: '重复销售出库单.xlsx'
  },
  entryPlan: {
    id: 'plan-sales-duplicate',
    batch_id: 'batch-sales-duplicate',
    target_module: 'sales',
    target_document_type: '销售出库单',
    confidence: 0.9
  },
  existingLink: existingBusinessLink,
  targetSchema: 'scm',
  targetTable: 'inventory_transactions',
  targetRecordId: 'OUT-20260617-001',
  payload: stockOutPayload,
  row: {
    source: 'table:发货:row:2'
  },
  skippedRpc: 'scm.stock_out'
})
assert.equal(salesDuplicateTargetRecordId, 'OUT-20260617-001')
const salesDuplicateInsert = duplicateQueries
  .filter((query) => String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into public.document_business_links'))
  .at(-1)
assert.equal(salesDuplicateInsert.params[0], 'asset-sales-duplicate')
assert.equal(salesDuplicateInsert.params[3], 'scm')
assert.equal(salesDuplicateInsert.params[4], 'inventory_transactions')
assert.equal(salesDuplicateInsert.params[5], 'OUT-20260617-001')
const salesDuplicateMetadata = JSON.parse(salesDuplicateInsert.params[10])
assert.equal(salesDuplicateMetadata.duplicate_business_source, true)
assert.equal(salesDuplicateMetadata.skipped_rpc, 'scm.stock_out')
assert.ok(
  !duplicateQueries.some((query) => String(query.sql).toLowerCase().includes('scm.stock_in')),
  'duplicate business source handling must not call the stock-in RPC'
)
assert.ok(
  !duplicateQueries.some((query) => String(query.sql).toLowerCase().includes('scm.stock_out')),
  'duplicate sales business source handling must not call the stock-out RPC'
)

const qualityDuplicateQueries = []
const qualityDuplicateClient = {
  async query(sql, params = []) {
    qualityDuplicateQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from public.quality_inspections')) {
      return {
        rows: [{
          id: 'quality-inspection-original',
          doc_no: 'QC-20260617-001',
          result: '不合格',
          status: 'active',
          created_at: '2026-06-17T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('insert into public.document_business_links')) {
      return { rows: [{ id: 'quality-business-link-duplicate' }] }
    }
    throw new Error(`Unexpected quality duplicate test query: ${normalized}`)
  }
}

const existingQualityInspection = await findExistingQualityInspection(qualityDuplicateClient, 'QC-20260617-001')
assert.equal(existingQualityInspection.id, 'quality-inspection-original')
assert.equal(existingQualityInspection.doc_no, 'QC-20260617-001')

const qualityDuplicateTargetRecordId = await insertDuplicateQualityBusinessLink(qualityDuplicateClient, {
  asset: {
    id: 'asset-quality-duplicate',
    batch_id: 'batch-quality-duplicate',
    original_filename: '重复质检记录.xlsx'
  },
  entryPlan: {
    id: 'plan-quality-duplicate',
    batch_id: 'batch-quality-duplicate',
    target_module: 'quality',
    target_document_type: '质量检验单',
    confidence: 0.91
  },
  existingLink: null,
  existingInspection: existingQualityInspection,
  payload: qualityPayload,
  row: {
    source: 'table:IQC:row:2'
  }
})
assert.equal(qualityDuplicateTargetRecordId, 'QC-20260617-001')
const qualityDuplicateInsert = qualityDuplicateQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into public.document_business_links')
)
assert.ok(qualityDuplicateInsert, 'duplicate quality source should be recorded as a trace link')
assert.equal(qualityDuplicateInsert.params[3], 'public')
assert.equal(qualityDuplicateInsert.params[4], 'quality_inspections')
assert.equal(qualityDuplicateInsert.params[5], 'QC-20260617-001')
const qualityDuplicateMetadata = JSON.parse(qualityDuplicateInsert.params[10])
assert.equal(qualityDuplicateMetadata.duplicate_business_source, true)
assert.equal(qualityDuplicateMetadata.duplicate_reason, 'quality_doc_no_already_exists')
assert.equal(qualityDuplicateMetadata.existing_quality_inspection_id, 'quality-inspection-original')
assert.ok(
  !qualityDuplicateQueries.some((query) => String(query.sql).toLowerCase().includes('insert into public.quality_inspections')),
  'duplicate quality source handling must not insert a second quality inspection record'
)

const productionDuplicateQueries = []
const productionDuplicateClient = {
  async query(sql, params = []) {
    productionDuplicateQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from scm.production_work_reports')) {
      return {
        rows: [{
          id: 'production-work-report-original',
          report_no: 'PR-20260617-001',
          work_order_no: 'WO-20260617-001',
          report_status: 'active',
          created_at: '2026-06-17T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('insert into public.document_business_links')) {
      return { rows: [{ id: 'production-business-link-duplicate' }] }
    }
    throw new Error(`Unexpected production duplicate test query: ${normalized}`)
  }
}

const existingProductionReport = await findExistingProductionWorkReport(productionDuplicateClient, 'PR-20260617-001')
assert.equal(existingProductionReport.id, 'production-work-report-original')
assert.equal(existingProductionReport.report_no, 'PR-20260617-001')

const productionDuplicateTargetRecordId = await insertDuplicateProductionWorkReportBusinessLink(productionDuplicateClient, {
  asset: {
    id: 'asset-production-duplicate',
    batch_id: 'batch-production-duplicate',
    original_filename: '重复生产日报.xlsx'
  },
  entryPlan: {
    id: 'plan-production-duplicate',
    batch_id: 'batch-production-duplicate',
    target_module: 'production',
    target_document_type: '生产日报',
    confidence: 0.89
  },
  existingLink: null,
  existingReport: existingProductionReport,
  payload: productionPayload,
  row: {
    source: 'table:生产日报:row:2'
  }
})
assert.equal(productionDuplicateTargetRecordId, 'PR-20260617-001')
const productionDuplicateInsert = productionDuplicateQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into public.document_business_links')
)
assert.ok(productionDuplicateInsert, 'duplicate production source should be recorded as a trace link')
assert.equal(productionDuplicateInsert.params[3], 'scm')
assert.equal(productionDuplicateInsert.params[4], 'production_work_reports')
assert.equal(productionDuplicateInsert.params[5], 'PR-20260617-001')
const productionDuplicateMetadata = JSON.parse(productionDuplicateInsert.params[10])
assert.equal(productionDuplicateMetadata.duplicate_business_source, true)
assert.equal(productionDuplicateMetadata.duplicate_reason, 'production_report_no_already_exists')
assert.equal(productionDuplicateMetadata.existing_production_work_report_id, 'production-work-report-original')
assert.ok(
  !productionDuplicateQueries.some((query) => String(query.sql).toLowerCase().includes('insert into scm.production_work_reports')),
  'duplicate production source handling must not insert a second production work report record'
)

const equipmentDuplicateQueries = []
const equipmentDuplicateClient = {
  async query(sql, params = []) {
    equipmentDuplicateQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from public.equipment_checks')) {
      return {
        rows: [{
          id: 'equipment-check-original',
          check_no: 'EC-20260617-001',
          asset_no: 'EQ-FILL-002',
          asset_name: '二号灌装机',
          check_result: '异常',
          status: 'active',
          created_at: '2026-06-17T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('insert into public.document_business_links')) {
      return { rows: [{ id: 'equipment-business-link-duplicate' }] }
    }
    throw new Error(`Unexpected equipment duplicate test query: ${normalized}`)
  }
}

const existingEquipmentCheck = await findExistingEquipmentCheck(equipmentDuplicateClient, 'EC-20260617-001')
assert.equal(existingEquipmentCheck.id, 'equipment-check-original')
assert.equal(existingEquipmentCheck.check_no, 'EC-20260617-001')

const equipmentDuplicateTargetRecordId = await insertDuplicateEquipmentCheckBusinessLink(equipmentDuplicateClient, {
  asset: {
    id: 'asset-equipment-duplicate',
    batch_id: 'batch-equipment-duplicate',
    original_filename: '重复设备点检记录.xlsx'
  },
  entryPlan: {
    id: 'plan-equipment-duplicate',
    batch_id: 'batch-equipment-duplicate',
    target_module: 'equipment',
    target_document_type: '设备点检记录',
    confidence: 0.88
  },
  existingLink: null,
  existingCheck: existingEquipmentCheck,
  payload: equipmentPayload,
  row: {
    source: 'table:点检:row:2'
  }
})
assert.equal(equipmentDuplicateTargetRecordId, 'EC-20260617-001')
const equipmentDuplicateInsert = equipmentDuplicateQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into public.document_business_links')
)
assert.ok(equipmentDuplicateInsert, 'duplicate equipment source should be recorded as a trace link')
assert.equal(equipmentDuplicateInsert.params[3], 'public')
assert.equal(equipmentDuplicateInsert.params[4], 'equipment_checks')
assert.equal(equipmentDuplicateInsert.params[5], 'EC-20260617-001')
const equipmentDuplicateMetadata = JSON.parse(equipmentDuplicateInsert.params[10])
assert.equal(equipmentDuplicateMetadata.duplicate_business_source, true)
assert.equal(equipmentDuplicateMetadata.duplicate_reason, 'equipment_check_no_already_exists')
assert.equal(equipmentDuplicateMetadata.existing_equipment_check_id, 'equipment-check-original')
assert.ok(
  !equipmentDuplicateQueries.some((query) => String(query.sql).toLowerCase().includes('insert into public.equipment_checks')),
  'duplicate equipment source handling must not insert a second equipment check record'
)

const hrDuplicateQueries = []
const hrDuplicateClient = {
  async query(sql, params = []) {
    hrDuplicateQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from hr.document_intake_records')) {
      return {
        rows: [{
          id: 'hr-record-original',
          record_no: 'HR-20260617-001',
          employee_no: 'NP2024030',
          employee_name: '宋入职',
          event_type: '入职',
          record_status: 'confirmed',
          created_at: '2026-06-17T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('insert into public.document_business_links')) {
      return { rows: [{ id: 'hr-business-link-duplicate' }] }
    }
    throw new Error(`Unexpected HR duplicate test query: ${normalized}`)
  }
}

const existingHrRecord = await findExistingHrRecord(hrDuplicateClient, 'HR-20260617-001')
assert.equal(existingHrRecord.id, 'hr-record-original')
assert.equal(existingHrRecord.record_no, 'HR-20260617-001')

const hrDuplicateTargetRecordId = await insertDuplicateHrRecordBusinessLink(hrDuplicateClient, {
  asset: {
    id: 'asset-hr-duplicate',
    batch_id: 'batch-hr-duplicate',
    original_filename: '重复人事记录.xlsx'
  },
  entryPlan: {
    id: 'plan-hr-duplicate',
    batch_id: 'batch-hr-duplicate',
    target_module: 'hr',
    target_document_type: '人事记录',
    confidence: 0.86
  },
  existingLink: null,
  existingRecord: existingHrRecord,
  payload: hrPayload,
  row: {
    source: 'table:人事:row:2'
  }
})
assert.equal(hrDuplicateTargetRecordId, 'HR-20260617-001')
const hrDuplicateInsert = hrDuplicateQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into public.document_business_links')
)
assert.ok(hrDuplicateInsert, 'duplicate HR source should be recorded as a trace link')
assert.equal(hrDuplicateInsert.params[3], 'hr')
assert.equal(hrDuplicateInsert.params[4], 'document_intake_records')
assert.equal(hrDuplicateInsert.params[5], 'HR-20260617-001')
const hrDuplicateMetadata = JSON.parse(hrDuplicateInsert.params[10])
assert.equal(hrDuplicateMetadata.duplicate_business_source, true)
assert.equal(hrDuplicateMetadata.duplicate_reason, 'hr_record_no_already_exists')
assert.equal(hrDuplicateMetadata.existing_hr_record_id, 'hr-record-original')
assert.ok(
  !hrDuplicateQueries.some((query) => String(query.sql).toLowerCase().includes('insert into hr.document_intake_records')),
  'duplicate HR source handling must not insert a second HR record'
)

const hrAttendanceSyncQueries = []
const hrAttendanceSyncClient = {
  async query(sql, params = []) {
    hrAttendanceSyncQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.startsWith('savepoint') || normalized.startsWith('release savepoint') || normalized.startsWith('rollback to savepoint')) {
      return { rows: [] }
    }
    if (normalized.includes('select to_regclass')) {
      return { rows: [{ object_name: params[0] }] }
    }
    if (normalized.includes('from hr.archives') && normalized.includes('employee_no')) {
      return {
        rows: [{
          id: 1001,
          employee_no: 'NP2024001',
          name: '张生产',
          department: '生产一部',
          position: '操作员'
        }]
      }
    }
    if (normalized.includes('insert into hr.attendance_records')) {
      return {
        rows: [{
          id: 'attendance-record-1001',
          att_date: '2026-06-17',
          employee_id: 1001,
          employee_no: 'NP2024001'
        }]
      }
    }
    if (normalized.includes('update hr.document_intake_records')) {
      return { rows: [] }
    }
    throw new Error(`Unexpected HR attendance sync test query: ${normalized}`)
  }
}

const attendanceSyncResult = await syncHrAttendanceFromRecord(hrAttendanceSyncClient, {
  payload: generatedHrPayload,
  record: { id: 'hr-record-sync-1' }
})
assert.equal(attendanceSyncResult.status, 'synced')
assert.equal(attendanceSyncResult.attendanceRecordId, 'attendance-record-1001')
const attendanceInsert = hrAttendanceSyncQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('insert into hr.attendance_records')
)
assert.ok(attendanceInsert, 'HR attendance sync should upsert into hr.attendance_records')
assert.equal(attendanceInsert.params[0], '2026-06-17')
assert.equal(attendanceInsert.params[2], 1001)
assert.equal(attendanceInsert.params[4], 'NP2024001')
assert.equal(attendanceInsert.params[18], 150)
assert.match(attendanceInsert.params[19], /AI人事记录/)

await markHrAttendanceSyncStatus(hrAttendanceSyncClient, {
  record: { id: 'hr-record-sync-1' },
  syncResult: attendanceSyncResult
})
const attendanceStatusUpdate = hrAttendanceSyncQueries.find((query) =>
  String(query.sql).replace(/\s+/g, ' ').trim().toLowerCase().includes('update hr.document_intake_records')
)
assert.ok(attendanceStatusUpdate, 'HR attendance sync status should be written back to the HR document record')
assert.equal(attendanceStatusUpdate.params[0], 'hr-record-sync-1')
assert.equal(attendanceStatusUpdate.params[1], 'attendance-record-1001')
assert.equal(attendanceStatusUpdate.params[2], 'synced')

const hrAttendanceSkipClient = {
  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.startsWith('savepoint') || normalized.startsWith('release savepoint') || normalized.startsWith('rollback to savepoint')) {
      return { rows: [] }
    }
    if (normalized.includes('select to_regclass')) {
      return { rows: [{ object_name: params[0] === 'hr.attendance_records' ? 'hr.attendance_records' : null }] }
    }
    throw new Error(`Unexpected HR attendance skip test query: ${normalized}`)
  }
}
const attendanceSkipResult = await syncHrAttendanceFromRecord(hrAttendanceSkipClient, {
  payload: generatedHrPayload,
  record: { id: 'hr-record-sync-2' }
})
assert.equal(attendanceSkipResult.status, 'skipped')
assert.match(attendanceSkipResult.message, /hr\.archives/)

console.log('PASS: document fixed entry regression')
