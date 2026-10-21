import assert from 'node:assert/strict'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

const requiredFiles = Object.freeze([
  'audit-ledger.js',
  'dsh-http-bridge.mjs',
  'dsh-web-runner.mjs',
  'dsh-web.patch.yml',
  'dsh-web-defaults.mjs',
  'eiscore-restricted.cordis.yml',
  'eiscore-tools.mjs',
  'http-bridge.js',
  'plugin-contract.v1.json',
  'plugin-registry.js',
  'visual-response-policy.mjs',
  'business-web-ui.mjs',
  'visual-web-ui.mjs',
  'web-ui/business-ui.css',
  'web-ui/business-ui.js',
  'web-ui/visual-runtime.css',
  'web-ui/visual-runtime.js',
  'web-ui/visual-ui.js',
  'web-ui/vendor/echarts.min.js',
  'web-ui/vendor/viz-standalone.js'
])
const requiredPlugins = Object.freeze([
  ['eiscore-auth', 'client-plugins/eiscore-auth/lib/index.js']
])
const patchRequirements = Object.freeze({ 'dsh-web.patch.yml': ['eiscore-auth'] })

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? '' : String(process.argv[index + 1] || '').trim()
}
const flashPatchPath = arg('--flash-patch')
const root = arg('--harness-root') || process.env.YAYU_HARNESS_ROOT || ''
assert.ok(root && isAbsolute(root), 'YAYU_HARNESS_ROOT must be an absolute path')
const resolvedRoot = resolve(root)
const isRegularFile = (path) => {
  try {
    const stat = lstatSync(path)
    return stat.isFile() && !stat.isSymbolicLink()
  } catch {
    return false
  }
}
const missing = requiredFiles.filter((relative) => !isRegularFile(resolve(resolvedRoot, relative)))
for (const [pluginId, relative] of requiredPlugins) {
  if (!isRegularFile(resolve(resolvedRoot, relative))) missing.push(`${pluginId}: ${relative}`)
}
for (const [patchName, pluginIds] of Object.entries(patchRequirements)) {
  const patchPath = resolve(resolvedRoot, patchName)
  if (!isRegularFile(patchPath)) continue
  const patch = readFileSync(patchPath, 'utf8')
  for (const pluginId of pluginIds) {
    if (!patch.includes(`client-plugins/${pluginId}/lib/index.js`)) missing.push(`${patchName}: ${pluginId}`)
  }
}
if (flashPatchPath) {
  const patchPath = resolve(flashPatchPath)
  if (!isRegularFile(patchPath)) {
    missing.push(`flash patch: ${flashPatchPath}`)
  } else {
    const patch = readFileSync(patchPath, 'utf8')
    for (const pluginId of ['eiscore-auth', 'flash-context']) {
      if (!patch.includes(`client-plugins/${pluginId}/lib/index.js`)) missing.push(`flash patch: ${pluginId}`)
    }
    if (!isRegularFile(resolve(resolvedRoot, 'client-plugins/flash-context/lib/index.js'))) {
      missing.push('flash-context: client-plugins/flash-context/lib/index.js')
    }
  }
}
assert.deepEqual(missing, [], `Yayu Harness artifact bundle is incomplete: ${missing.join(', ')}`)
console.log(`PASS: Yayu Harness artifacts (${requiredPlugins.map(([id]) => id).join(', ')})`)
