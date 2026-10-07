import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DshSdkProcess } from '../agent-harness/dsh-http-bridge.mjs'

const root = resolve(import.meta.dirname, '..')
const dshBin = resolve(root, 'agent-harness/node_modules/@deepseek-ai/dsh/lib/bin.js')
const patch = resolve(root, 'agent-harness/eiscore-restricted.cordis.yml')
const home = mkdtempSync(join(tmpdir(), 'eiscore-dsh-loopback-'))
const proxyCalls = []
const modelRequests = []

const readBody = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const writeSse = (response, payload) => {
  response.write(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`)
}

const mockProvider = createServer(async (request, response) => {
  if (request.method !== 'POST' || !new URL(request.url || '/', 'http://localhost').pathname.endsWith('/chat/completions')) {
    response.writeHead(404).end()
    return
  }
  modelRequests.push(await readBody(request))
  response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
  if (modelRequests.length === 1) {
    writeSse(response, { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'loopback-call-1', type: 'function', function: { name: 'eiscore_enterprise_snapshot', arguments: '{}' } }] }, finish_reason: null }] })
    writeSse(response, { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
  } else {
    writeSse(response, { choices: [{ index: 0, delta: { content: 'mock response recovered' }, finish_reason: null }] })
    writeSse(response, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  }
  writeSse(response, '[DONE]')
  response.end()
})

const toolProxy = createServer(async (request, response) => {
  proxyCalls.push({ headers: request.headers, body: await readBody(request) })
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ ok: true, data: { snapshot: 'proxy-ok' } }))
})

const listen = (server) => new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen)
  server.listen(0, '127.0.0.1', () => {
    server.off('error', rejectListen)
    resolveListen(server.address().port)
  })
})
const close = (server) => new Promise((resolveClose) => {
  server.close(() => resolveClose())
  server.closeAllConnections?.()
})

let runtime
try {
  const providerPort = await listen(mockProvider)
  const proxyPort = await listen(toolProxy)
  const env = {
    ...process.env,
    DSH_HOME: home,
    DSH_PROVIDER: 'deepseek-official',
    DSH_MODEL: 'deepseek-v4-flash',
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
    DEEPSEEK_API_KEY: 'loopback-mock-key',
    DSH_TELEMETRY_MODE: 'DISABLED',
    EISCORE_TOOL_PROXY_URL: `http://127.0.0.1:${proxyPort}/internal/harness/tool`,
    EISCORE_TOOL_PROXY_SECRET: '01234567890123456789012345678901'
  }
  runtime = new DshSdkProcess({
    command: process.execPath,
    args: [dshBin, '--profile', 'sdk', '--patch', patch],
    cwd: root,
    env,
    timeoutMs: 60000
  })
  const result = await runtime.prompt('loopback-tool-session', { messages: [{ role: 'user', content: 'read my snapshot' }] }, 'enterprise-bi')
  assert.equal(result.choices[0].message.content, 'mock response recovered')
  assert.equal(proxyCalls.length, 1)
  assert.equal(proxyCalls[0].body.tool_name, 'eiscore_enterprise_snapshot')
  assert.equal(modelRequests.length, 2)
  console.log(JSON.stringify({ ok: true, text: result.choices[0].message.content, proxyCalls: proxyCalls.length, modelRequests: modelRequests.length }))
} finally {
  await runtime?.close()
  await close(mockProvider)
  await close(toolProxy)
  rmSync(home, { recursive: true, force: true })
}
