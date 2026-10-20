import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { readFileSync } from 'node:fs'

const KEY = Symbol.for('eiscore.dsh.flash-context')
const AUTH_KEY = Symbol.for('eiscore.dsh.auth-bridge')
const contexts = globalThis[KEY] instanceof Map ? globalThis[KEY] : new Map()
globalThis[KEY] = contexts

const response = (code, status) => Response.json({ code }, { status, headers: { 'cache-control': 'no-store' } })
export async function bindFlashContext(request) {
  let body
  try { body = await request.json() } catch { return response('BAD_REQUEST', 400) }
  const dshSessionId = String(body?.dshSessionId || '').trim()
  const appId = String(body?.appId || '').trim()
  const sessionId = `flash-${appId.replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 96)
  if (!/^[A-Za-z0-9._:-]{1,256}$/.test(dshSessionId) || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(appId) || body?.sessionId !== sessionId) {
    return response('INVALID_FLASH_CONTEXT', 400)
  }
  const previous = contexts.get(dshSessionId)
  if (previous) contexts.set(dshSessionId, { ...previous, token: '', expiresAt: 0 })
  const auth = globalThis[AUTH_KEY]
  const token = auth?.token?.(request)
  if (!token || auth?.toolToken?.(dshSessionId) !== token) return response('FLASH_SESSION_OWNERSHIP_DENIED', 403)
  if (previous && previous.appId !== appId) return response('FLASH_APP_OWNERSHIP_DENIED', 403)
  try {
    const origin = new URL(process.env.EISCORE_GATEWAY_URL || '')
    if (origin.origin !== 'http://flash-agent:8078') return response('FLASH_GATEWAY_INVALID', 503)
    const registration = await fetch(new URL('/internal/harness/session', origin), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, app_id: appId }),
      signal: AbortSignal.timeout(15000)
    })
    if (!registration.ok) return response('FLASH_APP_ACCESS_DENIED', [400, 401, 403, 409].includes(registration.status) ? registration.status : 503)
    contexts.set(dshSessionId, { sessionId, appId, token, expiresAt: Date.now() + 30 * 60 * 1000 })
    while (contexts.size > 256) contexts.delete(contexts.keys().next().value)
    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch { return response('FLASH_REGISTRATION_UNAVAILABLE', 503) }
}

export const inject = ['connection', 'webServer']
export function apply(ctx) {
  const ui = readFileSync(new URL('./flash-ui.js', import.meta.url), 'utf8')
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/eiscore/flash/ui.js', methods: ['GET'], fetch: () => new Response(ui, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' } }) }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/api/eiscore/flash/context',
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
      const request = new Request('http://dsh.internal/api/eiscore/flash/context', { method: 'POST', headers: { cookie: req.headers.cookie || '' }, body: Buffer.concat(chunks) })
      const result = await bindFlashContext(request)
      res.writeHead(result.status, Object.fromEntries(result.headers))
      await pipeline(Readable.from(result.body), res)
    }
  }), 'eiscore: flash context')
}
