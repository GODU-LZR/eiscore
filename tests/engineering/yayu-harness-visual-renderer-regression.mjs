import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('.')
const read = (file) => readFileSync(resolve(root, file), 'utf8')

for (const file of [
  'agent-harness/visual-response-policy.mjs',
  'agent-harness/visual-web-ui.mjs',
  'agent-harness/business-web-ui.mjs',
  'agent-harness/web-ui/visual-ui.js',
  'agent-harness/web-ui/visual-runtime.js',
  'agent-harness/web-ui/visual-runtime.css'
]) assert.ok(existsSync(resolve(root, file)), 'missing renderer input: ' + file)

const runtime = read('agent-harness/web-ui/visual-runtime.js')
assert.match(runtime, /eis-visual-(?:height|ready|error|download)/)
assert.match(runtime, /echarts/)
assert.match(runtime, /Viz\.instance/)

const businessUi = read('agent-harness/web-ui/business-ui.js')
assert.match(businessUi, /compactChartStyle/)
assert.match(businessUi, /height:clamp\(280px,52dvh,380px\)!important/)
assert.match(businessUi, /!\['dot', 'html'\]\.includes\(entry\.kind\)/)
assert.match(businessUi, /window\.matchMedia\('\(max-width: 600px\)'\)\.matches && compactChart \? 420 : 2400/)
const businessUiCss = read('agent-harness/web-ui/business-ui.css')
assert.match(businessUiCss, /@media \(max-width: 600px\)/)
assert.match(businessUiCss, /grid-template-columns:\s*56px minmax\(0,\s*1fr\) 0 !important/)
assert.match(businessUiCss, /\[data-composer-input\].*min-height:\s*76px/)
assert.match(businessUiCss, /\[data-input-scroll\].*max-height:\s*min\(240px,\s*36dvh\)/)

const visualUi = read('agent-harness/web-ui/visual-ui.js')
assert.match(visualUi, /dto/)
assert.match(visualUi, /html/)
assert.match(visualUi, /allow-scripts/)
assert.match(visualUi, /content-security-policy|default-src 'none'/i)

const policy = read('agent-harness/visual-response-policy.mjs')
assert.match(policy, /dto/)
assert.match(policy, /echarts/)
assert.match(policy, /html/)

const runner = read('agent-harness/dsh-web-runner.mjs')
assert.match(runner, /EISCORE_HARNESS_CAPABILITY_PROFILE === 'business'/)
assert.match(runner, /visual-web-ui/)
assert.match(runner, /visualUi\.injectVisualUi/)
assert.match(runner, /businessUi\.injectBusinessUi/)
const visualServer = read('agent-harness/visual-web-ui.mjs')
assert.match(visualServer, /const prefix = '\/eiscore-visual\//)
assert.match(visualServer, /publicPrefix.*harness-embed/)

for (const patch of ['agent-harness/dsh-web.patch.yml', 'agent-harness/dsh-flash-web.patch.yml']) {
  assert.match(read(patch), /eiscore-visual-response-policy/)
}

console.log('PASS: Yayu business and Flash Harness visual renderer boundary')
