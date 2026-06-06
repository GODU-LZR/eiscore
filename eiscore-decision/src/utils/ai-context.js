// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const getBaseActions = () => {
  if (typeof window === 'undefined') return null
  return window.__EIS_BASE_ACTIONS__ || null
}

const dispatchBaseEvent = (name, detail) => {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  } catch (e) {}
}

export const pushAiContext = (context) => {
  if (!context) return
  const actions = getBaseActions()
  if (actions && typeof actions.setGlobalState === 'function') {
    actions.setGlobalState({ context })
  }
  dispatchBaseEvent('eis-ai-context', context)
}
