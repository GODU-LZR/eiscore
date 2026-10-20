import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

for (const [file, start, end, types] of [
  ['AppDashboard.vue', 'async function createApp()', '\nfunction getIconComponent', ['workflow', 'data', 'flash']],
  ['AppConfigCenter.vue', 'const createApp = async', '\nconst navigateToBuilder', ['workflow', 'data', 'flash', 'custom']]
]) {
  const source = await readFile(new URL(`../eiscore-apps/src/views/${file}`, import.meta.url), 'utf8')
  const body = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
  assert.ok(body.startsWith(start), `${file}: createApp handler must exist`)
  for (const appType of types) {
    let sent
    const creating = { value: false }
    const context = vm.createContext({
      newAppForm: { value: { name: 'Category-independent app', app_type: appType, icon: 'Grid', description: '' } },
      creating,
      getToken: () => 'test-token',
      getAppCenterHeaders: () => ({}),
      ensureSemanticConfig: (value) => value,
      toAbsoluteApiUrl: (value) => value,
      apiBase: '/api',
      axios: { post: async (url, payload, options) => { sent = { url, payload, options }; throw new Error('Stop after capturing the outgoing request') } },
      isCreateAppForbidden: () => false,
      ElMessage: { warning() {}, error() {} }
    })
    await vm.runInContext(`${body}\ncreateApp()`, context)
    assert.equal(sent?.url, '/api/apps', `${file}/${appType}: sends an application create request`)
    assert.equal(sent.payload.app_type, appType)
    assert.equal(sent.payload.status, 'draft')
    assert.equal(sent.options.headers.Prefer, 'return=representation', `${file}/${appType}: response must include the created app for builder navigation`)
    assert.equal(Object.hasOwn(sent.payload, 'category_id'), false, `${file}/${appType}: must not invent an optional classification foreign key`)
    assert.equal(creating.value, false)
  }
}
console.log('PASS: both app creation handlers omit optional category IDs for all supported application types')
