// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const RELEASE_VERSION = '20260612224947'
const CACHE_PREFIX = `eiscore-client-assets-v${RELEASE_VERSION}-`
const MANIFEST_URL = '/asset-manifest.json'
const STATIC_EXT_RE = /\.(?:js|css|png|jpg|jpeg|gif|ico|svg|webp|avif|woff2?|ttf|eot)$/i
const HTML_ENTRY_RE = /^\/(?:index\.html|(?:hr|materials|apps|sales|purchase|production|quality|equipment|decision|mobile)\/index\.html)$/
const RUNTIME_PREFIXES = ['/api/', '/rpc/', '/agent/', '/doc/']

let manifestPromise = null

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin
}

function isRuntimePath(pathname) {
  return RUNTIME_PREFIXES.some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix))
}

function isCacheableClientPath(pathname) {
  return pathname === '/'
    || HTML_ENTRY_RE.test(pathname)
    || pathname.includes('/assets/')
    || STATIC_EXT_RE.test(pathname)
}

async function readManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(`${MANIFEST_URL}?v=${RELEASE_VERSION}&t=${Date.now()}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`manifest ${response.status}`)
        return response.json()
      })
      .catch(() => ({ version: 'fallback', urls: [] }))
  }
  return manifestPromise
}

async function getCacheName() {
  const manifest = await readManifest()
  return `${CACHE_PREFIX}${manifest.version || 'fallback'}`
}

async function cleanupOldCaches() {
  const currentCacheName = await getCacheName()
  const names = await caches.keys()
  await Promise.all(
    names
      .filter((name) => name.startsWith('eiscore-client-assets-') && name !== currentCacheName)
      .map((name) => caches.delete(name))
  )
}

async function notifyClients(type, detail = {}) {
  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  await Promise.all(
    clientsList.map((client) => {
      try {
        client.postMessage({ type, ...detail })
      } catch {}
    })
  )
}

function getPrecacheOptions(event) {
  const mode = event?.data?.mode === 'background' ? 'background' : 'normal'
  return {
    mode,
    concurrency: mode === 'background' ? 2 : 4,
    pauseMs: mode === 'background' ? 120 : 0
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function precacheClientAssets(options = {}) {
  const manifest = await readManifest()
  const urls = Array.isArray(manifest.urls) ? manifest.urls : []
  if (!urls.length) return

  const cache = await caches.open(await getCacheName())
  let cursor = 0
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || 2, 4))
  const pauseMs = Math.max(0, Number(options.pauseMs) || 0)

  async function cacheOne(url) {
    try {
      const request = new Request(url, { cache: 'reload', credentials: 'same-origin' })
      if (await cache.match(request)) return
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response)
    } catch {
      // Keep caching the rest of the release even if one optional asset fails.
    }
  }

  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor]
      cursor += 1
      await cacheOne(url)
      if (pauseMs) await sleep(pauseMs)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  await notifyClients('EIS_CLIENT_CACHE_READY', { version: manifest.version || 'fallback' })
}

async function cacheFirst(request) {
  const cache = await caches.open(await getCacheName())
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    try { await cache.put(request, response.clone()) } catch {}
  }
  return response
}

async function networkFirst(request, fallbackUrl = '/index.html') {
  const cache = await caches.open(await getCacheName())
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }))
    if (response.ok) {
      try { await cache.put(request, response.clone()) } catch {}
    }
    return response
  } catch {
    return (await cache.match(request))
      || (await cache.match(fallbackUrl))
      || Response.error()
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    cleanupOldCaches()
      .then(() => self.clients.claim())
      .then(async () => {
        const manifest = await readManifest()
        await notifyClients('EIS_CLIENT_CACHE_READY', { version: manifest.version || 'fallback' })
      })
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'PRECACHE_CLIENT_ASSETS') {
    event.waitUntil(precacheClientAssets(getPrecacheOptions(event)))
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (!isSameOrigin(url) || isRuntimePath(url.pathname)) return

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request))
    return
  }

  if (isCacheableClientPath(url.pathname)) {
    const fallback = url.pathname.endsWith('/index.html') ? url.pathname : '/index.html'
    event.respondWith(
      url.pathname.endsWith('.html') || url.pathname === '/'
        ? networkFirst(event.request, fallback)
        : cacheFirst(event.request)
    )
  }
})
