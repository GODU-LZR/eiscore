import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

const requiredFiles = Object.freeze([
  'audit-ledger.js',
  'auth-plugin.mjs',
  'business-session-bindings.mjs',
  'session-access-policy.mjs',
  'web-session-proxy.mjs',
  'adapter-provenance.json',
  'client-plugins/eiscore-auth/package.json',
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
    for (const relative of ['flash-context-plugin.mjs', 'flash-ui.js', 'client-plugins/flash-context/package.json']) {
      if (!isRegularFile(resolve(resolvedRoot, relative))) missing.push(relative)
    }
  }
}
assert.deepEqual(missing, [], `Yayu Harness artifact bundle is incomplete: ${missing.join(', ')}`)
const manifestPath = resolve(resolvedRoot, 'harness-artifact-manifest.json')
assert.ok(isRegularFile(manifestPath), 'Harness artifact manifest is required; build the bundle from source')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
assert.equal(manifest.format, 1)
assert.equal(manifest.kind, 'eiscore-harness-bundle')
assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/)
assert.equal(typeof manifest.sourceDirty, 'boolean')
for (const relative of [...requiredFiles, ...requiredPlugins.map(([, path]) => path), ...(flashPatchPath ? ['client-plugins/flash-context/lib/index.js', 'client-plugins/flash-context/package.json', 'flash-context-plugin.mjs', 'flash-ui.js'] : [])]) {
  assert.match(manifest.files?.[relative] || '', /^[a-f0-9]{64}$/, `Manifest hash is required: ${relative}`)
}
for (const [relative, hash] of Object.entries(manifest.files || {})) {
  assert.ok(relative && !relative.includes('\\') && !relative.split('/').some((part) => !part || part === '.' || part === '..') && !isAbsolute(relative), `Invalid manifest path: ${relative}`)
  const file = resolve(resolvedRoot, relative)
  assert.ok(isRegularFile(file), `Manifest file is missing: ${relative}`)
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), hash, `Harness artifact hash mismatch: ${relative}`)
}
console.log(`PASS: Yayu Harness artifacts (${requiredPlugins.map(([id]) => id).join(', ')})`)
