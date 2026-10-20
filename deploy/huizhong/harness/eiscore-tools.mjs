import { createRequire } from 'node:module'
import { createHash, randomUUID } from 'node:crypto'
const require = createRequire(import.meta.url)
const { loadPluginRegistry } = require('./plugin-registry.js')
const registry = loadPluginRegistry()
const policies = new Map(registry.listCapabilities().map((policy) => [policy.capability_id, policy]))
const CAPABILITIES = Object.freeze([...policies.keys()])
const CAPABILITY_TIMEOUTS = Object.freeze(Object.fromEntries([...policies].map(([id, policy]) => [id, policy.timeout_ms])))
const proxyUrl = () => String(process.env.EISCORE_TOOL_PROXY_URL || '').replace(/\/+$/, '')
const proxySecret = () => String(process.env.EISCORE_TOOL_PROXY_SECRET || '')
const flashContextSessionId = () => ''
const normalizeDshSchema = (schema, { root = true } = {}) => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema
  const normalized = {}
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'oneOf' && Array.isArray(value)) normalized[key] = value.map((item) => normalizeDshSchema(item, { root: false }))
    else if (key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, normalizeDshSchema(child, { root: false })]))
    } else if (key === 'items') normalized[key] = normalizeDshSchema(value, { root: false })
    else normalized[key] = value
  }
  if (Array.isArray(normalized.oneOf)) {
    const objectOnly = normalized.oneOf.length > 0 && normalized.oneOf.every((variant) => variant?.type === 'object')
    if (root && objectOnly) {
      const branches = normalized.oneOf
      const properties = {}
      for (const branch of branches) {
        for (const [name, property] of Object.entries(branch.properties || {})) {
          const previous = properties[name]
          if (!previous) {
            properties[name] = property
            continue
          }
          const merged = { ...previous, ...property }
          if (Array.isArray(previous.enum) && Array.isArray(property.enum)) {
            merged.enum = [...new Set([...previous.enum, ...property.enum])]
          }
          properties[name] = merged
        }
      }
      const requiredSets = branches.map((branch) => new Set(Array.isArray(branch.required) ? branch.required : []))
      const required = requiredSets.length && requiredSets.every((set) => set.size === requiredSets[0].size && [...set].every((key) => requiredSets[0].has(key)))
        ? [...requiredSets[0]]
        : []
      const additionalProperties = branches.every((branch) => branch.additionalProperties === false) ? false : true
      return { type: 'object', additionalProperties, properties, ...(required.length ? { required } : {}) }
    }
    delete normalized.type
  }
  return normalized
}

const callProxy = async (name, args, exec) => {
  const baseUrl = proxyUrl()
  const secret = proxySecret()
  const sessionId = flashContextSessionId(exec) || String(exec?.agent?.session?.id || '')
  if (!baseUrl || !sessionId || secret.length < 32) throw new Error('EISCore authorized tool proxy is unavailable')
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-eis-tool-secret': secret },
    body: JSON.stringify({ session_id: sessionId, tool_name: name, arguments: args && typeof args === 'object' ? args : {} }),
    signal: exec?.signal
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body?.message || 'EISCore authorized tool request failed'))
  return body?.data === undefined ? body : body.data
}

export const name = 'eiscore-tools'
export const inject = ['tools']
export const capabilities = CAPABILITIES
export function apply(ctx) {
  for (const [capability, policy] of policies) {
    const parameters = normalizeDshSchema(policy.input_schema)
    if (capability === 'eiscore_site_sales') {
      for (const field of ['view', 'view_id']) parameters.properties[field].enum = ['site', 'catalog', 'knowledge']
    }
    ctx.tools.register({
      name: capability,
      description: capability === 'eiscore_grid_query'
        ? 'Read authenticated materials, inventory, employee archives or user management. Allowed datasets: materials, inventory, employees, users. User creation is unsupported. Identity, tenant, permissions and field visibility are bound by the server.'
        : capability === 'eiscore_site_sales'
          ? 'Read the current enterprise public website content. Only views site (website configuration), catalog (published products), and knowledge (published documents) exist. For business performance and order amounts use eiscore_sales_context with sales_orders.'
          : capability === 'eiscore_sales_context'
            ? 'Read sales orders for the signed-in enterprise using dataset sales_orders. Use these records to analyze order amounts, customers, dates and business performance; report the queried scope and do not infer totals from a limited sample. Identity, tenant and permissions are bound by the server.'
            : 'Execute a sales business write for the signed-in enterprise. Explicit user approval is required. Identity, tenant, permissions and field visibility are bound by the server.',
      parameters,
      output: { schema: normalizeDshSchema(policy.output_schema), render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      timeoutMs: policy.timeout_ms,
      async execute(args, exec) {
        const sessionId = String(exec?.agent?.session?.id || '')
        const auth = globalThis[Symbol.for('eiscore.dsh.auth-bridge')]
        if (!auth?.toolToken) return callProxy(capability, args, exec)
        const token = auth.toolToken(sessionId)
        if (!token) throw new Error('EISCore session authentication is required; start a new business session after signing in')
        if (policy.confirm_required) {
          const approval = ctx.get?.('approval')
          if (!approval || !exec?.agent) throw new Error('Explicit user approval is unavailable')
          const outcome = await approval.request({ agent: exec.agent, toolName: capability, callId: exec.callId, reason: '请确认此销售业务操作', signal: exec.signal })
          if (outcome !== 'allowed-once') throw new Error('The sales operation was not approved')
        }
        const origin = new URL(String(process.env.EISCORE_GATEWAY_URL || ''))
        if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('EISCore gateway is unavailable')
        const requestId = randomUUID()
        const idempotency = createHash('sha256').update(JSON.stringify([sessionId, exec.callId || requestId, capability, args])).digest('hex')
        const response = await fetch(new URL('/ai/harness/execute', origin), {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
          body: JSON.stringify({ request_id: requestId, session_id: sessionId, plugin_id: policy.plugin_id, agent_id: policy.agent_id, capability_id: capability, payload: args || {}, mode: 'standard', ...(policy.confirm_required ? { confirmed: true, idempotency_key: idempotency } : {}) }),
          signal: exec?.signal
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(String(body.message || 'EISCore capability request failed'))
        return body.data === undefined ? body : body.data
      }
    })
  }
}
export { CAPABILITY_TIMEOUTS, normalizeDshSchema }
