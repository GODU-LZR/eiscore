// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setThemeColor } from '@/utils/theme' // 引入工具
import { normalizeDisplayVisibility } from '@shared/eis-display-control'
import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { normalizeLoginBranding as normalizeEnterpriseLoginBranding } from '@eiscore/platform/login-branding'
import {
  DEFAULT_ENTERPRISE_PROFILE,
  mergeEnterpriseProfileIntoSystemConfig,
  stripEnterpriseProfileFromSystemConfig
} from '@eiscore/platform/enterprise-profile'
import {
  getHostEnterpriseProfileService,
  getHostSystemConfigService
} from '@/platform/http-client'

const normalizeLoginBranding = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  const legacyName = String(source.companyName || '').trim() === 'EISCore 企业数字化平台'
  const legacySlogan = String(source.slogan || '').includes('让企业管理更高效')
  const noCustomMedia = !String(source.backgroundImage || '').trim()
    && (!Array.isArray(source.carouselImages) || source.carouselImages.length === 0)
    && (!Array.isArray(source.leaders) || source.leaders.length === 0)
  const resolved = legacyName && legacySlogan && noCustomMedia ? {} : source
  return normalizeEnterpriseLoginBranding(resolved, {
    enterpriseConfig: getEnterpriseConfig(globalThis)
  })
}

const normalizeConfig = (input = {}) => {
  const source = input && typeof input === 'object' ? input : {}
  const enterpriseConfig = getEnterpriseConfig(globalThis)
  const depth = Number(source.materialsCategoryDepth)
  return {
    title: String(source.title || enterpriseConfig.branding.productName),
    themeColor: String(source.themeColor || enterpriseConfig.branding.themeColor),
    notifications: source.notifications !== false,
    materialsCategoryDepth: depth === 3 ? 3 : 2,
    visibility: normalizeDisplayVisibility(source.visibility),
    loginBranding: normalizeLoginBranding(source.loginBranding)
  }
}

export const useSystemStore = defineStore('system', () => {
  const defaultConfig = normalizeConfig()

  // 1. 定义状态
  const config = ref({
    ...defaultConfig
  })
  const enterpriseProfile = ref(DEFAULT_ENTERPRISE_PROFILE)
  const enterpriseLocale = ref(DEFAULT_ENTERPRISE_PROFILE.defaultLocale || 'zh-CN')
  const baseSystemConfig = ref(defaultConfig)
  let profileRequestId = 0

  // 2. 定义动作
  const updateConfig = (newConfig = {}) => {
    const previousTheme = config.value?.themeColor || defaultConfig.themeColor
    const merged = normalizeConfig({
      ...(config.value || {}),
      ...(newConfig || {})
    })
    config.value = merged
    const hasDom = typeof document !== 'undefined' && !!document.documentElement
    const themeMissing = hasDom ? !document.documentElement.style.getPropertyValue('--el-color-primary') : false
    if (merged.themeColor !== previousTheme || themeMissing) {
      setThemeColor(merged.themeColor)
    }
  }

  const loadEnterpriseProfile = async (locale = enterpriseLocale.value) => {
    const requestId = ++profileRequestId
    const profile = await getHostEnterpriseProfileService().readProfile({ locale })
    if (requestId !== profileRequestId) return enterpriseProfile.value
    if (profile.source === 'deployment-fallback' && enterpriseProfile.value?.source === 'published-site') {
      return enterpriseProfile.value
    }
    enterpriseProfile.value = profile
    enterpriseLocale.value = profile.locale || locale || profile.defaultLocale || 'zh-CN'
    updateConfig(mergeEnterpriseProfileIntoSystemConfig(baseSystemConfig.value, profile))
    return profile
  }

  const loadConfig = async ({ locale = enterpriseLocale.value } = {}) => {
    const requestId = ++profileRequestId
    const [value, profile] = await Promise.all([
      getHostSystemConfigService().readValue('app_settings').catch(() => null),
      getHostEnterpriseProfileService().readProfile({ locale })
    ])
    if (requestId !== profileRequestId) return enterpriseProfile.value
    if (profile.source === 'deployment-fallback' && enterpriseProfile.value?.source === 'published-site') {
      return enterpriseProfile.value
    }
    enterpriseProfile.value = profile
    enterpriseLocale.value = profile.locale || locale || profile.defaultLocale || 'zh-CN'
    const systemConfig = value && typeof value === 'object'
      ? normalizeConfig({ ...defaultConfig, ...value })
      : defaultConfig
    baseSystemConfig.value = systemConfig
    updateConfig(mergeEnterpriseProfileIntoSystemConfig(systemConfig, profile))
  }

  const saveConfig = async (nextConfig) => {
    const runtimePayload = normalizeConfig(mergeEnterpriseProfileIntoSystemConfig({
      ...(config.value || {}),
      ...(nextConfig || {})
    }, enterpriseProfile.value))
    const persistedPayload = stripEnterpriseProfileFromSystemConfig(runtimePayload)
    baseSystemConfig.value = normalizeConfig(persistedPayload)
    updateConfig(runtimePayload)
    try {
      await getHostSystemConfigService().saveValue('app_settings', persistedPayload, {
        description: '系统全局设置'
      })
      return true
    } catch (e) {
      return false
    }
  }

  // 3. 初始化动作 (App启动时调用)
  const initTheme = () => {
    if (config.value.themeColor) {
      setThemeColor(config.value.themeColor)
    }
  }

  return { config, enterpriseProfile, enterpriseLocale, updateConfig, loadConfig, loadEnterpriseProfile, saveConfig, initTheme }
})
