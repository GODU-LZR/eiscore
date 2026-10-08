// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const self = fileURLToPath(import.meta.url)
const repo = fileURLToPath(new URL('../..', import.meta.url))

// This process doubles as a fake DSH child: exercise the actual smoke exit code,
// including the last-route failure that used to be accepted as a successful boot.
if (process.argv.includes('--profile')) {
  if (process.argv.includes('--dump-config')) {
    console.log(readFileSync(join(process.env.DSH_HOME, 'profiles/web/cordis.patch.yml'), 'utf8'))
  } else {
    const port = Number(process.argv[process.argv.indexOf('--port') + 1])
    const server = http.createServer((request, response) => {
      const path = new URL(request.url, 'http://127.0.0.1').pathname
      if (request.url.startsWith('/?token=')) {
        response.writeHead(303, { location: '/', 'set-cookie': 'dsh-auth-fixture=fixture; HttpOnly' }).end()
      } else if (path.startsWith('/api/')) {
        const lastRoute = path.endsWith('/snapshot')
        const status = lastRoute && process.env.EISCORE_SMOKE_FIXTURE_MODE === 'bad-status' ? 503 : 401
        const body = path.endsWith('/status') ? { authenticated: false }
          : lastRoute && process.env.EISCORE_SMOKE_FIXTURE_MODE === 'bad-marker' ? { code: 'WRONG_ROUTE' }
          : { code: 'EISCORE_AUTH_REQUIRED' }
        response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
      } else if (path === '/') {
        response.end('@eiscore/dsh-client-digital-twin @eiscore/dsh-client-enterprise-bi <script src="/plugins/fixture.js"></script>')
      } else response.end('fixture')
    })
    server.listen(port, '127.0.0.1', () => console.log(`dsh web: http://127.0.0.1:${port}/?token=fixture`))
  }
} else {
  const harnessRoot = mkdtempSync(join(tmpdir(), 'eiscore-web-smoke-regression-'))
  try {
    for (const name of ['eiscore-auth', 'digital-twin', 'enterprise-bi']) {
      const entry = join(harnessRoot, 'client-plugins', name, 'lib/index.js')
      mkdirSync(dirname(entry), { recursive: true })
      writeFileSync(entry, '')
    }
    for (const mode of ['good', 'bad-status', 'bad-marker']) {
      const reservation = http.createServer()
      await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
      const port = reservation.address().port
      await new Promise(resolve => reservation.close(resolve))
      const child = spawn(process.execPath, [join(repo, 'scripts/dsh-web-plugin-runtime-smoke.mjs'),
        '--bin', self, '--harness-root', harnessRoot, '--runtime', '--port', String(port)], {
        cwd: repo, env: { ...process.env, EISCORE_SMOKE_FIXTURE_MODE: mode }, stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = '', stderr = ''
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      const timeout = setTimeout(() => child.kill(), 25000)
      const code = await new Promise(resolve => child.once('close', resolve))
      clearTimeout(timeout)
      if (mode === 'good') {
        assert.equal(code, 0, stderr)
        assert.equal(JSON.parse(stdout).ok, true)
      } else {
        assert.equal(code, 1, `${mode} must reject a failing final route`)
        assert.match(stderr, mode === 'bad-status' ? /unexpected status/ : /unexpected body/)
        assert.ok(!stdout.includes('"ok":true'), 'Rejected routes must not report success')
      }
      console.log(`PASS: Web smoke ${mode}`)
    }
  } finally {
    rmSync(harnessRoot, { recursive: true, force: true })
  }
}
