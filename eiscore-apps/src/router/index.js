export default [
  {
    path: '/',
    name: 'AppDashboard',
    component: () => import('../views/AppDashboard.vue'),
    meta: { title: '应用中心' }
  },
  {
    path: '/flash-builder/:appId?',
    name: 'FlashBuilder',
    component: () => import('../views/FlashBuilder.vue'),
    meta: { title: 'Flash 应用构建器' }
  },
  {
    path: '/workflow-designer/:appId?',
    name: 'WorkflowDesigner',
    component: () => import('../views/flow/FlowDesigner.vue'),
    meta: { title: '工作流设计器' }
  },
  {
    path: '/data-app/:appId?',
    name: 'DataApp',
    component: () => import('../views/DataApp.vue'),
    meta: { title: '数据应用配置' }
  },
  {
    path: '/config-center/:appId?',
    name: 'AppConfigCenter',
    component: () => import('../views/AppConfigCenter.vue'),
    meta: { title: '应用配置中心' }
  },
  {
    path: '/app/:appId',
    name: 'AppRuntime',
    component: () => import('../views/AppRuntime.vue'),
    meta: { title: '应用' }
  },
  {
    path: '/app/:appId/record/:rowId',
    name: 'AppRecordDetail',
    component: () => import('../views/AppRecordDetail.vue'),
    meta: { title: '数据表单' }
  },
  {
    path: '/__preview/:draftId',
    name: 'PreviewFrame',
    component: () => import('../views/PreviewFrame.vue'),
    meta: { title: '预览' }
  }
]
