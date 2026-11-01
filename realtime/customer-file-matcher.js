// SPDX-License-Identifier: AGPL-3.0-or-later

'use strict';

const CUSTOMER_TABLE = 'public.sales_customers';
const CUSTOMER_MODULE = 'sales_customer';
const MAX_FILES = 100;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_CONTENT_CHARS = 120000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max = 240) => String(value ?? '').replace(/\u0000/g, ' ').trim().slice(0, max);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const isUuid = (value) => UUID_RE.test(text(value, 80));
const fail = (code, message, httpStatus = 400) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  throw error;
};

const normalizeIdList = (input) => {
  const values = Array.isArray(input) ? input : [input];
  const ids = [...new Set(values.map((value) => text(value, 80)).filter(Boolean))];
  if (!ids.length || ids.length > MAX_FILES || ids.some((id) => !isUuid(id))) {
    fail('HARNESS_CUSTOMER_FILE_BATCH_INVALID', `file_ids must contain 1-${MAX_FILES} valid file ids`);
  }
  return ids;
};

const extensionOf = (filename) => {
  const match = /\.([a-z0-9]{1,12})$/i.exec(String(filename || ''));
  return match ? match[1].toLowerCase() : '';
};

const printableText = (buffer) => String(buffer.toString('utf8'))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, MAX_CONTENT_CHARS);

const parseTextBuffer = (buffer) => printableText(buffer);

const requireOptional = (packageName) => {
  try { return require(packageName); } catch (error) {
    const wrapped = new Error(`Missing parser dependency: ${packageName}`);
    wrapped.cause = error;
    throw wrapped;
  }
};

const normalizeParsedText = (value) => String(value ?? '')
  .replace(/\u0000/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, MAX_CONTENT_CHARS);

const decodeXmlText = (value) => String(value ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

const parsePptxBuffer = async (buffer) => {
  const JSZip = requireOptional('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => Number(left.match(/slide(\d+)/i)[1]) - Number(right.match(/slide(\d+)/i)[1]));
  const parts = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async('string');
    const slideText = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)]
      .map((match) => decodeXmlText(match[1]))
      .join(' ');
    if (slideText.trim()) parts.push(slideText);
  }
  return normalizeParsedText(parts.join('\n'));
};

const parseStructuredBuffer = async (buffer, ext, mime) => {
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') {
    const xlsx = requireOptional('xlsx');
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true, dense: false, raw: false });
    const parts = [];
    for (const sheetName of workbook.SheetNames || []) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false, raw: false });
      parts.push(`【${sheetName}】\n${rows.map((row) => row.map((cell) => String(cell ?? '').trim()).filter(Boolean).join('\t')).filter(Boolean).join('\n')}`);
    }
    return { text: normalizeParsedText(parts.join('\n\n')), mode: 'spreadsheet' };
  }
  if (ext === 'docx' || mime.includes('wordprocessingml')) {
    const mammoth = requireOptional('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalizeParsedText(result.value), mode: 'docx' };
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    const pdfParse = requireOptional('pdf-parse');
    if (typeof pdfParse === 'function') {
      const result = await pdfParse(buffer);
      return { text: normalizeParsedText(result.text), mode: 'pdf' };
    }
    const PDFParse = pdfParse.PDFParse || pdfParse.default?.PDFParse;
    if (PDFParse) {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return { text: normalizeParsedText(result.text), mode: 'pdf' };
      } finally { await parser.destroy?.(); }
    }
    throw new Error('Unsupported pdf-parse module API');
  }
  if (ext === 'pptx' || mime.includes('presentationml')) return { text: await parsePptxBuffer(buffer), mode: 'pptx' };
  return null;
};

const extractContent = async (file) => {
  const base = text(file.filename, 240);
  if (!file.content_base64) return { text: base, mode: 'metadata_only', contentUnderstood: false };
  let buffer;
  try { buffer = Buffer.from(String(file.content_base64), 'base64'); } catch { return { text: base, mode: 'metadata_only', contentUnderstood: false }; }
  const mime = text(file.mime_type, 120).toLowerCase();
  const ext = extensionOf(file.filename);
  const readable = mime.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'xml', 'html', 'log'].includes(ext);
  if (readable) return { text: `${base}\n${parseTextBuffer(buffer)}`.slice(0, MAX_CONTENT_CHARS), mode: 'text', contentUnderstood: true };
  try {
    const parsed = await parseStructuredBuffer(buffer, ext, mime);
    if (parsed) return { text: `${base}\n${parsed.text}`.slice(0, MAX_CONTENT_CHARS), mode: parsed.mode, contentUnderstood: true };
  } catch (error) {
    return { text: base, mode: 'parse_error', contentUnderstood: false, parseError: text(error?.message || error, 240) };
  }
  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(ext);
  return {
    text: base,
    mode: isImage ? 'vision_pending' : isAudio ? 'transcription_pending' : 'metadata_only',
    contentUnderstood: false
  };
};

const normalizeMatchText = (value) => text(value, MAX_CONTENT_CHARS).toLocaleLowerCase('zh-CN');
const fieldSignals = (row) => [
  ['customer_no', row.customer_no, 1],
  ['name', row.name, 0.9],
  ['contact_name', row.contact_name, 0.78],
  ['contact_phone', row.contact_phone, 0.86],
  ['region', row.region, 0.35],
  ['owner_name', row.owner_name, 0.3]
].filter(([, value]) => text(value, 240));

const matchCustomerRows = (content, rows, { requireConfirmation = false } = {}) => {
  const haystack = normalizeMatchText(content);
  const matches = rows.map((row) => {
    const signals = fieldSignals(row).filter(([, value]) => haystack.includes(normalizeMatchText(value)));
    const score = signals.reduce((total, [, , weight]) => Math.min(1, total + weight), 0);
    return {
      customer_id: row.id,
      customer_no: text(row.customer_no, 160),
      name: text(row.name, 240),
      score: Number(score.toFixed(3)),
      matched_fields: signals.map(([field]) => field)
    };
  }).filter((candidate) => candidate.score > 0).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'zh-CN'));
  const top = matches[0];
  const second = matches[1];
  const unique = !!top && (!second || top.score - second.score >= 0.15);
  const status = !top ? 'unmatched' : !requireConfirmation && top.score >= 0.78 && unique ? 'matched' : 'needs_confirmation';
  return { status, confidence: top?.score || 0, candidates: matches.slice(0, 5) };
};

const createCustomerFileMatcher = ({ callPostgrestWithUser, fetchSemanticContext } = {}) => {
  if (typeof callPostgrestWithUser !== 'function') throw new TypeError('Customer file matcher PostgREST adapter is required');
  if (typeof fetchSemanticContext !== 'function') throw new TypeError('Customer file matcher semantic context loader is required');

  const requireReadAccess = async (user) => {
    const context = await fetchSemanticContext(user);
    if (!context?.accessPolicy?.roleScoped || context.fieldAclAvailable !== true) fail('HARNESS_PERMISSION_DENIED', 'Role-scoped customer permissions are unavailable', 403);
    const permissions = new Set((Array.isArray(context.permissions) ? context.permissions : []).map((entry) => text(entry?.code || entry, 120).toLowerCase()));
    if (context.accessPolicy.superUser !== true && !permissions.has('app:sales_customer')) fail('HARNESS_PERMISSION_DENIED', 'Customer archive permission is not granted', 403);
    if (context.fieldAcl?.[CUSTOMER_MODULE]?.customer_files?.canView === false) fail('HARNESS_PERMISSION_DENIED', 'Customer file field is not visible', 403);
    return context;
  };

  const analyze = async (user, input = {}) => {
    const context = await requireReadAccess(user);
    const ids = normalizeIdList(input.file_ids || input.fileIds || input.files);
    const fileResponse = await callPostgrestWithUser(user, {
      method: 'GET', path: '/files',
      query: { select: 'id,filename,mime_type,size_bytes,content_base64,sha256,created_at,extra', id: `in.(${ids.join(',')})`, limit: String(MAX_FILES) },
      acceptProfile: 'public', timeoutMs: 15000
    });
    const files = Array.isArray(fileResponse?.data) ? fileResponse.data : [];
    const userId = text(user?.id || user?.username, 160);
    const tenantId = text(user?.tenant_id || user?.tenantId, 160);
    const owned = files.filter((file) => {
      const owner = object(file.extra);
      return ids.includes(file.id) && owner.source === 'harness_customer_archive' && owner.uploaded_by === userId && owner.tenant_id === tenantId;
    });
    const missing = ids.filter((id) => !owned.some((file) => file.id === id));
    if (missing.length) fail('HARNESS_CUSTOMER_FILE_NOT_FOUND', 'One or more files were not found or do not belong to the current user', 404);
    if (owned.some((file) => Number(file.size_bytes || 0) > MAX_FILE_BYTES)) fail('HARNESS_CUSTOMER_FILE_INVALID', 'A file exceeds the 100 MiB limit');

    const select = 'id,customer_no,name,contact_name,contact_phone,region,owner_name,properties,updated_at';
    const fieldAcl = context.fieldAcl?.[CUSTOMER_MODULE] || {};
    const visible = ['id', 'customer_no', 'name', 'contact_name', 'contact_phone', 'region', 'owner_name', 'properties', 'updated_at']
      .filter((field) => field === 'id' || fieldAcl[field]?.canView !== false);
    const customerResponse = await callPostgrestWithUser(user, {
      method: 'GET', path: '/sales_customers',
      query: { select: visible.join(',') || select, status: 'neq.deleted', order: 'created_at.desc', limit: '500' },
      acceptProfile: 'public', timeoutMs: 15000
    });
    const customers = Array.isArray(customerResponse?.data) ? customerResponse.data : [];
    const results = await Promise.all(owned.map(async (file) => {
      const extracted = await extractContent(file);
      const match = matchCustomerRows(extracted.text, customers, { requireConfirmation: !extracted.contentUnderstood });
      return {
        file_id: file.id,
        filename: text(file.filename, 240),
        mime_type: text(file.mime_type, 120),
        analysis_mode: extracted.mode,
        content_understood: extracted.contentUnderstood,
        ...(extracted.parseError ? { parse_error: extracted.parseError } : {}),
        ...match,
        recommendation: match.status === 'matched' ? '可在用户确认后调用 attach_file 写入客户资料列' : '请用户确认候选客户后再调用 attach_file'
      };
    }));
    return { operation: 'analyze', dataset: 'sales_customer_files', total: results.length, results, write_required: true };
  };

  return Object.freeze({ analyze, maxFiles: MAX_FILES });
};

module.exports = { MAX_FILES, createCustomerFileMatcher, extractContent, matchCustomerRows };
