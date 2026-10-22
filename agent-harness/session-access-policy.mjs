import { AsyncLocalStorage } from 'node:async_hooks'

const SKIP = Symbol('hidden session frame')
const sessionMethods = new Set(['selectModel', 'rename', 'fork', 'prompt', 'attachment', 'updateQueue', 'cancel'])
const readMethods = new Set(['session/list', 'session/search', 'session/modelCatalog', 'settings/describe'])
const denial = (code = 'EISCORE_SESSION_OWNERSHIP_DENIED') => Object.assign(
  new Error(code === 'EISCORE_AUTH_REQUIRED' ? '请先登录 EISCore 工作区' : '当前用户无权访问此 Harness 资源'),
  { isDSHRemoteError: true, code, details: {} }
)
const nativeRequest = (request) => new Request('http://dsh.internal' + (request.url || '/'), {
  headers: Object.fromEntries(Object.entries(request.headers || {}).filter(([, value]) => typeof value === 'string'))
})

// The pinned DSH Gateway has one ingress for unary RPC and Remote streams.
// Keep its transport/envelopes; apply EISCore ownership at that shared seam.
export function installSessionAccessPolicy({ webServer, gateway, bindings, tokenForRequest, defaultWorkspace = process.env.DSH_DEFAULT_WORKSPACE }) {
  // Cordis exposes service proxies; native ingress callbacks retain originals.
  webServer = webServer?.[Symbol.for('cordis.original')] || webServer
  gateway = gateway?.[Symbol.for('cordis.original')] || gateway
  for (const key of ['invoke', 'stream', 'dispatchRpc', 'openWireStream', 'deliverRemoteEvent']) {
    if (typeof gateway?.[key] !== 'function') throw new Error(`Harness session policy requires gateway.${key}`)
  }
  if (!webServer?.exact || !webServer?.prefixes || !webServer?.upgrades || typeof webServer.register !== 'function' || typeof webServer.registerUpgrade !== 'function') {
    throw new Error('Harness session policy requires the native WebServer route registries')
  }
  const scope = new AsyncLocalStorage()
  const clientScopes = new WeakMap()
  const restorations = []
  const workspacePath = String(defaultWorkspace || '').trim()
  if (!workspacePath.startsWith('/')) throw new Error('Harness session policy requires an absolute DSH_DEFAULT_WORKSPACE')
  const token = (context) => {
    const value = context && tokenForRequest(context.request)
    if (!value) throw denial('EISCORE_AUTH_REQUIRED')
    return value
  }
  const owns = (context, id) => bindings.canAccess(id, token(context))
  const requireSession = (context, id) => { if (!owns(context, id)) throw denial() }
  const replace = (target, key, wrap) => {
    const original = target[key]
    const wrapped = wrap(original)
    target[key] = wrapped
    restorations.push(() => { if (target[key] === wrapped) target[key] = original })
  }
  const wrapRoute = (route, upgrade = false) => ({ ...route, handler(request, ...args) {
    const context = { request: nativeRequest(request) }
    if (upgrade) {
      const socket = args[0]
      const emit = socket.emit
      // ws emits later from the carrier socket, outside the upgrade call stack.
      // Re-enter this connection's request scope for each message and close.
      socket.emit = function (...event) { return scope.run(context, () => Reflect.apply(emit, this, event)) }
    }
    return scope.run(context, () => route.handler(request, ...args))
  } })
  for (const table of [webServer.exact, webServer.prefixes, webServer.upgrades]) {
    for (const [path, route] of table) {
      if (path === '/api' || path.startsWith('/api/')) {
        const wrapped = wrapRoute(route, table === webServer.upgrades)
        table.set(path, wrapped)
        restorations.push(() => { if (table.get(path) === wrapped) table.set(path, route) })
      }
    }
  }
  for (const [method, upgrade] of [['register', false], ['registerUpgrade', true]]) {
    replace(webServer, method, (original) => function (route) {
      const secured = route.path === '/api' || route.path.startsWith('/api/') ? wrapRoute(route, upgrade) : route
      return Reflect.apply(original, this, [secured])
    })
  }
  const workspace = (value, context) => value && value.path === workspacePath
    ? { ...value, sessionIds: (value.sessionIds || []).filter((id) => owns(context, id)) }
    : null
  const project = (endpoint, value, context) => {
    token(context)
    if (endpoint === 'session/list' || endpoint === 'session/search') {
      return { ...value, items: (value.items || []).filter((item) => owns(context, item.sessionId)) }
    }
    if (endpoint === 'session/control') {
      if (value.type !== 'baseline') return owns(context, value.sessionId) ? value : SKIP
      return { ...value, value: Object.fromEntries(['queues', 'jobs', 'projections'].map((key) => [
        key, Object.fromEntries(Object.entries(value.value[key] || {}).filter(([id]) => owns(context, id)))
      ])) }
    }
    if (endpoint === 'workspace/create') return { ...value, workspace: workspace(value.workspace, context) }
    if (endpoint === 'workspace/archiveSession') return { ...value, archivedSessionIds: (value.archivedSessionIds || []).filter((id) => owns(context, id)) }
    if (endpoint === 'workspace/follow') {
      if (value.type === 'baseline') return { ...value, value: {
        items: (value.value.items || []).map((item) => workspace(item, context)).filter(Boolean),
        archivedSessionIds: (value.value.archivedSessionIds || []).filter((id) => owns(context, id))
      } }
      if (value.type === 'upsert') {
        const item = workspace(value.workspace, context)
        return item ? { ...value, workspace: item } : SKIP
      }
      if (value.type === 'archived') return { ...value, archivedSessionIds: (value.archivedSessionIds || []).filter((id) => owns(context, id)) }
      // The deployed profile exposes one fixed workspace; global order/removal
      // changes from administrative clients must not disclose other workspaces.
      return SKIP
    }
    return value
  }
  const authorize = (endpoint, args, context, streaming = false) => {
    token(context)
    const request = args?.request || {}
    if (streaming) {
      if (endpoint === 'session/control' || endpoint === 'workspace/follow') return
      if (endpoint === 'session/follow' && request.address?.kind === 'session') return requireSession(context, request.address.sessionId)
      throw denial()
    }
    if (readMethods.has(endpoint)) return
    if (endpoint === 'session/canOpenWorkspacePath' || endpoint === 'settings/canOpenAgentPresetDirectory') return false
    if (endpoint === 'session/create') {
      if (request.sessionId !== undefined) requireSession(context, request.sessionId)
      if (request.cwd !== undefined && request.cwd !== workspacePath) throw denial()
      if (request.workspaceId !== undefined) {
        const registry = gateway.ctx?.get ? gateway.ctx.get('workspaceRegistry') : gateway.ctx?.workspaceRegistry
        const item = registry?.get(request.workspaceId)
        if (item?.path !== workspacePath) throw denial()
      }
      if (request.agentPreset !== undefined) throw denial()
      return
    }
    if (endpoint.startsWith('session/') && sessionMethods.has(endpoint.slice(8))) return requireSession(context, request.sessionId)
    if (endpoint === 'session/page' && request.address?.kind === 'session') return requireSession(context, request.address.sessionId)
    if (endpoint === 'workspace/create' && request.path === workspacePath) return
    if (endpoint === 'workspace/archiveSession') return requireSession(context, request.sessionId)
    throw denial()
  }
  const scopedStream = (source, endpoint, context) => ({
    async *[Symbol.asyncIterator]() {
      const iterator = source[Symbol.asyncIterator]?.() || source[Symbol.iterator]()
      try {
        while (true) {
          token(context)
          const next = await scope.run(context, () => iterator.next())
          if (next.done) return
          const value = project(endpoint, next.value, context)
          if (value !== SKIP) yield value
        }
      } finally { await scope.run(context, () => iterator.return?.()) }
    }
  })
  replace(gateway, 'invoke', (original) => async function (request) {
    const context = scope.getStore()
    const endpoint = `${request.namespace}/${request.method}`
    if (authorize(endpoint, request.args, context) === false) return false
    const value = await Reflect.apply(original, this, [request])
    if (endpoint === 'session/create' || endpoint === 'session/fork') {
      if (!bindings.claim(value?.sessionId, token(context))) throw denial()
    }
    return project(endpoint, value, context)
  })
  replace(gateway, 'stream', (original) => async function (request) {
    const context = scope.getStore()
    const endpoint = `${request.namespace}/${request.method}`
    authorize(endpoint, request.args, context, true)
    return scopedStream(await Reflect.apply(original, this, [request]), endpoint, context)
  })
  replace(gateway, 'dispatchRpc', (original) => async function (endpoint, payload, signal) {
    if (endpoint === '$events/result') {
      const context = scope.getStore()
      const client = this.remoteEventClients.get(payload?.args?.clientId)
      const clientContext = client && clientScopes.get(client)
      const pending = this.pendingRemoteEvents.get(payload?.args?.eventId)
      if (!clientContext || token(context) !== token(clientContext) || !owns(context, pending?.frame?.agentId)) {
        const error = denial()
        return { ok: false, error: { code: error.code, message: error.message, details: {} } }
      }
    }
    return Reflect.apply(original, this, [endpoint, payload, signal])
  })
  replace(gateway, 'openWireStream', (original) => async function (endpoint, payload, signal) {
    if (endpoint !== '$events') return Reflect.apply(original, this, [endpoint, payload, signal])
    const context = scope.getStore()
    token(context)
    const source = await Reflect.apply(original, this, [endpoint, payload, signal])
    return {
      async *[Symbol.asyncIterator]() {
        const iterator = source[Symbol.asyncIterator]()
        try {
          while (true) {
            token(context)
            const next = await scope.run(context, () => iterator.next())
            if (next.done) return
            token(context)
            const frame = next.value
            if (frame.type === 'ready') {
              const client = gateway.remoteEventClients.get(frame.clientId)
              if (client) clientScopes.set(client, context)
              yield { ...frame, host: { home: workspacePath } }
            } else if (frame.type === 'waterfall' || frame.type === 'cancel') yield frame
            else if (frame.type === 'emit' && /^api-session\/(added|removed|status|error|activity)$/.test(frame.event)) {
              const id = frame.event === 'api-session/added' ? frame.args?.[0]?.sessionId : frame.args?.[0]
              if (owns(context, id)) yield frame
            }
          }
        } finally { await scope.run(context, () => iterator.return?.()) }
      }
    }
  })
  replace(gateway, 'deliverRemoteEvent', (original) => function (pending, client) {
    const context = clientScopes.get(client) || scope.getStore()
    if (context) clientScopes.set(client, context)
    try {
      if (context && owns(context, pending.frame.agentId)) return Reflect.apply(original, this, [pending, client])
    } catch { /* Expired/logged-out clients receive no scoped events. */ }
  })
  return () => { for (const restore of restorations.reverse()) restore() }
}
