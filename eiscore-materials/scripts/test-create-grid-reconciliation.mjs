import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../package.json', import.meta.url))
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')
const sourceRoot = new URL('../../', import.meta.url)
const source = async path => readFile(new URL(path, sourceRoot), 'utf8')
const runHandler = async (path, handler, context) => {
  const code = (await source(path)).replace(/\r\n/g, '\n')
  const start = code.indexOf(`const ${handler} = async () => {`)
  assert.ok(start >= 0, `${path}: handler exists`)
  const end = code.indexOf('\n}\n', start) + 2
  return vm.runInNewContext(`${code.slice(start, end)}\n${handler}()`, context)
}
const makeContext = ({ insert = true, failCreate = false, failRead = false, saved = {}, readRow = saved } = {}) => {
  const requests = []
  const inserted = []
  const notices = []
  let reloads = 0
  const context = {
    console: { error() {} },
    ElMessage: Object.fromEntries(['success', 'error', 'warning', 'info'].map(key => [key, message => notices.push([key, message])])),
    request: async options => {
      requests.push(options)
      if (options.method === 'post' && failCreate) throw new Error('write rejected')
      if (options.method === 'get' && failRead) throw new Error('read unavailable')
      return options.method === 'get' ? [readRow] : [saved]
    },
    gridRef: { value: {
      prependRow: row => { inserted.push(row); return insert },
      loadData: async () => { reloads += 1 },
      reload: async () => { reloads += 1 }
    } }
  }
  return { context, requests, inserted, notices, reloads: () => reloads }
}

for (const insert of [true, false]) {
  for (const moduleName of ['eiscore-hr', 'eiscore-materials']) {
    const saved = { id: 812, name: 'persisted', category: 'fire', properties: { server: true } }
    const test = makeContext({ insert, saved })
    Object.assign(test.context, {
      props: { category: 'fire' }, normalizeCategoryCode: value => value,
      buildMaterialCode: async () => 'fire.0812',
      currentUser: { value: 'test' }, currentDeptId: { value: null },
      app: { value: { apiUrl: '/raw_materials', includeProperties: true } }, appProfile: { value: 'public' }
    })
    const path = moduleName === 'eiscore-hr' ? 'eiscore-hr/src/components/HrAppGrid.vue' : 'eiscore-materials/src/components/MaterialAppGrid.vue'
    await runHandler(path, 'handleCreate', test.context)
    assert.equal(test.requests[0].headers.Prefer, 'return=representation')
    assert.equal(test.inserted[0], saved, 'Only the persisted server representation is inserted')
    assert.equal(test.reloads(), insert ? 0 : 1, 'Reload only when the grid rejects local reconciliation')
    assert.equal(test.notices.some(([type]) => type === 'error'), false)
  }
}

const user = makeContext({ saved: { id: 901 }, readRow: { id: 901, full_name: 'persisted', roles: [{ id: 'role' }], created_at: '2026-10-21' } })
Object.assign(user.context, { roleOptions: { value: [{ value: 'role' }] } })
await runHandler('eiscore-hr/src/views/HrUserManage.vue', 'handleCreate', user.context)
assert.deepEqual(user.requests.map(row => row.url), ['/users', '/user_roles', '/v_users_manage'])
assert.equal(user.requests[0].headers.Prefer, 'return=representation')
assert.equal(user.inserted[0].roles[0].id, 'role', 'Insert the role-enriched read model after binding')
assert.equal(user.reloads(), 0)

for (const direction of ['In', 'Out']) {
  for (const failRead of [false, true]) {
    const saved = { id: 'confirmed-uuid' }
    const readRow = { ...saved, material_name: 'server material', warehouse_name: 'server warehouse', draft_type: direction.toLowerCase(), created_at: '2026-10-21' }
    const test = makeContext({ saved, readRow, failRead })
    const bindings = []
    Object.assign(test.context, {
      drawer: { visible: true, loading: false, form: {
        material_id: 1, warehouse_id: 'warehouse', io_type: direction === 'In' ? '采购入库' : '销售出库',
        batch_no: 'batch', batch_id: 'batch-id', quantity: 5, unit: '个'
      } },
      normalizeTypeName: value => value, operatorName: { value: 'tester' },
      buildWorkflowProps: () => ({}), workflowContext: { value: { active: false } },
      ensureDraftWorkflowBinding: async id => bindings.push(id),
      pendingOutboundContext: { value: null }, loadPendingSalesOutbounds: async () => {}, loadBatches: () => {},
      getErrorMessage: error => error.message
    })
    await runHandler(`eiscore-materials/src/views/InventoryStock${direction}.vue`, `submitStock${direction}`, test.context)
    assert.deepEqual(bindings, [saved.id], 'Workflow binding is retained')
    assert.deepEqual(test.requests.map(row => row.url), ['/inventory_drafts', '/v_inventory_drafts'])
    assert.equal(test.requests[1].params.id, `eq.${saved.id}`)
    assert.equal(test.inserted.length, failRead ? 0 : 1)
    if (!failRead) assert.equal(test.inserted[0], readRow, 'Never insert the incomplete write model')
    assert.equal(test.reloads(), failRead ? 1 : 0)
    assert.equal(test.context.drawer.loading, false)
  }
}

const rejected = makeContext({ failCreate: true })
await runHandler('eiscore-hr/src/components/HrAppGrid.vue', 'handleCreate', rejected.context)
assert.equal(rejected.inserted.length, 0)
assert.equal(rejected.notices.some(([type]) => type === 'success'), false, 'Rejected writes cannot report success')

for (const path of [
  'eiscore-hr/src/components/eis-data-grid-v2/index.vue',
  'eiscore-materials/src/components/eis-data-grid-v2/index.vue',
  'eiscore-hr/src/components/HrAppGrid.vue',
  'eiscore-hr/src/views/HrUserManage.vue',
  'eiscore-hr/src/views/HrAttendanceView.vue',
  'eiscore-materials/src/components/MaterialAppGrid.vue',
  'eiscore-materials/src/components/HrStyleAppGrid.vue',
  'eiscore-materials/src/components/AppCenterGrid.vue',
  'eiscore-materials/src/views/InventoryStockIn.vue',
  'eiscore-materials/src/views/InventoryStockOut.vue',
  'eiscore-materials/src/views/BatchNoRuleManager.vue'
]) {
  const { descriptor, errors } = parse(await source(path), { filename: path })
  assert.equal(errors.length, 0, path)
  compileScript(descriptor, { id: path })
  assert.equal(compileTemplate({ source: descriptor.template.content, filename: path, id: path }).errors.length, 0, path)
}

console.log('PASS HR/material saved rows, read-model reconciliation, fallback, failed writes, and Vue syntax')
