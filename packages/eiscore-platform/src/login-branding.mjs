// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  DEFAULT_ENTERPRISE_CONFIG,
  getEnterpriseConfig
} from './enterprise-config.mjs'

const NEUTRAL_LOGIN_BRANDING = Object.freeze({
  companyName: 'EISCore 企业',
  slogan: '连接业务、数据与智能协作',
  description: '',
  logo: '',
  siteTag: '企业数字化平台',
  announcement: '员工与合作伙伴入口',
  headerLoginText: '员工通道',
  authKicker: '员工入口',
  authTitle: '账号登录',
  authSafeNote: '账号由管理员统一分配',
  authFootnote: '该入口仅供授权人员使用',
  primaryActionText: '员工登录',
  secondaryActionText: '了解平台',
  secondaryActionUrl: '/eiscore',
  showSecondaryAction: false,
  passBadgeText: '员工通行',
  businessChainTitle: '企业服务流程',
  scrollCueText: '向下了解企业',
  metricsSectionKicker: '企业实力',
  metricsSectionTitle: '企业经营与交付能力',
  aboutSectionKicker: '关于企业',
  capabilitiesSectionKicker: '产品与服务',
  capabilitiesSectionTitle: '产品、制造与服务能力',
  leadersSectionKicker: '管理团队',
  leadersSectionTitle: '管理团队',
  backgroundImage: '',
  navItems: Object.freeze([]),
  metrics: Object.freeze([]),
  trustBadges: Object.freeze([]),
  businessChain: Object.freeze([]),
  capabilities: Object.freeze([]),
  carouselImages: Object.freeze([]),
  leaders: Object.freeze([]),
  footerText: 'Copyright © EISCore',
  icpText: ''
})

const TEXT_FIELDS = Object.freeze([
  'companyName',
  'slogan',
  'description',
  'logo',
  'siteTag',
  'announcement',
  'headerLoginText',
  'authKicker',
  'authTitle',
  'authSafeNote',
  'authFootnote',
  'primaryActionText',
  'secondaryActionText',
  'secondaryActionUrl',
  'passBadgeText',
  'businessChainTitle',
  'scrollCueText',
  'metricsSectionKicker',
  'metricsSectionTitle',
  'aboutSectionKicker',
  'capabilitiesSectionKicker',
  'capabilitiesSectionTitle',
  'leadersSectionKicker',
  'leadersSectionTitle',
  'backgroundImage',
  'footerText',
  'icpText'
])
const EXPLICIT_OPTIONAL_MEDIA_FIELDS = new Set(['logo', 'backgroundImage'])

const text = (value, fallback = '') => String(value || fallback || '').trim()
const cloneList = (value) => value.map((item) => ({ ...item }))

function normalizeList(input, fallback, mapper, { fallbackOnEmpty = false, max = 20 } = {}) {
  const hasInput = Array.isArray(input) && (!fallbackOnEmpty || input.length > 0)
  const source = hasInput ? input : fallback
  return source.map(mapper).filter(Boolean).slice(0, max)
}

function normalizeWithFallback(input, fallback, { surface = 'desktop' } = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const result = {}
  for (const key of TEXT_FIELDS) {
    const preservesExplicitEmpty = EXPLICIT_OPTIONAL_MEDIA_FIELDS.has(key)
      && Object.hasOwn(source, key)
    result[key] = preservesExplicitEmpty ? text(source[key]) : text(source[key], fallback[key])
  }
  result.showSecondaryAction = source.showSecondaryAction === undefined
    ? fallback.showSecondaryAction === true
    : source.showSecondaryAction === true
  const fallbackOnEmpty = surface === 'mobile'
  result.navItems = normalizeList(source.navItems, fallback.navItems, (item) => {
    const label = text(item?.label)
    if (!label) return null
    return { label, anchor: text(item?.anchor) }
  }, { fallbackOnEmpty, max: 6 })
  result.metrics = normalizeList(source.metrics, fallback.metrics, (item) => {
    const label = text(item?.label)
    const value = text(item?.value)
    return label || value ? { label, value } : null
  }, { fallbackOnEmpty, max: 4 })
  result.trustBadges = normalizeList(source.trustBadges, fallback.trustBadges, (item) => {
    const label = typeof item === 'string' ? text(item) : text(item?.label)
    return label ? { label } : null
  }, { fallbackOnEmpty, max: 5 })
  result.businessChain = normalizeList(source.businessChain, fallback.businessChain, (item) => {
    const title = text(item?.title)
    const description = text(item?.description)
    const status = text(item?.status)
    return title || description ? { title, description, status } : null
  }, { fallbackOnEmpty, max: 5 })
  result.capabilities = normalizeList(source.capabilities, fallback.capabilities, (item) => {
    const title = text(item?.title)
    const description = text(item?.description)
    return title || description ? { title, description } : null
  }, { fallbackOnEmpty, max: 4 })
  result.carouselImages = normalizeList(source.carouselImages, fallback.carouselImages, (item) => {
    const url = typeof item === 'string' ? text(item) : text(item?.url)
    if (!url) return null
    return {
      url,
      title: text(item?.title),
      subtitle: text(item?.subtitle),
      hasEmbeddedText: item?.hasEmbeddedText === true
    }
  }, { fallbackOnEmpty, max: 6 })
  result.leaders = normalizeList(source.leaders, fallback.leaders, (item) => {
    const name = text(item?.name)
    if (!name) return null
    return {
      name,
      title: text(item?.title),
      intro: text(item?.intro),
      avatar: text(item?.avatar)
    }
  }, { fallbackOnEmpty, max: 20 })
  return result
}

function enterpriseBrandingDefaults(enterpriseConfig, surface) {
  const config = enterpriseConfig || DEFAULT_ENTERPRISE_CONFIG
  const login = config?.branding?.login || {}
  const { mobile, ...shared } = login
  const configured = {
    ...shared,
    companyName: config?.enterprise?.displayName,
    logo: config?.branding?.logoUrl,
    ...(surface === 'mobile' && mobile && typeof mobile === 'object' ? mobile : {})
  }
  return normalizeWithFallback(configured, NEUTRAL_LOGIN_BRANDING, { surface })
}

export function normalizeLoginBranding(input, {
  enterpriseConfig = getEnterpriseConfig(globalThis),
  surface = 'desktop'
} = {}) {
  const fallback = enterpriseBrandingDefaults(enterpriseConfig, surface)
  return normalizeWithFallback(input, fallback, { surface })
}

export function cloneEnterpriseLoginBranding({
  enterpriseConfig = getEnterpriseConfig(globalThis),
  surface = 'desktop'
} = {}) {
  const branding = normalizeLoginBranding({}, { enterpriseConfig, surface })
  for (const key of ['navItems', 'metrics', 'trustBadges', 'businessChain', 'capabilities', 'carouselImages', 'leaders']) {
    branding[key] = cloneList(branding[key])
  }
  return branding
}
