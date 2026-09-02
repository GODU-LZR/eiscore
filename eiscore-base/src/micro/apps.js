// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { DEFAULT_ENTERPRISE_CONFIG } from '@eiscore/platform/enterprise-config'

const hasQiankunContainer = () => {
  if (typeof document === 'undefined') return false
  return !!document.querySelector('#subapp-viewport')
}

const QIANKUN_CONTAINER = '#subapp-viewport'

const withContainerRule = (prefix) => (location) => {
  if (!location || typeof location.pathname !== 'string') return false
  const path = location.pathname
  const matched = path === prefix || path.startsWith(`${prefix}/`)
  return matched && hasQiankunContainer()
}

const appDefinitions = [
  {
    moduleId: 'hr',
    name: 'eiscore-hr',
    // Keep sub-app entry same-origin to avoid CORS in host prefetch/runtime.
    entry: '/hr/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/hr'),
  },
  {
    moduleId: 'materials',
    name: 'eiscore-materials',
    entry: '/materials/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/materials'),
  },
  {
    moduleId: 'sales',
    name: 'eiscore-sales',
    entry: '/sales/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/sales'),
  },
  {
    moduleId: 'purchase',
    name: 'eiscore-purchase',
    entry: '/purchase/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/purchase'),
  },
  {
    moduleId: 'production',
    name: 'eiscore-production',
    entry: '/production/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/production'),
  },
  {
    moduleId: 'quality',
    name: 'eiscore-quality',
    entry: '/quality/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/quality'),
  },
  {
    moduleId: 'equipment',
    name: 'eiscore-equipment',
    entry: '/equipment/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/equipment'),
  },
  {
    moduleId: 'decision',
    name: 'eiscore-decision',
    entry: '/decision/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/decision'),
  },
  {
    moduleId: 'apps',
    name: 'eiscore-apps',
    // Use explicit html entry to avoid redirect chains that may jump to :8083.
    entry: '/apps/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/apps'),
  },
  {
    moduleId: 'company-site',
    name: 'eiscore-company-site',
    entry: '/company-site/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/company-site'),
  },
]

export function createMicroApps(enterpriseConfig = DEFAULT_ENTERPRISE_CONFIG) {
  const resolvedConfig = enterpriseConfig || DEFAULT_ENTERPRISE_CONFIG
  const modules = resolvedConfig.modules || DEFAULT_ENTERPRISE_CONFIG.modules
  return appDefinitions
    .filter((app) => modules[app.moduleId] !== false)
    .map(({ moduleId, ...app }) => ({
      ...app,
      props: { enterpriseConfig: resolvedConfig }
    }))
}

export default createMicroApps()
