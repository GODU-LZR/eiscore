import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? '' : process.argv[index + 1] || ''
}
const sdkRoot = resolve(arg('--sdk-root') || process.env.EISCORE_DSH_SDK_ROOT || join(import.meta.dirname, 'node_modules'))
const sdkImport = (relative) => import(pathToFileURL(join(sdkRoot, '@deepseek-ai', relative)).href)
const expected = {
  business: [
    'eiscore_enterprise_snapshot', 'eiscore_enterprise_query',
    'eiscore_multimodal_translate', 'eiscore_multimodal_ocr', 'eiscore_multimodal_map_locate',
    'eiscore_grid_query', 'eiscore_twin_context', 'eiscore_twin_chat',
    'eiscore_workflow_context', 'eiscore_workflow_write', 'eiscore_sales_context', 'eiscore_sales_write',
    'eiscore_document_plan', 'eiscore_document_commit', 'eiscore_engineering_context', 'eiscore_site_sales'
  ].sort(),
  flash: ['eiscore_flash_read', 'eiscore_flash_write']
}

if (arg('--child')) {
  const profile = arg('--child')
  assert.ok(expected[profile], 'Expected business or flash profile')
  const temporary = resolve(arg('--temporary'))
  const harnessRoot = resolve(arg('--harness-root'))
  const workspace = join(temporary, 'workspace')
  mkdirSync(workspace, { recursive: true })
  process.chdir(workspace)
  process.env.DSH_HOME = join(temporary, 'home')
  process.env.DSH_DEFAULT_WORKSPACE = workspace.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')
  process.env.DSH_TELEMETRY_DISABLED = '1'
  process.env.EISCORE_HARNESS_CAPABILITY_PROFILE = profile
  delete process.env.DSH_MODEL
  delete process.env.DSH_PROVIDER
  delete process.env.DSH_TOOLS_MODE
  const { ensureStartupProfile } = await import(pathToFileURL(join(harnessRoot, 'dsh-web-runner.mjs')).href)
  ensureStartupProfile()
  const sourcePatch = join(harnessRoot, profile === 'flash' ? 'dsh-flash-web.patch.yml' : 'dsh-web.patch.yml')
  const patch = join(temporary, 'web.patch.yml')
  writeFileSync(patch, readFileSync(sourcePatch, 'utf8').replaceAll('/opt/eiscore-harness/', pathToFileURL(harnessRoot).href + '/'))
  const version = JSON.parse(readFileSync(join(sdkRoot, '@deepseek-ai/dsh/package.json'), 'utf8')).version
  assert.equal(version, '0.1.2-rc.1')
  // Use the same official profile boot as dsh/bin.js, retaining its returned
  // context only to inspect the model-visible schemas of the real new Agent.
  const library = join(sdkRoot, '@deepseek-ai/dsh/lib')
  const entry = readdirSync(library).find((name) => /^profile-boot-.*\.js$/.test(name) && /export \{ runProfile \}/.test(readFileSync(join(library, name), 'utf8')))
  assert.ok(entry, 'Pinned DSH profile boot entry is missing')
  const { runProfile } = await sdkImport('dsh/lib/' + entry)
  const { createLaunchEnvironmentSnapshot } = await sdkImport('dsh-launch-environment/lib/index.js')
  const logs = []
  const originalLog = console.log
  console.log = (...values) => logs.push(values.join(' '))
  const nativeFetch = globalThis.fetch
  let outboundRequests = 0
  globalThis.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.hostname !== '127.0.0.1') {
      outboundRequests++
      throw new Error('This profile smoke must not call a model or external service')
    }
    return nativeFetch(input, options)
  }
  let runtime
  try {
    runtime = await runProfile({
      profile: 'web', patchFiles: [patch], args: ['--host', '127.0.0.1', '--port', '0', '--no-open'],
      environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: process.env }])
    })
    const { ctx } = runtime
    assert.ok(ctx.webServer.port > 0, 'Real Web server must bind an ephemeral port')
    const url = ctx.connection.authenticatedUrl(`http://127.0.0.1:${ctx.webServer.port}/`)
    const response = await fetch(url, { redirect: 'manual' })
    assert.ok([200, 302, 303].includes(response.status), 'Real Web server must accept its startup token')
    assert.equal(ctx.get('agentPresets'), undefined, 'Session presets must remain disabled')
    const selection = { provider: 'deepseek-official', model: 'deepseek-flash' }
    assert.deepEqual(ctx.agentDefaultModel.currentSelection(), selection)
    const { sessionId, agentPreset } = await ctx.sessionController.create({ cwd: workspace })
    assert.equal(agentPreset, undefined)
    const agent = ctx.agents.get(sessionId)
    assert.ok(agent, 'Session Controller must create a real live Agent')
    assert.deepEqual(ctx.sessionController.agents.selectionFor(agent).current, selection)
    const tools = ctx.tools.schemas(agent).map((tool) => tool.name).sort()
    assert.deepEqual(tools, expected[profile], 'New session must expose exactly the reviewed EISCore capabilities')
    assert.deepEqual(ctx.tools.schemas().map((tool) => tool.name).sort(), expected[profile])
    assert.equal(outboundRequests, 0)
    originalLog(JSON.stringify({ profile, dshVersion: version, provider: selection.provider, model: selection.model, tools, realWebServer: true, realSessionAgent: true, externalRequests: outboundRequests }))
  } catch (error) {
    for (const log of logs) if (!log.startsWith('dsh web:')) console.error(log)
    throw error
  } finally {
    if (runtime) await runtime.shutdown.shutdown(0)
    console.log = originalLog
    globalThis.fetch = nativeFetch
  }
} else {
  const temporary = mkdtempSync(join(tmpdir(), 'eiscore-dsh-profile-smoke-'))
  try {
    const harnessRoot = arg('--harness-root') ? resolve(arg('--harness-root')) : join(temporary, 'bundle')
    if (!arg('--harness-root')) {
      const { buildHarnessBundle } = await import('../scripts/build-yayu-harness-bundle.mjs')
      buildHarnessBundle(harnessRoot, 'profile-smoke')
    }
    for (const profile of Object.keys(expected)) {
      const child = spawnSync(process.execPath, ['--expose-internals', import.meta.filename, '--child', profile, '--temporary', join(temporary, profile), '--sdk-root', sdkRoot, '--harness-root', harnessRoot], { encoding: 'utf8', timeout: 45000, windowsHide: true })
      assert.equal(child.status, 0, `${profile} real DSH profile failed: ${child.error || ''}\n${child.stdout}\n${child.stderr}`)
      const report = child.stdout.split(/\r?\n/).find((line) => line.startsWith('{"profile":'))
      assert.ok(report, `${profile} inspection report is missing`)
      console.log(report)
    }
    console.log('PASS: real DSH Web profiles bind, create session Agents, select deepseek-flash and expose only EISCore tools')
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}
