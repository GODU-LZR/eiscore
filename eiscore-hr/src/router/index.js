import { createRouter, createWebHistory } from 'vue-router'
// 1. 引入 qiankun 辅助变量 (用于判断是否在基座中运行)
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
// 2. 引入页面组件 (请确保你本地 views/EmployeeList.vue 文件存在)
import HrApps from '../views/HrApps.vue'
import HrAppView from '../views/HrAppView.vue'
import EmployeeList from '../views/EmployeeList.vue'
import EmployeeDetail from '../views/EmployeeDetail.vue'
import HrOrgChart from '../views/HrOrgChart.vue'

const router = createRouter({
  // 3. 🟢 关键配置：设置路由基础路径
  // 如果在基座中运行，基础路径是 /hr；如果独立运行，基础路径是 /
  history: createWebHistory(
    qiankunWindow.__POWERED_BY_QIANKUN__ ? '/hr' : '/'
  ),
  routes: [
    {
      path: '/',
      redirect: '/apps' // 默认跳转
    },
    {
      path: '/apps',
      name: 'HrApps',
      component: HrApps
    },
    {
      path: '/app/:key',
      name: 'HrAppView',
      component: HrAppView,
      props: true
    },
    {
      path: '/employee',
      name: 'EmployeeList',
      component: EmployeeList // 挂载组件
    },
    // 🟢 新增详情页路由
    {
      path: '/employee/detail/:id',
      name: 'EmployeeDetail',
      component: EmployeeDetail,
      props: true // 允许将 route.params.id 作为 props 传给组件
    },
    {
      path: '/org',
      name: 'HrOrgChart',
      component: HrOrgChart
    }
  ]
})

export default router
