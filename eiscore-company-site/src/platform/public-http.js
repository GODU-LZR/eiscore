// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { createPlatformHttpClient } from '@eiscore/platform/http-client'

const client = createPlatformHttpClient({
  enterpriseConfig: getEnterpriseConfig(globalThis),
  resolveErrorMessage: (data) => data?.message || ''
})

export const requestPublicJson = async (path, options = {}) => (
  (await client.requestJson(path, options)).data
)
