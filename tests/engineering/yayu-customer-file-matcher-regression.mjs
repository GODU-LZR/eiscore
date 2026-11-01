// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { createCustomerFileMatcher, extractContent, MAX_FILES, MAX_IMAGE_ANALYSIS_BYTES } from '../../realtime/customer-file-matcher.js'

const user = { id: 'user-1', username: 'yayu', tenant_id: 'tenant-yayu' }
const context = {
  accessPolicy: { roleScoped: true, superUser: false },
  fieldAclAvailable: true,
  permissions: [{ code: 'app:sales_customer' }],
  fieldAcl: { sales_customer: { customer_files: { canView: true } } }
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const file = (n, content, extra = {}, metadata = {}) => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
  return {
  id: id(n), filename: metadata.filename || `customer-${n}.txt`, mime_type: metadata.mime_type || 'text/plain', size_bytes: buffer.length,
  content_base64: buffer.toString('base64'),
  extra: { source: 'harness_customer_archive', uploaded_by: user.id, tenant_id: user.tenant_id, ...extra }
  }
}

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const zip = (entries) => {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, value] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(value)
    const crc = crc32(data)
    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    nameBytes.copy(local, 30)
    locals.push(Buffer.concat([local, data]))
    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBytes.copy(central, 46)
    centrals.push(central)
    offset += local.length + data.length
  }
  const centralDirectory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centrals.length, 8)
  end.writeUInt16LE(centrals.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralDirectory, end])
}

const xlsxFixture = zip({
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="客户" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>客户编号</t></is></c><c r="B1" t="inlineStr"><is><t>YA-001</t></is></c></row></sheetData></worksheet>'
})

const docxFixture = zip({
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>客户编号 YA-001 联系人张三</w:t></w:r></w:p></w:body></w:document>'
})

const pptxFixture = zip({
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
  'ppt/slides/slide1.xml': '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>客户编号 YA-001</a:t></p:sld>'
})

const pdfFixture = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 45>>stream\nBT /F1 12 Tf 72 720 Td (客户编号 YA-001) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
const customers = [
  { id: 'customer-a', customer_no: 'YA-001', name: '雅御科技', contact_name: '张三', contact_phone: '13800000001', region: '深圳', owner_name: '李四' },
  { id: 'customer-b', customer_no: 'YA-002', name: '雅御科技', contact_name: '王五', contact_phone: '13800000002', region: '东莞', owner_name: '赵六' },
  { id: 'customer-c', customer_no: 'YA-003', name: '远方客户', contact_name: '陈七', contact_phone: '13900000003', region: '广州', owner_name: '周八' }
]
const files = new Map()
const calls = []
const ocrCalls = []
const semanticRequests = []
const matcher = createCustomerFileMatcher({
  fetchSemanticContext: async (_user, request) => {
    semanticRequests.push(request)
    return context
  },
  analyzeImage: async ({ file, buffer, user: requestUser, request }) => {
    ocrCalls.push({ file, buffer, requestUser, request })
    return { text: '客户编号 YA-001' }
  },
  callPostgrestWithUser: async (_user, request) => {
    calls.push(request)
    if (request.path === '/files') return { data: [...files.values()]
      .filter((entry) => request.query.id.includes(entry.id))
      .map((entry) => Object.fromEntries(request.query.select.split(',').map((field) => [field, entry[field]]))) }
    if (request.path === '/sales_customers') return { data: customers }
    throw new Error(`unexpected path ${request.path}`)
  }
})

const analyze = async (fileIds, request = {}) => matcher.analyze(user, { file_ids: fileIds }, request)

files.set(id(1), file(1, '客户编号 YA-001，联系人张三'))
const sharedRequest = { request_id: 'customer-file-analysis-1', session_id: 'session-1', signal: new AbortController().signal }
let result = await analyze([id(1), id(1)], sharedRequest)
assert.equal(result.total, 1, 'duplicate file ids must be deduplicated')
assert.equal(result.results[0].status, 'matched')
assert.equal(result.results[0].candidates[0].customer_id, 'customer-a')
assert.equal(result.results[0].analysis_mode, 'text')
assert.equal(result.write_required, true, 'analysis must never imply an automatic write')
assert.equal(semanticRequests.at(-1), sharedRequest, 'semantic context must receive the request context')
assert.equal(calls.filter((request) => request.path === '/files').every((request) => request.signal === sharedRequest.signal), true)
assert.equal(calls.filter((request) => request.path === '/sales_customers').at(-1).signal, sharedRequest.signal)

files.set(id(2), file(2, '客户名称：远方客户'))
result = await analyze([id(2)])
assert.equal(result.results[0].status, 'matched', 'customer name is a valid unique signal')
assert.deepEqual(result.results[0].candidates[0].matched_fields, ['name'])

for (const [n, buffer, filename, mime, mode] of [
  [20, xlsxFixture, 'customer-20.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'spreadsheet'],
  [21, docxFixture, 'customer-21.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  [22, pptxFixture, 'customer-22.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  [23, pdfFixture, 'customer-23.pdf', 'application/pdf', 'pdf']
]) {
  files.set(id(n), file(n, buffer, {}, { filename, mime_type: mime }))
  result = await analyze([id(n)])
  assert.equal(result.results[0].analysis_mode, mode, `${mode} content should be parsed in memory`)
  assert.equal(result.results[0].content_understood, true)
  assert.equal(result.results[0].status, 'matched', `${mode} customer identifier should match`)
}

files.set(id(24), file(24, Buffer.from([0, 1, 2, 3]), {}, { filename: 'voice-24.mp3', mime_type: 'audio/mpeg' }))
result = await analyze([id(24)])
assert.equal(result.results[0].analysis_mode, 'transcription_pending')
assert.equal(result.results[0].content_understood, false)
assert.notEqual(result.results[0].status, 'matched', 'untranscribed audio must never be auto-matched')

files.set(id(25), file(25, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), {}, { filename: 'scan-25.png', mime_type: 'image/png' }))
const ocrRequest = { request_id: 'customer-file-analysis-25', session_id: 'session-25', signal: new AbortController().signal }
result = await analyze([id(25)], ocrRequest)
assert.equal(result.results[0].analysis_mode, 'vision_ocr')
assert.equal(result.results[0].content_understood, true)
assert.equal(result.results[0].status, 'matched', 'OCR text should participate in customer matching')
assert.equal(ocrCalls.at(-1).request, ocrRequest, 'request context must reach the OCR adapter')
assert.equal(calls.filter((request) => request.path === '/files').at(-1).signal, ocrRequest.signal)
assert.equal(calls.filter((request) => request.path === '/sales_customers').at(-1).signal, ocrRequest.signal)

files.set(id(26), file(26, Buffer.alloc(16), {}, { filename: 'oversized-26.png', mime_type: 'image/png' }))
files.set(id(26), { ...files.get(id(26)), size_bytes: MAX_IMAGE_ANALYSIS_BYTES + 1 })
const bodyReadCount = () => calls.filter((request) => request.path === '/files' && request.query.select === 'id,content_base64').length
const bodyReadsBeforeLargeImage = bodyReadCount()
result = await analyze([id(26)])
assert.equal(result.results[0].analysis_mode, 'vision_pending', 'oversized OCR inputs remain explicitly pending')
assert.equal(result.results[0].content_understood, false)
assert.equal(bodyReadCount(), bodyReadsBeforeLargeImage, 'oversized images must not fetch their Base64 body for OCR')

files.set(id(27), file(27, Buffer.from([1, 2, 3]), {}, { filename: 'scan-27.tiff', mime_type: 'image/tiff' }))
result = await analyze([id(27)])
assert.equal(result.results[0].analysis_mode, 'vision_pending', 'unsupported OCR formats must remain pending')
assert.equal(ocrCalls.length, 1, 'unsupported image formats must not invoke OCR')

const unavailableMatcher = createCustomerFileMatcher({
  fetchSemanticContext: async () => context,
  analyzeImage: async () => { throw Object.assign(new Error('OCR unavailable'), { code: 'HARNESS_TOOL_UNAVAILABLE' }) },
  callPostgrestWithUser: async (_user, request) => {
    if (request.path === '/files') return { data: [...files.values()]
      .filter((entry) => request.query.id.includes(entry.id))
      .map((entry) => Object.fromEntries(request.query.select.split(',').map((field) => [field, entry[field]]))) }
    if (request.path === '/sales_customers') return { data: customers }
    throw new Error(`unexpected path ${request.path}`)
  }
})
result = await unavailableMatcher.analyze(user, { file_ids: [id(25)] })
assert.equal(result.results[0].analysis_mode, 'vision_unavailable')
assert.equal(result.results[0].content_understood, false)
assert.notEqual(result.results[0].status, 'matched', 'OCR failures must require confirmation')

files.set(id(3), file(3, '客户名称：雅御科技'))
result = await analyze([id(3)])
assert.equal(result.results[0].status, 'needs_confirmation', 'multiple equal candidates require confirmation')
assert.equal(result.results[0].candidates.length, 2)

files.set(id(4), file(4, '供应商编号 UNKNOWN-999'))
result = await analyze([id(4)])
assert.equal(result.results[0].status, 'unmatched')
assert.equal(result.results[0].confidence, 0)

const batchIds = Array.from({ length: MAX_FILES }, (_, index) => id(index + 10))
batchIds.forEach((fileId, index) => files.set(fileId, file(index + 10, `无匹配文件 ${index}`)))
result = await analyze(batchIds)
assert.equal(result.total, MAX_FILES)
assert.equal(result.results.every((entry) => entry.status === 'unmatched'), true)
await assert.rejects(() => analyze([...batchIds, id(999)]), /file_ids must contain 1-100/)

files.set(id(1000), file(1000, '客户编号 YA-001', { tenant_id: 'other-tenant' }))
await assert.rejects(() => analyze([id(1000)]), (error) => error.code === 'HARNESS_CUSTOMER_FILE_NOT_FOUND' && error.httpStatus === 404)

files.set(id(1001), { ...file(1001, '客户编号 YA-001'), size_bytes: 100 * 1024 * 1024 + 1 })
await assert.rejects(() => analyze([id(1001)]), (error) => error.code === 'HARNESS_CUSTOMER_FILE_INVALID' && error.httpStatus === 400)

assert.equal(calls.filter((request) => request.path === '/sales_customers').length > 0, true)
console.log('PASS: Yayu customer file matcher analyzes, classifies, bounds, and preserves write confirmation')
