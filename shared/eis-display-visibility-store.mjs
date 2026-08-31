// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const DISPLAY_VISIBILITY_STORAGE_KEY = 'eis_display_visibility_v1'

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

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createDisplayVisibilityStore({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const getVisibility = () => normalizeDisplayVisibility(
    safeStorage.getJson(DISPLAY_VISIBILITY_STORAGE_KEY, defaultDisplayVisibility())
  )

  const saveVisibility = (visibility) => {
    const normalized = normalizeDisplayVisibility(visibility)
    safeStorage.setJson(DISPLAY_VISIBILITY_STORAGE_KEY, normalized)
    return normalized
  }

  return Object.freeze({ getVisibility, saveVisibility })
}

const displayVisibilityStore = createDisplayVisibilityStore()

export const readStoredDisplayVisibility = displayVisibilityStore.getVisibility
export const persistDisplayVisibility = displayVisibilityStore.saveVisibility
