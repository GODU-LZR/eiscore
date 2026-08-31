// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
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

export function createAssistantModeHistory({
  storageKey,
  modes,
  maxSessions = 20,
  maxMessages = 50,
  storage
} = {}) {
  const key = String(storageKey || '').trim()
  if (!key) throw new TypeError('Assistant mode history storageKey is required')
  const modeKeys = Array.from(new Set(
    (Array.isArray(modes) ? modes : []).map((mode) => String(mode || '').trim()).filter(Boolean)
  ))
  if (modeKeys.length === 0) throw new TypeError('Assistant mode history modes are required')
  const sessionLimit = Math.max(0, Number(maxSessions) || 0)
  const messageLimit = Math.max(0, Number(maxMessages) || 0)
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const emptyMode = () => ({ sessions: [], currentSessionId: null })

  const load = () => {
    const data = safeStorage.getJson(key, null)
    const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
    return Object.fromEntries(modeKeys.map((mode) => {
      const value = source[mode]
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [mode, emptyMode()]
      return [mode, {
        sessions: Array.isArray(value.sessions) ? value.sessions : [],
        currentSessionId: value.currentSessionId || null
      }]
    }))
  }

  const saveMode = (collection, mode, sessions, currentSessionId) => {
    const modeKey = String(mode || '').trim()
    if (!modeKeys.includes(modeKey)) throw new TypeError(`Unsupported assistant history mode: ${modeKey}`)
    const source = collection && typeof collection === 'object' && !Array.isArray(collection)
      ? collection
      : load()
    const next = {
      ...source,
      [modeKey]: {
        sessions: (Array.isArray(sessions) ? sessions : []).slice(0, sessionLimit).map((session) => ({
          ...session,
          messages: (Array.isArray(session?.messages) ? session.messages : []).slice(-messageLimit)
        })),
        currentSessionId: currentSessionId || null
      }
    }
    safeStorage.setJson(key, next)
    return next
  }

  return Object.freeze({ load, saveMode })
}
