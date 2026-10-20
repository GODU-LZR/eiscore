import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { apply } from './business-role-policy.mjs'
import { apply as applyFlash } from '../flash-harness/flash-role-policy.mjs'

// Reuse the installed production-version archive; this test installs no dependencies.
const modules = process.argv[2]
if (!modules) throw new Error('Pass the installed DSH node_modules directory')
const load = (name) => import(pathToFileURL(join(resolve(modules), '@deepseek-ai', name, 'lib/index.js')).href)
const [{ Context, Service }, { ClientModuleRegistry }, { SystemPrompt }] = await Promise.all([load('cordis'), load('dsh-client-modules'), load('dsh-system-prompt')])
const entry = fileURLToPath(new URL('./client-plugins/business-entry/lib/index.js', import.meta.url))
const registry = Object.create(ClientModuleRegistry.prototype)
registry.ctx = { loader: {} }
registry.pkgMeta = new Map()
const resolved = registry.resolveMeta(entry, import.meta.url)
assert.equal(resolved.packageName, '@eiscore/dsh-client-business-entry')
assert.equal(resolved.meta.clientPath, fileURLToPath(new URL('./client-plugins/business-entry/lib/client.js', import.meta.url)))
assert.ok(resolved.meta.inject.includes('@deepseek-ai/dsh-client-ui-workspace'))
assert.match(registry.initialBundleSnapshot(resolved.packageName, resolved.meta.clientPath).bundle.toString(), /window\.__ModuleLoader__\.load/)
const workspaceSource = readFileSync(join(modules, '@deepseek-ai/dsh-workspace/lib/index.js'), 'utf8')
assert.match(workspaceSource, /async resolveByPath\(path\)/)
assert.ok(workspaceSource.includes('this.id = id'), 'WorkspaceEntity exposes its stable id')
const connectionSource = readFileSync(join(modules, '@deepseek-ai/dsh-client-connection/lib/client.js'), 'utf8')
assert.match(connectionSource, /const send = doFetch \?\? \(\(input, init\) => globalThis.fetch\(input, init\)\)/)

// Service tracing wrappers share the underlying native UI service; no UI slot replacement is needed.
const ctx = new Context()
class Workspace extends Service { constructor() { super(ctx, 'uiWorkspace') } startSession() { return 'native' } }
new Workspace()
const service = ctx.uiWorkspace
const other = ctx.extend().uiWorkspace
const original = service.startSession
Object.defineProperty(service, 'startSession', { configurable: true, value: () => 'business-entry' })
assert.equal(other.startSession(), 'business-entry')
delete service.startSession
assert.equal(other.startSession(), 'native')
assert.equal(typeof original, 'function')

const taskDir = mkdtempSync(join(tmpdir(), 'eiscore-native-contract-'))
const previousHome = process.env.DSH_HOME
try {
  process.env.DSH_HOME = taskDir
  writeFileSync(join(taskDir, 'eiscore-session-roles.json'), JSON.stringify({ worker: { entry: 'worker', owner: 'fixture' }, analysis: { entry: 'workbench', owner: 'fixture' } }))
  new SystemPrompt(ctx, {})
  assert.equal(ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA'), 0)
  apply({
    systemPrompt: ctx.systemPrompt,
    workspaceRegistry: {},
    effect: (effect) => effect(),
    connection: { fetch: { register: () => () => {} } },
    webServer: { register: () => () => {} }
  })
  const worker = await ctx.systemPrompt.assemble({ agent: { session: { id: 'worker' } } })
  const analysis = await ctx.systemPrompt.assemble({ agent: { session: { id: 'analysis' } } })
  assert.match(worker.sections.find((part) => part.name === 'eiscore:business-role').text, /一线员工/)
  assert.match(analysis.sections.find((part) => part.name === 'eiscore:business-role').text, /指标定义/)
  assert.ok(worker.sections.some((part) => part.name === 'harness:identity'))
  const flashCtx = new Context()
  new SystemPrompt(flashCtx, {})
  applyFlash(flashCtx)
  const flash = await flashCtx.systemPrompt.assemble()
  assert.match(flash.sections.find((part) => part.name === 'eiscore:flash-role').text, /flash\.draft\.write/)
  assert.ok(flash.sections.some((part) => part.name === 'harness:identity'))
  console.log(JSON.stringify({ packageName: resolved.packageName, clientPath: resolved.meta.clientPath, inject: resolved.meta.inject, platform: 'web', startupBuild: false }))
  console.log('PASS: installed DSH 0.1.2-rc.1 ClientModuleRegistry exact discovery, native traced service patch, workspace API, live-fetch lookup, actual SystemPrompt assembly for worker/workbench/Flash')
} finally {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  rmSync(taskDir, { recursive: true, force: true })
}
