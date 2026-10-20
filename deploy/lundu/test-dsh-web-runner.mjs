import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { PassThrough, Readable } from 'node:stream'
import {
  ensureStartupProfile,
  getHarnessAuthReturnPath,
  mapDshAuthCookiesToUpstream,
  mapDshAuthSetCookiesToBrowser,
  resolveDefaultWorkspace,
  resolveHarnessPatchPath
} from './dsh-web-runner.mjs'

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
  assert.equal(getHarnessAuthReturnPath('', 'workbench'), '/harness-workbench-embed-api/eiscore/auth/handoff')
  assert.equal(getHarnessAuthReturnPath('/harness-assistant-embed-api/eiscore/auth/handoff', 'work-assistant'), '/harness-assistant-embed-api/eiscore/auth/handoff')
  assert.equal(getHarnessAuthReturnPath('/harness-workbench-embed-api/eiscore/auth/handoff', 'workbench'), '/harness-workbench-embed-api/eiscore/auth/handoff')
  assert.equal(getHarnessAuthReturnPath('/harness-flash-embed-api/eiscore/auth/handoff', 'flash'), '/harness-flash-embed-api/eiscore/auth/handoff')
  assert.throws(() => getHarnessAuthReturnPath('/harness-assistant-embed-api/eiscore/auth/handoff', 'workbench'), /does not match persona/)
  assert.throws(() => getHarnessAuthReturnPath('/harness-unknown-embed-api/eiscore/auth/handoff', 'workbench'), /does not match persona/)
  assert.equal(mapDshAuthCookiesToUpstream('assistant-dsh-auth-token=a; workbench-dsh-auth-token=b; theme=dark', 'assistant-'), 'dsh-auth-token=a; theme=dark')
  assert.deepEqual(mapDshAuthSetCookiesToBrowser(['dsh-auth-token=a; Path=/'], 'assistant-'), ['assistant-dsh-auth-token=a; Path=/'])
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

// Run the real forwarding body with a local in-memory upstream. The HTML
// adapter must never change Flash, API payloads, or the EISCore auth handoff.
const proxySource = runnerSource.match(/const proxyAuthenticatedRequest = ([\s\S]*?)\nproxy\.on\('upgrade'/)?.[1].trim().replace(/;$/, '')
assert.ok(proxySource)
const forward = async ({ business = true, type = 'text/html; charset=utf-8', html = true, method = 'GET', path = '/' } = {}) => {
  const original = type.startsWith('text/html') ? '<html><head></head><body>Harness</body></html>' : '{"ok":true}'
  let upstreamOptions
  const proxyRequest = runInNewContext(`(${proxySource})`, {
    Buffer,
    businessUi: business ? { injectBusinessUi: (body) => body.replace('</head>', '<script src="/harness-embed/eiscore-ui/business-ui.js"></script></head>') } : null,
    isHtmlNavigation: () => html,
    withToken: (value) => value,
    rewriteAuthStartBody: (body) => body,
    mapAuthSetCookiesToBrowser: (cookies) => cookies,
    browserSetCookies: (cookies) => mapDshAuthSetCookiesToBrowser(cookies, ''),
    cookieHeaders: (value) => value || [],
    authCookiePrefix: '',
    http: { request(options, callback) {
      upstreamOptions = options
      const upstream = new EventEmitter()
      upstream.end = () => {
        const incoming = Readable.from([Buffer.from(original)])
        incoming.statusCode = 200
        incoming.headers = { 'content-type': type, etag: 'original', 'content-length': Buffer.byteLength(original) }
        callback(incoming)
      }
      return upstream
    } }
  })
  const output = new PassThrough()
  output.writeHead = (status, headers) => { output.status = status; output.headers = headers; return output }
  const chunks = []
  output.on('data', (chunk) => chunks.push(chunk))
  const finished = once(output, 'finish')
  proxyRequest({ method, url: path, headers: {}, pipe: (upstream) => upstream.end() }, output)
  await finished
  return { original, body: Buffer.concat(chunks).toString(), headers: output.headers, upstreamOptions }
}
const htmlResponse = await forward()
assert.match(htmlResponse.body, /eiscore-ui\/business-ui\.js/)
assert.equal(htmlResponse.headers['content-length'], Buffer.byteLength(htmlResponse.body))
assert.equal(htmlResponse.headers['cache-control'], 'no-store')
assert.equal(htmlResponse.headers.etag, undefined)
assert.equal(htmlResponse.upstreamOptions.headers['accept-encoding'], 'identity')
for (const options of [{ business: false }, { type: 'application/json' }, { html: false, type: 'application/javascript' }]) {
  const unchanged = await forward(options)
  assert.equal(unchanged.body, unchanged.original)
}
const authResponse = await forward({ html: false, type: 'application/json', method: 'POST', path: '/api/eiscore/auth/start' })
assert.equal(authResponse.body, authResponse.original)

console.log('PASS: Lundu Web startup profile, allowlisted login redirect, business-only HTML injection and unchanged Flash/API forwarding')
