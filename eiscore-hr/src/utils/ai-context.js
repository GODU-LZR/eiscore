const getBaseActions = () => {
  if (typeof window === 'undefined') return null
  return window.__EIS_BASE_ACTIONS__ || null
}

const dispatchBaseEvent = (name, detail) => {
  if (typeof window === 'undefined') return
  try {
    const event = new CustomEvent(name, { detail })
    window.dispatchEvent(event)
  } catch (e) {
    // ignore event failures
  }
}

export const pushAiContext = (context) => {
  if (!context) return
  const actions = getBaseActions()
  if (actions && typeof actions.setGlobalState === 'function') {
    actions.setGlobalState({ context })
  }
  dispatchBaseEvent('eis-ai-context', context)
}

export const pushAiCommand = (command) => {
  if (!command) return
  const actions = getBaseActions()
  if (actions && typeof actions.setGlobalState === 'function') {
    actions.setGlobalState({ command })
  }
  dispatchBaseEvent('eis-ai-command', command)
}
