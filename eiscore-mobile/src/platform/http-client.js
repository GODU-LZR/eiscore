// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { createPlatformHttpClient } from '@eiscore/platform/http-client'
import { createSystemConfigService } from '@eiscore/platform/system-config'
import { clearAuth, getToken, redirectToEnterpriseLogin } from '@/utils/auth'

let cachedEnterpriseConfig = null
let cachedHttpClient = null
let cachedSystemConfigService = null

export function getMobileHttpClient() {
  const enterpriseConfig = getEnterpriseConfig(globalThis)
  if (cachedHttpClient && cachedEnterpriseConfig === enterpriseConfig) {
    return cachedHttpClient
  }
  cachedHttpClient = createPlatformHttpClient({
    enterpriseConfig,
    getAccessToken: getToken,
    onUnauthorized: () => {
      clearAuth()
      redirectToEnterpriseLogin()
    },
    resolveErrorMessage: (data) => data?.message
  })
  cachedEnterpriseConfig = enterpriseConfig
  cachedSystemConfigService = null
  return cachedHttpClient
}

export function getMobileSystemConfigService() {
  const httpClient = getMobileHttpClient()
  if (cachedSystemConfigService) return cachedSystemConfigService
  cachedSystemConfigService = createSystemConfigService({ httpClient })
  return cachedSystemConfigService
}
