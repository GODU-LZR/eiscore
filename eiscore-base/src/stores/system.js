// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setThemeColor } from '@/utils/theme' // 引入工具
import { normalizeDisplayVisibility } from '@shared/eis-display-control'
import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { normalizeLoginBranding as normalizeEnterpriseLoginBranding } from '@eiscore/platform/login-branding'

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

  const getAuthToken = () => {
    const raw = localStorage.getItem('auth_token')
    if (!raw) return ''
    let token = raw
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.token) token = parsed.token
    } catch (e) {}
    if (token && token.length > 8192) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      return ''
    }
    return token
  }

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

  const loadConfig = async () => {
    try {
      const token = getAuthToken()
      const headers = { 'Accept-Profile': 'public' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/system_configs?key=eq.app_settings', {
        headers
      })
      if (!res.ok) return
      const list = await res.json()
      const row = Array.isArray(list) ? list[0] : null
      if (row?.value && typeof row.value === 'object') {
        const next = normalizeConfig({ ...defaultConfig, ...row.value })
        updateConfig(next)
      }
    } catch (e) {}
  }

  const saveConfig = async (nextConfig) => {
    const payload = normalizeConfig({
      ...(config.value || {}),
      ...(nextConfig || {})
    })
    updateConfig(payload)
    try {
      const token = getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Prefer': 'resolution=merge-duplicates'
      }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/system_configs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'app_settings', value: payload, description: '系统全局设置' })
      })
      if (!res.ok) return false
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

  return { config, updateConfig, loadConfig, saveConfig, initTheme }
}, {
  persist: true // 如果你装了 pinia-plugin-persistedstate 插件，这会自动保存到 localStorage
})
