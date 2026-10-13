// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { buildGenericCard, cardFromScore, sortByAttention } from '../../shared/app-card-attention.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const readView = (module, view) => readFileSync(resolve(repoRoot, `eiscore-${module}/src/views/${view}.vue`), 'utf8')
const declaration = (source, name) => {
  const match = source.match(new RegExp(`(?:const ${name} =|async function ${name}\\(\\))[^]*?(?=\\r?\\n\\r?\\n(?:const |function |async function |onMounted))`))
  assert.ok(match, `Cannot extract ${name}`)
  return match[0]
}
const computed = (get) => ({ get value() { return get() } })
const keys = (cards) => Array.from(cards, (app) => app.key || app.id)
const expected = ['alpha', 'beta', 'gamma', 'hidden', 'restricted']
const fixture = () => expected.map((key) => ({ key, id: key, desc: key, perm: key === 'restricted' ? 'restricted' : null }))
const failures = []
const check = async (name, run) => {
  try {
    await run()
    console.log(`PASS: ${name}`)
  } catch (error) {
    failures.push(name)
    console.error(`FAIL: ${name}\n${error.message}`)
  }
}

const modules = [
  ['hr', 'HrApps', 'apps', null],
  ['materials', 'MaterialsApps', 'apps', 'inventory-dashboard'],
  ['sales', 'SalesApps', 'SALES_APPS', null],
  ['purchase', 'PurchaseApps', 'PURCHASE_APPS', 'dashboard'],
  ['production', 'ProductionApps', 'PRODUCTION_APPS', 'overview'],
  ['quality', 'QualityApps', 'QUALITY_APPS', 'dashboard'],
  ['equipment', 'EquipmentApps', 'EQUIPMENT_APPS', 'dashboard']
]

for (const [module, view, registryName, excluded] of modules) {
  await check(`${view}: loading, statistics, remount and permission changes preserve order`, () => {
    const source = readView(module, view)
    const mount = () => {
      const registry = fixture()
      if (excluded) registry.unshift({ key: excluded })
      const hidden = new Set()
      const denied = new Set()
      const rows = {}
      const cardLoading = { value: true }
      const cardMap = { value: Object.fromEntries(expected.map((key) => [key, cardFromScore({ score: 28 })])) }
      const sandbox = {
        [registryName]: registry, computed, cardLoading, cardMap, buildGenericCard, sortByAttention,
        displayVisibility: { value: {} },
        isAppVisible: (_visibility, moduleKey, key) => {
          assert.equal(moduleKey, module)
          return !hidden.has(key)
        },
        hasPerm: (permission) => !denied.has(permission),
        rowsOf: (key) => rows[key] || [],
        sourceKeyOf: (app) => app.sourceAppKey || app.key
      }
      const list = runInNewContext(`${declaration(source, 'visibleApps')}\nvisibleApps`, sandbox)
      const load = () => {
        for (const key of ['archives', ...expected]) rows[key] = [{ id: 1 }]
        cardMap.value = Object.fromEntries(expected.map((key, index) => [key, cardFromScore({
          score: [12, 99, 70, 28, 50][index],
          metrics: [{ label: '记录数', value: '1' }]
        })]))
        cardLoading.value = false
      }
      return { list, load, hidden, denied, registry }
    }

    const first = mount()
    assert.deepEqual(keys(first.list.value), expected, 'Initial registry order')
    first.load()
    assert.deepEqual(keys(first.list.value), expected, 'Statistics must update cards without moving them')
    const urgent = first.list.value.find((app) => app.key === 'beta').card
    assert.equal(urgent.attentionLevel, 'critical')
    assert.equal(urgent.metrics[0].value, '1')

    const second = mount()
    assert.deepEqual(keys(second.list.value), expected, 'Returning to a module starts in the same order')
    second.load()
    assert.deepEqual(keys(second.list.value), keys(first.list.value), 'Remount after statistics')
    second.hidden.add('hidden')
    second.denied.add('restricted')
    assert.deepEqual(keys(second.list.value), ['alpha', 'beta', 'gamma'], 'Filtering preserves relative order')
    assert.deepEqual(keys(second.registry), excluded ? [excluded, ...expected] : expected, 'Registry is not mutated')
  })
}

const dashboardSource = readView('apps', 'AppDashboard')
const mountDashboard = () => {
  let databaseRows = fixture().map((app) => ({ ...app, status: 'draft', app_type: 'data', config: {}, created_at: '2026-10-14T00:00:00Z' }))
  const apps = { value: [] }
  const requests = []
  const hidden = new Set()
  const denied = new Set()
  const sandbox = {
    apps, computed, cardFromScore, sortByAttention,
    displayVisibility: { value: {} },
    isAppVisible: (_visibility, module, key) => {
      assert.equal(module, 'apps')
      return !hidden.has(key)
    },
    parseAppConfig: (config) => config,
    isOntologyReadonlyApp: () => false,
    typeTextMap: { data: '数据应用' },
    statusTextMap: { draft: '草稿', published: '已发布', archived: '已归档' },
    apiBase: '/api', getToken: () => null, getAppCenterHeaders: () => ({}), toAbsoluteApiUrl: (url) => url,
    axios: { get: async (url, options) => {
      requests.push({ url, order: options.params.order })
      return { data: databaseRows.map((app) => ({ ...app })) }
    } },
    resolveAppAclModule: (app) => app.perm,
    hasPerm: (permission) => !denied.has(permission),
    warmAppRouteAssets: () => {},
    ElMessage: { error: (message) => { throw new Error(message) } }
  }
  const harness = runInNewContext([
    declaration(dashboardSource, 'getAppAttentionCard'),
    declaration(dashboardSource, 'attentionApps'),
    declaration(dashboardSource, 'loadApps'),
    '({ list: attentionApps, load: loadApps })'
  ].join('\n'), sandbox)
  return {
    ...harness, apps, requests, hidden, denied,
    setStatuses: (statuses) => { databaseRows = databaseRows.map((app, index) => ({ ...app, status: statuses[index] || 'draft' })) }
  }
}

await check('AppDashboard: API orders tied creation timestamps by unique id', async () => {
  const dashboard = mountDashboard()
  await dashboard.load()
  assert.equal(dashboard.requests[0].url, '/api/apps')
  assert.equal(dashboard.requests[0].order, 'created_at.desc,id.asc', 'A creation timestamp needs a unique tie-breaker')
})

await check('AppDashboard: publishing, archiving, remount and filtering preserve order', async () => {
  const dashboard = mountDashboard()
  await dashboard.load()
  assert.deepEqual(keys(dashboard.list.value), expected)
  dashboard.setStatuses(['published', 'archived', 'draft'])
  await dashboard.load()
  assert.deepEqual(keys(dashboard.list.value), expected, 'Changing status must not move application cards')
  assert.equal(dashboard.list.value.find((app) => app.id === 'beta').card.attentionLevel, 'silent')
  dashboard.setStatuses(['archived', 'draft', 'published'])
  await dashboard.load()
  assert.deepEqual(keys(dashboard.list.value), expected, 'Later status changes keep the same order')

  const remounted = mountDashboard()
  remounted.setStatuses(['archived', 'draft', 'published'])
  await remounted.load()
  assert.deepEqual(keys(remounted.list.value), keys(dashboard.list.value), 'Remount keeps application order')
  remounted.hidden.add('app:hidden')
  remounted.denied.add('app:restricted')
  await remounted.load()
  assert.deepEqual(keys(remounted.list.value), ['alpha', 'beta', 'gamma'], 'Visibility and ACL preserve relative order')
  assert.equal(remounted.apps.value.some((app) => app.id === 'restricted'), false, 'Unauthorized applications are filtered during loading')
})

assert.equal(failures.length, 0, `Card order regression failed: ${failures.join(', ')}`)
