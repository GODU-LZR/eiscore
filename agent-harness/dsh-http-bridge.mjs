import http from 'node:http'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, lstatSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { createBridgeHandler, PROTOCOL } = require('./http-bridge.js')
const { loadPluginRegistry } = require('./plugin-registry.js')

const DEFAULT_PLUGINS = Object.freeze([
  'enterprise-bi', 'worker-grid', 'digital-twin', 'workflow', 'company-sales',
  'document-intake', 'flash-builder', 'engineering', 'independent-site-sales'
])
const REGISTERED_PLUGIN_IDS = new Set(loadPluginRegistry().list().map(({ plugin_id }) => plugin_id))
const MAX_TIMER_MS = 2_147_483_647
const positiveInt = (name, value) => {
  const raw = String(value)
  if (!/^[1-9][0-9]*$/.test(raw) || Number(raw) > MAX_TIMER_MS) {
    throw new Error(`${name} must be a positive integer no greater than ${MAX_TIMER_MS}`)
  }
  return Number(raw)
}
const envInt = (env, name, fallback) => {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  return positiveInt(name, raw)
}

const regularFile = (path) => {
  try { return lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink() } catch { return false }
}
const safeDirectory = (path) => {
  try {
    const stat = lstatSync(path)
    return stat.isDirectory() && !stat.isSymbolicLink()
  } catch {
    return false
  }
}

export const validateBridgeSecrets = ({ bridgeSecret = process.env.EISCORE_HARNESS_BRIDGE_SECRET, toolProxySecret = process.env.EISCORE_TOOL_PROXY_SECRET } = {}) => {
  const bridge = String(bridgeSecret || '')
  const proxy = String(toolProxySecret || '')
  if (bridge.length < 32) throw new Error('EISCORE_HARNESS_BRIDGE_SECRET must be at least 32 characters')
  if (proxy.length < 32) throw new Error('EISCORE_TOOL_PROXY_SECRET must be at least 32 characters')
  if (bridge === proxy) throw new Error('Harness bridge and tool proxy secrets must be independent')
  return Object.freeze({ bridgeSecret: bridge, toolProxySecret: proxy })
}

export const validateHarnessToolArtifacts = ({ root = process.env.DSH_CWD || process.cwd(), patchFile = process.env.DSH_PATCH || '' } = {}) => {
  const base = String(root || '').trim()
  const patch = String(patchFile || '').trim()
  const issues = []
  if (!base || !isAbsolute(base) || !safeDirectory(base)) issues.push('DSH_CWD must be an existing absolute non-symlink directory')
  for (const file of ['eiscore-tools.mjs', 'eiscore-restricted.cordis.yml']) {
    if (!base || !regularFile(join(base, file))) issues.push(`${file} must be a regular file under DSH_CWD`)
  }
  if (patch) {
    const resolvedBase = resolve(base)
    const resolvedPatch = resolve(patch)
    const patchRelative = relative(resolvedBase, resolvedPatch)
    if (!regularFile(patch)) issues.push('DSH_PATCH must be a regular file')
    else if (!patchRelative || patchRelative.startsWith('..') || isAbsolute(patchRelative)) issues.push('DSH_PATCH must stay under DSH_CWD')
  }
  if (issues.length) throw new Error(`Harness tool artifacts unavailable: ${issues.join('; ')}`)
  return Object.freeze({ root: base, patchFile: patch })
}

const textBlock = (value) => ({ type: 'text', text: String(value ?? '') })

const imageBlock = (value) => {
  const match = /^data:image\/(png|jpe?g|webp|gif);base64,([a-z0-9+/=]+)$/i.exec(String(value || ''))
  if (!match) {
    const error = new Error('HTTP image URLs require an attachment resolver; use a data image for the SDK bridge')
    error.code = 'HARNESS_IMAGE_URL_UNSUPPORTED'
    throw error
  }
  const mimeType = match[1].toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${match[1].toLowerCase()}`
  return { type: 'image', data: match[2], mimeType }
}

const contentBlocks = (content) => {
  if (typeof content === 'string') return [textBlock(content)]
  if (!Array.isArray(content)) return []
  return content.flatMap((part) => {
    if (!part || typeof part !== 'object') return []
    if (part.type === 'text' && typeof part.text === 'string') return [textBlock(part.text)]
    if (part.type === 'image_url') return [imageBlock(part.image_url?.url || part.url)]
    return []
  })
}

const requestContentBlocks = (body = {}, pluginId = '') => {
  const messages = Array.isArray(body.messages) ? body.messages : []
  const blocks = [{ type: 'text', text: `[EISCORE_PLUGIN:${pluginId}]` }]
  for (const message of messages) {
    const role = message?.role === 'assistant' ? 'assistant' : 'user'
    const content = contentBlocks(message?.content)
    if (!content.length) continue
    blocks.push(textBlock(`[${role}]`), ...content)
  }
  if (blocks.length === 1) blocks.push(textBlock('[user]\n'))
  return blocks
}

const assistantText = (params = {}) => {
  const event = params.event
  if (!event || event.type !== 'assistant/message') return ''
  const content = event.data?.message?.content
  return contentBlocks(content).filter((block) => block.type === 'text').map((block) => block.text).join('')
}

class DshSdkProcess {
  constructor(options = {}) {
    const env = options.env || process.env
    const timeoutMs = options.timeoutMs === undefined ? envInt(env, 'BRIDGE_PROMPT_TIMEOUT_MS', 120000) : positiveInt('BRIDGE_PROMPT_TIMEOUT_MS', options.timeoutMs)
    const drainTimeoutMs = options.drainTimeoutMs === undefined ? envInt(env, 'BRIDGE_SESSION_DRAIN_TIMEOUT_MS', timeoutMs) : positiveInt('BRIDGE_SESSION_DRAIN_TIMEOUT_MS', options.drainTimeoutMs)
    const rpcTimeoutMs = options.rpcTimeoutMs === undefined ? envInt(env, 'BRIDGE_RPC_TIMEOUT_MS', timeoutMs) : positiveInt('BRIDGE_RPC_TIMEOUT_MS', options.rpcTimeoutMs)
    const shutdownTimeoutMs = options.shutdownTimeoutMs === undefined ? envInt(env, 'BRIDGE_SHUTDOWN_TIMEOUT_MS', 1000) : positiveInt('BRIDGE_SHUTDOWN_TIMEOUT_MS', options.shutdownTimeoutMs)
    const { command = env.DSH_BIN || '/opt/bridge/node_modules/.bin/dsh', args = [], cwd = env.DSH_CWD || process.cwd(), spawnImpl = spawn } = options
    this.command = command
    this.args = args
    this.cwd = cwd
    this.env = env
    this.spawnImpl = spawnImpl
    this.timeoutMs = timeoutMs
    this.drainTimeoutMs = drainTimeoutMs
    this.rpcTimeoutMs = rpcTimeoutMs
    this.shutdownTimeoutMs = shutdownTimeoutMs
    this.child = null
    this.buffer = ''
    this.nextId = 1
    this.pending = new Map()
    this.waiters = new Map()
    this.sessionBusy = new Set()
    this.sessionIdleWaiters = new Map()
    this.startPromise = null
    this.initialized = false
    this.closed = false
  }

  async start() {
    if (this.initialized) return
    if (this.startPromise) return this.startPromise
    this.startPromise = (async () => {
      this.closed = false
      const windowsJsCommand = process.platform === 'win32' && /\.m?js$/i.test(this.command)
      const command = windowsJsCommand ? process.execPath : this.command
      const args = windowsJsCommand ? [this.command, ...this.args] : this.args
      this.child = this.spawnImpl(command, args, { cwd: this.cwd, env: this.env, stdio: ['pipe', 'pipe', 'pipe'] })
      this.child.stdout.setEncoding('utf8')
      this.child.stdout.on('data', (chunk) => this.#onData(chunk))
      this.child.on('error', (error) => this.#fail(error))
      this.child.on('exit', (code, signal) => this.#fail(Object.assign(new Error(`DeepSeek Harness exited (${code ?? signal ?? 'unknown'})`), { code: 'HARNESS_RUNTIME_EXIT' })))
      const params = {
        cwd: this.cwd,
        provider: this.env.DSH_PROVIDER || 'deepseek-official',
        model: this.env.DSH_MODEL || 'deepseek-chat'
      }
      try {
        await this.request('initialize', params)
        this.initialized = true
      } catch (error) {
        this.#fail(error)
        try { this.child.kill() } catch { /* process already exited */ }
        throw error
      }
    })()
    try {
      await this.startPromise
    } finally {
      if (!this.initialized) this.startPromise = null
    }
  }

  async prompt(sessionId, body, pluginId) {
    await this.start()
    await this.#waitForSessionIdle(sessionId)
    this.sessionBusy.add(sessionId)
    let waiterState
    const waiter = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(sessionId)
        reject(Object.assign(new Error('DeepSeek Harness prompt timed out'), { code: 'HARNESS_PROMPT_TIMEOUT' }))
      }, this.timeoutMs)
      waiterState = { resolve, reject, timer, text: '' }
      this.waiters.set(sessionId, waiterState)
    })
    try {
      await this.request('session/prompt', { sessionId, contentBlocks: requestContentBlocks(body, pluginId) })
    } catch (error) {
      if (this.waiters.get(sessionId) === waiterState) {
        this.waiters.delete(sessionId)
        clearTimeout(waiterState.timer)
        if (error?.code !== 'HARNESS_RUNTIME_RPC_TIMEOUT') this.#markSessionIdle(sessionId)
      }
      throw error
    }
    return waiter
  }

  async #waitForSessionIdle(sessionId) {
    if (!this.sessionBusy.has(sessionId)) return
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.sessionIdleWaiters.get(sessionId) || []
        this.sessionIdleWaiters.set(sessionId, waiters.filter((entry) => entry !== state))
        reject(Object.assign(new Error('DeepSeek Harness session is still busy'), { code: 'HARNESS_SESSION_BUSY' }))
      }, this.drainTimeoutMs)
      const state = { resolve: () => { clearTimeout(timer); resolve() }, reject, timer }
      const waiters = this.sessionIdleWaiters.get(sessionId) || []
      waiters.push(state)
      this.sessionIdleWaiters.set(sessionId, waiters)
    })
  }

  #markSessionIdle(sessionId) {
    this.sessionBusy.delete(sessionId)
    const waiters = this.sessionIdleWaiters.get(sessionId) || []
    this.sessionIdleWaiters.delete(sessionId)
    for (const waiter of waiters) waiter.resolve()
  }

  async request(method, params = {}) {
    if (!this.child || this.closed) throw Object.assign(new Error('DeepSeek Harness runtime is unavailable'), { code: 'HARNESS_RUNTIME_UNAVAILABLE' })
    const id = this.nextId++
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(Object.assign(new Error('DeepSeek Harness JSON-RPC request timed out'), { code: 'HARNESS_RUNTIME_RPC_TIMEOUT' }))
      }, this.rpcTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
    })
    try {
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    } catch (error) {
      const pending = this.pending.get(id)
      if (pending) {
        this.pending.delete(id)
        clearTimeout(pending.timer)
        pending.reject(error)
      }
    }
    return promise
  }

  #onData(chunk) {
    this.buffer += chunk
    let index
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (!line) continue
      let frame
      try { frame = JSON.parse(line) } catch { continue }
      if (frame.id !== undefined && frame.method === undefined) {
        const pending = this.pending.get(frame.id)
        if (!pending) continue
        this.pending.delete(frame.id)
        clearTimeout(pending.timer)
        if (frame.error) pending.reject(Object.assign(new Error(frame.error.message || 'DeepSeek Harness JSON-RPC error'), { code: 'HARNESS_RUNTIME_RPC_ERROR', details: frame.error }))
        else pending.resolve(frame.result)
        continue
      }
      if (frame.method === 'session.event') {
        const sessionId = String(frame.params?.sessionId || '')
        const waiter = this.waiters.get(sessionId)
        const event = frame.params?.event
        // dsh-tools executes registered EISCore tools in the SDK process and
        // emits tool/call plus tool/result events before the next model step.
        // The bridge must keep the waiter alive so the SDK can complete that
        // loop and return the final assistant message.
        const text = assistantText(frame.params)
        if (waiter && text) waiter.text += text
      } else if (frame.method === 'session.status' && frame.params?.status === 'idle') {
        const sessionId = String(frame.params?.sessionId || '')
        this.#markSessionIdle(sessionId)
        const waiter = this.waiters.get(sessionId)
        if (!waiter) continue
        this.waiters.delete(sessionId)
        clearTimeout(waiter.timer)
        waiter.resolve({ choices: [{ index: 0, message: { role: 'assistant', content: waiter.text }, finish_reason: 'stop' }] })
      }
    }
  }

  #fail(error) {
    if (this.closed) return
    this.closed = true
    this.initialized = false
    this.startPromise = null
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    for (const waiter of this.waiters.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
    this.pending.clear()
    this.waiters.clear()
    for (const waiters of this.sessionIdleWaiters.values()) {
      for (const waiter of waiters) waiter.reject(error)
    }
    this.sessionIdleWaiters.clear()
    this.sessionBusy.clear()
  }

  async close() {
    if (!this.child) return
    const child = this.child
    if (!this.closed) {
      const shutdown = this.request('shutdown', {}).catch(() => undefined)
      await Promise.race([
        shutdown,
        new Promise((resolve) => setTimeout(resolve, this.shutdownTimeoutMs))
      ])
    }
    const error = Object.assign(new Error('DeepSeek Harness runtime closed'), { code: 'HARNESS_RUNTIME_CLOSED' })
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    for (const waiter of this.waiters.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
    this.pending.clear()
    this.waiters.clear()
    for (const waiters of this.sessionIdleWaiters.values()) {
      for (const waiter of waiters) waiter.reject(error)
    }
    this.sessionIdleWaiters.clear()
    this.sessionBusy.clear()
    this.closed = true
    this.initialized = false
    this.startPromise = null
    try { child.kill() } catch { /* process already exited */ }
  }
}

const createInvoke = ({ runtime = new DshSdkProcess(), queue = new Map() } = {}) => async ({ body, sessionId, headers }) => {
  const pluginId = String(headers?.['x-eis-plugin-id'] || '').trim()
  const previous = queue.get(sessionId) || Promise.resolve()
  const next = previous.then(() => runtime.prompt(sessionId, body, pluginId))
  const tracked = next.catch(() => {})
  queue.set(sessionId, tracked)
  try {
    return { status: 200, payload: await next }
  } finally {
    if (queue.get(sessionId) === tracked) queue.delete(sessionId)
  }
}

const pluginList = (configured = process.env.HARNESS_PLUGINS) => {
  const source = configured === undefined ? DEFAULT_PLUGINS.join(',') : String(configured)
  const seen = new Set()
  return source.split(',').map((value) => value.trim()).filter((plugin_id) => {
    if (!REGISTERED_PLUGIN_IDS.has(plugin_id) || seen.has(plugin_id)) return false
    seen.add(plugin_id)
    return true
  }).map((plugin_id) => ({ plugin_id }))
}

const start = () => {
  validateHarnessToolArtifacts()
  const secrets = validateBridgeSecrets()
  const profile = process.env.DSH_PROFILE || 'sdk'
  const args = ['--profile', profile]
  if (process.env.DSH_PATCH) args.push('--patch', process.env.DSH_PATCH)
  const runtime = new DshSdkProcess({ args })
  const handler = createBridgeHandler({
    invoke: createInvoke({ runtime }),
    readiness: async () => {
      await runtime.start()
      const runtimeReady = runtime.initialized === true && runtime.closed !== true
      const pluginsReady = pluginList().length > 0
      return {
        ok: runtimeReady && pluginsReady,
        checks: {
          runtime: runtimeReady,
          plugins: pluginsReady,
          sessions: true
        }
      }
    },
    pluginList,
    bridgeSecret: secrets.bridgeSecret,
    maxConcurrent: envInt(process.env, 'BRIDGE_MAX_CONCURRENT_REQUESTS', 16),
    maxSessions: envInt(process.env, 'BRIDGE_MAX_SESSIONS', 1000),
    maxTrackedRequests: envInt(process.env, 'BRIDGE_MAX_TRACKED_REQUESTS', 10000),
    maxBodyBytes: envInt(process.env, 'BRIDGE_MAX_BODY_BYTES', 2 * 1024 * 1024),
    maxResponseBytes: envInt(process.env, 'BRIDGE_MAX_RESPONSE_BYTES', 2 * 1024 * 1024),
    sessionTtlMs: envInt(process.env, 'BRIDGE_SESSION_TTL_MS', 24 * 60 * 60 * 1000),
    stateFile: process.env.BRIDGE_STATE_FILE || ''
  })
  const server = http.createServer(handler)
  server.listen(envInt(process.env, 'PORT', 3080), '0.0.0.0')
  const close = async () => { await runtime.close(); server.close(() => process.exit(0)) }
  process.once('SIGTERM', close)
  process.once('SIGINT', close)
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()

export { DEFAULT_PLUGINS, DshSdkProcess, assistantText, createInvoke, imageBlock, pluginList, requestContentBlocks, PROTOCOL }
