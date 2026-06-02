// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import { hasPerm } from '@/utils/permission'
import { findMaterialApp } from '@/utils/material-apps'

const ROUTER_BASE = '/materials'
const APPS_PATH = '/apps'

const router = createRouter({
  history: createWebHistory(
    (
      qiankunWindow.__POWERED_BY_QIANKUN__ ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/materials'))
    ) ? ROUTER_BASE : '/'
  ),
  routes: [
    { path: '/', alias: APPS_PATH, name: 'MaterialsApps', component: () => import('@/views/MaterialsApps.vue') },
    { path: '/app/:key', name: 'MaterialsAppView', component: () => import('@/views/MaterialsAppView.vue'), props: true },
    { path: '/material/detail/:id', name: 'MaterialDetail', component: () => import('@/views/MaterialDetail.vue'), props: true, meta: { perm: 'app:mms_ledger' } },
    { path: '/material/label/:id', name: 'MaterialLabelPreview', component: () => import('@/views/MaterialLabelPreview.vue'), props: true, meta: { perm: 'app:mms_ledger' } },
    { path: '/batch-rules', name: 'BatchNoRuleManager', component: () => import('@/views/BatchNoRuleManager.vue'), meta: { perm: 'app:mms_batch_rule' } },
    { path: '/bom', redirect: APPS_PATH },
    { path: '/warehouses', name: 'WarehouseManagement', component: () => import('@/views/WarehouseManagement.vue'), meta: { perm: 'app:mms_warehouse' } },
    { path: '/inventory-ledger', name: 'InventoryLedgerGrid', component: () => import('@/views/InventoryLedgerGrid.vue'), meta: { perm: 'app:mms_inventory' } },
    { path: '/inventory-stock-in', name: 'InventoryStockIn', component: () => import('@/views/InventoryStockIn.vue'), meta: { perm: 'app:mms_inventory' } },
    { path: '/inventory-stock-out', name: 'InventoryStockOut', component: () => import('@/views/InventoryStockOut.vue'), meta: { perm: 'app:mms_inventory' } },
    { path: '/inventory-draft/detail/:id', name: 'InventoryDraftDetail', component: () => import('@/views/InventoryDraftDetail.vue'), props: true, meta: { perm: 'app:mms_inventory' } },
    { path: '/inventory-current', name: 'InventoryCurrentGrid', component: () => import('@/views/InventoryCurrentGrid.vue'), meta: { perm: 'app:mms_inventory' } },
    { path: '/inventory-dashboard', name: 'InventoryDashboard', component: () => import('@/views/InventoryDashboard.vue'), meta: { perm: 'app:mms_dashboard' } }
  ]
})

router.beforeEach((to, from, next) => {
  let requiredPerm = to.meta?.perm
  if (!requiredPerm && to.name === 'MaterialsAppView') {
    const app = findMaterialApp(to.params?.key)
    requiredPerm = app?.perm
  }
  if (requiredPerm && !hasPerm(requiredPerm)) {
    return next(APPS_PATH)
  }
  next()
})

export default router
