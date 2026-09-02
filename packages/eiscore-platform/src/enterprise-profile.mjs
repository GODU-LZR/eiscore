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
    defaultLocale: 'zh-CN',
    enabledLocales: ['zh-CN'],
    contact: normalizedContact({}),
    seo: {},
    status: 'fallback',
    publishedVersion: 0
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

  const legalName = text(site.legalName || site.legal_name, enterpriseConfig?.enterprise?.displayName)
  const displayName = text(site.brandName || site.brand_name || site.factoryName || site.factory_name, legalName)
  const shortName = text(site.brandShortName || site.brand_short_name, displayName)
  const trademark = isObject(site.trademark) ? site.trademark : {}
  const seo = isObject(site.seo) ? { ...site.seo } : {}
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
    logoUrl: text(trademark.asset || trademark.logoUrl || site.logoUrl, enterpriseConfig?.branding?.logoUrl),
    themeColor: normalizedThemeColor(site, enterpriseConfig),
    publicSiteUrl: resolveEnterprisePublicSiteUrl(site, { enterpriseConfig }),
    description: text(seo.description, enterpriseConfig?.branding?.login?.description),
    defaultLocale: text(site.defaultLocale || site.default_locale, 'zh-CN'),
    enabledLocales: enabledLocales.length ? enabledLocales : [text(site.defaultLocale || site.default_locale, 'zh-CN')],
    contact: normalizedContact(site.contact),
    seo,
    status: text(site.status, 'published'),
    publishedVersion: Number(site.publishedVersion ?? site.published_version) || 0
  })
}

export function mergeEnterpriseProfileIntoSystemConfig(systemConfig, profile) {
  const source = isObject(systemConfig) ? systemConfig : {}
  const enterpriseProfile = profile || deploymentFallback(DEFAULT_ENTERPRISE_CONFIG)
  const legacyBranding = isObject(source.loginBranding) ? source.loginBranding : {}
  return {
    ...source,
    loginBranding: {
      ...legacyBranding,
      companyName: enterpriseProfile.displayName,
      logo: enterpriseProfile.logoUrl,
      siteTag: enterpriseProfile.legalName,
      description: enterpriseProfile.description || text(legacyBranding.description),
      secondaryActionUrl: enterpriseProfile.publicSiteUrl || text(legacyBranding.secondaryActionUrl)
    }
  }
}

export function stripEnterpriseProfileFromSystemConfig(systemConfig) {
  const source = isObject(systemConfig) ? systemConfig : {}
  const loginBranding = isObject(source.loginBranding) ? { ...source.loginBranding } : {}
  for (const key of ['companyName', 'logo', 'siteTag', 'description', 'secondaryActionUrl']) {
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
  onWarning = () => {}
} = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') {
    throw new TypeError('Enterprise profile service requires an HTTP client')
  }

  async function readProfile({ required = false } = {}) {
    try {
      const result = await httpClient.requestJson(PROFILE_PATH, { service: 'agent' })
      return enterpriseProfileFromSiteConfig(result.data, { enterpriseConfig })
    } catch (error) {
      if (required) throw error
      onWarning({ code: 'profile-unavailable', path: PROFILE_PATH })
      return deploymentFallback(enterpriseConfig)
    }
  }

  return Object.freeze({ readProfile })
}

export const DEFAULT_ENTERPRISE_PROFILE = deploymentFallback(DEFAULT_ENTERPRISE_CONFIG)
