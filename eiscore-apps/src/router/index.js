// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const waitBeforeRetry = (attempt) => new Promise((resolve) => {
  window.setTimeout(resolve, 250 * attempt)
})

const lazyView = (loader, attempts = 3) => {
  let resolved = null

  return async () => {
    if (resolved) return resolved

    let lastError = null
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        resolved = await loader()
        return resolved
      } catch (error) {
        lastError = error
        if (attempt < attempts) await waitBeforeRetry(attempt)
      }
    }

    throw lastError
  }
}

export default [
  {
    path: '/',
    name: 'AppDashboard',
    component: lazyView(() => import('../views/AppDashboard.vue')),
    meta: { title: '应用中心' }
  },
  {
    path: '/flash-builder/:appId?',
    name: 'FlashBuilder',
    component: lazyView(() => import('../views/FlashBuilder.vue')),
    meta: { title: 'Flash 应用构建器', requiresManage: true }
  },
  {
    path: '/workflow-designer/:appId?',
    name: 'WorkflowDesigner',
    component: lazyView(() => import('../views/flow/FlowDesigner.vue')),
    meta: { title: '工作流设计器', requiresManage: true }
  },
  {
    path: '/data-app/:appId?',
    name: 'DataApp',
    component: lazyView(() => import('../views/DataApp.vue')),
    meta: { title: '数据应用配置', requiresManage: true }
  },
  {
    path: '/config-center/:appId?',
    name: 'AppConfigCenter',
    component: lazyView(() => import('../views/AppConfigCenter.vue')),
    meta: { title: '应用配置中心', requiresManage: true }
  },
  {
    path: '/ontology-relations/:appId?',
    name: 'OntologyWorkbench',
    component: lazyView(() => import('../views/OntologyWorkbench.vue')),
    meta: { title: '本体关系工作台', requiresManage: true }
  },
  {
    path: '/workflow-approval-center',
    name: 'WorkflowApprovalCenter',
    component: lazyView(() => import('../views/WorkflowApprovalCenter.vue')),
    meta: { title: '审批中心', requiresManage: true }
  },
  {
    path: '/document-intake-center',
    name: 'DocumentIntakeCenter',
    component: lazyView(() => import('../views/DocumentIntakeCenter.vue')),
    meta: { title: '智能收单中心' }
  },
  {
    path: '/payroll-precheck-review',
    name: 'PayrollPrecheckReview',
    component: lazyView(() => import('../views/PayrollPrecheckReview.vue')),
    meta: { title: '薪资复核' }
  },
  {
    path: '/app/:appId',
    name: 'AppRuntime',
    component: lazyView(() => import('../views/AppRuntime.vue')),
    meta: { title: '应用', requiresEntry: true }
  },
  {
    path: '/app/:appId/record/:rowId',
    name: 'AppRecordDetail',
    component: lazyView(() => import('../views/AppRecordDetail.vue')),
    meta: { title: '数据表单', requiresEntry: true }
  },
  {
    path: '/preview/flash-draft',
    name: 'FlashDraftPreview',
    component: lazyView(() => import('../views/FlashDraftPreview.vue')),
    meta: { title: '闪念草稿预览' }
  },
  {
    path: '/__preview/:draftId',
    name: 'PreviewFrame',
    component: lazyView(() => import('../views/PreviewFrame.vue')),
    meta: { title: '预览' }
  }
]
