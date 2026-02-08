import request from '@/utils/request'

const normalizeAppId = (appId) => {
  if (!appId) return ''
  return String(appId).replace(/-/g, '')
}

export const buildAppModuleKey = (appId) => {
  const raw = normalizeAppId(appId)
  if (!raw) return ''
  return `app_${raw}`
}

export const buildDefaultOps = (moduleKey) => {
  if (!moduleKey) return {}
  return {
    create: `op:${moduleKey}.create`,
    edit: `op:${moduleKey}.edit`,
    delete: `op:${moduleKey}.delete`,
    export: `op:${moduleKey}.export`,
    config: `op:${moduleKey}.config`
  }
}

export const resolveAppAclModule = (app, fallbackConfig = null, fallbackId = '') => {
  let cfg = fallbackConfig || app?.config || {}
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg)
    } catch {
      cfg = {}
    }
  }
  if (cfg?.aclModule) return cfg.aclModule
  if (app?.aclModule) return app.aclModule
  const id = app?.id || fallbackId
  return buildAppModuleKey(id)
}

export const ensureAppAclConfig = (config, appId) => {
  const next = { ...(config || {}) }
  if (!next.aclModule) {
    next.aclModule = buildAppModuleKey(appId)
  }
  if (!next.ops || typeof next.ops !== 'object') {
    next.ops = buildDefaultOps(next.aclModule)
  }
  if (!next.perm && next.aclModule) {
    next.perm = `app:${next.aclModule}`
  }
  return next
}

const buildPermissionPayload = (app, moduleKey, roles = ['super_admin']) => {
  if (!moduleKey) return []
  const appName = app?.name || app?.title || moduleKey
  const payload = [
    {
      code: 'module:app',
      name: '模块-应用中心',
      module: '模块',
      action: '显示',
      roles
    },
    {
      code: `app:${moduleKey}`,
      name: `应用-${appName}`,
      module: appName,
      action: '进入',
      roles
    },
    {
      code: `op:${moduleKey}.create`,
      name: `${appName}-新增`,
      module: appName,
      action: '新增',
      roles
    },
    {
      code: `op:${moduleKey}.edit`,
      name: `${appName}-编辑`,
      module: appName,
      action: '编辑',
      roles
    },
    {
      code: `op:${moduleKey}.delete`,
      name: `${appName}-删除`,
      module: appName,
      action: '删除',
      roles
    },
    {
      code: `op:${moduleKey}.export`,
      name: `${appName}-导出`,
      module: appName,
      action: '导出',
      roles
    },
    {
      code: `op:${moduleKey}.config`,
      name: `${appName}-配置`,
      module: appName,
      action: '配置',
      roles
    }
  ]
  return payload
}

const buildPermissionCodes = (moduleKey) => {
  if (!moduleKey) return []
  return [
    `app:${moduleKey}`,
    `op:${moduleKey}.create`,
    `op:${moduleKey}.edit`,
    `op:${moduleKey}.delete`,
    `op:${moduleKey}.export`,
    `op:${moduleKey}.config`
  ]
}

const buildInFilter = (values) => {
  const list = (Array.isArray(values) ? values : []).filter(Boolean)
  if (list.length === 0) return ''
  return list.map((val) => encodeURIComponent(val)).join(',')
}

export const ensureAppPermissions = async (app, options = {}) => {
  if (!app) return
  const moduleKey = options.moduleKey || resolveAppAclModule(app, options.config, options.appId)
  if (!moduleKey) return
  const roles = Array.isArray(options.roles) ? options.roles : ['super_admin']
  const payload = buildPermissionPayload(app, moduleKey, roles)
  if (!payload.length) return
  try {
    await request({
      url: '/rpc/upsert_permissions',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { payload }
    })
  } catch (e) {
    // ignore to avoid blocking UI
  }
}

export const cleanupAppPermissions = async (moduleKey) => {
  if (!moduleKey) return
  try {
    const codes = buildPermissionCodes(moduleKey)
    const inFilter = buildInFilter(codes)
    if (inFilter) {
      await request({
        url: `/permissions?code=in.(${inFilter})`,
        method: 'delete',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
      })
    }
  } catch (e) {
    // ignore permission cleanup errors
  }
  try {
    await request({
      url: `/sys_field_acl?module=eq.${encodeURIComponent(moduleKey)}`,
      method: 'delete',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
  } catch (e) {
    // ignore field acl cleanup errors
  }
}
