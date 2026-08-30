// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const ENTERPRISE_CONFIG_SCHEMA_VERSION = 1
export const ENTERPRISE_MODULE_IDS = Object.freeze([
  'hr',
  'materials',
  'apps',
  'sales',
  'purchase',
  'production',
  'quality',
  'equipment',
  'decision',
  'mobile'
])
export const ENTERPRISE_MODULE_DEPENDENCIES = Object.freeze({
  hr: Object.freeze(['apps']),
  materials: Object.freeze(['apps']),
  apps: Object.freeze([]),
  sales: Object.freeze(['apps', 'materials', 'purchase']),
  purchase: Object.freeze(['apps', 'materials']),
  production: Object.freeze(['apps', 'materials', 'quality']),
  quality: Object.freeze(['apps']),
  equipment: Object.freeze(['apps']),
  decision: Object.freeze(['apps', 'materials', 'sales', 'purchase', 'production', 'quality', 'equipment']),
  mobile: Object.freeze(['hr', 'materials'])
})

const DEFAULT_SOURCE = {
  schemaVersion: ENTERPRISE_CONFIG_SCHEMA_VERSION,
  enterprise: {
    id: 'eiscore-default',
    displayName: 'EISCore 企业',
    shortName: 'EISCore'
  },
  branding: {
    productName: 'EISCore 企业数字化平台',
    themeColor: '#409EFF',
    logoUrl: '',
    login: {
      slogan: '连接业务、数据与智能协作',
      description: '',
      siteTag: '企业数字化平台',
      backgroundImage: '',
      footerText: 'Copyright © EISCore'
    }
  },
  endpoints: {
    publicBaseUrl: '',
    apiBasePath: '/api',
    agentBasePath: '/agent',
    realtimeWsPath: '/agent/ws'
  },
  modules: Object.fromEntries(ENTERPRISE_MODULE_IDS.map((id) => [id, true])),
  features: {}
}

const TOP_LEVEL_KEYS = new Set(['$schema', 'schemaVersion', 'enterprise', 'branding', 'endpoints', 'modules', 'features'])
const ENTERPRISE_KEYS = new Set(['id', 'displayName', 'shortName'])
const BRANDING_KEYS = new Set(['productName', 'themeColor', 'logoUrl', 'login'])
const LOGIN_KEYS = new Set(['slogan', 'description', 'siteTag', 'backgroundImage', 'footerText'])
const ENDPOINT_KEYS = new Set(['publicBaseUrl', 'apiBasePath', 'agentBasePath', 'realtimeWsPath'])
const SECRET_KEY_PATTERN = /(password|secret|token|api[_-]?key|private[_-]?key)/i

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
const pathValue = (path, code) => ({ path, code })

function unknownKeyIssues(value, allowed, prefix) {
  if (!isObject(value)) return []
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => pathValue(`${prefix}.${key}`, 'unknown-key'))
}

function secretKeyIssues(value, prefix = '$') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => secretKeyIssues(item, `${prefix}[${index}]`))
  }
  if (!isObject(value)) return []
  return Object.entries(value).flatMap(([key, item]) => {
    const currentPath = `${prefix}.${key}`
    const own = SECRET_KEY_PATTERN.test(key) ? [pathValue(currentPath, 'secret-key-forbidden')] : []
    return [...own, ...secretKeyIssues(item, currentPath)]
  })
}

function requiredText(issues, value, path, maxLength = 160) {
  if (typeof value !== 'string' || !value.trim()) issues.push(pathValue(path, 'required-text'))
  else if (value.trim().length > maxLength) issues.push(pathValue(path, 'text-too-long'))
}

function textField(issues, value, path, maxLength = 500) {
  if (typeof value !== 'string') issues.push(pathValue(path, 'text-required'))
  else if (value.length > maxLength) issues.push(pathValue(path, 'text-too-long'))
}

function isSafeRelativePath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
}

function isSafeAssetUrl(value) {
  if (value === '') return true
  if (isSafeRelativePath(value)) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

function isSafePublicBaseUrl(value) {
  if (value === '') return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
  } catch {
    return false
  }
}

export function validateEnterpriseConfig(input) {
  const issues = []
  if (!isObject(input)) return [pathValue('$', 'object-required')]

  issues.push(...unknownKeyIssues(input, TOP_LEVEL_KEYS, '$'))
  issues.push(...secretKeyIssues(input))
  if (input.$schema !== undefined && typeof input.$schema !== 'string') {
    issues.push(pathValue('$.$schema', 'text-required'))
  }
  if (input.schemaVersion !== ENTERPRISE_CONFIG_SCHEMA_VERSION) {
    issues.push(pathValue('$.schemaVersion', 'unsupported-version'))
  }

  if (!isObject(input.enterprise)) issues.push(pathValue('$.enterprise', 'object-required'))
  else {
    issues.push(...unknownKeyIssues(input.enterprise, ENTERPRISE_KEYS, '$.enterprise'))
    requiredText(issues, input.enterprise.id, '$.enterprise.id', 64)
    if (typeof input.enterprise.id === 'string' && !/^[a-z0-9][a-z0-9-]*$/.test(input.enterprise.id)) {
      issues.push(pathValue('$.enterprise.id', 'invalid-id'))
    }
    requiredText(issues, input.enterprise.displayName, '$.enterprise.displayName', 120)
    requiredText(issues, input.enterprise.shortName, '$.enterprise.shortName', 40)
  }

  if (!isObject(input.branding)) issues.push(pathValue('$.branding', 'object-required'))
  else {
    issues.push(...unknownKeyIssues(input.branding, BRANDING_KEYS, '$.branding'))
    requiredText(issues, input.branding.productName, '$.branding.productName', 120)
    if (typeof input.branding.themeColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(input.branding.themeColor)) {
      issues.push(pathValue('$.branding.themeColor', 'invalid-color'))
    }
    if (typeof input.branding.logoUrl !== 'string' || !isSafeAssetUrl(input.branding.logoUrl)) {
      issues.push(pathValue('$.branding.logoUrl', 'unsafe-url'))
    }
    if (!isObject(input.branding.login)) issues.push(pathValue('$.branding.login', 'object-required'))
    else {
      issues.push(...unknownKeyIssues(input.branding.login, LOGIN_KEYS, '$.branding.login'))
      textField(issues, input.branding.login.slogan, '$.branding.login.slogan', 200)
      textField(issues, input.branding.login.description, '$.branding.login.description', 1000)
      textField(issues, input.branding.login.siteTag, '$.branding.login.siteTag', 120)
      textField(issues, input.branding.login.footerText, '$.branding.login.footerText', 200)
      if (typeof input.branding.login.backgroundImage !== 'string' || !isSafeAssetUrl(input.branding.login.backgroundImage)) {
        issues.push(pathValue('$.branding.login.backgroundImage', 'unsafe-url'))
      }
    }
  }

  if (!isObject(input.endpoints)) issues.push(pathValue('$.endpoints', 'object-required'))
  else {
    issues.push(...unknownKeyIssues(input.endpoints, ENDPOINT_KEYS, '$.endpoints'))
    if (!isSafePublicBaseUrl(input.endpoints.publicBaseUrl)) issues.push(pathValue('$.endpoints.publicBaseUrl', 'unsafe-url'))
    for (const key of ['apiBasePath', 'agentBasePath', 'realtimeWsPath']) {
      if (!isSafeRelativePath(input.endpoints[key])) issues.push(pathValue(`$.endpoints.${key}`, 'invalid-relative-path'))
    }
  }

  if (!isObject(input.modules)) issues.push(pathValue('$.modules', 'object-required'))
  else {
    for (const key of Object.keys(input.modules)) {
      if (!ENTERPRISE_MODULE_IDS.includes(key)) issues.push(pathValue(`$.modules.${key}`, 'unknown-module'))
    }
    for (const moduleId of ENTERPRISE_MODULE_IDS) {
      if (typeof input.modules[moduleId] !== 'boolean') {
        issues.push(pathValue(`$.modules.${moduleId}`, 'boolean-required'))
      }
    }
    for (const [moduleId, dependencies] of Object.entries(ENTERPRISE_MODULE_DEPENDENCIES)) {
      if (input.modules[moduleId] !== true) continue
      for (const dependency of dependencies) {
        if (input.modules[dependency] !== true) {
          issues.push(pathValue(`$.modules.${moduleId}`, `module-dependency-disabled:${dependency}`))
        }
      }
    }
  }

  if (!isObject(input.features)) issues.push(pathValue('$.features', 'object-required'))
  else {
    for (const [key, value] of Object.entries(input.features)) {
      if (!/^[a-z][A-Za-z0-9]*$/.test(key)) issues.push(pathValue(`$.features.${key}`, 'invalid-feature-id'))
      if (typeof value !== 'boolean') issues.push(pathValue(`$.features.${key}`, 'boolean-required'))
    }
  }

  return issues
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const item of Object.values(value)) deepFreeze(item)
  return Object.freeze(value)
}

function trimTrailingSlash(value) {
  const text = String(value || '')
  return text === '/' ? '/' : text.replace(/\/+$/, '')
}

function normalizeConfig(input) {
  return {
    schemaVersion: ENTERPRISE_CONFIG_SCHEMA_VERSION,
    enterprise: {
      id: input.enterprise.id.trim(),
      displayName: input.enterprise.displayName.trim(),
      shortName: input.enterprise.shortName.trim()
    },
    branding: {
      productName: input.branding.productName.trim(),
      themeColor: input.branding.themeColor.toUpperCase(),
      logoUrl: input.branding.logoUrl.trim(),
      login: {
        slogan: String(input.branding.login.slogan || '').trim(),
        description: String(input.branding.login.description || '').trim(),
        siteTag: String(input.branding.login.siteTag || '').trim(),
        backgroundImage: input.branding.login.backgroundImage.trim(),
        footerText: String(input.branding.login.footerText || '').trim()
      }
    },
    endpoints: {
      publicBaseUrl: trimTrailingSlash(input.endpoints.publicBaseUrl.trim()),
      apiBasePath: trimTrailingSlash(input.endpoints.apiBasePath.trim()),
      agentBasePath: trimTrailingSlash(input.endpoints.agentBasePath.trim()),
      realtimeWsPath: trimTrailingSlash(input.endpoints.realtimeWsPath.trim())
    },
    modules: Object.fromEntries(ENTERPRISE_MODULE_IDS.map((id) => [id, input.modules[id]])),
    features: Object.fromEntries(Object.entries(input.features).sort(([left], [right]) => left.localeCompare(right)))
  }
}

export class EnterpriseConfigError extends Error {
  constructor(source, issues) {
    super(`Invalid enterprise config from ${source}: ${issues.map((issue) => `${issue.path} (${issue.code})`).join('; ')}`)
    this.name = 'EnterpriseConfigError'
    this.source = source
    this.issues = issues
  }
}

export function parseEnterpriseConfig(input, { source = 'inline' } = {}) {
  const issues = validateEnterpriseConfig(input)
  if (issues.length) throw new EnterpriseConfigError(source, issues)
  return deepFreeze(normalizeConfig(input))
}

export const DEFAULT_ENTERPRISE_CONFIG = parseEnterpriseConfig(DEFAULT_SOURCE, { source: 'built-in default' })

export function enterpriseModuleForPath(path) {
  const normalized = String(path || '').split(/[?#]/, 1)[0]
  return ENTERPRISE_MODULE_IDS.find((moduleId) => (
    normalized === `/${moduleId}` || normalized.startsWith(`/${moduleId}/`)
  )) || ''
}

export function isEnterpriseModuleEnabled(config, moduleId) {
  if (!ENTERPRISE_MODULE_IDS.includes(moduleId)) return false
  return config?.modules?.[moduleId] !== false
}

export async function loadEnterpriseConfig({
  url = '/config/eiscore-enterprise.json',
  fetchImpl = globalThis.fetch,
  globalConfig = globalThis.__EISCORE_ENTERPRISE_CONFIG__,
  required = false,
  onWarning = () => {}
} = {}) {
  if (globalConfig !== undefined && globalConfig !== null) {
    return parseEnterpriseConfig(globalConfig, { source: 'runtime global' })
  }

  if (typeof fetchImpl !== 'function') {
    if (required) throw new EnterpriseConfigError(url, [pathValue('$', 'fetch-unavailable')])
    onWarning({ code: 'fetch-unavailable', source: url })
    return DEFAULT_ENTERPRISE_CONFIG
  }

  let response
  try {
    response = await fetchImpl(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
  } catch {
    if (required) throw new EnterpriseConfigError(url, [pathValue('$', 'fetch-failed')])
    onWarning({ code: 'fetch-failed', source: url })
    return DEFAULT_ENTERPRISE_CONFIG
  }

  if (response.status === 404 && !required) {
    onWarning({ code: 'config-missing', source: url })
    return DEFAULT_ENTERPRISE_CONFIG
  }
  if (!response.ok) throw new EnterpriseConfigError(url, [pathValue('$', `http-${response.status}`)])
  let input
  try {
    input = await response.json()
  } catch {
    if (required) throw new EnterpriseConfigError(url, [pathValue('$', 'invalid-json')])
    onWarning({ code: 'invalid-json', source: url })
    return DEFAULT_ENTERPRISE_CONFIG
  }
  return parseEnterpriseConfig(input, { source: url })
}
