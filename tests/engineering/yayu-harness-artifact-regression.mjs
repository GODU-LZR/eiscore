import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const validator = resolve(repoRoot, 'scripts/validate-yayu-harness-artifacts.mjs')
const tempRoot = mkdtempSync(join(tmpdir(), 'eiscore-yayu-harness-'))
const requiredFiles = [
  'audit-ledger.js', 'dsh-http-bridge.mjs', 'dsh-web-runner.mjs',
  'dsh-web.patch.yml', 'dsh-web-defaults.mjs',
  'eiscore-restricted.cordis.yml', 'eiscore-tools.mjs', 'http-bridge.js',
  'plugin-contract.v1.json', 'plugin-registry.js', 'visual-response-policy.mjs',
  'business-web-ui.mjs', 'visual-web-ui.mjs', 'web-ui/business-ui.css',
  'web-ui/business-ui.js', 'web-ui/visual-runtime.css', 'web-ui/visual-runtime.js',
  'web-ui/visual-ui.js', 'web-ui/vendor/echarts.min.js', 'web-ui/vendor/viz-standalone.js',
  'client-plugins/eiscore-auth/lib/index.js'
]

const write = (relative, content = 'fixture') => {
  const target = join(tempRoot, relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

try {
  for (const relative of requiredFiles) write(relative)
  write('dsh-web.patch.yml', "name: business\nname: '/opt/eiscore-harness/client-plugins/eiscore-auth/lib/index.js'\n")
  write('dsh-flash-web.patch.yml', "name: flash\nname: '/opt/eiscore-harness/client-plugins/eiscore-auth/lib/index.js'\nname: '/opt/eiscore-harness/client-plugins/flash-context/lib/index.js'\n")
  const valid = spawnSync(process.execPath, [validator, '--harness-root', tempRoot], { encoding: 'utf8' })
  assert.equal(valid.status, 0, valid.stderr || valid.stdout)

  const flashPatch = join(tempRoot, 'dsh-flash-web.patch.yml')
  write('dsh-flash-web.patch.yml', "name: flash\nname: '/opt/eiscore-harness/client-plugins/eiscore-auth/lib/index.js'\nname: '/opt/eiscore-harness/client-plugins/flash-context/lib/index.js'\n")
  const missingFlashPlugin = spawnSync(process.execPath, [validator, '--harness-root', tempRoot, '--flash-patch', flashPatch], { encoding: 'utf8' })
  assert.notEqual(missingFlashPlugin.status, 0)
  assert.match(`${missingFlashPlugin.stdout}\n${missingFlashPlugin.stderr}`, /flash-context/)

  write('client-plugins/flash-context/lib/index.js')
  const validFlash = spawnSync(process.execPath, [validator, '--harness-root', tempRoot, '--flash-patch', flashPatch], { encoding: 'utf8' })
  assert.equal(validFlash.status, 0, validFlash.stderr || validFlash.stdout)

  write('dsh-flash-web.patch.yml', "name: flash\nname: '/opt/eiscore-harness/client-plugins/eiscore-auth/lib/index.js'\n")
  const missingFlashContext = spawnSync(process.execPath, [validator, '--harness-root', tempRoot, '--flash-patch', flashPatch], { encoding: 'utf8' })
  assert.notEqual(missingFlashContext.status, 0)
  assert.match(`${missingFlashContext.stdout}\n${missingFlashContext.stderr}`, /flash-context/)
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}

console.log('PASS: Yayu Harness preflight requires auth for business and flash-context only for Flash')
