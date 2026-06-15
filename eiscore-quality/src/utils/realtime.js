// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const DEFAULT_PORT = 8078
const DEFAULT_PATH = '/ws'
const PROXY_WS_PATH = '/agent/ws'

let client = null

const getAuthToken = () => {
  const tokenStr = localStorage.getItem('auth_token')
  if (!tokenStr) return ''
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed?.token) return parsed.token
  } catch {
    // ignore
  }
  return tokenStr
}

const createClient = () => {
  const listeners = new Set()
  let socket = null
  let retryTimer = null
  let closed = false

  const buildUrl = () => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.hostname || 'localhost'
    const port = window.location.port ? `:${window.location.port}` : ''
    if (window.location.protocol === 'https:' || window.location.hostname !== 'localhost') {
      return `${proto}://${host}${port}${PROXY_WS_PATH}`
    }
    return `${proto}://${host}:${DEFAULT_PORT}${DEFAULT_PATH}`
  }

  const notify = (payload) => {
    listeners.forEach((fn) => {
      try {
        fn(payload)
      } catch {
        // ignore listener errors
      }
    })
  }

  const scheduleReconnect = () => {
    if (closed || retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, 1000)
  }

  const connect = () => {
    if (closed || socket) return
    try {
      const token = getAuthToken()
      socket = token ? new WebSocket(buildUrl(), ['bearer', token]) : new WebSocket(buildUrl())
    } catch {
      scheduleReconnect()
      return
    }
    socket.addEventListener('message', (event) => {
      if (!event?.data) return
      try {
        notify(JSON.parse(event.data))
      } catch {
        // ignore invalid payload
      }
    })
    const handleClose = () => {
      socket = null
      scheduleReconnect()
    }
    socket.addEventListener('close', handleClose)
    socket.addEventListener('error', handleClose)
  }

  const subscribe = (fn) => {
    if (typeof fn !== 'function') return () => {}
    listeners.add(fn)
    connect()
    return () => listeners.delete(fn)
  }

  return { subscribe }
}

export const getRealtimeClient = () => {
  if (!client) client = createClient()
  return client
}
