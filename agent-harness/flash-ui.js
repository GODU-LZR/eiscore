// Adapted from the registered Flash UI in 0d4ca935/da8cdf72.
(() => {
  const commandStyle = document.createElement('style')
  commandStyle.textContent = '[data-composer-card] button[aria-haspopup="listbox"][aria-label="指令"], [data-composer-card] button[aria-haspopup="listbox"][aria-label="Commands"] { display: none !important; }'
  document.head.append(commandStyle)
  const NativeEventSource = window.EventSource
  window.EventSource = class extends NativeEventSource {
    constructor(input, options) {
      const target = new URL(input, location.href)
      if (target.origin === location.origin && target.pathname === '/plugins/events') target.pathname = '/harness-flash-embed-plugins/events'
      super(target.href, options)
    }
  }
  const params = new URLSearchParams(location.search)
  let appId = params.get('eiscoreAppId') || ''
  let sessionId = params.get('eiscoreSessionId') || ''
  addEventListener('message', (event) => {
    const value = event.data
    if (event.source !== parent || event.origin !== location.origin || value?.source !== 'eiscore-flash-builder' || value?.type !== 'flash:context') return
    appId = String(value.appId || '')
    sessionId = String(value.sessionId || '')
  })
  const nativeFetch = window.fetch
  window.fetch = (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input), location.href)
    if (target.origin === location.origin && /(?:\/api\/|\/harness-flash-embed-api\/)session\/(?:create|prompt)$/.test(target.pathname)) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
      headers.set('x-eis-flash-app-id', appId)
      headers.set('x-eis-flash-session-id', sessionId)
      if (input instanceof Request && target.pathname.startsWith('/api/')) {
        target.pathname = `/harness-flash-embed-api/${target.pathname.slice(5)}`
        input = new Request(target, input)
      }
      // The server proxy awaits both ownership and app registration before it
      // forwards this request. No separate browser binding request can race it.
      init = { ...init, headers }
    }
    return nativeFetch.call(window, input, init)
  }
  if (parent !== window) parent.postMessage({ source: 'eiscore', type: 'flash:harness:ready', appId, sessionId }, location.origin)
})()
