import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const compose = readFileSync(resolve('docker-compose.yml'), 'utf8')
const service = (name, next) => {
  const match = compose.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  ${next}:\\n|\\nvolumes:|\\nnetworks:)`))
  assert.ok(match, `missing ${name} service`)
  return match[1]
}
const businessWeb = service('deepseek-web', 'deepseek-flash-web')
const flashWeb = service('deepseek-flash-web', 'harness-bridge')
const businessBridge = service('harness-bridge', 'flash-harness-bridge')
const flashBridge = service('flash-harness-bridge', 'nginx')

assert.match(businessWeb, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/business/)
assert.match(flashWeb, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/flash/)
assert.match(businessWeb, /DEEPSEEK_API_KEY: "\$\{DEEPSEEK_API_KEY:/)
assert.match(flashWeb, /DEEPSEEK_API_KEY: "\$\{FLASH_DEEPSEEK_API_KEY:/)
assert.doesNotMatch(flashWeb, /DEEPSEEK_API_KEY: "\$\{DEEPSEEK_API_KEY:/)
assert.match(businessWeb, /networks: \[business-internal\]/)
assert.match(flashWeb, /networks: \[flash-internal\]/)
assert.match(businessBridge, /HARNESS_PROFILE: business/)
assert.match(flashBridge, /HARNESS_PROFILE: flash/)
assert.match(businessBridge, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/business/)
assert.match(flashBridge, /DSH_DEFAULT_WORKSPACE: \/var\/lib\/dsh\/workspaces\/flash/)
assert.match(businessBridge, /HARNESS_PLUGINS: enterprise-bi,worker-grid,digital-twin,workflow,company-sales,document-intake,engineering,independent-site-sales/)
assert.match(flashBridge, /HARNESS_PLUGINS: flash-builder/)
assert.doesNotMatch(flashBridge, /HARNESS_PLUGINS: .*enterprise-bi|HARNESS_PLUGINS: .*digital-twin/)
assert.match(compose, /harness_bridge_dsh_home:\/var\/lib\/dsh/)
assert.match(compose, /flash_harness_bridge_dsh_home:\/var\/lib\/dsh/)
assert.match(compose, /deepseek_web_dsh_home:/)
assert.match(compose, /deepseek_flash_web_dsh_home:/)
console.log('HARNESS_WEB_ISOLATION_OK')
