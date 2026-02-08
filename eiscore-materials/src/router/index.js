import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const router = createRouter({
  history: createWebHistory(
    (
      qiankunWindow.__POWERED_BY_QIANKUN__ ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/materials'))
    ) ? '/materials' : '/'
  ),
  routes: [
    { path: '/', redirect: '/apps' },
    { path: '/apps', name: 'MaterialsApps', component: () => import('@/views/MaterialsApps.vue') },
    { path: '/app/:key', name: 'MaterialsAppView', component: () => import('@/views/MaterialsAppView.vue'), props: true },
    { path: '/material/detail/:id', name: 'MaterialDetail', component: () => import('@/views/MaterialDetail.vue'), props: true },
    { path: '/material/label/:id', name: 'MaterialLabelPreview', component: () => import('@/views/MaterialLabelPreview.vue'), props: true },
    { path: '/batch-rules', name: 'BatchNoRuleManager', component: () => import('@/views/BatchNoRuleManager.vue') },
    { path: '/warehouses', name: 'WarehouseManagement', component: () => import('@/views/WarehouseManagement.vue') },
    { path: '/inventory-ledger', name: 'InventoryLedgerGrid', component: () => import('@/views/InventoryLedgerGrid.vue') },
    { path: '/inventory-current', name: 'InventoryCurrentGrid', component: () => import('@/views/InventoryCurrentGrid.vue') },
    { path: '/inventory-dashboard', name: 'InventoryDashboard', component: () => import('@/views/InventoryDashboard.vue') }
  ]
})

export default router
