// SPDX-License-Identifier: AGPL-3.0-or-later
// Playwright CLI run-code function. The runner supplies a NEW Chromium context,
// allows service workers, and serves the two existing dist directories read-only
// at http://localhost:<port>. page.route cannot serve worker-owned requests.
// GET /__eiscore_sw_check__/select?phase=old|candidate switches ONLY the local
// server's in-memory static root and returns { phase, directory }. No SPA fallback
// is allowed for missing assets. Real APIs must never be proxied or mocked.
// Set window.__LUNDU_SW_UPGRADE_CHECK__ before invoking (or pass suppliedConfig):
// { origin, oldDirectory, candidateDirectory, oldWorkerSha256,
//   candidateWorkerSha256, isolatedContext: true }
// Directory labels must be absolute; slash direction may differ on Windows.
// Hashes are SHA-256 of each directory's actual sw.js bytes, computed by runner.
// The caller saves the result and closes this private context, even on failure.
async (page, suppliedConfig) => {
  const config = suppliedConfig || await page.evaluate(() => window.__LUNDU_SW_UPGRADE_CHECK__)
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  check(config?.isolatedContext === true, 'Use a new private Chromium context with service workers enabled')
  check(config.oldDirectory && config.candidateDirectory && config.oldDirectory !== config.candidateDirectory, 'Two distinct dist directories are required')
  for (const key of ['oldWorkerSha256', 'candidateWorkerSha256']) {
    check(/^[a-f0-9]{64}$/i.test(config[key]), `${key} must identify the actual sw.js bytes`)
  }
  const origin = await page.evaluate(value => {
    const url = new URL(value)
    if (url.protocol !== 'http:' || url.hostname !== 'localhost' || url.username || url.password) {
      throw new Error('Only a temporary http://localhost:<port> server is allowed')
    }
    return url.origin
  }, config.origin)
  const context = page.context()
  check(typeof context.serviceWorkers === 'function' && context.serviceWorkers().length === 0, 'Start with a fresh Chromium context without workers')
  const key = '__eiscore_sw_upgrade_probe__'
  const blocked = []
  const guard = async route => {
    const request = route.request()
    const path = request.url().slice(origin.length).split('?')[0]
    if (!request.url().startsWith(`${origin}/`) || !['GET', 'HEAD'].includes(request.method())
      || /^\/(?:api|rpc|agent|ai|flash|twin|document-intake|company-site)(?:\/|$)/.test(path)) {
      blocked.push({ method: request.method(), url: request.url() })
      await route.abort('blockedbyclient')
    } else await route.fallback()
  }
  await page.route('**/*', guard)
  await page.addInitScript(key => {
    const read = () => JSON.parse(sessionStorage.getItem(key) || '{"documents":0,"controllerChanges":0}')
    const state = read()
    state.documents++
    sessionStorage.setItem(key, JSON.stringify(state))
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      const next = read()
      next.controllerChanges++
      sessionStorage.setItem(key, JSON.stringify(next))
    })
  }, key)
  const state = () => page.evaluate(key => ({
    ...JSON.parse(sessionStorage.getItem(key) || '{}'),
    controller: navigator.serviceWorker.controller?.scriptURL,
    controllerState: navigator.serviceWorker.controller?.state,
    caches: []
  }), key)
  const select = async phase => {
    // APIRequestContext avoids an old worker or a page reload racing this local
    // control request. This endpoint may only switch the temporary static root.
    const response = await context.request.get(`${origin}/__eiscore_sw_check__/select?phase=${phase}`, { timeout: 15000 })
    check(response.ok() && response.headers()['content-type']?.includes('application/json'), 'Local static selector did not return JSON')
    const selected = await response.json()
    const normalized = value => String(value).replaceAll('\\', '/').replace(/\/+$/, '')
    check(selected.phase === phase && normalized(selected.directory) === normalized(config[`${phase}Directory`]), `Wrong ${phase} directory selected`)
  }
  const release = phase => page.evaluate(async ({ phase, expectedSha256 }) => {
    const read = async path => {
      const response = await fetch(path, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
      return response
    }
    const manifestResponse = await read('/asset-manifest.json')
    if (!manifestResponse.headers.get('content-type')?.includes('application/json')) throw new Error('Manifest is not JSON')
    const manifest = await manifestResponse.json()
    if (!/^[a-f0-9]{16}$/i.test(manifest.version) || !Array.isArray(manifest.urls) || manifest.count !== manifest.urls.length) {
      throw new Error('Invalid manifest')
    }
    // The query keeps this diagnostic fetch out of an old cache-first entry.
    const workerResponse = await read(`/sw.js?__upgrade_probe=${phase}`)
    if (!/javascript/i.test(workerResponse.headers.get('content-type') || '')) throw new Error('Worker response is not JavaScript')
    const bytes = await workerResponse.arrayBuffer()
    const source = new TextDecoder().decode(bytes)
    if (/^\s*(?:<!doctype|<html)/i.test(source)) throw new Error('Worker response contains HTML')
    const workerSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    if (workerSha256 !== expectedSha256.toLowerCase()) throw new Error(`${phase} worker bytes differ from the supplied dist`)
    const stamp = source.match(/\b(?:const|var) RELEASE_VERSION = '([^']+)'/)?.[1]
    if (!stamp) throw new Error('Worker release stamp is missing')
    const assets = [
      manifest.urls.find(url => /^\/assets\/index[^/]*\.js$/.test(url)),
      manifest.urls.find(url => /^\/assets\/[^/]+\.css$/.test(url)),
      manifest.urls.find(url => /\.(?:png|jpg|jpeg|webp)$/.test(url))
    ]
    if (assets.some(url => !url || !url.startsWith('/') || url.startsWith('//'))) throw new Error('Manifest lacks JS, CSS or image probes')
    return { version: manifest.version, count: manifest.count, workerSha256, stamp, assets }
  }, { phase, expectedSha256: config[`${phase}WorkerSha256`] })
  const runningWorker = async expected => {
    for (let attempt = 0; attempt < 150; attempt++) {
      for (const worker of context.serviceWorkers()) {
        if (worker.url() !== `${origin}/sw.js`) continue
        const info = await worker.evaluate(async () => ({
          // Inspect the executing worker, not just a network copy of sw.js.
          stamp: typeof RELEASE_VERSION === 'string' ? RELEASE_VERSION : '',
          cacheName: typeof getCacheName === 'function' ? await getCacheName() : ''
        })).catch(() => null)
        if (info?.stamp === expected.stamp) {
          check(info.cacheName === `eiscore-client-assets-v${expected.stamp}-${expected.version}`, 'Running worker cache name differs')
          return info
        }
      }
      await page.waitForTimeout(100)
    }
    throw new Error(`Executing worker did not reach release ${expected.stamp}`)
  }
  const probeAssets = async expected => page.evaluate(async urls => {
    const results = []
    for (const url of urls) {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      const contentType = response.headers.get('content-type') || ''
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (!response.ok || !bytes.length || /html/i.test(contentType)
        || /^\s*(?:<!doctype|<html)/i.test(new TextDecoder().decode(bytes.slice(0, 200)))) {
        throw new Error(`Static resource returned missing/HTML content: ${url}`)
      }
      if (/\.js$/.test(url) && !/javascript/i.test(contentType)) throw new Error(`Wrong JavaScript MIME: ${url}`)
      if (/\.css$/.test(url) && !/text\/css/i.test(contentType)) throw new Error(`Wrong CSS MIME: ${url}`)
      results.push({ url, contentType, bytes: bytes.length })
    }
    return results
  }, expected.assets)
  try {
    await select('old')
    await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const old = await release('old')
    await page.evaluate(() => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }))
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 20000 })
    old.runningWorker = await runningWorker(old)
    old.resources = await probeAssets(old)
    old.browser = await state()
    old.browser.caches = await page.evaluate(() => caches.keys())
    check(old.browser.caches.includes(old.runningWorker.cacheName), 'Old worker cache was not primed')

    await select('candidate')
    const candidate = await release('candidate')
    check(old.version !== candidate.version && old.stamp !== candidate.stamp && old.workerSha256 !== candidate.workerSha256, 'The candidate must be a distinct stamped release')
    // Returning immediately lets the genuine controller-change/message reload
    // finish without destroying this evaluate call's execution context.
    await page.evaluate(() => { navigator.serviceWorker.getRegistration('/').then(registration => registration.update()) })
    await page.waitForFunction(({ key, changes, stamp }) => {
      const state = JSON.parse(sessionStorage.getItem(key) || '{}')
      return state.controllerChanges > changes && navigator.serviceWorker.controller?.state === 'activated'
        && Array.from(document.scripts).some(script => script.textContent.includes(`var RELEASE_VERSION = '${stamp}'`))
    }, { key, changes: old.browser.controllerChanges, stamp: candidate.stamp }, { timeout: 30000 })
    candidate.runningWorker = await runningWorker(candidate)
    candidate.resources = await probeAssets(candidate)
    candidate.browser = await state()
    candidate.browser.caches = await page.evaluate(() => caches.keys())
    const automaticReloads = candidate.browser.documents - old.browser.documents
    check(automaticReloads === 1, `Expected one automatic release reload, observed ${automaticReloads}`)
    check(candidate.browser.caches.includes(candidate.runningWorker.cacheName)
      && !candidate.browser.caches.some(name => name.startsWith('eiscore-client-assets-') && name !== candidate.runningWorker.cacheName), 'Candidate cache is missing or an old release cache survived')

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500)
    const final = await state()
    check(final.documents - old.browser.documents === 2, 'Reload loop detected after a second candidate navigation')
    check((await release('candidate')).workerSha256 === candidate.workerSha256, 'Candidate worker bytes changed after reload')
    await probeAssets(candidate)
    return { pass: true, origin, oldDirectory: config.oldDirectory, candidateDirectory: config.candidateDirectory,
      old, candidate, automaticReloads, explicitReloads: 1, observationMs: 2500, blocked,
      scope: 'Private localhost context; actual stamped workers and cache rollover; representative JS/CSS/image probes; no business/API completion claims' }
  } finally {
    await page.unroute('**/*', guard)
  }
}
