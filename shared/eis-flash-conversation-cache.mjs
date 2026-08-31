// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const FLASH_CONVERSATION_STORAGE_PREFIX = 'flash_shell_conversations:'

export const buildFlashConversationStorageKey = (appId) => (
  `${FLASH_CONVERSATION_STORAGE_PREFIX}${String(appId || 'default')}`
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

export function createFlashConversationCache({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const loadConversations = (appId) => {
    const value = safeStorage.getJson(buildFlashConversationStorageKey(appId), [])
    return Array.isArray(value) ? value : []
  }

  const saveConversations = (appId, conversations) => safeStorage.setJson(
    buildFlashConversationStorageKey(appId),
    Array.isArray(conversations) ? conversations : []
  )

  return Object.freeze({ loadConversations, saveConversations })
}

const flashConversationCache = createFlashConversationCache()

export const loadFlashConversations = flashConversationCache.loadConversations
export const saveFlashConversations = flashConversationCache.saveConversations
