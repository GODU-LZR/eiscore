// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const BASE_MICRO_APP_KEYS = [
  'materials', 'hr', 'apps', 'company-site', 'sales', 'purchase', 'production', 'quality', 'equipment', 'decision'
]

const ENTRY_PREFIX = Object.fromEntries(BASE_MICRO_APP_KEYS.map((key) => [key, `/${key}/`]))

const MODULE_TITLES = {
  materials: '仓储管理',
  hr: '人事管理',
  apps: '应用中心',
  'company-site': '企业站点运营',
  sales: '销售管理',
  purchase: '采购管理',
  production: '生产管理',
  quality: '质量管理',
  equipment: '设备管理',
  decision: '决策支持'
}

export const getBaseModuleLoadingTitle = (moduleKey) => MODULE_TITLES[moduleKey] || '模块'

export const rankBaseMicroAppWarmUrl = (url) => {
  if (url.endsWith('/index.html')) return 0
  if (/\/assets\/(?:runtime|vue-runtime|index|micro-app|request|utils)-/.test(url)) return 1
  if (/\/assets\/(?:bpmn|maps-canvas|ag-grid)-/.test(url)) return 8
  if (/\/apps\/assets\/AppDashboard-/.test(url)) return 2
  if (/\/(?:materials|hr|sales|purchase|production|quality|equipment|decision)\/assets\/.*(?:AppView|AppGrid|Apps|Dashboard|Cockpit|Overview|Inventory|Home)-/.test(url)) return 2
  if (/\/assets\/element-plus-/.test(url)) return 2
  if (/\/assets\/(?:vendor-misc)-/.test(url)) return 3
  if (/\/apps\/assets\/(?:AppRuntime|DataApp|AppConfigCenter|AppRecordDetail|WorkflowApprovalCenter|FlowDesigner|FlashBuilder|OntologyWorkbench)-/.test(url)) return 6
  if (/\/apps\/assets\/(?:AppCenterGrid|AppRuntime|DataApp|AppConfigCenter|AppRecordDetail|WorkflowApprovalCenter|FlowDesigner|FlashBuilder|OntologyWorkbench)-.*\.css$/.test(url)) return 7
  if (/\/assets\/style-/.test(url) || url.endsWith('.css')) return 4
  if (/\/assets\/(?:charts|documents)-/.test(url)) return 8
  return 5
}

export const sortBaseMicroAppWarmUrls = (urls) => [...urls].sort((left, right) => {
  const rankDelta = rankBaseMicroAppWarmUrl(left) - rankBaseMicroAppWarmUrl(right)
  return rankDelta || left.localeCompare(right)
})

export const pickBaseMicroAppWarmUrls = (moduleKey, manifest) => {
  const prefix = ENTRY_PREFIX[moduleKey]
  const urls = Array.isArray(manifest?.urls) ? manifest.urls : []
  if (!prefix) return []
  return sortBaseMicroAppWarmUrls(urls.filter((url) => (
    url === `${prefix}index.html` || url.startsWith(`${prefix}assets/`)
  )))
}

export const getBaseModuleKeyFromPath = (path) => {
  const first = String(path || '').split('?')[0].split('#')[0].split('/').filter(Boolean)[0]
  return BASE_MICRO_APP_KEYS.includes(first) ? first : ''
}

export const getVisibleBaseMicroAppKeys = (visibility = {}) => BASE_MICRO_APP_KEYS
  .filter((key) => !!visibility[key])
