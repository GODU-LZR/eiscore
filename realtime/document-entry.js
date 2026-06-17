// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const { Pool } = require('pg');

const envText = (value, fallback = '') => String(value ?? fallback).trim();
function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

const entryWorkerEnabled = envText(process.env.DOCUMENT_ENTRY_WORKER_ENABLED, 'true').toLowerCase() !== 'false';
const pollIntervalMs = positiveInteger(process.env.DOCUMENT_ENTRY_POLL_INTERVAL_MS, 12000, { min: 2000, max: 10 * 60 * 1000 });
const maxRowsPerPlan = positiveInteger(process.env.DOCUMENT_ENTRY_MAX_ROWS_PER_PLAN, 200, { min: 1, max: 5000 });

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: positiveInteger(process.env.PGPORT, 5432, { min: 1, max: 65535 }),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: positiveInteger(process.env.DOCUMENT_ENTRY_PG_POOL_MAX, 3, { min: 1, max: 20 })
});

const remarkFields = ['remarks', 'remark', 'notes', 'note', 'comment', 'comments'];

function normalizeText(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
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

function toPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeIdentifier(value, fallback = '') {
  const raw = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!raw) return fallback;
  return /^[a-z]/.test(raw) ? raw.slice(0, 63) : `f_${raw}`.slice(0, 63);
}

function quoteIdent(value) {
  const identifier = sanitizeIdentifier(value);
  if (!identifier) throw new Error('Invalid SQL identifier');
  return `"${identifier.replace(/"/g, '""')}"`;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_:\-—–,，.。/\\|()[\]{}]+/g, '');
}

function normalizeColumn(column) {
  const src = toPlainObject(column);
  const field = sanitizeIdentifier(src.field || src.name || src.key || '');
  if (!field || ['id', 'created_at', 'updated_at', 'properties'].includes(field)) return null;
  const label = normalizeText(src.label || src.title || src.name || src.field || field, 120);
  const aliases = Array.isArray(src.aliases) ? src.aliases.map((item) => normalizeText(item, 120)).filter(Boolean) : [];
  const type = normalizeText(src.type || src.data_type || 'text', 40).toLowerCase();
  return {
    field,
    label,
    aliases,
    type,
    keys: [field, label, ...aliases].map(normalizeKey).filter(Boolean)
  };
}

function normalizeColumns(columnsSnapshot) {
  return (Array.isArray(columnsSnapshot) ? columnsSnapshot : [])
    .map(normalizeColumn)
    .filter(Boolean);
}

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function convertValue(value, type) {
  const text = normalizeCell(value);
  if (!text) return null;
  if (['number', 'numeric', 'float', 'double', 'decimal'].includes(type)) {
    const numeric = Number(text.replace(/,/g, ''));
    return Number.isFinite(numeric) ? numeric : text;
  }
  if (['int', 'integer'].includes(type)) {
    const numeric = Number.parseInt(text.replace(/,/g, ''), 10);
    return Number.isFinite(numeric) ? numeric : text;
  }
  if (['bool', 'boolean'].includes(type)) {
    if (/^(true|1|是|有|yes|y)$/i.test(text)) return true;
    if (/^(false|0|否|无|no|n)$/i.test(text)) return false;
    return text;
  }
  return text;
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

function findHeaderMapping(headerRow, columns) {
  const cells = Array.isArray(headerRow) ? headerRow.map((cell) => normalizeKey(cell)) : [];
  const mapping = new Map();
  cells.forEach((cellKey, index) => {
    if (!cellKey) return;
    const matched = columns.find((column) => column.keys.includes(cellKey));
    if (matched && !mapping.has(matched.field)) mapping.set(matched.field, index);
  });
  return mapping;
}

function buildUnmappedFromRow(headerRow, row, mapping) {
  const mappedIndexes = new Set([...mapping.values()]);
  const out = [];
  for (let index = 0; index < row.length; index += 1) {
    if (mappedIndexes.has(index)) continue;
    const value = normalizeCell(row[index]);
    if (!value) continue;
    const header = normalizeCell(headerRow?.[index]) || `第${index + 1}列`;
    out.push({
      name: header,
      value,
      confidence: 0.55,
      source: '表格行'
    });
  }
  return out;
}

function makeAiSupplementRemark(unmappedFields, sourceFilename) {
  const lines = ['【AI未匹配字段】'];
  for (const field of unmappedFields.slice(0, 30)) {
    lines.push(`${field.name}：${field.value}`);
  }
  if (sourceFilename) lines.push(`来源文件：${sourceFilename}`);
  return lines.join('\n');
}

function buildBaseProperties({ asset, entryPlan, unmappedFields, rowIndex = null }) {
  return {
    ai_generated: true,
    ai_system_actor: 'collector_agent',
    ai_source_asset_id: asset.id,
    ai_import_batch_id: asset.batch_id || entryPlan.batch_id || null,
    ai_source_device_id: asset.device_id || null,
    ai_uploaded_by_user_id: asset.uploaded_by_user_id || null,
    ai_confidence: Number(entryPlan.confidence || 0),
    ai_parse_status: 'parsed',
    ai_review_status: 'unreviewed',
    ai_trace_id: `document_intake:${entryPlan.id}`,
    ai_entry_plan_id: entryPlan.id,
    ai_source_filename: asset.original_filename || '',
    ai_row_index: rowIndex,
    __ai_unmapped_fields: unmappedFields
  };
}

function rowHasUsefulValue(record, unmappedFields) {
  return Object.values(record).some((value) => value !== null && value !== undefined && String(value).trim() !== '')
    || unmappedFields.length > 0;
}

function recordsFromTables({ asset, entryPlan, parseResult, columns, availableColumns }) {
  const tables = extractTables(parseResult, entryPlan);
  const records = [];
  const remarkField = remarkFields.find((field) => availableColumns.has(field));

  for (const table of tables) {
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    if (rows.length < 2) continue;
    const headerRow = rows[0] || [];
    const mapping = findHeaderMapping(headerRow, columns);
    if (!mapping.size) continue;

    for (let rowIndex = 1; rowIndex < rows.length && records.length < maxRowsPerPlan; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const payload = {};
      for (const column of columns) {
        if (!availableColumns.has(column.field)) continue;
        const index = mapping.get(column.field);
        if (index === undefined) continue;
        const value = convertValue(row[index], column.type);
        if (value !== null && value !== '') payload[column.field] = value;
      }

      const unmappedFields = buildUnmappedFromRow(headerRow, row, mapping);
      if (!rowHasUsefulValue(payload, unmappedFields)) continue;

      if (remarkField && unmappedFields.length) {
        payload[remarkField] = makeAiSupplementRemark(unmappedFields, asset.original_filename);
      }
      payload.properties = buildBaseProperties({ asset, entryPlan, unmappedFields, rowIndex });
      records.push({ payload, unmappedFields, source: `table:${table.sheet_name || table.name || ''}:row:${rowIndex + 1}` });
    }
  }

  return records;
}

function fieldRegexTerms(column) {
  return [column.label, ...column.aliases, column.field]
    .map((item) => normalizeText(item, 80))
    .filter((item) => item && !['备注', '说明', 'properties'].includes(item));
}

function extractValueFromText(text, column) {
  for (const term of fieldRegexTerms(column)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*[:：=]\\s*([^\\n\\r,，;；\\t]{1,120})`, 'i');
    const match = text.match(regex);
    if (match?.[1]) return convertValue(match[1].trim(), column.type);
  }
  return null;
}

function recordFromText({ asset, entryPlan, parseResult, columns, availableColumns }) {
  const text = normalizeText(parseResult?.text_content || safeJson(entryPlan.documents, [])[0]?.extracted_text_preview || '', 20000);
  if (!text) return [];

  const payload = {};
  for (const column of columns) {
    if (!availableColumns.has(column.field)) continue;
    const value = extractValueFromText(text, column);
    if (value !== null && value !== '') payload[column.field] = value;
  }

  const unmappedFields = [{
    name: '原文摘录',
    value: text.slice(0, 1200),
    confidence: 0.4,
    source: '解析文本'
  }];
  const remarkField = remarkFields.find((field) => availableColumns.has(field));
  if (remarkField) payload[remarkField] = makeAiSupplementRemark(unmappedFields, asset.original_filename);
  payload.properties = buildBaseProperties({ asset, entryPlan, unmappedFields });

  return [{ payload, unmappedFields, source: 'text' }];
}

function buildRecordsFromPlan({ asset, entryPlan, parseResult, availableColumnNames }) {
  const columns = normalizeColumns(safeJson(entryPlan.columns_snapshot, []));
  const availableColumns = new Set((availableColumnNames || []).map((item) => sanitizeIdentifier(item)).filter(Boolean));
  availableColumns.add('properties');

  const tableRecords = recordsFromTables({ asset, entryPlan, parseResult, columns, availableColumns });
  if (tableRecords.length) return tableRecords;
  return recordFromText({ asset, entryPlan, parseResult, columns, availableColumns });
}

async function ensureDataTable(client, entryPlan) {
  if (!entryPlan.app_id || !entryPlan.target_table) return;
  await client.query(
    'select app_center.create_data_app_table($1::uuid, $2::text, $3::jsonb) as table_name',
    [
      entryPlan.app_id,
      entryPlan.target_table,
      JSON.stringify(safeJson(entryPlan.columns_snapshot, []))
    ]
  );
}

async function getTableColumns(client, schemaName, tableName) {
  const result = await client.query(
    `select column_name
       from information_schema.columns
      where table_schema = $1
        and table_name = $2`,
    [schemaName, tableName]
  );
  return result.rows.map((row) => row.column_name);
}

async function insertRecord(client, schemaName, tableName, payload) {
  const entries = Object.entries(payload).filter(([key]) => sanitizeIdentifier(key));
  if (!entries.length) throw new Error('No insertable payload fields');
  const columns = entries.map(([key]) => sanitizeIdentifier(key));
  const values = entries.map(([, value]) => value);
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const sql = `insert into ${quoteIdent(schemaName)}.${quoteIdent(tableName)} (${columns.map(quoteIdent).join(', ')}) values (${placeholders.join(', ')}) returning id`;
  const result = await client.query(sql, values);
  return result.rows[0]?.id || null;
}

class DocumentEntryWorker {
  constructor(options = {}) {
    this.log = options.log || console;
    this.timer = null;
    this.running = false;
    this.stopping = false;
  }

  start() {
    if (!entryWorkerEnabled) {
      this.log.info?.('[document-entry] worker disabled');
      return;
    }
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        this.log.warn?.('[document-entry] run failed:', error?.message || error);
      });
    }, pollIntervalMs);
    this.timer.unref?.();
    this.runOnce().catch((error) => {
      this.log.warn?.('[document-entry] initial run failed:', error?.message || error);
    });
    this.log.info?.(`[document-entry] worker started, interval=${pollIntervalMs}ms`);
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
          and p.target_kind = 'data_app'
          and coalesce(p.target_schema, '') = 'app_data'
          and coalesce(p.target_table, '') <> ''
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

      await ensureDataTable(client, entryPlan);
      const tableName = sanitizeIdentifier(entryPlan.target_table);
      const schemaName = sanitizeIdentifier(entryPlan.target_schema, 'app_data');
      const availableColumns = await getTableColumns(client, schemaName, tableName);
      const records = buildRecordsFromPlan({
        asset,
        entryPlan,
        parseResult,
        availableColumnNames: availableColumns
      });

      if (!records.length) {
        await client.query(
          `update public.document_entry_plans
              set status = 'failed',
                  metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                  updated_at = now()
            where id = $1`,
          [entryPlan.id, JSON.stringify({ import_error: 'No records generated from entry plan' })]
        );
        await client.query('commit');
        return true;
      }

      const insertedIds = [];
      for (const record of records.slice(0, maxRowsPerPlan)) {
        const recordId = await insertRecord(client, schemaName, tableName, record.payload);
        insertedIds.push(recordId);
        await client.query(
          `insert into public.document_business_links (
             asset_id, batch_id, entry_plan_id, target_schema, target_table,
             target_record_id, target_module, target_document_type, target_app_id,
             ai_confidence, metadata
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            asset.id,
            asset.batch_id,
            entryPlan.id,
            schemaName,
            tableName,
            String(recordId || ''),
            entryPlan.target_module || 'app_data',
            entryPlan.target_document_type || '',
            entryPlan.app_id || null,
            Number(entryPlan.confidence || 0),
            JSON.stringify({ source: record.source, ai_generated: true })
          ]
        );

        for (const field of record.unmappedFields || []) {
          await client.query(
            `insert into public.document_unmapped_fields (
               asset_id, batch_id, entry_plan_id, target_schema, target_table,
               target_record_id, name, value, confidence, source, write_location, metadata
             ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              asset.id,
              asset.batch_id,
              entryPlan.id,
              schemaName,
              tableName,
              String(recordId || ''),
              normalizeText(field.name, 200),
              normalizeText(field.value, 4000),
              Number(field.confidence || 0),
              normalizeText(field.source, 300),
              'properties',
              JSON.stringify({ source_record: record.source })
            ]
          );
        }
      }

      await client.query(
        `update public.document_entry_plans
            set status = 'imported',
                metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                updated_at = now()
          where id = $1`,
        [
          entryPlan.id,
          JSON.stringify({
            imported_at: new Date().toISOString(),
            imported_count: insertedIds.length,
            target_record_ids: insertedIds.map((id) => String(id || ''))
          })
        ]
      );
      await client.query(
        `update public.document_assets
            set status = 'imported',
                metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                updated_at = now()
          where id = $1`,
        [
          asset.id,
          JSON.stringify({
            ai_import_status: 'imported',
            ai_imported_at: new Date().toISOString(),
            ai_imported_count: insertedIds.length
          })
        ]
      );

      await client.query('commit');
      this.log.info?.(`[document-entry] imported ${insertedIds.length} records into ${schemaName}.${tableName}`);
      return true;
    } catch (error) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }
}

function createDocumentEntryWorker(options = {}) {
  return new DocumentEntryWorker(options);
}

module.exports = {
  createDocumentEntryWorker,
  buildRecordsFromPlan,
  sanitizeIdentifier,
  normalizeColumns,
  findHeaderMapping,
  makeAiSupplementRemark
};
