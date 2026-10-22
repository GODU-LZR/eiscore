import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { isAppCenterRouteAvailable } from '../../eiscore-apps/src/domain/standalone-entry-policy.mjs'

const yayu = {
  modules: { apps: true },
  features: { appCenterVisible: false, flashHarness: true }
}
assert.equal(isAppCenterRouteAvailable('/', yayu), false)
assert.equal(isAppCenterRouteAvailable('/app/demo', yayu), false)
assert.equal(isAppCenterRouteAvailable('/app/demo', yayu, { query: { flash: '1' } }), true)
assert.equal(isAppCenterRouteAvailable('/app', yayu, { query: { flash: '1' } }), false)
assert.equal(isAppCenterRouteAvailable('/app/demo/record/1', yayu, { query: { flash: '1' } }), false)
assert.equal(isAppCenterRouteAvailable('/app/demo', yayu, { query: { flash: '0' } }), false)
assert.equal(isAppCenterRouteAvailable('/flash-builder/demo', yayu), true)
assert.equal(isAppCenterRouteAvailable('/preview/flash-draft', yayu), true)

const noHarness = structuredClone(yayu)
noHarness.features.flashHarness = false
assert.equal(isAppCenterRouteAvailable('/flash-builder/demo', noHarness), false)
assert.equal(isAppCenterRouteAvailable('/preview/flash-draft', noHarness), false)
assert.equal(isAppCenterRouteAvailable('/app/demo', noHarness, { query: { flash: '1' } }), false)

const visible = { modules: { apps: true }, features: { appCenterVisible: true } }
assert.equal(isAppCenterRouteAvailable('/', visible), true)
assert.equal(isAppCenterRouteAvailable('/app/demo', visible), true)
assert.equal(isAppCenterRouteAvailable('/', { modules: { apps: false }, features: {} }), false)

const appCenterSource = readFileSync(resolve(import.meta.dirname, '../../eiscore-apps/src/components/AppCenterGrid.vue'), 'utf8')
const createFlow = appCenterSource.slice(appCenterSource.indexOf('const handleCreate'), appCenterSource.indexOf('const goApps'))
assert.match(createFlow, /const prepended = created[\s\S]*?prependRow\(created\)/)
assert.match(createFlow, /if \(!prepended && gridRef\.value\?\.loadData\)/)
const runtimeSource = readFileSync(resolve(import.meta.dirname, '../../eiscore-apps/src/views/AppRuntime.vue'), 'utf8')
assert.match(runtimeSource, /route\.query\.flash === '1' && appData\.value\?\.app_type !== 'flash'/)

const runtimeLoadSource = runtimeSource.slice(runtimeSource.indexOf('async function loadAppData()'), runtimeSource.indexOf('async function refreshWorkflowData()'))
const mountedSource = runtimeSource.slice(runtimeSource.indexOf('onMounted(async () => {'), runtimeSource.indexOf('onUnmounted(() => {'))
for (const appType of ['flash', 'data', 'workflow']) {
  let mounted
  const calls = []
  const context = {
    loading: { value: false }, flashRuntimeReady: { value: false }, flashRuntimeError: { value: '' },
    routeAppId: { value: 'demo' }, resolvedAppId: { value: '' }, appData: { value: null },
    route: { query: { flash: '1' } }, getAuthToken: () => 'test-token',
    resolveAppIdByRoutePath: async () => '', getAppCenterHeaders: () => ({}), parseJsonObject: () => ({}),
    axios: { get: async () => ({ data: [{ id: 'demo', app_type: appType }] }) },
    resolveAppAclModule: () => '', hasPerm: () => true,
    prepareFlashRuntimeSource: async () => calls.push('prepare'),
    ElMessage: { warning: () => calls.push('warning'), error: () => calls.push('error') },
    router: { push: () => calls.push('redirect') },
    readCurrentActor: () => {}, onMounted: (callback) => { mounted = callback },
    startWorkflowAutoAdvanceWatcher: () => calls.push('watcher')
  }
  for (const name of ['loadWorkflowBusinessApps', 'initializeBpmnViewer', 'loadStateMappings', 'loadWorkflowPolicy', 'loadWorkflowTransitionRules', 'ensureWorkflowDefinitionId', 'refreshWorkflowData']) {
    context[name] = async () => calls.push(name)
  }
  runInNewContext(`${runtimeLoadSource}\n${mountedSource}`, context)
  await mounted()
  assert.equal(context.loading.value, false)
  if (appType === 'flash') {
    assert.equal(context.appData.value.app_type, 'flash')
    assert.deepEqual(calls, ['prepare', 'watcher'])
  } else {
    assert.equal(context.appData.value, null, `reject ${appType} before runtime loading`)
    assert.deepEqual(calls, ['warning', 'redirect'])
  }
}

const builderSource = readFileSync(resolve(import.meta.dirname, '../../eiscore-apps/src/views/FlashBuilder.vue'), 'utf8')
const publishSource = builderSource.split('\n').find((line) => line.startsWith('const publishApp = '))
let publishedRoute
let publishedNavigation
const publish = runInNewContext(`${publishSource}; publishApp`, {
  appData: { value: { name: 'test', config: {}, source_code: {} } }, appId: { value: 'demo' }, publishing: { value: false },
  draftRead: async () => '<template><div>test</div></template>', normalizeDraftSourceText: (value) => value,
  waitPreview: async () => true, snapshot: () => '<html><body>test</body></html>',
  sourceWithDraft: () => ({}), normalizeSourceCode: (value) => value, normalizeConfig: (value) => value, flashConfig: (value) => value,
  user: () => ({ username: 'test' }), audit: async () => {},
  callFlashTool: async (tool, args) => { if (tool === 'flash.route.upsert') publishedRoute = args.routePath; return {} },
  ElMessage: { success: () => {}, error: (message) => { throw new Error(message) } },
  router: { push: (location) => { publishedNavigation = location } }
})
await publish()
assert.equal(publishedRoute, '/apps/app/demo?flash=1')
assert.equal(publishedRoute, `/apps${publishedNavigation.path}?${new URLSearchParams(publishedNavigation.query)}`)

const { createRouter, createMemoryHistory } = createRequire(new URL('../../eiscore-apps/package.json', import.meta.url))('vue-router')
const testRouter = createRouter({ history: createMemoryHistory(), routes: [{ path: '/app/:appId', component: {} }] })
const dashboardSource = readFileSync(resolve(import.meta.dirname, '../../eiscore-apps/src/views/AppDashboard.vue'), 'utf8')
const routeConversionSource = dashboardSource.slice(dashboardSource.indexOf('const toAppRouterPath = '), dashboardSource.indexOf('const resolvePublishedRoutePath = '))
const navigationSource = dashboardSource.slice(dashboardSource.indexOf('const pushAppRoute = '), dashboardSource.indexOf('async function createApp()'))
const openAppSource = dashboardSource.slice(dashboardSource.indexOf('async function openApp(app)'), dashboardSource.indexOf('async function loadApps()'))
for (const savedRoute of ['/apps/app/demo?flash=1&source=published#preview', '/apps/app/demo', '', null]) {
  let navigation
  const openApp = runInNewContext(`${routeConversionSource}\n${navigationSource}\n${openAppSource}\nopenApp`, {
    router: { resolve: testRouter.resolve, push: (target) => { navigation = target; return Promise.resolve() } },
    resolvePublishedRoutePath: async () => { if (savedRoute === null) throw new Error('unavailable'); return savedRoute },
    startNavigationLoading: () => true, clearNavigationLoading: () => {}, rememberAppTabTitle: () => {},
    getDisplayName: (app) => app.name, buildAppRouteQuery: (app) => ({ appName: app.name }),
    resolveAppAclModule: () => '', hasPerm: () => true
  })
  await openApp({ id: 'demo', name: 'Test app', app_type: 'flash', status: 'published' })
  assert.equal(navigation.path, '/app/demo')
  assert.equal(navigation.query.flash, '1')
  assert.equal(navigation.query.appName, 'Test app')
  assert.equal(navigation.query.source || '', savedRoute?.includes('source=published') ? 'published' : '')
  assert.equal(navigation.hash, savedRoute?.includes('#preview') ? '#preview' : '')
}

console.log('PASS: app center route guard, Flash publishing/runtime and created-row refresh match the tenant policy')
