import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const copilot = await readFile(new URL('../eiscore-base/src/components/AiCopilot.vue', import.meta.url), 'utf8')
const createStart = 'const createWorkflowAppFromAi = async'
const createEnd = String.fromCharCode(10) + 'const createWorkflowDefinitionForApp'
const createWorkflow = copilot.slice(copilot.indexOf(createStart), copilot.indexOf(createEnd, copilot.indexOf(createStart)))
assert.ok(createWorkflow.startsWith(createStart), 'AI workflow app creation must be present')

let request
const context = vm.createContext({
  normalizeWorkflowBool: (value, fallback) => value == null ? fallback : Boolean(value),
  getAppCenterProfileHeaders: (prefer) => ({ Prefer: prefer }),
  requestWorkflowJson: async (url, options) => { request = { url, options }; return [{ id: 'generated-app' }] },
  getFirstRow: (value) => Array.isArray(value) ? value[0] : value
})
const generated = await vm.runInContext(createWorkflow + String.fromCharCode(10) + 'createWorkflowAppFromAi({ name: ' + "'AI workflow', description: '', xml: '<bpmn />', meta: {} })", context)

assert.equal(request.url, '/apps')
assert.equal(request.options.body.app_type, 'workflow')
assert.equal(request.options.body.status, 'draft')
assert.equal(Object.hasOwn(request.options.body, 'category_id'), false, 'AI workflow creation must not invent an optional classification foreign key')
assert.equal(generated.id, 'generated-app')

console.log('PASS: AI workflow app creation leaves its optional category unset')
