// 权限点规范：module / app / op / field
// code 是唯一事实来源；module/action 仅用于展示或分类

export const MODULE_LABELS = {
  home: '首页',
  hr: '人事',
  mms: '物料',
  app: '应用中心'
}

export const APP_LABELS = {
  hr_employee: '人事花名册',
  hr_org: '部门架构',
  hr_attendance: '考勤管理',
  hr_change: '调岗记录',
  hr_acl: '权限管理',
  hr_user: '用户管理',
  mms_ledger: '物料台账'
}

export const OP_ACTION_LABELS = {
  view: '查看',
  create: '新增',
  edit: '编辑',
  delete: '删除',
  import: '导入',
  export: '导出',
  config: '配置',
  save_layout: '保存布局',
  member_manage: '成员管理',
  shift_manage: '班次管理',
  shift_create: '班次新增'
}

export const PERMISSION_MODULE_OPTIONS = [
  { label: '模块', value: '模块' },
  { label: '应用', value: '应用' },
  { label: MODULE_LABELS.app, value: MODULE_LABELS.app },
  { label: APP_LABELS.hr_employee, value: APP_LABELS.hr_employee },
  { label: APP_LABELS.hr_org, value: APP_LABELS.hr_org },
  { label: APP_LABELS.hr_attendance, value: APP_LABELS.hr_attendance },
  { label: APP_LABELS.hr_change, value: APP_LABELS.hr_change },
  { label: APP_LABELS.hr_acl, value: APP_LABELS.hr_acl },
  { label: APP_LABELS.hr_user, value: APP_LABELS.hr_user },
  { label: APP_LABELS.mms_ledger, value: APP_LABELS.mms_ledger }
]

export const PERMISSION_ACTION_OPTIONS = [
  { label: '显示', value: '显示' },
  { label: '进入', value: '进入' },
  { label: '查看', value: '查看' },
  { label: '新增', value: '新增' },
  { label: '编辑', value: '编辑' },
  { label: '删除', value: '删除' },
  { label: '导入', value: '导入' },
  { label: '导出', value: '导出' },
  { label: '配置', value: '配置' },
  { label: '保存布局', value: '保存布局' },
  { label: '班次管理', value: '班次管理' },
  { label: '班次新增', value: '班次新增' },
  { label: '成员管理', value: '成员管理' }
]

export const buildModulePerm = (key) => `module:${key}`
export const buildAppPerm = (key) => `app:${key}`
export const buildOpPerm = (appKey, actionKey) => `op:${appKey}.${actionKey}`
export const buildFieldPerm = (appKey, fieldKey, actionKey) => `field:${appKey}.${fieldKey}.${actionKey}`

export const parsePermissionCode = (code) => {
  if (!code || typeof code !== 'string') return null
  const parts = code.split(':')
  if (parts.length < 2) return null
  const scope = parts[0]
  const detail = parts.slice(1).join(':')
  if (scope === 'module') return { scope, key: detail }
  if (scope === 'app') return { scope, key: detail }
  if (scope === 'op') {
    const [appKey, actionKey] = detail.split('.')
    return { scope, appKey, actionKey }
  }
  if (scope === 'field') {
    const segs = detail.split('.')
    const appKey = segs[0]
    const actionKey = segs[segs.length - 1]
    const fieldKey = segs.slice(1, -1).join('.')
    return { scope, appKey, fieldKey, actionKey }
  }
  return { scope, key: detail }
}

export const formatPermissionName = (code, fallback) => {
  const parsed = parsePermissionCode(code)
  if (!parsed) return fallback || code
  if (parsed.scope === 'module') {
    return `模块-${MODULE_LABELS[parsed.key] || parsed.key}`
  }
  if (parsed.scope === 'app') {
    return `应用-${APP_LABELS[parsed.key] || parsed.key}`
  }
  if (parsed.scope === 'op') {
    const appName = APP_LABELS[parsed.appKey] || parsed.appKey
    const actionName = OP_ACTION_LABELS[parsed.actionKey] || parsed.actionKey
    return `${appName}-${actionName}`
  }
  if (parsed.scope === 'field') {
    const appName = APP_LABELS[parsed.appKey] || parsed.appKey
    const actionName = OP_ACTION_LABELS[parsed.actionKey] || parsed.actionKey
    return `${appName}-${parsed.fieldKey}-${actionName}`
  }
  return fallback || code
}
