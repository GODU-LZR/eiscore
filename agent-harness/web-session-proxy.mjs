import http from 'node:http'

const MAX_BODY = 32 * 1024 * 1024
const readBody = async (request) => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('BODY_TOO_LARGE')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const upstream = (path, headers, body, withToken, port) => new Promise((resolve, reject) => {
  const request = http.request({
    hostname: '127.0.0.1', port, method: 'POST', path: withToken(path, headers),
    headers: { ...headers, 'accept-encoding': 'identity', 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
  }, (response) => {
    const chunks = []
    response.on('data', (chunk) => chunks.push(chunk))
    response.on('end', () => resolve({ status: response.statusCode || 502, headers: response.headers, body: Buffer.concat(chunks) }))
    response.on('error', reject)
  })
  request.on('error', reject)
  request.end(body)
})

export function createBusinessSessionProxy({ withToken, forward, mapCookies, port = 3080, flash = process.env.EISCORE_HARNESS_CAPABILITY_PROFILE === 'flash' }) {
  return async (request, response, headers = request.headers, bootstrapCookies = []) => {
    const path = String(request.url || '/').split('?', 1)[0]
    if (request.method !== 'POST' || !['/api/session/create', '/api/session/prompt'].includes(path)) {
      return forward(request, response, headers, bootstrapCookies)
    }
    const fail = (status, code) => response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ code }))
    try {
      const body = await readBody(request)
      const message = JSON.parse(body.toString('utf8'))
      const input = message?.payload?.args?.request
      if (message?.type !== 'client-request' || message.method !== path.slice(5) || !input || typeof input !== 'object' || Array.isArray(input)) return fail(400, 'BAD_REQUEST')
      const appId = String(headers['x-eis-flash-app-id'] || '')
      const flashSessionId = String(headers['x-eis-flash-session-id'] || '')
      if (flash && (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(appId) || flashSessionId !== `flash-${appId.replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 96))) return fail(400, 'INVALID_FLASH_CONTEXT')
      const bind = (sessionId, created) => upstream('/api/eiscore/auth/bind-session', {
        ...headers, 'x-eis-bind-secret': String(process.env.EISCORE_TOOL_PROXY_SECRET || '')
      }, JSON.stringify({ session_id: sessionId, created }), withToken, port)
      const bindFlash = (sessionId) => upstream('/api/eiscore/flash/context', headers,
        JSON.stringify({ dshSessionId: sessionId, appId, sessionId: flashSessionId }), withToken, port)
      if (path === '/api/session/create') {
        if (['sessionId', 'cwd', 'agentPreset'].some((key) => Object.hasOwn(input, key))) return fail(400, 'EISCORE_SESSION_CREATE_INVALID')
      } else {
        const result = await bind(String(input.sessionId || ''), false)
        if (result.status !== 200) return fail(result.status, 'EISCORE_SESSION_OWNERSHIP_DENIED')
        if (flash) {
          const checked = await bindFlash(String(input.sessionId || ''))
          if (checked.status !== 200) return fail(checked.status, 'FLASH_CONTEXT_REQUIRED')
        }
      }
      const result = await upstream(path, headers, body, withToken, port)
      if (path === '/api/session/create' && result.status === 200) {
        const envelope = JSON.parse(result.body.toString('utf8'))
        if (envelope.result?.ok) {
          const bound = await bind(String(envelope.result.value?.sessionId || ''), true)
          if (bound.status !== 200) return fail(bound.status, 'EISCORE_SESSION_BIND_FAILED')
          if (flash) {
            const assigned = await bindFlash(String(envelope.result.value?.sessionId || ''))
            if (assigned.status !== 200) return fail(assigned.status, 'FLASH_CONTEXT_REQUIRED')
          }
        }
      }
      const responseHeaders = { ...result.headers, 'content-length': result.body.length }
      delete responseHeaders['transfer-encoding']
      delete responseHeaders['content-encoding']
      const values = result.headers['set-cookie'] || []
      const cookies = mapCookies([...bootstrapCookies, ...(Array.isArray(values) ? values : [values])])
      if (cookies.length) responseHeaders['set-cookie'] = cookies
      response.writeHead(result.status, responseHeaders)
      response.end(result.body)
    } catch (error) {
      if (!response.headersSent) fail(error?.message === 'BODY_TOO_LARGE' ? 413 : 502, 'EISCORE_SESSION_UNAVAILABLE')
      else response.destroy()
    }
  }
}
