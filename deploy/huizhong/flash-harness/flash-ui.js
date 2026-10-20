(() => {
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
    const target = input instanceof Request ? input.url : String(input)
    const path = new URL(target, location.href).pathname
    if (/(?:\/api\/|\/harness-flash-embed-api\/)session\/(?:create|prompt)$/.test(path)) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
      headers.set('x-eis-flash-app-id', appId)
      headers.set('x-eis-flash-session-id', sessionId)
      init = { ...init, headers }
    }
    return nativeFetch.call(window, input, init)
  }
})()
