// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const REMEMBERED_USERNAME_STORAGE_KEY = 'mobile_remembered_user'

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createRememberedUsernameStore({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const getUsername = () => safeStorage.getText(REMEMBERED_USERNAME_STORAGE_KEY) || ''
  const rememberUsername = (username) => safeStorage.setText(
    REMEMBERED_USERNAME_STORAGE_KEY,
    String(username ?? '')
  )
  const forgetUsername = () => safeStorage.remove(REMEMBERED_USERNAME_STORAGE_KEY)

  return Object.freeze({ getUsername, rememberUsername, forgetUsername })
}

const rememberedUsernameStore = createRememberedUsernameStore()

export const getRememberedUsername = rememberedUsernameStore.getUsername
export const rememberUsername = rememberedUsernameStore.rememberUsername
export const forgetRememberedUsername = rememberedUsernameStore.forgetUsername
