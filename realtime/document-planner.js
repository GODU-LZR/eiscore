// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const { Pool } = require('pg');

const envText = (value, fallback = '') => String(value ?? fallback).trim();
function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

const plannerEnabled = envText(process.env.DOCUMENT_PLAN_WORKER_ENABLED, 'true').toLowerCase() !== 'false';
const pollIntervalMs = positiveInteger(process.env.DOCUMENT_PLAN_POLL_INTERVAL_MS, 10000, { min: 2000, max: 10 * 60 * 1000 });
const maxTextChars = positiveInteger(process.env.DOCUMENT_PLAN_MAX_TEXT_CHARS, 120000, { min: 10000, max: 1000 * 1000 });

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: positiveInteger(process.env.PGPORT, 5432, { min: 1, max: 65535 }),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: positiveInteger(process.env.DOCUMENT_PLAN_PG_POOL_MAX, 3, { min: 1, max: 20 })
});

const fixedRules = [
  {
    module: 'materials',
    documentType: '采购入库单',
    targetKind: 'fixed_module_table',
    keywords: ['送货单', '入库', '来料', '采购', '供应商', '到货', '收货', '物料', '仓库', '批次'],
    groupingFields: ['单号', '供应商', '日期', '仓库'],
    lineFields: ['物料', '规格', '数量', '单位', '批次']
  },
  {
    module: 'quality',
    documentType: '质量检验单',
    targetKind: 'fixed_module_table',
    keywords: ['质检', '检验', '合格', '不合格', '抽检', '判定', '缺陷', '报废', '让步接收', '检验员'],
    groupingFields: ['检验单号', '物料', '批次', '检验日期'],
    lineFields: ['检验项目', '标准', '结果', '缺陷数量']
  },
  {
    module: 'production',
    documentType: '生产日报',
    targetKind: 'fixed_module_table',
    keywords: ['生产日报', '生产', '工序', '完工', '产量', '报工', '车间', '班组', '工单', '不良'],
    groupingFields: ['日期', '车间', '班组', '工单'],
    lineFields: ['产品', '工序', '完工数量', '不良数量']
  },
  {
    module: 'sales',
    documentType: '销售出库单',
    targetKind: 'fixed_module_table',
    keywords: ['销售', '客户', '出库', '发货', '出货', '订单', '送货地址', '收货人'],
    groupingFields: ['客户', '订单号', '日期'],
    lineFields: ['产品', '数量', '单位', '批次']
  },
  {
    module: 'equipment',
    documentType: '设备点检记录',
    targetKind: 'fixed_module_table',
    keywords: ['设备', '点检', '保养', '维修', '故障', '停机', '巡检', '维护'],
    groupingFields: ['设备', '日期', '负责人'],
    lineFields: ['项目', '结果', '异常', '处理措施']
  },
  {
    module: 'hr',
    documentType: '人事记录',
    targetKind: 'fixed_module_table',
    keywords: ['员工', '考勤', '请假', '加班', '入职', '离职', '部门', '岗位'],
    groupingFields: ['员工', '日期', '部门'],
    lineFields: ['事项', '时长', '状态']
  }
];

function normalizeText(value, max = maxTextChars) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function toPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(0.99, Math.round(numeric * 10000) / 10000));
}

function countKeywordHits(text, keywords) {
  const lower = text.toLowerCase();
  let hits = 0;
  const matched = [];
  for (const keyword of keywords) {
    const normalized = String(keyword).toLowerCase();
    if (lower.includes(normalized)) {
      hits += 1;
      matched.push(keyword);
    }
  }
  return { hits, matched };
}

function estimateLineCount(tables) {
  if (!Array.isArray(tables) || tables.length === 0) return 0;
  return tables.reduce((sum, table) => {
    const rowCount = Number(table?.row_count || table?.rows?.length || 0);
    return sum + Math.max(0, rowCount - 1);
  }, 0);
}

function extractColumnsFromApp(app) {
  const config = toPlainObject(app.config);
  const candidates = [
    config.columns,
    config.schema?.columns,
    config.table?.columns,
    config.fields
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function resolveAppTable(app) {
  const config = toPlainObject(app.config);
  return String(
    config.table_name ||
    config.tableName ||
    config.table ||
    config.data_table ||
    config.dataTable ||
    ''
  ).trim();
}

function scoreDynamicApp(app, text) {
  const columns = extractColumnsFromApp(app);
  const appTerms = [
    app.name,
    app.description,
    resolveAppTable(app),
    ...columns.flatMap((column) => [
      column.field,
      column.name,
      column.label,
      ...(Array.isArray(column.aliases) ? column.aliases : [])
    ])
  ]
    .map((item) => String(item || '').trim())
    .filter((item) => item.length >= 2);

  const uniqueTerms = [...new Set(appTerms)].slice(0, 80);
  const { hits, matched } = countKeywordHits(text, uniqueTerms);
  if (!hits) return null;

  const confidence = clampConfidence(0.38 + Math.min(0.45, hits * 0.055));
  return {
    app,
    confidence,
    matched,
    columns
  };
}

function classifyFixed(text) {
  const candidates = fixedRules.map((rule) => {
    const { hits, matched } = countKeywordHits(text, rule.keywords);
    const confidence = clampConfidence(0.25 + Math.min(0.62, hits * 0.075));
    return {
      ...rule,
      hits,
      matched,
      confidence,
      reason: matched.length
        ? `命中关键词：${matched.slice(0, 8).join('、')}`
        : '未命中关键词'
    };
  }).sort((a, b) => b.confidence - a.confidence);

  return candidates;
}

function chooseClassification({ asset, parseResult, apps }) {
  const metadata = safeJson(parseResult.metadata, {});
  const ocrResult = safeJson(parseResult.ocr_result, {});
  const tables = safeJson(parseResult.tables, []);
  const text = normalizeText([
    asset.original_filename,
    parseResult.text_content,
    JSON.stringify(tables.slice(0, 3))
  ].filter(Boolean).join('\n'));

  if (!text || metadata.parser_status === 'ocr_pending' || ocrResult.status === 'pending') {
    return {
      recognized: false,
      targetModule: '',
      targetDocumentType: '',
      targetKind: '',
      confidence: 0,
      reason: metadata.parser_status === 'ocr_pending'
        ? '图片 OCR 尚未完成，暂不生成正式入库计划。'
        : '解析文本不足，无法判断目标业务类型。',
      candidates: [],
      lineCount: estimateLineCount(tables),
      tables
    };
  }

  const fixedCandidates = classifyFixed(text);
  const dynamicCandidates = apps
    .map((app) => scoreDynamicApp(app, text))
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);

  const bestFixed = fixedCandidates[0] || null;
  const bestDynamic = dynamicCandidates[0] || null;

  const chooseDynamic = bestDynamic && (!bestFixed || bestDynamic.confidence >= bestFixed.confidence + 0.08);
  if (chooseDynamic) {
    const tableName = resolveAppTable(bestDynamic.app);
    return {
      recognized: true,
      targetModule: 'app_data',
      targetDocumentType: bestDynamic.app.name || '动态业务应用',
      targetKind: 'data_app',
      confidence: bestDynamic.confidence,
      reason: `匹配动态应用字段/名称：${bestDynamic.matched.slice(0, 8).join('、')}`,
      app: bestDynamic.app,
      columns: bestDynamic.columns,
      targetSchema: 'app_data',
      targetTable: tableName,
      candidates: [
        ...dynamicCandidates.slice(0, 5).map((item) => ({
          target_kind: 'data_app',
          app_id: item.app.id,
          app_name: item.app.name,
          confidence: item.confidence,
          matched: item.matched.slice(0, 12)
        })),
        ...fixedCandidates.slice(0, 5).map((item) => ({
          target_kind: 'fixed_module_table',
          target_module: item.module,
          target_document_type: item.documentType,
          confidence: item.confidence,
          matched: item.matched
        }))
      ],
      lineCount: estimateLineCount(tables),
      tables
    };
  }

  if (bestFixed && bestFixed.confidence >= 0.4) {
    return {
      recognized: true,
      targetModule: bestFixed.module,
      targetDocumentType: bestFixed.documentType,
      targetKind: bestFixed.targetKind,
      confidence: bestFixed.confidence,
      reason: bestFixed.reason,
      groupingFields: bestFixed.groupingFields,
      lineFields: bestFixed.lineFields,
      candidates: fixedCandidates.slice(0, 6).map((item) => ({
        target_kind: 'fixed_module_table',
        target_module: item.module,
        target_document_type: item.documentType,
        confidence: item.confidence,
        matched: item.matched
      })),
      lineCount: estimateLineCount(tables),
      tables
    };
  }

  return {
    recognized: false,
    targetModule: '',
    targetDocumentType: '',
    targetKind: '',
    confidence: bestFixed?.confidence || 0,
    reason: '未达到分类置信度阈值，暂只归档原始文件。',
    candidates: fixedCandidates.slice(0, 6).map((item) => ({
      target_kind: 'fixed_module_table',
      target_module: item.module,
      target_document_type: item.documentType,
      confidence: item.confidence,
      matched: item.matched
    })),
    lineCount: estimateLineCount(tables),
    tables
  };
}

function buildEntryPlan(asset, parseResult, classification) {
  if (!classification.recognized) return null;

  const documentCount = 1;
  const lineCount = classification.lineCount || 0;
  const mode = lineCount > 1 ? 'one_document_with_lines' : 'one_document';
  const documents = [{
    source_asset_id: asset.id,
    source_filename: asset.original_filename,
    suggested_mode: mode,
    extracted_text_preview: normalizeText(parseResult.text_content || '', 1200),
    tables_preview: Array.isArray(classification.tables) ? classification.tables.slice(0, 2) : [],
    field_mapping_status: 'pending',
    unmapped_field_policy: 'remarks_or_properties'
  }];

  if (classification.targetKind === 'data_app') {
    return {
      target_module: classification.targetModule,
      target_document_type: classification.targetDocumentType,
      target_kind: classification.targetKind,
      app_id: classification.app?.id || null,
      app_name: classification.app?.name || '',
      target_schema: classification.targetSchema || 'app_data',
      target_table: classification.targetTable || '',
      mode,
      document_count: documentCount,
      line_count: lineCount,
      confidence: classification.confidence,
      reason: classification.reason,
      columns_snapshot: classification.columns || [],
      documents,
      metadata: {
        planner: 'rule_v1',
        auto_import_ready: !!classification.targetTable,
        next_step: 'field_mapping'
      }
    };
  }

  return {
    target_module: classification.targetModule,
    target_document_type: classification.targetDocumentType,
    target_kind: classification.targetKind,
    app_id: null,
    app_name: '',
    target_schema: '',
    target_table: '',
    mode,
    document_count: documentCount,
    line_count: lineCount,
    confidence: classification.confidence,
    reason: classification.reason,
    columns_snapshot: [],
    documents,
    metadata: {
      planner: 'rule_v1',
      grouping_fields: classification.groupingFields || [],
      line_item_fields: classification.lineFields || [],
      next_step: 'fixed_module_business_adapter'
    }
  };
}

async function loadDataApps(client) {
  try {
    const result = await client.query(
      `select id, name, description, config, status
         from app_center.apps
        where app_type = 'data'
          and coalesce(status, '') <> 'archived'
        order by updated_at desc
        limit 200`
    );
    return result.rows || [];
  } catch {
    return [];
  }
}

class DocumentPlanWorker {
  constructor(options = {}) {
    this.log = options.log || console;
    this.timer = null;
    this.running = false;
    this.stopping = false;
  }

  start() {
    if (!plannerEnabled) {
      this.log.info?.('[document-planner] worker disabled');
      return;
    }
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        this.log.warn?.('[document-planner] run failed:', error?.message || error);
      });
    }, pollIntervalMs);
    this.timer.unref?.();
    this.runOnce().catch((error) => {
      this.log.warn?.('[document-planner] initial run failed:', error?.message || error);
    });
    this.log.info?.(`[document-planner] worker started, interval=${pollIntervalMs}ms`);
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
           a.id,
           a.batch_id,
           a.original_filename,
           a.mime_type,
           a.file_ext,
           a.file_hash,
           pr.id as parse_result_id,
           pr.text_content,
           pr.tables,
           pr.ocr_result,
           pr.metadata as parse_metadata
         from public.document_assets a
         join lateral (
           select *
             from public.document_parse_results pr
            where pr.asset_id = a.id
            order by pr.created_at desc
            limit 1
         ) pr on true
        where a.status = 'parsed'
          and not exists (
            select 1
              from public.document_classification_results cr
             where cr.asset_id = a.id
          )
        order by a.created_at asc
        for update of a skip locked
        limit 1`
      );
      const asset = result.rows[0] || null;
      if (!asset) {
        await client.query('commit');
        return false;
      }

      const apps = await loadDataApps(client);
      const classification = chooseClassification({
        asset,
        parseResult: {
          text_content: asset.text_content,
          tables: asset.tables,
          ocr_result: asset.ocr_result,
          metadata: asset.parse_metadata
        },
        apps
      });
      const entryPlan = buildEntryPlan(asset, { text_content: asset.text_content }, classification);

      await client.query(
        `insert into public.document_classification_results (
           asset_id, batch_id, target_module, target_document_type, target_kind,
           confidence, reason, candidates, metadata
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          asset.id,
          asset.batch_id,
          classification.targetModule || null,
          classification.targetDocumentType || null,
          classification.targetKind || null,
          classification.confidence || 0,
          classification.reason || '',
          JSON.stringify(classification.candidates || []),
          JSON.stringify({
            planner: 'rule_v1',
            parse_result_id: asset.parse_result_id,
            recognized: classification.recognized
          })
        ]
      );

      if (entryPlan) {
        await client.query(
          `insert into public.document_entry_plans (
             asset_id, batch_id, target_module, target_document_type, target_kind,
             app_id, app_name, target_schema, target_table, mode, document_count,
             line_count, confidence, reason, columns_snapshot, documents, status, metadata
           ) values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'planned',$17
           )`,
          [
            asset.id,
            asset.batch_id,
            entryPlan.target_module,
            entryPlan.target_document_type,
            entryPlan.target_kind,
            entryPlan.app_id,
            entryPlan.app_name,
            entryPlan.target_schema,
            entryPlan.target_table,
            entryPlan.mode,
            entryPlan.document_count,
            entryPlan.line_count,
            entryPlan.confidence,
            entryPlan.reason,
            JSON.stringify(entryPlan.columns_snapshot || []),
            JSON.stringify(entryPlan.documents || []),
            JSON.stringify(entryPlan.metadata || {})
          ]
        );
      }

      await client.query(
        `update public.document_assets
            set status = $2,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
          where id = $1`,
        [
          asset.id,
          classification.recognized ? 'classified' : 'unrecognized',
          JSON.stringify({
            classification_status: classification.recognized ? 'classified' : 'unrecognized',
            classification_confidence: classification.confidence || 0,
            classification_reason: classification.reason || '',
            planned_at: new Date().toISOString()
          })
        ]
      );

      await client.query('commit');
      this.log.info?.(`[document-planner] ${classification.recognized ? 'planned' : 'unrecognized'} ${asset.original_filename}`);
      return true;
    } catch (error) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }
}

function createDocumentPlanWorker(options = {}) {
  return new DocumentPlanWorker(options);
}

module.exports = {
  createDocumentPlanWorker,
  chooseClassification,
  buildEntryPlan,
  resolveAppTable,
  extractColumnsFromApp
};
