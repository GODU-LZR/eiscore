// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const defaultFetch = (...args) => globalThis.fetch(...args)

const assertAgentPath = (path) => {
  if (typeof path !== 'string' || !path.startsWith('/agent/')) {
    throw new TypeError('Agent SSE path must start with /agent/')
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
    assertAgentPath(path)
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

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const candidate = trimLines ? line.trim() : line
        if (!candidate || !candidate.startsWith('data:')) continue
        const data = candidate.slice(5).trim()
        if (!data || data === '[DONE]') continue
        if (onData) onData(data)
      }
    }
  }

  return { streamAgentEvents }
}

const defaultClient = createAgentSseClient()

export const streamAgentEvents = (options) => defaultClient.streamAgentEvents(options)
