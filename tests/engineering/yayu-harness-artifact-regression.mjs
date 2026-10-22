import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildHarnessBundle } from '../../scripts/build-yayu-harness-bundle.mjs'

const root = mkdtempSync(join(tmpdir(), 'eiscore-yayu-harness-'))
const validator = resolve(import.meta.dirname, '../../scripts/validate-yayu-harness-artifacts.mjs')
const patch = join(root, 'dsh-flash-web.patch.yml')
const run = () => spawnSync(process.execPath, [validator, '--harness-root', root, '--flash-patch', patch], { encoding: 'utf8' })
const output = (result) => result.stdout + result.stderr
try {
  const manifest = buildHarnessBundle(root, 'regression')
  assert.equal(manifest.kind, 'eiscore-harness-bundle')
  const valid = run()
  assert.equal(valid.status, 0, output(valid))
  for (const id of ['eiscore-auth', 'flash-context']) {
    const plugin = await import(pathToFileURL(join(root, `client-plugins/${id}/lib/index.js`)).href)
    assert.equal(typeof plugin.apply, 'function')
    assert.ok(plugin.inject.includes('connection'))
  }
  const auth = join(root, 'auth-plugin.mjs')
  const original = readFileSync(auth)
  writeFileSync(auth, original.toString() + '\n// tampered\n')
  const tampered = run()
  assert.notEqual(tampered.status, 0)
  assert.match(output(tampered), /hash mismatch: auth-plugin/)
  writeFileSync(auth, original)
  const plugin = join(root, 'client-plugins/flash-context/lib/index.js')
  const pluginSource = readFileSync(plugin)
  rmSync(plugin)
  const missing = run()
  assert.notEqual(missing.status, 0)
  assert.match(output(missing), /flash-context/)
  writeFileSync(plugin, pluginSource)
  const manifestPath = join(root, 'harness-artifact-manifest.json')
  delete manifest.files['web-session-proxy.mjs']
  writeFileSync(manifestPath, JSON.stringify(manifest))
  const unlisted = run()
  assert.notEqual(unlisted.status, 0)
  assert.match(output(unlisted), /Manifest hash is required: web-session-proxy/)
} finally {
  rmSync(root, { recursive: true, force: true })
}
console.log('PASS: source bundle builds with exact hashes; tampered adapters, missing Flash plugin and unlisted proxy fail preflight')
