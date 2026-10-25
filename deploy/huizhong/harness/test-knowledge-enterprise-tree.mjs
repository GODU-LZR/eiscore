import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = new URL('.', import.meta.url)
const pluginDir = new URL('./client-plugins/knowledge-enterprise-tree/', root)
const packageJson = JSON.parse(readFileSync(new URL('package.json', pluginDir), 'utf8'))
assert.equal(packageJson.name, '@eiscore/dsh-client-knowledge-enterprise-tree')
assert.equal(packageJson.dsh.client.platform, 'web')
assert.ok(packageJson.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-primitives'))
assert.ok(packageJson.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right'))

const modules = process.argv[2]
if (modules) {
  const { ClientModuleRegistry } = await import(pathToFileURL(join(resolve(modules), '@deepseek-ai/dsh-client-modules/lib/index.js')).href)
  const registry = Object.create(ClientModuleRegistry.prototype)
  registry.ctx = { loader: {} }
  registry.pkgMeta = new Map()
  const entry = fileURLToPath(new URL('lib/index.js', pluginDir))
  const resolved = registry.resolveMeta(entry, import.meta.url)
  assert.equal(resolved.packageName, packageJson.name)
  assert.equal(resolved.meta.clientPath, fileURLToPath(new URL('lib/client.js', pluginDir)))
  assert.ok(resolved.meta.inject.includes('@deepseek-ai/dsh-client-ui-workspace'))
  assert.match(registry.initialBundleSnapshot(resolved.packageName, resolved.meta.clientPath).bundle.toString(), /window\.__ModuleLoader__\.load/)
}

const source = readFileSync(new URL('lib/client.js', pluginDir), 'utf8')
assert.match(source, /sidebarRightTabs\.register\(/)
assert.match(source, /name: 'sidebar\.right\.pane\.tab'/)
assert.match(source, /name: 'sidebar\.right\.pane\.tab\.title'/)
assert.match(source, /openOntology:\s*\(\)\s*=>\s*sidebarRight\?\.openTab\?\.\(ONTOLOGY_TAB_KIND\)/)
for (const expected of [
  "'/harness-knowledge-agent/twin/knowledge/files'",
  'readKnowledgeFile',
  'updateKnowledgeFile',
  'deleteKnowledgeFile',
  'data-knowledge-file-preview',
  '重命名文件',
  '删除文件'
]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
const makeElement = (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } })
const hookState = []
const pendingEffects = []
const effectState = []
let hookIndex = 0
const effectCleanups = new Map()
const React = {
  createElement: makeElement,
  useState(initial) {
    const index = hookIndex++
    if (!(index in hookState)) hookState[index] = typeof initial === 'function' ? initial() : initial
    return [hookState[index], (next) => { hookState[index] = typeof next === 'function' ? next(hookState[index]) : next }]
  },
  useEffect: (effect, deps = []) => {
    const index = hookIndex++
    const previous = effectState[index]
    const changed = !previous || deps.length !== previous.deps.length || deps.some((value, offset) => value !== previous.deps[offset])
    effectState[index] = { deps }
    if (changed) pendingEffects.push({ index, effect })
  }
}
const icon = (name) => ({ displayName: name })
let plugin
const window = {
  setTimeout,
  clearTimeout,
  __ModuleLoader__: { load: (descriptor) => { plugin = descriptor.factory((name) => name === 'react' ? React : {
    IconCloseFill14: icon('close'),
    IconFolderClose16: icon('folder-close'),
    IconFolderOpen16: icon('folder-open'),
    IconProjectAddOutline16: icon('new-session'),
    IconSearchOutline16: icon('search'),
    IconTriangleRightFill14: icon('disclosure')
  }) } }
}
const appended = []
const document = {
  createElement: () => ({ remove() { this.removed = true } }),
  head: { appendChild: (node) => appended.push(node) }
}
vm.runInNewContext(source, { window, document, AbortController, Set, Map, String, Array, Object, Promise })
assert.equal(plugin.inject.includes('slots'), true)
const renderComponent = (component, props) => {
  pendingEffects.length = 0
  hookIndex = 0
  const rendered = component(props)
  for (const { index, effect } of pendingEffects) {
    effectCleanups.get(index)?.()
    const cleanup = effect()
    if (typeof cleanup === 'function') effectCleanups.set(index, cleanup)
    else effectCleanups.delete(index)
  }
  return rendered
}

const calls = []
let registered
let disposed
const disposals = []
const slotRegistrations = []
let ontologyType
const services = {
  sessions: {
    open: (id) => calls.push(['open', id]),
    search: async () => ({ ok: true, value: { items: [{ sessionId: 's-old', snippet: '命中合同文本' }], hasMore: false } })
  },
  workspaces: { archiveSession: async () => {} },
  uiWorkspace: { startSession: (id) => calls.push(['start', id]) },
  sidebarRight: { openTab: (kind) => calls.push(['ontology', kind]) },
  sidebarRightTabs: { register: (definition) => { ontologyType = definition; return () => {} } }
}
plugin.apply({
  get: (name) => services[name],
  on: (event, callback) => { if (event === 'dispose') { disposed = callback; disposals.push(callback) } },
  slots: {
    inject: (name, callback) => { callback(); return () => {} },
    register: (options, component) => {
      const entry = { options, component }
      slotRegistrations.push(entry)
      if (options.name === 'sidebar.workspaces') registered = entry
      return () => {}
    }
  }
})
assert.equal(appended.length, 1)
assert.equal(registered.options.name, 'sidebar.workspaces')
assert.equal(registered.options.priority, -1)
assert.equal(ontologyType.kind, 'knowledge-ontology')
assert.equal(ontologyType.id, '@eiscore/dsh-client-knowledge-ontology')
assert.ok(slotRegistrations.some(({ options }) => options.name === 'sidebar.right.pane.tab' && options.key === ontologyType.id))
assert.ok(slotRegistrations.some(({ options }) => options.name === 'sidebar.right.pane.tab.title' && options.key === ontologyType.id))
assert.equal(typeof disposed, 'function')

const workspaceState = {
  phase: 'ready',
  archivedSessionIds: ['archived'],
  items: [{
    workspaceId: 'knowledge',
    title: '企业知识库工作区',
    path: '/var/lib/dsh/workspaces/knowledge/销售/重点客户',
    sessionIds: ['s-current', 's-old', 'archived', 'blank-other', 'subagent']
  }]
}
const sessionState = {
  phase: 'ready',
  current: 's-current',
  ids: ['s-current', 's-old', 'archived', 'blank-other', 'subagent'],
  byId: {
    's-current': { id: 's-current', displayTitle: '当前对话', updatedAt: 30 },
    's-old': { id: 's-old', displayTitle: '历史对话', updatedAt: 20 },
    archived: { id: 'archived', displayTitle: '已归档', updatedAt: 10 },
    'blank-other': { id: 'blank-other', blank: true, displayTitle: '', updatedAt: 1 },
    subagent: { id: 'subagent', origin: 'subagent', displayTitle: '子任务', updatedAt: 1 }
  }
}
const componentProps = {
  wide: true,
  expandSidebar: () => calls.push(['expand']),
  useWorkspaces: (select) => select(workspaceState),
  useSessions: (select) => select(sessionState),
  startSession: (id) => services.uiWorkspace.startSession(id),
  open: (id) => services.sessions.open(id),
  searchSessions: async (query, signal) => {
    calls.push(['search', query, signal.aborted])
    return (await services.sessions.search(query, signal)).value
  }
}
let rendered = renderComponent(registered.component, componentProps)
const flatten = (node, output = []) => {
  if (node === null || node === undefined || node === false) return output
  if (Array.isArray(node)) { for (const child of node) flatten(child, output); return output }
  if (typeof node !== 'object') { output.push(node); return output }
  output.push(node)
  flatten(node.props?.children, output)
  return output
}
let nodes = flatten(rendered)
const text = nodes.filter((node) => typeof node === 'string').join('|')
const heading = nodes.find((node) => node.props?.className === 'eisKnowledgeTreeLabel')
assert.equal(heading.props.children, '工作区')
assert.match(text, /企业知识库/)
assert.match(text, /销售/)
assert.match(text, /重点客户/)
assert.match(text, /企业知识库工作区/)
assert.match(text, /当前对话/)
assert.match(text, /历史对话/)
assert.doesNotMatch(text, /已归档|子任务|blank-other/)
const rootNode = nodes.find((node) => node.props?.['data-tree-node'] === 'enterprise-knowledge-root')
const salesNode = nodes.find((node) => node.props?.['data-tree-node'] === 'folder:/销售')
const nestedFolderNode = nodes.find((node) => node.props?.['data-tree-node'] === 'folder:/销售/重点客户')
const workspaceNode = nodes.find((node) => node.props?.['data-tree-node'] === 'workspace:knowledge')
assert.equal(rootNode.props.style['--eis-tree-indent'], '0px')
assert.equal(salesNode.props.style['--eis-tree-indent'], '14px')
assert.equal(nestedFolderNode.props.style['--eis-tree-indent'], '28px')
assert.equal(workspaceNode.props.style['--eis-tree-indent'], '42px')
const currentSession = nodes.find((node) => node.props?.['data-tree-session'] === 's-current')
const workspaceNew = nodes.find((node) => node.props?.['data-tree-workspace-new'] === 'knowledge')
assert.equal(currentSession.props['aria-current'], 'page')
currentSession.props.onClick()
workspaceNew.props.onClick()
assert.deepEqual(calls, [['open', 's-current'], ['start', 'knowledge']])
rootNode.props.onClick()
rendered = renderComponent(registered.component, componentProps)
nodes = flatten(rendered)
assert.equal(nodes.some((node) => node.props?.['data-tree-session'] === 's-current'), false)
nodes.find((node) => node.props?.['data-tree-node'] === 'enterprise-knowledge-root').props.onClick()
rendered = renderComponent(registered.component, componentProps)
nodes = flatten(rendered)
nodes.find((node) => node.props?.['aria-label'] === '搜索会话').props.onClick()
rendered = renderComponent(registered.component, componentProps)
nodes = flatten(rendered)
nodes.find((node) => node.type === 'input').props.onChange({ target: { value: '合同' } })
rendered = renderComponent(registered.component, componentProps)
await new Promise((resolve) => setTimeout(resolve, 220))
rendered = renderComponent(registered.component, componentProps)
nodes = flatten(rendered)
assert.match(nodes.filter((node) => typeof node === 'string').join('|'), /命中合同文本/)
nodes.find((node) => node.props?.['data-tree-session'] === 's-old').props.onClick()
assert.deepEqual(calls.slice(2).map((call) => call.slice(0, 2)), [['search', '合同'], ['open', 's-old']])
let expanded = 0
const rail = flatten(renderComponent(registered.component, { ...componentProps, wide: false, expandSidebar: () => expanded++ }))
rail.find((node) => node.props?.['aria-label'] === '展开企业知识库分类').props.onClick()
assert.equal(expanded, 1)
for (const cleanup of effectCleanups.values()) cleanup()
for (const cleanup of disposals) cleanup()
assert.equal(appended[0].removed, true)
console.log('PASS: knowledge tree grouping, filtering, current-session state, collapse/expand, search, native open/new, and cleanup')
