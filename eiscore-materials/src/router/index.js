import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import MaterialsApps from '@/views/MaterialsApps.vue'
import MaterialsAppView from '@/views/MaterialsAppView.vue'
import MaterialDetail from '@/views/MaterialDetail.vue'
import MaterialLabelPreview from '@/views/MaterialLabelPreview.vue'

const router = createRouter({
  history: createWebHistory(qiankunWindow.__POWERED_BY_QIANKUN__ ? '/materials' : '/'),
  routes: [
    { path: '/', redirect: '/apps' },
    { path: '/apps', name: 'MaterialsApps', component: MaterialsApps },
    { path: '/app/:key', name: 'MaterialsAppView', component: MaterialsAppView, props: true },
    { path: '/material/detail/:id', name: 'MaterialDetail', component: MaterialDetail, props: true },
    { path: '/material/label/:id', name: 'MaterialLabelPreview', component: MaterialLabelPreview, props: true }
  ]
})

export default router
