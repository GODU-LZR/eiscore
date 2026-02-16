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
    entry: '/hr/',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/hr'),
  },
  {
    name: 'eiscore-materials',
    entry: '/materials/',
    container: QIANKUN_CONTAINER,
    activeRule: withContainerRule('/materials'),
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
