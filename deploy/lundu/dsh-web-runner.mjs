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
  manifest = {
    ...manifest,
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

const start = () => {
ensureStartupProfile()

let startupToken = ''
const dsh = spawn(process.execPath, ['--expose-internals', '/opt/bridge/node_modules/@deepseek-ai/dsh/lib/bin.js',
  '--profile', 'web',
  '--patch', '/opt/eiscore-harness/dsh-web.patch.yml',
  '--port', '3080',
  '--trusted-host', 'lundu.eiscore.top',
  '--no-open'
], { env: process.env, stdio: ['inherit', 'pipe', 'inherit'] })

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

const proxy = http.createServer((request, response) => {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: 3080,
    method: request.method,
    path: withToken(request.url || '/', request.headers),
    headers: request.headers
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  upstream.on('error', () => response.writeHead(502).end('DeepSeek Harness unavailable'))
  request.pipe(upstream)
})

proxy.on('upgrade', (request, socket, head) => {
  const upstream = net.connect(3080, '127.0.0.1', () => {
    const path = withToken(request.url || '/', request.headers, true)
    const headers = Object.entries(request.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')
    upstream.write(`GET ${path} HTTP/1.1\r\n${headers}\r\n\r\n`)
    if (head.length) upstream.write(head)
    socket.pipe(upstream)
    upstream.pipe(socket)
  })
  const close = () => { socket.destroy(); upstream.destroy() }
  socket.on('error', close)
  upstream.on('error', close)
})
proxy.listen(3081, '0.0.0.0')

dsh.on('exit', (code) => process.exit(code ?? 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
