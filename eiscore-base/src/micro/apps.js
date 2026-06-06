// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

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

const apps = [
  {
    name: 'eiscore-hr',
    // Keep sub-app entry same-origin to avoid CORS in host prefetch/runtime.
    entry: '/hr/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/hr'),
  },
  {
    name: 'eiscore-materials',
    entry: '/materials/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/materials'),
  },
  {
    name: 'eiscore-sales',
    entry: '/sales/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/sales'),
  },
  {
    name: 'eiscore-purchase',
    entry: '/purchase/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/purchase'),
  },
  {
    name: 'eiscore-production',
    entry: '/production/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/production'),
  },
  {
    name: 'eiscore-quality',
    entry: '/quality/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/quality'),
  },
  {
    name: 'eiscore-equipment',
    entry: '/equipment/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/equipment'),
  },
  {
    name: 'eiscore-decision',
    entry: '/decision/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/decision'),
  },
  {
    name: 'eiscore-apps',
    // Use explicit html entry to avoid redirect chains that may jump to :8083.
    entry: '/apps/index.html',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/apps'),
  },
];

export default apps;
