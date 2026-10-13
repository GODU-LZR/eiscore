// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

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
