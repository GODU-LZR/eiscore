import { createRouter, createWebHistory } from 'vue-router'
// 1. 引入 qiankun 辅助变量 (用于判断是否在基座中运行)
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
// 2. 引入页面组件 (请确保你本地 views/EmployeeList.vue 文件存在)
import EmployeeList from '../views/EmployeeList.vue'

const router = createRouter({
  // 3. 🟢 关键配置：设置路由基础路径
  // 如果在基座中运行，基础路径是 /hr；如果独立运行，基础路径是 /
  history: createWebHistory(
    qiankunWindow.__POWERED_BY_QIANKUN__ ? '/hr' : '/'
  ),
  routes: [
    {
      path: '/',
      redirect: '/employee' // 默认跳转
    },
    {
      path: '/employee',
      name: 'EmployeeList',
      component: EmployeeList // 挂载组件
    }
  ]
})

export default router