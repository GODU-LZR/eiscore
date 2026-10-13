import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { ensureStartupProfile, resolveDefaultWorkspace, resolveHarnessPatchPath } from './dsh-web-runner.mjs'

const home = mkdtempSync(join(tmpdir(), 'eiscore-dsh-web-profile-'))
try {
  const profileDir = join(home, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-web',
    dsh: { profile: { bundles: ['custom-bundle'], patchReload: 'live' } }
  }))
  writeFileSync(join(profileDir, 'cordis.patch.yml'), '- id: custom\n')

  const result = ensureStartupProfile(home)
  const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8'))
  assert.deepEqual(manifest.dsh.profile.bundles, ['custom-bundle'])
  assert.equal(manifest.dsh.profile.patchReload, 'startup')
  assert.equal(readFileSync(result.patchPath, 'utf8'), '- id: custom\n')

  const freshHome = mkdtempSync(join(tmpdir(), 'eiscore-dsh-web-profile-fresh-'))
  try {
    const fresh = ensureStartupProfile(freshHome)
    const freshManifest = JSON.parse(readFileSync(fresh.manifestPath, 'utf8'))
    assert.deepEqual(freshManifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
    assert.equal(freshManifest.dsh.profile.patchReload, 'startup')
    assert.equal(readFileSync(fresh.patchPath, 'utf8'), '[]\n')
  } finally {
    rmSync(freshHome, { recursive: true, force: true })
  }

  assert.throws(() => ensureStartupProfile(''), /DSH_HOME is required/)
  assert.equal(resolveHarnessPatchPath(''), '/opt/eiscore-harness/dsh-web.patch.yml')
  assert.equal(resolveHarnessPatchPath('/opt/eiscore-harness/dsh-flash-web.patch.yml'), '/opt/eiscore-harness/dsh-flash-web.patch.yml')
  assert.equal(resolveDefaultWorkspace('/var/lib/dsh/workspaces/flash', home), '/var/lib/dsh/workspaces/flash')
  assert.throws(() => resolveDefaultWorkspace('relative/path', home), /DSH_DEFAULT_WORKSPACE must be an absolute path/)
} finally {
  rmSync(home, { recursive: true, force: true })
}

// Exercise the production redirect without launching DSH or binding a port.
const runnerSource = readFileSync(new URL('./dsh-web-runner.mjs', import.meta.url), 'utf8')
const redirectSource = runnerSource.match(/const redirectToLogin = ([\s\S]*?)\nconst isAuthenticated =/)?.[1].trim().replace(/;$/, '')
assert.ok(redirectSource)
let loginUrl = 'https://eiscore.test/login?nonce=one'
const redirect = runInNewContext(`(${redirectSource})`, {
  URL,
  process: { env: { EISCORE_AUTH_URL: 'https://eiscore.test/login' } },
  requestUpstream: async () => ({ statusCode: 200, body: JSON.stringify({ url: loginUrl }), headers: {} }),
  rewriteAuthStartBody: (body) => body,
  allowedAuthOrigin: () => 'https://eiscore.test',
  getHarnessAuthReturnPath: () => '/harness-flash-embed-api/eiscore/auth/handoff',
  cookieHeaders: () => [],
  mapAuthSetCookiesToBrowser: (cookies) => cookies,
  authCookiePrefix: 'flash-'
})
const response = () => ({
  writeHead(status, headers) { this.status = status; this.headers = headers; return this },
  end() { this.ended = true }
})
const success = response()
await redirect({}, success, {})
assert.equal(success.status, 302)
const target = new URL(success.headers.location)
assert.equal(target.origin, 'https://eiscore.test')
assert.equal(target.pathname, '/login')
assert.equal(target.searchParams.get('dsh_return'), 'https://eiscore.test/harness-flash-embed-api/eiscore/auth/handoff')
loginUrl = 'https://attacker.test/login'
const rejected = response()
await redirect({}, rejected, {})
assert.equal(rejected.status, 503)
assert.equal(rejected.headers.location, undefined)

console.log('PASS: Lundu Web startup profile and allowlisted login redirect')
