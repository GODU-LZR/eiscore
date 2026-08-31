// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const GUIDE_PROGRESS_VERSION = 'v1'
export const GUIDE_PROGRESS_STORAGE_PREFIX = `eis_guide_progress_${GUIDE_PROGRESS_VERSION}`
export const GUIDE_WELCOME_STORAGE_PREFIX = `eis_guide_welcome_${GUIDE_PROGRESS_VERSION}`

const normalizeUserKey = (userKey) => String(userKey || 'guest').toLowerCase()

export const buildGuideProgressStorageKey = (userKey) => (
  `${GUIDE_PROGRESS_STORAGE_PREFIX}_${normalizeUserKey(userKey)}`
)

export const buildGuideWelcomeStorageKey = (userKey) => (
  `${GUIDE_WELCOME_STORAGE_PREFIX}_${normalizeUserKey(userKey)}`
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

export function createGuideProgressStore({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const loadProgress = (userKey) => {
    const value = safeStorage.getJson(buildGuideProgressStorageKey(userKey), {})
    return value && typeof value === 'object' ? value : {}
  }

  const saveProgress = (userKey, progress) => safeStorage.setJson(
    buildGuideProgressStorageKey(userKey),
    progress && typeof progress === 'object' ? progress : {}
  )

  const markWelcomeSeen = (userKey) => safeStorage.setText(buildGuideWelcomeStorageKey(userKey), '1')
  const hasSeenWelcome = (userKey) => safeStorage.getText(buildGuideWelcomeStorageKey(userKey)) === '1'

  return Object.freeze({ loadProgress, saveProgress, markWelcomeSeen, hasSeenWelcome })
}

const guideProgressStore = createGuideProgressStore()

export const readGuideProgress = guideProgressStore.loadProgress
export const writeGuideProgress = guideProgressStore.saveProgress
export const markGuideWelcomeSeen = guideProgressStore.markWelcomeSeen
export const hasSeenGuideWelcome = guideProgressStore.hasSeenWelcome
