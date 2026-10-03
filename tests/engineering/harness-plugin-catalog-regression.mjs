import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_PLUGINS } from '../../agent-harness/dsh-http-bridge.mjs'
import { loadPluginRegistry } from '../../agent-harness/plugin-registry.js'

const root = resolve(import.meta.dirname, '../..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const contract = JSON.parse(read('agent-harness/plugin-contract.v1.json'))
const catalog = JSON.parse(read('agent-harness/MIGRATION_CATALOG.json'))
const contractPlugins = contract.plugins.map((plugin) => plugin.plugin_id)
const catalogPlugins = catalog.plugins.map((plugin) => plugin.plugin_id)
const registry = loadPluginRegistry()
const compose = read('deploy/lundu/compose.yml')
const productionCompose = read('docker-compose.prod.yml')
const composeMatch = compose.match(/HARNESS_PLUGINS:\s*([^\r\n]+)/)

assert.ok(composeMatch, 'Lundu Compose must declare HARNESS_PLUGINS')
const composePlugins = composeMatch[1].split(',').map((plugin) => plugin.trim()).filter(Boolean)
assert.deepEqual(DEFAULT_PLUGINS, contractPlugins, 'DSH Bridge defaults must match the plugin contract')
assert.deepEqual(catalogPlugins, contractPlugins, 'migration catalog must match the plugin contract')
assert.deepEqual(composePlugins, contractPlugins, 'Lundu Compose plugins must match the plugin contract')
const contractCapabilities = Object.fromEntries(contract.plugins.map((plugin) => [plugin.plugin_id, [...plugin.capabilities].sort()]))
const catalogCapabilities = Object.fromEntries(catalog.plugins.map((plugin) => [plugin.plugin_id, [...plugin.capabilities].sort()]))
const registryCapabilities = Object.fromEntries(registry.list().map((plugin) => [plugin.plugin_id, [...plugin.capabilities].sort()]))
assert.deepEqual(catalogCapabilities, contractCapabilities, 'migration catalog capabilities must match the plugin contract exactly')
assert.deepEqual(registryCapabilities, contractCapabilities, 'runtime registry capabilities must match the plugin contract exactly')
for (const source of [compose, productionCompose]) {
  assert.match(source, /BRIDGE_MAX_BODY_BYTES:\s*\"\$\{BRIDGE_MAX_BODY_BYTES:-2097152\}"/, 'Compose must expose the Bridge request body limit')
  assert.match(source, /BRIDGE_MAX_RESPONSE_BYTES:\s*\"\$\{BRIDGE_MAX_RESPONSE_BYTES:-2097152\}"/, 'Compose must expose the Bridge response limit')
}
assert.equal(new Set(contractPlugins).size, contractPlugins.length, 'plugin contract must not contain duplicate ids')
assert.equal(
  contract.plugins.reduce((count, plugin) => count + plugin.capabilities.length, 0),
  18,
  'the registered capability inventory must remain complete'
)

console.log('PASS: Harness plugin contract, migration catalog, Bridge defaults and Lundu Compose stay aligned')
