// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getEnterpriseConfig } from '../packages/eiscore-platform/src/enterprise-config.mjs'
import { createPlatformHttpClient } from '../packages/eiscore-platform/src/http-client.mjs'
import { clearAuthAndRedirect, getToken } from './eis-session'

let cachedEnterpriseConfig = null
let cachedHttpClient = null

export function getSharedHttpClient() {
  const enterpriseConfig = getEnterpriseConfig(globalThis)
  if (cachedHttpClient && cachedEnterpriseConfig === enterpriseConfig) {
    return cachedHttpClient
  }
  cachedHttpClient = createPlatformHttpClient({
    enterpriseConfig,
    getAccessToken: getToken,
    onUnauthorized: () => clearAuthAndRedirect('/login')
  })
  cachedEnterpriseConfig = enterpriseConfig
  return cachedHttpClient
}
