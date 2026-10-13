// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const defaultFetch = (...args) => globalThis.fetch(...args)

const assertHarnessPath = (path) => {
  if (typeof path !== 'string' || !/^\/(?:ai|twin)\//.test(path)) {
    throw new TypeError('Harness SSE path must start with /ai/ or /twin/')
  }
}

export const createAgentSseClient = ({ fetchImpl = defaultFetch } = {}) => {
  const streamAgentEvents = async ({
    path,
    headers,
    payload,
    signal,
    trimLines = false,
    missingBodyMessage = '',
    onResponse,
    onOpen,
    onData
  }) => {
    assertHarnessPath(path)
    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }
    if (signal) options.signal = signal

    const response = await fetchImpl(path, options)
    if (onResponse) await onResponse(response)
    if (!response.body && missingBodyMessage) throw new Error(missingBodyMessage)

    const reader = response.body.getReader()
    if (onOpen) onOpen(response)
    const decoder = new TextDecoder()
    let buffer = ''
    const consumeLine = (line) => {
      const candidate = trimLines ? line.trim() : line
      if (!candidate || !candidate.startsWith('data:')) return false
      const data = candidate.slice(5).trim()
      if (data === '[DONE]') return true
      if (data && onData) onData(data)
      return false
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        if (done) {
          consumeLine(buffer)
          break
        }

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!consumeLine(line)) continue
          // Completion is terminal even if the server keeps the connection open.
          try { await reader.cancel?.() } catch {}
          return
        }
      }
    } finally {
      reader.releaseLock?.()
    }
  }

  return { streamAgentEvents }
}

const defaultClient = createAgentSseClient()

export const streamAgentEvents = (options) => defaultClient.streamAgentEvents(options)
