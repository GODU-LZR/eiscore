window.__ModuleLoader__.load({
  id: '@eiscore/dsh-client-business-entry',
  factory: () => ({
    inject: ['sessions', 'workspaces', 'conversation', 'uiWorkspace'],
    apply(ctx) {
      // A service extension only: the native workspace, session and composer own their UI/state.
      if (location.pathname.startsWith('/harness-flash-embed/')) return
      const nativeFetch = window.fetch
      const root = document.documentElement.dataset
      const roles = new Map()
      const selected = new Map()
      let owner = ''
      let workspaceId = ''
      let currentRequest
      let creatingEntry = ''
      let generation = 0
      let disposed = false
      let switching = false
      let tail = Promise.resolve()
      let observedSession
      const validEntry = (value) => value === 'worker' || value === 'workbench'
      const pause = (state = 'switching') => {
        root.eisHarnessEntryReady = 'false'
        root.eisHarnessEntryState = state
        window.dispatchEvent(new Event('eiscore:harness-entry-applied'))
      }
      const reply = (request, status) => {
        if (disposed || request !== currentRequest || window.parent === window) return
        window.parent.postMessage({ type: 'eiscore:harness-entry-result', version: 1, entry: request.entry, id: request.id, status }, location.origin)
      }
      const active = (request, version) => !disposed && request === currentRequest && generation === version
      const metadata = async () => {
        const path = location.pathname.startsWith('/harness-embed/') ? '/harness-embed-api/eiscore/business/context' : '/api/eiscore/business/context'
        const response = await nativeFetch.call(window, new URL(path, location.origin), { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) })
        if (!response.ok) throw new Error('business context unavailable')
        const value = await response.json()
        if (!value.owner || !value.workspaceId || !value.sessions || typeof value.sessions !== 'object') throw new Error('invalid business context')
        if (owner !== value.owner) { selected.clear(); roles.clear() }
        owner = value.owner
        workspaceId = value.workspaceId
        roles.clear()
        for (const [id, entry] of Object.entries(value.sessions)) if (validEntry(entry)) roles.set(id, entry)
        root.eisHarnessWorkspaceId = workspaceId
      }
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
      const composerReady = async (id, request, version) => {
        // The selection store updates before React commits the new session's editor.
        // Wait for native history open, the scoped input facade, and two rendered frames.
        for (let attempt = 0; attempt < 120; attempt++) {
          if (!active(request, version) || ctx.sessions.list.getSnapshot().current !== id) return false
          const binding = ctx.sessions.binding(id)
          const input = binding && ctx.conversation.input.for(binding.ctx)
          const editor = document.querySelector('[data-composer-input][contenteditable="true"]')
          if (binding?.session.getSnapshot().openState === 'open' && input && editor) {
            await frame(); await frame()
            if (!active(request, version) || ctx.sessions.list.getSnapshot().current !== id) return false
            const currentEditor = document.querySelector('[data-composer-input][contenteditable="true"]')
            const draft = input.state.getSnapshot().draft
            if (currentEditor && currentEditor.innerText.replace(/\r\n/g, '\n').replace(/\n$/, '') === draft.replace(/\n$/, '')) return true
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return false
      }
      const finish = async (id, request, version) => {
        if (!await composerReady(id, request, version)) throw new Error('native composer not ready')
        if (!active(request, version)) return
        selected.set(request.entry, id)
        root.eisHarnessEntry = request.entry
        root.eisHarnessEntrySession = id
        root.eisHarnessHistoryRole = request.entry
        root.eisHarnessEntryState = 'ready'
        root.eisHarnessEntryReady = 'true'
        window.dispatchEvent(new Event('eiscore:harness-entry-applied'))
        reply(request, 'applied')
      }
      const create = async (entry) => {
        creatingEntry = entry
        try {
          const id = await ctx.sessions.create({ workspaceId })
          roles.set(id, entry)
          return id
        } finally { creatingEntry = '' }
      }
      const choose = async (request, version, fresh = false) => {
        if (!active(request, version)) return
        switching = true
        try {
          await metadata()
          if (!active(request, version)) return
          for (let attempt = 0; ctx.sessions.list.getSnapshot().phase !== 'ready' || ctx.workspaces.list.getSnapshot().phase !== 'ready'; attempt++) {
            if (!active(request, version)) return
            if (attempt >= 150) throw new Error('native workspace not ready')
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
          if (!ctx.workspaces.list.getSnapshot().items.some((workspace) => workspace.workspaceId === workspaceId)) throw new Error('business workspace unavailable')
          // Never reuse the native workspace's arbitrary blank session across roles.
          const list = ctx.sessions.list.getSnapshot()
          const archived = new Set(ctx.workspaces.list.getSnapshot().archivedSessionIds || [])
          const available = (id) => list.byId[id] && !archived.has(id) && roles.get(id) === request.entry
          const preferred = selected.get(request.entry)
          let id = !fresh && available(preferred) ? preferred : undefined
          if (!fresh && !id) id = list.ids.filter(available).sort((a, b) => (list.byId[b]?.updatedAt || 0) - (list.byId[a]?.updatedAt || 0))[0]
          if (!id) id = await create(request.entry)
          if (!active(request, version)) return
          ctx.sessions.open(id)
          observedSession = id
          await finish(id, request, version)
        } catch {
          if (active(request, version)) { pause('failed'); reply(request, 'failed') }
        } finally { switching = false }
      }
      const schedule = (request, fresh = false) => {
        const version = ++generation
        pause()
        tail = tail.catch(() => {}).then(() => choose(request, version, fresh))
      }
      const onMessage = (event) => {
        const value = event.data
        if (event.origin !== location.origin || event.source !== window.parent || window.parent === window || !value || Object.keys(value).some((key) => !['type', 'version', 'entry', 'id'].includes(key)) || value.type !== 'eiscore:harness-entry' || value.version !== 1 || !validEntry(value.entry) || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 128) return
        if (currentRequest?.id === value.id && currentRequest.entry === value.entry) {
          if (root.eisHarnessEntryReady === 'true') reply(currentRequest, 'applied')
          else if (root.eisHarnessEntryState === 'failed') schedule(currentRequest)
          return
        }
        currentRequest = { id: value.id, entry: value.entry }
        schedule(currentRequest)
      }
      const wrappedFetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input, location.origin)
        if (url.origin !== location.origin || !/^\/(?:api|harness-embed-api)\/session\/(create|prompt)$/.test(url.pathname)) return nativeFetch.call(window, input, init)
        const request = new Request(input instanceof Request ? input : url, init)
        if (request.method !== 'POST') return nativeFetch.call(window, input, init)
        const body = await request.clone().text()
        let message
        try { message = JSON.parse(body) } catch { return nativeFetch.call(window, input, init) }
        const sessionId = message?.payload?.args?.request?.sessionId
        const entry = url.pathname.endsWith('/create') ? creatingEntry || currentRequest?.entry : roles.get(sessionId)
        const headers = new Headers(request.headers)
        headers.delete('x-eis-business-entry')
        if (entry) headers.set('x-eis-business-entry', entry)
        // Preserve native prompts to legacy/history sessions; only host draft delivery is gated.
        const response = await nativeFetch.call(window, url, { method: request.method, headers, body, credentials: request.credentials, signal: request.signal })
        if (entry && url.pathname.endsWith('/create') && response.ok) {
          const result = await response.clone().json()
          const id = result.result?.ok && result.result.value?.sessionId
          if (id) roles.set(id, entry)
        }
        return response
      }
      window.fetch = wrappedFetch
      const workspaceService = ctx.uiWorkspace
      const previousStartDescriptor = Object.getOwnPropertyDescriptor(workspaceService, 'startSession')
      const nativeStart = workspaceService.startSession
      const startSession = function (...args) {
        if (!currentRequest) return nativeStart.apply(workspaceService, args)
        schedule(currentRequest, true)
      }
      Object.defineProperty(workspaceService, 'startSession', { configurable: true, writable: true, value: startSession })
      const unsubscribe = ctx.sessions.list.subscribe(() => {
        const id = ctx.sessions.list.getSnapshot().current
        if (id === observedSession) return
        observedSession = id
        if (!currentRequest || switching) return
        const request = currentRequest
        const version = ++generation
        pause()
        root.eisHarnessHistoryRole = roles.get(id) || 'legacy'
        if (roles.get(id) !== request.entry) { pause('failed'); reply(request, 'failed'); return }
        tail = tail.catch(() => {}).then(() => finish(id, request, version)).catch(() => { if (active(request, version)) { pause('failed'); reply(request, 'failed') } })
      })
      window.addEventListener('message', onMessage)
      pause()
      if (window.parent !== window) window.parent.postMessage({ type: 'eiscore:harness-entry-ready', version: 1 }, location.origin)
      ctx.on('dispose', () => {
        disposed = true; generation++; pause()
        unsubscribe()
        window.removeEventListener('message', onMessage)
        if (window.fetch === wrappedFetch) window.fetch = nativeFetch
        if (previousStartDescriptor) Object.defineProperty(workspaceService, 'startSession', previousStartDescriptor)
        else delete workspaceService.startSession
      })
    }
  })
})
