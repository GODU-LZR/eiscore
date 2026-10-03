// Same-process DeepSeek Harness tools. The parent EISCore runtime owns the
// authenticated session context; this plugin only forwards a capability call.

const CAPABILITIES = Object.freeze([
  'eiscore_enterprise_snapshot',
  'eiscore_enterprise_query',
  'eiscore_multimodal_translate',
  'eiscore_multimodal_ocr',
  'eiscore_multimodal_map_locate',
  'eiscore_grid_query',
  'eiscore_twin_context',
  'eiscore_twin_chat',
  'eiscore_workflow_context',
  'eiscore_workflow_write',
  'eiscore_sales_context',
  'eiscore_sales_write',
  'eiscore_document_plan',
  'eiscore_document_commit',
  'eiscore_flash_read',
  'eiscore_flash_write',
  'eiscore_engineering_context',
  'eiscore_site_sales'
])

// Keep the SDK-side cooperative deadline aligned with the server-side
// capability contract. The Gateway remains the authoritative hard timeout.
const CAPABILITY_TIMEOUTS = Object.freeze({
  eiscore_enterprise_snapshot: 30000,
  eiscore_enterprise_query: 30000,
  eiscore_multimodal_translate: 30000,
  eiscore_multimodal_ocr: 30000,
  eiscore_multimodal_map_locate: 30000,
  eiscore_grid_query: 30000,
  eiscore_twin_context: 60000,
  eiscore_twin_chat: 60000,
  eiscore_workflow_context: 60000,
  eiscore_workflow_write: 60000,
  eiscore_sales_context: 60000,
  eiscore_sales_write: 60000,
  eiscore_document_plan: 60000,
  eiscore_document_commit: 60000,
  eiscore_flash_read: 60000,
  eiscore_flash_write: 60000,
  eiscore_engineering_context: 30000,
  eiscore_site_sales: 30000
})

const QUERY_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['dataset'],
  properties: {
    dataset: { type: 'string' },
    select: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    filters: { type: 'object', additionalProperties: true },
    limit: { type: 'integer' },
    order: { type: 'string' }
  }
})

const QUERY_OUTPUT = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['dataset', 'rows', 'limit'],
  properties: {
    dataset: { type: 'string' },
    rows: { type: 'array', items: { type: 'object' } },
    limit: { type: 'integer' }
  }
})
const SNAPSHOT_OUTPUT = Object.freeze({ type: 'object', additionalProperties: true })

const TRANSLATE_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['text'],
  properties: { text: { type: 'string' }, prompt: { type: 'string' } }
})
const OCR_PARAMETERS = Object.freeze({
  type: 'object',
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['image_url'], properties: { image_url: { type: 'string' }, prompt: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['imageUrl'], properties: { imageUrl: { type: 'string' }, prompt: { type: 'string' } } }
  ]
})
const MAP_PARAMETERS = Object.freeze({
  type: 'object',
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['image_url'], properties: { image_url: { type: 'string' }, prompt: { type: 'string' }, lat: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] }, lng: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] } } },
    { type: 'object', additionalProperties: false, required: ['imageUrl'], properties: { imageUrl: { type: 'string' }, prompt: { type: 'string' }, lat: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] }, lng: { oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] } } }
  ]
})
const TEXT_OUTPUT = Object.freeze({
  type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } }
})
const ADDRESS_OUTPUT = Object.freeze({
  type: 'object', additionalProperties: false, required: ['address'], properties: { address: { type: 'string' } }
})
const CONTEXT_PARAMETERS = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: { view: { type: 'string' }, view_id: { type: 'string' } }
})
const CONTEXT_OUTPUT = Object.freeze({
  type: 'object', additionalProperties: false, required: ['context', 'view', 'data'],
  properties: { context: { type: 'string' }, view: { type: 'string' }, data: { type: 'object' } }
})
const TWIN_CONTEXT_PARAMETERS = Object.freeze({
  type: 'object', oneOf: [
    { type: 'object', additionalProperties: false, required: ['tool_id'], properties: { tool_id: { type: 'string' }, arguments: { type: 'object', additionalProperties: true } } },
    { type: 'object', additionalProperties: false, required: ['toolId'], properties: { toolId: { type: 'string' }, arguments: { type: 'object', additionalProperties: true } } },
    { type: 'object', additionalProperties: false, required: ['tool_name'], properties: { tool_name: { type: 'string' }, arguments: { type: 'object', additionalProperties: true } } },
    { type: 'object', additionalProperties: false, required: ['toolName'], properties: { toolName: { type: 'string' }, arguments: { type: 'object', additionalProperties: true } } }
  ]
})
const TWIN_CONTEXT_OUTPUT = Object.freeze({
  type: 'object', additionalProperties: false, required: ['tool_id', 'result'],
  properties: { tool_id: { type: 'string' }, result: { oneOf: [{ type: 'object' }, { type: 'array' }, { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] } }
})
const TWIN_CHAT_PARAMETERS = Object.freeze({
  type: 'object', oneOf: [
    { type: 'object', additionalProperties: false, required: ['message'], properties: { message: { type: 'string' }, session_id: { type: 'string' }, sessionId: { type: 'string' }, stream: { type: 'boolean' } } },
    { type: 'object', additionalProperties: false, required: ['content'], properties: { content: { type: 'string' }, session_id: { type: 'string' }, sessionId: { type: 'string' }, stream: { type: 'boolean' } } }
  ]
})
const TWIN_CHAT_OUTPUT = Object.freeze({
  type: 'object', oneOf: [
    { type: 'object', additionalProperties: true, required: ['text'], properties: { text: { type: 'string' } } },
    { type: 'object', additionalProperties: true, required: ['output_text'], properties: { output_text: { type: 'string' } } },
    { type: 'object', additionalProperties: true, required: ['choices'], properties: { choices: { type: 'array', items: { type: 'object' } } } }
  ]
})
const DOCUMENT_PLAN_PARAMETERS = Object.freeze({
  type: 'object', oneOf: [
    { type: 'object', additionalProperties: false, required: ['plan_id'], properties: { plan_id: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['planId'], properties: { planId: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['asset_id'], properties: { asset_id: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['assetId'], properties: { assetId: { type: 'string' } } }
  ]
})
const DOCUMENT_PLAN_OUTPUT = Object.freeze({
  type: 'object', additionalProperties: false, required: ['plans'], properties: { plans: { type: 'array', items: { type: 'object' } } }
})
const DOCUMENT_COMMIT_PARAMETERS = Object.freeze({
  type: 'object', oneOf: [
    { type: 'object', additionalProperties: false, required: ['plan_id', 'plan_version'], properties: { plan_id: { type: 'string' }, plan_version: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['plan_id', 'planVersion'], properties: { plan_id: { type: 'string' }, planVersion: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['planId', 'plan_version'], properties: { planId: { type: 'string' }, plan_version: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['planId', 'planVersion'], properties: { planId: { type: 'string' }, planVersion: { type: 'string' } } }
  ]
})
const DOCUMENT_COMMIT_OUTPUT = Object.freeze({
  type: 'object', additionalProperties: true, required: ['plan', 'processed', 'queued'],
  properties: { plan: { type: 'object' }, processed: { type: 'boolean' }, queued: { type: 'boolean' }, idempotent_replay: { type: 'boolean' } }
})
const FLASH_PARAMETERS = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    tool_id: { type: 'string' }, toolId: { type: 'string' },
    arguments: { type: 'object', additionalProperties: true }, args: { type: 'object', additionalProperties: true }
  }
})
const FLASH_TOOL_PARAMETERS = Object.freeze({
  type: 'object',
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['tool_id'], properties: { tool_id: { type: 'string' }, toolId: { type: 'string' }, arguments: { type: 'object', additionalProperties: true }, args: { type: 'object', additionalProperties: true } } },
    { type: 'object', additionalProperties: false, required: ['toolId'], properties: { tool_id: { type: 'string' }, toolId: { type: 'string' }, arguments: { type: 'object', additionalProperties: true }, args: { type: 'object', additionalProperties: true } } }
  ]
})
const SALES_CONTEXT_PARAMETERS = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    dataset: { type: 'string', enum: ['sales_orders'] },
    select: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    filters: { type: 'object', additionalProperties: true }, limit: { type: 'integer' }, order: { type: 'string' }
  }
})
const SALES_CONTEXT_OUTPUT = QUERY_OUTPUT
const salesWriteVariant = (requiredKey, operation, properties) => ({
  type: 'object', additionalProperties: false, required: [requiredKey],
  properties: {
    operation: { type: 'string', enum: [operation] },
    action: { type: 'string', enum: [operation] },
    ...properties
  }
})
const SALES_WRITE_PARAMETERS = Object.freeze({
  type: 'object',
  oneOf: [
    salesWriteVariant('operation', 'qualify_lead', { lead_id: { type: 'string' }, leadId: { type: 'string' }, score: { type: 'number' }, reasons: { type: 'array', items: { type: 'string' } } }),
    salesWriteVariant('action', 'qualify_lead', { lead_id: { type: 'string' }, leadId: { type: 'string' }, score: { type: 'number' }, reasons: { type: 'array', items: { type: 'string' } } }),
    salesWriteVariant('operation', 'opportunity_draft_create', { lead_id: { type: 'string' }, leadId: { type: 'string' }, productItems: { type: 'array', items: { type: 'object' } }, estimatedAmount: { type: 'number' }, currency: { type: 'string' }, stage: { type: 'string' }, qualification: { type: 'object', additionalProperties: true }, sourceSessionId: { type: 'string' }, source_session_id: { type: 'string' } }),
    salesWriteVariant('action', 'opportunity_draft_create', { lead_id: { type: 'string' }, leadId: { type: 'string' }, productItems: { type: 'array', items: { type: 'object' } }, estimatedAmount: { type: 'number' }, currency: { type: 'string' }, stage: { type: 'string' }, qualification: { type: 'object', additionalProperties: true }, sourceSessionId: { type: 'string' }, source_session_id: { type: 'string' } }),
    salesWriteVariant('operation', 'quote_draft_create', { opportunity_id: { type: 'string' }, opportunityId: { type: 'string' }, currency: { type: 'string' }, items: { type: 'array', items: { type: 'object' } }, validUntil: { oneOf: [{ type: 'string' }, { type: 'null' }] }, valid_until: { oneOf: [{ type: 'string' }, { type: 'null' }] }, priceSource: { type: 'string' }, price_source: { type: 'string' } }),
    salesWriteVariant('action', 'quote_draft_create', { opportunity_id: { type: 'string' }, opportunityId: { type: 'string' }, currency: { type: 'string' }, items: { type: 'array', items: { type: 'object' } }, validUntil: { oneOf: [{ type: 'string' }, { type: 'null' }] }, valid_until: { oneOf: [{ type: 'string' }, { type: 'null' }] }, priceSource: { type: 'string' }, price_source: { type: 'string' } }),
    salesWriteVariant('operation', 'sales_order_draft_create', { quote_id: { type: 'string' }, quoteId: { type: 'string' }, items: { type: 'array', items: { type: 'object' } }, deliveryDate: { oneOf: [{ type: 'string' }, { type: 'null' }] }, delivery_date: { oneOf: [{ type: 'string' }, { type: 'null' }] } }),
    salesWriteVariant('action', 'sales_order_draft_create', { quote_id: { type: 'string' }, quoteId: { type: 'string' }, items: { type: 'array', items: { type: 'object' } }, deliveryDate: { oneOf: [{ type: 'string' }, { type: 'null' }] }, delivery_date: { oneOf: [{ type: 'string' }, { type: 'null' }] } }),
    salesWriteVariant('operation', 'production_draft_create', { sales_order_id: { type: 'string' }, salesOrderId: { type: 'string' }, plannedItems: { type: 'array', items: { type: 'object' } }, materialRequirements: { type: 'array', items: { type: 'object' } }, capacityRisk: { type: 'object', additionalProperties: true } }),
    salesWriteVariant('action', 'production_draft_create', { sales_order_id: { type: 'string' }, salesOrderId: { type: 'string' }, plannedItems: { type: 'array', items: { type: 'object' } }, materialRequirements: { type: 'array', items: { type: 'object' } }, capacityRisk: { type: 'object', additionalProperties: true } }),
    salesWriteVariant('operation', 'sales_approval', { object_type: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, objectType: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, object_id: { type: 'string' }, objectId: { type: 'string' }, decision: { type: 'string', enum: ['approve', 'reject'] }, comment: { type: 'string' } }),
    salesWriteVariant('action', 'sales_approval', { object_type: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, objectType: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, object_id: { type: 'string' }, objectId: { type: 'string' }, decision: { type: 'string', enum: ['approve', 'reject'] }, comment: { type: 'string' } }),
    salesWriteVariant('operation', 'sales_sync_enqueue', { object_type: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, objectType: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, object_id: { type: 'string' }, objectId: { type: 'string' }, targetSystem: { type: 'string' }, target_system: { type: 'string' } }),
    salesWriteVariant('action', 'sales_sync_enqueue', { object_type: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, objectType: { type: 'string', enum: ['opportunity', 'quote', 'sales_order', 'production'] }, object_id: { type: 'string' }, objectId: { type: 'string' }, targetSystem: { type: 'string' }, target_system: { type: 'string' } })
  ]
})

const TOOL_SCHEMAS = Object.freeze({
  eiscore_enterprise_snapshot: Object.freeze({ parameters: { type: 'object', additionalProperties: false }, output: SNAPSHOT_OUTPUT }),
  eiscore_enterprise_query: Object.freeze({ parameters: QUERY_PARAMETERS, output: QUERY_OUTPUT }),
  eiscore_grid_query: Object.freeze({ parameters: QUERY_PARAMETERS, output: QUERY_OUTPUT }),
  eiscore_multimodal_translate: Object.freeze({ parameters: TRANSLATE_PARAMETERS, output: TEXT_OUTPUT }),
  eiscore_multimodal_ocr: Object.freeze({ parameters: OCR_PARAMETERS, output: TEXT_OUTPUT }),
  eiscore_multimodal_map_locate: Object.freeze({ parameters: MAP_PARAMETERS, output: ADDRESS_OUTPUT }),
  eiscore_engineering_context: Object.freeze({ parameters: CONTEXT_PARAMETERS, output: CONTEXT_OUTPUT }),
  eiscore_site_sales: Object.freeze({ parameters: CONTEXT_PARAMETERS, output: CONTEXT_OUTPUT }),
  eiscore_twin_context: Object.freeze({ parameters: TWIN_CONTEXT_PARAMETERS, output: TWIN_CONTEXT_OUTPUT }),
  eiscore_twin_chat: Object.freeze({ parameters: TWIN_CHAT_PARAMETERS, output: TWIN_CHAT_OUTPUT }),
  eiscore_document_plan: Object.freeze({ parameters: DOCUMENT_PLAN_PARAMETERS, output: DOCUMENT_PLAN_OUTPUT }),
  eiscore_document_commit: Object.freeze({ parameters: DOCUMENT_COMMIT_PARAMETERS, output: DOCUMENT_COMMIT_OUTPUT }),
  eiscore_flash_read: Object.freeze({ parameters: FLASH_TOOL_PARAMETERS, output: { type: 'object', additionalProperties: true } }),
  eiscore_flash_write: Object.freeze({ parameters: FLASH_TOOL_PARAMETERS, output: { type: 'object', additionalProperties: true } }),
  eiscore_workflow_context: Object.freeze({ parameters: FLASH_PARAMETERS, output: { type: 'object', additionalProperties: true } }),
  eiscore_workflow_write: Object.freeze({ parameters: FLASH_PARAMETERS, output: { type: 'object', additionalProperties: true } }),
  eiscore_sales_context: Object.freeze({ parameters: SALES_CONTEXT_PARAMETERS, output: SALES_CONTEXT_OUTPUT }),
  eiscore_sales_write: Object.freeze({ parameters: SALES_WRITE_PARAMETERS, output: { type: 'object', additionalProperties: true } })
})

const proxyUrl = () => String(process.env.EISCORE_TOOL_PROXY_URL || '').replace(/\/+$/, '')
const proxySecret = () => String(process.env.EISCORE_TOOL_PROXY_SECRET || '')

// DSH accepts the JSON Schema subset where a oneOf root omits the redundant type.
// Keep the richer contract shape in plugin-contract.v1.json and normalize only at registration.
const normalizeDshSchema = (schema) => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema
  const normalized = {}
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'oneOf' && Array.isArray(value)) normalized[key] = value.map(normalizeDshSchema)
    else if (key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, normalizeDshSchema(child)]))
    } else if (key === 'items') normalized[key] = normalizeDshSchema(value)
    else normalized[key] = value
  }
  if (Array.isArray(normalized.oneOf)) delete normalized.type
  return normalized
}

const callProxy = async (name, args, exec) => {
  const baseUrl = proxyUrl()
  const secret = proxySecret()
  const sessionId = String(exec?.agent?.session?.id || '')
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
  for (const capability of CAPABILITIES) {
    const schema = TOOL_SCHEMAS[capability]
    ctx.tools.register({
      name: capability,
      description: `Execute the authenticated EISCore capability ${capability}. Never provide identity, tenant, JWT, SQL, URL or authorization fields; the server binds those to the current session.`,
      parameters: normalizeDshSchema(schema?.parameters || { type: 'object', additionalProperties: capability === 'eiscore_enterprise_snapshot' ? false : true }),
      output: { schema: normalizeDshSchema(schema?.output || { type: 'object' }), render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      timeoutMs: CAPABILITY_TIMEOUTS[capability] || 30000,
      async execute(args, exec) {
        return callProxy(capability, args, exec)
      }
    })
  }
}

export { CAPABILITY_TIMEOUTS, normalizeDshSchema }
