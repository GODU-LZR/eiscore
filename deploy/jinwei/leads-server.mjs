import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT || 8093)
const DATA_FILE = process.env.DATA_FILE || '/var/lib/jinwei/leads.json'
const MAX_BODY_BYTES = 128 * 1024
const MAX_LEADS = 5000
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 60 * 1000
const rateBuckets = new Map()
let records = []
let writeQueue = Promise.resolve()

const text = (value, max) => String(value ?? '').trim().slice(0, max)
const json = (res, status, payload, headers = {}) => {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(body)
}
const hash = (value) => createHash('sha256').update(String(value)).digest('hex')
const clientKey = (req) => hash(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown')
const now = () => new Date().toISOString()

const persist = () => {
  writeQueue = writeQueue.then(async () => {
    await mkdir(dirname(DATA_FILE), { recursive: true })
    const temporary = `${DATA_FILE}.tmp`
    await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, DATA_FILE)
  })
  return writeQueue
}

const load = async () => {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8'))
    if (Array.isArray(parsed)) records = parsed.slice(-MAX_LEADS)
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('lead store could not be read')
  }
}

const readJson = (req) => new Promise((resolve, reject) => {
  let size = 0
  let body = ''
  req.setEncoding('utf8')
  req.on('data', (chunk) => {
    size += Buffer.byteLength(chunk)
    if (size > MAX_BODY_BYTES) {
      reject(Object.assign(new Error('payload too large'), { code: 'PAYLOAD_TOO_LARGE' }))
      req.destroy()
      return
    }
    body += chunk
  })
  req.on('end', () => {
    try { resolve(JSON.parse(body || '{}')) } catch { reject(Object.assign(new Error('invalid json'), { code: 'BAD_REQUEST' })) }
  })
  req.on('error', reject)
})

const allowed = (req) => {
  const key = clientKey(req)
  const timestamp = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || timestamp - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: timestamp, count: 1 })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count += 1
  return true
}

const normalizeLead = (body, req) => {
  const consent = body?.consent && typeof body.consent === 'object' ? body.consent : {}
  const consentAccepted = body?.consent === true || consent.accepted === true || consent.accepted === 'true'
  const productSlugs = Array.isArray(body?.productSlugs || body?.product_slugs)
    ? (body.productSlugs || body.product_slugs).map((item) => text(item, 80)).filter(Boolean).slice(0, 20)
    : []
  const source = text(body?.source, 80) || 'website'
  const email = text(body?.email, 240).toLowerCase()
  const phone = text(body?.phone, 80)
  const whatsapp = text(body?.whatsapp, 80)
  const companyName = text(body?.companyName || body?.company_name, 200)
  const contactName = text(body?.contactName || body?.contact_name, 120)
  const pagePath = text(body?.pagePath || body?.page_path, 500)
  const message = text(body?.message, 4000)
  const rawKey = text(body?.idempotencyKey || body?.idempotency_key || req.headers['idempotency-key'], 160)
  const idempotencyKey = rawKey || hash(JSON.stringify({ source, email, phone, whatsapp, companyName, productSlugs, message, day: now().slice(0, 10), ip: clientKey(req) }))
  return {
    source,
    locale: text(body?.locale, 20) || 'zh-CN',
    pagePath,
    companyName,
    contactName,
    email,
    phone,
    whatsapp,
    country: text(body?.country, 100),
    productSlugs,
    quantity: text(body?.quantity, 120),
    targetDate: text(body?.targetDate || body?.target_date, 80),
    message,
    consent: { ...consent, accepted: true, acceptedAt: now() },
    consentAccepted,
    idempotencyKey,
    ipHash: clientKey(req)
  }
}

const createLead = async (req, res) => {
  if (!allowed(req)) return json(res, 429, { code: 'RATE_LIMITED', message: 'Too many requests' })
  let body
  try {
    body = await readJson(req)
  } catch (error) {
    return json(res, error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { code: error.code || 'BAD_REQUEST', message: error.message })
  }
  const lead = normalizeLead(body, req)
  if (!lead.consentAccepted) return json(res, 400, { code: 'CONSENT_REQUIRED', message: 'Consent is required before submitting an inquiry' })
  if (!lead.email && !lead.phone && !lead.whatsapp) return json(res, 400, { code: 'CONTACT_REQUIRED', message: 'Email, phone or WhatsApp is required' })
  if (!lead.contactName && !lead.companyName) return json(res, 400, { code: 'IDENTITY_REQUIRED', message: 'Contact name or company name is required' })

  const existing = records.find((item) => item.idempotencyKey === lead.idempotencyKey)
  if (existing) return json(res, 200, { ok: true, deduplicated: true, lead: { publicRef: existing.publicRef, status: existing.status } })

  const created = {
    publicRef: `INQ-${now().slice(0, 10).replaceAll('-', '')}-${randomBytes(4).toString('hex').toUpperCase()}`,
    status: 'new',
    createdAt: now(),
    ...lead
  }
  records = [...records, created].slice(-MAX_LEADS)
  try {
    await persist()
  } catch {
    return json(res, 503, { code: 'LEAD_STORE_UNAVAILABLE', message: 'Inquiry service is temporarily unavailable' })
  }
  return json(res, 201, { ok: true, deduplicated: false, lead: { publicRef: created.publicRef, status: created.status, createdAt: created.createdAt } })
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'same-origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true, service: 'jinwei-leads', mode: 'trial', records: records.length })
  if (req.method === 'POST' && (req.url === '/company-site/public/leads' || req.url === '/agent/company-site/public/leads')) return createLead(req, res)
  return json(res, 404, { code: 'NOT_FOUND', message: 'Not found' })
})

await load()
server.listen(PORT, '0.0.0.0', () => console.log(`jinwei trial leads listening on ${PORT}`))

