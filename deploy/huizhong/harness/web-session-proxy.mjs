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

export function createBusinessSessionProxy({ withToken, forward, mapCookies, port = 3080 }) {
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
      const entry = headers['x-eis-business-entry']
      if (entry !== undefined && !['worker', 'workbench'].includes(entry)) return fail(400, 'INVALID_BUSINESS_ENTRY')
      const bind = (sessionId, created) => upstream('/api/eiscore/auth/bind-session', {
        ...headers, 'x-eis-bind-secret': String(process.env.EISCORE_TOOL_PROXY_SECRET || '')
      }, JSON.stringify({ session_id: sessionId, created }), withToken, port)
      const role = (value) => upstream('/api/eiscore/business/role', {
        ...headers, 'x-eis-bind-secret': String(process.env.EISCORE_TOOL_PROXY_SECRET || '')
      }, JSON.stringify({ ...value, entry }), withToken, port)
      if (path === '/api/session/create') {
        if (['sessionId', 'cwd', 'agentPreset'].some((key) => Object.hasOwn(input, key))) return fail(400, 'EISCORE_SESSION_CREATE_INVALID')
        if (entry) {
          if (Object.keys(input).some((key) => key !== 'workspaceId')) return fail(400, 'EISCORE_SESSION_CREATE_INVALID')
          const checked = await role({ workspace_id: input.workspaceId || '' })
          if (checked.status !== 200) return fail(checked.status, 'EISCORE_BUSINESS_WORKSPACE_REQUIRED')
        }
      } else {
        const result = await bind(String(input.sessionId || ''), false)
        if (result.status !== 200) return fail(result.status, 'EISCORE_SESSION_OWNERSHIP_DENIED')
        if (entry) {
          const checked = await role({ session_id: String(input.sessionId || ''), created: false })
          if (checked.status !== 200) return fail(checked.status, 'EISCORE_SESSION_ROLE_MISMATCH')
        }
      }
      const result = await upstream(path, headers, body, withToken, port)
      if (path === '/api/session/create' && result.status === 200) {
        const envelope = JSON.parse(result.body.toString('utf8'))
        if (envelope.result?.ok) {
          const bound = await bind(String(envelope.result.value?.sessionId || ''), true)
          if (bound.status !== 200) return fail(bound.status, 'EISCORE_SESSION_BIND_FAILED')
          if (entry) {
            const assigned = await role({ session_id: String(envelope.result.value?.sessionId || ''), created: true })
            if (assigned.status !== 200) return fail(assigned.status, 'EISCORE_SESSION_ROLE_BIND_FAILED')
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
