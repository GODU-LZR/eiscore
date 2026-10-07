// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ProductionEnvValidationError,
  parseEnvFile,
  validateProductionEnv
} from '../../scripts/validate-production-env.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const rootCompose = read('docker-compose.yml')
const compose = read('docker-compose.prod.yml')
const lunduCompose = read('deploy/lundu/compose.yml')
const lunduHarnessCompose = read('deploy/lundu/compose.harness-web.yml')
const lunduPatch = read('deploy/lundu/dsh-web.patch.yml')
const lunduTemplate = read('deploy/lundu/.env.example')
const lunduNginx = read('deploy/lundu/nginx/lundu-eiscore.conf')
const rootNginx = read('nginx/conf.d/default.conf')
const bridgeDockerfile = read('agent-harness/Dockerfile')
const sdkBridge = read('agent-harness/dsh-http-bridge.mjs')
const harnessAuthClient = read('eiscore-base/src/services/harness-auth-client.js')
const homeView = read('eiscore-base/src/views/HomeView.vue')
const template = read('env/.env.example')
const deployScripts = [read('scripts/deploy-simple.sh'), read('scripts/deploy-pm2.sh')]
const operationsManual = read('docs/EISCORE_FUNCTION_MANUAL.md')
const retiredRuntimeEnvKeys = [
  'ANTHROPIC_API_KEY',
  'AI_HTTP_PROXY_URL',
  'CLINE_OPENAI_BASE_URL',
  'CLINE_OPENAI_API_KEY',
  'CLINE_OPENAI_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'DEEPSEEK_API_KEY',
  'AI_API_KEY',
  'AI_BASE_URL',
  'EISCORE_HARNESS_FALLBACK',
  'EISCORE_HARNESS_SHADOW',
  'EISCORE_HARNESS_TWIN_SHADOW',
  'EISCORE_HARNESS_SITE_SALES_SHADOW'
]
const composeSources = [
  ['root Compose', rootCompose],
  ['production Compose', compose],
  ['Lundu Compose', lunduCompose],
  ['Lundu Harness override', lunduHarnessCompose]
]

assert.doesNotMatch(compose, /POSTGRES_PASSWORD:-/, 'production Compose must not provide a database password fallback')
assert.doesNotMatch(compose, /PGRST_JWT_SECRET:-/, 'production Compose must not provide a JWT secret fallback')
assert.doesNotMatch(compose, /POSTGREST_DB_PASSWORD:-|AGENT_DB_PASSWORD:-/, 'production Compose must not provide service password fallbacks')
assert.doesNotMatch(compose, /nanpai\.eissys\.top/i, 'production Compose must not hardcode a customer domain')
assert.match(compose, /\$\{POSTGRES_PASSWORD:\?POSTGRES_PASSWORD is required\}/, 'production Compose should require the database password')
assert.match(compose, /\$\{PGRST_JWT_SECRET:\?PGRST_JWT_SECRET is required\}/, 'production Compose should require the JWT secret')
assert.match(compose, /\$\{POSTGREST_DB_PASSWORD:\?POSTGREST_DB_PASSWORD is required\}/, 'production Compose should require the PostgREST role password')
assert.match(compose, /\$\{AGENT_DB_PASSWORD:\?AGENT_DB_PASSWORD is required\}/, 'production Compose should require the agent role password')
assert.match(compose, /\$\{EISCORE_HARNESS_ENABLED:\?EISCORE_HARNESS_ENABLED is required\}/, 'production Compose should require Harness enabled state')
assert.match(compose, /\$\{EISCORE_HARNESS_URL:\?EISCORE_HARNESS_URL is required\}/, 'production Compose should require Harness bridge URL')
assert.match(compose, /\$\{EISCORE_HARNESS_AUDIT_FILE:\?EISCORE_HARNESS_AUDIT_FILE is required\}/, 'production Compose should require Harness audit file')
assert.match(compose, /\$\{EISCORE_HARNESS_AUDIT_HASH_KEY:\?EISCORE_HARNESS_AUDIT_HASH_KEY is required\}/, 'production Compose should require Harness audit key')
assert.match(compose, /\$\{EISCORE_HARNESS_BRIDGE_SECRET:\?EISCORE_HARNESS_BRIDGE_SECRET is required\}/, 'production Compose should require Runtime-to-Bridge secret')
assert.match(compose, /\$\{EISCORE_TOOL_PROXY_SECRET:\?EISCORE_TOOL_PROXY_SECRET is required\}/, 'production Compose should require the Harness tool proxy secret')
assert.doesNotMatch(operationsManual, /^docker compose up -d\s*$/m, 'operations manual must not advertise unscoped Compose startup')
assert.match(operationsManual, /docker compose up -d db api agent-runtime harness-bridge nginx swagger code-server/, 'operations manual should document scoped local Harness startup')
assert.match(rootCompose, /^  harness-bridge:$/m, 'local Compose must provide a first-class Harness bridge service')
assert.match(rootCompose, /EISCORE_HARNESS_URL: "\$\{EISCORE_HARNESS_URL:-http:\/\/harness-bridge:3080\}"/, 'local Runtime must default to the in-Compose Harness bridge')
assert.doesNotMatch(rootCompose, /host\.docker\.internal:3080/, 'local Compose must not default to an external Harness process')
assert.match(rootCompose, /harness-bridge:[\s\S]+dockerfile: agent-harness\/Dockerfile/, 'local Harness bridge must use the repository-built image')
assert.match(rootCompose, /harness-bridge:[\s\S]+EISCORE_TOOL_PROXY_URL: http:\/\/agent-runtime:8078\/internal\/harness\/tool/, 'local Harness bridge must call the authenticated Runtime Tool Proxy')
assert.match(compose, /^  harness-bridge:$/m, 'production Compose must provide the configured Harness bridge service')
assert.match(bridgeDockerfile, /ENTRYPOINT \["node"\]/, 'Harness bridge image must expose the node entrypoint used by Compose commands')
assert.match(compose, /harness-bridge:\n\s+build:\n\s+context: \.\n\s+dockerfile: agent-harness\/Dockerfile/, 'production bridge must use the repository-built Harness image')
assert.doesNotMatch(compose, /eiscore\/deepseek-harness:/, 'production Compose must not use an unverifiable private Harness image tag')
assert.match(read('agent-harness/Dockerfile.dockerignore'), /!agent-harness\/package-lock\.json/, 'bridge image must constrain its repository build context')
assert.match(compose, /\.\/agent-harness:\/opt\/eiscore-harness:ro/, 'production bridge must mount the current repository Harness artifacts read-only')
assert.match(compose, /EISCORE_TOOL_PROXY_URL: http:\/\/agent-runtime:8078\/internal\/harness\/tool/, 'production bridge must call the authenticated Runtime tool proxy')
assert.match(compose, /DSH_PROVIDER: "\$\{DSH_PROVIDER:\?DSH_PROVIDER is required\}"/, 'production bridge must require an explicit DSH provider')
assert.match(compose, /DSH_MODEL: "\$\{DSH_MODEL:\?DSH_MODEL is required\}"/, 'production bridge must require an explicit DSH model')
assert.match(compose, /harness-bridge:[\s\S]+command: \["\/opt\/eiscore-harness\/dsh-http-bridge\.mjs"\]/, 'production bridge command must match the image node entrypoint')
assert.match(compose, /BRIDGE_STATE_FILE: .*bridge-state\.json/, 'production bridge must persist replay and session state')
for (const [key, fallback] of [['BRIDGE_PROMPT_TIMEOUT_MS', '120000'], ['BRIDGE_SESSION_DRAIN_TIMEOUT_MS', '120000'], ['BRIDGE_RPC_TIMEOUT_MS', '120000'], ['BRIDGE_SHUTDOWN_TIMEOUT_MS', '1000']]) {
  assert.ok(compose.includes(`      ${key}: "\${${key}:-${fallback}}"`), `production bridge must pass ${key}`)
}
assert.match(compose, /BRIDGE_SHUTDOWN_TIMEOUT_MS: .*1000/, 'production bridge must bound SDK shutdown wait')
assert.doesNotMatch(compose, /ANTHROPIC_API_KEY|AI_HTTP_PROXY_URL|CLINE_OPENAI|FLASH_CLINE/, 'production Compose must not expose legacy model configuration')
for (const [name, source] of composeSources) {
  assert.doesNotMatch(
    source,
    /(?:^|[\/])insert_ai_config\.sql(?:[:\s]|$)/m,
    `${name} must not mount the retired GLM initialization SQL`
  )
}
assert.match(compose, /\$\{EISCORE_PUBLIC_BASE_URL:\?EISCORE_PUBLIC_BASE_URL is required\}\/api/, 'production Compose should derive the API origin from enterprise configuration')
assert.equal((compose.match(/required: false/g) || []).length, 3, 'service env files should be optional when variables are supplied by the deployment environment')
assert.match(lunduCompose, /security_opt:\s*\[no-new-privileges:true\]/, 'base Lundu Compose should disable privilege escalation')
assert.doesNotMatch(lunduHarnessCompose, /^\s+security_opt:/m, 'Harness override should inherit security options without duplicating Compose sequence values')
assert.match(lunduCompose, /tmpfs:\s*\["\/tmp:rw,noexec,nosuid,size=256m"\]/, 'base Lundu Compose should keep the Harness temporary filesystem non-executable')
assert.match(compose, /tmpfs:\s*\["\/tmp:rw,noexec,nosuid,size=256m"\]/, 'production Compose should keep the Harness temporary filesystem non-executable')
assert.doesNotMatch(lunduHarnessCompose, /^\s+tmpfs:/m, 'Harness override should inherit the restricted temporary filesystem without duplicate mount targets')
assert.match(lunduHarnessCompose, /\.\/dsh-web-runner\.mjs:\/opt\/eiscore-harness\/dsh-web-runner\.mjs:ro/, 'Harness override should mount its EISCore runner at the command path')
assert.match(lunduCompose, /harness-bridge:/, 'Lundu Compose must provide a dedicated HTTP-to-SDK bridge service')
assert.match(lunduCompose, /deepseek-web:\n\s+build: \{context: \.\/source, dockerfile: agent-harness\/Dockerfile\}/, 'Lundu Web must use the repository-built Harness image')
assert.match(lunduCompose, /harness-bridge:\n\s+build: \{context: \.\/source, dockerfile: agent-harness\/Dockerfile\}/, 'Lundu bridge must use the repository-built Harness image')
assert.doesNotMatch(lunduCompose, /eiscore\/deepseek-harness:/, 'Lundu Compose must not use an unverifiable private Harness image tag')
assert.match(lunduCompose, /deepseek-web:[\s\S]+command: \["\/opt\/eiscore-harness\/dsh-web-runner\.mjs"\]/, 'Lundu Web command must match the image node entrypoint')
assert.match(lunduCompose, /\.\/dsh-web-runner\.mjs:\/opt\/eiscore-harness\/dsh-web-runner\.mjs:ro/, 'Lundu Web must mount the guarded runner')
assert.doesNotMatch(lunduCompose, /deepseek-web:[^\n]*--port", "3080"/, 'Lundu Web must not bypass the 3081 proxy runner')
assert.match(lunduCompose, /\.\/source\/agent-harness\/dsh-http-bridge\.mjs:\/opt\/dsh-http-bridge\.mjs:ro/, 'Lundu Compose must mount the SDK bridge runner')
assert.match(lunduCompose, /harness-bridge:[\s\S]+command: \["\/opt\/dsh-http-bridge\.mjs"\]/, 'Lundu bridge command must match the image node entrypoint')
assert.match(lunduCompose, /\.\/source\/agent-harness\/http-bridge\.js:\/opt\/http-bridge\.js:ro/, 'Lundu Compose must mount the shared HTTP bridge boundary')
assert.match(lunduCompose, /DSH_BIN: \/opt\/bridge\/node_modules\/\.bin\/dsh/, 'Lundu bridge must launch the locked DSH CLI')
assert.match(lunduCompose, /DSH_PROVIDER: "\$\{DSH_PROVIDER:\?DSH_PROVIDER is required\}"/, 'Lundu bridge must require an explicit DSH provider')
assert.match(lunduCompose, /DSH_MODEL: "\$\{DSH_MODEL:\?DSH_MODEL is required\}"/, 'Lundu bridge must require an explicit DSH model')
assert.match(lunduCompose, /healthcheck:[\s\S]+\/readyz/, 'Lundu bridge healthcheck must use the SDK readiness endpoint')
assert.match(lunduCompose, /BRIDGE_STATE_FILE: .*bridge-state\.json/, 'Lundu bridge must persist session and replay state on its DSH volume')
for (const [key, fallback] of [['BRIDGE_PROMPT_TIMEOUT_MS', '120000'], ['BRIDGE_SESSION_DRAIN_TIMEOUT_MS', '120000'], ['BRIDGE_RPC_TIMEOUT_MS', '120000'], ['BRIDGE_SHUTDOWN_TIMEOUT_MS', '1000']]) {
  assert.ok(lunduCompose.includes(`      ${key}: "\${${key}:-${fallback}}"`), `Lundu bridge must pass ${key}`)
}
assert.match(lunduCompose, /BRIDGE_SHUTDOWN_TIMEOUT_MS: .*1000/, 'Lundu bridge must bound SDK shutdown wait')
assert.doesNotMatch(lunduCompose, /EISCORE_HARNESS_URL:.*deepseek-web:3080/, 'Lundu Runtime must not target the Harness Web UI')
for (const method of ['initialize', 'session/prompt', 'session.event', 'session.status']) {
  assert.match(sdkBridge, new RegExp(method.replace(/[./]/g, '\\$&')), `SDK bridge must implement the official ${method} protocol boundary`)
}

for (const [name, source] of [['Lundu Compose', lunduCompose], ['Lundu Harness override', lunduHarnessCompose]]) {
  assert.match(source, /\/opt\/eiscore-harness\/dsh-web\.patch\.yml/, `${name} should reference the Harness patch path`)
  assert.match(source, /\.\/dsh-web\.patch\.yml:\/opt\/eiscore-harness\/dsh-web\.patch\.yml:ro/, `${name} should mount the Harness patch read-only`)
  assert.match(source, /\$\{LUNDU_HARNESS_ROOT:\?LUNDU_HARNESS_ROOT is required\}:\/opt\/eiscore-harness:ro/, `${name} should require an explicit Harness artifact root`)
}
assert.match(lunduPatch, /id: ui-eiscore-embed\s+disabled: true/, 'Lundu patch must disable the legacy EISCore embed')
assert.match(homeView, /VITE_HARNESS_WEB_URL \|\| '\/harness-embed\/'/, 'EISCore should embed Harness through the protected path')
assert.match(harnessAuthClient, /\/harness-embed-api\/eiscore\/auth\/start/, 'Harness auth should start through the protected embed API')
assert.match(harnessAuthClient, /\/harness-embed-api\/eiscore\/auth\/handoff/, 'Harness auth should finish through the protected embed API')
assert.doesNotMatch(harnessAuthClient, /\/harness-api\//, 'EISCore must not call the externally blocked Harness API path')
assert.match(lunduNginx, /\$http_sec_fetch_dest = "iframe"/, 'Lundu Harness embed should accept iframe navigations')
assert.match(lunduNginx, /\$http_referer ~ "\^https:\/\/lundu\\\.eiscore\\\.top\/"/, 'Lundu Harness embed should accept same-origin auth bootstrap fetches')
assert.match(lunduNginx, /if \(\$harness_embed_allowed = 0\) \{ return 403; \}/, 'Lundu Harness embed should keep direct external access closed')
assert.match(lunduNginx, /location \/company-site\/ \{ try_files \$uri \$uri\/ \/company-site\/index\.html; \}/, 'Lundu company-site micro app should be served from the static release')
for (const route of ['admin', 'public', 'auth']) {
  assert.match(lunduNginx, new RegExp(`location /company-site/${route}/ \\{ proxy_pass http://agent:8078/company-site/${route}/;`), `Lundu company-site ${route} API should stay on the Agent boundary`)
}
assert.doesNotMatch(lunduNginx, /location \/company-site\/ \{ proxy_pass/, 'Lundu company-site static entry must not be swallowed by the Agent proxy')
for (const [name, source, upstream] of [['Lundu Nginx', lunduNginx, 'agent:8078'], ['Root Nginx', rootNginx, 'agent-runtime:8078']]) {
  assert.match(source, /\^\/\(ai\|flash\|twin\|document-intake\)\//, `${name} should proxy canonical Harness routes`)
  assert.match(source, new RegExp(`proxy_pass http://${upstream.replace(':', '\\:')}`), `${name} should proxy canonical routes to the Runtime`)
  assert.match(source, /proxy_set_header Upgrade \$http_upgrade/, `${name} should preserve WebSocket upgrades`)
  assert.match(source, /proxy_set_header Connection "upgrade"/, `${name} should preserve WebSocket connection upgrades`)
}
for (const [plugin, packageId] of [['eiscore-auth', 'eiscore-auth'], ['eiscore-digital-twin', 'digital-twin'], ['eiscore-enterprise-bi', 'enterprise-bi']]) {
  assert.match(lunduPatch, new RegExp(`id: ${plugin}[\\s\\S]+client-plugins/${packageId}/lib/index\\.js`), `Lundu patch must load ${plugin}`)
  assert.match(lunduPatch, new RegExp(`id: ${plugin}[\\s\\S]+inject: \\[connection\\]`), `Lundu patch must inject ${plugin} after the Web connection service`)
}

assert.match(template, /^POSTGRES_PASSWORD=replace_me_/m, 'environment template should expose the database password contract')
assert.match(template, /^PGRST_JWT_SECRET=replace_me_/m, 'environment template should expose the JWT contract')
assert.match(template, /^POSTGREST_DB_PASSWORD=replace_me_/m, 'environment template should expose the PostgREST role password contract')
assert.match(template, /^AGENT_DB_PASSWORD=replace_me_/m, 'environment template should expose the agent role password contract')
assert.match(template, /^EISCORE_PUBLIC_BASE_URL=https:\/\//m, 'environment template should expose the public origin contract')
assert.match(template, /^EISCORE_HARNESS_ENABLED=true$/m, 'environment template should enable Harness explicitly')
assert.match(template, /^EISCORE_HARNESS_URL=http:\/\/harness-bridge:3080$/m, 'environment template should point at the dedicated Harness bridge')
assert.match(template, /^EISCORE_HARNESS_BRIDGE_SECRET=replace_me_/m, 'environment template should expose the Runtime-to-Bridge secret contract')
assert.match(template, /^DSH_PROVIDER=deepseek-official$/m, 'environment template should select the DeepSeek provider')
assert.match(template, /^DSH_MODEL=deepseek-v4-flash$/m, 'environment template should select the DeepSeek model')
assert.match(lunduTemplate, /^LUNDU_HARNESS_ROOT=\S+$/m, 'Lundu environment template should expose the external Harness artifact root')
assert.match(lunduTemplate, /^EISCORE_HARNESS_BRIDGE_SECRET=replace_me_/m, 'Lundu environment template should expose the Runtime-to-Bridge secret contract')
assert.match(lunduTemplate, /^DSH_PROVIDER=deepseek-official$/m, 'Lundu environment template should expose the SDK provider route')
assert.match(lunduTemplate, /^DSH_MODEL=deepseek-v4-flash$/m, 'Lundu environment template should expose the SDK model route')
assert.match(lunduTemplate, /^BRIDGE_STATE_FILE=\/var\/lib\/dsh\/bridge-state\.json$/m, 'Lundu environment template should expose the bridge state file')
assert.match(lunduTemplate, /^BRIDGE_PROMPT_TIMEOUT_MS=120000$/m, 'Lundu environment template should expose the prompt timeout')
assert.match(lunduTemplate, /^BRIDGE_SESSION_DRAIN_TIMEOUT_MS=120000$/m, 'Lundu environment template should expose the session drain timeout')
assert.match(lunduTemplate, /^BRIDGE_RPC_TIMEOUT_MS=120000$/m, 'Lundu environment template should expose the RPC timeout')
assert.match(lunduTemplate, /^BRIDGE_SHUTDOWN_TIMEOUT_MS=1000$/m, 'Lundu environment template should expose the bounded shutdown wait')
assert.throws(
  () => validateProductionEnv(parseEnvFile(template)),
  ProductionEnvValidationError,
  'the example template must not be deployable without replacing placeholders'
)

for (const source of deployScripts) {
  assert.doesNotMatch(source, /postgres123|your-secret-jwt-key/i, 'deploy scripts must not inject known weak secrets')
  assert.match(source, /validate-production-env\.mjs --env-file/, 'deploy scripts should block invalid production configuration')
  assert.match(source, /docker compose --env-file|docker-compose --env-file/, 'deploy scripts should pass the validated env file to Compose')
}

const valid = {
  POSTGRES_PASSWORD: 'Db9_Nx2pL7vQ4sK8mT5wY1cR6aH3',
  PGRST_JWT_SECRET: 'Jwt8_Zp3Lm7Qx2Vc9Bn5Ks1Hd6Rt4Wy0Fa',
  POSTGREST_DB_PASSWORD: 'Api6_Qm9Xv4Rs2Lp8Nk5Wd7Hy3Tz1',
  AGENT_DB_PASSWORD: 'Agent4_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_PUBLIC_BASE_URL: 'https://erp.acme.test',
  EISCORE_HARNESS_ENABLED: 'true',
  EISCORE_HARNESS_URL: 'http://harness-bridge:3080',
  EISCORE_HARNESS_AUDIT_FILE: '/var/lib/eiscore/harness-audit.jsonl',
  EISCORE_HARNESS_AUDIT_HASH_KEY: 'HarnessAudit9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_HARNESS_BRIDGE_SECRET: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_TOOL_PROXY_SECRET: 'HarnessProxy9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  DSH_PROVIDER: 'deepseek-official',
  DSH_MODEL: 'deepseek-v4-flash'
}
assert.deepEqual(validateProductionEnv(valid), {
  publicBaseUrl: valid.EISCORE_PUBLIC_BASE_URL,
  harnessConfigured: true
})
for (const key of retiredRuntimeEnvKeys) {
  assert.throws(
    () => validateProductionEnv({ ...valid, [key]: 'retired-value' }),
    (error) => error instanceof ProductionEnvValidationError && error.issues.some((issue) => issue.includes(key)),
    `${key} should be rejected when non-empty`
  )
}
assert.doesNotThrow(() => validateProductionEnv({ ...valid, ANTHROPIC_API_KEY: '', CLINE_OPENAI_MODEL: '   ' }))

for (const [name, value] of [
  ['missing values', {}],
  ['known weak password', { ...valid, POSTGRES_PASSWORD: 'postgres123' }],
  ['short JWT secret', { ...valid, PGRST_JWT_SECRET: 'too-short' }],
  ['reused role password', { ...valid, AGENT_DB_PASSWORD: valid.POSTGREST_DB_PASSWORD }],
  ['customer placeholder URL', { ...valid, EISCORE_PUBLIC_BASE_URL: 'https://erp.example.com' }],
  ['non-HTTPS URL', { ...valid, EISCORE_PUBLIC_BASE_URL: 'http://erp.acme.test' }],
  ['URL with path', { ...valid, EISCORE_PUBLIC_BASE_URL: 'https://erp.acme.test/eiscore' }],
  ['Harness disabled', { ...valid, EISCORE_HARNESS_ENABLED: 'false' }],
  ['Harness Web UI used as bridge', { ...valid, EISCORE_HARNESS_URL: 'http://deepseek-web:3080' }],
  ['Harness loopback used as bridge', { ...valid, EISCORE_HARNESS_URL: 'http://127.0.0.1:3080' }],
  ['Harness URL with path', { ...valid, EISCORE_HARNESS_URL: 'http://deepseek-web:3080/v1' }],
  ['Harness audit key too short', { ...valid, EISCORE_HARNESS_AUDIT_HASH_KEY: 'too-short' }],
  ['Harness bridge secret too short', { ...valid, EISCORE_HARNESS_BRIDGE_SECRET: 'too-short' }],
  ['reused Harness bridge and tool proxy secrets', { ...valid, EISCORE_TOOL_PROXY_SECRET: valid.EISCORE_HARNESS_BRIDGE_SECRET }],
  ['invalid bridge timeout', { ...valid, BRIDGE_RPC_TIMEOUT_MS: '0' }],
  ['non-integer bridge timeout', { ...valid, BRIDGE_SESSION_DRAIN_TIMEOUT_MS: '120s' }],
  ['overflow bridge timeout', { ...valid, BRIDGE_PROMPT_TIMEOUT_MS: '2147483648' }],
  ['missing DSH provider', { ...valid, DSH_PROVIDER: '' }],
  ['invalid DSH model', { ...valid, DSH_MODEL: 'deepseek chat' }]
]) {
  assert.throws(() => validateProductionEnv(value), ProductionEnvValidationError, `${name} should fail validation`)
}

assert.deepEqual(parseEnvFile('A=one\nexport B="two"\nC=\'three\'\n'), { A: 'one', B: 'two', C: 'three' })
assert.throws(() => parseEnvFile('A=one\nA=two\n'), ProductionEnvValidationError, 'duplicate variables should fail')

console.log('PASS: production configuration security regression')
