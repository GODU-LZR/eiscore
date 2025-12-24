// eiscore-base/src/micro/apps.js

// 动态获取当前访问的 hostname (比如 云IP 或 域名)
const host = window.location.hostname;
const protocol = window.location.protocol; // http: 或 https:

const apps = [
  {
    name: 'eiscore-hr',
    // 🔴 关键修改：不要写 localhost，改用动态 host
    entry: `${protocol}//${host}:8081`, 
    container: '#subapp-viewport',
    activeRule: '/hr',
  },
  {
    name: 'eiscore-materials',
    entry: `${protocol}//${host}:8082`,
    container: '#subapp-viewport',
    activeRule: '/materials',
  },
];

export default apps;