// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
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
  const controller = new AbortController()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = globalThis.setTimeout(() => {
      controller.abort()
      onWarning({ code: 'config-timeout', source: '/config/eiscore-enterprise.json' })
      reject(new Error('Enterprise configuration request timed out'))
    }, 8000)
  })
  try {
    const config = await Promise.race([
      loadEnterpriseConfig({
        fetchImpl: typeof fetchImpl === 'function'
          ? (url, options) => fetchImpl(url, { ...options, signal: controller.signal })
          : fetchImpl,
        globalConfig: runtimeTarget?.[ENTERPRISE_CONFIG_GLOBAL],
        required: isProduction,
        onWarning
      }),
      timeout
    ])
    return publishEnterpriseConfig(config, runtimeTarget)
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export function renderEnterpriseConfigFailure(documentImpl = globalThis.document) {
  const root = documentImpl?.querySelector?.('#app')
  if (!root) return false
  root.textContent = '系统配置加载失败，请联系管理员。'
  root.setAttribute?.('data-eiscore-bootstrap', 'config-error')
  return true
}
