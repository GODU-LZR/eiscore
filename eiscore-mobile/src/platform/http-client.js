// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { createPlatformHttpClient } from '@eiscore/platform/http-client'
import { createSystemConfigService } from '@eiscore/platform/system-config'
import { getToken } from '@/utils/auth'

let cachedEnterpriseConfig = null
let cachedSystemConfigService = null

export function getMobileSystemConfigService() {
  const enterpriseConfig = getEnterpriseConfig(globalThis)
  if (cachedSystemConfigService && cachedEnterpriseConfig === enterpriseConfig) {
    return cachedSystemConfigService
  }
  const httpClient = createPlatformHttpClient({
    enterpriseConfig,
    getAccessToken: getToken
  })
  cachedEnterpriseConfig = enterpriseConfig
  cachedSystemConfigService = createSystemConfigService({ httpClient })
  return cachedSystemConfigService
}
