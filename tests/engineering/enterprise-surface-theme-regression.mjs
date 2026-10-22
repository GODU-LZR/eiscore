// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import {
  DEFAULT_ENTERPRISE_CONFIG,
  EnterpriseConfigError,
  parseEnterpriseConfig,
  validateEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const readJson = (path) => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'))
const loginSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/views/LoginView.vue'), 'utf8')
assert.match(loginSource, /getEnterpriseConfig\(globalThis\)\.branding\?\.themeColor/)
assert.match(loginSource, /'--el-color-primary': theme/)
assert.match(loginSource, /class="auth-overlay" :style="loginThemeStyle"/)

for (const version of [1, 2]) {
  const suffix = version === 1 ? '' : '.v2'
  const example = readJson(`config/enterprise${suffix}.example.json`)
  const schema = readJson(`config/enterprise${suffix}.schema.json`)
  const surfaceSchema = schema.properties.branding.properties.surfaceColor
  assert.deepEqual(surfaceSchema, { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' })
  assert.equal(schema.properties.branding.required.includes('surfaceColor'), false)

  const legacy = parseEnterpriseConfig(example)
  assert.equal(Object.hasOwn(legacy.branding, 'surfaceColor'), false)
  const themed = structuredClone(example)
  themed.branding.surfaceColor = '#f7f5ef'
  assert.deepEqual(validateEnterpriseConfig(themed), [])
  const parsed = parseEnterpriseConfig(themed)
  assert.equal(parsed.branding.surfaceColor, '#F7F5EF')
  const { surfaceColor, ...unchangedBranding } = parsed.branding
  assert.deepEqual(unchangedBranding, legacy.branding)

  for (const invalid of ['', '#fff', '#f7f5ef00', '#gggggg', 'f7f5ef', ' #f7f5ef', null, 1, {}]) {
    const invalidConfig = structuredClone(example)
    invalidConfig.branding.surfaceColor = invalid
    assert.ok(validateEnterpriseConfig(invalidConfig).some((issue) => (
      issue.path === '$.branding.surfaceColor' && issue.code === 'invalid-color'
    )))
    assert.throws(() => parseEnterpriseConfig(invalidConfig), EnterpriseConfigError)
  }
}

assert.equal(Object.hasOwn(DEFAULT_ENTERPRISE_CONFIG.branding, 'surfaceColor'), false)
const yayu = readJson('deploy/yayu/eiscore-enterprise.json')
assert.equal(yayu.branding.surfaceColor, '#f7f0df')
assert.equal(yayu.branding.themeColor, '#9a7b46')
assert.equal(parseEnterpriseConfig(yayu).branding.surfaceColor, '#F7F0DF')

const sourceWithoutImports = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
  .replace(/^import\s[\s\S]*?\sfrom\s+['"][^'"]+['"][^\r\n]*(?:\r?\n|$)/gm, '')
  .replace(/^export /gm, '')
const properties = new Map()
const attributes = new Map()
let currentConfig = parseEnterpriseConfig(yayu)
let syncCount = 0
const theme = runInNewContext(`${sourceWithoutImports('eiscore-base/src/utils/theme.js')}\n({ setThemeColor, mix })`, {
  getEnterpriseConfig: () => currentConfig,
  document: { documentElement: {
    style: { setProperty: (name, value) => properties.set(name, value), removeProperty: (name) => properties.delete(name) },
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name)
  } },
  syncEisThemeScopes: () => { syncCount += 1 },
  EIS_THEME_UPDATED_EVENT: 'eis:theme-updated',
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } },
  window: { dispatchEvent: (event) => assert.equal(event.type, 'eis:theme-updated') }
})
theme.setThemeColor('#285d57')
assert.equal(attributes.has('data-eis-surface'), true)
assert.equal(properties.get('--eis-surface-color'), '#F7F0DF')
assert.equal(properties.get('--page-bg-tint'), '#F7F0DF')
assert.equal(properties.get('--card-bg-tint'), '#F7F0DF')
assert.equal(properties.get('--el-color-primary'), '#285d57')
const loginThemeBody = loginSource.match(/const loginThemeStyle = computed\(\(\) => \{([\s\S]*?)\n\}\)/)?.[1]
assert.ok(loginThemeBody, 'the teleported login dialog must have its own theme')
const loginTheme = runInNewContext(`(() => {${loginThemeBody}\n})()`, {
  safeThemeColor: { value: '#9a7b46' }, mix: theme.mix
})
assert.equal(loginTheme['--login-theme'], '#9a7b46')
assert.equal(loginTheme['--el-color-primary'], '#9a7b46')
assert.equal(loginTheme['--el-color-primary-rgb'], '154,123,70')
assert.equal(loginTheme['--el-color-primary-dark-2'], theme.mix('#9a7b46', '#000000', 0.2))
for (let i = 1; i <= 9; i++) {
  assert.equal(loginTheme[`--el-color-primary-light-${i}`], theme.mix('#9a7b46', '#ffffff', i / 10))
}
assert.equal(Object.hasOwn(loginTheme, 'backgroundColor'), false)
currentConfig = DEFAULT_ENTERPRISE_CONFIG
theme.setThemeColor('#409EFF')
assert.equal(attributes.has('data-eis-surface'), false)
assert.equal(properties.has('--eis-surface-color'), false)
assert.equal(properties.get('--page-bg-tint'), theme.mix('#409EFF', '#ffffff', 0.95))
assert.equal(properties.get('--card-bg-tint'), theme.mix('#409EFF', '#ffffff', 0.85))
assert.equal(syncCount, 2)

const darkMode = { value: true }
const readTheme = runInNewContext(`${sourceWithoutImports('eiscore-base/src/platform/theme-mode.js')}\nuseHostDarkMode`, {
  ref: (value) => ({ value }), watch: () => {}, useDark: () => darkMode,
  getEnterpriseConfig: () => currentConfig,
  getGlobalTheme: () => 'auto', saveGlobalTheme: () => {}, normalizeGlobalTheme: () => null
})
assert.equal(readTheme().value, true)
currentConfig = parseEnterpriseConfig(yayu)
assert.equal(readTheme().value, false)
console.log('enterprise surface theme regression passed')
