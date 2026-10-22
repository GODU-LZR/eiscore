// SPDX-License-Identifier: AGPL-3.0-or-later

export function isAppCenterRouteAvailable(path, enterpriseConfig = {}, routeContext = {}) {
  if (enterpriseConfig?.modules?.apps === false) return false
  if (enterpriseConfig?.features?.appCenterVisible !== false) return true
  if (enterpriseConfig?.features?.flashHarness !== true) return false

  const normalizedPath = String(path || '/').split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  const isPublishedFlashRuntime = routeContext?.query?.flash === '1' || routeContext?.query?.flash === 1
  return normalizedPath === '/flash-builder' || normalizedPath.startsWith('/flash-builder/') ||
    normalizedPath === '/preview' || normalizedPath.startsWith('/preview/') ||
    (isPublishedFlashRuntime && /^\/app\/[^/]+$/.test(normalizedPath))
}
