// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const { Pool } = require('pg');
const { updateBatchStatusFromAssets } = require('./document-batch-status');

const envText = (value, fallback = '') => String(value ?? fallback).trim();
function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

const fixedEntryWorkerEnabled = envText(process.env.DOCUMENT_FIXED_ENTRY_WORKER_ENABLED, 'true').toLowerCase() !== 'false';
const pollIntervalMs = positiveInteger(process.env.DOCUMENT_FIXED_ENTRY_POLL_INTERVAL_MS, 12000, { min: 2000, max: 10 * 60 * 1000 });
const maxRowsPerPlan = positiveInteger(process.env.DOCUMENT_FIXED_ENTRY_MAX_ROWS_PER_PLAN, 200, { min: 1, max: 5000 });
const defaultOperator = envText(process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_OPERATOR, 'collector_agent') || 'collector_agent';
const defaultIoType = envText(process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_IO_TYPE, '采购入库') || '采购入库';
const defaultStockOutIoType = envText(process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_STOCK_OUT_IO_TYPE, '销售出库') || '销售出库';
const defaultWarehouseCode = envText(process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_WAREHOUSE_CODE, '');
const defaultWarehouseName = envText(process.env.DOCUMENT_FIXED_ENTRY_DEFAULT_WAREHOUSE_NAME, '');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: positiveInteger(process.env.PGPORT, 5432, { min: 1, max: 65535 }),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: positiveInteger(process.env.DOCUMENT_FIXED_ENTRY_PG_POOL_MAX, 3, { min: 1, max: 20 })
});

const fieldDefinitions = [
  {
    field: 'materialCode',
    aliases: ['物料编码', '物料代码', '物料编号', '料号', '品号', '原料编码', '材料编码', 'material_code', 'material no', 'item code']
  },
  {
    field: 'materialName',
    aliases: ['物料', '物料名称', '原料', '原料名称', '材料', '材料名称', '品名', '名称', 'material_name', 'item name']
  },
  {
    field: 'warehouseCode',
    aliases: ['仓库编码', '库位编码', '仓位编码', '货位编码', 'warehouse_code', 'location_code', 'wh code']
  },
  {
    field: 'warehouseName',
    aliases: ['仓库', '库位', '仓位', '货位', '仓库名称', '库位名称', 'warehouse', 'location']
  },
  {
    field: 'quantity',
    aliases: ['数量', '入库数量', '实收数量', '收货数量', '到货数量', 'qty', 'quantity']
  },
  {
    field: 'unit',
    aliases: ['单位', '计量单位', 'unit', 'uom']
  },
  {
    field: 'batchNo',
    aliases: ['批次', '批号', '批次号', '炉号', '卷号', 'lot', 'batch', 'batch_no']
  },
  {
    field: 'transactionNo',
    aliases: ['单据号', '入库单号', '送货单号', '采购单号', 'transaction_no', 'document_no', 'bill_no']
  },
  {
    field: 'productionDate',
    aliases: ['生产日期', '出厂日期', '制造日期', 'production_date', 'mfg_date']
  },
  {
    field: 'supplier',
    aliases: ['供应商', '供应商名称', '厂家', 'supplier', 'vendor']
  },
  {
    field: 'purchasePrice',
    aliases: ['采购单价', '单价', '价格', 'purchase_price', 'price']
  },
  {
    field: 'operator',
    aliases: ['操作员', '经办人', '收货人', '仓管员', 'operator', 'handler']
  },
  {
    field: 'ioType',
    aliases: ['入库类型', '业务类型', '类型', 'io_type', 'stock_in_type']
  },
  {
    field: 'remark',
    aliases: ['备注', '说明', 'remark', 'remarks', 'note', 'comment']
  }
];

const qualityFieldDefinitions = [
  {
    field: 'docNo',
    aliases: ['检验单号', '质检单号', '单据号', '报告编号', 'doc_no', 'inspection_no', 'report_no']
  },
  {
    field: 'inspectionType',
    aliases: ['检验类型', '质检类型', '类型', 'inspection_type', 'qc_type']
  },
  {
    field: 'sourceDocNo',
    aliases: ['来源单号', '采购单号', '送货单号', '生产单号', '工单号', 'source_doc_no', 'source_no']
  },
  {
    field: 'itemCode',
    aliases: ['物料编码', '产品编码', '品号', '料号', 'item_code', 'material_code', 'product_code']
  },
  {
    field: 'itemName',
    aliases: ['物料名称', '产品名称', '检验对象', '品名', '名称', 'item_name', 'material_name', 'product_name']
  },
  {
    field: 'sourceName',
    aliases: ['供应商', '客户', '产线', '车间', '来源名称', 'source_name', 'supplier', 'customer', 'line']
  },
  {
    field: 'batchNo',
    aliases: ['批次', '批号', '批次号', '炉号', 'lot', 'batch', 'batch_no']
  },
  {
    field: 'sampleQty',
    aliases: ['抽样数量', '样本数', '检验数量', '送检数量', 'sample_qty', 'sample_count']
  },
  {
    field: 'defectQty',
    aliases: ['不良数量', '缺陷数量', '不合格数量', '报废数量', 'defect_qty', 'ng_qty']
  },
  {
    field: 'result',
    aliases: ['判定', '检验结果', '质检结果', '结果', 'result', 'inspection_result']
  },
  {
    field: 'inspector',
    aliases: ['检验员', '质检员', '检查人', 'inspector', 'qc_user']
  },
  {
    field: 'inspectionDate',
    aliases: ['检验日期', '质检日期', '日期', 'inspection_date', 'qc_date']
  },
  {
    field: 'remark',
    aliases: ['备注', '说明', '异常描述', 'remark', 'remarks', 'note', 'comment']
  }
];

const salesStockOutFieldDefinitions = [
  {
    field: 'materialCode',
    aliases: ['物料编码', '产品编码', '商品编码', '品号', '料号', 'material_code', 'product_code', 'item_code']
  },
  {
    field: 'materialName',
    aliases: ['物料', '物料名称', '产品', '产品名称', '商品', '商品名称', '品名', '名称', 'material_name', 'product_name', 'item_name']
  },
  {
    field: 'warehouseCode',
    aliases: ['仓库编码', '库位编码', '仓位编码', '货位编码', 'warehouse_code', 'location_code', 'wh code']
  },
  {
    field: 'warehouseName',
    aliases: ['仓库', '库位', '仓位', '货位', '仓库名称', '库位名称', 'warehouse', 'location']
  },
  {
    field: 'quantity',
    aliases: ['数量', '出库数量', '发货数量', '出货数量', '销售数量', 'qty', 'quantity']
  },
  {
    field: 'unit',
    aliases: ['单位', '计量单位', 'unit', 'uom']
  },
  {
    field: 'batchNo',
    aliases: ['批次', '批号', '批次号', '炉号', '卷号', 'lot', 'batch', 'batch_no']
  },
  {
    field: 'transactionNo',
    aliases: ['单据号', '出库单号', '发货单号', '出货单号', '销售出库单号', 'transaction_no', 'document_no', 'bill_no', 'delivery_no']
  },
  {
    field: 'salesOrderNo',
    aliases: ['销售单号', '销售订单号', '订单号', '客户订单号', 'sales_order_no', 'order_no', 'source_doc_no']
  },
  {
    field: 'customer',
    aliases: ['客户', '客户名称', '收货客户', 'customer', 'buyer']
  },
  {
    field: 'receiver',
    aliases: ['收货人', '联系人', 'receiver', 'contact']
  },
  {
    field: 'deliveryAddress',
    aliases: ['送货地址', '收货地址', '地址', 'delivery_address', 'address']
  },
  {
    field: 'operator',
    aliases: ['操作员', '经办人', '发货人', '仓管员', 'operator', 'handler']
  },
  {
    field: 'ioType',
    aliases: ['出库类型', '业务类型', '类型', 'io_type', 'stock_out_type']
  },
  {
    field: 'remark',
    aliases: ['备注', '说明', 'remark', 'remarks', 'note', 'comment']
  }
];

const productionWorkReportFieldDefinitions = [
  {
    field: 'reportNo',
    aliases: ['报工单号', '生产日报号', '日报编号', '单据号', '报告编号', 'report_no', 'document_no']
  },
  {
    field: 'reportDate',
    aliases: ['报工日期', '生产日期', '日报日期', '日期', 'report_date', 'production_date']
  },
  {
    field: 'workOrderNo',
    aliases: ['工单号', '生产工单号', '制令单号', 'work_order_no', 'wo_no']
  },
  {
    field: 'materialCode',
    aliases: ['产品编码', '物料编码', '成品编码', '品号', '料号', 'product_code', 'material_code', 'item_code']
  },
  {
    field: 'materialName',
    aliases: ['产品名称', '物料名称', '成品名称', '产品', '品名', '名称', 'product_name', 'material_name', 'item_name']
  },
  {
    field: 'processName',
    aliases: ['工序', '工序名称', '工段', 'process', 'process_name', 'operation']
  },
  {
    field: 'workshopName',
    aliases: ['车间', '生产车间', 'workshop', 'workshop_name']
  },
  {
    field: 'productionLine',
    aliases: ['产线', '生产线', 'line', 'production_line']
  },
  {
    field: 'shiftName',
    aliases: ['班次', '班别', 'shift', 'shift_name']
  },
  {
    field: 'teamName',
    aliases: ['班组', '小组', 'team', 'team_name']
  },
  {
    field: 'completedQty',
    aliases: ['完工数量', '完成数量', '产量', '生产数量', '报工数量', 'completed_qty', 'finished_qty', 'output_qty']
  },
  {
    field: 'goodQty',
    aliases: ['合格数量', '良品数量', 'good_qty', 'qualified_qty', 'ok_qty']
  },
  {
    field: 'defectQty',
    aliases: ['不良数量', '不合格数量', '缺陷数量', 'ng_qty', 'defect_qty']
  },
  {
    field: 'scrapQty',
    aliases: ['报废数量', '废品数量', 'scrap_qty', 'waste_qty']
  },
  {
    field: 'unit',
    aliases: ['单位', '计量单位', 'unit', 'uom']
  },
  {
    field: 'operator',
    aliases: ['报工人', '操作员', '经办人', '负责人', 'operator', 'handler']
  },
  {
    field: 'remark',
    aliases: ['备注', '说明', '异常说明', 'remark', 'remarks', 'note', 'comment']
  }
];

const equipmentCheckFieldDefinitions = [
  {
    field: 'checkNo',
    aliases: ['点检单号', '巡检单号', '检查单号', '单据号', 'check_no', 'inspection_no']
  },
  {
    field: 'assetNo',
    aliases: ['设备编号', '设备编码', '资产编号', '设备号', 'asset_no', 'equipment_no']
  },
  {
    field: 'assetName',
    aliases: ['设备名称', '设备', '资产名称', '机器名称', 'asset_name', 'equipment_name']
  },
  {
    field: 'checkType',
    aliases: ['点检类型', '巡检类型', '检查类型', '类型', 'check_type']
  },
  {
    field: 'checkItemCount',
    aliases: ['点检项目数', '检查项目数', '项目数', 'check_item_count', 'item_count']
  },
  {
    field: 'abnormalCount',
    aliases: ['异常数量', '异常项数', '不合格项数', 'abnormal_count', 'issue_count']
  },
  {
    field: 'checkResult',
    aliases: ['点检结果', '巡检结果', '检查结果', '结果', '状态', 'check_result', 'result']
  },
  {
    field: 'checker',
    aliases: ['点检人', '巡检人', '检查人', '负责人', 'checker', 'inspector']
  },
  {
    field: 'checkDate',
    aliases: ['点检日期', '巡检日期', '检查日期', '日期', 'check_date']
  },
  {
    field: 'remark',
    aliases: ['备注', '异常说明', '处理措施', '说明', 'remark', 'remarks', 'note', 'comment']
  }
];

const hrRecordFieldDefinitions = [
  {
    field: 'recordNo',
    aliases: ['记录编号', '人事单号', '单据号', '申请单号', 'record_no', 'document_no', 'bill_no']
  },
  {
    field: 'eventDate',
    aliases: ['日期', '发生日期', '记录日期', '考勤日期', '入职日期', '离职日期', 'event_date', 'record_date']
  },
  {
    field: 'employeeNo',
    aliases: ['员工编号', '工号', '员工号', 'employee_no', 'staff_no']
  },
  {
    field: 'employeeName',
    aliases: ['员工姓名', '姓名', '员工', '人员', 'employee_name', 'name', 'staff_name']
  },
  {
    field: 'department',
    aliases: ['部门', '所属部门', '组织', 'department', 'dept_name']
  },
  {
    field: 'position',
    aliases: ['岗位', '职位', '职务', 'position', 'post', 'job_title']
  },
  {
    field: 'eventType',
    aliases: ['事项', '人事事项', '类型', '事件类型', '记录类型', 'event_type', 'record_type']
  },
  {
    field: 'hours',
    aliases: ['时长', '工时', '小时数', '小时', 'hours', 'duration_hours']
  },
  {
    field: 'overtimeHours',
    aliases: ['加班时长', '加班小时', '加班工时', 'overtime_hours', 'ot_hours']
  },
  {
    field: 'leaveHours',
    aliases: ['请假时长', '请假小时', '请假工时', 'leave_hours']
  },
  {
    field: 'absenceHours',
    aliases: ['缺勤时长', '缺勤小时', '旷工小时', 'absence_hours']
  },
  {
    field: 'status',
    aliases: ['状态', '审批状态', '处理状态', 'status', 'record_status']
  },
  {
    field: 'handler',
    aliases: ['经办人', '操作员', '录入人', 'HR', 'handler', 'operator']
  },
  {
    field: 'remark',
    aliases: ['备注', '说明', '原因', 'remark', 'remarks', 'note', 'comment']
  }
];

const recognizedFields = new Set(fieldDefinitions.map((item) => item.field));
const stockInUnsupportedFields = new Set(['supplier', 'purchasePrice']);
const stockOutUnsupportedFields = new Set(['customer', 'receiver', 'deliveryAddress']);

function normalizeText(value, max = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeMultilineText(value, max = 4000) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().slice(0, max);
}

function safeJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_:\-—–,，.。/\\|()[\]{}]+/g, '');
}

function aliasKeys(definition) {
  return [definition.field, ...definition.aliases].map(normalizeKey).filter(Boolean);
}

const fieldAliasKeys = fieldDefinitions.map((definition) => ({
  ...definition,
  keys: aliasKeys(definition)
}));

const qualityFieldAliasKeys = qualityFieldDefinitions.map((definition) => ({
  ...definition,
  keys: aliasKeys(definition)
}));

const salesStockOutFieldAliasKeys = salesStockOutFieldDefinitions.map((definition) => ({
  ...definition,
  keys: aliasKeys(definition)
}));

const productionWorkReportFieldAliasKeys = productionWorkReportFieldDefinitions.map((definition) => ({
  ...definition,
  keys: aliasKeys(definition)
}));

const equipmentCheckFieldAliasKeys = equipmentCheckFieldDefinitions.map((definition) => ({
  ...definition,
  keys: aliasKeys(definition)
}));

const hrRecordFieldAliasKeys = hrRecordFieldDefinitions.map((definition) => ({
  ...definition,
  keys: aliasKeys(definition)
}));

function findHeaderMapping(headerRow, aliasKeyEntries) {
  const headers = Array.isArray(headerRow) ? headerRow : [];
  const mapping = new Map();
  headers.forEach((header, index) => {
    const key = normalizeKey(header);
    if (!key) return;
    const exact = aliasKeyEntries.find((definition) => definition.keys.includes(key));
    if (exact && !mapping.has(exact.field)) {
      mapping.set(exact.field, index);
      return;
    }
    const fuzzy = aliasKeyEntries.find((definition) =>
      definition.keys.some((alias) => alias.length >= 2 && (key.includes(alias) || alias.includes(key)))
    );
    if (fuzzy && !mapping.has(fuzzy.field)) mapping.set(fuzzy.field, index);
  });
  return mapping;
}

function findStockInHeaderMapping(headerRow) {
  return findHeaderMapping(headerRow, fieldAliasKeys);
}

function findQualityHeaderMapping(headerRow) {
  return findHeaderMapping(headerRow, qualityFieldAliasKeys);
}

function findSalesStockOutHeaderMapping(headerRow) {
  return findHeaderMapping(headerRow, salesStockOutFieldAliasKeys);
}

function findProductionWorkReportHeaderMapping(headerRow) {
  return findHeaderMapping(headerRow, productionWorkReportFieldAliasKeys);
}

function findEquipmentCheckHeaderMapping(headerRow) {
  return findHeaderMapping(headerRow, equipmentCheckFieldAliasKeys);
}

function findHrRecordHeaderMapping(headerRow) {
  return findHeaderMapping(headerRow, hrRecordFieldAliasKeys);
}

function parseQuantity(value) {
  const raw = normalizeCell(value).replace(/,/g, '');
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseOptionalNumber(value) {
  const raw = normalizeCell(value).replace(/,/g, '');
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(value) {
  const text = normalizeCell(value);
  if (!text) return null;
  const normalized = text
    .replace(/[年月.]/g, '-')
    .replace(/[日号]/g, '')
    .replace(/\//g, '-')
    .trim();
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractValue(row, mapping, field) {
  const index = mapping.get(field);
  return index === undefined ? '' : normalizeCell(row[index]);
}

function lineHasUsefulValue(line, unmappedFields) {
  const sourceFields = [
    'materialCode',
    'materialName',
    'quantity',
    'unit',
    'batchNo',
    'transactionNo',
    'productionDate',
    'supplier',
    'purchasePrice',
    'remark'
  ];
  return sourceFields.some((field) => line[field] !== null && line[field] !== undefined && String(line[field]).trim() !== '')
    || unmappedFields.length > 0;
}

function buildLineFromRow(headerRow, row, mapping, rowIndex, sourceLabel) {
  const line = {
    materialCode: extractValue(row, mapping, 'materialCode'),
    materialName: extractValue(row, mapping, 'materialName'),
    warehouseCode: extractValue(row, mapping, 'warehouseCode') || defaultWarehouseCode,
    warehouseName: extractValue(row, mapping, 'warehouseName') || defaultWarehouseName,
    quantity: parseQuantity(extractValue(row, mapping, 'quantity')),
    unit: extractValue(row, mapping, 'unit'),
    batchNo: extractValue(row, mapping, 'batchNo'),
    transactionNo: extractValue(row, mapping, 'transactionNo'),
    productionDate: normalizeDate(extractValue(row, mapping, 'productionDate')),
    supplier: extractValue(row, mapping, 'supplier'),
    purchasePrice: parseOptionalNumber(extractValue(row, mapping, 'purchasePrice')),
    operator: extractValue(row, mapping, 'operator') || defaultOperator,
    ioType: extractValue(row, mapping, 'ioType') || defaultIoType,
    remark: extractValue(row, mapping, 'remark')
  };

  const mappedIndexes = new Set([...mapping.values()]);
  const unmappedFields = [];
  for (let index = 0; index < row.length; index += 1) {
    if (mappedIndexes.has(index)) continue;
    const value = normalizeCell(row[index]);
    if (!value) continue;
    unmappedFields.push({
      name: normalizeCell(headerRow?.[index]) || `第${index + 1}列`,
      value,
      confidence: 0.55,
      source: sourceLabel
    });
  }

  for (const field of stockInUnsupportedFields) {
    const value = line[field];
    if (value === null || value === undefined || String(value).trim() === '') continue;
    unmappedFields.push({
      name: field === 'supplier' ? '供应商' : '采购单价',
      value: String(value),
      confidence: 0.75,
      source: sourceLabel,
      reason: 'stock_in RPC 暂未提供独立字段，已写入备注并保留待人工确认'
    });
  }

  return {
    line,
    unmappedFields,
    rowIndex,
    source: sourceLabel
  };
}

function extractTables(parseResult, entryPlan) {
  const directTables = safeJson(parseResult?.tables, []);
  if (Array.isArray(directTables) && directTables.length) return directTables;

  const documents = safeJson(entryPlan?.documents, []);
  for (const doc of Array.isArray(documents) ? documents : []) {
    const preview = doc?.tables_preview;
    if (Array.isArray(preview) && preview.length) return preview;
  }
  return [];
}

function normalizeStockInTableRows(table) {
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  if (!rows.length) return [];
  if (Array.isArray(rows[0])) return rows;

  const columns = Array.isArray(table?.columns)
    ? table.columns.map((column) => normalizeCell(column)).filter(Boolean)
    : [];
  const inferredColumns = columns.length
    ? columns
    : Object.keys(rows.find((row) => row && typeof row === 'object' && !Array.isArray(row)) || {});
  if (!inferredColumns.length) return [];

  const normalizedRows = rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => inferredColumns.map((column) => normalizeCell(row[column])));

  return normalizedRows.length ? [inferredColumns, ...normalizedRows] : [];
}

function stockInRowsFromTables({ parseResult, entryPlan }) {
  const tables = extractTables(parseResult, entryPlan);
  const rowsOut = [];
  for (const table of tables) {
    const rows = normalizeStockInTableRows(table);
    if (rows.length < 2) continue;
    const headerRow = rows[0] || [];
    const mapping = findStockInHeaderMapping(headerRow);
    if (!mapping.size) continue;

    for (let rowIndex = 1; rowIndex < rows.length && rowsOut.length < maxRowsPerPlan; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const record = buildLineFromRow(headerRow, row, mapping, rowIndex, `table:${table.sheet_name || table.name || ''}:row:${rowIndex + 1}`);
      if (lineHasUsefulValue(record.line, record.unmappedFields)) rowsOut.push(record);
    }
  }
  return rowsOut;
}

function extractTextValueFromDefinitions(text, field, aliasKeyEntries) {
  const definition = aliasKeyEntries.find((item) => item.field === field);
  if (!definition) return '';
  for (const alias of definition.aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\n\\r])\\s*${escaped}\\s*[:：=]\\s*([^\\n\\r,，;；\\t]{1,120})`, 'i');
    const match = text.match(regex);
    if (match?.[1]) return normalizeCell(match[1]);
  }
  return '';
}

function extractTextValue(text, field) {
  return extractTextValueFromDefinitions(text, field, fieldAliasKeys);
}

function stockInRowsFromText({ parseResult, entryPlan }) {
  const documents = safeJson(entryPlan?.documents, []);
  const text = normalizeMultilineText(
    parseResult?.text_content || documents[0]?.extracted_text_preview || '',
    20000
  );
  if (!text) return [];
  const line = {
    materialCode: extractTextValue(text, 'materialCode'),
    materialName: extractTextValue(text, 'materialName'),
    warehouseCode: extractTextValue(text, 'warehouseCode') || defaultWarehouseCode,
    warehouseName: extractTextValue(text, 'warehouseName') || defaultWarehouseName,
    quantity: parseQuantity(extractTextValue(text, 'quantity')),
    unit: extractTextValue(text, 'unit'),
    batchNo: extractTextValue(text, 'batchNo'),
    transactionNo: extractTextValue(text, 'transactionNo'),
    productionDate: normalizeDate(extractTextValue(text, 'productionDate')),
    supplier: extractTextValue(text, 'supplier'),
    purchasePrice: parseOptionalNumber(extractTextValue(text, 'purchasePrice')),
    operator: extractTextValue(text, 'operator') || defaultOperator,
    ioType: extractTextValue(text, 'ioType') || defaultIoType,
    remark: extractTextValue(text, 'remark')
  };

  const unmappedFields = [{
    name: '原文摘录',
    value: text.slice(0, 1200),
    confidence: 0.4,
    source: '解析文本'
  }];
  for (const field of stockInUnsupportedFields) {
    const value = line[field];
    if (value === null || value === undefined || String(value).trim() === '') continue;
    unmappedFields.push({
      name: field === 'supplier' ? '供应商' : '采购单价',
      value: String(value),
      confidence: 0.75,
      source: '解析文本',
      reason: 'stock_in RPC 暂未提供独立字段，已写入备注并保留待人工确认'
    });
  }

  return lineHasUsefulValue(line, unmappedFields) ? [{ line, unmappedFields, rowIndex: null, source: 'text' }] : [];
}

function buildStockInRowsFromPlan({ parseResult, entryPlan }) {
  const tableRows = stockInRowsFromTables({ parseResult, entryPlan });
  if (tableRows.length) return tableRows;
  return stockInRowsFromText({ parseResult, entryPlan });
}

function lineHasSalesStockOutValue(line, unmappedFields) {
  const sourceFields = [
    'materialCode',
    'materialName',
    'warehouseCode',
    'warehouseName',
    'unit',
    'batchNo',
    'transactionNo',
    'salesOrderNo',
    'customer',
    'receiver',
    'deliveryAddress',
    'remark'
  ];
  return sourceFields.some((field) => line[field] !== null && line[field] !== undefined && String(line[field]).trim() !== '')
    || Number(line.quantity || 0) > 0
    || unmappedFields.length > 0;
}

function buildSalesStockOutLineFromRow(headerRow, row, mapping, rowIndex, sourceLabel) {
  const line = {
    materialCode: extractValue(row, mapping, 'materialCode'),
    materialName: extractValue(row, mapping, 'materialName'),
    warehouseCode: extractValue(row, mapping, 'warehouseCode') || defaultWarehouseCode,
    warehouseName: extractValue(row, mapping, 'warehouseName') || defaultWarehouseName,
    quantity: parseQuantity(extractValue(row, mapping, 'quantity')),
    unit: extractValue(row, mapping, 'unit'),
    batchNo: extractValue(row, mapping, 'batchNo'),
    transactionNo: extractValue(row, mapping, 'transactionNo'),
    salesOrderNo: extractValue(row, mapping, 'salesOrderNo'),
    customer: extractValue(row, mapping, 'customer'),
    receiver: extractValue(row, mapping, 'receiver'),
    deliveryAddress: extractValue(row, mapping, 'deliveryAddress'),
    operator: extractValue(row, mapping, 'operator') || defaultOperator,
    ioType: extractValue(row, mapping, 'ioType') || defaultStockOutIoType,
    remark: extractValue(row, mapping, 'remark')
  };

  const mappedIndexes = new Set([...mapping.values()]);
  const unmappedFields = [];
  for (let index = 0; index < row.length; index += 1) {
    if (mappedIndexes.has(index)) continue;
    const value = normalizeCell(row[index]);
    if (!value) continue;
    unmappedFields.push({
      name: normalizeCell(headerRow?.[index]) || `第${index + 1}列`,
      value,
      confidence: 0.55,
      source: sourceLabel
    });
  }

  for (const field of stockOutUnsupportedFields) {
    const value = line[field];
    if (value === null || value === undefined || String(value).trim() === '') continue;
    const labels = {
      customer: '客户',
      receiver: '收货人',
      deliveryAddress: '送货地址'
    };
    unmappedFields.push({
      name: labels[field] || field,
      value: String(value),
      confidence: 0.75,
      source: sourceLabel,
      reason: 'stock_out RPC 暂未提供独立字段，已写入备注并保留待人工确认'
    });
  }

  return {
    line,
    unmappedFields,
    rowIndex,
    source: sourceLabel
  };
}

function salesStockOutRowsFromTables({ parseResult, entryPlan }) {
  const tables = extractTables(parseResult, entryPlan);
  const rowsOut = [];
  for (const table of tables) {
    const rows = normalizeStockInTableRows(table);
    if (rows.length < 2) continue;
    const headerRow = rows[0] || [];
    const mapping = findSalesStockOutHeaderMapping(headerRow);
    if (!mapping.size) continue;

    for (let rowIndex = 1; rowIndex < rows.length && rowsOut.length < maxRowsPerPlan; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const record = buildSalesStockOutLineFromRow(headerRow, row, mapping, rowIndex, `table:${table.sheet_name || table.name || ''}:row:${rowIndex + 1}`);
      if (lineHasSalesStockOutValue(record.line, record.unmappedFields)) rowsOut.push(record);
    }
  }
  return rowsOut;
}

function salesStockOutRowsFromText({ parseResult, entryPlan }) {
  const documents = safeJson(entryPlan?.documents, []);
  const text = normalizeMultilineText(
    parseResult?.text_content || documents[0]?.extracted_text_preview || '',
    20000
  );
  if (!text) return [];
  const line = {
    materialCode: extractTextValueFromDefinitions(text, 'materialCode', salesStockOutFieldAliasKeys),
    materialName: extractTextValueFromDefinitions(text, 'materialName', salesStockOutFieldAliasKeys),
    warehouseCode: extractTextValueFromDefinitions(text, 'warehouseCode', salesStockOutFieldAliasKeys) || defaultWarehouseCode,
    warehouseName: extractTextValueFromDefinitions(text, 'warehouseName', salesStockOutFieldAliasKeys) || defaultWarehouseName,
    quantity: parseQuantity(extractTextValueFromDefinitions(text, 'quantity', salesStockOutFieldAliasKeys)),
    unit: extractTextValueFromDefinitions(text, 'unit', salesStockOutFieldAliasKeys),
    batchNo: extractTextValueFromDefinitions(text, 'batchNo', salesStockOutFieldAliasKeys),
    transactionNo: extractTextValueFromDefinitions(text, 'transactionNo', salesStockOutFieldAliasKeys),
    salesOrderNo: extractTextValueFromDefinitions(text, 'salesOrderNo', salesStockOutFieldAliasKeys),
    customer: extractTextValueFromDefinitions(text, 'customer', salesStockOutFieldAliasKeys),
    receiver: extractTextValueFromDefinitions(text, 'receiver', salesStockOutFieldAliasKeys),
    deliveryAddress: extractTextValueFromDefinitions(text, 'deliveryAddress', salesStockOutFieldAliasKeys),
    operator: extractTextValueFromDefinitions(text, 'operator', salesStockOutFieldAliasKeys) || defaultOperator,
    ioType: extractTextValueFromDefinitions(text, 'ioType', salesStockOutFieldAliasKeys) || defaultStockOutIoType,
    remark: extractTextValueFromDefinitions(text, 'remark', salesStockOutFieldAliasKeys)
  };

  const unmappedFields = [{
    name: '原文摘录',
    value: text.slice(0, 1200),
    confidence: 0.4,
    source: '解析文本'
  }];
  for (const field of stockOutUnsupportedFields) {
    const value = line[field];
    if (value === null || value === undefined || String(value).trim() === '') continue;
    const labels = {
      customer: '客户',
      receiver: '收货人',
      deliveryAddress: '送货地址'
    };
    unmappedFields.push({
      name: labels[field] || field,
      value: String(value),
      confidence: 0.75,
      source: '解析文本',
      reason: 'stock_out RPC 暂未提供独立字段，已写入备注并保留待人工确认'
    });
  }

  return lineHasSalesStockOutValue(line, unmappedFields) ? [{ line, unmappedFields, rowIndex: null, source: 'text' }] : [];
}

function buildSalesStockOutRowsFromPlan({ parseResult, entryPlan }) {
  const tableRows = salesStockOutRowsFromTables({ parseResult, entryPlan });
  if (tableRows.length) return tableRows;
  return salesStockOutRowsFromText({ parseResult, entryPlan });
}

function validateSalesStockOutLine(line, resolved = {}) {
  const errors = [];
  if (!resolved.material?.id) errors.push('未匹配到物料主数据');
  if (!resolved.warehouse?.id) errors.push('未匹配到仓库/库位');
  if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) errors.push('出库数量必须大于 0');
  if (!normalizeText(line.unit, 80)) errors.push('缺少单位');
  if (!normalizeText(line.batchNo, 120)) errors.push('缺少批次号');
  return errors;
}

function buildGeneratedStockOutTransactionNo(entryPlan, index) {
  const basis = normalizeText(entryPlan?.id || entryPlan?.asset_id || 'PLAN', 80)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 18) || 'PLAN';
  return `AI-SO-${basis}-${String((Number(index) || 0) + 1).padStart(3, '0')}`;
}

function buildStockOutRpcRemark({ line, asset, source }) {
  const parts = [];
  if (line.remark) parts.push(normalizeText(line.remark, 600));
  if (line.salesOrderNo) parts.push(`销售订单号：${normalizeText(line.salesOrderNo, 200)}`);
  if (line.customer) parts.push(`客户：${normalizeText(line.customer, 200)}`);
  if (line.receiver) parts.push(`收货人：${normalizeText(line.receiver, 200)}`);
  if (line.deliveryAddress) parts.push(`送货地址：${normalizeText(line.deliveryAddress, 400)}`);
  if (asset?.original_filename) parts.push(`AI来源文件：${normalizeText(asset.original_filename, 200)}`);
  if (source) parts.push(`AI来源位置：${normalizeText(source, 200)}`);
  return parts.join('\n').slice(0, 1800) || null;
}

function buildStockOutPayload({ line, material, warehouse, asset, entryPlan, source, index }) {
  return {
    p_material_id: Number(material.id),
    p_warehouse_id: warehouse.id,
    p_quantity: Number(line.quantity),
    p_unit: normalizeText(line.unit, 80),
    p_batch_no: normalizeText(line.batchNo, 120),
    p_transaction_no: normalizeText(line.transactionNo, 120) || buildGeneratedStockOutTransactionNo(entryPlan, index),
    p_operator: normalizeText(line.operator, 120) || defaultOperator,
    p_remark: buildStockOutRpcRemark({ line, asset, source }),
    p_io_type: normalizeText(line.ioType, 80) || defaultStockOutIoType,
    sales_order_no: normalizeText(line.salesOrderNo, 160) || null,
    customer: normalizeText(line.customer, 240) || null,
    receiver: normalizeText(line.receiver, 160) || null,
    delivery_address: normalizeText(line.deliveryAddress, 500) || null
  };
}

function lineHasProductionWorkReportValue(line, unmappedFields) {
  const sourceFields = [
    'reportNo',
    'reportDate',
    'workOrderNo',
    'materialCode',
    'materialName',
    'processName',
    'workshopName',
    'productionLine',
    'shiftName',
    'teamName',
    'unit',
    'remark'
  ];
  const hasText = sourceFields.some((field) => line[field] !== null && line[field] !== undefined && String(line[field]).trim() !== '');
  const hasOperator = normalizeText(line.operator, 120) && normalizeText(line.operator, 120) !== defaultOperator;
  const hasQuantity = ['completedQty', 'goodQty', 'defectQty', 'scrapQty'].some((field) => Number(line[field] || 0) > 0);
  return hasText || hasOperator || hasQuantity || unmappedFields.length > 0;
}

function buildProductionWorkReportLineFromRow(headerRow, row, mapping, rowIndex, sourceLabel) {
  const completedQty = parseOptionalNumber(extractValue(row, mapping, 'completedQty')) ?? 0;
  const defectQty = parseOptionalNumber(extractValue(row, mapping, 'defectQty')) ?? 0;
  const scrapQty = parseOptionalNumber(extractValue(row, mapping, 'scrapQty')) ?? 0;
  const goodQtyRaw = extractValue(row, mapping, 'goodQty');
  const parsedGoodQty = goodQtyRaw ? parseOptionalNumber(goodQtyRaw) : null;
  const line = {
    reportNo: extractValue(row, mapping, 'reportNo'),
    reportDate: normalizeDate(extractValue(row, mapping, 'reportDate')),
    workOrderNo: extractValue(row, mapping, 'workOrderNo'),
    materialCode: extractValue(row, mapping, 'materialCode'),
    materialName: extractValue(row, mapping, 'materialName'),
    processName: extractValue(row, mapping, 'processName'),
    workshopName: extractValue(row, mapping, 'workshopName'),
    productionLine: extractValue(row, mapping, 'productionLine'),
    shiftName: extractValue(row, mapping, 'shiftName'),
    teamName: extractValue(row, mapping, 'teamName'),
    completedQty,
    goodQty: parsedGoodQty === null ? Math.max(0, completedQty - defectQty - scrapQty) : parsedGoodQty,
    defectQty,
    scrapQty,
    unit: extractValue(row, mapping, 'unit'),
    operator: extractValue(row, mapping, 'operator') || defaultOperator,
    remark: extractValue(row, mapping, 'remark')
  };

  const mappedIndexes = new Set([...mapping.values()]);
  const unmappedFields = [];
  for (let index = 0; index < row.length; index += 1) {
    if (mappedIndexes.has(index)) continue;
    const value = normalizeCell(row[index]);
    if (!value) continue;
    unmappedFields.push({
      name: normalizeCell(headerRow?.[index]) || `第${index + 1}列`,
      value,
      confidence: 0.55,
      source: sourceLabel
    });
  }

  return {
    line,
    unmappedFields,
    rowIndex,
    source: sourceLabel
  };
}

function productionWorkReportRowsFromTables({ parseResult, entryPlan }) {
  const tables = extractTables(parseResult, entryPlan);
  const rowsOut = [];
  for (const table of tables) {
    const rows = normalizeStockInTableRows(table);
    if (rows.length < 2) continue;
    const headerRow = rows[0] || [];
    const mapping = findProductionWorkReportHeaderMapping(headerRow);
    if (!mapping.size) continue;

    for (let rowIndex = 1; rowIndex < rows.length && rowsOut.length < maxRowsPerPlan; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const record = buildProductionWorkReportLineFromRow(headerRow, row, mapping, rowIndex, `table:${table.sheet_name || table.name || ''}:row:${rowIndex + 1}`);
      if (lineHasProductionWorkReportValue(record.line, record.unmappedFields)) rowsOut.push(record);
    }
  }
  return rowsOut;
}

function productionWorkReportRowsFromText({ parseResult, entryPlan }) {
  const documents = safeJson(entryPlan?.documents, []);
  const text = normalizeMultilineText(
    parseResult?.text_content || documents[0]?.extracted_text_preview || '',
    20000
  );
  if (!text) return [];
  const completedQty = parseOptionalNumber(extractTextValueFromDefinitions(text, 'completedQty', productionWorkReportFieldAliasKeys)) ?? 0;
  const defectQty = parseOptionalNumber(extractTextValueFromDefinitions(text, 'defectQty', productionWorkReportFieldAliasKeys)) ?? 0;
  const scrapQty = parseOptionalNumber(extractTextValueFromDefinitions(text, 'scrapQty', productionWorkReportFieldAliasKeys)) ?? 0;
  const goodQtyRaw = extractTextValueFromDefinitions(text, 'goodQty', productionWorkReportFieldAliasKeys);
  const parsedGoodQty = goodQtyRaw ? parseOptionalNumber(goodQtyRaw) : null;
  const line = {
    reportNo: extractTextValueFromDefinitions(text, 'reportNo', productionWorkReportFieldAliasKeys),
    reportDate: normalizeDate(extractTextValueFromDefinitions(text, 'reportDate', productionWorkReportFieldAliasKeys)),
    workOrderNo: extractTextValueFromDefinitions(text, 'workOrderNo', productionWorkReportFieldAliasKeys),
    materialCode: extractTextValueFromDefinitions(text, 'materialCode', productionWorkReportFieldAliasKeys),
    materialName: extractTextValueFromDefinitions(text, 'materialName', productionWorkReportFieldAliasKeys),
    processName: extractTextValueFromDefinitions(text, 'processName', productionWorkReportFieldAliasKeys),
    workshopName: extractTextValueFromDefinitions(text, 'workshopName', productionWorkReportFieldAliasKeys),
    productionLine: extractTextValueFromDefinitions(text, 'productionLine', productionWorkReportFieldAliasKeys),
    shiftName: extractTextValueFromDefinitions(text, 'shiftName', productionWorkReportFieldAliasKeys),
    teamName: extractTextValueFromDefinitions(text, 'teamName', productionWorkReportFieldAliasKeys),
    completedQty,
    goodQty: parsedGoodQty === null ? Math.max(0, completedQty - defectQty - scrapQty) : parsedGoodQty,
    defectQty,
    scrapQty,
    unit: extractTextValueFromDefinitions(text, 'unit', productionWorkReportFieldAliasKeys),
    operator: extractTextValueFromDefinitions(text, 'operator', productionWorkReportFieldAliasKeys) || defaultOperator,
    remark: extractTextValueFromDefinitions(text, 'remark', productionWorkReportFieldAliasKeys)
  };

  const unmappedFields = [{
    name: '原文摘录',
    value: text.slice(0, 1200),
    confidence: 0.4,
    source: '解析文本'
  }];

  return lineHasProductionWorkReportValue(line, unmappedFields) ? [{ line, unmappedFields, rowIndex: null, source: 'text' }] : [];
}

function buildProductionWorkReportRowsFromPlan({ parseResult, entryPlan }) {
  const tableRows = productionWorkReportRowsFromTables({ parseResult, entryPlan });
  if (tableRows.length) return tableRows;
  return productionWorkReportRowsFromText({ parseResult, entryPlan });
}

function validateProductionWorkReportLine(line, resolved = {}) {
  const errors = [];
  if (!resolved.material?.id) errors.push('未匹配到产品/物料主数据');
  if (!Number.isFinite(Number(line.completedQty)) || Number(line.completedQty) <= 0) errors.push('完工数量必须大于 0');
  if (!Number.isFinite(Number(line.goodQty)) || Number(line.goodQty) < 0) errors.push('合格数量不能小于 0');
  if (!Number.isFinite(Number(line.defectQty)) || Number(line.defectQty) < 0) errors.push('不良数量不能小于 0');
  if (!Number.isFinite(Number(line.scrapQty)) || Number(line.scrapQty) < 0) errors.push('报废数量不能小于 0');
  if (Number(line.goodQty) > Number(line.completedQty)) errors.push('合格数量不能大于完工数量');
  if (Number(line.defectQty) + Number(line.scrapQty) > Number(line.completedQty)) errors.push('不良数量和报废数量之和不能大于完工数量');
  if (!normalizeText(line.unit || resolved.workOrder?.unit, 80)) errors.push('缺少单位');
  return errors;
}

function buildGeneratedProductionReportNo(entryPlan, index) {
  const basis = normalizeText(entryPlan?.id || entryPlan?.asset_id || 'PLAN', 80)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 18) || 'PLAN';
  return `AI-PR-${basis}-${String((Number(index) || 0) + 1).padStart(3, '0')}`;
}

function buildProductionWorkReportPayload({ line, material, workOrder = null, asset, entryPlan, source, index }) {
  const reportNo = normalizeText(line.reportNo, 120) || buildGeneratedProductionReportNo(entryPlan, index);
  const completedQty = Number(line.completedQty || 0);
  const defectQty = Number(line.defectQty || 0);
  const scrapQty = Number(line.scrapQty || 0);
  const goodQty = Number(line.goodQty ?? Math.max(0, completedQty - defectQty - scrapQty));
  return {
    report_no: reportNo,
    report_date: line.reportDate || null,
    work_order_id: workOrder?.id || null,
    work_order_no: normalizeText(line.workOrderNo || workOrder?.work_order_no, 160) || null,
    product_material_id: Number(material.id),
    product_material_code: normalizeText(material.batch_no || line.materialCode || workOrder?.product_material_code, 160),
    product_material_name: normalizeText(material.name || line.materialName || workOrder?.product_material_name, 240),
    process_name: normalizeText(line.processName, 160) || null,
    workshop_name: normalizeText(line.workshopName, 160) || null,
    production_line: normalizeText(line.productionLine, 160) || null,
    shift_name: normalizeText(line.shiftName, 120) || null,
    team_name: normalizeText(line.teamName, 120) || null,
    completed_qty: completedQty,
    good_qty: goodQty,
    defect_qty: defectQty,
    scrap_qty: scrapQty,
    unit: normalizeText(line.unit || workOrder?.unit, 80),
    operator: normalizeText(line.operator, 120) || defaultOperator,
    remark: normalizeText(line.remark, 1200) || null,
    properties: {
      ai_generated: true,
      source: source || '',
      source_asset_id: asset?.id || null,
      source_filename: asset?.original_filename || '',
      entry_plan_id: entryPlan?.id || null
    }
  };
}

function normalizeEquipmentCheckType(value) {
  const text = normalizeText(value, 80);
  if (!text) return '日常巡检';
  if (['班前点检', '日常巡检', '专项点检'].includes(text)) return text;
  if (/班前|开机|开班/i.test(text)) return '班前点检';
  if (/专项|专检|special/i.test(text)) return '专项点检';
  return '日常巡检';
}

function normalizeEquipmentCheckResult(value, { abnormalCount = null } = {}) {
  const text = normalizeText(value, 80);
  if (!text) return Number(abnormalCount || 0) > 0 ? '异常' : '正常';
  if (['待处理', '正常', '异常', '停机'].includes(text)) return text;
  if (/停机|停线|shutdown|stop/i.test(text)) return '停机';
  if (/异常|故障|不合格|报警|fail|ng/i.test(text)) return '异常';
  if (/正常|合格|ok|pass/i.test(text)) return '正常';
  return Number(abnormalCount || 0) > 0 ? '异常' : '待处理';
}

function lineHasEquipmentCheckValue(line, unmappedFields) {
  const sourceFields = [
    'checkNo',
    'assetNo',
    'assetName',
    'checkDate',
    'remark'
  ];
  const hasText = sourceFields.some((field) => line[field] !== null && line[field] !== undefined && String(line[field]).trim() !== '');
  const hasChecker = normalizeText(line.checker, 120) && normalizeText(line.checker, 120) !== defaultOperator;
  const hasQuantity = Number(line.checkItemCount || 0) > 0 || Number(line.abnormalCount || 0) > 0;
  const hasResult = normalizeText(line.checkResult, 80) && normalizeText(line.checkResult, 80) !== '正常';
  return hasText || hasChecker || hasQuantity || hasResult || unmappedFields.length > 0;
}

function buildEquipmentCheckLineFromRow(headerRow, row, mapping, rowIndex, sourceLabel) {
  const abnormalCount = parseOptionalNumber(extractValue(row, mapping, 'abnormalCount')) ?? 0;
  const line = {
    checkNo: extractValue(row, mapping, 'checkNo'),
    assetNo: extractValue(row, mapping, 'assetNo'),
    assetName: extractValue(row, mapping, 'assetName'),
    checkType: normalizeEquipmentCheckType(extractValue(row, mapping, 'checkType')),
    checkItemCount: parseOptionalNumber(extractValue(row, mapping, 'checkItemCount')) ?? 0,
    abnormalCount,
    checkResult: normalizeEquipmentCheckResult(extractValue(row, mapping, 'checkResult'), { abnormalCount }),
    checker: extractValue(row, mapping, 'checker') || defaultOperator,
    checkDate: normalizeDate(extractValue(row, mapping, 'checkDate')),
    remark: extractValue(row, mapping, 'remark')
  };

  const mappedIndexes = new Set([...mapping.values()]);
  const unmappedFields = [];
  for (let index = 0; index < row.length; index += 1) {
    if (mappedIndexes.has(index)) continue;
    const value = normalizeCell(row[index]);
    if (!value) continue;
    unmappedFields.push({
      name: normalizeCell(headerRow?.[index]) || `第${index + 1}列`,
      value,
      confidence: 0.55,
      source: sourceLabel
    });
  }

  return {
    line,
    unmappedFields,
    rowIndex,
    source: sourceLabel
  };
}

function equipmentCheckRowsFromTables({ parseResult, entryPlan }) {
  const tables = extractTables(parseResult, entryPlan);
  const rowsOut = [];
  for (const table of tables) {
    const rows = normalizeStockInTableRows(table);
    if (rows.length < 2) continue;
    const headerRow = rows[0] || [];
    const mapping = findEquipmentCheckHeaderMapping(headerRow);
    if (!mapping.size) continue;

    for (let rowIndex = 1; rowIndex < rows.length && rowsOut.length < maxRowsPerPlan; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const record = buildEquipmentCheckLineFromRow(headerRow, row, mapping, rowIndex, `table:${table.sheet_name || table.name || ''}:row:${rowIndex + 1}`);
      if (lineHasEquipmentCheckValue(record.line, record.unmappedFields)) rowsOut.push(record);
    }
  }
  return rowsOut;
}

function equipmentCheckRowsFromText({ parseResult, entryPlan }) {
  const documents = safeJson(entryPlan?.documents, []);
  const text = normalizeMultilineText(
    parseResult?.text_content || documents[0]?.extracted_text_preview || '',
    20000
  );
  if (!text) return [];
  const abnormalCount = parseOptionalNumber(extractTextValueFromDefinitions(text, 'abnormalCount', equipmentCheckFieldAliasKeys)) ?? 0;
  const line = {
    checkNo: extractTextValueFromDefinitions(text, 'checkNo', equipmentCheckFieldAliasKeys),
    assetNo: extractTextValueFromDefinitions(text, 'assetNo', equipmentCheckFieldAliasKeys),
    assetName: extractTextValueFromDefinitions(text, 'assetName', equipmentCheckFieldAliasKeys),
    checkType: normalizeEquipmentCheckType(extractTextValueFromDefinitions(text, 'checkType', equipmentCheckFieldAliasKeys)),
    checkItemCount: parseOptionalNumber(extractTextValueFromDefinitions(text, 'checkItemCount', equipmentCheckFieldAliasKeys)) ?? 0,
    abnormalCount,
    checkResult: normalizeEquipmentCheckResult(extractTextValueFromDefinitions(text, 'checkResult', equipmentCheckFieldAliasKeys), { abnormalCount }),
    checker: extractTextValueFromDefinitions(text, 'checker', equipmentCheckFieldAliasKeys) || defaultOperator,
    checkDate: normalizeDate(extractTextValueFromDefinitions(text, 'checkDate', equipmentCheckFieldAliasKeys)),
    remark: extractTextValueFromDefinitions(text, 'remark', equipmentCheckFieldAliasKeys)
  };

  const unmappedFields = [{
    name: '原文摘录',
    value: text.slice(0, 1200),
    confidence: 0.4,
    source: '解析文本'
  }];

  return lineHasEquipmentCheckValue(line, unmappedFields) ? [{ line, unmappedFields, rowIndex: null, source: 'text' }] : [];
}

function buildEquipmentCheckRowsFromPlan({ parseResult, entryPlan }) {
  const tableRows = equipmentCheckRowsFromTables({ parseResult, entryPlan });
  if (tableRows.length) return tableRows;
  return equipmentCheckRowsFromText({ parseResult, entryPlan });
}

function validateEquipmentCheckLine(line) {
  const errors = [];
  if (!normalizeText(line.assetName, 200) && !normalizeText(line.assetNo, 120)) errors.push('缺少设备编号/名称');
  if (line.checkItemCount === null || line.checkItemCount === undefined || !Number.isFinite(Number(line.checkItemCount))) errors.push('点检项目数必须是数字');
  if (line.abnormalCount === null || line.abnormalCount === undefined || !Number.isFinite(Number(line.abnormalCount))) errors.push('异常数量必须是数字');
  if (Number(line.checkItemCount) < 0) errors.push('点检项目数不能小于 0');
  if (Number(line.abnormalCount) < 0) errors.push('异常数量不能小于 0');
  if (Number(line.abnormalCount) > Number(line.checkItemCount)) errors.push('异常数量不能大于点检项目数');
  return errors;
}

function buildGeneratedEquipmentCheckNo(entryPlan, index) {
  const basis = normalizeText(entryPlan?.id || entryPlan?.asset_id || 'PLAN', 80)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 18) || 'PLAN';
  return `AI-EC-${basis}-${String((Number(index) || 0) + 1).padStart(3, '0')}`;
}

function buildEquipmentCheckPayload({ line, equipmentAsset = null, asset, entryPlan, source, index, unmappedFields = [] }) {
  const checkNo = normalizeText(line.checkNo, 120) || buildGeneratedEquipmentCheckNo(entryPlan, index);
  const checkItemCount = Number(line.checkItemCount || 0);
  const abnormalCount = Number(line.abnormalCount || 0);
  return {
    check_no: checkNo,
    asset_id: equipmentAsset?.id || null,
    asset_no: normalizeText(equipmentAsset?.asset_no || line.assetNo, 160) || null,
    asset_name: normalizeText(equipmentAsset?.asset_name || line.assetName, 240),
    check_type: normalizeEquipmentCheckType(line.checkType),
    check_item_count: checkItemCount,
    abnormal_count: abnormalCount,
    check_result: normalizeEquipmentCheckResult(line.checkResult, { abnormalCount }),
    checker: normalizeText(line.checker, 120) || defaultOperator,
    check_date: line.checkDate || null,
    remark: normalizeText(line.remark, 1200) || null,
    properties: {
      ai_generated: true,
      source: source || '',
      source_asset_id: asset?.id || null,
      source_filename: asset?.original_filename || '',
      entry_plan_id: entryPlan?.id || null,
      unresolved_asset: !equipmentAsset?.id,
      __ai_unmapped_fields: unmappedFields
    }
  };
}

function normalizeHrEventType(value) {
  const text = normalizeText(value, 80);
  if (!text) return '其他';
  if (['考勤', '请假', '加班', '出差', '调休', '入职', '离职', '调岗', '绩效', '培训', '其他'].includes(text)) return text;
  if (/请假|年假|病假|事假|休假|leave/i.test(text)) return '请假';
  if (/加班|延时|ot|overtime/i.test(text)) return '加班';
  if (/出差|差旅|business\s*trip/i.test(text)) return '出差';
  if (/调休|补休/i.test(text)) return '调休';
  if (/入职|到岗|onboard/i.test(text)) return '入职';
  if (/离职|离岗|退工|resign|offboard/i.test(text)) return '离职';
  if (/调岗|转岗|异动|部门调整|岗位调整|transfer/i.test(text)) return '调岗';
  if (/绩效|考核|performance/i.test(text)) return '绩效';
  if (/培训|训练|training/i.test(text)) return '培训';
  if (/考勤|出勤|打卡|签到|迟到|早退|缺勤|旷工|attendance/i.test(text)) return '考勤';
  return '其他';
}

function inferHrEventType(value, { overtimeHours = 0, leaveHours = 0, absenceHours = 0 } = {}) {
  const normalized = normalizeHrEventType(value);
  if (normalized !== '其他' || normalizeText(value, 80)) return normalized;
  if (Number(overtimeHours || 0) > 0) return '加班';
  if (Number(leaveHours || 0) > 0) return '请假';
  if (Number(absenceHours || 0) > 0) return '考勤';
  return '其他';
}

function normalizeHrRecordStatus(value) {
  const text = normalizeText(value, 80);
  if (!text) return 'active';
  if (['active', 'confirmed', 'pending_review', 'voided'].includes(text)) return text;
  if (/作废|取消|撤销|void|cancel/i.test(text)) return 'voided';
  if (/待|草稿|审核中|处理中|pending|draft|review/i.test(text)) return 'pending_review';
  if (/确认|通过|批准|已审|完成|confirmed|approved|done/i.test(text)) return 'confirmed';
  return 'active';
}

function lineHasHrRecordValue(line, unmappedFields) {
  const sourceFields = [
    'recordNo',
    'eventDate',
    'employeeNo',
    'employeeName',
    'department',
    'position',
    'remark'
  ];
  const hasText = sourceFields.some((field) => line[field] !== null && line[field] !== undefined && String(line[field]).trim() !== '');
  const hasHandler = normalizeText(line.handler, 120) && normalizeText(line.handler, 120) !== defaultOperator;
  const hasEvent = normalizeHrEventType(line.eventType) !== '其他';
  const hasHours = ['hours', 'overtimeHours', 'leaveHours', 'absenceHours'].some((field) => Number(line[field] || 0) > 0);
  const hasStatus = normalizeHrRecordStatus(line.status) !== 'active';
  return hasText || hasHandler || hasEvent || hasHours || hasStatus || unmappedFields.length > 0;
}

function buildHrRecordLineFromRow(headerRow, row, mapping, rowIndex, sourceLabel) {
  const hours = parseOptionalNumber(extractValue(row, mapping, 'hours')) ?? 0;
  const overtimeHours = parseOptionalNumber(extractValue(row, mapping, 'overtimeHours')) ?? 0;
  const leaveHours = parseOptionalNumber(extractValue(row, mapping, 'leaveHours')) ?? 0;
  const absenceHours = parseOptionalNumber(extractValue(row, mapping, 'absenceHours')) ?? 0;
  const eventTypeRaw = extractValue(row, mapping, 'eventType');
  const line = {
    recordNo: extractValue(row, mapping, 'recordNo'),
    eventDate: normalizeDate(extractValue(row, mapping, 'eventDate')),
    employeeNo: extractValue(row, mapping, 'employeeNo'),
    employeeName: extractValue(row, mapping, 'employeeName'),
    department: extractValue(row, mapping, 'department'),
    position: extractValue(row, mapping, 'position'),
    eventType: inferHrEventType(eventTypeRaw, { overtimeHours, leaveHours, absenceHours }),
    hours,
    overtimeHours,
    leaveHours,
    absenceHours,
    status: normalizeHrRecordStatus(extractValue(row, mapping, 'status')),
    handler: extractValue(row, mapping, 'handler') || defaultOperator,
    remark: extractValue(row, mapping, 'remark')
  };

  const mappedIndexes = new Set([...mapping.values()]);
  const unmappedFields = [];
  for (let index = 0; index < row.length; index += 1) {
    if (mappedIndexes.has(index)) continue;
    const value = normalizeCell(row[index]);
    if (!value) continue;
    unmappedFields.push({
      name: normalizeCell(headerRow?.[index]) || `第${index + 1}列`,
      value,
      confidence: 0.55,
      source: sourceLabel
    });
  }

  return {
    line,
    unmappedFields,
    rowIndex,
    source: sourceLabel
  };
}

function hrRecordRowsFromTables({ parseResult, entryPlan }) {
  const tables = extractTables(parseResult, entryPlan);
  const rowsOut = [];
  for (const table of tables) {
    const rows = normalizeStockInTableRows(table);
    if (rows.length < 2) continue;
    const headerRow = rows[0] || [];
    const mapping = findHrRecordHeaderMapping(headerRow);
    if (!mapping.size) continue;

    for (let rowIndex = 1; rowIndex < rows.length && rowsOut.length < maxRowsPerPlan; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const record = buildHrRecordLineFromRow(headerRow, row, mapping, rowIndex, `table:${table.sheet_name || table.name || ''}:row:${rowIndex + 1}`);
      if (lineHasHrRecordValue(record.line, record.unmappedFields)) rowsOut.push(record);
    }
  }
  return rowsOut;
}

function hrRecordRowsFromText({ parseResult, entryPlan }) {
  const documents = safeJson(entryPlan?.documents, []);
  const text = normalizeMultilineText(
    parseResult?.text_content || documents[0]?.extracted_text_preview || '',
    20000
  );
  if (!text) return [];
  const hours = parseOptionalNumber(extractTextValueFromDefinitions(text, 'hours', hrRecordFieldAliasKeys)) ?? 0;
  const overtimeHours = parseOptionalNumber(extractTextValueFromDefinitions(text, 'overtimeHours', hrRecordFieldAliasKeys)) ?? 0;
  const leaveHours = parseOptionalNumber(extractTextValueFromDefinitions(text, 'leaveHours', hrRecordFieldAliasKeys)) ?? 0;
  const absenceHours = parseOptionalNumber(extractTextValueFromDefinitions(text, 'absenceHours', hrRecordFieldAliasKeys)) ?? 0;
  const eventTypeRaw = extractTextValueFromDefinitions(text, 'eventType', hrRecordFieldAliasKeys);
  const line = {
    recordNo: extractTextValueFromDefinitions(text, 'recordNo', hrRecordFieldAliasKeys),
    eventDate: normalizeDate(extractTextValueFromDefinitions(text, 'eventDate', hrRecordFieldAliasKeys)),
    employeeNo: extractTextValueFromDefinitions(text, 'employeeNo', hrRecordFieldAliasKeys),
    employeeName: extractTextValueFromDefinitions(text, 'employeeName', hrRecordFieldAliasKeys),
    department: extractTextValueFromDefinitions(text, 'department', hrRecordFieldAliasKeys),
    position: extractTextValueFromDefinitions(text, 'position', hrRecordFieldAliasKeys),
    eventType: inferHrEventType(eventTypeRaw, { overtimeHours, leaveHours, absenceHours }),
    hours,
    overtimeHours,
    leaveHours,
    absenceHours,
    status: normalizeHrRecordStatus(extractTextValueFromDefinitions(text, 'status', hrRecordFieldAliasKeys)),
    handler: extractTextValueFromDefinitions(text, 'handler', hrRecordFieldAliasKeys) || defaultOperator,
    remark: extractTextValueFromDefinitions(text, 'remark', hrRecordFieldAliasKeys)
  };

  const unmappedFields = [{
    name: '原文摘录',
    value: text.slice(0, 1200),
    confidence: 0.4,
    source: '解析文本'
  }];

  return lineHasHrRecordValue(line, unmappedFields) ? [{ line, unmappedFields, rowIndex: null, source: 'text' }] : [];
}

function buildHrRecordRowsFromPlan({ parseResult, entryPlan }) {
  const tableRows = hrRecordRowsFromTables({ parseResult, entryPlan });
  if (tableRows.length) return tableRows;
  return hrRecordRowsFromText({ parseResult, entryPlan });
}

function validateHrRecordLine(line) {
  const errors = [];
  if (!normalizeText(line.employeeNo, 120) && !normalizeText(line.employeeName, 160)) errors.push('缺少员工编号/姓名');
  for (const field of ['hours', 'overtimeHours', 'leaveHours', 'absenceHours']) {
    if (!Number.isFinite(Number(line[field] || 0))) errors.push(`${field} 必须是数字`);
    if (Number(line[field] || 0) < 0) errors.push(`${field} 不能小于 0`);
  }
  return errors;
}

function buildGeneratedHrRecordNo(entryPlan, index) {
  const basis = normalizeText(entryPlan?.id || entryPlan?.asset_id || 'PLAN', 80)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 18) || 'PLAN';
  return `AI-HR-${basis}-${String((Number(index) || 0) + 1).padStart(3, '0')}`;
}

function buildHrRecordPayload({ line, asset, entryPlan, source, index, unmappedFields = [] }) {
  const recordNo = normalizeText(line.recordNo, 120) || buildGeneratedHrRecordNo(entryPlan, index);
  const rawHours = Number(line.hours || 0);
  let overtimeHours = Number(line.overtimeHours || 0);
  let leaveHours = Number(line.leaveHours || 0);
  let absenceHours = Number(line.absenceHours || 0);
  const eventType = normalizeHrEventType(line.eventType);
  const hours = rawHours > 0 ? rawHours : Math.max(overtimeHours, leaveHours, absenceHours, 0);
  if (eventType === '加班' && overtimeHours <= 0) overtimeHours = hours;
  if (eventType === '请假' && leaveHours <= 0) leaveHours = hours;
  if (eventType === '考勤' && absenceHours <= 0 && /缺勤|旷工/.test(normalizeText(line.remark, 500))) absenceHours = hours;
  return {
    record_no: recordNo,
    record_date: line.eventDate || null,
    employee_no: normalizeText(line.employeeNo, 120) || null,
    employee_name: normalizeText(line.employeeName, 160),
    department: normalizeText(line.department, 160) || null,
    position: normalizeText(line.position, 160) || null,
    event_type: eventType,
    hours,
    overtime_hours: overtimeHours,
    leave_hours: leaveHours,
    absence_hours: absenceHours,
    record_status: normalizeHrRecordStatus(line.status),
    handler: normalizeText(line.handler, 120) || defaultOperator,
    remark: normalizeText(line.remark, 1200) || null,
    properties: {
      ai_generated: true,
      source: source || '',
      source_asset_id: asset?.id || null,
      source_filename: asset?.original_filename || '',
      entry_plan_id: entryPlan?.id || null,
      __ai_unmapped_fields: unmappedFields
    }
  };
}

function isHrAttendanceSyncCandidate(payload) {
  if (!payload || payload.record_status === 'voided') return false;
  if (!payload.record_date) return false;
  return ['考勤', '请假', '加班'].includes(normalizeHrEventType(payload.event_type));
}

async function databaseObjectExists(client, regclassName) {
  const result = await client.query(
    `select to_regclass($1)::text as object_name`,
    [regclassName]
  );
  return Boolean(result.rows[0]?.object_name);
}

async function resolveHrArchiveForAttendance(client, payload) {
  const hasArchiveTable = await databaseObjectExists(client, 'hr.archives');
  if (!hasArchiveTable) return { value: null, error: 'hr.archives table is missing' };

  const employeeNo = normalizeText(payload.employee_no, 120);
  const employeeName = normalizeText(payload.employee_name, 160);
  if (employeeNo) {
    const result = await client.query(
      `select id, employee_no, name, department, position
         from hr.archives
        where lower(employee_no) = lower($1)
          and coalesce(status, '在职') <> 'deleted'
        limit 2`,
      [employeeNo]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `员工编号重复：${employeeNo}` };
  }

  if (employeeName) {
    const result = await client.query(
      `select id, employee_no, name, department, position
         from hr.archives
        where lower(name) = lower($1)
          and coalesce(status, '在职') <> 'deleted'
        limit 2`,
      [employeeName]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `员工姓名重复：${employeeName}` };
  }

  return { value: null, error: employeeNo || employeeName ? '未匹配到人事档案' : '缺少员工编号/姓名' };
}

function buildHrAttendanceSyncPayload({ payload, archive, record = null }) {
  const eventType = normalizeHrEventType(payload.event_type);
  const hours = Math.max(0, Number(payload.hours || 0));
  const overtimeHours = Math.max(0, Number(payload.overtime_hours || (eventType === '加班' ? hours : 0)));
  const leaveHours = Math.max(0, Number(payload.leave_hours || (eventType === '请假' ? hours : 0)));
  const absenceHours = Math.max(0, Number(payload.absence_hours || 0));
  const remark = normalizeText(payload.remark, 1000);
  const isLeave = eventType === '请假' || leaveHours > 0;
  const isAbsent = absenceHours > 0 || /缺勤|旷工|absent/i.test(remark);
  const overtimeMinutes = Math.round(overtimeHours * 60);
  const remarkParts = [
    remark,
    `AI人事记录：${payload.record_no}`,
    eventType === '请假' && leaveHours > 0 ? `请假时长：${leaveHours}小时` : '',
    eventType === '加班' && overtimeHours > 0 ? `加班时长：${overtimeHours}小时` : '',
    absenceHours > 0 ? `缺勤时长：${absenceHours}小时` : ''
  ].filter(Boolean);

  return {
    att_date: payload.record_date,
    person_type: 'employee',
    employee_id: archive.id,
    employee_name: normalizeText(archive.name || payload.employee_name, 160),
    employee_no: normalizeText(archive.employee_no || payload.employee_no, 120),
    dept_name: normalizeText(archive.department || payload.department, 160),
    shift_name: eventType === '请假' ? '请假补录' : (eventType === '加班' ? '加班补录' : 'AI补录'),
    shift_start_time: '08:30',
    shift_end_time: '17:30',
    shift_cross_day: false,
    late_grace_min: 10,
    early_grace_min: 10,
    ot_break_min: 30,
    punch_times: [],
    late_flag: /迟到|late/i.test(remark),
    early_flag: /早退|early/i.test(remark),
    leave_flag: isLeave,
    absent_flag: isAbsent,
    overtime_minutes: overtimeMinutes,
    remark: remarkParts.join('\n').slice(0, 1800),
    properties: {
      ai_generated: true,
      source: 'document_intake_hr_record',
      source_hr_record_id: record?.id || null,
      source_hr_record_no: payload.record_no,
      source_event_type: eventType
    }
  };
}

async function upsertHrAttendanceRecord(client, attendancePayload) {
  const result = await client.query(
    `insert into hr.attendance_records as ar (
       att_date, person_type, employee_id, employee_name, employee_no, dept_name,
       shift_name, shift_start_time, shift_end_time, shift_cross_day,
       late_grace_min, early_grace_min, ot_break_min, punch_times,
       late_flag, early_flag, leave_flag, absent_flag, overtime_minutes, remark, properties
     ) values (
       $1::date,$2,$3,$4,$5,$6,
       $7,$8::time,$9::time,$10,
       $11,$12,$13,$14::text[],
       $15,$16,$17,$18,$19,$20,$21::jsonb
     )
     on conflict (att_date, employee_id) where (person_type = 'employee' and employee_id is not null)
     do update set
       employee_name = excluded.employee_name,
       employee_no = excluded.employee_no,
       dept_name = excluded.dept_name,
       shift_name = case
         when excluded.leave_flag or excluded.overtime_minutes > 0 or excluded.absent_flag then excluded.shift_name
         else ar.shift_name
       end,
       late_flag = coalesce(ar.late_flag, false) or coalesce(excluded.late_flag, false),
       early_flag = coalesce(ar.early_flag, false) or coalesce(excluded.early_flag, false),
       leave_flag = coalesce(ar.leave_flag, false) or coalesce(excluded.leave_flag, false),
       absent_flag = coalesce(ar.absent_flag, false) or coalesce(excluded.absent_flag, false),
       overtime_minutes = greatest(coalesce(ar.overtime_minutes, 0), coalesce(excluded.overtime_minutes, 0)),
       remark = left(concat_ws(E'\\n', nullif(ar.remark, ''), nullif(excluded.remark, '')), 1800),
       properties = coalesce(ar.properties, '{}'::jsonb) || excluded.properties,
       updated_at = now()
     returning id::text as id, att_date, employee_id, employee_no`,
    [
      attendancePayload.att_date,
      attendancePayload.person_type,
      attendancePayload.employee_id,
      attendancePayload.employee_name,
      attendancePayload.employee_no,
      attendancePayload.dept_name,
      attendancePayload.shift_name,
      attendancePayload.shift_start_time,
      attendancePayload.shift_end_time,
      attendancePayload.shift_cross_day,
      attendancePayload.late_grace_min,
      attendancePayload.early_grace_min,
      attendancePayload.ot_break_min,
      attendancePayload.punch_times,
      attendancePayload.late_flag,
      attendancePayload.early_flag,
      attendancePayload.leave_flag,
      attendancePayload.absent_flag,
      attendancePayload.overtime_minutes,
      attendancePayload.remark,
      JSON.stringify(attendancePayload.properties || {})
    ]
  );
  return result.rows[0] || null;
}

async function syncHrAttendanceFromRecord(client, { payload, record = null }) {
  if (!isHrAttendanceSyncCandidate(payload)) {
    return { status: 'not_applicable', message: '非考勤/请假/加班事件或缺少日期，未同步考勤明细。' };
  }

  await client.query('savepoint document_fixed_entry_hr_attendance');
  try {
    const hasAttendanceTable = await databaseObjectExists(client, 'hr.attendance_records');
    if (!hasAttendanceTable) {
      await client.query('release savepoint document_fixed_entry_hr_attendance');
      return { status: 'skipped', message: 'hr.attendance_records table is missing' };
    }

    const archiveResolution = await resolveHrArchiveForAttendance(client, payload);
    if (!archiveResolution.value) {
      await client.query('release savepoint document_fixed_entry_hr_attendance');
      return { status: 'skipped', message: archiveResolution.error || '未匹配到人事档案' };
    }

    const attendancePayload = buildHrAttendanceSyncPayload({
      payload,
      archive: archiveResolution.value,
      record
    });
    const attendanceRecord = await upsertHrAttendanceRecord(client, attendancePayload);
    await client.query('release savepoint document_fixed_entry_hr_attendance');
    return {
      status: 'synced',
      message: '已同步到 hr.attendance_records。',
      attendanceRecordId: attendanceRecord?.id || '',
      attendancePayload
    };
  } catch (error) {
    await client.query('rollback to savepoint document_fixed_entry_hr_attendance').catch(() => {});
    await client.query('release savepoint document_fixed_entry_hr_attendance').catch(() => {});
    return {
      status: 'failed',
      message: normalizeText(error?.message || error, 1000)
    };
  }
}

async function markHrAttendanceSyncStatus(client, { record, syncResult }) {
  if (!record?.id) return;
  await client.query('savepoint document_fixed_entry_hr_attendance_mark');
  try {
    await client.query(
      `update hr.document_intake_records
          set attendance_record_id = $2,
              attendance_sync_status = $3,
              attendance_sync_message = $4,
              properties = coalesce(properties, '{}'::jsonb) || jsonb_build_object('attendance_sync', $5::jsonb),
              updated_at = now()
        where id::text = $1`,
      [
        String(record.id),
        syncResult.attendanceRecordId || null,
        syncResult.status || 'not_applicable',
        normalizeText(syncResult.message, 1000),
        JSON.stringify({
          status: syncResult.status || 'not_applicable',
          message: normalizeText(syncResult.message, 1000),
          attendance_record_id: syncResult.attendanceRecordId || ''
        })
      ]
    );
    await client.query('release savepoint document_fixed_entry_hr_attendance_mark');
  } catch {
    await client.query('rollback to savepoint document_fixed_entry_hr_attendance_mark').catch(() => {});
    await client.query('release savepoint document_fixed_entry_hr_attendance_mark').catch(() => {});
  }
}

function normalizeQualityInspectionType(value) {
  const text = normalizeText(value, 80);
  if (!text) return '来料检验';
  if (['来料检验', '过程巡检', '首件检验', '成品抽检'].includes(text)) return text;
  if (/来料|进料|iqc/i.test(text)) return '来料检验';
  if (/过程|巡检|制程|ipqc/i.test(text)) return '过程巡检';
  if (/首件|首检|first/i.test(text)) return '首件检验';
  if (/成品|出货|抽检|oqc|fqc/i.test(text)) return '成品抽检';
  return '来料检验';
}

function normalizeQualityResult(value, { defectQty = null } = {}) {
  const text = normalizeText(value, 80);
  if (!text) return '待判定';
  if (['待判定', '合格', '让步接收', '不合格'].includes(text)) return text;
  if (/让步|特采|放行/i.test(text)) return '让步接收';
  if (/不合格|不良|失败|fail|ng|拒收|报废/i.test(text)) return '不合格';
  if (/合格|通过|pass|ok/i.test(text)) return '合格';
  if (Number(defectQty) > 0) return '不合格';
  return '待判定';
}

function lineHasQualityValue(line, unmappedFields) {
  const sourceFields = [
    'docNo',
    'sourceDocNo',
    'itemCode',
    'itemName',
    'sourceName',
    'batchNo',
    'inspectionDate',
    'remark'
  ];
  const hasText = sourceFields.some((field) => line[field] !== null && line[field] !== undefined && String(line[field]).trim() !== '');
  const hasQuantity = Number(line.sampleQty || 0) > 0 || Number(line.defectQty || 0) > 0;
  const hasDecision = normalizeText(line.result, 80) && normalizeText(line.result, 80) !== '待判定';
  const hasInspector = normalizeText(line.inspector, 120) && normalizeText(line.inspector, 120) !== defaultOperator;
  return hasText || hasQuantity || hasDecision || hasInspector
    || unmappedFields.length > 0;
}

function buildQualityLineFromRow(headerRow, row, mapping, rowIndex, sourceLabel) {
  const sampleQtyRaw = extractValue(row, mapping, 'sampleQty');
  const defectQtyRaw = extractValue(row, mapping, 'defectQty');
  const sampleQty = sampleQtyRaw ? parseOptionalNumber(sampleQtyRaw) : 0;
  const defectQty = defectQtyRaw ? parseOptionalNumber(defectQtyRaw) : 0;
  const line = {
    docNo: extractValue(row, mapping, 'docNo'),
    inspectionType: normalizeQualityInspectionType(extractValue(row, mapping, 'inspectionType')),
    sourceDocNo: extractValue(row, mapping, 'sourceDocNo'),
    itemCode: extractValue(row, mapping, 'itemCode'),
    itemName: extractValue(row, mapping, 'itemName'),
    sourceName: extractValue(row, mapping, 'sourceName'),
    batchNo: extractValue(row, mapping, 'batchNo'),
    sampleQty,
    defectQty,
    result: normalizeQualityResult(extractValue(row, mapping, 'result'), { defectQty }),
    inspector: extractValue(row, mapping, 'inspector') || defaultOperator,
    inspectionDate: normalizeDate(extractValue(row, mapping, 'inspectionDate')),
    remark: extractValue(row, mapping, 'remark')
  };

  const mappedIndexes = new Set([...mapping.values()]);
  const unmappedFields = [];
  for (let index = 0; index < row.length; index += 1) {
    if (mappedIndexes.has(index)) continue;
    const value = normalizeCell(row[index]);
    if (!value) continue;
    unmappedFields.push({
      name: normalizeCell(headerRow?.[index]) || `第${index + 1}列`,
      value,
      confidence: 0.55,
      source: sourceLabel
    });
  }

  return {
    line,
    unmappedFields,
    rowIndex,
    source: sourceLabel
  };
}

function qualityRowsFromTables({ parseResult, entryPlan }) {
  const tables = extractTables(parseResult, entryPlan);
  const rowsOut = [];
  for (const table of tables) {
    const rows = normalizeStockInTableRows(table);
    if (rows.length < 2) continue;
    const headerRow = rows[0] || [];
    const mapping = findQualityHeaderMapping(headerRow);
    if (!mapping.size) continue;

    for (let rowIndex = 1; rowIndex < rows.length && rowsOut.length < maxRowsPerPlan; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const record = buildQualityLineFromRow(headerRow, row, mapping, rowIndex, `table:${table.sheet_name || table.name || ''}:row:${rowIndex + 1}`);
      if (lineHasQualityValue(record.line, record.unmappedFields)) rowsOut.push(record);
    }
  }
  return rowsOut;
}

function qualityRowsFromText({ parseResult, entryPlan }) {
  const documents = safeJson(entryPlan?.documents, []);
  const text = normalizeMultilineText(
    parseResult?.text_content || documents[0]?.extracted_text_preview || '',
    20000
  );
  if (!text) return [];
  const sampleQtyRaw = extractTextValueFromDefinitions(text, 'sampleQty', qualityFieldAliasKeys);
  const defectQtyRaw = extractTextValueFromDefinitions(text, 'defectQty', qualityFieldAliasKeys);
  const sampleQty = sampleQtyRaw ? parseOptionalNumber(sampleQtyRaw) : 0;
  const defectQty = defectQtyRaw ? parseOptionalNumber(defectQtyRaw) : 0;
  const line = {
    docNo: extractTextValueFromDefinitions(text, 'docNo', qualityFieldAliasKeys),
    inspectionType: normalizeQualityInspectionType(extractTextValueFromDefinitions(text, 'inspectionType', qualityFieldAliasKeys)),
    sourceDocNo: extractTextValueFromDefinitions(text, 'sourceDocNo', qualityFieldAliasKeys),
    itemCode: extractTextValueFromDefinitions(text, 'itemCode', qualityFieldAliasKeys),
    itemName: extractTextValueFromDefinitions(text, 'itemName', qualityFieldAliasKeys),
    sourceName: extractTextValueFromDefinitions(text, 'sourceName', qualityFieldAliasKeys),
    batchNo: extractTextValueFromDefinitions(text, 'batchNo', qualityFieldAliasKeys),
    sampleQty,
    defectQty,
    result: normalizeQualityResult(extractTextValueFromDefinitions(text, 'result', qualityFieldAliasKeys), { defectQty }),
    inspector: extractTextValueFromDefinitions(text, 'inspector', qualityFieldAliasKeys) || defaultOperator,
    inspectionDate: normalizeDate(extractTextValueFromDefinitions(text, 'inspectionDate', qualityFieldAliasKeys)),
    remark: extractTextValueFromDefinitions(text, 'remark', qualityFieldAliasKeys)
  };

  const unmappedFields = [{
    name: '原文摘录',
    value: text.slice(0, 1200),
    confidence: 0.4,
    source: '解析文本'
  }];

  return lineHasQualityValue(line, unmappedFields) ? [{ line, unmappedFields, rowIndex: null, source: 'text' }] : [];
}

function buildQualityInspectionRowsFromPlan({ parseResult, entryPlan }) {
  const tableRows = qualityRowsFromTables({ parseResult, entryPlan });
  if (tableRows.length) return tableRows;
  return qualityRowsFromText({ parseResult, entryPlan });
}

function validateQualityInspectionLine(line) {
  const errors = [];
  if (!normalizeText(line.itemName, 200)) errors.push('缺少检验对象/物料名称');
  if (line.sampleQty === null || line.sampleQty === undefined || !Number.isFinite(Number(line.sampleQty))) errors.push('抽样数量必须是数字');
  if (line.defectQty === null || line.defectQty === undefined || !Number.isFinite(Number(line.defectQty))) errors.push('不良数量必须是数字');
  if (Number(line.sampleQty) < 0) errors.push('抽样数量不能小于 0');
  if (Number(line.defectQty) < 0) errors.push('不良数量不能小于 0');
  if (Number(line.defectQty) > Number(line.sampleQty)) errors.push('不良数量不能大于抽样数量');
  return errors;
}

function buildGeneratedQualityDocNo(entryPlan, index) {
  const basis = normalizeText(entryPlan?.id || entryPlan?.asset_id || 'PLAN', 80)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 18) || 'PLAN';
  return `AI-QC-${basis}-${String((Number(index) || 0) + 1).padStart(3, '0')}`;
}

function buildQualityInspectionPayload({ line, entryPlan, asset, source, index }) {
  const docNo = normalizeText(line.docNo, 120) || buildGeneratedQualityDocNo(entryPlan, index);
  return {
    doc_no: docNo,
    inspection_type: normalizeQualityInspectionType(line.inspectionType),
    source_doc_no: normalizeText(line.sourceDocNo, 120) || null,
    item_code: normalizeText(line.itemCode, 120) || null,
    item_name: normalizeText(line.itemName, 240),
    source_name: normalizeText(line.sourceName, 240) || null,
    batch_no: normalizeText(line.batchNo, 120) || null,
    sample_qty: Number(line.sampleQty || 0),
    defect_qty: Number(line.defectQty || 0),
    result: normalizeQualityResult(line.result, { defectQty: line.defectQty }),
    inspector: normalizeText(line.inspector, 120) || defaultOperator,
    inspection_date: line.inspectionDate || null,
    remark: normalizeText(line.remark, 1200) || null,
    properties: {
      ai_generated: true,
      source: source || '',
      source_asset_id: asset?.id || null,
      source_filename: asset?.original_filename || '',
      entry_plan_id: entryPlan?.id || null
    }
  };
}

function validateStockInLine(line, resolved = {}) {
  const errors = [];
  if (!resolved.material?.id) errors.push('未匹配到物料主数据');
  if (!resolved.warehouse?.id) errors.push('未匹配到仓库/库位');
  if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) errors.push('入库数量必须大于 0');
  if (!normalizeText(line.unit, 80)) errors.push('缺少单位');
  if (!normalizeText(line.batchNo, 120)) errors.push('缺少批次号');
  return errors;
}

function buildRpcRemark({ line, asset, source }) {
  const parts = [];
  if (line.remark) parts.push(normalizeText(line.remark, 600));
  if (line.supplier) parts.push(`供应商：${normalizeText(line.supplier, 200)}`);
  if (line.purchasePrice !== null && line.purchasePrice !== undefined && String(line.purchasePrice) !== '') {
    parts.push(`采购单价：${line.purchasePrice}`);
  }
  if (asset?.original_filename) parts.push(`AI来源文件：${normalizeText(asset.original_filename, 200)}`);
  if (source) parts.push(`AI来源位置：${normalizeText(source, 200)}`);
  return parts.join('\n').slice(0, 1800) || null;
}

function buildStockInPayload({ line, material, warehouse, asset, source }) {
  return {
    p_material_id: Number(material.id),
    p_warehouse_id: warehouse.id,
    p_quantity: Number(line.quantity),
    p_unit: normalizeText(line.unit, 80),
    p_batch_no: normalizeText(line.batchNo, 120),
    p_transaction_no: normalizeText(line.transactionNo, 120) || null,
    p_operator: normalizeText(line.operator, 120) || defaultOperator,
    p_production_date: line.productionDate || null,
    p_remark: buildRpcRemark({ line, asset, source }),
    p_io_type: normalizeText(line.ioType, 80) || defaultIoType
  };
}

async function resolveMaterial(client, line) {
  const materialCode = normalizeText(line.materialCode, 120);
  const materialName = normalizeText(line.materialName, 200);
  if (materialCode) {
    const result = await client.query(
      `select id, batch_no, name
         from public.raw_materials
        where lower(batch_no) = lower($1)
        limit 2`,
      [materialCode]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `物料编码重复：${materialCode}` };
  }
  if (materialName) {
    const result = await client.query(
      `select id, batch_no, name
         from public.raw_materials
        where lower(name) = lower($1)
        limit 2`,
      [materialName]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `物料名称重复：${materialName}` };
  }
  return { value: null, error: materialCode || materialName ? '未找到物料主数据' : '缺少物料编码/名称' };
}

async function resolveWarehouse(client, line) {
  const warehouseCode = normalizeText(line.warehouseCode, 120);
  const warehouseName = normalizeText(line.warehouseName, 200);
  if (warehouseCode) {
    const result = await client.query(
      `select id, code, name
         from scm.warehouses
        where lower(code) = lower($1)
          and coalesce(status, '启用') = '启用'
        limit 2`,
      [warehouseCode]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `仓库编码重复：${warehouseCode}` };
  }
  if (warehouseName) {
    const result = await client.query(
      `select id, code, name
         from scm.warehouses
        where lower(name) = lower($1)
          and coalesce(status, '启用') = '启用'
        limit 2`,
      [warehouseName]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `仓库名称重复：${warehouseName}` };
  }
  return { value: null, error: warehouseCode || warehouseName ? '未找到仓库/库位' : '缺少仓库编码/名称' };
}

async function insertUnmappedField(client, { asset, entryPlan, recordId = '', field, targetSchema = 'scm', targetTable = 'inventory_transactions' }) {
  await client.query(
    `insert into public.document_unmapped_fields (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, name, value, confidence, source, write_location, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      normalizeText(targetSchema, 120) || 'scm',
      targetTable,
      String(recordId || ''),
      normalizeText(field.name, 200) || '未匹配字段',
      normalizeText(field.value, 4000),
      Number(field.confidence || 0),
      normalizeText(field.source, 300),
      field.writeLocation || 'remarks',
      JSON.stringify({
        reason: field.reason || '',
        ai_generated: true,
        source_filename: asset.original_filename || ''
      })
    ]
  );
}

async function callStockIn(client, payload) {
  await client.query('savepoint document_fixed_entry_row');
  try {
    const result = await client.query(
      `select scm.stock_in(
         $1::integer,
         $2::uuid,
         $3::numeric,
         $4::text,
         $5::text,
         $6::text,
         $7::text,
         $8::date,
         $9::text,
         $10::text
       ) as result`,
      [
        payload.p_material_id,
        payload.p_warehouse_id,
        payload.p_quantity,
        payload.p_unit,
        payload.p_batch_no,
        payload.p_transaction_no,
        payload.p_operator,
        payload.p_production_date,
        payload.p_remark,
        payload.p_io_type
      ]
    );
    await client.query('release savepoint document_fixed_entry_row');
    const raw = result.rows[0]?.result || {};
    return typeof raw === 'string' ? safeJson(raw, {}) : raw;
  } catch (error) {
    await client.query('rollback to savepoint document_fixed_entry_row').catch(() => {});
    await client.query('release savepoint document_fixed_entry_row').catch(() => {});
    throw error;
  }
}

async function callStockOut(client, payload) {
  await client.query('savepoint document_fixed_entry_row');
  try {
    const result = await client.query(
      `select scm.stock_out(
         $1::integer,
         $2::uuid,
         $3::numeric,
         $4::text,
         $5::text,
         $6::text,
         $7::text,
         $8::text,
         $9::text
       ) as result`,
      [
        payload.p_material_id,
        payload.p_warehouse_id,
        payload.p_quantity,
        payload.p_unit,
        payload.p_batch_no,
        payload.p_transaction_no,
        payload.p_operator,
        payload.p_remark,
        payload.p_io_type
      ]
    );
    await client.query('release savepoint document_fixed_entry_row');
    const raw = result.rows[0]?.result || {};
    return typeof raw === 'string' ? safeJson(raw, {}) : raw;
  } catch (error) {
    await client.query('rollback to savepoint document_fixed_entry_row').catch(() => {});
    await client.query('release savepoint document_fixed_entry_row').catch(() => {});
    throw error;
  }
}

async function findExistingBusinessLink(client, { targetSchema, targetTable, targetRecordId }) {
  const normalizedRecordId = normalizeText(targetRecordId, 160);
  if (!normalizedRecordId) return null;
  const result = await client.query(
    `select id, asset_id, batch_id, entry_plan_id, target_schema, target_table,
            target_record_id, target_module, target_document_type, target_app_id,
            ai_confidence, metadata, created_at
       from public.document_business_links
      where target_schema = $1
        and target_table = $2
        and target_record_id = $3
      order by case when metadata->>'duplicate_business_source' in ('true', '1', 'yes') then 1 else 0 end,
               created_at asc nulls last,
               id asc
      limit 1`,
    [
      normalizeText(targetSchema, 120),
      normalizeText(targetTable, 160),
      normalizedRecordId
    ]
  );
  return result.rows[0] || null;
}

async function insertDuplicateBusinessLink(client, { asset, entryPlan, existingLink, targetSchema, targetTable, targetRecordId, payload, row, skippedRpc = 'scm.stock_in' }) {
  const normalizedRecordId = normalizeText(targetRecordId, 160);
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      normalizeText(targetSchema, 120),
      normalizeText(targetTable, 160),
      normalizedRecordId,
      entryPlan.target_module || existingLink?.target_module || 'materials',
      entryPlan.target_document_type || existingLink?.target_document_type || '采购入库单',
      existingLink?.target_app_id || null,
      Number(entryPlan.confidence || existingLink?.ai_confidence || 0),
      JSON.stringify({
        ai_generated: true,
        duplicate_business_source: true,
        duplicate_reason: 'target_record_already_linked',
        duplicate_of_business_link_id: existingLink?.id || null,
        duplicate_of_asset_id: existingLink?.asset_id || null,
        source: row?.source || '',
        material_id: payload?.p_material_id || null,
        warehouse_id: payload?.p_warehouse_id || null,
        batch_no: payload?.p_batch_no || '',
        skipped_rpc: skippedRpc
      })
    ]
  );
  return normalizedRecordId;
}

async function insertBusinessLink(client, { asset, entryPlan, stockInResult, payload, row }) {
  const transactionNo = normalizeText(stockInResult?.transaction_no || payload.p_transaction_no || '', 160);
  const targetRecordId = transactionNo || normalizeText(stockInResult?.batch_id || '', 160);
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'scm',
      'inventory_transactions',
      targetRecordId,
      entryPlan.target_module || 'materials',
      entryPlan.target_document_type || '采购入库单',
      null,
      Number(entryPlan.confidence || 0),
      JSON.stringify({
        ai_generated: true,
        source: row.source,
        material_id: payload.p_material_id,
        warehouse_id: payload.p_warehouse_id,
        batch_no: payload.p_batch_no,
        stock_in_result: stockInResult
      })
    ]
  );
  return targetRecordId;
}

async function insertStockOutBusinessLink(client, { asset, entryPlan, stockOutResult, payload, row }) {
  const transactionNo = normalizeText(stockOutResult?.transaction_no || payload.p_transaction_no || '', 160);
  const targetRecordId = transactionNo || normalizeText(stockOutResult?.batch_id || '', 160);
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'scm',
      'inventory_transactions',
      targetRecordId,
      entryPlan.target_module || 'sales',
      entryPlan.target_document_type || '销售出库单',
      null,
      Number(entryPlan.confidence || 0),
      JSON.stringify({
        ai_generated: true,
        source: row.source,
        material_id: payload.p_material_id,
        warehouse_id: payload.p_warehouse_id,
        batch_no: payload.p_batch_no,
        sales_order_no: payload.sales_order_no || '',
        customer: payload.customer || '',
        stock_out_result: stockOutResult
      })
    ]
  );
  return targetRecordId;
}

async function resolveProductionWorkOrder(client, line) {
  const workOrderNo = normalizeText(line.workOrderNo, 160);
  if (!workOrderNo) return { value: null, error: '' };
  const result = await client.query(
    `select id::text as id, work_order_no, product_material_id, product_material_code,
            product_material_name, planned_qty::text as planned_qty, unit, work_order_status
       from scm.production_work_orders
      where lower(work_order_no) = lower($1)
      limit 2`,
    [workOrderNo]
  );
  if (result.rows.length === 1) return { value: result.rows[0], error: '' };
  if (result.rows.length > 1) return { value: null, error: `生产工单号重复：${workOrderNo}` };
  return { value: null, error: `未找到生产工单：${workOrderNo}` };
}

async function findExistingProductionWorkReport(client, reportNo) {
  const normalizedReportNo = normalizeText(reportNo, 160);
  if (!normalizedReportNo) return null;
  const result = await client.query(
    `select id::text as id, report_no, work_order_no, report_status, created_at
       from scm.production_work_reports
      where report_no = $1
      order by created_at asc nulls last, id asc
      limit 1`,
    [normalizedReportNo]
  );
  return result.rows[0] || null;
}

async function insertProductionWorkReport(client, payload) {
  const result = await client.query(
    `insert into scm.production_work_reports (
       report_no, report_date, work_order_id, work_order_no,
       product_material_id, product_material_code, product_material_name,
       process_name, workshop_name, production_line, shift_name, team_name,
       completed_qty, good_qty, defect_qty, scrap_qty, unit,
       operator, remark, properties, created_by
     ) values (
       $1,coalesce($2::date, current_date),$3::uuid,$4,
       $5,$6,$7,
       $8,$9,$10,$11,$12,
       $13,$14,$15,$16,$17,
       $18,$19,$20,$21
     )
     returning id::text as id, report_no`,
    [
      payload.report_no,
      payload.report_date,
      payload.work_order_id,
      payload.work_order_no,
      payload.product_material_id,
      payload.product_material_code,
      payload.product_material_name,
      payload.process_name,
      payload.workshop_name,
      payload.production_line,
      payload.shift_name,
      payload.team_name,
      payload.completed_qty,
      payload.good_qty,
      payload.defect_qty,
      payload.scrap_qty,
      payload.unit,
      payload.operator,
      payload.remark,
      JSON.stringify(payload.properties || {}),
      payload.operator
    ]
  );
  return result.rows[0] || null;
}

async function refreshProductionWorkOrderProgress(client, payload) {
  if (!payload.work_order_no) return;
  await client.query(
    `with report_stats as (
       select coalesce(sum(completed_qty), 0)::numeric(18, 6) as completed_qty,
              coalesce(sum(defect_qty), 0)::numeric(18, 6) as defect_qty,
              coalesce(sum(scrap_qty), 0)::numeric(18, 6) as scrap_qty
         from scm.production_work_reports
        where work_order_no = $1
          and report_status = 'active'
     )
     update scm.production_work_orders wo
        set work_order_status = case
              when wo.work_order_status = '已取消' then wo.work_order_status
              when report_stats.completed_qty >= wo.planned_qty and wo.planned_qty > 0 then '已完工'
              when report_stats.completed_qty > 0 then '生产中'
              else wo.work_order_status
            end,
            properties = coalesce(wo.properties, '{}'::jsonb) || jsonb_build_object(
              'last_ai_work_report_no', $2,
              'reported_completed_qty', report_stats.completed_qty,
              'reported_defect_qty', report_stats.defect_qty,
              'reported_scrap_qty', report_stats.scrap_qty
            ),
            updated_at = now()
       from report_stats
      where wo.work_order_no = $1`,
    [payload.work_order_no, payload.report_no]
  );
}

async function insertProductionWorkReportBusinessLink(client, { asset, entryPlan, report, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'scm',
      'production_work_reports',
      payload.report_no,
      entryPlan.target_module || 'production',
      entryPlan.target_document_type || '生产日报',
      null,
      Number(entryPlan.confidence || 0),
      JSON.stringify({
        ai_generated: true,
        source: row.source,
        production_work_report_id: report?.id || null,
        report_no: payload.report_no,
        work_order_no: payload.work_order_no || '',
        product_material_id: payload.product_material_id,
        process_name: payload.process_name || '',
        completed_qty: payload.completed_qty,
        good_qty: payload.good_qty,
        defect_qty: payload.defect_qty,
        scrap_qty: payload.scrap_qty
      })
    ]
  );
  return payload.report_no;
}

async function insertDuplicateProductionWorkReportBusinessLink(client, { asset, entryPlan, existingLink, existingReport, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'scm',
      'production_work_reports',
      payload.report_no,
      entryPlan.target_module || existingLink?.target_module || 'production',
      entryPlan.target_document_type || existingLink?.target_document_type || '生产日报',
      existingLink?.target_app_id || null,
      Number(entryPlan.confidence || existingLink?.ai_confidence || 0),
      JSON.stringify({
        ai_generated: true,
        duplicate_business_source: true,
        duplicate_reason: existingLink ? 'target_record_already_linked' : 'production_report_no_already_exists',
        duplicate_of_business_link_id: existingLink?.id || null,
        duplicate_of_asset_id: existingLink?.asset_id || null,
        existing_production_work_report_id: existingReport?.id || null,
        source: row?.source || '',
        report_no: payload.report_no,
        work_order_no: payload.work_order_no || '',
        completed_qty: payload.completed_qty,
        defect_qty: payload.defect_qty,
        scrap_qty: payload.scrap_qty
      })
    ]
  );
  return payload.report_no;
}

async function importProductionWorkReportPlan(client, { asset, entryPlan, parseResult }) {
  const workReportRows = buildProductionWorkReportRowsFromPlan({ parseResult, entryPlan }).slice(0, maxRowsPerPlan);
  if (!workReportRows.length) {
    await client.query(
      `update public.document_entry_plans
          set status = 'failed',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
        where id = $1`,
      [entryPlan.id, JSON.stringify({ import_error: 'No production work report rows generated from entry plan' })]
    );
    return { finalStatus: 'failed', imported: [], duplicates: [], rejected: [{ source: 'plan', reason: 'No production work report rows generated from entry plan' }] };
  }

  const imported = [];
  const rejected = [];
  const duplicates = [];
  for (let index = 0; index < workReportRows.length; index += 1) {
    const workReportRow = workReportRows[index];
    const workOrderResolution = await resolveProductionWorkOrder(client, workReportRow.line);
    const materialResolution = workOrderResolution.value
      ? {
          value: {
            id: workOrderResolution.value.product_material_id,
            batch_no: workOrderResolution.value.product_material_code,
            name: workOrderResolution.value.product_material_name
          },
          error: ''
        }
      : await resolveMaterial(client, workReportRow.line);
    const resolved = {
      workOrder: workOrderResolution.value,
      material: materialResolution.value
    };
    const validationErrors = [
      ...validateProductionWorkReportLine(workReportRow.line, resolved),
      workOrderResolution.error ? workOrderResolution.error : '',
      materialResolution.error && !materialResolution.value ? materialResolution.error : ''
    ].filter(Boolean);

    const payload = buildProductionWorkReportPayload({
      line: workReportRow.line,
      material: resolved.material || {},
      workOrder: resolved.workOrder,
      asset,
      entryPlan,
      source: workReportRow.source,
      index: workReportRow.rowIndex ?? index
    });

    if (validationErrors.length) {
      const message = validationErrors.join('；');
      rejected.push({ source: workReportRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.report_no,
        targetSchema: 'scm',
        targetTable: 'production_work_reports',
        field: {
          name: '生产报工行无法自动执行',
          value: message,
          confidence: 0.25,
          source: workReportRow.source,
          writeLocation: 'remarks',
          reason: 'required_field_validation_failed'
        }
      });
      continue;
    }

    try {
      const existingBusinessLink = await findExistingBusinessLink(client, {
        targetSchema: 'scm',
        targetTable: 'production_work_reports',
        targetRecordId: payload.report_no
      });
      const existingReport = await findExistingProductionWorkReport(client, payload.report_no);
      if (existingBusinessLink || existingReport) {
        const targetRecordId = await insertDuplicateProductionWorkReportBusinessLink(client, {
          asset,
          entryPlan,
          existingLink: existingBusinessLink,
          existingReport,
          payload,
          row: workReportRow
        });
        duplicates.push({
          source: workReportRow.source,
          targetRecordId,
          duplicateOfBusinessLinkId: existingBusinessLink?.id || null,
          existingProductionWorkReportId: existingReport?.id || null
        });
        for (const field of workReportRow.unmappedFields || []) {
          await insertUnmappedField(client, {
            asset,
            entryPlan,
            recordId: targetRecordId,
            targetSchema: 'scm',
            targetTable: 'production_work_reports',
            field
          });
        }
        continue;
      }

      const report = await insertProductionWorkReport(client, payload);
      await refreshProductionWorkOrderProgress(client, payload);
      const targetRecordId = await insertProductionWorkReportBusinessLink(client, {
        asset,
        entryPlan,
        report,
        payload,
        row: workReportRow
      });
      imported.push({ source: workReportRow.source, targetRecordId, productionWorkReportId: report?.id || null });
      for (const field of workReportRow.unmappedFields || []) {
        await insertUnmappedField(client, {
          asset,
          entryPlan,
          recordId: targetRecordId,
          targetSchema: 'scm',
          targetTable: 'production_work_reports',
          field
        });
      }
    } catch (error) {
      const message = normalizeText(error?.message || error, 1000);
      rejected.push({ source: workReportRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.report_no,
        targetSchema: 'scm',
        targetTable: 'production_work_reports',
        field: {
          name: '生产报工入库失败',
          value: message,
          confidence: 0.2,
          source: workReportRow.source,
          writeLocation: 'remarks',
          reason: 'production_work_report_insert_failed'
        }
      });
    }
  }

  const completedCount = imported.length + duplicates.length;
  const finalStatus = rejected.length
    ? (completedCount ? 'partial' : 'failed')
    : (imported.length ? 'imported' : (duplicates.length ? 'skipped_duplicate' : 'failed'));
  const assetStatus = finalStatus === 'failed' ? 'failed' : (finalStatus === 'partial' ? 'partial_imported' : 'imported');
  const attendanceSyncCounts = imported.reduce((counts, item) => {
    const status = item.attendanceSync?.status || 'not_applicable';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  await client.query(
    `update public.document_entry_plans
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      entryPlan.id,
      finalStatus,
      JSON.stringify({
        imported_at: new Date().toISOString(),
        imported_count: imported.length,
        duplicate_count: duplicates.length,
        rejected_count: rejected.length,
        target_record_ids: imported.map((item) => String(item.targetRecordId || '')),
        duplicate_target_record_ids: duplicates.map((item) => String(item.targetRecordId || '')),
        duplicate_rows: duplicates.slice(0, 100),
        rejected_rows: rejected.slice(0, 100),
        fixed_entry_handler: 'production_work_reports'
      })
    ]
  );
  await client.query(
    `update public.document_assets
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      asset.id,
      assetStatus,
      JSON.stringify({
        ai_import_status: finalStatus,
        ai_imported_at: new Date().toISOString(),
        ai_imported_count: imported.length,
        ai_duplicate_business_count: duplicates.length,
        ai_rejected_count: rejected.length,
        fixed_entry_handler: 'production_work_reports'
      })
    ]
  );
  await updateBatchStatusFromAssets(client, asset.batch_id || entryPlan.batch_id, {
    worker: 'document-fixed-entry',
    entry_plan_id: entryPlan.id,
    fixed_entry_handler: 'production_work_reports',
    imported_count: imported.length,
    duplicate_business_count: duplicates.length,
    rejected_count: rejected.length
  });

  return { finalStatus, imported, duplicates, rejected };
}

async function resolveEquipmentAsset(client, line) {
  const assetNo = normalizeText(line.assetNo, 120);
  const assetName = normalizeText(line.assetName, 200);
  if (assetNo) {
    const result = await client.query(
      `select id::text as id, asset_no, asset_name, run_status
         from public.equipment_assets
        where lower(asset_no) = lower($1)
          and coalesce(status, 'active') <> 'deleted'
        limit 2`,
      [assetNo]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `设备编号重复：${assetNo}` };
  }
  if (assetName) {
    const result = await client.query(
      `select id::text as id, asset_no, asset_name, run_status
         from public.equipment_assets
        where lower(asset_name) = lower($1)
          and coalesce(status, 'active') <> 'deleted'
        limit 2`,
      [assetName]
    );
    if (result.rows.length === 1) return { value: result.rows[0], error: '' };
    if (result.rows.length > 1) return { value: null, error: `设备名称重复：${assetName}` };
  }
  return { value: null, error: '' };
}

async function findExistingEquipmentCheck(client, checkNo) {
  const normalizedCheckNo = normalizeText(checkNo, 160);
  if (!normalizedCheckNo) return null;
  const result = await client.query(
    `select id::text as id, check_no, asset_no, asset_name, check_result, status, created_at
       from public.equipment_checks
      where check_no = $1
      order by created_at asc nulls last, id asc
      limit 1`,
    [normalizedCheckNo]
  );
  return result.rows[0] || null;
}

async function insertEquipmentCheck(client, payload) {
  const result = await client.query(
    `insert into public.equipment_checks (
       check_no, asset_id, asset_no, asset_name, check_type,
       check_item_count, abnormal_count, check_result, checker,
       check_date, remark, properties
     ) values (
       $1,$2::uuid,$3,$4,$5,
       $6,$7,$8,$9,
       coalesce($10::date, current_date),$11,$12
     )
     returning id::text as id, check_no`,
    [
      payload.check_no,
      payload.asset_id,
      payload.asset_no,
      payload.asset_name,
      payload.check_type,
      payload.check_item_count,
      payload.abnormal_count,
      payload.check_result,
      payload.checker,
      payload.check_date,
      payload.remark,
      JSON.stringify(payload.properties || {})
    ]
  );
  return result.rows[0] || null;
}

async function refreshEquipmentAssetFromCheck(client, payload) {
  if (!payload.asset_id) return;
  const runStatus = payload.check_result === '停机'
    ? '停机'
    : (payload.check_result === '异常' ? null : '运行');
  const healthPenalty = payload.check_result === '停机'
    ? 20
    : (payload.check_result === '异常' ? 8 : 0);
  await client.query(
    `update public.equipment_assets
        set run_status = coalesce($2, run_status),
            health_score = greatest(0, least(100, health_score - $3::numeric)),
            properties = coalesce(properties, '{}'::jsonb) || jsonb_build_object(
              'last_ai_check_no', $4,
              'last_ai_check_result', $5,
              'last_ai_check_date', coalesce($6::text, current_date::text)
            ),
            updated_at = now()
      where id = $1::uuid`,
    [
      payload.asset_id,
      runStatus,
      healthPenalty,
      payload.check_no,
      payload.check_result,
      payload.check_date
    ]
  );
}

async function insertEquipmentCheckBusinessLink(client, { asset, entryPlan, check, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'public',
      'equipment_checks',
      payload.check_no,
      entryPlan.target_module || 'equipment',
      entryPlan.target_document_type || '设备点检记录',
      null,
      Number(entryPlan.confidence || 0),
      JSON.stringify({
        ai_generated: true,
        source: row.source,
        equipment_check_id: check?.id || null,
        check_no: payload.check_no,
        asset_id: payload.asset_id || null,
        asset_no: payload.asset_no || '',
        asset_name: payload.asset_name,
        check_result: payload.check_result,
        check_item_count: payload.check_item_count,
        abnormal_count: payload.abnormal_count
      })
    ]
  );
  return payload.check_no;
}

async function insertDuplicateEquipmentCheckBusinessLink(client, { asset, entryPlan, existingLink, existingCheck, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'public',
      'equipment_checks',
      payload.check_no,
      entryPlan.target_module || existingLink?.target_module || 'equipment',
      entryPlan.target_document_type || existingLink?.target_document_type || '设备点检记录',
      existingLink?.target_app_id || null,
      Number(entryPlan.confidence || existingLink?.ai_confidence || 0),
      JSON.stringify({
        ai_generated: true,
        duplicate_business_source: true,
        duplicate_reason: existingLink ? 'target_record_already_linked' : 'equipment_check_no_already_exists',
        duplicate_of_business_link_id: existingLink?.id || null,
        duplicate_of_asset_id: existingLink?.asset_id || null,
        existing_equipment_check_id: existingCheck?.id || null,
        source: row?.source || '',
        check_no: payload.check_no,
        asset_no: payload.asset_no || '',
        asset_name: payload.asset_name,
        check_result: payload.check_result,
        abnormal_count: payload.abnormal_count
      })
    ]
  );
  return payload.check_no;
}

async function importEquipmentCheckPlan(client, { asset, entryPlan, parseResult }) {
  const equipmentRows = buildEquipmentCheckRowsFromPlan({ parseResult, entryPlan }).slice(0, maxRowsPerPlan);
  if (!equipmentRows.length) {
    await client.query(
      `update public.document_entry_plans
          set status = 'failed',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
        where id = $1`,
      [entryPlan.id, JSON.stringify({ import_error: 'No equipment check rows generated from entry plan' })]
    );
    return { finalStatus: 'failed', imported: [], duplicates: [], rejected: [{ source: 'plan', reason: 'No equipment check rows generated from entry plan' }] };
  }

  const imported = [];
  const rejected = [];
  const duplicates = [];
  for (let index = 0; index < equipmentRows.length; index += 1) {
    const equipmentRow = equipmentRows[index];
    const equipmentResolution = await resolveEquipmentAsset(client, equipmentRow.line);
    const validationErrors = [
      ...validateEquipmentCheckLine(equipmentRow.line),
      equipmentResolution.error || ''
    ].filter(Boolean);

    const payload = buildEquipmentCheckPayload({
      line: equipmentRow.line,
      equipmentAsset: equipmentResolution.value,
      asset,
      entryPlan,
      source: equipmentRow.source,
      index: equipmentRow.rowIndex ?? index,
      unmappedFields: equipmentRow.unmappedFields || []
    });

    if (validationErrors.length) {
      const message = validationErrors.join('；');
      rejected.push({ source: equipmentRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.check_no,
        targetSchema: 'public',
        targetTable: 'equipment_checks',
        field: {
          name: '设备点检行无法自动执行',
          value: message,
          confidence: 0.25,
          source: equipmentRow.source,
          writeLocation: 'remarks',
          reason: 'required_field_validation_failed'
        }
      });
      continue;
    }

    try {
      const existingBusinessLink = await findExistingBusinessLink(client, {
        targetSchema: 'public',
        targetTable: 'equipment_checks',
        targetRecordId: payload.check_no
      });
      const existingCheck = await findExistingEquipmentCheck(client, payload.check_no);
      if (existingBusinessLink || existingCheck) {
        const targetRecordId = await insertDuplicateEquipmentCheckBusinessLink(client, {
          asset,
          entryPlan,
          existingLink: existingBusinessLink,
          existingCheck,
          payload,
          row: equipmentRow
        });
        duplicates.push({
          source: equipmentRow.source,
          targetRecordId,
          duplicateOfBusinessLinkId: existingBusinessLink?.id || null,
          existingEquipmentCheckId: existingCheck?.id || null
        });
        for (const field of equipmentRow.unmappedFields || []) {
          await insertUnmappedField(client, {
            asset,
            entryPlan,
            recordId: targetRecordId,
            targetSchema: 'public',
            targetTable: 'equipment_checks',
            field
          });
        }
        continue;
      }

      const check = await insertEquipmentCheck(client, payload);
      await refreshEquipmentAssetFromCheck(client, payload);
      const targetRecordId = await insertEquipmentCheckBusinessLink(client, {
        asset,
        entryPlan,
        check,
        payload,
        row: equipmentRow
      });
      imported.push({ source: equipmentRow.source, targetRecordId, equipmentCheckId: check?.id || null });
      for (const field of equipmentRow.unmappedFields || []) {
        await insertUnmappedField(client, {
          asset,
          entryPlan,
          recordId: targetRecordId,
          targetSchema: 'public',
          targetTable: 'equipment_checks',
          field
        });
      }
    } catch (error) {
      const message = normalizeText(error?.message || error, 1000);
      rejected.push({ source: equipmentRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.check_no,
        targetSchema: 'public',
        targetTable: 'equipment_checks',
        field: {
          name: '设备点检入库失败',
          value: message,
          confidence: 0.2,
          source: equipmentRow.source,
          writeLocation: 'remarks',
          reason: 'equipment_check_insert_failed'
        }
      });
    }
  }

  const completedCount = imported.length + duplicates.length;
  const finalStatus = rejected.length
    ? (completedCount ? 'partial' : 'failed')
    : (imported.length ? 'imported' : (duplicates.length ? 'skipped_duplicate' : 'failed'));
  const assetStatus = finalStatus === 'failed' ? 'failed' : (finalStatus === 'partial' ? 'partial_imported' : 'imported');
  await client.query(
    `update public.document_entry_plans
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      entryPlan.id,
      finalStatus,
      JSON.stringify({
        imported_at: new Date().toISOString(),
        imported_count: imported.length,
        duplicate_count: duplicates.length,
        rejected_count: rejected.length,
        target_record_ids: imported.map((item) => String(item.targetRecordId || '')),
        duplicate_target_record_ids: duplicates.map((item) => String(item.targetRecordId || '')),
        duplicate_rows: duplicates.slice(0, 100),
        rejected_rows: rejected.slice(0, 100),
        fixed_entry_handler: 'equipment_checks'
      })
    ]
  );
  await client.query(
    `update public.document_assets
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      asset.id,
      assetStatus,
      JSON.stringify({
        ai_import_status: finalStatus,
        ai_imported_at: new Date().toISOString(),
        ai_imported_count: imported.length,
        ai_duplicate_business_count: duplicates.length,
        ai_rejected_count: rejected.length,
        fixed_entry_handler: 'equipment_checks'
      })
    ]
  );
  await updateBatchStatusFromAssets(client, asset.batch_id || entryPlan.batch_id, {
    worker: 'document-fixed-entry',
    entry_plan_id: entryPlan.id,
    fixed_entry_handler: 'equipment_checks',
    imported_count: imported.length,
    duplicate_business_count: duplicates.length,
    rejected_count: rejected.length
  });

  return { finalStatus, imported, duplicates, rejected };
}

async function findExistingHrRecord(client, recordNo) {
  const normalizedRecordNo = normalizeText(recordNo, 160);
  if (!normalizedRecordNo) return null;
  const result = await client.query(
    `select id::text as id, record_no, employee_no, employee_name, event_type, record_status, created_at
       from hr.document_intake_records
      where record_no = $1
      order by created_at asc nulls last, id asc
      limit 1`,
    [normalizedRecordNo]
  );
  return result.rows[0] || null;
}

async function insertHrDocumentIntakeRecord(client, payload) {
  const result = await client.query(
    `insert into hr.document_intake_records (
       record_no, record_date, employee_no, employee_name, department,
       position, event_type, hours, overtime_hours, leave_hours,
       absence_hours, record_status, handler, remark, properties
     ) values (
       $1,coalesce($2::date, current_date),$3,$4,$5,
       $6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15
     )
     returning id::text as id, record_no`,
    [
      payload.record_no,
      payload.record_date,
      payload.employee_no,
      payload.employee_name,
      payload.department,
      payload.position,
      payload.event_type,
      payload.hours,
      payload.overtime_hours,
      payload.leave_hours,
      payload.absence_hours,
      payload.record_status,
      payload.handler,
      payload.remark,
      JSON.stringify(payload.properties || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertHrRecordBusinessLink(client, { asset, entryPlan, record, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'hr',
      'document_intake_records',
      payload.record_no,
      entryPlan.target_module || 'hr',
      entryPlan.target_document_type || '人事记录',
      null,
      Number(entryPlan.confidence || 0),
      JSON.stringify({
        ai_generated: true,
        source: row.source,
        hr_record_id: record?.id || null,
        record_no: payload.record_no,
        employee_no: payload.employee_no || '',
        employee_name: payload.employee_name || '',
        event_type: payload.event_type,
        hours: payload.hours,
        record_status: payload.record_status
      })
    ]
  );
  return payload.record_no;
}

async function insertDuplicateHrRecordBusinessLink(client, { asset, entryPlan, existingLink, existingRecord, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'hr',
      'document_intake_records',
      payload.record_no,
      entryPlan.target_module || existingLink?.target_module || 'hr',
      entryPlan.target_document_type || existingLink?.target_document_type || '人事记录',
      existingLink?.target_app_id || null,
      Number(entryPlan.confidence || existingLink?.ai_confidence || 0),
      JSON.stringify({
        ai_generated: true,
        duplicate_business_source: true,
        duplicate_reason: existingLink ? 'target_record_already_linked' : 'hr_record_no_already_exists',
        duplicate_of_business_link_id: existingLink?.id || null,
        duplicate_of_asset_id: existingLink?.asset_id || null,
        existing_hr_record_id: existingRecord?.id || null,
        source: row?.source || '',
        record_no: payload.record_no,
        employee_no: payload.employee_no || '',
        employee_name: payload.employee_name || '',
        event_type: payload.event_type,
        record_status: payload.record_status
      })
    ]
  );
  return payload.record_no;
}

async function importHrRecordPlan(client, { asset, entryPlan, parseResult }) {
  const hrRows = buildHrRecordRowsFromPlan({ parseResult, entryPlan }).slice(0, maxRowsPerPlan);
  if (!hrRows.length) {
    await client.query(
      `update public.document_entry_plans
          set status = 'failed',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
        where id = $1`,
      [entryPlan.id, JSON.stringify({ import_error: 'No HR record rows generated from entry plan' })]
    );
    return { finalStatus: 'failed', imported: [], duplicates: [], rejected: [{ source: 'plan', reason: 'No HR record rows generated from entry plan' }] };
  }

  const imported = [];
  const rejected = [];
  const duplicates = [];
  for (let index = 0; index < hrRows.length; index += 1) {
    const hrRow = hrRows[index];
    const validationErrors = validateHrRecordLine(hrRow.line);
    const payload = buildHrRecordPayload({
      line: hrRow.line,
      asset,
      entryPlan,
      source: hrRow.source,
      index: hrRow.rowIndex ?? index,
      unmappedFields: hrRow.unmappedFields || []
    });

    if (validationErrors.length) {
      const message = validationErrors.join('；');
      rejected.push({ source: hrRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.record_no,
        targetSchema: 'hr',
        targetTable: 'document_intake_records',
        field: {
          name: '人事记录行无法自动执行',
          value: message,
          confidence: 0.25,
          source: hrRow.source,
          writeLocation: 'remarks',
          reason: 'required_field_validation_failed'
        }
      });
      continue;
    }

    try {
      const existingBusinessLink = await findExistingBusinessLink(client, {
        targetSchema: 'hr',
        targetTable: 'document_intake_records',
        targetRecordId: payload.record_no
      });
      const existingRecord = await findExistingHrRecord(client, payload.record_no);
      if (existingBusinessLink || existingRecord) {
        const targetRecordId = await insertDuplicateHrRecordBusinessLink(client, {
          asset,
          entryPlan,
          existingLink: existingBusinessLink,
          existingRecord,
          payload,
          row: hrRow
        });
        duplicates.push({
          source: hrRow.source,
          targetRecordId,
          duplicateOfBusinessLinkId: existingBusinessLink?.id || null,
          existingHrRecordId: existingRecord?.id || null
        });
        for (const field of hrRow.unmappedFields || []) {
          await insertUnmappedField(client, {
            asset,
            entryPlan,
            recordId: targetRecordId,
            targetSchema: 'hr',
            targetTable: 'document_intake_records',
            field
          });
        }
        continue;
      }

      const record = await insertHrDocumentIntakeRecord(client, payload);
      const targetRecordId = await insertHrRecordBusinessLink(client, {
        asset,
        entryPlan,
        record,
        payload,
        row: hrRow
      });
      const attendanceSync = await syncHrAttendanceFromRecord(client, { payload, record });
      await markHrAttendanceSyncStatus(client, { record, syncResult: attendanceSync });
      imported.push({
        source: hrRow.source,
        targetRecordId,
        hrRecordId: record?.id || null,
        attendanceSync: {
          status: attendanceSync.status,
          message: attendanceSync.message,
          attendanceRecordId: attendanceSync.attendanceRecordId || ''
        }
      });
      for (const field of hrRow.unmappedFields || []) {
        await insertUnmappedField(client, {
          asset,
          entryPlan,
          recordId: targetRecordId,
          targetSchema: 'hr',
          targetTable: 'document_intake_records',
          field
        });
      }
    } catch (error) {
      const message = normalizeText(error?.message || error, 1000);
      rejected.push({ source: hrRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.record_no,
        targetSchema: 'hr',
        targetTable: 'document_intake_records',
        field: {
          name: '人事记录入库失败',
          value: message,
          confidence: 0.2,
          source: hrRow.source,
          writeLocation: 'remarks',
          reason: 'hr_record_insert_failed'
        }
      });
    }
  }

  const completedCount = imported.length + duplicates.length;
  const finalStatus = rejected.length
    ? (completedCount ? 'partial' : 'failed')
    : (imported.length ? 'imported' : (duplicates.length ? 'skipped_duplicate' : 'failed'));
  const assetStatus = finalStatus === 'failed' ? 'failed' : (finalStatus === 'partial' ? 'partial_imported' : 'imported');
  await client.query(
    `update public.document_entry_plans
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      entryPlan.id,
      finalStatus,
      JSON.stringify({
        imported_at: new Date().toISOString(),
        imported_count: imported.length,
        duplicate_count: duplicates.length,
        rejected_count: rejected.length,
        target_record_ids: imported.map((item) => String(item.targetRecordId || '')),
        duplicate_target_record_ids: duplicates.map((item) => String(item.targetRecordId || '')),
        attendance_sync_counts: attendanceSyncCounts,
        attendance_sync_rows: imported
          .map((item) => ({
            target_record_id: item.targetRecordId,
            ...(item.attendanceSync || {})
          }))
          .filter((item) => item.status && item.status !== 'not_applicable')
          .slice(0, 100),
        duplicate_rows: duplicates.slice(0, 100),
        rejected_rows: rejected.slice(0, 100),
        fixed_entry_handler: 'hr_document_intake_records'
      })
    ]
  );
  await client.query(
    `update public.document_assets
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      asset.id,
      assetStatus,
      JSON.stringify({
        ai_import_status: finalStatus,
        ai_imported_at: new Date().toISOString(),
        ai_imported_count: imported.length,
        ai_duplicate_business_count: duplicates.length,
        ai_rejected_count: rejected.length,
        ai_attendance_sync_counts: attendanceSyncCounts,
        fixed_entry_handler: 'hr_document_intake_records'
      })
    ]
  );
  await updateBatchStatusFromAssets(client, asset.batch_id || entryPlan.batch_id, {
    worker: 'document-fixed-entry',
    entry_plan_id: entryPlan.id,
    fixed_entry_handler: 'hr_document_intake_records',
    imported_count: imported.length,
    duplicate_business_count: duplicates.length,
    rejected_count: rejected.length
  });

  return { finalStatus, imported, duplicates, rejected };
}

async function importSalesStockOutPlan(client, { asset, entryPlan, parseResult }) {
  const stockOutRows = buildSalesStockOutRowsFromPlan({ parseResult, entryPlan }).slice(0, maxRowsPerPlan);
  if (!stockOutRows.length) {
    await client.query(
      `update public.document_entry_plans
          set status = 'failed',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
        where id = $1`,
      [entryPlan.id, JSON.stringify({ import_error: 'No sales stock-out rows generated from entry plan' })]
    );
    return { finalStatus: 'failed', imported: [], duplicates: [], rejected: [{ source: 'plan', reason: 'No sales stock-out rows generated from entry plan' }] };
  }

  const imported = [];
  const rejected = [];
  const duplicates = [];
  for (let index = 0; index < stockOutRows.length; index += 1) {
    const stockOutRow = stockOutRows[index];
    const materialResolution = await resolveMaterial(client, stockOutRow.line);
    const warehouseResolution = await resolveWarehouse(client, stockOutRow.line);
    const resolved = {
      material: materialResolution.value,
      warehouse: warehouseResolution.value
    };
    const validationErrors = [
      ...validateSalesStockOutLine(stockOutRow.line, resolved),
      materialResolution.error && !materialResolution.value ? materialResolution.error : '',
      warehouseResolution.error && !warehouseResolution.value ? warehouseResolution.error : ''
    ].filter(Boolean);

    const payload = buildStockOutPayload({
      line: stockOutRow.line,
      material: resolved.material || {},
      warehouse: resolved.warehouse || {},
      asset,
      entryPlan,
      source: stockOutRow.source,
      index: stockOutRow.rowIndex ?? index
    });

    if (validationErrors.length) {
      const message = validationErrors.join('；');
      rejected.push({ source: stockOutRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.p_transaction_no,
        field: {
          name: '销售出库行无法自动执行',
          value: message,
          confidence: 0.25,
          source: stockOutRow.source,
          writeLocation: 'remarks',
          reason: 'required_field_validation_failed'
        }
      });
      continue;
    }

    try {
      const existingBusinessLink = await findExistingBusinessLink(client, {
        targetSchema: 'scm',
        targetTable: 'inventory_transactions',
        targetRecordId: payload.p_transaction_no
      });
      if (existingBusinessLink) {
        const targetRecordId = await insertDuplicateBusinessLink(client, {
          asset,
          entryPlan,
          existingLink: existingBusinessLink,
          targetSchema: 'scm',
          targetTable: 'inventory_transactions',
          targetRecordId: payload.p_transaction_no,
          payload,
          row: stockOutRow,
          skippedRpc: 'scm.stock_out'
        });
        duplicates.push({
          source: stockOutRow.source,
          targetRecordId,
          duplicateOfBusinessLinkId: existingBusinessLink.id || null,
          duplicateOfAssetId: existingBusinessLink.asset_id || null
        });
        for (const field of stockOutRow.unmappedFields || []) {
          await insertUnmappedField(client, {
            asset,
            entryPlan,
            recordId: targetRecordId,
            field
          });
        }
        continue;
      }

      const stockOutResult = await callStockOut(client, payload);
      const targetRecordId = await insertStockOutBusinessLink(client, {
        asset,
        entryPlan,
        stockOutResult,
        payload,
        row: stockOutRow
      });
      imported.push({ source: stockOutRow.source, targetRecordId, stockOutResult });
      for (const field of stockOutRow.unmappedFields || []) {
        await insertUnmappedField(client, {
          asset,
          entryPlan,
          recordId: targetRecordId,
          field
        });
      }
    } catch (error) {
      const message = normalizeText(error?.message || error, 1000);
      rejected.push({ source: stockOutRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.p_transaction_no,
        field: {
          name: '出库 RPC 执行失败',
          value: message,
          confidence: 0.2,
          source: stockOutRow.source,
          writeLocation: 'remarks',
          reason: 'stock_out_rpc_failed'
        }
      });
    }
  }

  const completedCount = imported.length + duplicates.length;
  const finalStatus = rejected.length
    ? (completedCount ? 'partial' : 'failed')
    : (imported.length ? 'imported' : (duplicates.length ? 'skipped_duplicate' : 'failed'));
  const assetStatus = finalStatus === 'failed' ? 'failed' : (finalStatus === 'partial' ? 'partial_imported' : 'imported');
  await client.query(
    `update public.document_entry_plans
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      entryPlan.id,
      finalStatus,
      JSON.stringify({
        imported_at: new Date().toISOString(),
        imported_count: imported.length,
        duplicate_count: duplicates.length,
        rejected_count: rejected.length,
        target_record_ids: imported.map((item) => String(item.targetRecordId || '')),
        duplicate_target_record_ids: duplicates.map((item) => String(item.targetRecordId || '')),
        duplicate_rows: duplicates.slice(0, 100),
        rejected_rows: rejected.slice(0, 100),
        fixed_entry_handler: 'sales_stock_out'
      })
    ]
  );
  await client.query(
    `update public.document_assets
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      asset.id,
      assetStatus,
      JSON.stringify({
        ai_import_status: finalStatus,
        ai_imported_at: new Date().toISOString(),
        ai_imported_count: imported.length,
        ai_duplicate_business_count: duplicates.length,
        ai_rejected_count: rejected.length,
        fixed_entry_handler: 'sales_stock_out'
      })
    ]
  );
  await updateBatchStatusFromAssets(client, asset.batch_id || entryPlan.batch_id, {
    worker: 'document-fixed-entry',
    entry_plan_id: entryPlan.id,
    fixed_entry_handler: 'sales_stock_out',
    imported_count: imported.length,
    duplicate_business_count: duplicates.length,
    rejected_count: rejected.length
  });

  return { finalStatus, imported, duplicates, rejected };
}

async function findExistingQualityInspection(client, docNo) {
  const normalizedDocNo = normalizeText(docNo, 160);
  if (!normalizedDocNo) return null;
  const result = await client.query(
    `select id::text as id, doc_no, result, status, created_at
       from public.quality_inspections
      where doc_no = $1
      order by created_at asc nulls last, id asc
      limit 1`,
    [normalizedDocNo]
  );
  return result.rows[0] || null;
}

async function insertQualityInspection(client, payload) {
  const result = await client.query(
    `insert into public.quality_inspections (
       doc_no, inspection_type, source_doc_no, item_code, item_name,
       source_name, batch_no, sample_qty, defect_qty, result,
       inspector, inspection_date, remark, properties
     ) values (
       $1,$2,$3,$4,$5,
       $6,$7,$8,$9,$10,
       $11,coalesce($12::date, current_date),$13,$14
     )
     returning id::text as id, doc_no`,
    [
      payload.doc_no,
      payload.inspection_type,
      payload.source_doc_no,
      payload.item_code,
      payload.item_name,
      payload.source_name,
      payload.batch_no,
      payload.sample_qty,
      payload.defect_qty,
      payload.result,
      payload.inspector,
      payload.inspection_date,
      payload.remark,
      JSON.stringify(payload.properties || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertQualityBusinessLink(client, { asset, entryPlan, inspection, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'public',
      'quality_inspections',
      payload.doc_no,
      entryPlan.target_module || 'quality',
      entryPlan.target_document_type || '质量检验单',
      null,
      Number(entryPlan.confidence || 0),
      JSON.stringify({
        ai_generated: true,
        source: row.source,
        quality_inspection_id: inspection?.id || null,
        doc_no: payload.doc_no,
        result: payload.result,
        sample_qty: payload.sample_qty,
        defect_qty: payload.defect_qty,
        batch_no: payload.batch_no || '',
        source_doc_no: payload.source_doc_no || ''
      })
    ]
  );
  return payload.doc_no;
}

async function insertDuplicateQualityBusinessLink(client, { asset, entryPlan, existingLink, existingInspection, payload, row }) {
  await client.query(
    `insert into public.document_business_links (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, target_module, target_document_type, target_app_id,
       ai_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'public',
      'quality_inspections',
      payload.doc_no,
      entryPlan.target_module || existingLink?.target_module || 'quality',
      entryPlan.target_document_type || existingLink?.target_document_type || '质量检验单',
      existingLink?.target_app_id || null,
      Number(entryPlan.confidence || existingLink?.ai_confidence || 0),
      JSON.stringify({
        ai_generated: true,
        duplicate_business_source: true,
        duplicate_reason: existingLink ? 'target_record_already_linked' : 'quality_doc_no_already_exists',
        duplicate_of_business_link_id: existingLink?.id || null,
        duplicate_of_asset_id: existingLink?.asset_id || null,
        existing_quality_inspection_id: existingInspection?.id || null,
        source: row?.source || '',
        doc_no: payload.doc_no,
        result: payload.result,
        sample_qty: payload.sample_qty,
        defect_qty: payload.defect_qty
      })
    ]
  );
  return payload.doc_no;
}

async function importQualityInspectionPlan(client, { asset, entryPlan, parseResult }) {
  const qualityRows = buildQualityInspectionRowsFromPlan({ parseResult, entryPlan }).slice(0, maxRowsPerPlan);
  if (!qualityRows.length) {
    await client.query(
      `update public.document_entry_plans
          set status = 'failed',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
        where id = $1`,
      [entryPlan.id, JSON.stringify({ import_error: 'No quality inspection rows generated from entry plan' })]
    );
    return { finalStatus: 'failed', imported: [], duplicates: [], rejected: [{ source: 'plan', reason: 'No quality inspection rows generated from entry plan' }] };
  }

  const imported = [];
  const rejected = [];
  const duplicates = [];
  for (let index = 0; index < qualityRows.length; index += 1) {
    const qualityRow = qualityRows[index];
    const validationErrors = validateQualityInspectionLine(qualityRow.line);
    const payload = buildQualityInspectionPayload({
      line: qualityRow.line,
      entryPlan,
      asset,
      source: qualityRow.source,
      index: qualityRow.rowIndex ?? index
    });

    if (validationErrors.length) {
      const message = validationErrors.join('；');
      rejected.push({ source: qualityRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.doc_no,
        targetSchema: 'public',
        targetTable: 'quality_inspections',
        field: {
          name: '质检行无法自动执行',
          value: message,
          confidence: 0.25,
          source: qualityRow.source,
          writeLocation: 'remarks',
          reason: 'required_field_validation_failed'
        }
      });
      continue;
    }

    try {
      const existingBusinessLink = await findExistingBusinessLink(client, {
        targetSchema: 'public',
        targetTable: 'quality_inspections',
        targetRecordId: payload.doc_no
      });
      const existingInspection = await findExistingQualityInspection(client, payload.doc_no);
      if (existingBusinessLink || existingInspection) {
        const targetRecordId = await insertDuplicateQualityBusinessLink(client, {
          asset,
          entryPlan,
          existingLink: existingBusinessLink,
          existingInspection,
          payload,
          row: qualityRow
        });
        duplicates.push({
          source: qualityRow.source,
          targetRecordId,
          duplicateOfBusinessLinkId: existingBusinessLink?.id || null,
          existingQualityInspectionId: existingInspection?.id || null
        });
        for (const field of qualityRow.unmappedFields || []) {
          await insertUnmappedField(client, {
            asset,
            entryPlan,
            recordId: targetRecordId,
            targetSchema: 'public',
            targetTable: 'quality_inspections',
            field
          });
        }
        continue;
      }

      const inspection = await insertQualityInspection(client, payload);
      const targetRecordId = await insertQualityBusinessLink(client, {
        asset,
        entryPlan,
        inspection,
        payload,
        row: qualityRow
      });
      imported.push({ source: qualityRow.source, targetRecordId, inspectionId: inspection?.id || null });
      for (const field of qualityRow.unmappedFields || []) {
        await insertUnmappedField(client, {
          asset,
          entryPlan,
          recordId: targetRecordId,
          targetSchema: 'public',
          targetTable: 'quality_inspections',
          field
        });
      }
    } catch (error) {
      const message = normalizeText(error?.message || error, 1000);
      rejected.push({ source: qualityRow.source, reason: message });
      await insertUnmappedField(client, {
        asset,
        entryPlan,
        recordId: payload.doc_no,
        targetSchema: 'public',
        targetTable: 'quality_inspections',
        field: {
          name: '质检记录入库失败',
          value: message,
          confidence: 0.2,
          source: qualityRow.source,
          writeLocation: 'remarks',
          reason: 'quality_inspection_insert_failed'
        }
      });
    }
  }

  const completedCount = imported.length + duplicates.length;
  const finalStatus = rejected.length
    ? (completedCount ? 'partial' : 'failed')
    : (imported.length ? 'imported' : (duplicates.length ? 'skipped_duplicate' : 'failed'));
  const assetStatus = finalStatus === 'failed' ? 'failed' : (finalStatus === 'partial' ? 'partial_imported' : 'imported');
  await client.query(
    `update public.document_entry_plans
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      entryPlan.id,
      finalStatus,
      JSON.stringify({
        imported_at: new Date().toISOString(),
        imported_count: imported.length,
        duplicate_count: duplicates.length,
        rejected_count: rejected.length,
        target_record_ids: imported.map((item) => String(item.targetRecordId || '')),
        duplicate_target_record_ids: duplicates.map((item) => String(item.targetRecordId || '')),
        duplicate_rows: duplicates.slice(0, 100),
        rejected_rows: rejected.slice(0, 100),
        fixed_entry_handler: 'quality_inspections'
      })
    ]
  );
  await client.query(
    `update public.document_assets
        set status = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where id = $1`,
    [
      asset.id,
      assetStatus,
      JSON.stringify({
        ai_import_status: finalStatus,
        ai_imported_at: new Date().toISOString(),
        ai_imported_count: imported.length,
        ai_duplicate_business_count: duplicates.length,
        ai_rejected_count: rejected.length,
        fixed_entry_handler: 'quality_inspections'
      })
    ]
  );
  await updateBatchStatusFromAssets(client, asset.batch_id || entryPlan.batch_id, {
    worker: 'document-fixed-entry',
    entry_plan_id: entryPlan.id,
    fixed_entry_handler: 'quality_inspections',
    imported_count: imported.length,
    duplicate_business_count: duplicates.length,
    rejected_count: rejected.length
  });

  return { finalStatus, imported, duplicates, rejected };
}

class DocumentFixedEntryWorker {
  constructor(options = {}) {
    this.log = options.log || console;
    this.timer = null;
    this.running = false;
    this.stopping = false;
  }

  start() {
    if (!fixedEntryWorkerEnabled) {
      this.log.info?.('[document-fixed-entry] worker disabled');
      return;
    }
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        this.log.warn?.('[document-fixed-entry] run failed:', error?.message || error);
      });
    }, pollIntervalMs);
    this.timer.unref?.();
    this.runOnce().catch((error) => {
      this.log.warn?.('[document-fixed-entry] initial run failed:', error?.message || error);
    });
    this.log.info?.(`[document-fixed-entry] worker started, interval=${pollIntervalMs}ms`);
  }

  async shutdown() {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await pool.end().catch(() => {});
  }

  async runOnce() {
    if (this.running || this.stopping) return false;
    this.running = true;
    try {
      let processed = false;
      while (!this.stopping) {
        const ok = await this.processOne();
        if (!ok) break;
        processed = true;
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  async processOne() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `select
           p.*,
           a.id as asset_id,
           a.batch_id as asset_batch_id,
           a.device_id,
           a.uploaded_by_user_id,
           a.original_filename,
           pr.text_content,
           pr.tables,
           pr.metadata as parse_metadata
         from public.document_entry_plans p
         join public.document_assets a on a.id = p.asset_id
         left join lateral (
           select *
             from public.document_parse_results pr
            where pr.asset_id = a.id
            order by pr.created_at desc
            limit 1
         ) pr on true
        where p.status = 'planned'
          and coalesce(lower(p.metadata->>'auto_import_ready') in ('true', '1', 'yes', 'on'), true)
          and p.target_kind = 'fixed_module_table'
          and (
            (p.target_module = 'materials' and p.target_document_type = '采购入库单')
            or (p.target_module = 'quality' and p.target_document_type in ('质量检验单', '质检记录'))
            or (p.target_module = 'sales' and p.target_document_type = '销售出库单')
            or (p.target_module = 'production' and p.target_document_type in ('生产日报', '生产报工单'))
            or (p.target_module = 'equipment' and p.target_document_type = '设备点检记录')
            or (p.target_module = 'hr' and p.target_document_type = '人事记录')
          )
        order by p.created_at asc
        for update of p skip locked
        limit 1`
      );
      const row = result.rows[0] || null;
      if (!row) {
        await client.query('commit');
        return false;
      }

      await client.query(
        `update public.document_entry_plans
            set status = 'importing',
                updated_at = now()
          where id = $1`,
        [row.id]
      );

      const entryPlan = {
        ...row,
        batch_id: row.batch_id || row.asset_batch_id
      };
      const asset = {
        id: row.asset_id,
        batch_id: row.asset_batch_id,
        device_id: row.device_id,
        uploaded_by_user_id: row.uploaded_by_user_id,
        original_filename: row.original_filename
      };
      const parseResult = {
        text_content: row.text_content || '',
        tables: row.tables,
        metadata: row.parse_metadata
      };

      if (entryPlan.target_module === 'quality') {
        const qualityImportResult = await importQualityInspectionPlan(client, { asset, entryPlan, parseResult });
        await client.query('commit');
        this.log.info?.(`[document-fixed-entry] ${qualityImportResult.finalStatus}: quality imported=${qualityImportResult.imported.length}, rejected=${qualityImportResult.rejected.length}`);
        return true;
      }

      if (entryPlan.target_module === 'sales') {
        const salesImportResult = await importSalesStockOutPlan(client, { asset, entryPlan, parseResult });
        await client.query('commit');
        this.log.info?.(`[document-fixed-entry] ${salesImportResult.finalStatus}: sales stock-out imported=${salesImportResult.imported.length}, rejected=${salesImportResult.rejected.length}`);
        return true;
      }

      if (entryPlan.target_module === 'production') {
        const productionImportResult = await importProductionWorkReportPlan(client, { asset, entryPlan, parseResult });
        await client.query('commit');
        this.log.info?.(`[document-fixed-entry] ${productionImportResult.finalStatus}: production work reports imported=${productionImportResult.imported.length}, rejected=${productionImportResult.rejected.length}`);
        return true;
      }

      if (entryPlan.target_module === 'equipment') {
        const equipmentImportResult = await importEquipmentCheckPlan(client, { asset, entryPlan, parseResult });
        await client.query('commit');
        this.log.info?.(`[document-fixed-entry] ${equipmentImportResult.finalStatus}: equipment checks imported=${equipmentImportResult.imported.length}, rejected=${equipmentImportResult.rejected.length}`);
        return true;
      }

      if (entryPlan.target_module === 'hr') {
        const hrImportResult = await importHrRecordPlan(client, { asset, entryPlan, parseResult });
        await client.query('commit');
        this.log.info?.(`[document-fixed-entry] ${hrImportResult.finalStatus}: hr records imported=${hrImportResult.imported.length}, rejected=${hrImportResult.rejected.length}`);
        return true;
      }

      const stockInRows = buildStockInRowsFromPlan({ parseResult, entryPlan }).slice(0, maxRowsPerPlan);
      if (!stockInRows.length) {
        await client.query(
          `update public.document_entry_plans
              set status = 'failed',
                  metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                  updated_at = now()
            where id = $1`,
          [entryPlan.id, JSON.stringify({ import_error: 'No stock-in rows generated from entry plan' })]
        );
        await client.query('commit');
        return true;
      }

      const imported = [];
      const rejected = [];
      const duplicates = [];
      for (const stockInRow of stockInRows) {
        const materialResolution = await resolveMaterial(client, stockInRow.line);
        const warehouseResolution = await resolveWarehouse(client, stockInRow.line);
        const resolved = {
          material: materialResolution.value,
          warehouse: warehouseResolution.value
        };
        const validationErrors = [
          ...validateStockInLine(stockInRow.line, resolved),
          materialResolution.error && !materialResolution.value ? materialResolution.error : '',
          warehouseResolution.error && !warehouseResolution.value ? warehouseResolution.error : ''
        ].filter(Boolean);

        if (validationErrors.length) {
          const message = validationErrors.join('；');
          rejected.push({ source: stockInRow.source, reason: message });
          await insertUnmappedField(client, {
            asset,
            entryPlan,
            field: {
              name: '入库行无法自动执行',
              value: message,
              confidence: 0.25,
              source: stockInRow.source,
              writeLocation: 'remarks',
              reason: 'required_field_validation_failed'
            }
          });
          continue;
        }

        const payload = buildStockInPayload({
          line: stockInRow.line,
          material: resolved.material,
          warehouse: resolved.warehouse,
          asset,
          source: stockInRow.source
        });

        try {
          const existingBusinessLink = await findExistingBusinessLink(client, {
            targetSchema: 'scm',
            targetTable: 'inventory_transactions',
            targetRecordId: payload.p_transaction_no
          });
          if (existingBusinessLink) {
            const targetRecordId = await insertDuplicateBusinessLink(client, {
              asset,
              entryPlan,
              existingLink: existingBusinessLink,
              targetSchema: 'scm',
              targetTable: 'inventory_transactions',
              targetRecordId: payload.p_transaction_no,
              payload,
              row: stockInRow
            });
            duplicates.push({
              source: stockInRow.source,
              targetRecordId,
              duplicateOfBusinessLinkId: existingBusinessLink.id || null,
              duplicateOfAssetId: existingBusinessLink.asset_id || null
            });
            for (const field of stockInRow.unmappedFields || []) {
              await insertUnmappedField(client, {
                asset,
                entryPlan,
                recordId: targetRecordId,
                field
              });
            }
            continue;
          }

          const stockInResult = await callStockIn(client, payload);
          const targetRecordId = await insertBusinessLink(client, {
            asset,
            entryPlan,
            stockInResult,
            payload,
            row: stockInRow
          });
          imported.push({ source: stockInRow.source, targetRecordId, stockInResult });
          for (const field of stockInRow.unmappedFields || []) {
            await insertUnmappedField(client, {
              asset,
              entryPlan,
              recordId: targetRecordId,
              field
            });
          }
        } catch (error) {
          const message = normalizeText(error?.message || error, 1000);
          rejected.push({ source: stockInRow.source, reason: message });
          await insertUnmappedField(client, {
            asset,
            entryPlan,
            field: {
              name: '入库 RPC 执行失败',
              value: message,
              confidence: 0.2,
              source: stockInRow.source,
              writeLocation: 'remarks',
              reason: 'stock_in_rpc_failed'
            }
          });
        }
      }

      const completedCount = imported.length + duplicates.length;
      const finalStatus = rejected.length
        ? (completedCount ? 'partial' : 'failed')
        : (imported.length ? 'imported' : (duplicates.length ? 'skipped_duplicate' : 'failed'));
      const assetStatus = finalStatus === 'failed' ? 'failed' : (finalStatus === 'partial' ? 'partial_imported' : 'imported');
      await client.query(
        `update public.document_entry_plans
            set status = $2,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
          where id = $1`,
        [
          entryPlan.id,
          finalStatus,
          JSON.stringify({
            imported_at: new Date().toISOString(),
            imported_count: imported.length,
            duplicate_count: duplicates.length,
            rejected_count: rejected.length,
            target_record_ids: imported.map((item) => String(item.targetRecordId || '')),
            duplicate_target_record_ids: duplicates.map((item) => String(item.targetRecordId || '')),
            duplicate_rows: duplicates.slice(0, 100),
            rejected_rows: rejected.slice(0, 100)
          })
        ]
      );
      await client.query(
        `update public.document_assets
            set status = $2,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
          where id = $1`,
        [
          asset.id,
          assetStatus,
          JSON.stringify({
            ai_import_status: finalStatus,
            ai_imported_at: new Date().toISOString(),
            ai_imported_count: imported.length,
            ai_duplicate_business_count: duplicates.length,
            ai_rejected_count: rejected.length
          })
        ]
      );
      await updateBatchStatusFromAssets(client, asset.batch_id || entryPlan.batch_id, {
        worker: 'document-fixed-entry',
        entry_plan_id: entryPlan.id,
        imported_count: imported.length,
        duplicate_business_count: duplicates.length,
        rejected_count: rejected.length
      });

      await client.query('commit');
      this.log.info?.(`[document-fixed-entry] ${finalStatus}: stock-in imported=${imported.length}, rejected=${rejected.length}`);
      return true;
    } catch (error) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }
}

function createDocumentFixedEntryWorker(options = {}) {
  return new DocumentFixedEntryWorker(options);
}

module.exports = {
  createDocumentFixedEntryWorker,
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
};
