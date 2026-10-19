// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const sha256 = value => createHash('sha256').update(value).digest('hex')
const json = file => JSON.parse(readFileSync(file, 'utf8'))
export const protectedPath = name => !name.startsWith('assets/') && !['index.html', 'sw.js', 'asset-manifest.json', 'release-provenance.json'].includes(name)

export function fileHashes(root) {
  const files = {}
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      assert(!entry.isSymbolicLink(), `symlink forbidden: ${full}`)
      if (entry.isDirectory()) walk(full)
      else {
        assert(entry.isFile(), `non-file forbidden: ${full}`)
        const name = relative(root, full).replaceAll('\\', '/')
        assert(!/[\0\r\n]/.test(name), `invalid file name: ${name}`)
        if (name !== 'release-provenance.json') files[name] = sha256(readFileSync(full))
      }
    }
  }
  walk(root)
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
}

export const treeSha256 = files => sha256(Object.keys(files).sort().map(name => `${name}\0${files[name]}\n`).join(''))

export function stampRelease(source, stamp) {
  const pattern = /\b((?:var|const) RELEASE_VERSION = )'[^']*'/g
  assert.equal([...source.matchAll(pattern)].length, 1, 'exactly one RELEASE_VERSION expected')
  return source.replace(pattern, `$1'${stamp}'`)
}

export function assertSource(repo, required) {
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  assert.equal(git(['status', '--porcelain']), '', 'source must be clean; commit or use an isolated clean worktree')
  execFileSync('git', ['merge-base', '--is-ancestor', required, 'HEAD'], { cwd: repo, stdio: 'pipe' })
  return git(['rev-parse', 'HEAD'])
}

export function validateSite(root, baselineFiles, policy) {
  const files = fileHashes(root)
  for (const [name, hash] of Object.entries(baselineFiles)) {
    assert(protectedPath(name), `not a protected path: ${name}`)
    assert.equal(files[name], hash, `protected file changed/missing: ${name}`)
  }
  for (const mount of policy.mounts) {
    const entry = join(root, mount, 'index.html')
    assert(existsSync(entry), `missing entry: ${mount}`)
    for (const match of readFileSync(entry, 'utf8').matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"'?#]+)[^"']*["']/g)) {
      const url = match[1]
      if (/^(?:https?:|data:|\/\/)/.test(url)) continue
      const target = url.startsWith('/') ? resolve(root, '.' + url) : resolve(dirname(entry), url)
      assert(relative(root, target) && !relative(root, target).startsWith('..'), `invalid direct resource: ${url}`)
      assert(existsSync(target), `missing direct resource: ${url}`)
    }
  }
  const config = json(join(root, 'config/eiscore-enterprise.json'))
  assert.equal(config.enterprise.id, policy.enterpriseId)
  const slides = config.branding.login.carouselImages
  assert.equal(slides.length, policy.carouselCount)
  for (const slide of slides) {
    const url = typeof slide === 'string' ? slide : slide.url
    assert(url?.startsWith('/') && files[url.slice(1)], `missing carousel art: ${url}`)
  }
  assert.equal(new Set(slides.map(slide => typeof slide === 'string' ? slide : slide.url)).size, policy.carouselCount)
  assert(Object.keys(files).some(name => /^assets\/PumpBomViewer-.*\.js$/.test(name)), 'missing 3D viewer chunk')
  for (const name of Object.keys(files).filter(name => name === 'index.html' || /^assets\/.*\.js$/.test(name) || /^config\/.*\.json$/.test(name))) {
    assert(!/君乐缘|junleyuan/i.test(readFileSync(join(root, name), 'utf8')), `wrong public brand: ${name}`)
  }
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  assert.equal(html.split(`href="${policy.favicon}"`).length - 1, 3, 'all three favicon links must preserve deployed PNG')
  assert(files[policy.favicon.slice(1)], 'missing favicon')
  return files
}

function main() {
  const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, args) => arg.startsWith('--') ? [...pairs, [arg.slice(2), args[i + 1]]] : pairs, []))
  assert(options.baseline && options.output, 'usage: npm run release:lundu:prepare -- --baseline <complete-live-release> --output <new-directory>')
  const repo = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const policy = json(join(repo, 'deploy/lundu/web-release-policy.json'))
  const sourceCommit = assertSource(repo, policy.requiredSourceCommit)
  const baseline = resolve(options.baseline)
  const output = resolve(options.output)
  assert(!existsSync(output), 'candidate output must not already exist')
  assert(!output.startsWith(baseline + '/') && !output.startsWith(baseline + '\\'), 'output must be outside baseline')
  const before = fileHashes(baseline)
  const preserved = Object.fromEntries(Object.entries(before).filter(([name]) => protectedPath(name)))
  const baselineManifest = json(join(baseline, 'asset-manifest.json'))
  validateSite(baseline, preserved, policy)
  const commands = []
  function node(args) {
    execFileSync(process.execPath, args, { cwd: repo, stdio: 'inherit', env: process.env })
    commands.push([process.execPath, ...args])
  }
  // An ancestor alone does not protect against a later revert. Exercise the real merge/image behavior.
  for (const name of ['enterprise-profile', 'lundu-product-image', 'enterprise-login-branding', 'enterprise-bootstrap-loading']) {
    node([`tests/engineering/${name}-regression.mjs`])
  }
  const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
  assert(existsSync(npmCli), 'run through npm so npm_execpath identifies the installed CLI')
  // Reinstall from the lockfile rather than trusting a shared node_modules/junction.
  node([npmCli, '--prefix', 'eiscore-base', 'ci', '--no-audit', '--no-fund'])
  const buildArgs = [npmCli, '--prefix', 'eiscore-base', 'run', 'build']
  const buildOutput = execFileSync(process.execPath, buildArgs, { cwd: repo, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  process.stdout.write(buildOutput)
  commands.push([process.execPath, ...buildArgs])
  assert.equal(assertSource(repo, policy.requiredSourceCommit), sourceCommit, 'source changed during build')
  assert.deepEqual(fileHashes(baseline), before, 'baseline changed during build')
  const stamp = `${new Date().toISOString().replace(/[^0-9]/g, '')}-${sourceCommit.slice(0, 12)}-${randomBytes(4).toString('hex')}`
  const host = join(repo, 'eiscore-base/dist')
  mkdirSync(dirname(output), { recursive: true })
  cpSync(baseline, output, { recursive: true })
  rmSync(join(output, 'release-provenance.json'), { force: true })
  rmSync(join(output, 'assets'), { recursive: true })
  cpSync(join(host, 'assets'), join(output, 'assets'), { recursive: true })
  const html = readFileSync(join(host, 'index.html'), 'utf8').replaceAll('href="/favicon.ico"', `href="${policy.favicon}"`)
  writeFileSync(join(output, 'index.html'), stampRelease(html, stamp))
  writeFileSync(join(output, 'sw.js'), stampRelease(readFileSync(join(host, 'sw.js'), 'utf8'), stamp))
  node(['scripts/generate-client-cache-manifest.mjs', output])
  const files = validateSite(output, preserved, policy)
  const manifest = json(join(output, 'asset-manifest.json'))
  assert.equal(new Set(manifest.urls).size, manifest.count)
  assert(manifest.urls.every(url => files[url.slice(1)]), 'manifest references missing resources')
  const receipt = {
    schemaVersion: 1, sourceCommit, requiredSourceCommit: policy.requiredSourceCommit,
    sourceHistory: [...execFileSync('git', ['rev-list', '--ancestry-path', `${policy.requiredSourceCommit}..HEAD`], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean), policy.requiredSourceCommit],
    manifestVersion: manifest.version, treeSha256: treeSha256(files),
    build: { stamp, completedAt: new Date().toISOString(), commands, logSha256: sha256(buildOutput),
      lockfiles: Object.fromEntries(['package-lock.json', 'eiscore-base/package-lock.json'].map(name => [name, sha256(readFileSync(join(repo, name)))])) },
    baseline: { version: baselineManifest.version, indexSha256: before['index.html'], files: preserved }, files
  }
  writeFileSync(join(output, 'release-provenance.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify({ output, sourceCommit, stamp, version: manifest.version, count: manifest.count, treeSha256: receipt.treeSha256, protectedFiles: Object.keys(preserved).length }, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
