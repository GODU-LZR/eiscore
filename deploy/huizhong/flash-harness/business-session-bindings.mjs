import { createHash, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SESSION_RE = /^[A-Za-z0-9._:-]{1,256}$/
const equalSecret = (received, expected) => {
  const left = Buffer.from(String(received || ''))
  const right = Buffer.from(String(expected || ''))
  return right.length >= 32 && left.length === right.length && timingSafeEqual(left, right)
}

export function createBusinessSessionBindings({ tokenForRequest, claimsForToken, ownerFile = join(process.env.DSH_HOME || '/var/lib/dsh', 'eiscore-session-owners.json') }) {
  const owners = new Map(existsSync(ownerFile) ? Object.entries(JSON.parse(readFileSync(ownerFile, 'utf8'))) : [])
  const bindings = new Map()
  const reject = (status, code) => Response.json({ code }, { status, headers: { 'cache-control': 'no-store' } })
  const ownerFor = (token) => {
    const claims = claimsForToken(token)
    return claims.id && claims.tenant_id ? createHash('sha256').update(JSON.stringify([claims.tenant_id, claims.id])).digest('hex') : ''
  }
  const save = () => {
    writeFileSync(ownerFile + '.tmp', JSON.stringify(Object.fromEntries(owners)), { mode: 0o600 })
    renameSync(ownerFile + '.tmp', ownerFile)
  }
  return {
    async bind(request) {
      if (!equalSecret(request.headers.get('x-eis-bind-secret'), process.env.EISCORE_TOOL_PROXY_SECRET)) return reject(403, 'EISCORE_BIND_FORBIDDEN')
      const token = tokenForRequest(request)
      const owner = token && ownerFor(token)
      if (!owner) return reject(401, 'EISCORE_AUTH_REQUIRED')
      let body
      try { body = await request.json() } catch { return reject(400, 'BAD_REQUEST') }
      const sessionId = String(body?.session_id || '')
      if (!SESSION_RE.test(sessionId)) return reject(400, 'INVALID_SESSION_ID')
      const current = owners.get(sessionId)
      if ((current && current !== owner) || (!current && body.created !== true)) return reject(403, 'EISCORE_SESSION_OWNERSHIP_DENIED')
      if (!current) {
        if (owners.size >= 10000) return reject(503, 'EISCORE_SESSION_LIMIT')
        owners.set(sessionId, owner)
        save()
      }
      bindings.set(sessionId, { owner, cookie: request.headers.get('cookie') || '' })
      return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
    },
    toolToken(sessionId) {
      const binding = bindings.get(String(sessionId || ''))
      if (!binding) return ''
      const token = tokenForRequest(new Request('http://dsh.internal/', { headers: { cookie: binding.cookie } }))
      if (!token || ownerFor(token) !== binding.owner) {
        bindings.delete(sessionId)
        return ''
      }
      return token
    }
  }
}
