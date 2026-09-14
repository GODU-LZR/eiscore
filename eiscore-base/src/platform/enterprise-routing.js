// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  enterpriseModuleForPath,
  isEnterpriseModuleEnabled
} from '@eiscore/platform/enterprise-config'

export function isEnterprisePathEnabled(path, enterpriseConfig) {
  const moduleId = enterpriseModuleForPath(path)
  return !moduleId || isEnterpriseModuleEnabled(enterpriseConfig, moduleId)
}

export function resolveEnterpriseNavigation({
  path = '/',
  enterpriseConfig,
  mobileDevice = false,
  skipMobileRedirect = false,
  publicLanding = false
} = {}) {
  const moduleId = enterpriseModuleForPath(path)
  if (!isEnterprisePathEnabled(path, enterpriseConfig)) {
    return { type: 'redirect', path: '/', reason: 'module-disabled', moduleId }
  }

  const mobileEnabled = isEnterpriseModuleEnabled(enterpriseConfig, 'mobile')
  const embeddedPath = String(path).startsWith('/embed/')
  if (mobileDevice && mobileEnabled && !skipMobileRedirect && !publicLanding && !embeddedPath && moduleId !== 'mobile') {
    return { type: 'external', path: '/mobile/', reason: 'mobile-device', moduleId: 'mobile' }
  }

  return { type: 'allow', path, reason: '', moduleId }
}
