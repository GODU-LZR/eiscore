import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const ensureStartupProfile = (homeValue = process.env.DSH_HOME) => {
  const home = String(homeValue || '').trim()
  if (!home) throw new Error('DSH_HOME is required for the Web profile')
  const profileDir = join(home, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  const manifestPath = join(profileDir, 'package.json')
  let manifest
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } else {
    manifest = { name: 'dsh-profile-web', private: true, dependencies: {} }
  }
  const currentProfile = manifest.dsh?.profile || {}
  const bundles = Array.isArray(currentProfile.bundles) && currentProfile.bundles.length
    ? currentProfile.bundles
    : ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']

  // Add bundles as dependencies so npm will install them
  const dependencies = {}
  for (const bundle of bundles) {
    dependencies[bundle] = '^0.1.2-rc.1'
  }

  manifest = {
    ...manifest,
    dependencies: {
      ...dependencies,
      '@deepseek-ai/dsh': '^0.1.2-rc.1',  // Include DSH itself in profile dependencies
      // Add missing peerDependencies that npm doesn't auto-install
      '@deepseek-ai/cordis-plugin-group': '^1.0.2',
      '@deepseek-ai/cordis-plugin-hmr': '^1.0.17',
      '@deepseek-ai/cordis-plugin-include': '^1.0.7',
      '@deepseek-ai/cordis-plugin-loader': '^1.0.3',
      '@deepseek-ai/dsh-home-paths': '^0.1.2-rc.1',
      '@deepseek-ai/dsh-system-prompt': '^0.1.2-rc.1',
      '@deepseek-ai/cordis': '^4.0.2'
    },
    dsh: {
      ...manifest.dsh,
      profile: { ...currentProfile, bundles, patchReload: 'startup' }
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  const patchPath = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(patchPath)) writeFileSync(patchPath, '[]\n')
  return { profileDir, manifestPath, patchPath, manifest }
}

export const resolveDefaultWorkspace = (
  workspaceValue = process.env.DSH_DEFAULT_WORKSPACE,
  homeValue = process.env.DSH_HOME,
  cwdValue = process.cwd()
) => {
  const workspace = String(
    workspaceValue || `${String(homeValue || cwdValue).replace(/[\\/]$/, '')}/workspaces/flash`
  ).trim()
  if (!workspace.startsWith('/')) throw new Error('DSH_DEFAULT_WORKSPACE must be an absolute path')
  return workspace
}

export const resolveHarnessPatchPath = (patchValue = process.env.DSH_PATCH_PATH) =>
  String(patchValue || '').trim() || '/opt/eiscore-harness/dsh-web.patch.yml'

const start = () => {
ensureStartupProfile()

const defaultWorkspace = resolveDefaultWorkspace()
mkdirSync(defaultWorkspace, { recursive: true })

let startupToken = ''
// Resolve shipped bundles from the immutable image installation. The DSH
// profile owns only its manifest and patch layer.
const dsh = spawn(process.execPath, ['--expose-internals', '/opt/bridge/node_modules/@deepseek-ai/dsh/lib/bin.js',
  '--profile', 'web',
  '--patch', resolveHarnessPatchPath(),
  '--port', '3080',
  '--trusted-host', 'lundu.eiscore.top',
  '--no-open'
], {
  cwd: defaultWorkspace,
  env: {
    ...process.env,
    DSH_CWD: process.env.DSH_MODULE_HOME || '/opt/eiscore-harness',
    DSH_DEFAULT_WORKSPACE: defaultWorkspace
  },
  stdio: ['inherit', 'pipe', 'inherit']
})

dsh.stdout.on('data', (chunk) => {
  const text = chunk.toString()
  process.stdout.write(text)
  const match = text.match(/[?&]token=([^\s]+)/)
  if (match) startupToken = decodeURIComponent(match[1])
})

const withToken = (path, headers = {}, force = false) => {
  // Harness' Remote stream WebSocket also carries the EISCore session cookie,
  // but still requires the web startup token for the upstream gateway.
  // The EISCore session cookie is unrelated to DSH's startup token. Only the
  // DSH auth cookie means the startup redirect has already been completed.
  const hasDshAuth = String(headers.cookie || '').split(';').some((part) => part.trim().startsWith('dsh-auth-'))
  if (!startupToken || hasDshAuth || /(?:^|[?&])token=/.test(path)) return path
  const joiner = path.includes('?') ? '&' : '?'
  return `${path}${joiner}token=${encodeURIComponent(startupToken)}`
}

const authCookiePrefix = /^[a-z0-9_-]*$/i.test(process.env.EISCORE_AUTH_COOKIE_PREFIX || '')
  ? process.env.EISCORE_AUTH_COOKIE_PREFIX || ''
  : ''
const authCookieNames = ['eiscore-session', 'eiscore-auth-state']
const cookieHeaders = (value) => Array.isArray(value) ? value : value ? [value] : []
const mapAuthCookiesToUpstream = (cookieHeader = '', prefix = authCookiePrefix) => {
  if (!prefix) return String(cookieHeader || '')
  return String(cookieHeader || '').split(';').map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    const separator = part.indexOf('=')
    if (separator < 1) return []
    const name = part.slice(0, separator)
    if (authCookieNames.includes(name)) return []
    const prefixedName = authCookieNames.map((cookieName) => `${prefix}${cookieName}`).find((cookieName) => cookieName === name)
    return [prefixedName ? `${name.slice(prefix.length)}${part.slice(separator)}` : part]
  }).join('; ')
}
const mapAuthSetCookiesToBrowser = (setCookies, prefix = authCookiePrefix) => {
  if (!prefix) return cookieHeaders(setCookies)
  return cookieHeaders(setCookies).map((value) => String(value).replace(
    /(^|,\s*)(eiscore-session|eiscore-auth-state)=/g,
    (_match, separator, name) => `${separator}${prefix}${name}=`
  ))
}
const requestOrigin = (headers = {}) => {
  const proto = String(headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
  const host = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim()
  if (!host) return ''
  try { return new URL(`${proto}://${host}`).origin } catch { return '' }
}
const allowedAuthOrigin = (headers = {}) => {
  const configured = (() => { try { return new URL(String(process.env.EISCORE_AUTH_URL || '')).origin } catch { return '' } })()
  const allowed = String(process.env.EISCORE_AUTH_ORIGINS || configured).split(',').map((value) => value.trim()).filter(Boolean)
  const current = requestOrigin(headers)
  return current && allowed.includes(current) ? current : configured
}
const getHarnessAuthReturnPath = () => process.env.EISCORE_HARNESS_AUTH_RETURN_PATH === '/harness-flash-embed-api/eiscore/auth/handoff'
  ? process.env.EISCORE_HARNESS_AUTH_RETURN_PATH
  : '/harness-embed-api/eiscore/auth/handoff'
const rewriteAuthStartBody = (body, headers = {}) => {
  const origin = allowedAuthOrigin(headers)
  if (!origin) return body
  try {
    const payload = JSON.parse(body || '{}')
    const target = new URL(String(payload.url || ''))
    const authOrigin = new URL(origin)
    target.protocol = authOrigin.protocol
    target.hostname = authOrigin.hostname
    target.port = authOrigin.port
    target.searchParams.set('dsh_return', `${origin}${getHarnessAuthReturnPath()}`)
    payload.url = target.href
    payload.origin = origin
    return JSON.stringify(payload)
  } catch {
    return body
  }
}

const PUBLIC_ROUTES = new Map([
  ['/api/eiscore/auth/start', new Set(['POST'])],
  ['/api/eiscore/auth/handoff', new Set(['POST'])],
  ['/api/eiscore/auth/status', new Set(['GET'])],
  ['/api/eiscore/auth/logout', new Set(['POST'])],
  ['/readyz', new Set(['GET'])]
])

const isPublicPath = (path = '', method = 'GET') => {
  const pathname = String(path).split('?', 1)[0]
  return PUBLIC_ROUTES.get(pathname)?.has(String(method).toUpperCase()) === true
}

const isHtmlNavigation = (request) => {
  if (request.method !== 'GET') return false
  const destination = String(request.headers['sec-fetch-dest'] || '').toLowerCase()
  if (destination === 'document' || destination === 'iframe') return true
  return String(request.headers.accept || '').toLowerCase().includes('text/html')
}

const rejectUnauthenticated = (response) => {
  response.writeHead(401, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8'
  }).end(JSON.stringify({ authenticated: false, code: 'EISCORE_AUTH_REQUIRED' }))
}

const requestUpstream = (path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: 3080,
    method,
    path: withToken(path, headers),
    headers: {
      host: headers.host || process.env.DSH_TRUSTED_HOST || 'localhost',
      cookie: headers.cookie || '',
      accept: 'application/json',
      ...(headers.authorization ? { authorization: headers.authorization } : {}),
      ...(headers['x-forwarded-proto'] ? { 'x-forwarded-proto': headers['x-forwarded-proto'] } : {}),
      ...(headers['x-forwarded-host'] ? { 'x-forwarded-host': headers['x-forwarded-host'] } : {})
    }
  }, (response) => {
    const chunks = []
    response.on('data', (chunk) => chunks.push(chunk))
    response.on('end', () => resolve({
      statusCode: response.statusCode || 502,
      headers: response.headers,
      body: Buffer.concat(chunks).toString('utf8')
    }))
  })
  upstream.on('error', reject)
  upstream.end()
})

const cookiePairs = (value) => cookieHeaders(value).map((item) => String(item).split(';', 1)[0]).filter(Boolean)
const withoutDshAuth = (headers = {}) => ({
  ...headers,
  cookie: String(headers.cookie || '').split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^dsh-auth-[^=]+=/.test(part))
    .join('; ')
})
const mergeCookies = (header, additions) => {
  const values = new Map()
  for (const part of String(header || '').split(';')) {
    const at = part.indexOf('=')
    if (at > 0) values.set(part.slice(0, at).trim(), part.slice(at + 1).trim())
  }
  for (const part of cookiePairs(additions)) {
    const at = part.indexOf('=')
    if (at > 0) values.set(part.slice(0, at).trim(), part.slice(at + 1).trim())
  }
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ')
}

const bootstrapDshAuth = async (headers) => {
  const cleanHeaders = withoutDshAuth(headers)
  try {
    const startup = await requestUpstream('/', cleanHeaders, 'GET')
    const setCookies = cookieHeaders(startup.headers['set-cookie'])
      .filter((value) => /^dsh-auth-[^=]+=/.test(value))
    return { headers: { ...cleanHeaders, cookie: mergeCookies(cleanHeaders.cookie, setCookies) }, setCookies }
  } catch {
    return { headers: cleanHeaders, setCookies: [] }
  }
}

const redirectToLogin = async (request, response, headers, bootstrapCookies = []) => {
  try {
    const start = await requestUpstream('/api/eiscore/auth/start', headers, 'POST')
    if (start.statusCode < 200 || start.statusCode >= 300) {
      response.writeHead(503, { 'cache-control': 'no-store' }).end('EISCore login unavailable')
      return
    }
    const payload = JSON.parse(rewriteAuthStartBody(start.body, headers) || '{}')
    const target = new URL(String(payload.url || ''))
    const configuredOrigin = new URL(String(process.env.EISCORE_AUTH_URL || '')).origin
    const authOrigin = allowedAuthOrigin(headers)
    const allowedOrigins = String(process.env.EISCORE_AUTH_ORIGINS || configuredOrigin).split(',').map((value) => value.trim()).filter(Boolean)
    if (target.pathname !== '/login' || !authOrigin || !allowedOrigins.includes(authOrigin) || target.origin !== authOrigin) throw new Error('invalid login target')
    target.searchParams.set('dsh_return', `${authOrigin}${getHarnessAuthReturnPath()}`)
    response.writeHead(302, {
      location: target.href,
      'cache-control': 'no-store',
      ...(bootstrapCookies.length || start.headers['set-cookie'] ? {
        'set-cookie': mapAuthSetCookiesToBrowser([...bootstrapCookies, ...cookieHeaders(start.headers['set-cookie'])], authCookiePrefix)
      } : {})
    }).end()
  } catch {
    response.writeHead(503, { 'cache-control': 'no-store' }).end('EISCore login unavailable')
  }
}

const isAuthenticated = async (headers) => {
  try {
    const status = await requestUpstream('/api/eiscore/auth/status', headers, 'GET')
    if (status.statusCode !== 200) return false
    return JSON.parse(status.body || '{}').authenticated === true
  } catch {
    return false
  }
}

const proxy = http.createServer((request, response) => {
  const path = request.url || '/'
  const headers = { ...request.headers, cookie: mapAuthCookiesToUpstream(request.headers.cookie, authCookiePrefix) }
  bootstrapDshAuth(headers).then(({ headers: authenticatedHeaders, setCookies }) => {
    if (!isPublicPath(path, request.method)) {
      return isAuthenticated(authenticatedHeaders).then((authenticated) => {
        if (!authenticated) {
          if (isHtmlNavigation(request)) return redirectToLogin(request, response, authenticatedHeaders, setCookies)
          return rejectUnauthenticated(response)
        }
        proxyAuthenticatedRequest(request, response, authenticatedHeaders, setCookies)
      })
    }
    proxyAuthenticatedRequest(request, response, authenticatedHeaders, setCookies)
  }).catch(() => {
    if (!response.headersSent) response.writeHead(503).end('DeepSeek Harness unavailable')
  })
})

const proxyAuthenticatedRequest = (request, response, headers = request.headers, bootstrapCookies = []) => {
  const rewriteAuthStart = request.method === 'POST' && (request.url || '').split('?', 1)[0] === '/api/eiscore/auth/start'
  const upstreamHeaders = rewriteAuthStart ? { ...headers, 'accept-encoding': 'identity' } : headers
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: 3080,
    method: request.method,
    path: withToken(request.url || '/', headers),
    headers: upstreamHeaders
  }, (upstreamResponse) => {
    const responseHeaders = { ...upstreamResponse.headers }
    const setCookies = mapAuthSetCookiesToBrowser([
      ...bootstrapCookies,
      ...cookieHeaders(upstreamResponse.headers['set-cookie'])
    ], authCookiePrefix)
    if (setCookies.length) responseHeaders['set-cookie'] = setCookies
    if (rewriteAuthStart) {
      const chunks = []
      upstreamResponse.on('data', (chunk) => chunks.push(chunk))
      upstreamResponse.on('end', () => {
        const body = rewriteAuthStartBody(Buffer.concat(chunks).toString('utf8'), headers)
        delete responseHeaders['transfer-encoding']
        delete responseHeaders['content-encoding']
        delete responseHeaders.etag
        responseHeaders['content-length'] = Buffer.byteLength(body)
        response.writeHead(upstreamResponse.statusCode || 502, responseHeaders)
        response.end(body)
      })
      return
    }
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders)
    upstreamResponse.pipe(response)
  })
  upstream.on('error', () => response.writeHead(502).end('DeepSeek Harness unavailable'))
  request.pipe(upstream)
}

proxy.on('upgrade', (request, socket, head) => {
  const reject = (status, message) => {
    if (!socket.destroyed) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`)
  }
  const connect = (headers) => {
    const upstream = net.connect(3080, '127.0.0.1', () => {
      const path = withToken(request.url || '/', headers, true)
      const wireHeaders = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')
      upstream.write(`GET ${path} HTTP/1.1\r\n${wireHeaders}\r\n\r\n`)
      if (head.length) upstream.write(head)
      socket.pipe(upstream)
      upstream.pipe(socket)
    })
    const close = () => { socket.destroy(); upstream.destroy() }
    socket.on('error', close)
    upstream.on('error', close)
  }
  const headers = { ...request.headers, cookie: mapAuthCookiesToUpstream(request.headers.cookie, authCookiePrefix) }
  bootstrapDshAuth(headers).then(({ headers: authenticatedHeaders }) => {
    if (isPublicPath(request.url || '/', request.method)) return connect(authenticatedHeaders)
    return isAuthenticated(authenticatedHeaders).then((authenticated) => {
      if (authenticated) return connect(authenticatedHeaders)
      reject(401, 'EISCore authentication required')
    })
  }).catch(() => reject(401, 'EISCore authentication required'))
})
proxy.listen(3081, '0.0.0.0')

dsh.on('exit', (code) => process.exit(code ?? 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
