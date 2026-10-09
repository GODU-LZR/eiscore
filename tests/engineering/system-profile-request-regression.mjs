// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { DEFAULT_ENTERPRISE_CONFIG } from '../../packages/eiscore-platform/src/enterprise-config.mjs'
import { normalizeLoginBranding } from '../../packages/eiscore-platform/src/login-branding.mjs'
import {
  DEFAULT_ENTERPRISE_PROFILE,
  createEnterpriseProfileService,
  mergeEnterpriseProfileIntoSystemConfig,
  stripEnterpriseProfileFromSystemConfig
} from '../../packages/eiscore-platform/src/enterprise-profile.mjs'
import { normalizeDisplayVisibility } from '../../shared/eis-display-visibility-store.mjs'

const storeSource = readFileSync(new URL('../../eiscore-base/src/stores/system.js', import.meta.url), 'utf8')
  .replace(/^import\s[\s\S]*?\sfrom\s+['"][^'"]+['"][^\r\n]*(?:\r?\n|$)/gm, '')
  .replace('export const useSystemStore', 'const useSystemStore')

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function published(locale) {
  const english = locale === 'en-US'
  return {
    site: {
      siteKey: 'regression-site', domain: 'factory.example.test',
      legalName: '示例制造有限公司', defaultLocale: 'zh-CN',
      enabledLocales: ['zh-CN', 'en-US'], status: 'published', publishedVersion: 7
    },
    content: {
      requestedLocale: locale,
      pages: [{ slug: 'home', blocks: { homepage: {
        brandName: english ? 'Example Manufacturing' : '示例制造',
        hero: { titleLines: [english ? 'Reliable manufacturing' : '可靠制造'] }
      } } }]
    }
  }
}

function createHarness() {
  const configReads = [], profileReads = [], saves = [], themes = []
  const profileService = createEnterpriseProfileService({
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    getRequestHost: () => 'factory.example.test',
    httpClient: { requestJson(path) {
      const request = { ...deferred(), path }
      profileReads.push(request)
      return request.promise
    } }
  })
  let saveFails = false
  const configService = {
    readValue(key) {
      assert.equal(key, 'app_settings')
      const request = deferred()
      configReads.push(request)
      return request.promise
    },
    async saveValue(key, payload, options) {
      saves.push({ key, payload, options })
      if (saveFails) throw new Error('save unavailable')
    }
  }
  const store = runInNewContext(`${storeSource}\nuseSystemStore()`, {
    defineStore: (_name, setup) => setup,
    ref: (value) => ({ value }),
    setThemeColor: (color) => themes.push(color),
    getEnterpriseConfig: () => DEFAULT_ENTERPRISE_CONFIG,
    normalizeEnterpriseLoginBranding: normalizeLoginBranding,
    normalizeDisplayVisibility,
    DEFAULT_ENTERPRISE_PROFILE,
    mergeEnterpriseProfileIntoSystemConfig,
    stripEnterpriseProfileFromSystemConfig,
    getHostEnterpriseProfileService: () => profileService,
    getHostSystemConfigService: () => configService
  }, { filename: 'eiscore-base/src/stores/system.js' })
  return { store, configReads, profileReads, saves, themes, failSaves: () => { saveFails = true } }
}

// A locale switch completes before startup config; neither branding nor base settings may regress.
{
  const { store, configReads, profileReads } = createHarness()
  const startup = store.loadConfig({ locale: 'zh-CN' })
  const english = store.loadEnterpriseProfile('en-US')
  assert.match(profileReads[1].path, /locale=en-US$/)
  profileReads[1].resolve({ data: published('en-US') })
  const englishProfile = await english
  const englishConfig = store.config.value
  profileReads[0].resolve({ data: published('zh-CN') })
  configReads[0].resolve({ title: 'Late startup title', notifications: false })
  await startup
  assert.equal(store.enterpriseProfile.value, englishProfile)
  assert.equal(store.enterpriseLocale.value, 'en-US')
  assert.equal(store.config.value, englishConfig)
  assert.equal(store.config.value.loginBranding.companyName, 'Example Manufacturing')
  assert.equal(store.config.value.loginBranding.slogan, 'Reliable manufacturing')
  const refresh = store.loadEnterpriseProfile('en-US')
  profileReads[2].resolve({ data: published('en-US') })
  await refresh
  assert.equal(store.config.value.title, DEFAULT_ENTERPRISE_CONFIG.branding.productName)
  assert.equal(store.config.value.notifications, true)
}

// Successful config loading and saving keep runtime branding separate from persisted settings.
{
  const { store, configReads, profileReads, saves, themes, failSaves } = createHarness()
  const load = store.loadConfig({ locale: 'en-US' })
  configReads[0].resolve({
    title: 'Internal console', themeColor: '#123456', notifications: false,
    materialsCategoryDepth: 3, visibility: { hiddenModules: [' sales ', 'sales'] }
  })
  profileReads[0].resolve({ data: published('en-US') })
  await load
  assert.equal(store.config.value.title, 'Internal console')
  assert.equal(store.config.value.themeColor, '#123456')
  assert.equal(store.config.value.notifications, false)
  assert.equal(store.config.value.materialsCategoryDepth, 3)
  assert.deepEqual(store.config.value.visibility.hiddenModules, ['sales'])
  assert.deepEqual(themes, ['#123456'])
  const retainedProfile = store.enterpriseProfile.value
  const retainedConfig = store.config.value

  // The real profile service converts failed HTTP reads to deployment-fallback.
  const failedSwitch = store.loadEnterpriseProfile('zh-CN')
  profileReads[1].reject(new Error('profile unavailable'))
  assert.equal(await failedSwitch, retainedProfile)
  assert.equal(store.enterpriseProfile.value, retainedProfile)
  assert.deepEqual(store.enterpriseProfile.value.enabledLocales, ['zh-CN', 'en-US'])
  assert.equal(store.enterpriseLocale.value, 'en-US')
  assert.equal(store.config.value, retainedConfig)
  const failedConfig = store.loadConfig({ locale: 'zh-CN' })
  configReads[1].resolve({ title: 'Fallback overwrite', notifications: true })
  profileReads[2].reject(new Error('profile unavailable'))
  await failedConfig
  assert.equal(store.enterpriseProfile.value, retainedProfile)
  assert.deepEqual(store.enterpriseProfile.value.enabledLocales, ['zh-CN', 'en-US'])
  assert.equal(store.config.value, retainedConfig)
  assert.equal(store.enterpriseLocale.value, 'en-US')

  assert.equal(await store.saveConfig({ title: 'Saved console', themeColor: '#654321' }), true)
  assert.equal(saves[0].key, 'app_settings')
  assert.equal(saves[0].options.description, '系统全局设置')
  assert.equal(saves[0].payload.title, 'Saved console')
  assert.equal(saves[0].payload.notifications, false)
  assert.equal(saves[0].payload.materialsCategoryDepth, 3)
  for (const field of ['companyName', 'logo', 'siteTag', 'description', 'secondaryActionUrl']) {
    assert.equal(Object.hasOwn(saves[0].payload.loginBranding, field), false)
  }
  assert.equal(store.config.value.loginBranding.companyName, 'Example Manufacturing')
  assert.equal(store.enterpriseProfile.value, retainedProfile)
  const refresh = store.loadEnterpriseProfile('en-US')
  profileReads[3].resolve({ data: published('en-US') })
  await refresh
  assert.equal(store.config.value.title, 'Saved console')
  assert.equal(store.config.value.themeColor, '#654321')
  assert.equal(store.config.value.notifications, false)
  failSaves()
  assert.equal(await store.saveConfig({ notifications: true }), false)
  assert.equal(store.config.value.notifications, true)
  assert.equal(store.config.value.loginBranding.companyName, 'Example Manufacturing')
  assert.equal(store.enterpriseLocale.value, 'en-US')
}

// With no published profile to retain, initial failures still use deployment defaults.
for (const action of ['loadConfig', 'loadEnterpriseProfile']) {
  const { store, configReads, profileReads } = createHarness()
  const load = action === 'loadConfig'
    ? store.loadConfig({ locale: 'en-US' })
    : store.loadEnterpriseProfile('en-US')
  if (configReads.length) configReads[0].reject(new Error('settings unavailable'))
  profileReads[0].reject(new Error('profile unavailable'))
  await load
  assert.equal(store.enterpriseProfile.value.source, 'deployment-fallback')
  assert.deepEqual(store.enterpriseProfile.value.enabledLocales, ['zh-CN'])
  assert.equal(store.enterpriseLocale.value, 'zh-CN')
  assert.equal(store.config.value.title, DEFAULT_ENTERPRISE_CONFIG.branding.productName)
  assert.equal(store.config.value.loginBranding.companyName, DEFAULT_ENTERPRISE_CONFIG.enterprise.displayName)
  assert.equal(store.config.value.notifications, true)
}

console.log('PASS: system profile requests preserve the latest published locale and deployment fallback')
