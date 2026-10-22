import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = resolve(import.meta.dirname, '..')
const source = join(repoRoot, 'agent-harness')
const digest = (body) => createHash('sha256').update(body).digest('hex')

export function buildHarnessBundle(output, version = '1.0.0') {
  assert.ok(isAbsolute(output), 'Harness output must be an absolute path')
  assert.match(version, /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/)
  assert.ok(!existsSync(output) || readdirSync(output).length === 0, 'Harness output must be empty')
  const files = {}
  const write = (relative, body) => {
    mkdirSync(dirname(join(output, relative)), { recursive: true })
    writeFileSync(join(output, relative), body)
    files[relative] = digest(body)
  }
  const copy = (relative) => {
    const path = join(source, relative)
    const stat = lstatSync(path)
    assert.ok(!stat.isSymbolicLink(), `Symlink is not a bundle source: ${relative}`)
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) copy(`${relative}/${name}`)
    } else write(relative, readFileSync(path))
  }
  for (const name of readdirSync(source).sort()) {
    if (/\.(?:mjs|js|json|yml)$/.test(name) && !name.startsWith('test-')) copy(name)
  }
  copy('web-ui')
  for (const [id, entry] of [['eiscore-auth', 'auth-plugin.mjs'], ['flash-context', 'flash-context-plugin.mjs']]) {
    const base = `client-plugins/${id}`
    write(`${base}/package.json`, JSON.stringify({ name: `@eiscore/dsh-client-${id}`, version: '1.0.0', private: true, type: 'module', main: 'lib/index.js', exports: { '.': './lib/index.js' } }, null, 2) + '\n')
    write(`${base}/lib/index.js`, `export { apply, inject } from '../../../${entry}'\n`)
  }
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--', 'agent-harness', 'scripts/build-yayu-harness-bundle.mjs', 'scripts/validate-yayu-harness-artifacts.mjs'], { cwd: repoRoot, encoding: 'utf8' }).trim())
  const manifest = { format: 1, kind: 'eiscore-harness-bundle', version, sourceRevision, sourceDirty, files }
  writeFileSync(join(output, 'harness-artifact-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? '' : process.argv[index + 1] || '' }
  const output = arg('--output')
  const manifest = buildHarnessBundle(output, arg('--version') || '1.0.0')
  console.log(`Built Harness ${manifest.version}: ${Object.keys(manifest.files).length} files at ${output} (source ${manifest.sourceRevision}, dirty=${manifest.sourceDirty})`)
}
