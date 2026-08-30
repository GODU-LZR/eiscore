// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  DEFAULT_ENTERPRISE_CONFIG,
  ENTERPRISE_CONFIG_GLOBAL,
  getEnterpriseConfig,
  publishEnterpriseConfig,
  loadEnterpriseConfig
} from '@eiscore/platform/enterprise-config'

export { ENTERPRISE_CONFIG_GLOBAL, getEnterpriseConfig, publishEnterpriseConfig }

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
