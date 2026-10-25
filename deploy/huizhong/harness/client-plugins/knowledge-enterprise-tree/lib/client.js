window.__ModuleLoader__.load({
  id: '@eiscore/dsh-client-knowledge-enterprise-tree',
  factory: (require) => {
    const React = require('react')
    const {
      IconCloseFill14,
      IconFolderClose16,
      IconFolderOpen16,
      IconProjectAddOutline16,
      IconSearchOutline16,
      IconTriangleRightFill14
    } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const ROOT_ID = 'enterprise-knowledge-root'
    const STYLE_ID = 'eiscore-knowledge-enterprise-tree-style'
    const styles = `
      .eisKnowledgeTree{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary)}
      .eisKnowledgeTreeHeader{height:42px;min-height:42px;display:flex;align-items:center;gap:6px;padding:0 8px}
      .eisKnowledgeTreeLabel{min-width:0;flex:1;font-size:13px;font-weight:500;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eisKnowledgeTreeIconButton{width:28px;height:28px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
      .eisKnowledgeTreeIconButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .eisKnowledgeTreeSearch{height:30px;min-height:30px;display:flex;align-items:center;gap:6px;margin:0 8px 6px;padding:0 8px;border:1px solid var(--dsw-alias-border-l4);border-radius:6px;color:var(--dsw-alias-label-tertiary)}
      .eisKnowledgeTreeSearch input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
      .eisKnowledgeTreeSearch input::placeholder{color:var(--dsw-alias-label-tertiary)}
      .eisKnowledgeTreeScroll{min-height:0;flex:1;overflow:auto;padding:2px 8px 10px}
      .eisKnowledgeTreeRow{height:34px;min-height:34px;display:flex;align-items:center;gap:2px;border-radius:8px}
      .eisKnowledgeTreeRow:hover,.eisKnowledgeTreeSession[aria-current="page"]{background:var(--dsw-alias-interactive-bg-hover)}
      .eisKnowledgeTreeNode,.eisKnowledgeTreeSession{height:100%;min-width:0;flex:1;display:flex;align-items:center;gap:6px;padding:0 6px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
      .eisKnowledgeTreeNode{padding-left:calc(6px + var(--eis-tree-depth,0)*14px)}
      .eisKnowledgeTreeSession{height:32px;min-height:32px;padding-left:calc(24px + var(--eis-tree-depth,0)*14px);font-size:13px;line-height:20px}
      .eisKnowledgeTreeNode:hover,.eisKnowledgeTreeSession:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .eisKnowledgeTreeDisclosure{width:14px;height:18px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption);transition:transform .15s var(--ds-ease-in-out)}
      .eisKnowledgeTreeDisclosure[data-open="true"]{transform:rotate(90deg)}
      .eisKnowledgeTreeFolder{width:16px;height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}
      .eisKnowledgeTreeNodeLabel,.eisKnowledgeTreeSessionLabel{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
      .eisKnowledgeTreeSessionLabel{font-size:13px}
      .eisKnowledgeTreeCurrent{color:var(--dsw-alias-state-business-primary)}
      .eisKnowledgeTreeStatus{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:8px 10px}
      .eisKnowledgeTreeRail{height:40px;display:flex;align-items:center;justify-content:center}
      @media(prefers-reduced-motion:reduce){.eisKnowledgeTreeDisclosure{transition:none}}
    `

    const folderSegments = (path) => {
      const parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean)
      const marker = parts.lastIndexOf('workspaces')
      if (marker < 0 || marker + 1 >= parts.length) return []
      return parts.slice(marker + 2).filter((part) => part !== '.' && part !== '..')
    }

    const makeTree = (workspaces, sessions, archived) => {
      const root = { id: ROOT_ID, title: '企业知识库', kind: 'root', children: [] }
      const folderIndex = new Map([[ROOT_ID, root]])
      const accounted = new Set()
      for (const workspace of workspaces) {
        let parent = root
        let folderPath = ''
        for (const segment of folderSegments(workspace.path)) {
          folderPath += `/${segment}`
          const id = `folder:${folderPath}`
          let folder = folderIndex.get(id)
          if (!folder) {
            folder = { id, title: segment, kind: 'folder', children: [] }
            folderIndex.set(id, folder)
            parent.children.push(folder)
          }
          parent = folder
        }
        const workspaceNode = {
          id: `workspace:${workspace.workspaceId}`,
          title: workspace.title || '未命名工作区',
          kind: 'workspace',
          workspaceId: workspace.workspaceId,
          children: []
        }
        for (const sessionId of Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []) {
          const session = sessions.byId?.[sessionId]
          if (!session || archived.has(sessionId) || session.origin === 'subagent' || (session.blank && sessionId !== sessions.current)) continue
          accounted.add(sessionId)
          workspaceNode.children.push({
            id: `session:${sessionId}`,
            title: session.blank ? '新会话' : session.displayTitle || session.title || '未命名会话',
            kind: 'session',
            sessionId,
            blank: session.blank === true
          })
        }
        parent.children.push(workspaceNode)
      }
      const stray = (sessions.ids || []).map((id) => sessions.byId?.[id]).filter((session) =>
        session && !accounted.has(session.id) && !archived.has(session.id)
        && session.origin !== 'subagent' && (!session.blank || session.id === sessions.current)
      )
      if (stray.length) root.children.push({
        id: 'ungrouped-sessions',
        title: '其他会话',
        kind: 'folder',
        children: stray.map((session) => ({
          id: `session:${session.id}`,
          title: session.blank ? '新会话' : session.displayTitle || session.title || '未命名会话',
          kind: 'session',
          sessionId: session.id,
          blank: session.blank === true
        }))
      })
      return root
    }

    const EnterpriseWorkspaceTree = ({ wide, expandSidebar, useWorkspaces, useSessions, startSession, open, searchSessions }) => {
      const workspaceState = useWorkspaces((state) => state)
      const sessionState = useSessions((state) => state)
      const workspaces = workspaceState.items || []
      const tree = makeTree(workspaces, sessionState, new Set(workspaceState.archivedSessionIds || []))
      const initialExpanded = [ROOT_ID]
        .concat(workspaces.flatMap((workspace) => {
          const segments = folderSegments(workspace.path)
          const folderIds = segments.map((_, index) => `folder:/${segments.slice(0, index + 1).join('/')}`)
          return [...folderIds, `workspace:${workspace.workspaceId}`]
        }))
      const [expanded, setExpanded] = React.useState(() => new Set(initialExpanded))
      const [searchOpen, setSearchOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [searchState, setSearchState] = React.useState({ query: '', status: 'idle', items: [], hasMore: false })
      const normalizedQuery = query.trim()

      React.useEffect(() => {
        const currentWorkspace = workspaces.find((workspace) => workspace.sessionIds.includes(sessionState.current))
        if (!currentWorkspace) return
        const ids = [ROOT_ID, ...folderSegments(currentWorkspace.path).map((_, index, parts) => `folder:/${parts.slice(0, index + 1).join('/')}`), `workspace:${currentWorkspace.workspaceId}`]
        setExpanded((previous) => new Set([...previous, ...ids]))
      }, [sessionState.current, workspaces])

      React.useEffect(() => {
        if (!normalizedQuery) {
          setSearchState({ query: '', status: 'idle', items: [], hasMore: false })
          return
        }
        const controller = new AbortController()
        setSearchState({ query: normalizedQuery, status: 'loading', items: [], hasMore: false })
        const timer = window.setTimeout(() => {
          searchSessions(normalizedQuery, controller.signal).then((result) => {
            if (controller.signal.aborted) return
            setSearchState({ query: normalizedQuery, status: 'ready', items: result.items, hasMore: result.hasMore })
          }).catch(() => {
            if (controller.signal.aborted) return
            setSearchState({ query: normalizedQuery, status: 'error', items: [], hasMore: false })
          })
        }, 180)
        return () => { window.clearTimeout(timer); controller.abort() }
      }, [normalizedQuery, searchSessions])

      const toggle = (id) => setExpanded((previous) => {
        const next = new Set(previous)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      const folderIcon = (isOpen) => h(isOpen ? IconFolderOpen16 : IconFolderClose16, {})
      const renderSession = (node, depth, snippet) => h('button', {
        key: node.id,
        type: 'button',
        className: 'eisKnowledgeTreeSession',
        style: { '--eis-tree-depth': depth },
        'aria-current': sessionState.current === node.sessionId ? 'page' : undefined,
        'data-tree-session': node.sessionId,
        title: node.title,
        onClick: () => open(node.sessionId)
      }, h('span', { className: 'eisKnowledgeTreeSessionLabel' }, node.title), snippet ? h('span', { className: 'eisKnowledgeTreeStatus' }, snippet) : null)
      const renderNode = (node, depth) => {
        const isOpen = expanded.has(node.id)
        if (node.kind === 'session') return renderSession(node, depth)
        const children = node.children || []
        return h('div', { key: node.id, className: 'eisKnowledgeTreeBranch' },
          h('div', { className: 'eisKnowledgeTreeRow' },
            h('button', {
              type: 'button',
              className: 'eisKnowledgeTreeNode',
              style: { '--eis-tree-depth': depth },
              'aria-expanded': String(isOpen),
              'data-tree-node': node.id,
              onClick: () => toggle(node.id)
            },
            h('span', { className: 'eisKnowledgeTreeDisclosure', 'data-open': String(isOpen), 'aria-hidden': 'true' }, h(IconTriangleRightFill14, {})),
            h('span', { className: 'eisKnowledgeTreeFolder', 'aria-hidden': 'true' }, folderIcon(isOpen)),
            h('span', { className: 'eisKnowledgeTreeNodeLabel' }, node.title)),
            node.kind === 'workspace' && wide ? h('button', {
              type: 'button',
              className: 'eisKnowledgeTreeIconButton',
              'aria-label': `在${node.title}中新建会话`,
              title: '新建会话',
              'data-tree-workspace-new': node.workspaceId,
              onClick: () => startSession(node.workspaceId)
            }, h(IconProjectAddOutline16, { size: 16 })) : null
          ),
          isOpen ? children.map((child) => renderNode(child, depth + 1)) : null
        )
      }
      const renderSearchResult = (item) => {
        const session = sessionState.byId?.[item.sessionId]
        if (!session) return null
        const title = session.blank ? '新会话' : session.displayTitle || session.title || '未命名会话'
        return renderSession({ id: `search:${item.sessionId}`, sessionId: item.sessionId, title }, 0, item.snippet)
      }

      if (!wide) return h('div', { className: 'eisKnowledgeTreeRail' }, h('button', {
        type: 'button',
        className: 'eisKnowledgeTreeIconButton',
        'aria-label': '展开企业知识库分类',
        title: '展开企业知识库分类',
        onClick: expandSidebar
      }, h(IconFolderClose16, { size: 18 })))

      return h('div', { className: 'eisKnowledgeTree', 'data-enterprise-tree': '' },
        h('div', { className: 'eisKnowledgeTreeHeader' },
          h('span', { className: 'eisKnowledgeTreeLabel' }, '工作区'),
          h('button', {
            type: 'button',
            className: 'eisKnowledgeTreeIconButton',
            'aria-label': searchOpen ? '关闭搜索' : '搜索会话',
            title: searchOpen ? '关闭搜索' : '搜索会话',
            onClick: () => { setSearchOpen((value) => !value); setQuery('') }
          }, searchOpen ? h(IconCloseFill14, {}) : h(IconSearchOutline16, { size: 16 }))
        ),
        searchOpen ? h('label', { className: 'eisKnowledgeTreeSearch' },
          h(IconSearchOutline16, { size: 14 }),
          h('input', {
            type: 'search',
            value: query,
            placeholder: '搜索会话内容',
            'aria-label': '搜索会话内容',
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Escape') setQuery('') }
          })
        ) : null,
        h('div', { className: 'eisKnowledgeTreeScroll', role: 'tree', 'aria-label': '企业知识库分类' },
          normalizedQuery ? searchState.status === 'loading'
            ? h('div', { className: 'eisKnowledgeTreeStatus' }, '搜索中…')
            : searchState.status === 'error'
              ? h('div', { className: 'eisKnowledgeTreeStatus' }, '搜索暂不可用')
              : searchState.items.length
                ? h('div', { className: 'eisKnowledgeTreeSearchResults' },
                  h('div', { className: 'eisKnowledgeTreeStatus' }, '搜索结果'),
                  searchState.items.map(renderSearchResult),
                  searchState.hasMore ? h('div', { className: 'eisKnowledgeTreeStatus' }, '结果较多，请缩小搜索范围') : null)
                : h('div', { className: 'eisKnowledgeTreeStatus' }, '没有找到匹配的会话')
            : workspaceState.phase === 'pending' || sessionState.phase === 'pending'
              ? h('div', { className: 'eisKnowledgeTreeStatus' }, '正在加载会话…')
              : tree.children.length
                ? renderNode(tree, 0)
                : h('div', { className: 'eisKnowledgeTreeStatus' }, '暂无工作区')
        )
      )
    }

    return {
      inject: ['slots', 'sessions', 'uiWorkspace', 'workspaces'],
      apply(ctx) {
        const sessions = ctx.get('sessions')
        const uiWorkspace = ctx.get('uiWorkspace')
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = styles
        document.head.appendChild(style)
        ctx.on('dispose', () => style.remove())
        ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
          name: 'sidebar.workspaces',
          inject: () => ({
            startSession: (workspaceId) => uiWorkspace.startSession(workspaceId),
            open: (sessionId) => sessions.open(sessionId),
            searchSessions: async (query, signal) => {
              const result = await sessions.search(query, signal)
              if (!result.ok) throw new Error(result.error.message)
              return result.value
            }
          })
        }, EnterpriseWorkspaceTree))
      }
    }
  }
})
