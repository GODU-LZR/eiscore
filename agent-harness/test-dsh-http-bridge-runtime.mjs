import assert from 'node:assert/strict'
import { DshSdkProcess, assistantText, createInvoke, pluginList, requestContentBlocks, validateBridgeSecrets, validateHarnessToolArtifacts } from './dsh-http-bridge.mjs'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const artifactRoot = mkdtempSync(join(tmpdir(), 'eiscore-harness-bridge-artifacts-'))
try {
  const validSecrets = validateBridgeSecrets({
    bridgeSecret: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
    toolProxySecret: 'HarnessProxy9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6'
  })
  assert.equal(validSecrets.bridgeSecret.length >= 32, true)
  assert.equal(validSecrets.toolProxySecret.length >= 32, true)
  assert.throws(() => validateBridgeSecrets({ bridgeSecret: 'short', toolProxySecret: 'HarnessProxy9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6' }), /EISCORE_HARNESS_BRIDGE_SECRET must be at least 32 characters/)
  assert.throws(() => validateBridgeSecrets({ bridgeSecret: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6', toolProxySecret: 'short' }), /EISCORE_TOOL_PROXY_SECRET must be at least 32 characters/)
  assert.throws(() => validateBridgeSecrets({ bridgeSecret: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6', toolProxySecret: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6' }), /secrets must be independent/)
  writeFileSync(join(artifactRoot, 'eiscore-tools.mjs'), 'export function apply() {}\n')
  writeFileSync(join(artifactRoot, 'eiscore-restricted.cordis.yml'), '- insert: []\n')
  const patchFile = join(artifactRoot, 'patch.yml')
  const externalPatchFile = join(tmpdir(), 'eiscore-harness-external-patch.yml')
  mkdirSync(join(artifactRoot, 'nested'), { recursive: true })
  writeFileSync(patchFile, '[]\n')
  writeFileSync(externalPatchFile, '[]\n')
  const rootFile = join(tmpdir(), 'eiscore-harness-root-file')
  writeFileSync(rootFile, 'not a directory\n')
  assert.equal(validateHarnessToolArtifacts({ root: artifactRoot, patchFile }).root, artifactRoot)
  assert.throws(() => validateHarnessToolArtifacts({ root: join(artifactRoot, 'missing'), patchFile }), /tool artifacts unavailable/)
  assert.throws(() => validateHarnessToolArtifacts({ root: rootFile, patchFile }), /DSH_CWD must be an existing absolute non-symlink directory/)
  assert.throws(() => validateHarnessToolArtifacts({ root: artifactRoot, patchFile: join(artifactRoot, 'missing.yml') }), /DSH_PATCH must be a regular file/)
  assert.throws(() => validateHarnessToolArtifacts({ root: artifactRoot, patchFile: externalPatchFile }), /DSH_PATCH must stay under DSH_CWD/)
  const injectedEnv = {
    DSH_BIN: 'injected-dsh',
    DSH_CWD: artifactRoot,
    BRIDGE_PROMPT_TIMEOUT_MS: '321',
    BRIDGE_SESSION_DRAIN_TIMEOUT_MS: '322',
    BRIDGE_RPC_TIMEOUT_MS: '323',
    BRIDGE_SHUTDOWN_TIMEOUT_MS: '324'
  }
  const injectedRuntime = new DshSdkProcess({ env: injectedEnv })
  assert.equal(injectedRuntime.command, 'injected-dsh')
  assert.equal(injectedRuntime.cwd, artifactRoot)
  assert.equal(injectedRuntime.timeoutMs, 321)
  assert.equal(injectedRuntime.drainTimeoutMs, 322)
  assert.equal(injectedRuntime.rpcTimeoutMs, 323)
  assert.equal(injectedRuntime.shutdownTimeoutMs, 324)
  assert.throws(() => new DshSdkProcess({ env: { BRIDGE_RPC_TIMEOUT_MS: '2147483648' } }), /BRIDGE_RPC_TIMEOUT_MS must be a positive integer/)
  assert.throws(() => new DshSdkProcess({ timeoutMs: 0 }), /BRIDGE_PROMPT_TIMEOUT_MS must be a positive integer/)
  assert.throws(() => new DshSdkProcess({ shutdownTimeoutMs: -1 }), /BRIDGE_SHUTDOWN_TIMEOUT_MS must be a positive integer/)
} finally {
  rmSync(artifactRoot, { recursive: true, force: true })
  rmSync(join(tmpdir(), 'eiscore-harness-external-patch.yml'), { force: true })
  rmSync(join(tmpdir(), 'eiscore-harness-root-file'), { force: true })
}
console.log('PASS: DeepSeek SDK bridge fails closed when tool/profile artifacts are missing')

assert.deepEqual(requestContentBlocks({ messages: [{ role: 'user', content: 'hello' }] }, 'enterprise-bi'), [
  { type: 'text', text: '[EISCORE_PLUGIN:enterprise-bi]' },
  { type: 'text', text: '[user]' },
  { type: 'text', text: 'hello' }
])
assert.equal(assistantText({ event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'answer' }] } } } }), 'answer')
assert.deepEqual(pluginList('enterprise-bi,unknown,digital-twin'), [
  { plugin_id: 'enterprise-bi' },
  { plugin_id: 'digital-twin' }
], 'Bridge must filter plugin ids against the registered contract')
assert.deepEqual(pluginList('digital-twin,digital-twin,enterprise-bi,digital-twin'), [
  { plugin_id: 'digital-twin' },
  { plugin_id: 'enterprise-bi' }
], 'Bridge must expose each registered plugin at most once')
assert.deepEqual(pluginList('unknown'), [], 'an unknown-only plugin configuration must fail closed')
assert.deepEqual(pluginList(''), [], 'an explicitly empty plugin configuration must fail closed')

const childScript = [
  "process.stdin.setEncoding('utf8');",
  "let b=''; process.stdin.on('data', c => { b+=c; let i; while((i=b.indexOf('\\n'))>=0){ const f=JSON.parse(b.slice(0,i)); b=b.slice(i+1); if(f.method==='initialize') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{serverInfo:{name:'deepseek-harness-sdk-runtime',version:'0.0.1'}}})+'\\n'); if(f.method==='session/prompt'){ process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.event',params:{sessionId:f.params.sessionId,event:{type:'assistant/message',data:{message:{content:[{type:'text',text:'ok'}]}}}}})+'\\n'); process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.status',params:{sessionId:f.params.sessionId,status:'idle'}})+'\\n'); process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{messageId:'m1'}})+'\\n'); } if(f.method==='shutdown') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{}})+'\\n'); }});"
].join('')
const runtime = new DshSdkProcess({ command: process.execPath, args: ['-e', childScript], timeoutMs: 2000 })
const invoke = createInvoke({ runtime })
await Promise.all([runtime.start(), runtime.start()])
assert.equal(runtime.initialized, true)
const [result, concurrentResult] = await Promise.all([
  invoke({ body: { messages: [{ role: 'user', content: 'hello' }] }, sessionId: 'session-1', headers: { 'x-eis-plugin-id': 'enterprise-bi' } }),
  invoke({ body: { messages: [{ role: 'user', content: 'parallel' }] }, sessionId: 'session-2', headers: { 'x-eis-plugin-id': 'digital-twin' } })
])
assert.equal(result.payload.choices[0].message.content, 'ok')
assert.equal(concurrentResult.payload.choices[0].message.content, 'ok')
await runtime.close()
console.log('PASS: DeepSeek SDK bridge framing and response aggregation')

const promptErrorChildScript = [
  "process.stdin.setEncoding('utf8');",
  "let b='', prompts=0; process.stdin.on('data', c => { b+=c; let i; while((i=b.indexOf('\\n'))>=0){ const f=JSON.parse(b.slice(0,i)); b=b.slice(i+1); if(f.method==='initialize') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{serverInfo:{name:'deepseek-harness-sdk-runtime',version:'0.0.1'}}})+'\\n'); if(f.method==='session/prompt'){ prompts++; if(prompts===1) process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,error:{code:-32001,message:'provider rejected prompt'}})+'\\n'); else { const sid=f.params.sessionId; process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.event',params:{sessionId:sid,event:{type:'assistant/message',data:{message:{content:[{type:'text',text:'ok-after-error'}]}}}}})+'\\n'); process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.status',params:{sessionId:sid,status:'idle'}})+'\\n'); process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{messageId:'m3'}})+'\\n'); } } if(f.method==='shutdown') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{}})+'\\n'); }});"
].join('')
const promptErrorRuntime = new DshSdkProcess({ command: process.execPath, args: ['-e', promptErrorChildScript], timeoutMs: 100, rpcTimeoutMs: 10000 })
const promptErrorInvoke = createInvoke({ runtime: promptErrorRuntime })
await promptErrorRuntime.start()
promptErrorRuntime.rpcTimeoutMs = 500
await assert.rejects(
  promptErrorInvoke({ body: { messages: [{ role: 'user', content: 'first' }] }, sessionId: 'session-error', headers: { 'x-eis-plugin-id': 'enterprise-bi' } }),
  (error) => error?.code === 'HARNESS_RUNTIME_RPC_ERROR' && error?.message === 'provider rejected prompt'
)
const afterErrorResult = await promptErrorInvoke({ body: { messages: [{ role: 'user', content: 'second' }] }, sessionId: 'session-error', headers: { 'x-eis-plugin-id': 'enterprise-bi' } })
assert.equal(afterErrorResult.payload.choices[0].message.content, 'ok-after-error')
await promptErrorRuntime.close()
console.log('PASS: DeepSeek SDK bridge clears prompt waiters after SDK prompt errors')

const rpcTimeoutChild = join(import.meta.dirname, 'test-rpc-timeout-child.mjs')
// Keep process initialization separate from the receipt-timeout budget. On
// Windows the child-process startup can exceed 250ms even though the prompt
// receipt path must still fail closed at that budget.
const rpcTimeoutRuntime = new DshSdkProcess({ command: process.execPath, args: [rpcTimeoutChild], timeoutMs: 500, rpcTimeoutMs: 10000, drainTimeoutMs: 1500 })
const rpcTimeoutInvoke = createInvoke({ runtime: rpcTimeoutRuntime })
await rpcTimeoutRuntime.start()
rpcTimeoutRuntime.rpcTimeoutMs = 250
await assert.rejects(
  rpcTimeoutInvoke({ body: { messages: [{ role: 'user', content: 'receipt timeout' }] }, sessionId: 'session-rpc-timeout', headers: { 'x-eis-plugin-id': 'enterprise-bi' } }),
  (error) => error?.code === 'HARNESS_RUNTIME_RPC_TIMEOUT'
)
assert.equal(rpcTimeoutRuntime.pending.size, 0, 'RPC receipt timeout must clear the pending request')
assert.equal(rpcTimeoutRuntime.sessionBusy.has('session-rpc-timeout'), true, 'RPC receipt timeout must keep the session busy until idle is observed')
await new Promise((resolve) => setTimeout(resolve, 500))
const afterRpcTimeoutResult = await rpcTimeoutInvoke({ body: { messages: [{ role: 'user', content: 'reuse after receipt timeout' }] }, sessionId: 'session-rpc-timeout', headers: { 'x-eis-plugin-id': 'enterprise-bi' } })
assert.equal(afterRpcTimeoutResult.payload.choices[0].message.content, 'ok-after-rpc-timeout')
await rpcTimeoutRuntime.close()
console.log('PASS: DeepSeek SDK bridge bounds RPC receipt timeouts without releasing sessions early')

const delayedIdleChildScript = [
  "process.stdin.setEncoding('utf8');",
  "let b='', prompts=0; process.stdin.on('data', c => { b+=c; let i; while((i=b.indexOf('\\n'))>=0){ const f=JSON.parse(b.slice(0,i)); b=b.slice(i+1); if(f.method==='initialize') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{serverInfo:{name:'deepseek-harness-sdk-runtime',version:'0.0.1'}}})+'\\n'); if(f.method==='session/prompt'){ prompts++; const sid=f.params.sessionId; const delay=prompts===1 ? 180 : 0; process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{messageId:'delayed'}})+'\\n'); setTimeout(() => { process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.event',params:{sessionId:sid,event:{type:'assistant/message',data:{message:{content:[{type:'text',text:prompts===1 ? 'late' : 'after-drain'}]}}}}})+'\\n'); process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.status',params:{sessionId:sid,status:'idle'}})+'\\n'); }, delay); } if(f.method==='shutdown') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{}})+'\\n'); }});"
].join('')
const delayedIdleRuntime = new DshSdkProcess({ command: process.execPath, args: ['-e', delayedIdleChildScript], timeoutMs: 100, rpcTimeoutMs: 10000, drainTimeoutMs: 500 })
const delayedIdleInvoke = createInvoke({ runtime: delayedIdleRuntime })
await delayedIdleRuntime.start()
delayedIdleRuntime.rpcTimeoutMs = 500
await assert.rejects(
  delayedIdleInvoke({ body: { messages: [{ role: 'user', content: 'timeout' }] }, sessionId: 'session-drain', headers: { 'x-eis-plugin-id': 'enterprise-bi' } }),
  (error) => error?.code === 'HARNESS_PROMPT_TIMEOUT'
)
const drainedResult = await delayedIdleInvoke({ body: { messages: [{ role: 'user', content: 'reuse' }] }, sessionId: 'session-drain', headers: { 'x-eis-plugin-id': 'enterprise-bi' } })
assert.equal(drainedResult.payload.choices[0].message.content, 'after-drain')
await delayedIdleRuntime.close()
console.log('PASS: DeepSeek SDK bridge drains timed-out sessions before reuse')

const toolChildScript = [
  "process.stdin.setEncoding('utf8');",
  "let b=''; process.stdin.on('data', c => { b+=c; let i; while((i=b.indexOf('\\n'))>=0){ const f=JSON.parse(b.slice(0,i)); b=b.slice(i+1); if(f.method==='initialize') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{serverInfo:{name:'deepseek-harness-sdk-runtime',version:'0.0.1'}}})+'\\n'); if(f.method==='session/prompt'){ const sid=f.params.sessionId; const emit=(event)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.event',params:{sessionId:sid,event}})+'\\n'); emit({type:'tool/call',data:{callId:'call-1',name:'eiscore_enterprise_snapshot',arguments:'{}'}}); emit({type:'tool/result',data:{message:{content:[{type:'tool-result',toolCallId:'call-1',content:[{type:'text',text:'{\\\"snapshot\\\":\\\"proxy-ok\\\"}'}],isError:false}]}}}); emit({type:'assistant/message',data:{message:{content:[{type:'text',text:'ok-after-tool'}]}}}); process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session.status',params:{sessionId:sid,status:'idle'}})+'\\n'); process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{messageId:'m2'}})+'\\n'); } if(f.method==='shutdown') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{}})+'\\n'); }});"
].join('')
const toolRuntime = new DshSdkProcess({ command: process.execPath, args: ['-e', toolChildScript], timeoutMs: 2000 })
const toolInvoke = createInvoke({ runtime: toolRuntime })
const toolResult = await toolInvoke({ body: { messages: [{ role: 'user', content: 'call a tool' }] }, sessionId: 'session-tool', headers: { 'x-eis-plugin-id': 'enterprise-bi' } })
assert.equal(toolResult.payload.choices[0].message.content, 'ok-after-tool')
assert.equal(toolRuntime.closed, false)
await toolRuntime.close()
console.log('PASS: DeepSeek SDK bridge waits for registered tool execution and result continuation')

const noShutdownReplyScript = [
  "process.stdin.setEncoding('utf8');",
  "let b=''; process.stdin.on('data', c => { b+=c; let i; while((i=b.indexOf('\\n'))>=0){ const f=JSON.parse(b.slice(0,i)); b=b.slice(i+1); if(f.method==='initialize') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result:{serverInfo:{name:'deepseek-harness-sdk-runtime',version:'0.0.1'}}})+'\\n'); }});"
].join('')
const boundedRuntime = new DshSdkProcess({ command: process.execPath, args: ['-e', noShutdownReplyScript], timeoutMs: 2000, shutdownTimeoutMs: 50 })
await boundedRuntime.start()
const closeStartedAt = Date.now()
await boundedRuntime.close()
assert.ok(Date.now() - closeStartedAt < 500, 'Bridge close must not wait forever for an SDK shutdown response')
assert.equal(boundedRuntime.closed, true)
console.log('PASS: DeepSeek SDK bridge shutdown is bounded when SDK omits a response')
