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
    meta: { title: 'Flash 应用构建器', requiresManage: true }
  },
  {
    path: '/workflow-designer/:appId?',
    name: 'WorkflowDesigner',
    component: () => import('../views/flow/FlowDesigner.vue'),
    meta: { title: '工作流设计器', requiresManage: true }
  },
  {
    path: '/data-app/:appId?',
    name: 'DataApp',
    component: () => import('../views/DataApp.vue'),
    meta: { title: '数据应用配置', requiresManage: true }
  },
  {
    path: '/config-center/:appId?',
    name: 'AppConfigCenter',
    component: () => import('../views/AppConfigCenter.vue'),
    meta: { title: '应用配置中心', requiresManage: true }
  },
  {
    path: '/ontology-relations/:appId?',
    name: 'OntologyWorkbench',
    component: () => import('../views/OntologyWorkbench.vue'),
    meta: { title: '本体关系工作台', requiresManage: true }
  },
  {
    path: '/workflow-approval-center',
    name: 'WorkflowApprovalCenter',
    component: () => import('../views/WorkflowApprovalCenter.vue'),
    meta: { title: '审批中心', requiresManage: true }
  },
  {
    path: '/app/:appId',
    name: 'AppRuntime',
    component: () => import('../views/AppRuntime.vue'),
    meta: { title: '应用', requiresEntry: true }
  },
  {
    path: '/app/:appId/record/:rowId',
    name: 'AppRecordDetail',
    component: () => import('../views/AppRecordDetail.vue'),
    meta: { title: '数据表单', requiresEntry: true }
  },
  {
    path: '/preview/flash-draft',
    name: 'FlashDraftPreview',
    component: () => import('../views/drafts/FlashDraft.vue'),
    meta: { title: '闪念草稿预览' }
  },
  {
    path: '/__preview/:draftId',
    name: 'PreviewFrame',
    component: () => import('../views/PreviewFrame.vue'),
    meta: { title: '预览' }
  }
]
