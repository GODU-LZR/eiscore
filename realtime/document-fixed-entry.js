// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const { Pool } = require('pg');

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
    aliases: ['物料名称', '原料名称', '材料名称', '品名', '名称', 'material_name', 'item name']
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

const recognizedFields = new Set(fieldDefinitions.map((item) => item.field));
const stockInUnsupportedFields = new Set(['supplier', 'purchasePrice']);

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

function findStockInHeaderMapping(headerRow) {
  const headers = Array.isArray(headerRow) ? headerRow : [];
  const mapping = new Map();
  headers.forEach((header, index) => {
    const key = normalizeKey(header);
    if (!key) return;
    const exact = fieldAliasKeys.find((definition) => definition.keys.includes(key));
    if (exact && !mapping.has(exact.field)) {
      mapping.set(exact.field, index);
      return;
    }
    const fuzzy = fieldAliasKeys.find((definition) =>
      definition.keys.some((alias) => alias.length >= 2 && (key.includes(alias) || alias.includes(key)))
    );
    if (fuzzy && !mapping.has(fuzzy.field)) mapping.set(fuzzy.field, index);
  });
  return mapping;
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

function stockInRowsFromTables({ parseResult, entryPlan }) {
  const tables = extractTables(parseResult, entryPlan);
  const rowsOut = [];
  for (const table of tables) {
    const rows = Array.isArray(table?.rows) ? table.rows : [];
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

function extractTextValue(text, field) {
  const definition = fieldAliasKeys.find((item) => item.field === field);
  if (!definition) return '';
  for (const alias of definition.aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*[:：=]\\s*([^\\n\\r,，;；\\t]{1,120})`, 'i');
    const match = text.match(regex);
    if (match?.[1]) return normalizeCell(match[1]);
  }
  return '';
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

async function insertUnmappedField(client, { asset, entryPlan, recordId = '', field, targetTable = 'inventory_transactions' }) {
  await client.query(
    `insert into public.document_unmapped_fields (
       asset_id, batch_id, entry_plan_id, target_schema, target_table,
       target_record_id, name, value, confidence, source, write_location, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      asset.id,
      asset.batch_id || entryPlan.batch_id || null,
      entryPlan.id,
      'scm',
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
          and p.target_kind = 'fixed_module_table'
          and p.target_module = 'materials'
          and p.target_document_type = '采购入库单'
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

      const finalStatus = imported.length && rejected.length ? 'partial' : (imported.length ? 'imported' : 'failed');
      const assetStatus = finalStatus === 'imported' ? 'imported' : (finalStatus === 'partial' ? 'partial_imported' : 'failed');
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
            rejected_count: rejected.length,
            target_record_ids: imported.map((item) => String(item.targetRecordId || '')),
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
            ai_rejected_count: rejected.length
          })
        ]
      );

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
  normalizeKey
};
