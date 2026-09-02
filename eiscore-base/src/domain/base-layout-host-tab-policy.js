// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { canonicalizeMicroChainPath, ensureAbsoluteHostPath } from '../utils/micro-path.js'

export const HOST_ENTRY_TAB_KEY = '/'

const MODULE_ENTRY_TITLES = {
  '/': '首页',
  '/materials': '仓储管理',
  '/hr': '人事管理',
  '/apps/': '应用中心',
  '/company-site': '企业站点运营',
  '/sales': '销售管理',
  '/purchase': '采购管理',
  '/production': '生产管理',
  '/quality': '质量管理',
  '/equipment': '设备管理',
  '/decision': '决策支持'
}

const MODULE_APP_KEY_TITLES = {
  materials: { a: '物料' },
  hr: { b: '调岗记录', c: '考勤管理' },
  sales: {
    customers: '客户档案',
    follow_ups: '客户跟进',
    opportunities: '销售商机',
    orders: '销售订单',
    payments: '回款记录'
  },
  purchase: {
    suppliers: '供应商档案',
    demands: '采购需求',
    orders: '采购订单',
    arrivals: '到货跟踪'
  },
  production: {
    bom_list: '配方清单',
    plans: '生产建议',
    work_orders: '生产工单',
    work_order_items: '领料跟进'
  },
  quality: {
    inspections: '检验台账',
    inspection_orders: '检验单',
    production_inspections: '生产检验',
    ncr: '质量异常',
    actions: '整改任务',
    audits: '质量审核',
    standards: '检验标准',
    dashboard: '质量总览'
  },
  equipment: {
    assets: '设备台账',
    checks: '点检记录',
    equipment_patrols: '设备巡检',
    issues: '设备异常',
    work_orders: '维保工单',
    plans: '巡检计划',
    standards: '保养标准',
    dashboard: '设备总览'
  }
}

const MODULE_DIRECT_APP_ROUTES = [
  { path: '/materials/batch-rules', title: '批次号规则' },
  { path: '/materials/warehouses', title: '仓库管理' },
  { path: '/materials/inventory-ledger', title: '库存台账' },
  { path: '/materials/inventory-stock-in', title: '入库' },
  { path: '/materials/inventory-stock-out', title: '出库' },
  { path: '/materials/inventory-current', title: '库存查询' },
  { path: '/materials/inventory-dashboard', title: '库存大屏' },
  { path: '/materials/material/detail', title: '物料', tabKey: '/materials/app/a' },
  { path: '/materials/material/label', title: '物料', tabKey: '/materials/app/a' },
  { path: '/materials/inventory-draft/detail', title: '库存台账', tabKey: '/materials/inventory-ledger' },
  { path: '/hr/employee', title: '人事花名册' },
  { path: '/hr/org', title: '部门架构图' },
  { path: '/hr/acl', title: '权限管理' },
  { path: '/hr/users', title: '用户管理' },
  { path: '/sales/cockpit', title: '销售驾驶舱' },
  { path: '/purchase/dashboard', title: '采购驾驶舱' },
  { path: '/production/overview', title: '生产总览' },
  { path: '/production/bom', title: '产品配方' },
  { path: '/quality/dashboard', title: '质量总览' },
  { path: '/equipment/dashboard', title: '设备总览' }
]

export const normalizeHostTabPath = (value) => {
  const raw = canonicalizeMicroChainPath(ensureAbsoluteHostPath(value))
  if (raw === '/apps' || raw === '/apps/index.html') return '/apps/'
  if (raw === '/company-site/' || raw === '/company-site/index.html') return '/company-site'
  if (raw === '/materials/' || raw === '/materials/index.html' || raw === '/materials/apps' || raw === '/materials/apps/') return '/materials'
  if (raw === '/hr/' || raw === '/hr/index.html' || raw === '/hr/apps' || raw === '/hr/apps/') return '/hr'
  if (raw === '/sales/' || raw === '/sales/index.html' || raw === '/sales/apps' || raw === '/sales/apps/') return '/sales'
  if (raw === '/purchase/' || raw === '/purchase/index.html' || raw === '/purchase/apps' || raw === '/purchase/apps/') return '/purchase'
  if (raw === '/production/' || raw === '/production/index.html' || raw === '/production/apps' || raw === '/production/apps/') return '/production'
  if (raw === '/quality/' || raw === '/quality/index.html' || raw === '/quality/apps' || raw === '/quality/apps/') return '/quality'
  if (raw === '/equipment/' || raw === '/equipment/index.html' || raw === '/equipment/apps' || raw === '/equipment/apps/') return '/equipment'
  if (raw === '/decision/' || raw === '/decision/index.html' || raw === '/decision/apps' || raw === '/decision/apps/') return '/decision'
  if (raw === '/materials' || raw.startsWith('/materials/')) return raw
  if (raw === '/hr' || raw.startsWith('/hr/')) return raw
  if (raw === '/sales' || raw.startsWith('/sales/')) return raw
  if (raw === '/purchase' || raw.startsWith('/purchase/')) return raw
  if (raw === '/production' || raw.startsWith('/production/')) return raw
  if (raw === '/quality' || raw.startsWith('/quality/')) return raw
  if (raw === '/equipment' || raw.startsWith('/equipment/')) return raw
  if (raw === '/decision' || raw.startsWith('/decision/')) return raw
  if (raw.startsWith('/apps/config-center')) return '/apps/config-center'
  if (raw.startsWith('/apps/')) return raw
  if (raw === '/company-site' || raw.startsWith('/company-site/')) return raw
  if (raw === '/settings') return '/settings'
  if (raw.startsWith('/ai/enterprise')) return '/ai/enterprise'
  return raw
}

export const normalizeHostTabQuery = (value) => {
  if (!value || typeof value !== 'object') return {}
  const next = {}
  Object.keys(value).sort().forEach((key) => {
    const current = value[key]
    if (current === null || current === undefined) return
    if (Array.isArray(current)) {
      const list = current.map((item) => String(item || '').trim()).filter(Boolean)
      if (list.length) next[key] = list.join(',')
      return
    }
    const text = String(current).trim()
    if (text) next[key] = text
  })
  return next
}

export const serializeHostTabQuery = (query = {}) => {
  const params = new URLSearchParams()
  Object.keys(query).sort().forEach((key) => params.set(key, query[key]))
  return params.toString()
}

export const buildHostTabRouteId = (path, query = {}) => {
  const queryString = serializeHostTabQuery(query)
  return queryString ? `${path}?${queryString}` : path
}

export const resolveHostTabDot = (path) => {
  if (path === '/') return 'home'
  for (const moduleName of ['materials', 'hr', 'apps', 'company-site', 'sales', 'purchase', 'production', 'quality', 'equipment', 'decision']) {
    if (path.startsWith(`/${moduleName}`)) return moduleName
  }
  return 'default'
}

export const getHostEntryTitle = (path) => MODULE_ENTRY_TITLES[path] || '首页'

export const isHostModuleEntryPath = (path) => [
  '/',
  '/materials',
  '/hr',
  '/apps/',
  '/apps',
  '/company-site',
  '/sales',
  '/purchase',
  '/production',
  '/quality',
  '/equipment',
  '/decision'
].includes(path)

export const getHostModuleAppKeyTitle = (path) => {
  const match = String(path || '').match(/^\/(materials|hr|sales|purchase|production|quality|equipment)\/app\/([^/?#]+)/)
  if (!match) return ''
  return MODULE_APP_KEY_TITLES[match[1]]?.[decodeURIComponent(match[2] || '')] || ''
}

export const getHostDirectAppRoute = (path) => {
  return MODULE_DIRECT_APP_ROUTES.find((item) => path === item.path || path.startsWith(`${item.path}/`)) || null
}

export const getHostPurchaseDocumentAppKey = (path, query = {}) => {
  if (!String(path || '').startsWith('/purchase/document/')) return ''
  return String(query.appKey || '').trim() || 'suppliers'
}

export const isHostModuleAppPath = (path, query = {}) => {
  return !!(
    getHostPurchaseDocumentAppKey(path, query) ||
    getHostModuleAppKeyTitle(path) ||
    getHostDirectAppRoute(path)
  )
}

export const getAppRuntimeIdFromHostPath = (path) => {
  const match = String(path || '').match(/^\/apps\/app\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

export const normalizeHostFallbackTitle = (title) => {
  const text = String(title || '').trim()
  return !text || text === '页面' || text === '应用运行' ? '' : text
}

export const getHostQueryAppTitle = (query = {}) => String(query.appName || query.name || '').trim()

export const resolveHostTabTitle = (
  path,
  query = {},
  fallback = '',
  { getRuntimeTitle = () => '' } = {}
) => {
  const preferred = normalizeHostFallbackTitle(fallback)
  const purchaseDocumentAppKey = getHostPurchaseDocumentAppKey(path, query)
  if (purchaseDocumentAppKey) return MODULE_APP_KEY_TITLES.purchase?.[purchaseDocumentAppKey] || '采购单据'
  if (isHostModuleEntryPath(path)) return getHostEntryTitle(path === '/apps' ? '/apps/' : path)
  const moduleAppKeyTitle = getHostModuleAppKeyTitle(path)
  if (moduleAppKeyTitle) return moduleAppKeyTitle
  const directAppRoute = getHostDirectAppRoute(path)
  if (directAppRoute?.title) return directAppRoute.title
  if (path === '/apps/config-center') return '应用配置中心'
  if (path.startsWith('/apps/workflow-designer/')) return preferred || getHostQueryAppTitle(query) || '流程应用'
  if (path.startsWith('/apps/flash-builder/')) return preferred || getHostQueryAppTitle(query) || '闪念应用'
  if (path.startsWith('/apps/data-app/')) return preferred || getHostQueryAppTitle(query) || '数据表格应用'
  if (path.startsWith('/apps/ontology-relations/')) return '本体关系工作台'
  if (path.startsWith('/apps/app/')) {
    const queryTitle = getHostQueryAppTitle(query)
    return preferred || queryTitle || getRuntimeTitle(getAppRuntimeIdFromHostPath(path)) || '应用运行'
  }
  if (path === '/settings') return '系统设置'
  if (path.startsWith('/ai/enterprise')) return '企业助手'
  return preferred || '页面'
}

export const buildDefaultHostTabKey = (path, query = {}) => {
  if (isHostModuleEntryPath(path)) return HOST_ENTRY_TAB_KEY
  const purchaseDocumentAppKey = getHostPurchaseDocumentAppKey(path, query)
  if (purchaseDocumentAppKey) return `/purchase/app/${purchaseDocumentAppKey}`
  const directAppRoute = getHostDirectAppRoute(path)
  if (directAppRoute?.tabKey) return directAppRoute.tabKey
  if (directAppRoute) return directAppRoute.path
  if (isHostModuleAppPath(path, query)) {
    const match = String(path || '').match(/^\/(materials|hr|sales|purchase|production|quality|equipment)\/app\/([^/?#]+)/)
    if (match) return `/${match[1]}/app/${decodeURIComponent(match[2] || '')}`
  }
  if (path === '/apps/config-center') return '/apps/config-center'
  if (path === '/settings') return '/settings'
  if (path.startsWith('/ai/enterprise')) return '/ai/enterprise'
  return path
}
