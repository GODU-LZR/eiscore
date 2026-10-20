import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const main = await readFile(new URL('../eiscore-apps/src/main.js', import.meta.url), 'utf8')
const startup = main.slice(main.indexOf('const MICRO_APP_NAME'), main.indexOf('function shouldRenderStandalone'))
assert.ok(startup.startsWith('const MICRO_APP_NAME'), 'The actual apps bootstrap must be exercised')

for (const [target, expectedPreview, expectedRewrite] of [
  ['/apps/index.html?eis_flash_preview=1&appId=demo&_t=123', true, true],
  ['/apps/index.html?eis_flash_preview=1&appId=quoted%26app%3F&_t=456#section', true, true],
  ['/apps/preview/flash-draft?appId=demo', true, false],
  ['/apps/index.html?appId=demo', false, false],
  ['/apps/index.html?eis_flash_preview=0&appId=demo', false, false],
  ['/apps/index.html?eis_flash_preview=true&appId=demo', false, false],
  ['/apps/?eis_flash_preview=1&appId=demo', false, false],
  ['/apps/flash-builder/demo?eis_flash_preview=1', false, false]
]) {
  const original = new URL(target, 'https://huizong.invalid')
  const location = new URL(original)
  const state = { retained: true }
  let rewrites = 0
  let authRedirect = ''
  const context = vm.createContext({
    URL, URLSearchParams,
    window: { location, history: { state, replaceState(nextState, title, nextUrl) {
      assert.equal(nextState, state, 'Existing browser history state is preserved')
      assert.equal(title, '')
      const next = new URL(nextUrl, location)
      location.href = next.href
      rewrites++
    } } },
    document: { querySelector: () => null },
    qiankunWindow: {},
    getToken: () => '',
    isTokenExpired: () => true,
    clearAuthAndRedirect: path => { authRedirect = path }
  })
  vm.runInContext(startup, context)
  assert.equal(rewrites, Number(expectedRewrite), target)
  assert.equal(vm.runInContext('isStandalonePreviewRoute()', context), expectedPreview, target)
  assert.equal(vm.runInContext('ensureStandaloneAuth()', context), expectedPreview, target)
  assert.equal(authRedirect, expectedPreview ? '' : '/login', 'Unmarked entries retain authentication')
  if (expectedRewrite) {
    assert.equal(location.pathname, '/apps/preview/flash-draft')
    assert.equal(location.searchParams.get('appId'), original.searchParams.get('appId'))
    assert.equal(location.searchParams.get('_t'), original.searchParams.get('_t'))
    assert.equal(location.hash, original.hash)
  }
}

const builder = await readFile(new URL('../eiscore-apps/src/views/FlashBuilder.vue', import.meta.url), 'utf8')
const runtime = await readFile(new URL('../eiscore-apps/src/views/AppRuntime.vue', import.meta.url), 'utf8')
const builderEntry = builder.match(/^const PREVIEW_ENTRY = .+$/m)?.[0]
const builderUrl = builder.match(/^const previewUrl = computed\(.+$/m)?.[0]
const runtimeUrl = runtime.match(/const flashRuntimeUrl = computed\(\(\) => \{[\s\S]*?\n\}\)/)?.[0]
assert.ok(builderEntry && builderUrl && runtimeUrl, 'Both actual iframe URL computations must be exercised')
for (const [source, outputName] of [[`${builderEntry}\n${builderUrl}`, 'previewUrl'], [runtimeUrl, 'flashRuntimeUrl']]) {
  const appId = 'f759a1d0-8a65-43f3-b2e3-74a256c5c4e4&draft?'
  const context = vm.createContext({
    computed: read => read(),
    appId: { value: appId }, previewNonce: { value: 42 },
    runtimeAppId: { value: appId }, flashRuntimeNonce: { value: 42 }, flashRuntimeReady: { value: true }
  })
  const actual = new URL(vm.runInContext(`${source}\n${outputName}`, context), 'https://huizong.invalid')
  assert.equal(actual.pathname, '/apps/index.html', 'Iframes request the actual static sub-app entry')
  assert.equal(actual.searchParams.get('eis_flash_preview'), '1')
  assert.equal(actual.searchParams.get('appId'), appId, 'Scoped app IDs are safely retained')
  assert.equal(actual.searchParams.get('_t'), '42')
}
console.log('PASS: explicit static preview entries normalize before auth/route detection; normal app entries retain authentication; both iframe URLs retain app scope')
