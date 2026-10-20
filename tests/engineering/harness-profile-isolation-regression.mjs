import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pluginList } from '../../agent-harness/dsh-http-bridge.mjs'

const root = resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)
const {
  PROFILE_IDS,
  PROFILE_PLUGINS,
  PERSONA_IDS,
  capabilitiesForPersona,
  isHarnessProfile,
  pluginsForPersona,
  pluginsForProfile,
  requireHarnessProfile,
  validateHarnessPersonaProfile,
  workspaceForPersonaOwner,
  workspaceForProfileOwner
} = require('../../agent-harness/profile-policy.js')
const { workspaceForOwner } = require('../../agent-harness/http-bridge.js')
const { createBridgeHandler } = require('../../agent-harness/http-bridge.js')
const bridgeSource = readFileSync(resolve(root, 'agent-harness/dsh-http-bridge.mjs'), 'utf8')
const runtimeSource = readFileSync(resolve(root, 'realtime/index.js'), 'utf8')
const compose = readFileSync(resolve(root, 'deploy/lundu/compose.yml'), 'utf8')
const productionCompose = readFileSync(resolve(root, 'docker-compose.prod.yml'), 'utf8')

assert.deepEqual(PROFILE_IDS, ['business', 'flash'])
assert.equal(isHarnessProfile('BUSINESS'), true)
assert.equal(isHarnessProfile('unknown'), false)
assert.equal(requireHarnessProfile(' FLASH '), 'flash')
assert.throws(() => requireHarnessProfile(''), /HARNESS_PROFILE must be one of/)
assert.deepEqual([...pluginsForProfile('business')], PROFILE_PLUGINS.business)
assert.deepEqual([...pluginsForProfile('flash')], ['flash-builder'])
assert.equal(PROFILE_PLUGINS.business.includes('flash-builder'), false)
assert.equal(PROFILE_PLUGINS.flash.some((plugin) => plugin !== 'flash-builder'), false)
assert.deepEqual(PERSONA_IDS, ['work-assistant', 'workbench', 'flash'])
assert.deepEqual([...pluginsForPersona('work-assistant')], ['worker-grid', 'enterprise-bi', 'document-intake', 'workflow', 'company-sales'])
assert.deepEqual([...pluginsForPersona('workbench')], ['enterprise-bi', 'digital-twin', 'workflow', 'company-sales', 'engineering', 'independent-site-sales'])
assert.deepEqual([...pluginsForPersona('flash')], ['flash-builder'])
assert.equal(capabilitiesForPersona('work-assistant').includes('eiscore_enterprise_query'), false)
assert.equal(capabilitiesForPersona('work-assistant').includes('eiscore_enterprise_snapshot'), false)
assert.equal(capabilitiesForPersona('workbench').includes('eiscore_enterprise_query'), true)
assert.throws(() => validateHarnessPersonaProfile('flash', 'work-assistant'), /incompatible/)
assert.throws(() => validateHarnessPersonaProfile('business', 'flash'), /incompatible/)

const previousProfile = process.env.HARNESS_PROFILE
const previousPlugins = process.env.HARNESS_PLUGINS
const previousPersona = process.env.HARNESS_PERSONA
try {
  process.env.HARNESS_PLUGINS = 'enterprise-bi,flash-builder'
  process.env.HARNESS_PROFILE = 'business'
  delete process.env.HARNESS_PERSONA
  assert.deepEqual(pluginList(), [], 'a Bridge without an explicit persona must expose no plugins')
  process.env.HARNESS_PROFILE = 'flash'
  assert.deepEqual(pluginList(), [], 'a Flash Bridge without an explicit persona must expose no plugins')
  process.env.HARNESS_PROFILE = 'business'
  process.env.HARNESS_PERSONA = 'work-assistant'
  process.env.HARNESS_PLUGINS = 'enterprise-bi,worker-grid,document-intake,workflow,company-sales,digital-twin,engineering,independent-site-sales'
  assert.deepEqual(pluginList(), ['worker-grid', 'enterprise-bi', 'document-intake', 'workflow', 'company-sales'].map((plugin_id) => ({ plugin_id })))
  process.env.HARNESS_PERSONA = 'workbench'
  assert.deepEqual(pluginList(), ['enterprise-bi', 'digital-twin', 'workflow', 'company-sales', 'engineering', 'independent-site-sales'].map((plugin_id) => ({ plugin_id })))
  process.env.HARNESS_PERSONA = 'flash'
  process.env.HARNESS_PROFILE = 'flash'
  process.env.HARNESS_PLUGINS = 'flash-builder,enterprise-bi'
  assert.deepEqual(pluginList(), [{ plugin_id: 'flash-builder' }])
  process.env.HARNESS_PROFILE = 'invalid'
  assert.deepEqual(pluginList(), [], 'invalid Bridge profile must expose no plugins')
  assert.throws(() => createBridgeHandler({ profile: 'invalid', invoke: async () => ({}) }), /HARNESS_PROFILE must be one of/)
  assert.throws(() => createBridgeHandler({ profile: 'flash', persona: 'work-assistant', invoke: async () => ({}) }), /incompatible/)
  assert.throws(() => createBridgeHandler({ profile: 'business', bridgeSecret: 'secret', invoke: async () => ({}) }), /HARNESS_PERSONA is required/)
} finally {
  if (previousProfile === undefined) delete process.env.HARNESS_PROFILE
  else process.env.HARNESS_PROFILE = previousProfile
  if (previousPlugins === undefined) delete process.env.HARNESS_PLUGINS
  else process.env.HARNESS_PLUGINS = previousPlugins
  if (previousPersona === undefined) delete process.env.HARNESS_PERSONA
  else process.env.HARNESS_PERSONA = previousPersona
}

const businessWorkspace = workspaceForProfileOwner('business', 'user-1', 'tenant-1')
const flashWorkspace = workspaceForProfileOwner('flash', 'user-1', 'tenant-1')
const assistantWorkspace = workspaceForPersonaOwner('work-assistant', 'user-1', 'tenant-1')
const workbenchWorkspace = workspaceForPersonaOwner('workbench', 'user-1', 'tenant-1')
const flashPersonaWorkspace = workspaceForPersonaOwner('flash', 'user-1', 'tenant-1')
assert.notEqual(businessWorkspace, flashWorkspace, 'business and flash workspaces must be disjoint')
assert.notEqual(assistantWorkspace, workbenchWorkspace, 'assistant and workbench workspaces must be disjoint')
assert.equal(workbenchWorkspace, businessWorkspace, 'workbench must retain the legacy business workspace')
assert.equal(flashPersonaWorkspace, flashWorkspace, 'Flash must retain the legacy flash workspace')
assert.equal(workspaceForOwner('user-1', 'tenant-1', 'business'), businessWorkspace)
assert.equal(workspaceForOwner('user-1', 'tenant-1', 'flash'), flashWorkspace)
assert.match(businessWorkspace, /^business_ws_[a-f0-9]{64}$/)
assert.match(flashWorkspace, /^flash_ws_[a-f0-9]{64}$/)

assert.match(bridgeSource, /requireHarnessProfile\(process\.env\.HARNESS_PROFILE\)/)
assert.match(bridgeSource, /profile: harnessProfile/)
assert.match(runtimeSource, /requireHarnessProfile\(/)

const serviceBlock = (source, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`\\n  ${escaped}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\n|\\nvolumes:|$)`))?.[1] || ''
}
for (const [source, runtimeName] of [[compose, 'agent'], [productionCompose, 'agent-runtime']]) {
  assert.match(serviceBlock(source, runtimeName), /RUNTIME_PROFILE: business/)
  assert.match(serviceBlock(source, 'flash-agent-runtime'), /RUNTIME_PROFILE: flash/)
  assert.match(serviceBlock(source, 'harness-bridge'), /HARNESS_PROFILE: business/)
  assert.match(serviceBlock(source, 'flash-harness-bridge'), /HARNESS_PROFILE: flash/)
  assert.doesNotMatch(serviceBlock(source, 'harness-bridge'), /HARNESS_PLUGINS:.*flash-builder/)
  assert.match(serviceBlock(source, 'flash-harness-bridge'), /HARNESS_PLUGINS: flash-builder/)
  assert.match(serviceBlock(source, 'harness-bridge'), /EISCORE_TOOL_PROXY_URL: http:\/\/(?:agent|agent-runtime):8078\/internal\/harness\/tool/)
  assert.match(serviceBlock(source, 'flash-harness-bridge'), /EISCORE_TOOL_PROXY_URL: http:\/\/flash-agent-runtime:8078\/internal\/harness\/tool/)
}

console.log('PASS: Harness business and Flash profiles fail closed and keep plugin, workspace, runtime and Bridge boundaries separate')
