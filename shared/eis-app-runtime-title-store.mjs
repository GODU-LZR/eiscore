// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const APP_RUNTIME_TITLE_STORAGE_KEY = 'eis_app_runtime_title_map_v1'

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createAppRuntimeTitleStore({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const readMap = () => {
    const value = safeStorage.getJson(APP_RUNTIME_TITLE_STORAGE_KEY, {})
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  }

  const rememberTitle = (appId, title) => {
    const key = String(appId || '').trim()
    const text = String(title || '').trim()
    if (!key || !text) return false
    return safeStorage.setJson(APP_RUNTIME_TITLE_STORAGE_KEY, {
      ...readMap(),
      [key]: text
    })
  }

  const getTitle = (appId) => {
    const key = String(appId || '').trim()
    if (!key) return ''
    return String(readMap()[key] || '').trim()
  }

  return Object.freeze({ rememberTitle, getTitle })
}

const appRuntimeTitleStore = createAppRuntimeTitleStore()

export const rememberAppRuntimeTitle = appRuntimeTitleStore.rememberTitle
export const getAppRuntimeTitle = appRuntimeTitleStore.getTitle
