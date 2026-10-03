import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const optionalRead = (file) => {
  try {
    return read(file)
  } catch (error) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }
}
const optionalJson = (file) => {
  const source = optionalRead(file)
  return source ? JSON.parse(source) : null
}
const indexSource = read('realtime/index.js')
const routerSource = read('realtime/http-router.js')
const companyHttpSource = read('realtime/company-http.js')
const websocketSource = read('realtime/websocket-server.js')
const flashCliSource = read('realtime/flash-semantic-tool.js')
const chatSource = read('realtime/harness-chat-http.js')
const gatewaySource = read('realtime/harness-gateway.js')
const twinToolsSource = read('realtime/twin-tools.js')
const appCenterReadme = read('eiscore-apps/README.md')
const semanticsSpec = read('docs/AGENT_AUTO_SEMANTICS_NO_TOUCH_SPEC_V1.md')
const appCenterClientExamples = read('eiscore-apps/src/utils/agent-client-examples.js')
const hostAiBridge = read('eiscore-base/src/utils/ai-bridge.js')
const geoServiceSource = read('shared/eis-geo-services.js')
const workflowPolicySql = read('sql/patch_workflow_policy_v2.sql')
const workflowPolicyModule = read('eiscore-apps/src/domain/app-runtime-workflow-policy.mjs')
const appRuntimeSource = read('eiscore-apps/src/views/AppRuntime.vue')
const flashProtocolSources = [
  read('eiscore-apps/src/utils/realtime.js'),
  read('eiscore-apps/src/utils/flash-runtime-bridge.js'),
  read('eiscore-apps/src/views/FlashDraftPreview.vue'),
  read('eiscore-apps/src/views/FlashBuilder.vue'),
  read('eiscore-apps/src/views/AppRuntime.vue')
]
const dependencyManifests = [
  ['package.json', read('package.json')],
  ['package-lock.json', optionalRead('package-lock.json')],
  ['realtime/package.json', read('realtime/package.json')],
  ['realtime/package-lock.json', optionalRead('realtime/package-lock.json')],
  ['agent-harness/package.json', read('agent-harness/package.json')]
]
const harnessPackage = optionalJson('agent-harness/package.json')
const harnessLockfile = optionalJson('agent-harness/package-lock.json')
const harnessDockerfile = read('agent-harness/Dockerfile')
const deploymentConfigSources = [
  'env/.env.example', 'env/README.md', 'docker-compose.yml', 'docker-compose.prod.yml',
  'deploy/lundu/.env.example', 'deploy/lundu/compose.yml', 'deploy/lundu/compose.harness-web.yml'
].map((file) => [file, read(file)])
const dependencyLockfiles = [
  ['package-lock.json', optionalJson('package-lock.json')],
  ['realtime/package-lock.json', optionalJson('realtime/package-lock.json')]
]
const runtimeSources = readdirSync(resolve(root, 'realtime'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:js|mjs)$/.test(entry.name))
  .map((entry) => [entry.name, read(`realtime/${entry.name}`)])

const resolveLocalRequire = (sourceFile, request) => {
  const base = resolve(root, 'realtime', request)
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}.json`, resolve(base, 'index.js')]) {
    if (existsSync(candidate)) return candidate
  }
  return ''
}

for (const [name, source] of runtimeSources) {
  for (const match of source.matchAll(/require\(\s*[\'"](\.\/[^\'"]+)[\'"]\s*\)/g)) {
    assert.ok(resolveLocalRequire(name, match[1]), `${name} must resolve local dependency ${match[1]}`)
  }
}
const providerBoundarySources = [
  ...runtimeSources,
  ['agent-harness/dsh-http-bridge.mjs', read('agent-harness/dsh-http-bridge.mjs')],
  ['agent-harness/http-bridge.js', read('agent-harness/http-bridge.js')],
  ['agent-harness/eiscore-tools.mjs', read('agent-harness/eiscore-tools.mjs')]
]
const manualHarnessScripts = [
  'scripts/test-quick-stream.sh',
  'scripts/test-enterprise-snapshot.sh',
  'scripts/test-stream-save.sh',
  'scripts/test-semantic.sh'
].map((file) => [file, read(file)])
const smokeHarnessScripts = [
  'tests/smoke/business-smoke.mjs'
].map((file) => [file, read(file)])

// This flag is a workflow permission compatibility field only. It is allowed
// in the workflow policy implementation, but must never become a Harness or
// Agent runtime fallback switch.
for (const [name, source] of [
  ['workflow policy SQL', workflowPolicySql],
  ['workflow policy module', workflowPolicyModule],
  ['workflow runtime view', appRuntimeSource]
]) {
  assert.match(source, /legacy_fallback_enabled/, `${name} must retain the workflow compatibility policy contract`)
}

for (const legacyImport of [
  "require('./ai-http')",
  "require('./ai-chat-http')",
  "require('./twin-chat-http')",
  "require('./twin-engine')"
]) {
  assert.equal(indexSource.includes(legacyImport), false, `production composition root must not import ${legacyImport}`)
}
for (const legacyCall of ['callAiUpstream(', 'callAiUpstreamWithRetry(']) {
  assert.equal(indexSource.includes(legacyCall), false, `production composition root must not call ${legacyCall}`)
}
assert.match(routerSource, /exact\('POST', '\/ai\/chat\/completions', 'harness\.handleChat'\)/)
assert.match(routerSource, /exact\('POST', '\/twin\/chat', 'harness\.handleTwinChat'\)/)
assert.match(indexSource, /normalizeAgentRequestPath\(req\?\.url\)/, 'historical /agent prefix must normalize into canonical routes')
assert.match(indexSource, /if \(!harnessRuntime\.enabled\)/, 'Flash WebSocket Harness tasks must fail closed when Harness is disabled')
assert.match(indexSource, /code: 'HARNESS_DISABLED'/, 'disabled Flash WebSocket Harness tasks must expose a stable disabled code')
assert.match(indexSource, /createHarnessFlashToolCallHandler\(/, 'Flash WebSocket tool calls must use the Harness adapter')
assert.doesNotMatch(indexSource, /executeFlashToolCall\(ws\.user/, 'Flash WebSocket tool calls must not bypass the Harness Gateway')
assert.match(indexSource, /enabled: harnessRuntime\.enabled/, 'Flash WebSocket tool calls must fail closed with the Harness runtime state')
assert.match(routerSource, /rawPath\.startsWith\('\/agent\/'\)/, 'router path normalizer must retain historical /agent compatibility')
assert.match(companyHttpSource, /exact\('POST', '\/company-site\/auth\/handoff', 'company\.handleCreateAuthHandoff'\)/, 'company-site compatibility protocol must remain explicitly routed')
assert.match(companyHttpSource, /exact\('POST', '\/company-site\/public\/leads', 'company\.handleCreatePublicLead'\)/, 'company-site public business protocol must not be mistaken for legacy Agent orchestration')
assert.doesNotMatch(indexSource, /require\('.\/agent-(?:core|access-service|task-service)'\)/, 'composition root must not reintroduce retired Agent orchestration')
assert.match(indexSource, /const hasHarnessTenantContext = /, 'Harness auth must define a tenant-bound identity guard')
assert.equal((indexSource.match(/hasHarnessTenantContext\(user\)/g) || []).length, 4, 'AI, twin, Flash and document-intake authorizers must enforce tenant-bound identity')
assert.match(chatSource, /'worker-grid': 'eiscore_grid_query'/, 'worker chat must bind a registered capability')
assert.match(chatSource, /workflow:\s*'eiscore_workflow_context'/, 'workflow chat must bind a registered capability')
assert.match(gatewaySource, /HARNESS_CAPABILITY_REQUIRED/, 'gateway must reject requests without a capability')
assert.equal(websocketSource.includes('agent:task'), false)
assert.equal(websocketSource.includes('cline'), false)
assert.equal(indexSource.includes('AI_ALLOW_ALL'), false, 'production composition root must not expose legacy AI_ALLOW_ALL bypass')
assert.equal(indexSource.includes('AI_ALLOWED_ROLES'), false, 'production composition root must not expose legacy AI_ALLOWED_ROLES bypass')
assert.match(websocketSource, /flash:harness_task/)
assert.match(websocketSource, /flash:harness_reset/)
assert.equal(flashCliSource.includes('/agent/flash/'), false)
assert.equal(flashCliSource.includes('Cline'), false)
assert.match(flashCliSource, /\/flash\/tools\/registry/)
assert.match(flashCliSource, /\/flash\/tools\/call/)
for (const [name, source] of runtimeSources) {
  for (const retiredRuntimeMarker of [
    "require('./agent-core')", "require('./agent-access-service')", "require('./agent-task-service')",
    "require('./flash-cline", "require('./twin-engine')", "require('./twin-chat-http')"
  ]) {
    assert.equal(source.toLowerCase().includes(retiredRuntimeMarker), false, `${name} must not retain retired runtime marker ${retiredRuntimeMarker}`)
  }
  assert.equal(source.includes('callAiUpstream('), false, `${name} must not retain a legacy AI upstream call`)
  assert.equal(source.includes('callAiUpstreamWithRetry('), false, `${name} must not retain a legacy AI retry call`)
  assert.equal(source.includes('ANTHROPIC_API_KEY'), false, `${name} must not read legacy Anthropic configuration`)
  assert.equal(source.includes('AI_HTTP_PROXY_URL'), false, `${name} must not read legacy AI proxy configuration`)
  assert.equal(source.includes('CLINE_OPENAI'), false, `${name} must not read legacy Cline model configuration`)
  assert.equal(source.includes('ai_glm_config'), false, `${name} must not read the retired AI GLM configuration`)
}
for (const [name, source] of providerBoundarySources) {
  for (const directProviderMarker of [
    'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY',
    'AI_API_KEY', 'AI_BASE_URL', 'api.openai.com', 'api.anthropic.com', 'api.deepseek.com'
  ]) {
    assert.equal(
      source.toLowerCase().includes(directProviderMarker.toLowerCase()),
      false,
      `${name} must not expose a direct model-provider egress marker: ${directProviderMarker}`
    )
  }
}
assert.match(read('realtime/harness-runtime.js'), /\/v1\/chat\/completions/, 'Runtime provider dispatch must use the Harness bridge contract')
assert.doesNotMatch(read('realtime/harness-runtime.js'), /EISCORE_HARNESS_URL[^\n]*127\.0\.0\.1:3080/, 'Harness runtime must not use a loopback bridge fallback')
assert.match(read('agent-harness/dsh-http-bridge.mjs'), /session\/prompt/, 'Harness bridge must invoke the SDK session prompt protocol')
for (const [name, source] of dependencyManifests) {
  for (const retiredDependency of ['@anthropic-ai/sdk', 'anthropic', 'cline', '@agentclientprotocol/sdk']) {
    assert.equal(
      source.includes(`"${retiredDependency}"`),
      false,
      `${name} must not retain retired model/Cline dependency ${retiredDependency}`
    )
  }
}
assert.equal(harnessPackage?.dependencies?.['@deepseek-ai/dsh'], '0.1.2-rc.1', 'Harness runtime must pin the official DeepSeek DSH package')
assert.deepEqual(
  harnessLockfile?.packages?.['']?.dependencies,
  { '@deepseek-ai/dsh': '0.1.2-rc.1' },
  'Harness lockfile root must contain only the pinned official DSH dependency'
)
// DSH may carry protocol SDKs transitively; only the Harness package root is
// our direct dependency boundary, so do not reject those locked transitive entries.
for (const retiredDependency of ['@anthropic-ai/sdk', 'anthropic', 'cline', '@agentclientprotocol/sdk', 'openai']) {
  assert.equal(
    Object.hasOwn(harnessPackage?.dependencies || {}, retiredDependency),
    false,
    `Harness runtime must not directly depend on retired model/Cline package ${retiredDependency}`
  )
}
assert.match(harnessDockerfile, /npm ci --omit=dev/, 'Harness image must omit development-only upstream SDK dependencies')
for (const [name, source] of deploymentConfigSources) {
  for (const retiredModelConfig of [
    'ANTHROPIC_API_KEY', 'AI_HTTP_PROXY_URL', 'CLINE_OPENAI', 'CLINE_MODEL',
    'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'DEEPSEEK_API_KEY', 'AI_API_KEY', 'AI_BASE_URL',
    'EISCORE_HARNESS_FALLBACK', 'EISCORE_HARNESS_SHADOW', 'EISCORE_HARNESS_TWIN_SHADOW',
    'EISCORE_HARNESS_SITE_SALES_SHADOW'
  ]) {
    assert.equal(source.includes(retiredModelConfig), false, `${name} must not retain retired direct-model configuration ${retiredModelConfig}`)
  }
}
for (const [name, source] of manualHarnessScripts) {
  assert.equal(source.includes('/agent/ai/'), false, `${name} must use canonical /ai routes`)
  assert.equal(source.includes('/agent/twin/'), false, `${name} must not call retired Agent twin routes`)
}
assert.doesNotMatch(semanticsSpec, /AI 对话接口：`\/agent\/ai\//, 'active semantic specification must not define legacy Agent routes as current')
assert.match(semanticsSpec, /AI\/Harness 对话接口：`\/ai\/config`/, 'active semantic specification must name canonical Harness routes')
for (const [name, source] of smokeHarnessScripts) {
  assert.equal(source.includes('/agent/ai/'), false, `${name} must use canonical /ai routes`)
  assert.equal(source.includes('/agent/twin/'), false, `${name} must not call retired Agent twin routes`)
}
for (const [name, source] of runtimeSources) {
  for (const retiredHarnessMode of [
    'EISCORE_HARNESS_FALLBACK', 'EISCORE_HARNESS_SHADOW', 'EISCORE_HARNESS_TWIN_SHADOW',
    'EISCORE_HARNESS_SITE_SALES_SHADOW'
  ]) {
    assert.equal(source.includes(retiredHarnessMode), false, `${name} must not retain retired Harness fallback/shadow mode ${retiredHarnessMode}`)
  }
  assert.equal(source.includes('legacy_fallback_enabled'), false, `${name} must not expose the application workflow compatibility fallback as a runtime Agent fallback`)
}
for (const [name, source] of deploymentConfigSources) {
  assert.equal(source.includes('legacy_fallback_enabled'), false, `${name} must not configure the application workflow compatibility fallback in a production service`)
}
for (const [name, source] of [
  ['Harness chat HTTP', chatSource],
  ['Harness gateway', gatewaySource],
  ['Host AI bridge', hostAiBridge],
  ['application center client examples', appCenterClientExamples]
]) {
  assert.equal(source.includes('legacy_fallback_enabled'), false, `${name} must not interpret the workflow compatibility field as a Harness/Agent fallback`)
}
for (const [name, lockfile] of dependencyLockfiles) {
  if (!lockfile) continue
  for (const packagePath of Object.keys(lockfile.packages || {})) {
    for (const retiredDependency of ['@anthropic-ai/sdk', 'anthropic', 'cline', '@agentclientprotocol/sdk']) {
      assert.equal(
        packagePath === `node_modules/${retiredDependency}` || packagePath.endsWith(`/node_modules/${retiredDependency}`),
        false,
        `${name} must not lock retired model/Cline dependency ${retiredDependency}`
      )
    }
  }
}
assert.equal(read('realtime/flash-tool-registry.js').includes('/agent/flash/'), false, 'Flash registry must expose canonical Harness-era routes')
assert.match(appCenterReadme, /EISCORE_HARNESS_ENABLED=true/, 'application center docs must describe Harness configuration')
for (const retiredDocMarker of ['ANTHROPIC_API_KEY', 'agent:task', 'github.com/cline/cline']) {
  assert.equal(appCenterReadme.includes(retiredDocMarker), false, `application center docs must not advertise retired integration: ${retiredDocMarker}`)
}
for (const retiredClientMarker of ['agent:task', 'agent:tool_use', 'agent:terminal', 'cline', '/agent/flash/']) {
  assert.equal(appCenterClientExamples.toLowerCase().includes(retiredClientMarker.toLowerCase()), false, `application center client examples must not advertise retired integration: ${retiredClientMarker}`)
}
assert.match(appCenterClientExamples, /\/ai\/harness\/execute/)
assert.match(appCenterClientExamples, /\/flash\/tools\/call/)
assert.doesNotMatch(hostAiBridge, /glm-4\.6v|\bmodel\s*:\s*this\.config\?\.model/, 'host AI bridge must not send a legacy model selector')
assert.match(geoServiceSource, /const translateWithHarness = async \(text\) =>/, 'Geo translation must use the Harness capability path')
assert.match(geoServiceSource, /const askHarnessForMapLocation = async \(imageUrl, lat, lng\) =>/, 'Geo map location must use the Harness capability path')
assert.doesNotMatch(geoServiceSource, /\/agent\/ai\/(?:translate|map-locate)|translateWithGlm|askGlmForMapLocation/, 'Geo service must not retain retired Agent/GLM paths')
assert.doesNotMatch(geoServiceSource, /translateProvider\s*===\s*['"]glm['"]/, 'Geo service must not select the retired GLM provider')
assert.match(twinToolsSource, /path:\s*['"]\/twin_sessions['"][\s\S]{0,240}model:\s*['"]deepseek-harness['"]/, 'digital twin sessions must explicitly bind the Harness model marker')
assert.doesNotMatch(twinToolsSource, /glm-4\.6v/, 'digital twin persistence must not retain the retired model marker')
for (const [name, source] of [
  ['host AI bridge', hostAiBridge],
  ['business snapshot client', read('shared/eis-business-snapshot.js')],
  ['geo services', read('shared/eis-geo-services.js')],
  ['document intake client', read('eiscore-base/src/utils/document-intake-client.js')],
  ['twin JSON client', read('eiscore-base/src/utils/twin-json-client.js')]
]) {
  assert.doesNotMatch(source, /\/agent\/(?:ai|twin|document-intake|company-site)\//, `${name} must use canonical Harness paths`)
}
for (const source of flashProtocolSources) {
  assert.equal(source.includes('/agent/flash/'), false, 'application center Flash clients must use canonical /flash routes')
  assert.equal(source.includes('flash:cline_'), false, 'application center Flash clients must not emit retired Cline messages')
  assert.equal(source.includes('/agent/ws'), false, 'application center WebSocket clients must use the canonical Runtime path')
}
assert.match(read('eiscore-apps/src/views/FlashBuilder.vue'), /\/ws/)
console.log('PASS: production HTTP/WebSocket composition reaches Harness without legacy AI/Twin entrypoints')
