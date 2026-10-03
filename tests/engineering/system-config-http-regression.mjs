// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  SystemConfigError,
  createSystemConfigService
} from '../../packages/eiscore-platform/src/system-config.mjs'

const requests = []
const httpClient = {
  async requestJson(path, options = {}) {
    requests.push({ path, options })
    if (options.method === 'POST') return { status: 201, data: null }
    return {
      status: 200,
      data: [{ key: 'app_settings', value: { themeColor: '#409EFF' } }]
    }
  }
}
const service = createSystemConfigService({ httpClient })
assert.deepEqual(await service.readValue('app_settings'), { themeColor: '#409EFF' })
assert.equal(requests[0].path, '/system_configs?key=eq.app_settings')
assert.deepEqual(requests[0].options.headers, { 'Accept-Profile': 'public' })

assert.equal(await service.saveValue('app_settings', { notifications: true }, {
  description: '系统全局设置'
}), true)
assert.equal(requests[1].path, '/system_configs')
assert.equal(requests[1].options.method, 'POST')
assert.equal(requests[1].options.headers['Content-Profile'], 'public')
assert.equal(requests[1].options.headers.Prefer, 'resolution=merge-duplicates')
assert.deepEqual(requests[1].options.body, {
  key: 'app_settings',
  value: { notifications: true },
  description: '系统全局设置'
})

await assert.rejects(
  service.readValue('app_settings&select=secret'),
  (error) => error instanceof SystemConfigError && error.code === 'invalid-key'
)
await assert.rejects(
  service.readValue('ai_glm_config'),
  (error) => error instanceof SystemConfigError && error.code === 'retired-key'
)
await assert.rejects(
  service.saveValue('ai_glm_config', { api_key: 'must-not-send' }),
  (error) => error instanceof SystemConfigError && error.code === 'retired-key'
)
assert.equal(requests.some(({ path }) => path.includes('ai_glm_config')), false)

const invalidResponseService = createSystemConfigService({
  httpClient: { requestJson: async () => ({ status: 200, data: { unexpected: true } }) }
})
await assert.rejects(
  invalidResponseService.readValue('app_settings'),
  (error) => error instanceof SystemConfigError && error.code === 'invalid-response'
)

const repoRoot = resolve(import.meta.dirname, '../..')
const baseStore = readFileSync(resolve(repoRoot, 'eiscore-base/src/stores/system.js'), 'utf8')
const mobileLogin = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/LoginView.vue'), 'utf8')
const hostAdapter = readFileSync(resolve(repoRoot, 'eiscore-base/src/platform/http-client.js'), 'utf8')
const mobileAdapter = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/platform/http-client.js'), 'utf8')
const aiCopilot = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(baseStore, /getHostSystemConfigService\(\)/)
assert.match(mobileLogin, /getMobileSystemConfigService\(\)/)
assert.match(baseStore, /normalizeConfig\(\{ \.\.\.defaultConfig, \.\.\.value \}\)/)
assert.match(mobileLogin, /loginBranding:\s*normalizeBranding\(\{/)
assert.doesNotMatch(baseStore, /fetch\(['"]\/api\/system_configs/)
assert.doesNotMatch(mobileLogin, /fetch\(['"]\/api\/system_configs/)
assert.match(hostAdapter, /onUnauthorized:\s*\(\)\s*=>\s*clearAuthAndRedirect\('\/login'\)/)
assert.match(hostAdapter, /getAccessToken:\s*getToken/)
assert.match(mobileAdapter, /getAccessToken:\s*getToken/)
assert.match(aiCopilot, /getHostSystemConfigService/)
assert.doesNotMatch(aiCopilot, /requestJson\(\s*['"]\/system_configs['"]/)
assert.doesNotMatch(aiCopilot, /requestJson\(\s*`\/system_configs/)

console.log('PASS: system configuration HTTP migration')
