// src/micro/apps.js
const apps = [
  {
    name: 'eiscore-materials',        // 必须与子应用 vite 配置的 name 一致
    entry: '//localhost:8081',    // 物料子应用运行地址
    container: '#micro-container', // 挂载容器
    activeRule: '/materials',     // 路由匹配规则
  },
  {
    name: 'eiscore-hr',
    entry: '//localhost:8082',    // 人事子应用运行地址
    container: '#micro-container',
    activeRule: '/hr',
  }
];

export default apps;