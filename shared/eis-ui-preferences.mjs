// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const AI_WORKER_FULLSCREEN_STORAGE_KEY = 'eis_ai_worker_fullscreen'
export const USER_THEME_STORAGE_PREFIX = 'eis_theme_'

export const buildUserThemeStorageKey = (identity) => (
  `${USER_THEME_STORAGE_PREFIX}${String(identity || 'guest').toLowerCase()}`
)

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createUiPreferenceStore({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const getWorkerFullscreen = () => safeStorage.getText(AI_WORKER_FULLSCREEN_STORAGE_KEY) === '1'
  const saveWorkerFullscreen = (fullscreen) => safeStorage.setText(
    AI_WORKER_FULLSCREEN_STORAGE_KEY,
    fullscreen ? '1' : '0'
  )

  const getUserTheme = (identity) => {
    const value = safeStorage.getText(buildUserThemeStorageKey(identity))
    if (value === 'dark' || value === '1' || value === 'true') return 'dark'
    if (value === 'light' || value === '0' || value === 'false') return 'light'
    return null
  }

  const saveUserTheme = (identity, dark) => safeStorage.setText(
    buildUserThemeStorageKey(identity),
    dark ? 'dark' : 'light'
  )

  return Object.freeze({
    getWorkerFullscreen,
    saveWorkerFullscreen,
    getUserTheme,
    saveUserTheme
  })
}

const uiPreferenceStore = createUiPreferenceStore()

export const getWorkerFullscreen = uiPreferenceStore.getWorkerFullscreen
export const saveWorkerFullscreen = uiPreferenceStore.saveWorkerFullscreen
export const getUserTheme = uiPreferenceStore.getUserTheme
export const saveUserTheme = uiPreferenceStore.saveUserTheme
