// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createAssistantHistory({
  storageKey,
  maxSessions = 10,
  maxMessages = 40,
  transformMessage = (message) => message,
  storage
} = {}) {
  const key = String(storageKey || '').trim()
  if (!key) throw new TypeError('Assistant history storageKey is required')
  if (typeof transformMessage !== 'function') throw new TypeError('Assistant history transformMessage must be a function')
  const sessionLimit = Math.max(0, Number(maxSessions) || 0)
  const messageLimit = Math.max(0, Number(maxMessages) || 0)
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const load = () => {
    const data = safeStorage.getJson(key, null)
    if (!data || !Array.isArray(data.sessions)) return null
    const sessions = data.sessions.slice(0, sessionLimit)
    return {
      sessions,
      currentSessionId: data.currentSessionId || sessions[0]?.id || null
    }
  }

  const save = (sessions, currentSessionId) => {
    try {
      const source = Array.isArray(sessions) ? sessions : []
      const data = {
        sessions: source.slice(0, sessionLimit).map((session) => ({
          ...session,
          messages: (Array.isArray(session?.messages) ? session.messages : [])
            .slice(-messageLimit)
            .map(transformMessage)
        })),
        currentSessionId: currentSessionId || null
      }
      safeStorage.setJson(key, data)
      return data
    } catch {
      return null
    }
  }

  return Object.freeze({ load, save })
}
