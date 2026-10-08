// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  DEFAULT_ENTERPRISE_CONFIG,
  getEnterpriseConfig
} from './enterprise-config.mjs'

const PROFILE_PATH = '/company-site/public/site-config'
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value, fallback = '') => String(value ?? fallback ?? '').trim()

function freezeProfile(profile) {
  Object.freeze(profile.contact)
  Object.freeze(profile.enabledLocales)
  Object.freeze(profile.seo)
  return Object.freeze(profile)
}

function normalizePublicPath(value) {
  const raw = text(value, '/company')
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('..')) return '/company/'
  return raw === '/' ? '/' : `${raw.replace(/\/+$/, '')}/`
}

function safeAbsoluteUrl(value) {
  const raw = text(value)
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

function safePublicAssetUrl(value) {
  const raw = text(value)
  if (!raw) return ''
  if (raw.startsWith('./assets/')) {
    const suffix = raw.slice(2)
    return suffix.includes('..') || suffix.includes('\\') ? '' : `/company-site/${suffix}`
  }
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('..') && !raw.includes('\\')) return raw
  return safeAbsoluteUrl(raw)
}

const LUNDU_LEGACY_CAROUSEL_ASSETS = Object.freeze({
  '/enterprise-assets/site/ratio/application-wide.png': '/enterprise-assets/site/crops/generated-application-flow-wide.jpg',
  '/enterprise-assets/site/ratio/factory-wide.png': '/enterprise-assets/site/crops/generated-factory-floor-wide.jpg'
})

function normalizeCarouselAssetUrl(value) {
  const url = safePublicAssetUrl(value)
  return LUNDU_LEGACY_CAROUSEL_ASSETS[url] || url
}

function portalList(value, mapper, max = 12) {
  if (!Array.isArray(value)) return Object.freeze([])
  return Object.freeze(value.map(mapper).filter(Boolean).slice(0, max).map((item) => Object.freeze(item)))
}

function normalizePortalCard(item, index) {
  if (!isObject(item)) return null
  const name = text(item.name || item.title)
  if (!name) return null
  const imageCandidate = Array.isArray(item.imageUrls)
    ? item.imageUrls[0]
    : (item.image || item.content?.image)
  const imageUrl = safePublicAssetUrl(isObject(imageCandidate)
    ? (imageCandidate.url || imageCandidate.src)
    : imageCandidate)
  return {
    id: text(item.slug || item.productCode || item.id, `item-${index + 1}`),
    code: text(item.productCode || item.code),
    name,
    category: text(item.category || item.industry),
    summary: text(item.summary || item.description || item.content?.description),
    imageUrl,
    imageAlt: text(isObject(imageCandidate) ? imageCandidate.alt : '', name),
    imageLabel: text(isObject(imageCandidate) ? (imageCandidate.label || imageCandidate.kind) : ''),
    applications: Object.freeze(Array.isArray(item.applications)
      ? item.applications.map((entry) => text(entry)).filter(Boolean).slice(0, 8)
      : [])
  }
}

const DEFAULT_PORTAL_UI = Object.freeze({
  localeName: '中文',
  languageSwitchLabel: '切换语言',
  usernamePlaceholder: '用户名',
  passwordPlaceholder: '密码',
  rememberText: '记住我',
  usernameRequired: '请输入用户名',
  passwordRequired: '请输入密码',
  loginFailed: '登录失败，账号或密码错误',
  loginError: '登录出现异常',
  tokenMissing: '服务器未返回有效 Token',
  loginSuccess: '登录成功，欢迎',
  productDisclaimer: '公开页面只展示产品方向；具体规格、库存、产能、价格与交期以企业确认结果为准。',
  logoAlt: '企业标识',
  trustAriaLabel: '企业能力标签',
  authAriaLabel: '员工登录',
  highlightsAriaLabel: '企业亮点',
  scrollAriaLabel: '查看企业实力'
})

const EMPTY_ENTERPRISE_PORTAL = Object.freeze({
  loginBranding: Object.freeze({}),
  products: Object.freeze([]),
  solutions: Object.freeze([]),
  faq: Object.freeze([]),
  ui: DEFAULT_PORTAL_UI,
  productSectionKicker: '产品方向',
  productSectionTitle: '面向不同应用场景的产品方向',
  solutionSectionKicker: '应用场景',
  solutionSectionTitle: '从真实需求出发的应用方案',
  previewMode: false,
  previewLabel: '',
  factStatus: ''
})

export function enterprisePortalFromSiteConfig(payload) {
  const site = isObject(payload?.site) ? payload.site : {}
  const content = isObject(payload?.content) ? payload.content : {}
  const pages = Array.isArray(content.pages) ? content.pages : []
  const home = pages.find((page) => page?.slug === 'home') || pages[0]
  if (!isObject(home)) return EMPTY_ENTERPRISE_PORTAL

  const homepage = isObject(home?.blocks?.homepage) ? home.blocks.homepage : {}
  const hero = isObject(homepage.hero) ? homepage.hero : {}
  const titleLines = Array.isArray(hero.titleLines)
    ? hero.titleLines.map((entry) => text(entry)).filter(Boolean).slice(0, 3)
    : []
  const products = portalList(content.products, normalizePortalCard)
  const solutions = portalList(content.solutions, normalizePortalCard)
  const faq = portalList(content.faq, (item, index) => {
    if (!isObject(item)) return null
    const question = text(item.question || item.title)
    const answer = text(item.answer || item.content)
    return question && answer ? { id: text(item.id, `faq-${index + 1}`), question, answer } : null
  }, 20)
  const metrics = portalList(homepage.metrics, (item) => {
    const label = text(item?.label)
    const value = text(item?.value)
    return label || value ? { label, value } : null
  }, 4)
  const businessChain = portalList(homepage.businessChain, (item) => {
    const title = text(item?.title)
    const description = text(item?.description)
    return title || description ? { title, description, status: text(item?.status) } : null
  }, 5)
  const capabilities = portalList(homepage.capabilities, (item) => {
    const title = text(item?.title)
    const description = text(item?.description)
    return title || description ? { title, description } : null
  }, 4)
  const signals = portalList(hero.signals, (item) => {
    const label = text(isObject(item) ? item.label : item)
    return label ? { label } : null
  }, 5)
  const carouselImages = portalList([
    ...(Array.isArray(homepage.carouselImages) ? homepage.carouselImages : []),
    ...(isObject(hero.image) ? [{ url: hero.image.src, title: hero.image.alt }] : [])
  ], (item) => {
    const url = normalizeCarouselAssetUrl(isObject(item) ? (item.url || item.src) : item)
    return url ? {
      url,
      title: text(item?.title || item?.alt),
      subtitle: text(item?.subtitle),
      // Lundu's legacy hero-wide crops include their own bilingual headline.
      hasEmbeddedText: item?.hasEmbeddedText === true || /(?:^|\/)hero-wide\.(?:jpe?g|png|webp)$/i.test(url)
    } : null
  }, 6)

  const requestedLocale = text(content.requestedLocale, text(site.defaultLocale, 'zh-CN'))
  const english = requestedLocale.toLowerCase().startsWith('en')
  const defaultNav = english
    ? [
        { label: 'Company', anchor: 'overview' },
        metrics.length ? { label: 'Capabilities', anchor: 'metrics' } : null,
        businessChain.length || capabilities.length ? { label: 'Value chain', anchor: 'capabilities' } : null,
        products.length ? { label: 'Products', anchor: 'products' } : null,
        solutions.length ? { label: 'Applications', anchor: 'solutions' } : null
      ]
    : [
        { label: '企业概况', anchor: 'overview' },
        metrics.length ? { label: '企业能力', anchor: 'metrics' } : null,
        businessChain.length || capabilities.length ? { label: '产业链', anchor: 'capabilities' } : null,
        products.length ? { label: '产品方向', anchor: 'products' } : null,
        solutions.length ? { label: '应用场景', anchor: 'solutions' } : null
      ]
  const configuredNav = portalList(homepage.navItems, (item) => {
    const label = text(item?.label)
    const anchor = text(item?.anchor)
    return label && anchor ? { label, anchor } : null
  }, 6)
  const navItems = configuredNav.length ? configuredNav : defaultNav.filter(Boolean)
  const settings = isObject(site.settings) ? site.settings : {}
  const governance = isObject(payload?.governance) ? payload.governance : {}
  const status = text(site.status)
  const uiDefaults = english
    ? {
        localeName: 'English', languageSwitchLabel: 'Change language', usernamePlaceholder: 'Username',
        passwordPlaceholder: 'Password', rememberText: 'Remember me', usernameRequired: 'Enter your username',
        passwordRequired: 'Enter your password', loginFailed: 'Incorrect username or password',
        loginError: 'Unable to sign in', tokenMissing: 'The server did not return a valid token',
        loginSuccess: 'Welcome', productDisclaimer: 'This public page presents product directions only. Specifications, availability, capacity, pricing and lead time are subject to company confirmation.',
        logoAlt: 'Company logo', trustAriaLabel: 'Company capabilities', authAriaLabel: 'Employee sign in',
        highlightsAriaLabel: 'Company highlights', scrollAriaLabel: 'View company capabilities'
      }
    : DEFAULT_PORTAL_UI
  const uiSource = isObject(homepage.ui) ? homepage.ui : {}
  const ui = Object.freeze(Object.fromEntries(
    Object.entries(uiDefaults).map(([key, fallback]) => [key, text(uiSource[key], fallback)])
  ))

  return Object.freeze({
    loginBranding: Object.freeze({
      slogan: titleLines.length ? titleLines.join(english ? ' ' : '') : text(home.title),
      description: text(hero.summary, text(home.summary)),
      siteTag: text(hero.eyebrow, text(site.legalName)),
      announcement: text(homepage.announcement, english ? 'Employee and partner access' : '员工与合作伙伴入口'),
      headerLoginText: text(homepage.headerLoginText, english ? 'Employee access' : '员工通道'),
      authKicker: text(homepage.authKicker, english ? 'Employee portal' : '员工入口'),
      authTitle: text(homepage.authTitle, english ? 'Sign in' : '账号登录'),
      authSafeNote: text(homepage.authSafeNote, english ? 'Accounts are issued by an administrator' : '账号由管理员统一分配'),
      authFootnote: text(homepage.authFootnote, english ? 'Authorized personnel only' : '该入口仅供授权人员使用'),
      primaryActionText: text(homepage.primaryActionText, english ? 'Sign in' : '员工登录'),
      scrollCueText: text(homepage.scrollCueText, english ? 'Explore the company' : '向下了解企业'),
      metricsSectionKicker: text(homepage.metricsSectionKicker, english ? 'Capabilities' : '企业能力'),
      metricsSectionTitle: text(homepage.metricsSectionTitle, english ? 'Operations and service focus' : '业务布局与服务方向'),
      aboutSectionKicker: text(homepage.aboutSectionKicker, english ? 'About' : '关于企业'),
      ...(Object.hasOwn(homepage, 'aboutImage') ? {
        aboutImage: safePublicAssetUrl(homepage.aboutImage),
        aboutImageAlt: text(homepage.aboutImageAlt)
      } : {}),
      ...(Object.hasOwn(homepage, 'overviewProductImage') ? {
        overviewProductImage: safePublicAssetUrl(homepage.overviewProductImage),
        overviewProductImageAlt: text(homepage.overviewProductImageAlt)
      } : {}),
      ...(Object.hasOwn(homepage, 'overviewFactoryImage') ? {
        overviewFactoryImage: safePublicAssetUrl(homepage.overviewFactoryImage),
        overviewFactoryImageAlt: text(homepage.overviewFactoryImageAlt)
      } : {}),
      capabilitiesSectionKicker: text(homepage.capabilitiesSectionKicker, english ? 'Value chain' : '产业协同'),
      capabilitiesSectionTitle: text(homepage.capabilitiesSectionTitle, english ? 'Coordinated service from sourcing to customer applications' : '从原料进入到客户应用的完整服务'),
      navItems: Object.freeze(navItems.map((item) => Object.freeze(item))),
      metrics,
      trustBadges: signals,
      businessChain,
      capabilities,
      carouselImages,
      backgroundImage: carouselImages[0]?.url || '',
      footerText: text(homepage.footerNote)
    }),
    products,
    solutions,
    faq,
    ui,
    productSectionKicker: text(homepage.productSectionKicker, english ? 'Products' : '产品方向'),
    productSectionTitle: text(homepage.productSectionTitle, english ? 'Product directions for varied applications' : '面向不同应用场景的产品方向'),
    solutionSectionKicker: text(homepage.solutionSectionKicker, english ? 'Applications' : '应用场景'),
    solutionSectionTitle: text(homepage.solutionSectionTitle, english ? 'Application solutions built around real requirements' : '从真实需求出发的应用方案'),
    previewMode: Boolean(settings.previewMode) || (status !== '' && status !== 'published'),
    previewLabel: text(settings.previewLabel, '本地案例演示'),
    factStatus: text(governance.factStatus)
  })
}

function localizedSeoFromPayload(payload, site) {
  const content = isObject(payload?.content) ? payload.content : {}
  const requestedLocale = text(content.requestedLocale, text(site.defaultLocale || site.default_locale, 'zh-CN'))
  const records = Array.isArray(content.seo) ? content.seo : []
  const settings = isObject(site.settings) ? site.settings : {}
  const publicPath = normalizePublicPath(settings.publicPath)
  const pathCandidates = [publicPath.replace(/\/$/, '') || '/', publicPath, '/login', '/company/']
  const localized = records.find((item) => text(item?.locale) === requestedLocale && pathCandidates.includes(text(item?.path)))
    || records.find((item) => text(item?.locale) === requestedLocale)
    || records[0]
    || {}
  const base = isObject(site.seo) ? site.seo : {}
  return {
    ...base,
    ...localized,
    keywords: Array.isArray(localized.keywords)
      ? localized.keywords.map((item) => text(item)).filter(Boolean)
      : (Array.isArray(base.keywords) ? base.keywords.map((item) => text(item)).filter(Boolean) : []),
    structuredData: isObject(localized.structuredData || localized.structured_data)
      ? { ...(localized.structuredData || localized.structured_data) }
      : (isObject(base.structuredData) ? { ...base.structuredData } : {})
  }
}

function publicOriginFromDomain(value) {
  const raw = text(value).replace(/\/+$/, '')
  if (!raw) return ''
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/') return ''
    return parsed.origin
  } catch {
    return ''
  }
}

function requestHostMatchesSite(site, requestHost) {
  const siteHost = text(site?.domain).toLowerCase().replace(/:\d+$/, '')
  const currentHost = text(requestHost).toLowerCase().replace(/:\d+$/, '')
  return !!siteHost && !!currentHost && siteHost === currentHost
}

function normalizedThemeColor(site, enterpriseConfig) {
  const candidate = text(
    site?.theme?.primaryColor || site?.theme?.primary || site?.theme?.accentColor,
    enterpriseConfig?.branding?.themeColor
  )
  return HEX_COLOR_PATTERN.test(candidate) ? candidate.toUpperCase() : '#409EFF'
}

function normalizedContact(value) {
  const source = isObject(value) ? value : {}
  return {
    email: text(source.email),
    phone: text(source.phone),
    whatsapp: text(source.whatsapp),
    address: text(source.address),
    publicChannelUrl: safeAbsoluteUrl(source.publicChannelUrl)
  }
}

function deploymentFallback(enterpriseConfig) {
  const config = enterpriseConfig || DEFAULT_ENTERPRISE_CONFIG
  const login = config?.branding?.login || {}
  const displayName = text(config?.enterprise?.displayName, 'EISCore 企业')
  return freezeProfile({
    source: 'deployment-fallback',
    siteKey: text(config?.enterprise?.id, 'eiscore-default'),
    legalName: displayName,
    displayName,
    shortName: text(config?.enterprise?.shortName, displayName),
    factoryName: '',
    domain: '',
    logoUrl: text(config?.branding?.logoUrl),
    themeColor: normalizedThemeColor({}, config),
    publicSiteUrl: safeAbsoluteUrl(login.secondaryActionUrl) || (
      text(login.secondaryActionUrl).startsWith('/') ? text(login.secondaryActionUrl) : ''
    ),
    description: text(login.description),
    locale: 'zh-CN',
    defaultLocale: 'zh-CN',
    enabledLocales: ['zh-CN'],
    contact: normalizedContact({}),
    seo: {},
    status: 'fallback',
    publishedVersion: 0,
    portal: EMPTY_ENTERPRISE_PORTAL
  })
}

export function resolveEnterprisePublicSiteUrl(site, {
  enterpriseConfig = DEFAULT_ENTERPRISE_CONFIG
} = {}) {
  const settings = isObject(site?.settings) ? site.settings : {}
  const explicit = safeAbsoluteUrl(settings.publicSiteUrl || settings.publicUrl)
  if (explicit) return explicit

  const publicPath = normalizePublicPath(settings.publicPath)
  const domainOrigin = publicOriginFromDomain(site?.domain)
  if (domainOrigin) return `${domainOrigin}${publicPath}`

  const baseUrl = safeAbsoluteUrl(enterpriseConfig?.endpoints?.publicBaseUrl)
  if (baseUrl) return `${baseUrl.replace(/\/+$/, '')}${publicPath}`

  const fallback = text(enterpriseConfig?.branding?.login?.secondaryActionUrl)
  return safeAbsoluteUrl(fallback) || (fallback.startsWith('/') && !fallback.startsWith('//') ? fallback : publicPath)
}

export function enterpriseProfileFromSiteConfig(payload, {
  enterpriseConfig = getEnterpriseConfig(globalThis)
} = {}) {
  const site = isObject(payload?.site) ? payload.site : (isObject(payload) ? payload : null)
  if (!site || !text(site.siteKey || site.site_key)) return deploymentFallback(enterpriseConfig)

  const pages = Array.isArray(payload?.content?.pages) ? payload.content.pages : []
  const home = pages.find((page) => page?.slug === 'home') || pages[0]
  const homepage = isObject(home?.blocks?.homepage) ? home.blocks.homepage : {}
  const legalName = text(homepage.legalName, text(site.legalName || site.legal_name, enterpriseConfig?.enterprise?.displayName))
  const displayName = text(homepage.brandName, text(site.brandName || site.brand_name || site.factoryName || site.factory_name, legalName))
  const shortName = text(homepage.brandShortName, text(site.brandShortName || site.brand_short_name, displayName))
  const trademark = isObject(site.trademark) ? site.trademark : {}
  const hasExplicitLogo = Object.hasOwn(trademark, 'asset')
    || Object.hasOwn(trademark, 'logoUrl')
    || Object.hasOwn(site, 'logoUrl')
  const seo = localizedSeoFromPayload(payload, site)
  const locale = text(payload?.content?.requestedLocale, text(site.defaultLocale || site.default_locale, 'zh-CN'))
  const enabledLocales = Array.isArray(site.enabledLocales || site.enabled_locales)
    ? [...new Set((site.enabledLocales || site.enabled_locales).map((item) => text(item)).filter(Boolean))]
    : []

  return freezeProfile({
    source: 'published-site',
    siteKey: text(site.siteKey || site.site_key),
    legalName,
    displayName,
    shortName,
    factoryName: text(site.factoryName || site.factory_name),
    domain: text(site.domain),
    logoUrl: hasExplicitLogo
      ? text(trademark.asset || trademark.logoUrl || site.logoUrl)
      : text(enterpriseConfig?.branding?.logoUrl),
    themeColor: normalizedThemeColor(site, enterpriseConfig),
    publicSiteUrl: resolveEnterprisePublicSiteUrl(site, { enterpriseConfig }),
    description: text(seo.description, enterpriseConfig?.branding?.login?.description),
    locale,
    defaultLocale: text(site.defaultLocale || site.default_locale, 'zh-CN'),
    enabledLocales: enabledLocales.length ? enabledLocales : [text(site.defaultLocale || site.default_locale, 'zh-CN')],
    contact: normalizedContact(site.contact),
    seo,
    status: text(site.status, 'published'),
    publishedVersion: Number(site.publishedVersion ?? site.published_version) || 0,
    portal: enterprisePortalFromSiteConfig(payload)
  })
}

export function mergeEnterpriseProfileIntoSystemConfig(systemConfig, profile) {
  const source = isObject(systemConfig) ? systemConfig : {}
  const enterpriseProfile = profile || deploymentFallback(DEFAULT_ENTERPRISE_CONFIG)
  const legacyBranding = isObject(source.loginBranding) ? source.loginBranding : {}
  const portalBranding = isObject(enterpriseProfile.portal?.loginBranding)
    ? enterpriseProfile.portal.loginBranding
    : {}
  const legacySlides = Array.isArray(legacyBranding.carouselImages) ? legacyBranding.carouselImages : []
  const portalSlides = Array.isArray(portalBranding.carouselImages) ? portalBranding.carouselImages : []
  const carouselImages = portalSlides.map((slide) => {
    const legacySlide = legacySlides.find((item) => item?.url && item.url === slide?.url)
    return legacySlide?.hasEmbeddedText === true && slide?.hasEmbeddedText !== true
      ? { ...slide, hasEmbeddedText: true }
      : slide
  })
  return {
    ...source,
    loginBranding: {
      ...legacyBranding,
      ...portalBranding,
      ...(portalSlides.length ? { carouselImages } : {}),
      companyName: enterpriseProfile.displayName,
      logo: enterpriseProfile.logoUrl,
      siteTag: enterpriseProfile.legalName,
      description: text(portalBranding.description, enterpriseProfile.description || text(legacyBranding.description)),
      secondaryActionUrl: enterpriseProfile.publicSiteUrl || text(legacyBranding.secondaryActionUrl)
    }
  }
}

export function stripEnterpriseProfileFromSystemConfig(systemConfig) {
  const source = isObject(systemConfig) ? systemConfig : {}
  const loginBranding = isObject(source.loginBranding) ? { ...source.loginBranding } : {}
  for (const key of [
    'companyName',
    'logo',
    'siteTag',
    'description',
    'secondaryActionUrl',
    'aboutImage',
    'aboutImageAlt',
    'overviewProductImage',
    'overviewProductImageAlt',
    'overviewFactoryImage',
    'overviewFactoryImageAlt'
  ]) {
    delete loginBranding[key]
  }
  return {
    ...source,
    loginBranding
  }
}

export function createEnterpriseProfileService({
  httpClient,
  enterpriseConfig = getEnterpriseConfig(globalThis),
  getRequestHost = () => globalThis.location?.hostname || '',
  onWarning = () => {}
} = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') {
    throw new TypeError('Enterprise profile service requires an HTTP client')
  }

  async function readProfile({ required = false, locale = '' } = {}) {
    try {
      const requestPath = text(locale) ? `${PROFILE_PATH}?locale=${encodeURIComponent(text(locale))}` : PROFILE_PATH
      const result = await httpClient.requestJson(requestPath, { service: 'agent' })
      const profile = enterpriseProfileFromSiteConfig(result.data, { enterpriseConfig })
      if (profile.source === 'published-site' && !requestHostMatchesSite(profile, getRequestHost())) {
        onWarning({ code: 'profile-domain-mismatch', path: PROFILE_PATH })
        return deploymentFallback(enterpriseConfig)
      }
      return profile
    } catch (error) {
      if (required) throw error
      onWarning({ code: 'profile-unavailable', path: PROFILE_PATH })
      return deploymentFallback(enterpriseConfig)
    }
  }

  return Object.freeze({ readProfile })
}

export const DEFAULT_ENTERPRISE_PROFILE = deploymentFallback(DEFAULT_ENTERPRISE_CONFIG)
