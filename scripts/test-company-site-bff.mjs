// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import http, { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const realtimeRequire = createRequire(resolve(repoRoot, 'realtime/package.json'))
const { Pool } = realtimeRequire('pg')
const jwt = realtimeRequire('jsonwebtoken')
const { createCompanySiteHandlers } = require('../realtime/company-site.js')
const { createCompanySalesHandlers } = require('../realtime/company-sales-agent.js')
const { createCompanyHttpModule } = require('../realtime/company-http.js')
const { createHttpRequestHandler } = require('../realtime/http-router.js')

const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`
const dbContainer = `eiscore-db6-bff-db-${suffix}`
const networkName = `eiscore-db6-bff-net-${suffix}`
const postgresImage = 'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f'
const rootPassword = randomBytes(32).toString('base64url')
const postgrestPassword = randomBytes(32).toString('base64url')
const agentPassword = randomBytes(32).toString('base64url')
const jwtSecret = randomBytes(40).toString('base64url')
const domainBefore = 'db6-before.example.test'
const domainAfter = 'db6-after.example.test'
const maxOutput = 128 * 1024 * 1024

const execute = (program, args, { input, allowFailure = false, timeout = 300_000 } = {}) => {
  const result = spawnSync(program, args, {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
    maxBuffer: maxOutput,
    timeout,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${program} ${args.slice(0, 4).join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result
}
const docker = (args, options) => execute('docker', args, options)
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const availablePort = () => new Promise((resolvePromise, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const port = probe.address().port
    probe.close((error) => error ? reject(error) : resolvePromise(port))
  })
})
const waitForDatabase = async () => {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = docker(['exec', dbContainer, 'pg_isready', '-U', 'postgres', '-d', 'eiscore'], { allowFailure: true })
    if (ready.status === 0) return
    await sleep(250)
  }
  throw new Error('isolated DB6 company-site database did not become ready')
}
const psql = (sql) => docker([
  'exec', '-i', dbContainer, 'psql', '-v', 'ON_ERROR_STOP=1', '-At',
  '-U', 'postgres', '-d', 'eiscore'
], { input: sql })
const mount = (repoPath, containerPath) => `${resolve(repoRoot, repoPath)}:${containerPath}:ro`

const getRequestPath = (req) => {
  const rawPath = String(req?.url || '/').split('?')[0] || '/'
  if (rawPath === '/agent') return '/'
  return rawPath.startsWith('/agent/') ? rawPath.slice('/agent'.length) : rawPath
}
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
}
const sendJson = (res, status, payload, extraHeaders = {}) => {
  setCorsHeaders(res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders })
  res.end(JSON.stringify(payload || {}))
}
const sendText = (res, status, payload, extraHeaders = {}) => {
  setCorsHeaders(res)
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders })
  res.end(String(payload || ''))
}
const readJsonBody = (req, maxBytes = 25 * 1024 * 1024) => new Promise((resolvePromise, reject) => {
  const chunks = []
  let bytes = 0
  req.on('data', (chunk) => {
    bytes += chunk.length
    if (bytes > maxBytes) {
      reject(new Error('Payload too large'))
      req.destroy()
      return
    }
    chunks.push(chunk)
  })
  req.on('end', () => {
    try {
      resolvePromise(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
    } catch {
      reject(new Error('Invalid JSON body'))
    }
  })
  req.on('error', reject)
})
const bearer = (req) => String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
const asUser = (payload, token) => ({
  id: payload?.user_id || payload?.sub || payload?.username || payload?.email || '',
  username: payload?.username || '',
  role: payload?.app_role || payload?.role || '',
  permissions: Array.isArray(payload?.permissions) ? payload.permissions.map(String) : [],
  token
})

const request = ({ port, path, method = 'GET', token = '', body, host = domainAfter }) => new Promise((resolvePromise, reject) => {
  const payload = body === undefined ? '' : JSON.stringify(body)
  const headers = { Host: host, Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (payload) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = Buffer.byteLength(payload)
  }
  const outgoing = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (response) => {
    const chunks = []
    response.on('data', (chunk) => chunks.push(chunk))
    response.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      let parsed = raw
      try { parsed = raw ? JSON.parse(raw) : null } catch {}
      resolvePromise({ status: response.statusCode, body: parsed, raw })
    })
  })
  outgoing.once('error', reject)
  if (payload) outgoing.write(payload)
  outgoing.end()
})

let pool
let server
try {
  docker(['version'])
  const databasePort = await availablePort()
  docker(['network', 'create', networkName])
  docker([
    'run', '-d', '--name', dbContainer, '--network', networkName, '--read-only',
    '-p', `127.0.0.1:${databasePort}:5432`,
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=2g',
    '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--shm-size', '256m',
    '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore',
    '-e', `POSTGRES_PASSWORD=${rootPassword}`,
    '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
    '-e', `POSTGREST_DB_PASSWORD=${postgrestPassword}`,
    '-e', `AGENT_DB_PASSWORD=${agentPassword}`,
    '-v', mount('database/bootstrap/roles-v2.sql', '/docker-entrypoint-initdb.d/00_roles.sql'),
    '-v', mount('database/baselines/eiscore-db-v1/schema.sql', '/docker-entrypoint-initdb.d/01_schema.sql'),
    '-v', mount('database/baselines/eiscore-db-v1/register.sql', '/docker-entrypoint-initdb.d/02_register.sql'),
    '-v', mount('scripts/configure-database-runtime-secrets-v2.sh', '/docker-entrypoint-initdb.d/03_runtime_secrets.sh'),
    postgresImage
  ])
  await waitForDatabase()

  const migration = execute(process.execPath, [
    'scripts/apply-runtime-migrations.mjs', '--manifest', 'database/migrations/core.json',
    '--db-container', dbContainer, '--db-name', 'eiscore', '--db-user', 'postgres',
    '--backup-evidence', 'isolated://db6-company-site-bff', '--release-revision', 'db6-bff-test',
    '--operator', 'db6-company-site-bff-test'
  ])
  assert.match(migration.stdout, /core migration execution passed: 3 applied, 1 skipped/)

  psql(`
    INSERT INTO company_site.site_config (
      site_key, legal_name, brand_name, brand_short_name, factory_name,
      domain, default_locale, enabled_locales, status, published_version,
      published_at, published_by
    ) VALUES (
      'primary', 'DB6 治理测试企业', '治理前品牌', '治理前', 'DB6 工厂',
      '${domainBefore}', 'zh-CN', '["zh-CN"]'::jsonb, 'published', 1,
      now(), 'db6-seed'
    );
    INSERT INTO company_site.site_locales (site_key, locale, status)
    VALUES ('primary', 'zh-CN', 'published');
    INSERT INTO company_site.knowledge_documents (
      site_key, locale, document_type, title, content, status, version
    ) VALUES (
      'primary', 'zh-CN', 'faq', '交期说明', '交期需要根据产品数量由销售人员确认。', 'published', 1
    );
  `)

  pool = new Pool({
    host: '127.0.0.1', port: databasePort, user: 'eiscore_agent',
    password: agentPassword, database: 'eiscore', max: 5
  })
  const identity = await pool.query('SELECT session_user, current_user')
  assert.deepEqual(identity.rows[0], { session_user: 'eiscore_agent', current_user: 'eiscore_agent' })
  await assert.rejects(
    pool.query("INSERT INTO company_site.leads (public_ref, site_key, company_name) VALUES ('db6-secondary', 'secondary', 'forbidden')"),
    /row-level security|check constraint/i
  )

  const query = (sql, params) => pool.query(sql, params)
  const siteHandlers = createCompanySiteHandlers({ query, sendJson, sendText, readJsonBody })
  const salesHandlers = createCompanySalesHandlers({ query, sendJson, readJsonBody })
  const company = createCompanyHttpModule({
    companySiteHandlers: siteHandlers,
    companySalesHandlers: salesHandlers,
    getRequestPath,
    getBearerFromAuthHeader: bearer,
    verifyToken: (token) => {
      try { return jwt.verify(token, jwtSecret) } catch { return null }
    },
    asUser,
    readJsonBody,
    sendJson
  })
  server = createServer(createHttpRequestHandler({
    routes: company.routes,
    getRequestPath,
    setCorsHeaders,
    authorizers: company.authorizers,
    handlers: { company: company.handlers }
  }))
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const port = server.address().port
  const adminToken = jwt.sign({ sub: 'db6-admin', username: 'db6-admin', app_role: 'company_site_admin' }, jwtSecret, { expiresIn: 300 })
  const salesToken = jwt.sign({ sub: 'db6-sales', username: 'db6-sales', app_role: 'sales' }, jwtSecret, { expiresIn: 300 })
  const approverToken = jwt.sign({ sub: 'db6-manager', username: 'db6-manager', app_role: 'sales_manager' }, jwtSecret, { expiresIn: 300 })

  const publicBefore = await request({ port, path: '/agent/company-site/public/site-config', host: domainBefore })
  assert.equal(publicBefore.status, 200, publicBefore.raw)
  assert.equal(publicBefore.body.site.brandName, '治理前品牌')
  assert.equal(publicBefore.body.site.publishedVersion, 1)

  const deniedAdmin = await request({ port, path: '/agent/company-site/admin/site-config', host: domainBefore })
  assert.equal(deniedAdmin.status, 401)
  const adminBefore = await request({ port, path: '/agent/company-site/admin/site-config', token: adminToken, host: domainBefore })
  assert.equal(adminBefore.status, 200, adminBefore.raw)
  assert.equal(adminBefore.body.site.brandName, '治理前品牌')

  const draft = await request({
    port, path: '/agent/company-site/admin/site-config', method: 'PATCH', token: adminToken, host: domainBefore,
    body: { brandName: '治理后品牌', domain: domainAfter }
  })
  assert.equal(draft.status, 200, draft.raw)
  assert.equal(draft.body.status, 'draft')
  const publicDuringDraft = await request({ port, path: '/agent/company-site/public/site-config', host: domainBefore })
  assert.equal(publicDuringDraft.status, 200, publicDuringDraft.raw)
  assert.equal(publicDuringDraft.body.site.brandName, '治理前品牌')
  const unpublishedDomain = await request({ port, path: '/agent/company-site/public/site-config', host: domainAfter })
  assert.equal(unpublishedDomain.status, 404, unpublishedDomain.raw)

  const publish = await request({
    port, path: '/agent/company-site/admin/content/publish', method: 'POST', token: adminToken, host: domainAfter,
    body: { objectType: 'site_config', id: 'primary', status: 'published' }
  })
  assert.equal(publish.status, 200, publish.raw)
  assert.equal(publish.body.item.published_version, 2)
  const publicAfter = await request({ port, path: '/agent/company-site/public/site-config', host: domainAfter })
  assert.equal(publicAfter.status, 200, publicAfter.raw)
  assert.equal(publicAfter.body.site.brandName, '治理后品牌')
  assert.equal(publicAfter.body.site.publishedVersion, 2)
  const retiredDomain = await request({ port, path: '/agent/company-site/public/site-config', host: domainBefore })
  assert.equal(retiredDomain.status, 404, retiredDomain.raw)

  const inquiryBody = {
    idempotencyKey: 'db6-public-inquiry', companyName: 'DB6 采购企业', contactName: '公开询盘联系人',
    email: 'public-inquiry@example.test', products: ['governed-product'], quantity: '100',
    message: '需要报价', consent: { accepted: true }
  }
  const inquiry = await request({
    port, path: '/agent/company-site/public/leads', method: 'POST', host: domainAfter, body: inquiryBody
  })
  assert.equal(inquiry.status, 201, inquiry.raw)
  assert.match(inquiry.body.lead.publicRef, /^INQ-/)
  const inquiryRepeat = await request({
    port, path: '/agent/company-site/public/leads', method: 'POST', host: domainAfter, body: inquiryBody
  })
  assert.equal(inquiryRepeat.status, 200, inquiryRepeat.raw)
  assert.equal(inquiryRepeat.body.deduplicated, true)
  const leadList = await request({ port, path: '/agent/company-site/admin/leads', token: adminToken, host: domainAfter })
  assert.equal(leadList.status, 200, leadList.raw)
  assert.ok(leadList.body.items.some((item) => item.public_ref === inquiry.body.lead.publicRef))

  const session = await request({
    port, path: '/agent/sales/sessions', method: 'POST', host: domainAfter,
    body: { locale: 'zh-CN', visitorId: 'db6-visitor', consent: { accepted: true } }
  })
  assert.equal(session.status, 201, session.raw)
  const sessionId = session.body.session.id
  const message = await request({
    port, path: `/agent/sales/sessions/${sessionId}/messages`, method: 'POST', host: domainAfter,
    body: { message: '请问交期如何确认？' }
  })
  assert.equal(message.status, 200, message.raw)
  assert.equal(message.body.needsHuman, false)
  assert.equal(message.body.citations[0].title, '交期说明')

  const agentLead = await request({
    port, path: `/agent/sales/sessions/${sessionId}/leads`, method: 'POST', host: domainAfter,
    body: {
      idempotencyKey: 'db6-agent-lead', companyName: 'DB6 Agent 客户', contactName: 'Agent 联系人',
      email: 'agent-lead@example.test', productSlugs: ['governed-product'], quantity: '50', message: '需要销售跟进'
    }
  })
  assert.equal(agentLead.status, 201, agentLead.raw)
  const leadId = agentLead.body.lead.id
  const qualified = await request({
    port, path: `/agent/sales/leads/${leadId}/qualify`, method: 'POST', token: salesToken, host: domainAfter,
    body: { score: 88, reasons: ['需求明确', '联系方式有效'] }
  })
  assert.equal(qualified.status, 200, qualified.raw)
  assert.equal(qualified.body.lead.status, 'qualified')
  const opportunity = await request({
    port, path: `/agent/sales/leads/${leadId}/opportunity-draft`, method: 'POST', token: salesToken, host: domainAfter,
    body: {
      idempotencyKey: 'db6-opportunity', productItems: [{ slug: 'governed-product', quantity: 50 }],
      estimatedAmount: 50000, currency: 'CNY', stage: '需求确认'
    }
  })
  assert.equal(opportunity.status, 201, opportunity.raw)
  const opportunityId = opportunity.body.opportunity.id
  const deniedApproval = await request({
    port, path: `/agent/sales/drafts/opportunity/${opportunityId}/approval`, method: 'POST', token: salesToken,
    host: domainAfter, body: { decision: 'approve' }
  })
  assert.equal(deniedApproval.status, 403, deniedApproval.raw)
  const approved = await request({
    port, path: `/agent/sales/drafts/opportunity/${opportunityId}/approval`, method: 'POST', token: approverToken,
    host: domainAfter, body: { decision: 'approve', comment: 'DB6 隔离审批通过' }
  })
  assert.equal(approved.status, 200, approved.raw)
  assert.equal(approved.body.item.approval_status, 'approved')
  const quote = await request({
    port, path: `/agent/sales/opportunities/${opportunityId}/quote-draft`, method: 'POST', token: salesToken,
    host: domainAfter,
    body: { idempotencyKey: 'db6-quote', currency: 'CNY', items: [{ slug: 'governed-product', quantity: 50, amount: 50000 }] }
  })
  assert.equal(quote.status, 201, quote.raw)
  assert.equal(quote.body.quote.approval_status, 'draft')

  const persisted = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM company_site.leads) AS leads,
      (SELECT count(*)::int FROM company_site.agent_sessions) AS sessions,
      (SELECT count(*)::int FROM company_site.agent_messages) AS messages,
      (SELECT count(*)::int FROM company_site.opportunity_drafts) AS opportunities,
      (SELECT count(*)::int FROM company_site.quote_drafts) AS quotes
  `)
  assert.deepEqual(persisted.rows[0], { leads: 2, sessions: 1, messages: 2, opportunities: 1, quotes: 1 })
  assert.equal(Number(psql(`SELECT count(*) FROM pg_stat_activity WHERE usename = 'eiscore_agent';`).stdout.trim()) >= 1, true)

  console.log('PASS: isolated company-site BFF uses real eiscore_agent for public, admin, publish, inquiry and sales Agent HTTP chains')
} finally {
  if (server) await new Promise((resolvePromise) => server.close(resolvePromise))
  if (pool) await pool.end()
  docker(['rm', '-f', dbContainer], { allowFailure: true })
  docker(['network', 'rm', networkName], { allowFailure: true })
}
