import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const compose = readFileSync(resolve('docker-compose.yml'), 'utf8')
const service = (name) => {
  const match = compose.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\n|\\nvolumes:|\\nnetworks:)`))
  assert.ok(match, `missing ${name} service`)
  return match[1]
}
const businessWeb = service('deepseek-web')
const flashWeb = service('deepseek-flash-web')
const assistantWeb = service('deepseek-assistant-web')
const businessBridge = service('harness-bridge')
const flashBridge = service('flash-harness-bridge')
const assistantBridge = service('assistant-harness-bridge')
const viteConfig = readFileSync(resolve('eiscore-base/vite.config.js'), 'utf8')

assert.match(businessWeb, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/business/)
assert.match(flashWeb, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/flash/)
assert.match(businessWeb, /DEEPSEEK_API_KEY: "\$\{DEEPSEEK_API_KEY:/)
assert.match(flashWeb, /DEEPSEEK_API_KEY: "\$\{FLASH_DEEPSEEK_API_KEY:/)
assert.doesNotMatch(flashWeb, /DEEPSEEK_API_KEY: "\$\{DEEPSEEK_API_KEY:/)
assert.match(businessWeb, /business-internal:\s*\n\s+aliases: \[deepseek-workbench-web\]/)
assert.match(flashWeb, /networks: \[flash-internal\]/)
assert.match(assistantWeb, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/assistant/)
assert.match(assistantWeb, /EISCORE_HARNESS_PERSONA: work-assistant/)
assert.match(assistantWeb, /DSH_PATCH_PATH: \/opt\/eiscore-harness\/dsh-assistant-web\.patch\.yml/)
assert.match(assistantWeb, /EISCORE_AUTH_COOKIE_PREFIX: assistant-/)
assert.match(assistantWeb, /EISCORE_DSH_AUTH_COOKIE_PREFIX: assistant-/)
assert.match(assistantWeb, /networks: \[business-assistant-internal\]/)
assert.match(businessBridge, /HARNESS_PROFILE: business/)
assert.match(flashBridge, /HARNESS_PROFILE: flash/)
assert.match(assistantBridge, /HARNESS_PERSONA: work-assistant/)
assert.match(assistantBridge, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/assistant/)
assert.match(assistantBridge, /networks: \[business-assistant-internal\]/)
assert.match(businessBridge, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/business/)
assert.match(flashBridge, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/flash/)
assert.match(businessBridge, /HARNESS_PLUGINS: enterprise-bi,worker-grid,digital-twin,workflow,company-sales,document-intake,engineering,independent-site-sales/)
assert.match(flashBridge, /HARNESS_PLUGINS: flash-builder/)
assert.doesNotMatch(flashBridge, /HARNESS_PLUGINS: .*enterprise-bi|HARNESS_PLUGINS: .*digital-twin/)
assert.match(compose, /harness_bridge_dsh_home:\/var\/lib\/dsh/)
assert.match(compose, /flash_harness_bridge_dsh_home:\/var\/lib\/dsh/)
assert.match(compose, /deepseek_web_dsh_home:/)
assert.match(compose, /deepseek_flash_web_dsh_home:/)
assert.match(compose, /deepseek_assistant_web_dsh_home:/)
assert.match(compose, /dsh-assistant-web\.patch\.yml/)
assert.match(compose, /EISCORE_AUTH_COOKIE_PREFIX: workbench-/)
assert.match(compose, /EISCORE_DSH_AUTH_COOKIE_PREFIX: workbench-/)
for (const prefix of ['assistant', 'workbench', 'flash']) {
  assert.match(viteConfig, new RegExp(`['"]\/harness-${prefix}-embed(?:-api|-assets|-plugins)?['"]`), `Vite must proxy ${prefix} Harness paths in local development`)
}

for (const prefix of ['assistant', 'workbench', 'flash']) {
  assert.ok(viteConfig.includes(`'/harness-${prefix}-embed-plugins-events'`), `${prefix} plugin events need a Vite proxy`)
}

const lunduCompose = readFileSync(resolve('deploy/lundu/compose.yml'), 'utf8')
assert.equal((lunduCompose.match(/profile-policy\.js:\/opt\/eiscore-harness\/profile-policy\.js:ro/g) || []).length, 3, 'all Bridge tool roots need their relative policy dependency')
assert.equal((lunduCompose.match(/persona-policy\.mjs:\/opt\/eiscore-harness\/persona-policy\.mjs:ro/g) || []).length, 6, 'all Web and Bridge roots need the trusted persona policy')

const lunduNginx = readFileSync(resolve('deploy/lundu/nginx/lundu-eiscore.conf'), 'utf8')
for (const [path, upstream] of [
  ['/harness-assistant-embed/', 'deepseek-assistant-web:3081/'],
  ['/harness-workbench-embed/', 'deepseek-web:3081/'],
  ['/harness-assistant-embed-api/', 'deepseek-assistant-web:3081/api/'],
  ['/harness-workbench-embed-api/', 'deepseek-web:3081/api/'],
  ['/harness-assistant-embed-assets/', 'deepseek-assistant-web:3081/assets/'],
  ['/harness-workbench-embed-assets/', 'deepseek-web:3081/assets/'],
  ['/harness-assistant-embed-plugins/', 'deepseek-assistant-web:3081/plugins/'],
  ['/harness-workbench-embed-plugins/', 'deepseek-web:3081/plugins/'],
  ['/harness-assistant-embed-plugins-events', 'deepseek-assistant-web:3081/plugins/events'],
  ['/harness-workbench-embed-plugins-events', 'deepseek-web:3081/plugins/events']
]) {
  assert.match(lunduNginx, new RegExp(`location(?: =)? ${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,900}proxy_pass http://${upstream.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${path} must stay bound to its persona upstream`)
}
assert.match(lunduNginx, /location \/harness-embed\/[\s\S]{0,500}proxy_pass http:\/\/deepseek-web:3081\//)
console.log('HARNESS_WEB_ISOLATION_OK')
