// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const HOST_TABS_STORAGE_KEY = 'eis_host_nav_tabs_v1'

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createHostTabsStore({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const loadTabs = () => {
    const value = safeStorage.getJson(HOST_TABS_STORAGE_KEY, [])
    return Array.isArray(value) ? value : []
  }

  const saveTabs = (tabs) => safeStorage.setJson(
    HOST_TABS_STORAGE_KEY,
    Array.isArray(tabs) ? tabs : []
  )

  return Object.freeze({ loadTabs, saveTabs })
}

const hostTabsStore = createHostTabsStore()

export const readHostTabs = hostTabsStore.loadTabs
export const writeHostTabs = hostTabsStore.saveTabs
