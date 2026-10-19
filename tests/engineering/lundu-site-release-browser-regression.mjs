// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../../scripts/verify-lundu-site-browser.cjs', import.meta.url), 'utf8')
const expectedVersion = '0123456789abcdef'
const expectedTreeSha256 = 'a'.repeat(64)
const sourceCommit = 'b'.repeat(40)
const releaseStamp = '20261020-test'

// A browser contract double: run the actual CLI function and its predicates.
// No live site, timers, filesystem access or implementation helpers are replaced.
function browser(fault = '') {
  const state = { viewportWidth: 1440, slide: 0, progress: 0, quoteCount: 0, profile: {}, waitingProfile: false, profileWaits: 0, calls: [], handlers: new Map() }
  const storage = new Map([['lundu-inquiry-list', 'existing local draft']])
  const localStorage = { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key), setItem: (key, value) => storage.set(key, value) }
  const window = { __LUNDU_RELEASE_CHECK__: { expectedVersion, expectedTreeSha256 }, __EISCORE_INITIAL_CONTENT_READY__: true }
  const image = (path, index) => ({
    complete: true,
    naturalWidth: fault === 'broken-product' && path.includes('product-card-media') ? 0 : 1600,
    naturalHeight: 900,
    fit: fault === 'cropped-quote' && path.includes('quote-line-media') ? 'cover' : 'contain',
    decode: async () => {},
    getAttribute: () => path.includes('hero-media') ? `/slide-${fault === 'duplicate-slide' ? 0 : state.slide}.jpg`
      : path.includes('brand-mark') ? '/logo.png'
        : `/product-${fault === 'wrong-detail' && path.includes('product-detail-media') ? 'wrong' : path.includes('product-detail-media') ? state.activeProduct : index}.jpg`
  })
  const document = {
    title: '伦度机电｜电机与水泵制造', body: { innerText: '伦度产品' },
    documentElement: { get scrollWidth() { return state.viewportWidth + (fault === 'overflow' ? 1 : -10) } },
    querySelector: selector => {
      if (selector === '#app') return { __vue_app__: { config: { globalProperties: { $pinia: { _s: new Map([['system', { enterpriseProfile: state.profile }]]) } } } } }
      if (selector === '#products') return { classList: { contains: () => fault !== 'hidden-products' }, opacity: 1 }
      if (selector === '.pump-bom-progress span') return { transform: `matrix(${state.progress},0,0,1,0,0)` }
      if (selector === 'link[rel~="icon"]') return { getAttribute: () => '/favicon.png' }
      throw new Error(`Unexpected DOM selector: ${selector}`)
    },
    querySelectorAll: () => Array.from({ length: 6 }, (_, index) => ({ getAttribute: () => String(state.slide === index) }))
  }
  const fetch = async path => {
    state.calls.push(path)
    if (path === '/release-provenance.json') state.releaseReads = (state.releaseReads || 0) + 1
    const data = path === '/asset-manifest.json'
      ? { version: fault === 'version' ? 'old' : expectedVersion, count: 609 }
      : path === '/release-provenance.json'
        ? { manifestVersion: expectedVersion, treeSha256: fault === 'tree' ? 'wrong' : expectedTreeSha256, sourceCommit, build: { stamp: fault === 'release-metadata' && state.releaseReads > 1 ? 'changed' : releaseStamp } }
        : { site: { siteKey: 'primary', status: fault === 'draft-profile' ? 'draft' : 'published' }, content: { products: Array(83).fill({}) } }
    return { ok: true, status: 200, headers: { get: () => path === '/favicon.png' ? (fault === 'favicon-html' ? 'text/html' : 'image/png') : 'application/json' }, json: async () => data }
  }
  const locator = (path, index = 0) => ({
    locator: selector => locator(`${path} ${selector}`, index),
    getByRole: (role, options = {}) => locator(`${path} ${role}:${options.name || ''}`, index),
    first: () => locator(path, 0), nth: value => locator(path, value),
    waitFor: async () => {}, scrollIntoViewIfNeeded: async () => {},
    count: async () => path.endsWith('tab:') ? (fault === 'five-slides' ? 5 : 6)
      : path.endsWith('.pump-bom-list li') ? (fault === 'bom-parts' ? 12 : 13)
        : path.endsWith('.quote-line') ? state.quoteCount
          : path === '.public-product-card' ? (fault === 'products' ? 11 : 12) : 1,
    click: async () => {
      if (path.endsWith('tab:')) state.slide = index
      if (path.includes('拆分 BOM')) state.progress = 1
      if (path.includes('组装 BOM')) state.progress = 0
      if (path.includes('产品详情')) state.activeProduct = index
      if (path.includes('加入采购单')) state.quoteCount++
    },
    evaluate: async callback => callback(path.endsWith('canvas') ? { width: 100, height: 100, getBoundingClientRect: () => ({ width: 100, height: 100 }) } : image(path, index))
  })
  const page = {
    url: () => 'https://lundu.example.test/login',
    on: (event, callback) => state.handlers.set(event, callback),
    off: event => state.handlers.delete(event),
    route: async (_pattern, callback) => { state.route = callback }, unroute: async () => {},
    evaluate: async (callback, arg) => callback(arg),
    bringToFront: async () => {}, setViewportSize: async ({ width }) => { state.viewportWidth = width },
    goto: async () => {
      state.waitingProfile = true
      state.profile.source = 'deployment-fallback'
      window.__EISCORE_INITIAL_CONTENT_READY__ = true
      state.quoteCount = 0
      if (fault === 'pageerror') state.handlers.get('pageerror')(new Error('actual page error'))
      if (fault === 'console-error') state.handlers.get('console')({ type: () => 'error', text: () => 'actual console error' })
      if (fault === 'write') await state.route({ request: () => ({ method: () => 'POST', url: () => '/agent/sales/sessions' }), abort: async () => { state.writeAborted = true } })
    },
    waitForFunction: async (predicate, arg) => {
      if (state.waitingProfile) {
        assert.equal(predicate(arg), false, 'must reject deployment fallback even when content ready is true')
        state.profile.source = 'published-site'
        window.__EISCORE_INITIAL_CONTENT_READY__ = false
        assert.equal(predicate(arg), false, 'must wait for content ready even when the profile is published')
        window.__EISCORE_INITIAL_CONTENT_READY__ = true
        state.waitingProfile = false
        state.profileWaits++
      }
      if (!predicate(arg)) throw new Error('Browser wait predicate did not pass')
    },
    locator: selector => locator(selector), getByRole: (role, options = {}) => locator(`${role}:${options.name || ''}`)
  }
  const verify = runInNewContext(`(${source}\n)`, {
    window, document, localStorage, fetch, URL, AbortSignal, setTimeout, clearTimeout,
    getComputedStyle: node => ({ objectFit: node.fit, opacity: node.opacity, transform: node.transform }),
    DOMMatrix: class { constructor(transform) { this.a = Number(transform.slice(7).split(',')[0]) } },
    get innerWidth() { return state.viewportWidth }
  })
  return { page, state, storage, run: () => verify(page) }
}

const good = browser()
const report = JSON.parse(JSON.stringify(await good.run()))
assert.equal(report.pass, true)
assert.equal(report.version, expectedVersion)
assert.equal(report.treeSha256, expectedTreeSha256)
assert.equal(report.sourceCommit, sourceCommit)
assert.equal(report.releaseStamp, releaseStamp)
assert.equal(report.realProfile, true)
assert.ok(Number.isFinite(Date.parse(report.completedAt)))
assert.deepEqual(report.errors, [])
assert.deepEqual(report.views.map(view => view.viewportWidth), [1440, 390, 414, 768])
assert.equal(good.state.profileWaits, 4)
for (const view of report.views) {
  assert.equal(view.scrollWidth, view.viewportWidth - 10, 'scroll width must not overwrite the configured viewport width')
  assert.equal(view.realProfile, true)
  assert.equal(new Set(view.slides).size, 6)
  assert.equal(view.bomParts, 13)
  assert.equal(view.explodedAndAssembled, true)
  assert.equal(view.cards, 12)
  assert.equal(view.loaded, 12)
  assert.equal(view.detailImages.length, 12)
  assert.equal(view.quoteImages.length, 12)
  assert.ok(view.quoteImages.every(image => image.loaded && image.fit === 'contain'))
  assert.equal(view.logo, true)
  assert.equal(view.wrongBrand, false)
  assert.equal(view.faviconStatus, 200)
}
assert.ok(good.state.calls.includes('/agent/company-site/public/site-config?locale=zh-CN'))
assert.equal(good.state.calls.filter(path => path === '/release-provenance.json').length, 2, 'check release before and after the browser pass')
assert.equal(good.storage.get('lundu-inquiry-list'), 'existing local draft')
assert.equal(good.state.handlers.size, 0, 'remove the pageerror listener after the run')

for (const fault of ['version', 'tree', 'release-metadata', 'draft-profile', 'five-slides', 'duplicate-slide', 'bom-parts', 'products', 'broken-product', 'wrong-detail', 'cropped-quote', 'hidden-products', 'overflow', 'favicon-html', 'pageerror', 'console-error', 'write']) {
  const scenario = browser(fault)
  await assert.rejects(scenario.run(), error => {
    assert.equal(error.report.pass, false, fault)
    assert.ok(error.report.errors.length > 0, fault)
    return true
  }, `${fault} must block release acceptance`)
  assert.equal(scenario.storage.get('lundu-inquiry-list'), 'existing local draft', `${fault}: restore the local draft on failure`)
  if (fault === 'write') assert.equal(scenario.state.writeAborted, true)
}

console.log('PASS: real published-profile waits, four-view release evidence, and browser defect rejection')
