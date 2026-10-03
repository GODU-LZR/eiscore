import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { apply, capabilities, CAPABILITY_TIMEOUTS, normalizeDshSchema } from './eiscore-tools.mjs'

assert.equal(capabilities.length, 18)
assert.equal(new Set(capabilities).size, capabilities.length)
assert.ok(capabilities.includes('eiscore_enterprise_snapshot'))
assert.ok(capabilities.includes('eiscore_site_sales'))

const registrations = []
const ctx = { tools: { register: (definition) => registrations.push(definition) } }
apply(ctx)
assert.deepEqual(registrations.map(({ name }) => name), [...capabilities])
assert.equal(registrations.find(({ name }) => name === 'eiscore_enterprise_snapshot').parameters.additionalProperties, false)
const flashWriteParameters = registrations.find(({ name }) => name === 'eiscore_flash_write').parameters
assert.equal(flashWriteParameters.type, undefined)
assert.equal(flashWriteParameters.oneOf.length, 2)
const normalizedRoot = normalizeDshSchema({ type: 'object', oneOf: [{ type: 'object', properties: { value: { type: 'string' } } }, { type: 'object' }] })
assert.equal(normalizedRoot.type, undefined)
assert.equal(normalizedRoot.oneOf[0].type, 'object')
const normalizedNested = normalizeDshSchema({ type: 'object', properties: { value: { type: 'object', oneOf: [{ type: 'string' }, { type: 'null' }] } } })
assert.equal(normalizedNested.type, 'object')
assert.equal(normalizedNested.properties.value.type, undefined)
assert.deepEqual(normalizedNested.properties.value.oneOf.map(({ type }) => type), ['string', 'null'])
const sourceSchema = { type: 'object', properties: { value: { type: 'object', oneOf: [{ type: 'string' }, { type: 'null' }] } } }
const sourceSnapshot = JSON.stringify(sourceSchema)
const normalizedCopy = normalizeDshSchema(sourceSchema)
assert.equal(JSON.stringify(sourceSchema), sourceSnapshot)
assert.notEqual(normalizedCopy, sourceSchema)
assert.notEqual(normalizedCopy.properties, sourceSchema.properties)
assert.notEqual(normalizedCopy.properties.value, sourceSchema.properties.value)
for (const name of ['eiscore_enterprise_query', 'eiscore_grid_query']) {
  const registration = registrations.find((item) => item.name === name)
  assert.equal(registration.parameters.additionalProperties, false)
  assert.deepEqual(registration.parameters.required, ['dataset'])
  assert.equal(registration.output.schema.additionalProperties, false)
  assert.deepEqual(registration.output.schema.required, ['dataset', 'rows', 'limit'])
}
const contract = JSON.parse(await readFile(new URL('./plugin-contract.v1.json', import.meta.url), 'utf8'))
const contractCapabilities = contract.plugins.flatMap(({ capabilities: pluginCapabilities }) => pluginCapabilities).sort()
assert.deepEqual([...capabilities].sort(), contractCapabilities, 'DSH capability registry must match the plugin contract exactly')
for (const name of capabilities) {
  const sourcePolicy = contract.plugins
    .map((plugin) => plugin.capability_policies?.[name])
    .find(Boolean)
  assert.ok(sourcePolicy, `${name} must exist in the plugin contract`)
  const registration = registrations.find((item) => item.name === name)
  assert.deepEqual(registration.parameters, normalizeDshSchema(sourcePolicy.input_schema), `${name} DSH input schema must match the normalized plugin contract`)
  assert.deepEqual(registration.output.schema, normalizeDshSchema(sourcePolicy.output_schema), `${name} DSH output schema must match the normalized plugin contract`)
  assert.equal(registration.timeoutMs, sourcePolicy.timeout_ms, `${name} DSH timeout must match the plugin contract`)
  assert.equal(CAPABILITY_TIMEOUTS[name], sourcePolicy.timeout_ms, `${name} timeout inventory must match the plugin contract`)
}
assert.deepEqual(Object.keys(CAPABILITY_TIMEOUTS).sort(), [...capabilities].sort(), 'DSH timeout inventory must cover exactly the registered capabilities')

const received = []
const server = http.createServer((request, response) => {
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    received.push({ headers: request.headers, body })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ data: { accepted: body.tool_name } }))
  })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const previousProxyUrl = process.env.EISCORE_TOOL_PROXY_URL
const previousProxySecret = process.env.EISCORE_TOOL_PROXY_SECRET
process.env.EISCORE_TOOL_PROXY_URL = `http://127.0.0.1:${address.port}/internal/harness/tool`
process.env.EISCORE_TOOL_PROXY_SECRET = '01234567890123456789012345678901'
try {
  const exec = { agent: { session: { id: 'dsh-loopback-session' } } }
  for (const [index, registration] of registrations.entries()) {
    const result = await registration.execute({ ordinal: index }, exec)
    assert.deepEqual(result, { accepted: registration.name })
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
  if (previousProxyUrl === undefined) delete process.env.EISCORE_TOOL_PROXY_URL
  else process.env.EISCORE_TOOL_PROXY_URL = previousProxyUrl
  if (previousProxySecret === undefined) delete process.env.EISCORE_TOOL_PROXY_SECRET
  else process.env.EISCORE_TOOL_PROXY_SECRET = previousProxySecret
}
assert.equal(received.length, capabilities.length)
for (const [index, entry] of received.entries()) {
  assert.equal(entry.headers['x-eis-tool-secret'], '01234567890123456789012345678901')
  assert.equal(entry.body.session_id, 'dsh-loopback-session')
  assert.equal(entry.body.tool_name, capabilities[index])
  assert.deepEqual(entry.body.arguments, { ordinal: index })
}
const patch = await readFile(new URL('./eiscore-restricted.cordis.yml', import.meta.url), 'utf8')
assert.match(patch, /name: '\.\/eiscore-tools\.mjs'/)
assert.match(patch, /id: tool-str-replace-editor\s+disabled: true/, 'restricted profile must disable the generic file editor')
console.log('PASS: EISCore DSH tool plugin registry and restricted profile contract')
