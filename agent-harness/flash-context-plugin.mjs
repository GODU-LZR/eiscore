import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { readFileSync } from 'node:fs'

const CONTEXT_KEY = Symbol.for('eiscore.dsh.flash-context')
const AUTH_KEY = Symbol.for('eiscore.dsh.auth-bridge')
const contexts = globalThis[CONTEXT_KEY] instanceof Map ? globalThis[CONTEXT_KEY] : new Map()
globalThis[CONTEXT_KEY] = contexts

const APP_ID_RE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const SESSION_RE = /^[A-Za-z0-9._:-]{1,256}$/
const json = (code, status = 200, body = { code }) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store' }
})

const gatewayOrigin = () => {
  const value = String(process.env.FLASH_GATEWAY_ORIGIN || '').trim()
  try {
    const origin = new URL(value).origin
    const expected = 'http://flash-agent-runtime:8078'
    return origin === expected ? origin : ''
  } catch {
    return ''
  }
}

const flashSessionId = (appId) => `flash-${appId.replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 96)
const ownerForToken = (token) => {
  try {
    const claims = JSON.parse(Buffer.from(String(token).split('.')[1] || '', 'base64url').toString('utf8'))
    const userId = String(claims.sub || claims.username || '').trim()
    const tenantId = String(claims.tenant_id || claims.tenantId || '').trim()
    return userId && tenantId ? createHash('sha256').update(JSON.stringify([tenantId, userId])).digest('hex') : ''
  } catch {
    return ''
  }
}

const installToolTokenBridge = () => {
  const auth = globalThis[AUTH_KEY]
  if (typeof auth?.token !== 'function') throw new Error('EISCore auth bridge must be loaded before Flash context')
  auth.toolToken = (dshSessionId) => {
    const binding = contexts.get(String(dshSessionId || ''))
    if (!binding || binding.expiresAt <= Date.now()) {
      contexts.delete(String(dshSessionId || ''))
      return ''
    }
    const token = auth.token(new Request('http://dsh.internal/', { headers: { cookie: binding.cookie } }))
    if (!token || token !== binding.token) {
      contexts.delete(String(dshSessionId || ''))
      return ''
    }
    return token
  }
}
export { installToolTokenBridge }

export async function bindFlashContext(request) {
  let body
  try { body = await request.json() } catch { return json('BAD_REQUEST', 400) }
  const dshSessionId = String(body?.dshSessionId || '').trim()
  const appId = String(body?.appId || '').trim()
  const sessionId = flashSessionId(appId)
  if (!SESSION_RE.test(dshSessionId) || !APP_ID_RE.test(appId) || body?.sessionId !== sessionId) {
    return json('INVALID_FLASH_CONTEXT', 400)
  }

  // Invalidate a previous binding before re-checking ownership. This makes
  // logout/re-login fail closed even when the browser reuses a DSH session id.
  const previous = contexts.get(dshSessionId)
  const previousWasActive = Boolean(previous && previous.expiresAt > Date.now())
  if (previous) contexts.set(dshSessionId, { ...previous, token: '', expiresAt: 0 })
  const auth = globalThis[AUTH_KEY]
  const token = auth?.token?.(request)
  const owner = token && ownerForToken(token)
  if (!token || !owner) return json('FLASH_SESSION_OWNERSHIP_DENIED', 403)
  if (previous && (previous.owner !== owner || (previousWasActive && previous.token !== token))) {
    return json('FLASH_SESSION_OWNERSHIP_DENIED', 403)
  }
  if (previous && previous.appId !== appId) return json('FLASH_APP_OWNERSHIP_DENIED', 403)

  const origin = gatewayOrigin()
  if (!origin) return json('FLASH_GATEWAY_INVALID', 503)
  try {
    const registration = await fetch(new URL('/internal/harness/session', origin), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, app_id: appId }),
      signal: AbortSignal.timeout(15000)
    })
    if (!registration.ok) {
      return json('FLASH_APP_ACCESS_DENIED', [400, 401, 403, 409].includes(registration.status) ? registration.status : 503)
    }
    contexts.set(dshSessionId, {
      sessionId, appId, token, owner,
      cookie: request.headers.get('cookie') || '',
      expiresAt: Date.now() + 30 * 60 * 1000
    })
    while (contexts.size > 256) contexts.delete(contexts.keys().next().value)
    return json(undefined, 200, { ok: true })
  } catch {
    return json('FLASH_REGISTRATION_UNAVAILABLE', 503)
  }
}

export const inject = ['connection', 'webServer']

export function apply(ctx) {
  installToolTokenBridge()
  const ui = readFileSync(new URL('./flash-ui.js', import.meta.url), 'utf8')
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/eiscore/flash/ui.js',
    methods: ['GET'],
    fetch: () => new Response(ui, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' } })
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/eiscore/flash/context',
    handler: async (req, res) => {
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) { res.writeHead(rejection).end(); return }
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += part.length
        if (size > 4096) { res.writeHead(413, { connection: 'close' }).end(); req.resume(); return }
        chunks.push(part)
      }
      const request = new Request('http://dsh.internal/api/eiscore/flash/context', {
        method: 'POST',
        headers: { cookie: req.headers.cookie || '' },
        body: Buffer.concat(chunks)
      })
      const result = await bindFlashContext(request)
      res.writeHead(result.status, Object.fromEntries(result.headers))
      await pipeline(Readable.from(result.body), res)
    }
  }), 'eiscore: flash context')
}

export { contexts }
