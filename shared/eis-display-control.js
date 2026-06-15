// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { onMounted, onUnmounted, ref } from 'vue'

export const DISPLAY_VISIBILITY_STORAGE_KEY = 'eis_display_visibility_v1'
export const DISPLAY_VISIBILITY_UPDATED_EVENT = 'eis:display-visibility-updated'

export const DISPLAY_MODULE_CATALOG = [
  { key: 'home', label: '工作台', route: '/', apps: [] },
  {
    key: 'materials',
    label: '仓储管理',
    route: '/materials',
    apps: [
      { key: 'a', name: '物料', desc: '物料基础信息管理' },
      { key: 'batch-rules', name: '批次号规则', desc: '配置批次号生成规则' },
      { key: 'warehouses', name: '仓库管理', desc: '仓库/库区/库位管理' },
      { key: 'inventory-ledger', name: '库存台账', desc: '入库出库流水记录' },
      { key: 'inventory-stock-in', name: '入库', desc: '登记物料入库与批次号' },
      { key: 'production-stock-in', name: '生产入库单', desc: '生产完工后的成品入库草稿入口' },
      { key: 'inventory-stock-out', name: '出库', desc: '批次出库与库存扣减' },
      { key: 'production-picking', name: '生产领料单', desc: '按工单用料进行生产领料出库' },
      { key: 'sales-stock-out', name: '销售出库单', desc: '销售发货对应的成品出库草稿入口' },
      { key: 'inventory-current', name: '库存查询', desc: '实时库存汇总' },
      { key: 'inventory-dashboard', name: '库存大屏', desc: '可视化库存监控' }
    ]
  },
  {
    key: 'hr',
    label: '人事管理',
    route: '/hr',
    apps: [
      { key: 'a', name: '人事花名册', desc: '员工档案与基础信息管理' },
      { key: 'org', name: '部门架构图', desc: '多级部门结构与成员查看' },
      { key: 'acl', name: '权限管理', desc: '角色、权限与数据范围配置' },
      { key: 'user', name: '用户管理', desc: '系统用户与角色绑定管理' },
      { key: 'b', name: '调岗记录', desc: '岗位变动与调岗审批留痕' },
      { key: 'c', name: '考勤管理', desc: '签到签退与出勤记录台账' }
    ]
  },
  {
    key: 'apps',
    label: '应用中心',
    route: '/apps/',
    apps: [
      { key: 'config', name: '配置中心', desc: '统一管理流程/表格/闪念配置' },
      { key: 'create', name: '新建应用', desc: '创建流程/表格/闪念应用' },
      { key: 'approval', name: '审批中心', desc: '跨流程查看会签进度与审批意见' }
    ]
  },
  {
    key: 'sales',
    label: '销售管理',
    route: '/sales',
    apps: [
      { key: 'customers', name: '客户档案', desc: '客户基础资料、负责人、信用额度与应收余额' },
      { key: 'follow_ups', name: '客户跟进', desc: '客户拜访、沟通纪要、跟进结果与下次行动' },
      { key: 'opportunities', name: '销售商机', desc: '客户需求、预计金额、销售阶段与成交概率' },
      { key: 'orders', name: '销售订单', desc: '订单明细、交付计划、订单状态与销售金额' },
      { key: 'shipment_requests', name: '销售出货申请', desc: '基于销售订单跟进交付、下推和出货申请处理' },
      { key: 'payments', name: '回款记录', desc: '订单回款、核销状态与资金到账跟踪' },
      { key: 'cockpit', name: '销售驾驶舱', desc: '经营指标、销售漏斗、回款进度与风险预警' }
    ]
  },
  {
    key: 'purchase',
    label: '采购管理',
    route: '/purchase',
    apps: [
      { key: 'dashboard', name: '采购驾驶舱', desc: '采购态势、履约风险、到货节奏与供应商健康监控' },
      { key: 'suppliers', name: '供应商档案', desc: '供应商基础资料、等级、付款条件与交期管理' },
      { key: 'demands', name: '采购需求', desc: '物料采购需求、来源部门、建议供应商与需求状态' },
      { key: 'orders', name: '采购订单', desc: '供应商采购订单、金额、预计到货与执行状态' },
      { key: 'arrivals', name: '到货跟踪', desc: '采购到货、IQC结果、入库单号与异常处理' }
    ]
  },
  {
    key: 'production',
    label: '生产管理',
    route: '/production',
    apps: [
      { key: 'overview', name: '生产总览', desc: '看生产建议、工单进度、齐套和缺料风险' },
      { key: 'bom', name: '产品配方', desc: '维护生产一个产品需要哪些料、各用多少' },
      { key: 'process_templates', name: '工艺模板', desc: '以产品配方工作台承载当前工艺与配方维护入口' },
      { key: 'bom_list', name: '配方清单', desc: '用表格快速查看和维护产品配方主信息' },
      { key: 'plans', name: '生产建议', desc: '销售需求减掉成品库存后，还需要生产多少' },
      { key: 'work_orders', name: '生产工单', desc: '把生产建议转成可排产、可跟进的生产任务' },
      { key: 'work_reports', name: '订单/工单报工', desc: '通过生产工单跟进生产进度、状态和完工信息' },
      { key: 'picking_orders', name: '生产领料单', desc: '进入工单用料清单，跟进领料、缺料和齐套状态' },
      { key: 'work_order_items', name: '领料跟进', desc: '查看每张工单需要哪些料、缺多少、领到哪一步' }
    ]
  },
  {
    key: 'quality',
    label: '质量管理',
    route: '/quality',
    apps: [
      { key: 'dashboard', name: '质量总览', desc: '查看待检、合格率、异常和整改闭环' },
      { key: 'inspections', name: '检验台账', desc: '来料、过程、首件和成品检验记录' },
      { key: 'inspection_orders', name: '检验单', desc: '进入检验台账处理来料、过程和成品检验单' },
      { key: 'production_inspections', name: '生产检验', desc: '面向生产过程和成品放行的检验记录入口' },
      { key: 'ncr', name: '质量异常', desc: '不合格、责任归属、整改和验证关闭' },
      { key: 'actions', name: '整改任务', desc: '跟踪异常整改、预防措施和验证结果' },
      { key: 'audits', name: '质量审核', desc: '体系、过程、供应商审核计划和发现项' },
      { key: 'standards', name: '检验标准', desc: '维护品类检验标准、版本和关键指标' }
    ]
  },
  {
    key: 'equipment',
    label: '设备管理',
    route: '/equipment',
    apps: [
      { key: 'dashboard', name: '设备总览', desc: '查看设备运行、点检异常、维保工单和计划达成' },
      { key: 'assets', name: '设备台账', desc: '维护设备档案、责任人、运行状态和保养周期' },
      { key: 'checks', name: '点检记录', desc: '记录班前点检、日常巡检和专项检查结果' },
      { key: 'equipment_patrols', name: '设备巡检', desc: '进入点检记录处理日常巡检、班前点检和专项检查' },
      { key: 'issues', name: '设备异常', desc: '登记故障、异常来源、责任归属和处理状态' },
      { key: 'work_orders', name: '维保工单', desc: '跟踪维修派工、停机时长、备件更换和验收' },
      { key: 'plans', name: '巡检计划', desc: '维护设备巡检、保养和大修计划' },
      { key: 'standards', name: '保养标准', desc: '维护设备点检标准、保养规范和关键项目' }
    ]
  },
  {
    key: 'decision',
    label: '决策支持',
    route: '/decision',
    apps: [
      { key: 'inventory', name: '库存大屏', desc: '查看仓库、库位、批次库存和近期出入库动态' },
      { key: 'sales', name: '销售驾驶舱', desc: '聚合经营指标、销售漏斗、回款进度和风险预警' },
      { key: 'purchase', name: '采购驾驶舱', desc: '监控采购需求、订单履约、到货节奏和交付风险' },
      { key: 'production', name: '生产总览', desc: '查看生产建议、工单进度、齐套检查和缺料风险' },
      { key: 'quality', name: '质量总览', desc: '汇总检验、异常、整改、审核和质量标准' },
      { key: 'equipment', name: '设备总览', desc: '查看设备台账、点检异常、维保工单和保养计划' }
    ]
  }
]

const normalizeKeyArray = (input) => {
  if (!Array.isArray(input)) return []
  return Array.from(new Set(input.map((item) => String(item || '').trim()).filter(Boolean)))
}

export const defaultDisplayVisibility = () => ({
  hiddenModules: [],
  hiddenApps: {}
})

export const normalizeDisplayVisibility = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  const hiddenAppsSource = source.hiddenApps && typeof source.hiddenApps === 'object'
    ? source.hiddenApps
    : {}
  const hiddenApps = Object.entries(hiddenAppsSource).reduce((acc, [moduleKey, appKeys]) => {
    const key = String(moduleKey || '').trim()
    if (!key) return acc
    acc[key] = normalizeKeyArray(appKeys)
    return acc
  }, {})
  return {
    hiddenModules: normalizeKeyArray(source.hiddenModules),
    hiddenApps
  }
}

const readJson = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (e) {
    return {}
  }
}

export const isModuleVisible = (visibility, moduleKey) => {
  const cfg = normalizeDisplayVisibility(visibility)
  return !cfg.hiddenModules.includes(String(moduleKey || '').trim())
}

export const isAppVisible = (visibility, moduleKey, appKey) => {
  const cfg = normalizeDisplayVisibility(visibility)
  const module = String(moduleKey || '').trim()
  const app = String(appKey || '').trim()
  if (!isModuleVisible(cfg, module)) return false
  if (!module || !app) return true
  return !(cfg.hiddenApps[module] || []).includes(app)
}

export const filterVisibleApps = (apps, moduleKey, visibility) => {
  if (!Array.isArray(apps)) return []
  return apps.filter((app) => isAppVisible(visibility, moduleKey, app?.key || app?.id))
}

export const getStoredDisplayVisibility = () => {
  if (typeof localStorage === 'undefined') return defaultDisplayVisibility()
  return normalizeDisplayVisibility(readJson(localStorage.getItem(DISPLAY_VISIBILITY_STORAGE_KEY)))
}

export const saveStoredDisplayVisibility = (visibility) => {
  const cfg = normalizeDisplayVisibility(visibility)
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(DISPLAY_VISIBILITY_STORAGE_KEY, JSON.stringify(cfg))
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(DISPLAY_VISIBILITY_UPDATED_EVENT, { detail: cfg }))
    } catch (e) {}
  }
  return cfg
}

const getAuthToken = () => {
  if (typeof localStorage === 'undefined') return ''
  const raw = localStorage.getItem('auth_token')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    return parsed?.token || raw
  } catch (e) {
    return raw
  }
}

export const fetchDisplayVisibility = async () => {
  const headers = {
    Accept: 'application/json',
    'Accept-Profile': 'public'
  }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/system_configs?key=eq.app_settings', { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const list = await res.json()
  const row = Array.isArray(list) ? list[0] : null
  const value = readJson(row?.value)
  return saveStoredDisplayVisibility(value.visibility)
}

export const useDisplayVisibility = () => {
  const visibility = ref(getStoredDisplayVisibility())

  const refresh = async () => {
    try {
      visibility.value = await fetchDisplayVisibility()
    } catch (e) {
      visibility.value = getStoredDisplayVisibility()
    }
  }

  const handleUpdated = (event) => {
    visibility.value = normalizeDisplayVisibility(event?.detail)
  }

  const handleStorage = (event) => {
    if (event?.key === DISPLAY_VISIBILITY_STORAGE_KEY) {
      visibility.value = normalizeDisplayVisibility(readJson(event.newValue))
    }
  }

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener(DISPLAY_VISIBILITY_UPDATED_EVENT, handleUpdated)
      window.addEventListener('storage', handleStorage)
    }
    refresh()
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(DISPLAY_VISIBILITY_UPDATED_EVENT, handleUpdated)
      window.removeEventListener('storage', handleStorage)
    }
  })

  return { visibility, refresh }
}
