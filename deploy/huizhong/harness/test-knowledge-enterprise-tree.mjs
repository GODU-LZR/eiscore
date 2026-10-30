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
assert.equal(packageJson.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right'), false)

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
  assert.equal(resolved.meta.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right'), false)
  assert.match(registry.initialBundleSnapshot(resolved.packageName, resolved.meta.clientPath).bundle.toString(), /window\.__ModuleLoader__\.load/)
}

const source = readFileSync(new URL('lib/client.js', pluginDir), 'utf8')
assert.doesNotMatch(source, /sidebarRight|sidebar\.right\.pane/)
assert.match(source, /name: 'shell\.overlay'/)
assert.match(source, /\.eisKnowledgeSessionMenuOverlay\{position:fixed;inset:0 var\(--eisKnowledge-ontology-right,56px\) 0 0;z-index:21;pointer-events:none\}/)
assert.match(source, /\.eisKnowledgeSessionMenuOverlay>\.eisKnowledgeSessionMenu\{position:fixed;top:0;right:var\(--eisKnowledge-ontology-right,56px\);left:var\(--eisKnowledge-sidebar-right,56px\);pointer-events:auto\}/)
assert.match(source, /\.eisKnowledgeOntologyDock\{position:fixed;inset:0 0 0 auto;box-sizing:border-box;width:var\(--eisKnowledge-ontology-right,56px\);/)
assert.match(source, /\.eisKnowledgeOntologyDock\[data-open="false"\] \.eisKnowledgeOntologyTitle\{display:none\}/)
assert.match(source, /\.eisKnowledgeSessionMenu\{position:relative;display:block;min-width:0;z-index:12;container-type:inline-size\}/)
assert.match(source, /\.eisKnowledgeSessionMenuButton\{box-sizing:border-box;position:relative;isolation:isolate;/)
assert.match(source, /\.eisKnowledgeSessionMenuWorkspace\{display:block;position:relative;min-width:0;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px\}/)
assert.doesNotMatch(source, /eisKnowledgeSessionMenuProject/)
assert.match(source, /@container\(max-width:180px\)\{\.eisKnowledgeSessionMenuButtonIcon\{display:none\}\}/)
assert.match(source, /\.eisKnowledgeSessionMenuDisclosure\[data-open="true"\]\{transform:rotate\(-90deg\)\}/)
assert.match(source, /\.eisKnowledgeSessionMenuPanel\{box-sizing:border-box;position:relative;width:100%/)
assert.match(source, /getBoundingClientRect/)
assert.match(source, /frame\.style\.paddingRight = `calc\(\$\{basePaddingRight\} \+ \$\{ontologyWidth\}px\)`/)
assert.doesNotMatch(source, /frame\.style\.gridTemplateColumns\s*=/)
assert.match(source, /new ResizeObserver\(update\)/)
assert.match(source, /new MutationObserver\(update\)/)
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
const keyListeners = new Set()
let sidebarWidth = 280
let sidebarLeft = 32
const resizeObservers = new Set()
const mutationObservers = new Set()
const resizeListeners = new Set()
const sidebarFrame = { style: { gridTemplateColumns: '280px minmax(0, 1fr)', paddingRight: '12px' }, getBoundingClientRect: () => ({ width: 1280 }) }
const sidebarColumn = {
  parentElement: sidebarFrame,
  getBoundingClientRect: () => ({ left: sidebarLeft, right: sidebarLeft + sidebarWidth, width: sidebarWidth })
}
const menuOverlayElement = {
  style: {
    values: {},
    setProperty(name, value) { this.values[name] = value }
  }
}
class ResizeObserver {
  constructor(callback) { this.callback = callback; resizeObservers.add(this) }
  observe(target) { assert.equal(target, sidebarColumn); this.target = target }
  disconnect() { resizeObservers.delete(this) }
}
class MutationObserver {
  constructor(callback) { this.callback = callback; mutationObservers.add(this) }
  observe(target, options) { assert.equal(target, sidebarFrame); assert.equal(Array.from(options.attributeFilter).join(','), 'class,style'); this.target = target }
  disconnect() { mutationObservers.delete(this) }
}
const notifySidebarResize = (width) => {
  sidebarWidth = width
  sidebarFrame.style.gridTemplateColumns = `${width}px minmax(0, 1fr)`
  for (const observer of resizeObservers) observer.callback()
}
const notifyFrameMutation = (width) => {
  sidebarWidth = width
  sidebarFrame.style.gridTemplateColumns = `${width}px minmax(0, 1fr)`
  for (const observer of mutationObservers) observer.callback()
}
const window = {
  setTimeout,
  clearTimeout,
  getComputedStyle: () => ({ paddingRight: sidebarFrame.style.paddingRight || '12px' }),
  addEventListener: (name, listener) => { if (name === 'keydown') keyListeners.add(listener); else { assert.equal(name, 'resize'); resizeListeners.add(listener) } },
  removeEventListener: (name, listener) => { if (name === 'keydown') keyListeners.delete(listener); else { assert.equal(name, 'resize'); resizeListeners.delete(listener) } },
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
const documentRootStyle = { values: {}, setProperty(name, value) { this.values[name] = value } }
const document = {
  createElement: () => ({ remove() { this.removed = true } }),
  documentElement: { style: documentRootStyle },
  querySelector: (selector) => selector === '[data-knowledge-session-menu-overlay]' ? menuOverlayElement : selector === '[data-slot="sidebar"]' ? { parentElement: sidebarColumn } : null,
  head: { appendChild: (node) => appended.push(node) }
}
vm.runInNewContext(source, { window, document, AbortController, ResizeObserver, MutationObserver, Set, Map, String, Array, Object, Promise })
assert.equal(plugin.inject.includes('slots'), true)
assert.deepEqual(Array.from(plugin.inject), ['slots', 'sessions', 'uiWorkspace', 'workspaces'])
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
let sessionMenu
const disposals = []
const slotRegistrations = []
const services = {
  sessions: {
    list: { getSnapshot: () => ({ phase: 'ready', current: 's-current', ids: [], byId: {} }), subscribe: () => () => {} },
    open: (id) => calls.push(['open', id]),
    search: async () => ({ ok: true, value: { items: [{ sessionId: 's-old', snippet: '命中合同文本' }], hasMore: false } })
  },
  workspaces: { list: { getSnapshot: () => ({ phase: 'ready', items: [], archivedSessionIds: [] }), subscribe: () => () => {} }, archiveSession: async () => {} },
  uiWorkspace: { startSession: (id) => calls.push(['start', id]) }
}
plugin.apply({
  get: (name) => { assert.ok(name in services, `Unavailable service: ${name}`); return services[name] },
  effect: (setup) => { const dispose = setup(); disposals.push(dispose); return dispose },
  slots: {
    inject: (name, callback) => { callback(); return () => {} },
    register: (options, component) => {
      const entry = { options, component }
      slotRegistrations.push(entry)
      if (options.name === 'sidebar.workspaces') registered = entry
      if (options.id === '@eiscore/dsh-client-knowledge-session-menu') sessionMenu = entry
      return () => {}
    }
  }
})
assert.equal(appended.length, 1)
assert.equal(registered.options.name, 'sidebar.workspaces')
assert.equal(registered.options.priority, -1)
assert.equal(sessionMenu.options.name, 'shell.overlay')
assert.equal(sessionMenu.options.id, '@eiscore/dsh-client-knowledge-session-menu')
assert.equal(sessionMenu.options.priority, 10)
assert.deepEqual(slotRegistrations.map(({ options }) => options.name), ['sidebar.workspaces', 'shell.overlay', 'shell.overlay'])
assert.equal(typeof disposals[0], 'function')

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
  listFiles: async () => [{ id: 'file-1', file_name: '安全手册.md', file_size: 1024 }],
  readFile: async (id) => ({ id, file_name: '安全手册.md', content_text: '文件内容' }),
  uploadFile: async () => {},
  updateFile: async () => {},
  deleteFile: async () => {},
  openOntology: () => calls.push(['ontology'])
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
const fileSection = rendered.props.children
nodes = flatten(renderComponent(fileSection.type, fileSection.props))
const text = nodes.filter((node) => typeof node === 'string').join('|')
assert.match(text, /知识文件/)
assert.match(text, /上传/)
assert.doesNotMatch(text, /企业知识库工作区|当前对话|历史对话/)
let expanded = 0
const rail = flatten(renderComponent(registered.component, { ...componentProps, wide: false, expandSidebar: () => expanded++ }))
rail.find((node) => node.props?.['aria-label'] === '展开知识文件管理').props.onClick()
assert.equal(expanded, 1)

hookState.length = 0
effectState.length = 0
const observable = (value) => ({ getSnapshot: () => value, subscribe: () => () => {} })
const menuProps = {
  workspaceSource: observable(workspaceState),
  sessionSource: observable(sessionState),
  startSession: (id) => calls.push(['start', id]),
  open: (id) => calls.push(['open', id]),
  searchSessions: async (query, signal) => {
    calls.push(['search', query, signal.aborted])
    return (await services.sessions.search(query, signal)).value
  }
}
const renderSessionMenu = (props) => {
  const overlay = renderComponent(sessionMenu.component, props)
  assert.equal(overlay.props['data-knowledge-session-menu-overlay'], '')
  return renderComponent(overlay.props.children.type, overlay.props.children.props)
}
const injectedMenuProps = sessionMenu.options.inject()
assert.equal(injectedMenuProps.workspaceSource, services.workspaces.list)
assert.equal(injectedMenuProps.sessionSource, services.sessions.list)
injectedMenuProps.startSession('knowledge')
injectedMenuProps.open('s-old')
assert.deepEqual(calls.slice(-2), [['start', 'knowledge'], ['open', 's-old']])
calls.length = 0
rendered = renderSessionMenu(menuProps)
let menuNodes = flatten(rendered)
assert.equal(menuOverlayElement.style.values['--eisKnowledge-sidebar-right'], '312px')
notifySidebarResize(56)
assert.equal(menuOverlayElement.style.values['--eisKnowledge-sidebar-right'], '88px')
notifySidebarResize(420)
assert.equal(menuOverlayElement.style.values['--eisKnowledge-sidebar-right'], '452px')
notifyFrameMutation(56)
assert.equal(menuOverlayElement.style.values['--eisKnowledge-sidebar-right'], '88px')
sidebarLeft = 0
for (const listener of resizeListeners) listener()
assert.equal(menuOverlayElement.style.values['--eisKnowledge-sidebar-right'], '56px')
assert.match(menuNodes.filter((node) => typeof node === 'string').join('|'), /会话历史/)
assert.match(menuNodes.find((node) => node.props?.['aria-label']?.startsWith('会话历史')).props['aria-label'], /当前项目：知识库项目/)
assert.match(menuNodes.find((node) => node.props?.['aria-label']?.startsWith('会话历史')).props['aria-label'], /当前会话：当前对话/)
assert.equal(menuNodes.some((node) => node.props?.className === 'eisKnowledgeSessionMenuProject'), false)
assert.match(menuNodes.filter((node) => typeof node === 'string').join('|'), /会话历史/)
const menuButton = menuNodes.find((node) => node.props?.['aria-label']?.startsWith('会话历史'))
assert.equal(menuButton.props['aria-expanded'], 'true')
assert.ok(menuNodes.find((node) => node.props?.['data-knowledge-session-panel'] === ''))
menuButton.props.onClick()
rendered = renderSessionMenu(menuProps)
menuNodes = flatten(rendered)
assert.equal(menuNodes.find((node) => node.props?.['aria-label']?.startsWith('会话历史')).props['aria-expanded'], 'false')
assert.equal(menuNodes.some((node) => node.props?.['data-knowledge-session-panel'] === ''), false)
menuButton.props.onClick()
rendered = renderSessionMenu(menuProps)
menuNodes = flatten(rendered)
assert.match(menuNodes.filter((node) => typeof node === 'string').join('|'), /知识库项目|当前对话|历史对话/)
assert.doesNotMatch(menuNodes.filter((node) => typeof node === 'string').join('|'), /销售|重点客户|其他会话/)
assert.equal(menuNodes.some((node) => node.props?.['data-tree-node']?.startsWith('folder:')), false)
const defaultWorkspaceNew = menuNodes.find((node) => node.props?.['data-tree-workspace-new'] === 'knowledge')
assert.ok(defaultWorkspaceNew)
defaultWorkspaceNew.props.onClick()
assert.deepEqual(calls, [['start', 'knowledge']])
calls.length = 0
menuButton.props.onClick()
rendered = renderSessionMenu(menuProps)
menuNodes = flatten(rendered)
const currentSession = menuNodes.find((node) => node.props?.['data-tree-session'] === 's-current')
assert.equal(currentSession.props['aria-current'], 'page')
menuNodes.find((node) => node.props?.['aria-label'] === '搜索会话').props.onClick()
rendered = renderSessionMenu(menuProps)
menuNodes = flatten(rendered)
menuNodes.find((node) => node.type === 'input').props.onChange({ target: { value: '合同' } })
rendered = renderSessionMenu(menuProps)
await new Promise((resolve) => setTimeout(resolve, 220))
rendered = renderSessionMenu(menuProps)
menuNodes = flatten(rendered)
assert.match(menuNodes.filter((node) => typeof node === 'string').join('|'), /命中合同文本/)
menuNodes.find((node) => node.props?.['data-tree-session'] === 's-old').props.onClick()
assert.deepEqual(calls, [['search', '合同', false], ['open', 's-old']])
for (const cleanup of effectCleanups.values()) cleanup()
effectCleanups.clear()
assert.equal(resizeObservers.size, 0)
assert.equal(mutationObservers.size, 0)
assert.equal(resizeListeners.size, 0)
hookState.length = 0
effectState.length = 0
const emptyMenuProps = {
  workspaceSource: observable({ phase: 'ready', items: [], archivedSessionIds: [] }),
  sessionSource: observable({ phase: 'ready', current: undefined, ids: [], byId: {} }),
  startSession: () => {},
  open: () => {},
  searchSessions: async () => ({ items: [], hasMore: false })
}
const emptyMenu = flatten(renderSessionMenu(emptyMenuProps))
assert.ok(emptyMenu.find((node) => node.props?.['aria-label']?.startsWith('会话历史')), 'session history remains visible before the first message')
hookState.length = 0
effectState.length = 0
const otherWorkspaceProps = {
  workspaceSource: observable({ phase: 'ready', archivedSessionIds: [], items: [
    workspaceState.items[0],
    { workspaceId: 'sales', title: '销售项目', path: '/var/lib/dsh/workspaces/sales/销售', sessionIds: ['s-other'] }
  ] }),
  sessionSource: observable({ ...sessionState, ids: [...sessionState.ids, 's-other'], byId: { ...sessionState.byId, 's-other': { id: 's-other', displayTitle: '销售会话', updatedAt: 5 } } }),
  startSession: () => {},
  open: () => {},
  searchSessions: async () => ({ items: [], hasMore: false })
}
let otherWorkspaceNodes = flatten(renderSessionMenu(otherWorkspaceProps))
const otherWorkspaceText = otherWorkspaceNodes.filter((node) => typeof node === 'string').join('|')
assert.match(otherWorkspaceText, /销售项目|销售会话/)
assert.doesNotMatch(otherWorkspaceText, /重点客户/)
assert.equal(otherWorkspaceNodes.some((node) => node.props?.['data-tree-node']?.startsWith('folder:')), false)
for (const cleanup of effectCleanups.values()) cleanup()
effectCleanups.clear()
assert.equal(resizeObservers.size, 0)
assert.equal(mutationObservers.size, 0)
assert.equal(resizeListeners.size, 0)
hookState.length = 0
effectState.length = 0
const dock = slotRegistrations.find(({ options }) => options.id === '@eiscore/dsh-client-knowledge-ontology-dock')
assert.equal(dock.options.id, '@eiscore/dsh-client-knowledge-ontology-dock')
const dockProps = dock.options.inject()
const treeProps = registered.options.inject()
sidebarWidth = 280
sidebarFrame.style.gridTemplateColumns = '280px minmax(0, 1fr)'
let dockNodes = flatten(renderComponent(dock.component, dockProps))
assert.equal(dockNodes.find((node) => node.props?.['data-knowledge-ontology-dock'] === '').props['data-open'], 'false')
assert.equal(dockNodes.find((node) => node.props?.['aria-label'] === '展开本体知识栏').props['aria-label'], '展开本体知识栏')
assert.equal(documentRootStyle.values['--eisKnowledge-ontology-right'], '56px')
assert.equal(sidebarFrame.style.paddingRight, 'calc(12px + 56px)')
assert.equal(keyListeners.size, 0)
dockNodes.find((node) => node.props?.['aria-label'] === '展开本体知识栏').props.onClick()
dockNodes = flatten(renderComponent(dock.component, dockProps))
assert.equal(dockNodes.find((node) => node.props?.['data-knowledge-ontology-dock'] === '').props['data-open'], 'true')
assert.equal(documentRootStyle.values['--eisKnowledge-ontology-right'], '360px')
assert.equal(sidebarFrame.style.gridTemplateColumns, '280px minmax(0, 1fr)')
assert.equal(sidebarFrame.style.paddingRight, 'calc(12px + 360px)')
assert.equal(keyListeners.size, 1)
const body = dockNodes.find((node) => typeof node.type === 'function')
assert.equal(typeof body.props.loadOntology, 'function')
dockNodes.find((node) => node.props?.['aria-label'] === '收起本体知识栏').props.onClick()
dockNodes = flatten(renderComponent(dock.component, dockProps))
assert.equal(dockNodes.find((node) => node.props?.['data-knowledge-ontology-dock'] === '').props['data-open'], 'false')
assert.equal(sidebarFrame.style.gridTemplateColumns, '280px minmax(0, 1fr)')
assert.equal(sidebarFrame.style.paddingRight, 'calc(12px + 56px)')
assert.equal(documentRootStyle.values['--eisKnowledge-ontology-right'], '56px')
assert.equal(keyListeners.size, 0)
for (const width of [220, 160, 100, 56]) {
  notifySidebarResize(width)
  assert.equal(sidebarFrame.style.gridTemplateColumns, `${width}px minmax(0, 1fr)`)
}
assert.equal(sidebarFrame.style.paddingRight, 'calc(12px + 56px)')
treeProps.openOntology()
renderComponent(dock.component, dockProps)
for (const listener of keyListeners) listener({ key: 'Enter' })
assert.equal(renderComponent(dock.component, dockProps).props['data-open'], 'true')
for (const listener of keyListeners) listener({ key: 'Escape' })
assert.equal(renderComponent(dock.component, dockProps).props['data-open'], 'false')
assert.equal(keyListeners.size, 0)
treeProps.openOntology()
renderComponent(dock.component, dockProps)
for (const cleanup of effectCleanups.values()) cleanup()
assert.equal(keyListeners.size, 0)
assert.equal(sidebarFrame.style.paddingRight, '12px')
for (const cleanup of disposals) cleanup()
assert.equal(appended[0].removed, true)
console.log('PASS: existing-service boot contract, knowledge tree grouping/filter/search/open/new, internal ontology dock open/close/Escape, native details preserved, and cleanup')
