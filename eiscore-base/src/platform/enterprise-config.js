// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { loadEnterpriseConfig } from '@eiscore/platform/enterprise-config'

export const ENTERPRISE_CONFIG_GLOBAL = '__EISCORE_ENTERPRISE_CONFIG__'

export function publishEnterpriseConfig(config, runtimeTarget = globalThis) {
  const descriptor = Object.getOwnPropertyDescriptor(runtimeTarget, ENTERPRISE_CONFIG_GLOBAL)
  if (descriptor && !descriptor.configurable && descriptor.value !== config) {
    throw new Error('Enterprise configuration global is already locked')
  }
  Object.defineProperty(runtimeTarget, ENTERPRISE_CONFIG_GLOBAL, {
    value: config,
    enumerable: false,
    configurable: false,
    writable: false
  })
  return config
}

export async function bootstrapEnterpriseConfig({
  isProduction = false,
  runtimeTarget = globalThis,
  fetchImpl = globalThis.fetch,
  onWarning = () => {}
} = {}) {
  const config = await loadEnterpriseConfig({
    fetchImpl,
    globalConfig: runtimeTarget?.[ENTERPRISE_CONFIG_GLOBAL],
    required: isProduction,
    onWarning
  })
  return publishEnterpriseConfig(config, runtimeTarget)
}

export function renderEnterpriseConfigFailure(documentImpl = globalThis.document) {
  const root = documentImpl?.querySelector?.('#app')
  if (!root) return false
  root.textContent = '系统配置加载失败，请联系管理员。'
  root.setAttribute?.('data-eiscore-bootstrap', 'config-error')
  return true
}
