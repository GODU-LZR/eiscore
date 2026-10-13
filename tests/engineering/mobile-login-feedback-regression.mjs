// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const repoRoot = resolve(import.meta.dirname, '../..')
const loginView = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/LoginView.vue'), 'utf8').replace(/\r\n/g, '\n')

assert.match(loginView, /const LOGIN_REQUEST_TIMEOUT_MS = 15_000/, 'mobile login should define a request timeout')
assert.match(loginView, /new AbortController\(\)/, 'mobile login should abort stalled login requests')
assert.match(loginView, /signal:\s*controller\.signal/, 'mobile login fetch should pass the abort signal')
assert.match(loginView, /loginFeedback\s*=\s*ref/, 'mobile login should keep visible feedback state')
assert.match(loginView, /class="login-feedback"/, 'mobile login should render inline feedback below the submit button')
assert.match(loginView, /登录请求超时，请检查手机网络后重试/, 'mobile login should explain timeout failures')
assert.match(loginView, /登录成功，正在进入移动工作台/, 'mobile login should show visible success progress')

const loginHandler = loginView.match(/async function handleLogin\(\) \{[\s\S]*?\n\}\n\nfunction goDesktop/)[0]
  .replace(/\n\nfunction goDesktop$/, '')
for (const saved of [true, false]) {
  const feedback = []
  const successes = []
  const failures = []
  const redirects = []
  const loading = { value: false }
  const handleLogin = runInNewContext(`${loginHandler}\nhandleLogin`, {
    loading,
    clearLoginFeedback: () => {},
    postLogin: async () => ({ ok: true, json: async () => ({ token: 'test-token', permissions: [] }) }),
    parseJwt: () => ({ username: 'test-user' }),
    form: { username: 'test-user', remember: false },
    fetch: async () => ({ ok: true, json: async () => [] }),
    setAuth: () => saved,
    rememberUsername: () => {},
    forgetRememberedUsername: () => {},
    showToast: (options) => successes.push(options),
    setLoginFeedback: (...args) => feedback.push(args),
    showFailToast: (message) => failures.push(message),
    route: { query: { redirect: '/inventory' } },
    router: { replace: (path) => redirects.push(path) },
    setTimeout: (callback) => callback()
  })
  await handleLogin()
  assert.equal(loading.value, false)
  assert.equal(successes.length, saved ? 1 : 0)
  assert.deepEqual(redirects, saved ? ['/inventory'] : [])
  if (!saved) {
    assert.match(failures[0], /登录信息保存失败.*浏览器存储.*联系管理员/)
    assert.equal(feedback[0][0], 'error')
  }
}

console.log('PASS: mobile login feedback regression')
