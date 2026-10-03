import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (name, fallback = '') => {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback
}

const bin = resolve(arg('--bin', process.env.DSH_BIN || ''))
const harnessRoot = resolve(arg('--harness-root', process.env.LUNDU_HARNESS_ROOT || ''))
const port = Number(arg('--port', '3098'))
if (!existsSync(bin)) throw new Error('Web plugin smoke requires --bin=<absolute path to dsh/lib/bin.js>')
if (!existsSync(harnessRoot)) throw new Error('Web plugin smoke requires --harness-root=<compiled plugin root>')
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--port must be a valid unprivileged port')

const required = [
  ['eiscore-auth', 'client-plugins/eiscore-auth/lib/index.js'],
  ['eiscore-digital-twin', 'client-plugins/digital-twin/lib/index.js'],
  ['eiscore-enterprise-bi', 'client-plugins/enterprise-bi/lib/index.js']
]
const pluginEntries = required.map(([id, relativePath]) => {
  const file = resolve(harnessRoot, relativePath)
  assert.ok(existsSync(file), `${id} compiled entry is missing: ${file}`)
  return `    - id: ${id}\n      name: ${JSON.stringify(pathToFileURL(file).href)}\n      inject: [connection]`
}).join('\n')

const home = mkdtempSync(join(tmpdir(), 'eiscore-dsh-web-plugin-smoke-'))
const profileDir = join(home, 'profiles', 'web')
const profilePatch = join(profileDir, 'cordis.patch.yml')
mkdirSync(profileDir, { recursive: true })
const manifest = {
  name: 'dsh-profile-web-smoke',
  private: true,
  dependencies: {},
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'], patchReload: 'startup' } }
}
const childArgs = ['--expose-internals', bin, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open']
let child
let stdout = ''
let stderr = ''
try {
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'w' })
  writeFileSync(profilePatch, `- id: ui-eiscore-embed\n  disabled: true\n\n- insert:\n${pluginEntries}\n`, { flag: 'w' })
  const dump = spawnSync(process.execPath, [bin, '--profile', 'web', '--dump-config'], {
    cwd: process.cwd(),
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
    timeout: 15000
  })
  assert.equal(dump.status, 0, `DSH Web config dump failed: ${dump.stderr || dump.error?.message || ''}`)
  for (const [id, relativePath] of required) {
    assert.ok(dump.stdout.includes(`id: ${id}`), `DSH Web config does not contain ${id}`)
    const entryPath = pathToFileURL(resolve(harnessRoot, relativePath)).href
    assert.ok(dump.stdout.includes(entryPath), `DSH Web config does not reference ${id} artifact: ${dump.stdout}`)
  }
  if (!process.argv.includes('--runtime')) {
    console.log(JSON.stringify({ ok: true, mode: 'config-dump', plugins: required.map(([id]) => id) }))
    rmSync(home, { recursive: true, force: true })
    process.exit(0)
  }
  child = spawn(process.execPath, childArgs, {
    cwd: process.cwd(),
    env: { ...process.env, DSH_HOME: home, EISCORE_GATEWAY_URL: 'http://127.0.0.1:1', EISCORE_AUTH_URL: 'http://127.0.0.1:1' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const runtimeRoutes = [
    ['/api/eiscore/auth/status', 'authenticated'],
    ['/api/eiscore/digital-twin/sessions', 'EISCORE_AUTH_REQUIRED'],
    ['/api/eiscore/enterprise-bi/snapshot', 'EISCORE_AUTH_REQUIRED']
  ]
  const deadline = Date.now() + 15000
  let cookie = ''
  let checks = []
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break
    try {
      if (!cookie) {
        const token = stdout.match(/[?&]token=([^\s]+)/)?.[1]
        if (token) {
          const bootstrap = await fetch(`http://127.0.0.1:${port}/?token=${encodeURIComponent(decodeURIComponent(token))}`, { redirect: 'manual' })
          cookie = bootstrap.headers.get('set-cookie')?.split(';', 1)[0] || ''
        }
      }
      if (cookie) {
        checks = []
        for (const [path, marker] of runtimeRoutes) {
          const candidate = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { cookie } })
          const candidateBody = await candidate.text()
          checks.push({ path, status: candidate.status, body: candidateBody.slice(0, 200) })
          if (candidate.status !== 401 || !candidateBody.includes(marker)) break
        }
        if (checks.length === runtimeRoutes.length) break
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    }
  }
  assert.equal(checks.length, runtimeRoutes.length, `EISCore Web plugin routes did not register: ${JSON.stringify(checks)}; childPid=${child.pid}; childExit=${child.exitCode}; stdout=${stdout.slice(-1000)}; stderr=${stderr.slice(-1000)}`)
  const indexResponse = await fetch(`http://127.0.0.1:${port}/`, { headers: { cookie } })
  const indexHtml = await indexResponse.text()
  assert.equal(indexResponse.status, 200, `Authenticated DSH Web index returned ${indexResponse.status}`)
  for (const packageName of ['@eiscore/dsh-client-digital-twin', '@eiscore/dsh-client-enterprise-bi']) {
    assert.ok(indexHtml.includes(packageName), `DSH Web boot graph does not include ${packageName}`)
  }
  const bundleUrls = [...indexHtml.matchAll(/(?:src|href)="([^"]*\/plugins\/[^\"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&'))
  assert.ok(bundleUrls.length > 0, 'DSH Web index does not expose a client plugin bundle URL')
  const bundles = []
  for (const bundleUrl of [...new Set(bundleUrls)]) {
    const bundleResponse = await fetch(new URL(bundleUrl, `http://127.0.0.1:${port}/`), { headers: { cookie } })
    bundles.push({ url: bundleUrl, status: bundleResponse.status })
    assert.equal(bundleResponse.status, 200, `DSH Web client bundle returned ${bundleResponse.status}: ${bundleUrl}`)
  }
  console.log(JSON.stringify({ ok: true, routes: checks, indexStatus: indexResponse.status, bundles, stderrBytes: Buffer.byteLength(stderr) }))
} finally {
  if (child && child.exitCode === null) child.kill()
  rmSync(home, { recursive: true, force: true })
}
