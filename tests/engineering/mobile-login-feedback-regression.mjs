// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const loginView = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/LoginView.vue'), 'utf8')

assert.match(loginView, /const LOGIN_REQUEST_TIMEOUT_MS = 15_000/, 'mobile login should define a request timeout')
assert.match(loginView, /new AbortController\(\)/, 'mobile login should abort stalled login requests')
assert.match(loginView, /signal:\s*controller\.signal/, 'mobile login fetch should pass the abort signal')
assert.match(loginView, /loginFeedback\s*=\s*ref/, 'mobile login should keep visible feedback state')
assert.match(loginView, /class="login-feedback"/, 'mobile login should render inline feedback below the submit button')
assert.match(loginView, /登录请求超时，请检查手机网络后重试/, 'mobile login should explain timeout failures')
assert.match(loginView, /登录成功，正在进入移动工作台/, 'mobile login should show visible success progress')

console.log('PASS: mobile login feedback regression')
