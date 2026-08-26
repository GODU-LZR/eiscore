// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setThemeColor } from '@/utils/theme' // 引入工具
import { normalizeDisplayVisibility } from '@shared/eis-display-control'

const IS_JINWEI_HOST = typeof window !== 'undefined' && /^jwwc-admin\.eiscore\.top$/i.test(window.location.hostname)
const DEFAULT_APP_TITLE = IS_JINWEI_HOST ? '湛江市经纬网厂 EISCore 制造协同平台' : '君乐缘台球工厂数字化管理平台'
const LEGACY_FAVICON_URL = '/favicon.ico'
const DEFAULT_FAVICON_URL = IS_JINWEI_HOST ? '/company-site/assets/jinwei/jinwei-mark.svg' : '/company-assets/favicon.png'

const defaultLoginBranding = {
  companyName: '君乐缘台球',
  slogan: '从木料，到一杆入局。',
  description: '台州君乐缘体育用品有限公司，聚焦台球杆与台球器材，从木料现场到产品交付。',
  logo: '/company-assets/junleyuan-mark.png',
  siteTag: '台州君乐缘体育用品有限公司',
  announcement: '员工与客户 / 合作伙伴入口',
  headerLoginText: '登录入口',
  authKicker: '员工与客户入口',
  authTitle: '进入君乐缘',
  authSafeNote: '授权账号登录',
  authFootnote: '员工与客户账号由企业统一创建和管理',
  primaryActionText: '登录企业系统',
  secondaryActionText: '了解君乐缘',
  secondaryActionUrl: '#about',
  scrollCueText: '向下了解君乐缘',
  metricsSectionKicker: 'JUNLEYUAN / FIELD',
  metricsSectionTitle: '材料、制造与交付在同一条链路',
  aboutSectionKicker: 'ABOUT JUNLEYUAN',
  capabilitiesSectionKicker: 'PRODUCT DIRECTION',
  capabilitiesSectionTitle: '台球杆与器材，围绕真实场景交付',
  leadersSectionKicker: '管理团队',
  leadersSectionTitle: '管理团队',
  backgroundImage: '/company-assets/factory-gate.jpeg',
  navItems: [
    { label: '工厂现场', anchor: 'about' },
    { label: '产品方向', anchor: 'capabilities' },
    { label: '制造链路', anchor: 'metrics' }
  ],
  metrics: [
    { label: '工厂现场', value: '真实' },
    { label: '木料目录', value: '31 类' },
    { label: '企业主体', value: '台州' }
  ],
  trustBadges: [
    { label: '木料现场' },
    { label: '分区存放' },
    { label: '台球器材' }
  ],
  businessChain: [
    { title: '材料', description: '从圆棒、片料、方料与块料的现场资料开始。', status: '现场可见' },
    { title: '制造', description: '围绕台球杆加工现场组织材料与工位。', status: '路径清晰' },
    { title: '交付', description: '面向台球杆、台球桌及配套器材开展合作。', status: '方向明确' }
  ],
  capabilities: [
    { title: '台球杆', description: '围绕中式台球、斯诺克与九球等使用场景的球杆方向。' },
    { title: '台球桌', description: '面向俱乐部与家庭场景的台球桌产品方向。' },
    { title: '配套器材', description: '围绕台球空间与日常使用的器材和配套选择。' }
  ],
  carouselImages: [
    { url: '/company-assets/factory-gate.jpeg', title: '工厂门头', subtitle: '君乐缘台球工厂实景' },
    { url: '/company-assets/wood-workshop.jpeg', title: '加工车间', subtitle: '木杆与工位在同一条生产视线里' },
    { url: '/company-assets/material-racks.jpeg', title: '原料仓储', subtitle: '不同木料按形态分区存放' },
    { url: '/company-assets/wood-rods.jpeg', title: '材料细节', subtitle: '圆棒料，是球杆制造的起点' },
    { url: '/company-assets/workshop-wide.jpeg', title: '车间现场', subtitle: '木杆加工与存放现场' }
  ],
  leaders: [],
  footerText: '台州君乐缘体育用品有限公司 · 君乐缘台球工厂',
  icpText: '',
  ...(IS_JINWEI_HOST ? {
    companyName: '经纬网业',
    slogan: '从一根丝，到一座深海网箱。',
    description: '湛江市经纬网厂，聚焦有结网、无结网、绳索与养殖网箱，从线材准备、织造和人工检修，到定型、包装与分批交付。',
    logo: '/company-site/assets/jinwei/jinwei-mark.svg',
    siteTag: '湛江市经纬网厂',
    announcement: '授权员工、计划、仓库、质检与管理入口',
    authKicker: '经纬制造系统',
    authTitle: '进入经纬 EISCore',
    authSafeNote: '账号由经纬网厂管理员统一分配',
    authFootnote: '仅限授权人员使用，操作记录纳入审计',
    secondaryActionText: '查看经纬独立站',
    secondaryActionUrl: 'https://jwwc.eiscore.top/company-site/jinwei',
    scrollCueText: '查看系统能力',
    metricsSectionKicker: 'JINGWEI / OPERATIONS',
    metricsSectionTitle: '规格、生产与交付在同一条链路',
    aboutSectionKicker: 'ABOUT JINGWEI',
    capabilitiesSectionKicker: 'MANUFACTURING MODULES',
    capabilitiesSectionTitle: '从询盘、物料到质量放行',
    navItems: [
      { label: '制造现场', anchor: 'about' },
      { label: '业务模块', anchor: 'capabilities' },
      { label: '协同链路', anchor: 'metrics' }
    ],
    metrics: [{ label: '业务域', value: '全链路' }, { label: '生产状态', value: '可追踪' }, { label: '数据边界', value: '按角色' }],
    trustBadges: [{ label: '规格版本' }, { label: '批次追溯' }, { label: '质量放行' }],
    businessChain: [{ title: '规格', description: '把客户表达整理为可核对的产品与工艺字段。', status: '版本可审' }, { title: '制造', description: '物料、工位、报工与交接沿同一生产任务推进。', status: '状态可见' }, { title: '交付', description: '检验、包装、合同归属和分批出库形成闭环。', status: '链路可追' }],
    capabilities: [{ title: '物料与仓储', description: '批次、库位、齐套与出入库单据统一管理。' }, { title: '生产协同', description: '规格版本、工单、工序交接和生产报工按角色呈现。' }, { title: '质量与设备', description: '检验、不合格处置、设备点检和维护任务集中留痕。' }],
    backgroundImage: '/company-site/assets/jinwei/research-gallery/gallery-003.png',
    carouselImages: [{ url: '/company-site/assets/jinwei/research-gallery/gallery-003.png', title: '经纬网业', subtitle: '经纬制造协同平台' }],
    footerText: '湛江市经纬网厂 · 经纬网业制造协同平台'
  } : {})
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
  const genericFactoryName = ['君乐缘台球工厂', '君乐缘台球'].includes(String(source.companyName || '').trim())
  const genericFactorySlogan = String(source.slogan || '').includes('让生产、仓储与经营协同')
  const noCustomMedia = !String(source.backgroundImage || '').trim()
    && (!Array.isArray(source.carouselImages) || source.carouselImages.length === 0)
    && (!Array.isArray(source.leaders) || source.leaders.length === 0)
  const resolved = ((legacyName && legacySlogan) || (genericFactoryName && genericFactorySlogan)) && noCustomMedia
    ? {}
    : source
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
  const loginBranding = normalizeLoginBranding(source.loginBranding)
  const explicitFavicon = String(source.favicon || source.icon || source.siteIcon || source.faviconUrl || '').trim()
  const fallbackFavicon = explicitFavicon
    && explicitFavicon !== DEFAULT_FAVICON_URL
    && explicitFavicon !== LEGACY_FAVICON_URL
    ? explicitFavicon
    : String(loginBranding.logo || DEFAULT_FAVICON_URL)
  return {
    title: String(source.title || DEFAULT_APP_TITLE),
    favicon: fallbackFavicon,
    themeColor: String(source.themeColor || '#409EFF'),
    notifications: source.notifications !== false,
    materialsCategoryDepth: depth === 3 ? 3 : 2,
    visibility: normalizeDisplayVisibility(source.visibility),
    loginBranding
  }
}

const ensureHeadLink = (selector, rel) => {
  if (typeof document === 'undefined') return null
  let link = document.head.querySelector(selector)
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', rel)
    document.head.appendChild(link)
  }
  return link
}

const applyBrowserBranding = (nextConfig = {}) => {
  if (typeof document === 'undefined') return
  const title = String(nextConfig.title || DEFAULT_APP_TITLE).trim() || DEFAULT_APP_TITLE
  const favicon = String(nextConfig.favicon || DEFAULT_FAVICON_URL).trim() || DEFAULT_FAVICON_URL

  document.title = title

  const iconLink = ensureHeadLink('link[rel="icon"]', 'icon')
  if (iconLink) {
    iconLink.setAttribute('href', favicon)
  }

  const shortcutIconLink = document.head.querySelector('link[rel="shortcut icon"]')
  if (shortcutIconLink) {
    shortcutIconLink.setAttribute('href', favicon)
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
    if (token && token.length > 32768) {
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
    applyBrowserBranding(merged)
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
    applyBrowserBranding(config.value)
    if (config.value.themeColor) {
      setThemeColor(config.value.themeColor)
    }
  }

  return { config, updateConfig, loadConfig, saveConfig, initTheme }
}, {
  persist: true // 如果你装了 pinia-plugin-persistedstate 插件，这会自动保存到 localStorage
})
