// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { createPlatformHttpClient } from '@eiscore/platform/http-client'
import { createSystemConfigService } from '@eiscore/platform/system-config'
import { createEnterpriseProfileService } from '@eiscore/platform/enterprise-profile'
import { clearAuthAndRedirect, getToken } from '@/utils/auth'

let cachedEnterpriseConfig = null
let cachedHttpClient = null
let cachedSystemConfigService = null
let cachedEnterpriseProfileService = null

export function getHostHttpClient() {
  const enterpriseConfig = getEnterpriseConfig(globalThis)
  if (cachedHttpClient && cachedEnterpriseConfig === enterpriseConfig) {
    return cachedHttpClient
  }
  cachedHttpClient = createPlatformHttpClient({
    enterpriseConfig,
    getAccessToken: getToken,
    onUnauthorized: () => clearAuthAndRedirect('/login'),
    resolveErrorMessage: (data) => data?.message
  })
  cachedEnterpriseConfig = enterpriseConfig
  cachedSystemConfigService = null
  cachedEnterpriseProfileService = null
  return cachedHttpClient
}

export function getHostSystemConfigService() {
  const httpClient = getHostHttpClient()
  if (cachedSystemConfigService) return cachedSystemConfigService
  cachedSystemConfigService = createSystemConfigService({ httpClient })
  return cachedSystemConfigService
}

export function getHostEnterpriseProfileService() {
  const httpClient = getHostHttpClient()
  if (cachedEnterpriseProfileService) return cachedEnterpriseProfileService
  cachedEnterpriseProfileService = createEnterpriseProfileService({ httpClient })
  return cachedEnterpriseProfileService
}
