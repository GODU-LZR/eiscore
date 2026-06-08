// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setThemeColor } from '@/utils/theme' // 引入工具

const NANPAI_LOGO_URL = 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3MisnwYo8JqKqQYw9AM49AM.jpg'

const defaultLoginBranding = {
  companyName: '广东南派食品有限公司',
  slogan: '深耕热带水果全产业链，打造高品质水果制品方案',
  description: '根据企业官网公开信息：公司成立于 2009 年，注册资金 1000 万元，总部位于中国雷州半岛；拥有湛江、广西两大加工基地和多条水果加工生产线，面向茶饮、烘焙、饮料与生鲜客户提供一站式水果制品解决方案。',
  logo: NANPAI_LOGO_URL,
  siteTag: '热带水果制品解决方案提供商',
  announcement: '员工与合作伙伴入口',
  headerLoginText: '员工通道',
  authKicker: '员工入口',
  authTitle: '账号登录',
  authSafeNote: '账号由管理员统一分配',
  authFootnote: '该入口仅供授权人员使用',
  primaryActionText: '员工登录',
  secondaryActionText: '了解平台',
  secondaryActionUrl: '/eiscore',
  scrollCueText: '向下了解企业',
  metricsSectionKicker: '企业实力',
  metricsSectionTitle: '多年深耕热带水果产业',
  aboutSectionKicker: '关于企业',
  capabilitiesSectionKicker: '产品与服务',
  capabilitiesSectionTitle: '从产地原料到客户应用的完整服务',
  leadersSectionKicker: '管理团队',
  leadersSectionTitle: '管理团队',
  backgroundImage: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgx6CtnwYoh8fKtgcwgA84vAU!1500x1500.jpg',
  navItems: [
    { label: '企业概况', anchor: 'overview' },
    { label: '关于企业', anchor: 'about' },
    { label: '产品服务', anchor: 'capabilities' },
    { label: '企业实力', anchor: 'metrics' }
  ],
  metrics: [
    { label: '成立时间', value: '2009' },
    { label: '加工基地', value: '2' },
    { label: '注册资金', value: '1000万' }
  ],
  trustBadges: [
    { label: '雷州半岛产地优势' },
    { label: '双加工基地' },
    { label: '多场景客户服务' }
  ],
  businessChain: [
    { title: '原料甄选', description: '依托热带水果产区资源，关注原料风味、成熟度与稳定供应。', status: '产地直采' },
    { title: '加工制造', description: '围绕果浆、果粒、果酱等产品形态，支持规模化与定制化生产。', status: '稳定交付' },
    { title: '客户服务', description: '面向茶饮、烘焙、饮料与生鲜渠道，提供产品方案和交付支持。', status: '多场景适配' }
  ],
  capabilities: [
    { title: '热带水果制品', description: '围绕芒果、菠萝、百香果等热带水果，提供多形态原料产品。' },
    { title: '规模化加工', description: '依托湛江、广西加工基地，保障稳定产能与产品一致性。' },
    { title: '应用方案支持', description: '结合茶饮、烘焙、饮料等使用场景，提供选型与应用建议。' }
  ],
  carouselImages: [
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg5uqnnwYoiNO9CjDcCziIBQ.jpg',
      title: '热带水果全产业链布局',
      subtitle: '覆盖种植、加工、研发、销售与服务'
    },
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3-CwnwYo_qL0ggIwjgI4nwM.jpg',
      title: '加工与品控能力',
      subtitle: '支持多品类水果制品的规模化生产'
    },
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgheiwnwYoj7jo0QQwjgI4nwM.jpg',
      title: '面向多场景客户',
      subtitle: '服务茶饮、烘焙、饮料与生鲜渠道'
    }
  ],
  leaders: [],
  footerText: 'Copyright © EISCore',
  icpText: ''
}

const normalizeCarouselImages = (input) => {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (typeof item === 'string') {
        return { url: item.trim(), title: '', subtitle: '' }
      }
      if (!item || typeof item !== 'object') return null
      return {
        url: String(item.url || '').trim(),
        title: String(item.title || ''),
        subtitle: String(item.subtitle || '')
      }
    })
    .filter((item) => item && item.url)
}

const normalizeLeaders = (input) => {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const name = String(item.name || '').trim()
      if (!name) return null
      return {
        name,
        title: String(item.title || '').trim(),
        intro: String(item.intro || '').trim(),
        avatar: String(item.avatar || '').trim()
      }
    })
    .filter(Boolean)
}

const normalizeNavItems = (input) => {
  if (!Array.isArray(input)) return defaultLoginBranding.navItems.map((item) => ({ ...item }))
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label = String(item.label || '').trim()
      if (!label) return null
      return {
        label,
        anchor: String(item.anchor || '').trim()
      }
    })
    .filter(Boolean)
    .slice(0, 6)
}

const normalizeMetrics = (input) => {
  if (!Array.isArray(input)) return defaultLoginBranding.metrics.map((item) => ({ ...item }))
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label = String(item.label || '').trim()
      const value = String(item.value || '').trim()
      if (!label && !value) return null
      return { label, value }
    })
    .filter(Boolean)
    .slice(0, 4)
}

const normalizeTrustBadges = (input) => {
  if (!Array.isArray(input)) return defaultLoginBranding.trustBadges.map((item) => ({ ...item }))
  return input
    .map((item) => {
      if (typeof item === 'string') return { label: item.trim() }
      if (!item || typeof item !== 'object') return null
      const label = String(item.label || '').trim()
      if (!label) return null
      return { label }
    })
    .filter(Boolean)
    .slice(0, 5)
}

const normalizeBusinessChain = (input) => {
  if (!Array.isArray(input)) return defaultLoginBranding.businessChain.map((item) => ({ ...item }))
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const title = String(item.title || '').trim()
      const description = String(item.description || '').trim()
      const status = String(item.status || '').trim()
      if (!title && !description) return null
      return { title, description, status }
    })
    .filter(Boolean)
    .slice(0, 5)
}

const normalizeCapabilities = (input) => {
  if (!Array.isArray(input)) return defaultLoginBranding.capabilities.map((item) => ({ ...item }))
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const title = String(item.title || '').trim()
      const description = String(item.description || '').trim()
      if (!title && !description) return null
      return { title, description }
    })
    .filter(Boolean)
    .slice(0, 4)
}

const normalizeLoginBranding = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  const legacyName = String(source.companyName || '').trim() === 'EISCore 企业数字化平台'
  const legacySlogan = String(source.slogan || '').includes('让企业管理更高效')
  const noCustomMedia = !String(source.backgroundImage || '').trim()
    && (!Array.isArray(source.carouselImages) || source.carouselImages.length === 0)
    && (!Array.isArray(source.leaders) || source.leaders.length === 0)
  const resolved = legacyName && legacySlogan && noCustomMedia ? {} : source
  return {
    ...defaultLoginBranding,
    ...resolved,
    companyName: String(resolved.companyName || defaultLoginBranding.companyName),
    slogan: String(resolved.slogan || defaultLoginBranding.slogan),
    description: String(resolved.description || defaultLoginBranding.description),
    logo: String(resolved.logo || defaultLoginBranding.logo),
    siteTag: String(resolved.siteTag || defaultLoginBranding.siteTag),
    announcement: String(resolved.announcement || defaultLoginBranding.announcement),
    headerLoginText: String(resolved.headerLoginText || defaultLoginBranding.headerLoginText),
    authKicker: String(resolved.authKicker || defaultLoginBranding.authKicker),
    authTitle: String(resolved.authTitle || defaultLoginBranding.authTitle),
    authSafeNote: String(resolved.authSafeNote || defaultLoginBranding.authSafeNote),
    authFootnote: String(resolved.authFootnote || defaultLoginBranding.authFootnote),
    primaryActionText: String(resolved.primaryActionText || defaultLoginBranding.primaryActionText),
    secondaryActionText: String(resolved.secondaryActionText || defaultLoginBranding.secondaryActionText),
    secondaryActionUrl: String(resolved.secondaryActionUrl || defaultLoginBranding.secondaryActionUrl),
    scrollCueText: String(resolved.scrollCueText || defaultLoginBranding.scrollCueText),
    metricsSectionKicker: String(resolved.metricsSectionKicker || defaultLoginBranding.metricsSectionKicker),
    metricsSectionTitle: String(resolved.metricsSectionTitle || defaultLoginBranding.metricsSectionTitle),
    aboutSectionKicker: String(resolved.aboutSectionKicker || defaultLoginBranding.aboutSectionKicker),
    capabilitiesSectionKicker: String(resolved.capabilitiesSectionKicker || defaultLoginBranding.capabilitiesSectionKicker),
    capabilitiesSectionTitle: String(resolved.capabilitiesSectionTitle || defaultLoginBranding.capabilitiesSectionTitle),
    leadersSectionKicker: String(resolved.leadersSectionKicker || defaultLoginBranding.leadersSectionKicker),
    leadersSectionTitle: String(resolved.leadersSectionTitle || defaultLoginBranding.leadersSectionTitle),
    backgroundImage: String(resolved.backgroundImage || defaultLoginBranding.backgroundImage),
    navItems: normalizeNavItems(resolved.navItems),
    metrics: normalizeMetrics(resolved.metrics),
    trustBadges: normalizeTrustBadges(resolved.trustBadges),
    businessChain: normalizeBusinessChain(resolved.businessChain),
    capabilities: normalizeCapabilities(resolved.capabilities),
    carouselImages: normalizeCarouselImages(
      Array.isArray(resolved.carouselImages) ? resolved.carouselImages : defaultLoginBranding.carouselImages
    ),
    leaders: normalizeLeaders(Array.isArray(resolved.leaders) ? resolved.leaders : defaultLoginBranding.leaders),
    footerText: String(resolved.footerText || defaultLoginBranding.footerText),
    icpText: String(resolved.icpText || '')
  }
}

const normalizeConfig = (input = {}) => {
  const source = input && typeof input === 'object' ? input : {}
  const depth = Number(source.materialsCategoryDepth)
  return {
    title: String(source.title || '海边姑娘管理系统'),
    themeColor: String(source.themeColor || '#409EFF'),
    notifications: source.notifications !== false,
    materialsCategoryDepth: depth === 3 ? 3 : 2,
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
