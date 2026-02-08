const apps = [
  {
    name: 'eiscore-hr',
    // Keep sub-app entry same-origin to avoid CORS in host prefetch/runtime.
    entry: '/hr/',
    container: '#subapp-viewport',
    activeRule: '/hr',
  },
  {
    name: 'eiscore-materials',
    entry: '/materials/',
    container: '#subapp-viewport',
    activeRule: '/materials',
  },
  {
    name: 'eiscore-apps',
    // Use explicit html entry to avoid redirect chains that may jump to :8083.
    entry: '/apps/index.html',
    container: '#subapp-viewport',
    activeRule: '/apps',
  },
];

export default apps;
