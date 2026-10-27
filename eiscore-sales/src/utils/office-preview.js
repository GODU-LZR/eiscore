// Read-only Office previews for the sales customer archive attachment column.
// The loader is injected into the shared FileDialog so other qiankun packages
// do not inherit sales-only parser dependencies.

const MAX_TEXT_CHARS = 12000
const MAX_ROWS = 40
const MAX_COLUMNS = 16

const extensionOf = (item) => String(item?.ext || item?.name || '')
  .toLowerCase()
  .split('.')
  .pop()

const arrayBufferFromDataUrl = (value) => {
  const source = String(value || '')
  const comma = source.indexOf(',')
  if (comma < 0) return null
  const binary = atob(source.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

const textFromArrayBuffer = (arrayBuffer) => {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer)
  } catch {
    return ''
  }
}

export async function loadSalesOfficePreview({ item, dataUrl } = {}) {
  const extension = extensionOf(item)
  const arrayBuffer = arrayBufferFromDataUrl(dataUrl)
  if (!arrayBuffer) return null

  if (['md', 'txt', 'csv'].includes(extension)) {
    const text = textFromArrayBuffer(arrayBuffer).replace(/\u0000/g, '').trim().slice(0, MAX_TEXT_CHARS)
    return text ? { kind: 'text', text } : null
  }

  if (extension === 'docx') {
    const module = await import('mammoth')
    const result = await module.extractRawText({ arrayBuffer })
    const text = String(result?.value || '').replace(/\u0000/g, '').trim().slice(0, MAX_TEXT_CHARS)
    return text ? { kind: 'text', text } : null
  }

  if (extension === 'xls' || extension === 'xlsx') {
    const module = await import('xlsx')
    const XLSX = module.default || module
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
    const sheets = []
    for (const name of workbook.SheetNames || []) {
      if (sheets.length >= 8) break
      const sheet = workbook.Sheets[name]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
        .slice(0, MAX_ROWS)
        .map((row) => (Array.isArray(row) ? row.slice(0, MAX_COLUMNS).map((cell) => String(cell ?? '').slice(0, 500)) : []))
        .filter((row) => row.some(Boolean))
      if (rows.length) sheets.push({ name: String(name).slice(0, 120), rows })
    }
    return sheets.length ? { kind: 'table', sheets } : null
  }

  return null
}

