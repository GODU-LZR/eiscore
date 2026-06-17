// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envText = (value, fallback = '') => String(value ?? fallback).trim();
function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

const parseWorkerEnabled = envText(process.env.DOCUMENT_PARSE_WORKER_ENABLED, 'true').toLowerCase() !== 'false';
const pollIntervalMs = positiveInteger(process.env.DOCUMENT_PARSE_POLL_INTERVAL_MS, 8000, { min: 2000, max: 10 * 60 * 1000 });
const maxRetries = positiveInteger(process.env.DOCUMENT_PARSE_MAX_RETRIES, 5, { min: 1, max: 50 });
const maxTextChars = positiveInteger(process.env.DOCUMENT_PARSE_MAX_TEXT_CHARS, 600000, { min: 10000, max: 5 * 1000 * 1000 });
const maxTableRowsPerSheet = positiveInteger(process.env.DOCUMENT_PARSE_MAX_TABLE_ROWS_PER_SHEET, 5000, { min: 100, max: 100000 });

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: positiveInteger(process.env.PGPORT, 5432, { min: 1, max: 65535 }),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: positiveInteger(process.env.DOCUMENT_PARSE_PG_POOL_MAX, 3, { min: 1, max: 20 })
});

function normalizeText(value, max = maxTextChars) {
  return String(value ?? '').trim().slice(0, max);
}

function resolveParserType(asset) {
  const ext = String(asset?.file_ext || path.extname(asset?.original_filename || '') || '').toLowerCase();
  const mime = String(asset?.mime_type || '').toLowerCase();

  if (['.xlsx', '.xls', '.csv', '.tsv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') {
    return 'spreadsheet';
  }
  if (ext === '.docx' || mime.includes('wordprocessingml')) return 'docx';
  if (ext === '.pdf' || mime === 'application/pdf') return 'pdf';
  if (['.txt', '.md', '.json', '.xml', '.html', '.htm', '.log'].includes(ext) || mime.startsWith('text/')) return 'text';
  if (['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tif', '.tiff'].includes(ext) || mime.startsWith('image/')) return 'image';
  return 'unsupported';
}

function requireOptional(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    const wrapped = new Error(`Missing parser dependency: ${packageName}`);
    wrapped.cause = error;
    throw wrapped;
  }
}

function rowsToText(rows) {
  return rows
    .map((row) => row.map((cell) => String(cell ?? '').trim()).filter(Boolean).join('\t'))
    .filter(Boolean)
    .join('\n');
}

async function parseSpreadsheet(asset) {
  const xlsx = requireOptional('xlsx');
  const workbook = xlsx.readFile(asset.storage_path, { cellDates: true, dense: false });
  const tables = [];
  const textParts = [];

  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false
    });
    const limitedRows = rows.slice(0, maxTableRowsPerSheet);
    tables.push({
      sheet_name: sheetName,
      row_count: rows.length,
      truncated: rows.length > limitedRows.length,
      rows: limitedRows
    });
    textParts.push(`【${sheetName}】\n${rowsToText(limitedRows)}`);
  }

  return {
    status: 'success',
    parserType: 'spreadsheet',
    textContent: normalizeText(textParts.join('\n\n')),
    tables,
    layout: {},
    ocrResult: {},
    imageDescriptions: [],
    metadata: {
      sheet_count: workbook.SheetNames?.length || 0
    }
  };
}

async function parseDocx(asset) {
  const mammoth = requireOptional('mammoth');
  const result = await mammoth.extractRawText({ path: asset.storage_path });
  return {
    status: 'success',
    parserType: 'docx',
    textContent: normalizeText(result.value || ''),
    tables: [],
    layout: {},
    ocrResult: {},
    imageDescriptions: [],
    metadata: {
      messages: Array.isArray(result.messages) ? result.messages : []
    }
  };
}

async function loadPdfParseModule() {
  try {
    return require('pdf-parse');
  } catch (error) {
    try {
      return await import('pdf-parse');
    } catch {
      const wrapped = new Error('Missing parser dependency: pdf-parse');
      wrapped.cause = error;
      throw wrapped;
    }
  }
}

async function parsePdf(asset) {
  const pdfParse = await loadPdfParseModule();
  const buffer = await fs.promises.readFile(asset.storage_path);

  if (typeof pdfParse === 'function') {
    const result = await pdfParse(buffer);
    return {
      status: 'success',
      parserType: 'pdf',
      textContent: normalizeText(result.text || ''),
      tables: [],
      layout: {},
      ocrResult: {},
      imageDescriptions: [],
      metadata: {
        page_count: result.numpages || result.numrender || null,
        info: result.info || null
      }
    };
  }

  const PDFParse = pdfParse.PDFParse || pdfParse.default?.PDFParse;
  if (PDFParse) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return {
        status: 'success',
        parserType: 'pdf',
        textContent: normalizeText(result.text || ''),
        tables: [],
        layout: {},
        ocrResult: {},
        imageDescriptions: [],
        metadata: {
          page_count: result.total || result.pages?.length || null
        }
      };
    } finally {
      await parser.destroy?.();
    }
  }

  throw new Error('Unsupported pdf-parse module API');
}

async function parseText(asset) {
  const buffer = await fs.promises.readFile(asset.storage_path);
  const text = buffer.toString('utf-8');
  return {
    status: 'success',
    parserType: 'text',
    textContent: normalizeText(text),
    tables: [],
    layout: {},
    ocrResult: {},
    imageDescriptions: [],
    metadata: {
      bytes_read: buffer.length,
      truncated: text.length > maxTextChars
    }
  };
}

async function parseImage(asset) {
  const stat = await fs.promises.stat(asset.storage_path);
  return {
    status: 'partial',
    parserType: 'image',
    textContent: '',
    tables: [],
    layout: {
      file_size: stat.size,
      mime_type: asset.mime_type || ''
    },
    ocrResult: {
      status: 'pending',
      message: 'Image OCR is reserved for the AI vision/OCR worker.'
    },
    imageDescriptions: [],
    metadata: {
      parser_status: 'ocr_pending'
    }
  };
}

async function parseUnsupported(asset) {
  return {
    status: 'partial',
    parserType: 'unsupported',
    textContent: '',
    tables: [],
    layout: {},
    ocrResult: {},
    imageDescriptions: [],
    metadata: {
      parser_status: 'unsupported_file_type',
      mime_type: asset.mime_type || '',
      file_ext: asset.file_ext || ''
    }
  };
}

async function parseAsset(asset) {
  const parserType = resolveParserType(asset);
  if (!asset?.storage_path || !fs.existsSync(asset.storage_path)) {
    throw new Error(`Source file not found: ${asset?.storage_path || ''}`);
  }

  if (parserType === 'spreadsheet') return parseSpreadsheet(asset);
  if (parserType === 'docx') return parseDocx(asset);
  if (parserType === 'pdf') return parsePdf(asset);
  if (parserType === 'text') return parseText(asset);
  if (parserType === 'image') return parseImage(asset);
  return parseUnsupported(asset);
}

class DocumentParseWorker {
  constructor(options = {}) {
    this.log = options.log || console;
    this.timer = null;
    this.running = false;
    this.stopping = false;
  }

  start() {
    if (!parseWorkerEnabled) {
      this.log.info?.('[document-parser] worker disabled');
      return;
    }
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        this.log.warn?.('[document-parser] run failed:', error?.message || error);
      });
    }, pollIntervalMs);
    this.timer.unref?.();
    this.runOnce().catch((error) => {
      this.log.warn?.('[document-parser] initial run failed:', error?.message || error);
    });
    this.log.info?.(`[document-parser] worker started, interval=${pollIntervalMs}ms`);
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
        const job = await this.claimJob();
        if (!job) break;
        processed = true;
        await this.processJob(job);
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  async claimJob() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `select
           j.id as job_id,
           j.retry_count,
           a.id as asset_id,
           a.batch_id,
           a.original_filename,
           a.storage_path,
           a.mime_type,
           a.file_ext,
           a.file_size,
           a.file_hash
         from public.document_parse_jobs j
         join public.document_assets a on a.id = j.asset_id
        where j.status = 'pending'
          and j.retry_count < $1
        order by j.created_at asc
        for update of j skip locked
        limit 1`,
        [maxRetries]
      );
      const job = result.rows[0] || null;
      if (!job) {
        await client.query('commit');
        return null;
      }
      await client.query(
        `update public.document_parse_jobs
            set status = 'running',
                started_at = now(),
                parser_type = $2,
                updated_at = now()
          where id = $1`,
        [job.job_id, resolveParserType(job)]
      );
      await client.query(
        `update public.document_assets
            set status = 'parsing',
                updated_at = now()
          where id = $1`,
        [job.asset_id]
      );
      await client.query('commit');
      return job;
    } catch (error) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async processJob(job) {
    try {
      const result = await parseAsset(job);
      await this.saveParseResult(job, result);
      this.log.info?.(`[document-parser] parsed ${job.original_filename} (${result.parserType}, ${result.status})`);
    } catch (error) {
      await this.markFailed(job, error);
      this.log.warn?.(`[document-parser] failed ${job.original_filename}:`, error?.message || error);
    }
  }

  async saveParseResult(job, result) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into public.document_parse_results (
           asset_id, parse_job_id, text_content, tables, layout, ocr_result, image_descriptions, metadata
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          job.asset_id,
          job.job_id,
          result.textContent || '',
          JSON.stringify(result.tables || []),
          JSON.stringify(result.layout || {}),
          JSON.stringify(result.ocrResult || {}),
          JSON.stringify(result.imageDescriptions || []),
          JSON.stringify({
            ...(result.metadata || {}),
            parser_type: result.parserType,
            parsed_at: new Date().toISOString()
          })
        ]
      );
      await client.query(
        `update public.document_parse_jobs
            set status = $2,
                parser_type = $3,
                finished_at = now(),
                last_error = null,
                updated_at = now()
          where id = $1`,
        [job.job_id, result.status === 'partial' ? 'partial' : 'success', result.parserType]
      );
      await client.query(
        `update public.document_assets
            set status = 'parsed',
                updated_at = now(),
                metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where id = $1`,
        [
          job.asset_id,
          JSON.stringify({
            parse_status: result.status === 'partial' ? 'partial' : 'success',
            parser_type: result.parserType,
            parsed_at: new Date().toISOString()
          })
        ]
      );
      await client.query('commit');
    } catch (error) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async markFailed(job, error) {
    const message = normalizeText(error?.message || String(error || 'Parse failed'), 2000);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update public.document_parse_jobs
            set status = case when retry_count + 1 >= $3 then 'failed' else 'pending' end,
                retry_count = retry_count + 1,
                last_error = $2,
                finished_at = case when retry_count + 1 >= $3 then now() else finished_at end,
                updated_at = now()
          where id = $1`,
        [job.job_id, message, maxRetries]
      );
      await client.query(
        `update public.document_assets
            set status = case
                  when (
                    select retry_count from public.document_parse_jobs where id = $2
                  ) >= $3 then 'failed'
                  else 'uploaded'
                end,
                metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
                updated_at = now()
          where id = $1`,
        [
          job.asset_id,
          job.job_id,
          maxRetries,
          JSON.stringify({ parse_last_error: message })
        ]
      );
      await client.query('commit');
    } catch (markError) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw markError;
    } finally {
      client.release();
    }
  }
}

function createDocumentParseWorker(options = {}) {
  return new DocumentParseWorker(options);
}

module.exports = {
  createDocumentParseWorker,
  parseAsset,
  resolveParserType
};
