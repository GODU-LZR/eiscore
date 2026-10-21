import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isAppCenterRouteAvailable } from '../../eiscore-apps/src/domain/standalone-entry-policy.mjs'

const yayu = {
  modules: { apps: true },
  features: { appCenterVisible: false, flashHarness: true }
}
assert.equal(isAppCenterRouteAvailable('/', yayu), false)
assert.equal(isAppCenterRouteAvailable('/app/demo', yayu), false)
assert.equal(isAppCenterRouteAvailable('/app/demo', yayu, { query: { flash: '1' } }), true)
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

console.log('PASS: app center route guard and created-row refresh behavior match the tenant policy')
