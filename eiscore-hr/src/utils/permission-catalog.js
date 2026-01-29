import { HR_APPS } from '@/utils/hr-apps'
import { MODULE_LABELS, OP_ACTION_LABELS } from '@/utils/permission-spec'

const MODULE_KEYS = ['home', 'hr', 'mms']

const MATERIAL_APP = {
  key: 'mms_ledger',
  name: '物料台账',
  perm: 'app:mms_ledger',
  ops: {
    create: 'op:mms_ledger.create',
    edit: 'op:mms_ledger.edit',
    delete: 'op:mms_ledger.delete',
    import: 'op:mms_ledger.import',
    export: 'op:mms_ledger.export',
    config: 'op:mms_ledger.config'
  }
}

const buildModulePermissions = () => {
  return MODULE_KEYS.map((key) => ({
    code: `module:${key}`,
    name: `模块-${MODULE_LABELS[key] || key}`,
    module: '模块',
    action: '显示'
  }))
}

const buildAppPermissions = (apps) => {
  return apps
    .filter(app => app?.perm)
    .map((app) => ({
      code: app.perm,
      name: `应用-${app.name || app.perm}`,
      module: '应用',
      action: '进入'
    }))
}

const buildOpPermissions = (apps) => {
  const list = []
  apps.forEach((app) => {
    const ops = app?.ops || {}
    Object.values(ops).forEach((code) => {
      if (!code) return
      const parts = String(code).split(':')
      if (parts.length < 2) return
      const detail = parts.slice(1).join(':')
      const [appKey, actionKey] = detail.split('.')
      const actionLabel = OP_ACTION_LABELS[actionKey] || actionKey
      list.push({
        code,
        name: `${app.name || appKey}-${actionLabel}`,
        module: app.name || appKey,
        action: actionLabel
      })
    })
  })
  return list
}

export const buildPermissionPayload = () => {
  const hrApps = Array.isArray(HR_APPS) ? HR_APPS : []
  const apps = [...hrApps, MATERIAL_APP]
  return [
    ...buildModulePermissions(),
    ...buildAppPermissions(apps),
    ...buildOpPermissions(apps)
  ]
}
