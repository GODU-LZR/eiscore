// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const CHANGE_EVENTS = new Set([
  'flash:draft-changed',
  'flash:draft-write-complete',
  'flash:task-complete'
])

export const isTrustedFlashHarnessMessage = (event, {
  origin,
  frameWindow,
  appId,
  sessionId
} = {}) => {
  if (!event || event.origin !== origin || event.source !== frameWindow) return false
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  return data.source === 'eiscore'
    && String(data.appId || '') === String(appId || '')
    && String(data.sessionId || '') === String(sessionId || '')
}

export const isFlashHarnessChangeMessage = (data) => {
  return !!data && typeof data === 'object'
    && CHANGE_EVENTS.has(String(data.type || ''))
    && data.ok !== false
}

export const getFlashHarnessEventKey = (data) => {
  const requestId = String(data?.requestId || data?.traceId || '').trim()
  if (!requestId || !CHANGE_EVENTS.has(String(data?.type || ''))) return ''
  return `${data.type}:${requestId}`
}
