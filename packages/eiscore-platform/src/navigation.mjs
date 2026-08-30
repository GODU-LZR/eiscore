// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  DEFAULT_ENTERPRISE_CONFIG,
  enterpriseModuleForPath,
  getEnterpriseConfig,
  isEnterpriseModuleEnabled
} from './enterprise-config.mjs'

export const ENTERPRISE_NAVIGATION_EVENT = 'eis:open-host-tab'

const SAFE_ORIGIN = 'https://eiscore.invalid'
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/

function invalidTarget() {
  return {
    ok: false,
    reason: 'invalid-target',
    moduleId: '',
    path: '',
    query: {},
    href: ''
  }
}

function parseQuery(searchParams) {
  const query = {}
  for (const [key, value] of searchParams.entries()) {
    if (!Object.hasOwn(query, key)) query[key] = value
    else if (Array.isArray(query[key])) query[key].push(value)
    else query[key] = [query[key], value]
  }
  return query
}

export function planEnterpriseNavigation(target, enterpriseConfig = DEFAULT_ENTERPRISE_CONFIG) {
  if (typeof target !== 'string') return invalidTarget()
  const raw = target.trim()
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    raw.includes('#') ||
    CONTROL_CHARACTER_PATTERN.test(raw)
  ) return invalidTarget()

  let parsed
  try {
    parsed = new URL(raw, SAFE_ORIGIN)
  } catch {
    return invalidTarget()
  }
  if (parsed.origin !== SAFE_ORIGIN || parsed.hash) return invalidTarget()

  const path = parsed.pathname
  const query = parseQuery(parsed.searchParams)
  const href = `${path}${parsed.search}`
  const moduleId = enterpriseModuleForPath(path)
  if (moduleId && !isEnterpriseModuleEnabled(enterpriseConfig, moduleId)) {
    return { ok: false, reason: 'module-disabled', moduleId, path, query, href }
  }
  return { ok: true, reason: '', moduleId, path, query, href }
}

export function isEnterpriseHostRuntime(runtimeTarget = globalThis) {
  return Boolean(
    runtimeTarget?.__POWERED_BY_QIANKUN__ ||
    runtimeTarget?.proxy?.__POWERED_BY_QIANKUN__ ||
    runtimeTarget?.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ ||
    typeof runtimeTarget?.__EIS_BASE_ACTIONS__?.setGlobalState === 'function'
  )
}

function createHostEvent(runtimeTarget, detail) {
  const EventConstructor = runtimeTarget?.CustomEvent || globalThis.CustomEvent
  if (typeof EventConstructor !== 'function') return null
  return new EventConstructor(ENTERPRISE_NAVIGATION_EVENT, { detail })
}

export function navigateEnterprisePath(target, options = {}) {
  const runtimeTarget = options.runtimeTarget || globalThis
  const enterpriseConfig = options.enterpriseConfig || getEnterpriseConfig(runtimeTarget)
  const plan = planEnterpriseNavigation(target, enterpriseConfig)
  if (!plan.ok) return { ...plan, mode: 'none' }

  const hosted = options.hosted ?? isEnterpriseHostRuntime(runtimeTarget)
  if (hosted) {
    const eventTarget = options.eventTarget || runtimeTarget
    const detail = { path: plan.path, query: plan.query }
    if (options.tabKey) detail.tabKey = String(options.tabKey)
    if (options.tabTitle) detail.tabTitle = String(options.tabTitle)
    const event = createHostEvent(runtimeTarget, detail)
    if (!event || typeof eventTarget?.dispatchEvent !== 'function') {
      return { ...plan, ok: false, reason: 'host-event-unavailable', mode: 'none' }
    }
    eventTarget.dispatchEvent(event)
    return { ...plan, mode: 'host-event' }
  }

  const locationTarget = options.locationTarget || runtimeTarget?.location
  if (typeof locationTarget?.assign !== 'function') {
    return { ...plan, ok: false, reason: 'location-unavailable', mode: 'none' }
  }
  locationTarget.assign(plan.href)
  return { ...plan, mode: 'location-assign' }
}
