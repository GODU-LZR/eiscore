// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  enterpriseModuleForPath,
  isEnterpriseModuleEnabled
} from '@eiscore/platform/enterprise-config'

export function isEnterprisePathEnabled(path, enterpriseConfig) {
  const moduleId = enterpriseModuleForPath(path)
  const visibilityFeature = {
    materials: 'materialsVisible',
    purchase: 'purchaseVisible',
    apps: 'appCenterVisible'
  }[moduleId]
  const rawPath = String(path || '')
  const normalizedPath = rawPath.split('?', 1)[0].replace(/\/+$/, '') || '/'
  const query = rawPath.includes('?') ? new URLSearchParams(rawPath.slice(rawPath.indexOf('?') + 1)) : null
  const isPublishedFlashRuntime = query?.get('flash') === '1'
  const flashRuntimePath = moduleId === 'apps' && (
    normalizedPath === '/apps/flash-builder' || normalizedPath.startsWith('/apps/flash-builder/') ||
    normalizedPath === '/apps/preview' || normalizedPath.startsWith('/apps/preview/')
    || (isPublishedFlashRuntime && (normalizedPath === '/apps/app' || normalizedPath.startsWith('/apps/app/')))
  )
  const flashHarnessEnabled = enterpriseConfig?.features?.flashHarness === true
  if (visibilityFeature && enterpriseConfig?.features?.[visibilityFeature] === false && !(flashRuntimePath && flashHarnessEnabled)) return false
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
