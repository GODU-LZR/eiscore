import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const contractPath = resolve(root, 'agent-harness/plugin-contract.v1.json')
const catalogPath = resolve(root, 'agent-harness/MIGRATION_CATALOG.json')
const registryPath = resolve(root, 'agent-harness/plugin-registry.js')
const gatewayPath = resolve(root, 'realtime/harness-gateway.js')
const toolGatewayPath = resolve(root, 'realtime/harness-tool-gateway.js')
const runtimePath = resolve(root, 'realtime/harness-runtime.js')
const capabilityPath = resolve(root, 'realtime/harness-capability-http.js')
const queryToolsPath = resolve(root, 'realtime/harness-query-tools.js')
const routerPath = resolve(root, 'realtime/http-router.js')
assert.equal(existsSync(contractPath), true, 'Harness plugin contract is required')
assert.equal(existsSync(catalogPath), true, 'Harness migration catalog is required')
assert.equal(existsSync(registryPath), true, 'Harness plugin registry is required')
assert.equal(existsSync(gatewayPath), true, 'Harness gateway is required')
assert.equal(existsSync(toolGatewayPath), true, 'Harness tool gateway is required')
assert.equal(existsSync(queryToolsPath), true, 'Harness query tools are required')
assert.equal(existsSync(routerPath), true, 'Harness HTTP router is required')
const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const router = readFileSync(routerPath, 'utf8')
const toolGateway = readFileSync(toolGatewayPath, 'utf8')
const runtime = readFileSync(runtimePath, 'utf8')
const capabilityHttp = readFileSync(capabilityPath, 'utf8')
const { TOOL_GATEWAY_CAPABILITIES } = require(toolGatewayPath)
const { ROUTE_CAPABILITIES } = require(capabilityPath)
const { CORE_HTTP_ROUTE_MANIFEST } = require(routerPath)
const chatCapabilities = new Set([
  'eiscore_enterprise_query', 'eiscore_grid_query', 'eiscore_twin_chat',
  'eiscore_workflow_context', 'eiscore_sales_context', 'eiscore_document_plan',
  'eiscore_flash_read', 'eiscore_engineering_context', 'eiscore_site_sales'
])
assert.equal(contract.plugins.length, 9)
assert.equal(catalog.plugins.length, contract.plugins.length)
assert.deepEqual(catalog.plugins.map(({ plugin_id }) => plugin_id).sort(), contract.plugins.map(({ plugin_id }) => plugin_id).sort())
const contractCapabilities = contract.plugins.flatMap(({ capabilities }) => capabilities).sort()
const catalogCapabilities = catalog.plugins.flatMap(({ capabilities }) => capabilities).sort()
const implementedCapabilities = [...(catalog.tool_execution.implemented_capabilities || [])].sort()
assert.deepEqual(catalogCapabilities, contractCapabilities, 'migration catalog capabilities must match the plugin contract')
assert.deepEqual(implementedCapabilities, contractCapabilities, 'implemented capability inventory must cover the plugin contract exactly')
assert.deepEqual(
  [...TOOL_GATEWAY_CAPABILITIES].sort(),
  contractCapabilities,
  'Tool Gateway binding inventory must match every capability exactly'
)
const multimodalCapabilities = contractCapabilities.filter((capability) => capability.startsWith('eiscore_multimodal_')).sort()
assert.deepEqual(
  Object.values(ROUTE_CAPABILITIES).sort(),
  multimodalCapabilities,
  'multimodal HTTP route binding inventory must match every multimodal capability exactly'
)
for (const plugin of contract.plugins) {
  assert.ok(plugin.plugin_id && plugin.agent_id && plugin.capabilities?.length)
  assert.ok(plugin.input_schema && plugin.output_schema)
  assert.equal(plugin.audit_required, true)
  if (plugin.confirm_required) assert.equal(plugin.idempotency_required, true)
  for (const capability of plugin.capabilities) {
    const policy = plugin.capability_policies?.[capability]
    assert.ok(policy, `capability policy missing: ${plugin.plugin_id}.${capability}`)
    assert.ok(policy.intent && policy.object, `capability intent/object missing: ${plugin.plugin_id}.${capability}`)
    assert.ok(policy.input_schema && policy.output_schema, `capability schemas missing: ${plugin.plugin_id}.${capability}`)
    assert.equal(policy.input_schema.type, 'object', `capability input schema must be an object: ${plugin.plugin_id}.${capability}`)
    assert.equal(policy.output_schema.type, 'object', `capability output schema must be an object: ${plugin.plugin_id}.${capability}`)
    assert.notEqual(policy.input_schema.additionalProperties, true, `capability input must not accept arbitrary top-level fields: ${plugin.plugin_id}.${capability}`)
    for (const branch of policy.input_schema.oneOf || []) {
      assert.notEqual(branch.additionalProperties, true, `capability input branch must not accept arbitrary top-level fields: ${plugin.plugin_id}.${capability}`)
    }
    if (chatCapabilities.has(capability)) {
      assert.equal(policy.chat_input_schema?.type, 'object', `chat input schema missing: ${plugin.plugin_id}.${capability}`)
      assert.equal(policy.chat_input_schema?.additionalProperties, false, `chat input must reject arbitrary top-level fields: ${plugin.plugin_id}.${capability}`)
      assert.deepEqual(policy.chat_input_schema?.required, ['messages'], `chat messages must be required: ${plugin.plugin_id}.${capability}`)
      assert.equal(policy.chat_output_schema?.type, 'object', `chat output schema missing: ${plugin.plugin_id}.${capability}`)
    }
    assert.ok(Array.isArray(policy.permissions) && policy.permissions.length > 0, `capability permissions missing: ${plugin.plugin_id}.${capability}`)
    assert.ok(policy.risk && policy.audit_required === true && Number.isInteger(policy.timeout_ms) && policy.timeout_ms <= plugin.timeout_ms, `capability risk/audit/timeout missing: ${plugin.plugin_id}.${capability}`)
    if (policy.confirm_required) assert.equal(policy.idempotency_required, true, `confirmed capability must be idempotent: ${plugin.plugin_id}.${capability}`)
  }
  const catalogPlugin = catalog.plugins.find(({ plugin_id }) => plugin_id === plugin.plugin_id)
  assert.deepEqual(catalogPlugin, { plugin_id: plugin.plugin_id, agent_id: plugin.agent_id, capabilities: plugin.capabilities })
}
for (const route of catalog.production_routes) {
  const escapedPath = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert.match(router, new RegExp(`exact\\('${route.method}', '${escapedPath}', '${route.handler}'\\)`), `catalog route missing: ${route.method} ${route.path}`)
}
const catalogHarnessRoutes = catalog.production_routes
  .map(({ method, path, handler }) => ({ method, path, handler }))
  .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
const manifestHarnessRoutes = CORE_HTTP_ROUTE_MANIFEST
  .filter(({ handler }) => String(handler || '').startsWith('harness.'))
  .map(({ method, path, handler }) => ({ method, path, handler }))
  .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
assert.deepEqual(manifestHarnessRoutes, catalogHarnessRoutes, 'Harness canonical route manifest must match migration catalog exactly')
assert.equal(catalog.legacy_runtime.production_reachable, false)
for (const capability of catalog.tool_execution.implemented_capabilities || []) {
  const isMultimodal = capability.startsWith('eiscore_multimodal_')
  const bound = isMultimodal
    ? multimodalCapabilities.includes(capability) && runtime.includes('sanitizeMultimodalPayload') && capabilityHttp.includes('formatMultimodalResult')
    : toolGateway.includes(capability)
  assert.equal(bound, true, `implemented capability is not bound in Harness execution path: ${capability}`)
}
console.log('PASS: Harness migration switch gate baseline')
