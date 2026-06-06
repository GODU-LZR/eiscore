#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

const args = process.argv.slice(2)

const argValue = (name, fallback = '') => {
  const index = args.indexOf(name)
  if (index >= 0 && args[index + 1]) return args[index + 1]
  const inline = args.find((item) => item.startsWith(`${name}=`))
  return inline ? inline.slice(name.length + 1) : fallback
}

const hasFlag = (name) => args.includes(name)

const root = path.resolve(process.cwd(), argValue('--root', 'dist'))
const port = Number(argValue('--port', process.env.PORT || '8080'))
const host = argValue('--host', process.env.HOST || '127.0.0.1')
const base = normalizeBase(argValue('--base', process.env.BASE_PATH || '/'))
const enableMicroProxy = hasFlag('--micro-proxy')

function normalizeBase(value) {
  const text = String(value || '/').trim()
  if (!text || text === '/') return '/'
  return `/${text.replace(/^\/+|\/+$/g, '')}`
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
}

const microTargets = [
  { prefix: '/apps', target: 'http://127.0.0.1:8083' },
  { prefix: '/production', target: 'http://127.0.0.1:8087' },
  { prefix: '/hr', target: 'http://127.0.0.1:8082' },
  { prefix: '/materials', target: 'http://127.0.0.1:8081' },
  { prefix: '/sales', target: 'http://127.0.0.1:8085' },
  { prefix: '/purchase', target: 'http://127.0.0.1:8088' },
  { prefix: '/quality', target: 'http://127.0.0.1:8089' },
  { prefix: '/equipment', target: 'http://127.0.0.1:8090' },
  { prefix: '/decision', target: 'http://127.0.0.1:8091' },
  { prefix: '/mobile', target: 'http://127.0.0.1:8084' }
]

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const rawPath = url.pathname

  setCorsHeaders(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (enableMicroProxy && shouldRedirectMobileRequest(req, rawPath, url)) {
    redirect(res, buildMobileRedirectLocation(rawPath, url))
    return
  }

  const apiProxy = getApiProxy(rawPath)
  if (apiProxy) {
    proxyRequest(req, res, apiProxy.target, apiProxy.rewrite(rawPath) + url.search)
    return
  }

  if (enableMicroProxy) {
    const microProxy = getMicroProxy(rawPath)
    if (microProxy) {
      proxyRequest(req, res, microProxy.target, rawPath + url.search)
      return
    }
  }

  serveStatic(req, res, rawPath)
})

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const rawPath = url.pathname
  const apiProxy = getApiProxy(rawPath)
  if (!apiProxy) {
    socket.destroy()
    return
  }
  proxyUpgrade(req, socket, head, apiProxy.target, apiProxy.rewrite(rawPath) + url.search)
})

server.listen(port, host, () => {
  console.log(`static-spa-server serving ${root} at http://${host}:${port}${base === '/' ? '/' : `${base}/`}`)
})

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
}

function getApiProxy(rawPath) {
  if (rawPath === '/api' || rawPath.startsWith('/api/')) {
    return {
      target: 'http://127.0.0.1:3000',
      rewrite: (value) => value
        .replace(/^\/api\/workflow\.definitions\b/, '/api/definitions')
        .replace(/^\/api\/workflow\.instances\b/, '/api/instances')
        .replace(/^\/api\b/, '')
    }
  }
  if (rawPath === '/production/api' || rawPath.startsWith('/production/api/')) {
    return {
      target: 'http://127.0.0.1:3000',
      rewrite: (value) => value
        .replace(/^\/production\/api\/workflow\.definitions\b/, '/api/definitions')
        .replace(/^\/production\/api\/workflow\.instances\b/, '/api/instances')
        .replace(/^\/production\/api\b/, '')
    }
  }
  const moduleApiPrefix = rawPath.match(/^\/(hr|materials|sales|purchase|quality|equipment|decision|apps|mobile)\/api\b/)
  if (moduleApiPrefix) {
    const moduleName = moduleApiPrefix[1]
    return {
      target: 'http://127.0.0.1:3000',
      rewrite: (value) => value
        .replace(new RegExp(`^/${moduleName}/api/workflow\\.definitions\\b`), '/api/definitions')
        .replace(new RegExp(`^/${moduleName}/api/workflow\\.instances\\b`), '/api/instances')
        .replace(new RegExp(`^/${moduleName}/api\\b`), '')
    }
  }
  if (rawPath === '/rpc' || rawPath.startsWith('/rpc/')) {
    return { target: 'http://127.0.0.1:3000', rewrite: (value) => value }
  }
  if (rawPath === '/agent' || rawPath.startsWith('/agent/')) {
    return { target: 'http://127.0.0.1:8078', rewrite: (value) => value.replace(/^\/agent\b/, '') || '/' }
  }
  if (rawPath === '/ide' || rawPath.startsWith('/ide/')) {
    return { target: 'http://127.0.0.1:8443', rewrite: (value) => value.replace(/^\/ide\b/, '') || '/' }
  }
  if (rawPath === '/production/agent' || rawPath.startsWith('/production/agent/')) {
    return { target: 'http://127.0.0.1:8078', rewrite: (value) => value.replace(/^\/production\/agent\b/, '') || '/' }
  }
  const moduleAgentPrefix = rawPath.match(/^\/(hr|materials|sales|purchase|quality|equipment|decision|apps|mobile)\/agent\b/)
  if (moduleAgentPrefix) {
    const moduleName = moduleAgentPrefix[1]
    return { target: 'http://127.0.0.1:8078', rewrite: (value) => value.replace(new RegExp(`^/${moduleName}/agent\\b`), '') || '/' }
  }
  return null
}

function getMicroProxy(rawPath) {
  const target = microTargets.find((item) => rawPath === item.prefix || rawPath.startsWith(`${item.prefix}/`))
  if (!target) return null

  const restPath = rawPath.slice(target.prefix.length) || '/'
  const shouldProxyMicroRoute = (
    target.prefix === '/mobile' ||
    (
      target.prefix === '/apps' && (
        restPath === '/preview/flash-draft' ||
        restPath.startsWith('/preview/') ||
        restPath.startsWith('/__preview/')
      )
    )
  )
  const shouldProxyMicroAsset = (
    restPath === '/index.html' ||
    restPath === '/favicon.ico' ||
    restPath.startsWith('/assets/') ||
    restPath.startsWith('/static/')
  )

  return shouldProxyMicroRoute || shouldProxyMicroAsset ? target : null
}

function serveStatic(req, res, rawPath) {
  if (base !== '/' && !rawPath.startsWith(`${base}/`) && rawPath !== base) {
    redirect(res, `${base}/`)
    return
  }

  let relativePath = base === '/' ? rawPath : rawPath.slice(base.length) || '/'
  if (relativePath === '/') relativePath = '/index.html'

  let filePath
  try {
    const decoded = decodeURIComponent(relativePath)
    const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '')
    filePath = path.join(root, normalized)
  } catch {
    sendText(res, 400, 'Bad request')
    return
  }

  if (!filePath.startsWith(root)) {
    sendText(res, 403, 'Forbidden')
    return
  }

  if (existsFile(filePath)) {
    sendFile(req, res, filePath, rawPath)
    return
  }

  const shouldFallback = req.method === 'GET' || req.method === 'HEAD'
  const ext = path.extname(filePath)
  if (shouldFallback && (!ext || acceptsHtml(req))) {
    sendFile(req, res, path.join(root, 'index.html'), rawPath)
    return
  }

  sendText(res, 404, 'Not found')
}

function shouldRedirectMobileRequest(req, rawPath, url) {
  if (rawPath.startsWith('/mobile')) return false
  if (url.searchParams.get('desktop') === '1') return false
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (!acceptsHtml(req)) return false
  if (!isMobileUserAgent(req)) return false

  const ext = path.extname(rawPath)
  if (ext) return false
  if (rawPath === '/api' || rawPath.startsWith('/api/')) return false
  if (rawPath === '/rpc' || rawPath.startsWith('/rpc/')) return false
  if (rawPath === '/agent' || rawPath.startsWith('/agent/')) return false

  return true
}

function isMobileUserAgent(req) {
  const ua = String(req.headers['user-agent'] || '')
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)
}

function buildMobileRedirectLocation(rawPath, url) {
  const targetPath = rawPath === '/login' ? '/mobile/login' : '/mobile/'
  return `${targetPath}${url.search || ''}`
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function acceptsHtml(req) {
  const accept = String(req.headers.accept || '')
  return !accept || accept.includes('text/html') || accept.includes('*/*')
}

function sendFile(req, res, filePath, rawPath = '') {
  const ext = path.extname(filePath).toLowerCase()
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable')
  if (req.method === 'HEAD') {
    res.writeHead(200)
    res.end()
    return
  }
  if (ext === '.html' && isStandaloneAppsPreviewPath(rawPath)) {
    try {
      const html = fs.readFileSync(filePath, 'utf8')
      res.end(cleanQiankunBootstrapHtml(html))
      return
    } catch {
      sendText(res, 500, 'Read error')
      return
    }
  }
  fs.createReadStream(filePath)
    .on('error', () => sendText(res, 500, 'Read error'))
    .pipe(res)
}

function isStandaloneAppsPreviewPath(rawPath) {
  return rawPath === '/apps/preview/flash-draft' || rawPath.startsWith('/apps/preview/')
}

function cleanQiankunBootstrapHtml(html) {
  return String(html || '')
    .replace(/<script([^>]*)>\s*import\((['"][^'"]+['"])\)\.finally\([\s\S]*?<\/script>/, '<script$1>import($2)</script>')
    .replace(/<script>\s*const createDeffer[\s\S]*?<\/script>/, '')
}

function sendText(res, status, text) {
  if (res.headersSent) return
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(text)
}

function redirect(res, location) {
  res.writeHead(302, { Location: location })
  res.end()
}

function proxyRequest(req, res, target, rewrittenPath) {
  const targetUrl = new URL(target)
  const client = targetUrl.protocol === 'https:' ? https : http
  const headers = { ...req.headers, host: targetUrl.host }
  const options = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    method: req.method,
    path: `${targetUrl.pathname.replace(/\/$/, '')}${rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`}`,
    headers
  }

  const upstream = client.request(options, (upstreamRes) => {
    Object.entries(upstreamRes.headers).forEach(([key, value]) => {
      if (value !== undefined) res.setHeader(key, value)
    })
    setCorsHeaders(res)
    res.writeHead(upstreamRes.statusCode || 502)
    upstreamRes.pipe(res)
  })

  upstream.on('error', (error) => {
    sendText(res, 502, `Proxy error: ${error.message}`)
  })

  req.pipe(upstream)
}

function proxyUpgrade(req, socket, head, target, rewrittenPath) {
  const targetUrl = new URL(target)
  const client = targetUrl.protocol === 'https:' ? https : http
  const headers = {
    ...req.headers,
    host: targetUrl.host
  }
  const options = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    method: req.method,
    path: `${targetUrl.pathname.replace(/\/$/, '')}${rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`}`,
    headers
  }

  const upstream = client.request(options)
  upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      '',
      ''
    ].join('\r\n'))
    if (upstreamHead?.length) socket.write(upstreamHead)
    if (head?.length) upstreamSocket.write(head)
    upstreamSocket.pipe(socket)
    socket.pipe(upstreamSocket)
  })
  upstream.on('error', () => {
    socket.destroy()
  })
  upstream.end()
}
