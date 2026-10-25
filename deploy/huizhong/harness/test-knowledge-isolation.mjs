import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(import.meta.url)
const { loadPluginRegistry } = require('./plugin-registry.js')
const { resolveAuthStateTtlMs } = await import('./client-plugins/eiscore-auth/lib/index.js')
const knowledgeContract = resolve(root, 'knowledge-plugin-contract.v1.json')
const business = loadPluginRegistry(resolve(root, 'plugin-contract.v1.json'))
const knowledge = loadPluginRegistry(knowledgeContract)
assert.deepEqual(business.list().map(({ plugin_id }) => plugin_id).sort(), ['company-sales', 'independent-site-sales', 'worker-grid'])
assert.deepEqual(knowledge.list().map(({ plugin_id }) => plugin_id), ['digital-twin'])
assert.deepEqual(knowledge.listCapabilities().map(({ capability_id }) => capability_id).sort(), ['eiscore_twin_chat', 'eiscore_twin_context'])
assert.equal(resolveAuthStateTtlMs('knowledge'), 600000)
assert.equal(resolveAuthStateTtlMs('flash'), 120000)
assert.equal(resolveAuthStateTtlMs('business'), 120000)

const previous = {
  profile: process.env.HARNESS_PROFILE,
  contract: process.env.EISCORE_HARNESS_PLUGIN_CONTRACT,
  plugins: process.env.HARNESS_PLUGINS
}
try {
  process.env.EISCORE_HARNESS_PLUGIN_CONTRACT = knowledgeContract
  process.env.HARNESS_PROFILE = 'knowledge'
  process.env.HARNESS_PLUGINS = 'company-sales,digital-twin,flash-builder'
  const bridge = await import('./dsh-http-bridge.mjs?knowledge-profile-test')
  assert.deepEqual(bridge.pluginList(), [{ plugin_id: 'digital-twin' }])
  process.env.HARNESS_PROFILE = 'business'
  assert.deepEqual(bridge.pluginList(), [], 'a knowledge-only registry must not expose plugins in the business profile')
  process.env.HARNESS_PROFILE = 'unknown-profile'
  assert.deepEqual(bridge.pluginList(), [], 'unknown profiles fail closed')

  process.env.HARNESS_PROFILE = 'knowledge'
  const tools = await import('./eiscore-tools.mjs?knowledge-profile-test')
  assert.deepEqual([...tools.capabilities].sort(), ['eiscore_twin_chat', 'eiscore_twin_context'])
  process.env.HARNESS_PROFILE = 'business'
  const noKnowledgeTools = await import('./eiscore-tools.mjs?business-knowledge-contract-test')
  assert.deepEqual([...noKnowledgeTools.capabilities], [], 'business cannot load a knowledge-only contract')
} finally {
  if (previous.profile === undefined) delete process.env.HARNESS_PROFILE
  else process.env.HARNESS_PROFILE = previous.profile
  if (previous.contract === undefined) delete process.env.EISCORE_HARNESS_PLUGIN_CONTRACT
  else process.env.EISCORE_HARNESS_PLUGIN_CONTRACT = previous.contract
  if (previous.plugins === undefined) delete process.env.HARNESS_PLUGINS
  else process.env.HARNESS_PLUGINS = previous.plugins
}

const compose = readFileSync(resolve(root, '../compose.knowledge.yml'), 'utf8')
const nginx = readFileSync(resolve(root, '../nginx/huizong.conf'), 'utf8')
const webPatch = readFileSync(resolve(root, 'dsh-knowledge-web.patch.yml'), 'utf8')
const businessWebPatch = readFileSync(resolve(root, 'dsh-web.patch.yml'), 'utf8')
assert.match(compose, /RUNTIME_PROFILE:\s*knowledge/)
assert.match(compose, /HARNESS_PROFILE:\s*knowledge/)
assert.match(compose, /DSH_DEFAULT_WORKSPACE:\s*\/var\/lib\/dsh\/workspaces\/knowledge/)
assert.match(compose, /- knowledge_bridge_home:\/var\/lib\/dsh/)
assert.match(compose, /- knowledge_web_home:\/var\/lib\/dsh/)
assert.match(compose, /- knowledge_harness_audit:\/var\/lib\/eiscore/)
assert.match(compose, /EISCORE_AUTH_COOKIE_PREFIX:\s*knowledge-/)
assert.match(compose, /harness-knowledge-embed-api\/eiscore\/auth\/handoff/)
assert.match(nginx, /location \^~ \/harness-knowledge-embed\//)
assert.match(nginx, /location \^~ \/harness-knowledge-embed-api\//)
assert.match(nginx, /location \^~ \/harness-knowledge-embed-assets\//)
assert.match(nginx, /location \^~ \/harness-knowledge-embed-plugins\//)
assert.doesNotMatch(webPatch, /business-entry|worker-grid|company-sales|flash-builder/)
assert.match(webPatch, /eiscore-knowledge-enterprise-tree/)
assert.doesNotMatch(businessWebPatch, /eiscore-knowledge-enterprise-tree/)
console.log('PASS: Knowledge Harness has isolated services, volumes, routes, auth prefix, and only digital-twin capabilities')
