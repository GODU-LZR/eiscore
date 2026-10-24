import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const extractHandler = (file, nextMarker) => {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = source.indexOf('const handleCreate = async () => {')
  const end = source.indexOf(nextMarker, start)
  assert.ok(start >= 0 && end > start, `create handler exists: ${file}`)
  return source.slice(start, end)
}

const savedRow = { id: 'saved-1', created_at: '2026-10-24T10:00:00Z' }

async function verifyAdapter({ file, marker, context, prependResult }) {
  const calls = []
  const grid = {
    prependRow: async row => { calls.push(['prepend', row]); return prependResult },
    loadData: async () => calls.push(['reload'])
  }
  context.gridRef = { value: grid }
  context.request = async config => {
    calls.push(['request', config])
    return [savedRow]
  }
  context.ElMessage = Object.fromEntries(['warning', 'success', 'error'].map(name => [name, (...args) => calls.push([name, ...args])]))
  vm.runInNewContext(`${extractHandler(file, marker)}\nglobalThis.create = handleCreate`, context)
  await context.create()
  const post = calls.find(([kind]) => kind === 'request')?.[1]
  assert.equal(post?.method, 'post')
  assert.equal(post?.headers?.Prefer, 'return=representation')
  assert.equal(calls.find(([kind]) => kind === 'prepend')?.[1], savedRow)
  assert.equal(calls.filter(([kind]) => kind === 'reload').length, prependResult ? 0 : 1)
}

for (const prependResult of [true, false]) {
  await verifyAdapter({
    file: '../../eiscore-apps/src/components/AppCenterGrid.vue',
    marker: '\n\nconst goApps',
    prependResult,
    context: {
      apiUrl: { value: '/app_data?app_id=eq.1' },
      canCreate: { value: true },
      configRef: { value: { fieldDefaults: { name: '新记录' } } },
      includeProperties: { value: true },
      schemaName: { value: 'app_data' },
      workflowContext: { value: { active: false } },
      applyWorkflowBindingToPayload: payload => payload
    }
  })
  await verifyAdapter({
    file: '../../eiscore-hr/src/components/HrAppGrid.vue',
    marker: '\n\nconst goApps',
    prependResult,
    context: {}
  })
  await verifyAdapter({
    file: '../../eiscore-materials/src/components/MaterialAppGrid.vue',
    marker: '\n\nonMounted',
    prependResult,
    context: {
      props: { category: 'materials' },
      normalizeCategoryCode: value => value,
      buildMaterialCode: async () => 'MAT-0001',
      app: { value: { includeProperties: true, writeUrl: '/raw_materials', apiUrl: '/raw_materials', profile: 'public' } },
      appProfile: { value: 'public' },
      currentUser: { value: 'tester' },
      currentDeptId: { value: null }
    }
  })
}

assert.match(fs.readFileSync(new URL('../../eiscore-apps/src/components/AppCenterGrid.vue', import.meta.url), 'utf8'), /schemaName\.value === 'app_data' \? 'created_at\.desc\.nullslast,id\.desc'/)
assert.match(fs.readFileSync(new URL('../../eiscore-hr/src/components/HrAppGrid.vue', import.meta.url), 'utf8'), /app\.defaultOrder \|\| 'created_at\.desc\.nullslast,id\.desc'/)
assert.match(fs.readFileSync(new URL('../../eiscore-materials/src/components/MaterialAppGrid.vue', import.meta.url), 'utf8'), /app\.defaultOrder \|\| 'created_at\.desc\.nullslast,id\.desc'/)

console.log('PASS app center, HR and materials create adapters return rows and reload when safe prepend is unavailable')
