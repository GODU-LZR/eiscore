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
      .eisKnowledgeTree{height:100%;min-height:0;display:flex;flex:1;flex-direction:column;color:var(--dsw-alias-label-primary)}
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
      .eisKnowledgeTreeNode{padding-left:calc(6px + var(--eis-tree-indent,0px))}
      .eisKnowledgeTreeSession{height:32px;min-height:32px;padding-left:calc(24px + var(--eis-tree-indent,0px));font-size:13px;line-height:20px}
      .eisKnowledgeTreeNode:hover,.eisKnowledgeTreeSession:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .eisKnowledgeTreeDisclosure{width:14px;height:18px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption);transition:transform .15s var(--ds-ease-in-out)}
      .eisKnowledgeTreeDisclosure[data-open="true"]{transform:rotate(90deg)}
      .eisKnowledgeTreeFolder{width:16px;height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}
      .eisKnowledgeTreeNodeLabel,.eisKnowledgeTreeSessionLabel{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
      .eisKnowledgeTreeSessionLabel{font-size:13px}
      .eisKnowledgeTreeCurrent{color:var(--dsw-alias-state-business-primary)}
      .eisKnowledgeTreeStatus{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:8px 10px}
      .eisKnowledgeTreeRail{height:40px;display:flex;align-items:center;justify-content:center}
      .eisKnowledgeFiles{min-height:0;flex:1;display:flex;flex-direction:column;margin:0 8px 6px;border:1px solid var(--dsw-alias-border-l4);border-radius:8px;overflow:hidden}
      .eisKnowledgeFilesHeader{height:34px;display:flex;align-items:center;gap:5px;padding:0 8px;background:var(--dsw-alias-fill-l3)}
      .eisKnowledgeFilesHeader strong{min-width:0;flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eisKnowledgeFilesAction{height:24px;min-width:24px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:11px}
      .eisKnowledgeFilesAction:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .eisKnowledgeFilesList{min-height:0;flex:1;overflow:auto;padding:3px 5px 5px}
      .eisKnowledgeFileRow{height:27px;display:flex;align-items:center;gap:5px;padding:0 5px;border-radius:5px;color:var(--dsw-alias-label-secondary);font-size:12px}
      .eisKnowledgeFileRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .eisKnowledgeFileName{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eisKnowledgeFileMeta{color:var(--dsw-alias-label-caption);font-size:10px;white-space:nowrap}
      .eisKnowledgeFileAction{height:22px;min-width:22px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer;font:inherit;font-size:10px}
      .eisKnowledgeFileAction:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .eisKnowledgeFilesStatus{padding:7px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
      .eisKnowledgeFilePreview{max-height:120px;overflow:auto;margin:0 5px 5px;padding:6px;border-radius:5px;background:var(--dsw-alias-fill-l3);color:var(--dsw-alias-label-secondary);font:10px/15px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
      .eisKnowledgeFilesInput{display:none}
      .eisKnowledgeSessionMenuOverlay{position:absolute;inset:0;z-index:21;pointer-events:none}
      .eisKnowledgeSessionMenuOverlay>.eisKnowledgeSessionMenu{position:absolute;top:0;right:0;left:max(64px,var(--eisKnowledge-sidebar-width,64px));pointer-events:auto}
      .eisKnowledgeSessionMenu{position:relative;display:block;min-width:0;z-index:12}
      .eisKnowledgeSessionMenuButton{width:100%;display:flex;align-items:center;gap:8px;height:42px;min-width:0;padding:0 16px;border:0;border-bottom:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:13px;line-height:20px;text-align:left}
      .eisKnowledgeSessionMenuButton:hover,.eisKnowledgeSessionMenuButton[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .eisKnowledgeSessionMenuButtonIcon{display:inline-flex;flex:none;color:var(--dsw-alias-label-tertiary)}
      .eisKnowledgeSessionMenuWorkspace{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eisKnowledgeSessionMenuProject{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px}
      .eisKnowledgeSessionMenuDisclosure{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary);transform:rotate(90deg);transition:transform .15s var(--ds-ease-in-out)}
      .eisKnowledgeSessionMenuDisclosure[data-open="true"]{transform:rotate(-90deg)}
      .eisKnowledgeSessionMenuPanel{box-sizing:border-box;position:relative;width:100%;max-height:min(420px,55vh);display:flex;flex-direction:column;overflow:hidden;padding:6px;border-bottom:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);box-shadow:0 8px 28px #0002;color:var(--dsw-alias-label-primary)}
      .eisKnowledgeSessionMenuTitle{min-height:30px;display:flex;align-items:center;justify-content:space-between;padding:0 4px 3px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
      .eisKnowledgeSessionMenuSearch{height:30px;min-height:30px;display:flex;align-items:center;gap:6px;margin:0 2px 5px;padding:0 7px;border:1px solid var(--dsw-alias-border-l4);border-radius:6px;color:var(--dsw-alias-label-tertiary)}
      .eisKnowledgeSessionMenuSearch input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
      .eisKnowledgeSessionMenuScroll{min-height:0;overflow:auto;padding:1px 2px 4px}
      .eisKnowledgeSessionMenu .eisKnowledgeTreeRow{height:32px;min-height:32px}
      .eisKnowledgeSessionMenu .eisKnowledgeTreeNodeLabel{font-size:12px}
      .eisKnowledgeSessionMenu .eisKnowledgeTreeSession{height:30px;min-height:30px;font-size:12px}
      .eisKnowledgeSessionMenu .eisKnowledgeTreeSessionLabel{font-size:12px}
      .eisKnowledgeSessionMenuNew{flex:none;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
      .eisKnowledgeSessionMenuNew:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .eisKnowledgeSessionMenuStatus{padding:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      @media(max-width:600px){.eisKnowledgeSessionMenuButton{height:38px;padding:0 10px}.eisKnowledgeSessionMenuPanel{max-height:55vh}}
      .eisKnowledgeOntologyDock{position:absolute;inset:0 0 0 auto;box-sizing:border-box;width:min(360px,100%);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l3);box-shadow:-8px 0 24px #0001;color:var(--dsw-alias-label-primary)}
      .eisKnowledgeOntologyDockHeader{height:42px;min-height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--dsw-alias-border-l4);font-size:13px;font-weight:500}
      .eisKnowledgeOntologyTab{height:100%;min-height:0;display:flex;flex-direction:column;padding:12px;color:var(--dsw-alias-label-primary);overflow:hidden}
      .eisKnowledgeOntologyHeader{display:flex;align-items:center;gap:8px;margin-bottom:10px}
      .eisKnowledgeOntologyHeader strong{min-width:0;flex:1;font-size:14px;font-weight:600}
      .eisKnowledgeOntologyRefresh{height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11px}
      .eisKnowledgeOntologyRefresh:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .eisKnowledgeOntologyStats{display:flex;gap:12px;margin-bottom:8px;color:var(--dsw-alias-label-tertiary);font-size:11px}
      .eisKnowledgeOntologyList{min-height:0;overflow:auto;display:grid;gap:4px}
      .eisKnowledgeOntologyNode{display:flex;align-items:center;gap:7px;min-height:30px;padding:4px 6px;border-radius:6px;background:var(--dsw-alias-fill-l3);font-size:12px}
      .eisKnowledgeOntologyNodeType{color:var(--dsw-alias-label-caption);font-size:10px}
      .eisKnowledgeOntologyNodeLabel{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eisKnowledgeOntologyEmpty{padding:10px 2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      @media(prefers-reduced-motion:reduce){.eisKnowledgeTreeDisclosure{transition:none}}
    `

    const KNOWLEDGE_FILES_PATH = '/harness-knowledge-agent/twin/knowledge/files'
    const KNOWLEDGE_ONTOLOGY_PATH = '/harness-knowledge-agent/twin/knowledge/ontology/context'

    const getAuthorization = () => {
      try {
        const raw = window.localStorage?.getItem('auth_token') || ''
        if (!raw) return {}
        let token = raw
        try {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object' && parsed.token) token = parsed.token
        } catch {}
        return token ? { Authorization: `Bearer ${token}` } : {}
      } catch {
        return {}
      }
    }

    const requestKnowledge = async (path, options = {}) => {
      const response = await fetch(path, {
        ...options,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', ...getAuthorization(), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
      })
      if (!response.ok) throw new Error(`知识库请求失败（${response.status}）`)
      return response.json()
    }

    const listKnowledgeFiles = async () => {
      const result = await requestKnowledge(KNOWLEDGE_FILES_PATH)
      return Array.isArray(result?.files) ? result.files : []
    }

    const readKnowledgeFile = async (id) => {
      const result = await requestKnowledge(`${KNOWLEDGE_FILES_PATH}?id=${encodeURIComponent(id)}`)
      return result?.file || null
    }

    const uploadKnowledgeFile = async (file) => {
      const isText = file.type?.startsWith('text/') || /\.(csv|json|md|txt|xml|yaml|yml|log)$/i.test(file.name)
      const text = isText ? await file.text() : ''
      let contentB64 = ''
      if (!isText) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        let binary = ''
        for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
        contentB64 = btoa(binary)
      }
      return requestKnowledge(KNOWLEDGE_FILES_PATH, {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, fileType: file.type || 'application/octet-stream', fileSize: file.size, contentText: text.slice(0, 200000), contentB64, summary: '', tags: [], metadata: {} })
      })
    }

    const updateKnowledgeFile = (id, patch) => requestKnowledge(`${KNOWLEDGE_FILES_PATH}?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    })

    const deleteKnowledgeFile = (id) => requestKnowledge(`${KNOWLEDGE_FILES_PATH}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })

    const loadKnowledgeOntology = async () => requestKnowledge(KNOWLEDGE_ONTOLOGY_PATH)

    const isDefaultKnowledgeWorkspace = (workspace) => {
      const pathParts = String(workspace?.path || '').replace(/\\/g, '/').split('/').filter(Boolean)
      const marker = pathParts.lastIndexOf('workspaces')
      return workspace?.workspaceId === 'knowledge' || marker >= 0 && pathParts[marker + 1] === 'knowledge'
    }

    const makeTree = (workspaces, sessions, archived) => {
      const root = { id: ROOT_ID, title: '知识库项目', kind: 'root', children: [] }
      const accounted = new Set()
      for (const workspace of workspaces) {
        const isDefault = isDefaultKnowledgeWorkspace(workspace)
        const parent = isDefault ? root : {
          id: `workspace:${workspace.workspaceId}`,
          title: workspace.title || '未命名工作区',
          kind: 'workspace',
          workspaceId: workspace.workspaceId,
          children: []
        }
        if (isDefault) root.workspaceId = workspace.workspaceId
        for (const sessionId of Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []) {
          const session = sessions.byId?.[sessionId]
          if (!session || archived.has(sessionId) || session.origin === 'subagent' || (session.blank && sessionId !== sessions.current)) continue
          accounted.add(sessionId)
          parent.children.push({
            id: `session:${sessionId}`,
            title: session.blank ? '新会话' : session.displayTitle || session.title || '未命名会话',
            kind: 'session',
            sessionId,
            blank: session.blank === true
          })
        }
        if (!isDefault) root.children.push(parent)
      }
      const stray = (sessions.ids || []).map((id) => sessions.byId?.[id]).filter((session) =>
        session && !accounted.has(session.id) && !archived.has(session.id)
        && session.origin !== 'subagent' && (!session.blank || session.id === sessions.current)
      )
      if (stray.length) root.children.push(...stray.map((session) => ({
          id: `session:${session.id}`,
          title: session.blank ? '新会话' : session.displayTitle || session.title || '未命名会话',
          kind: 'session',
          sessionId: session.id,
          blank: session.blank === true
        })))
      return root
    }

    const KnowledgeFilesSection = ({ listFiles, readFile, uploadFile, updateFile, deleteFile, openOntology }) => {
      const [files, setFiles] = React.useState([])
      const [status, setStatus] = React.useState('loading')
      const [busy, setBusy] = React.useState(false)
      const [selected, setSelected] = React.useState(null)
      const refresh = React.useCallback ? React.useCallback(async () => {
        if (typeof listFiles !== 'function') return
        setStatus('loading')
        try {
          setFiles(await listFiles())
          setStatus('ready')
        } catch {
          setStatus('error')
        }
      }, [listFiles]) : async () => {}
      React.useEffect(() => { refresh() }, [refresh])
      const handleUpload = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file || typeof uploadFile !== 'function') return
        setBusy(true)
        try {
          await uploadFile(file)
          await refresh()
        } catch {
          setStatus('error')
        } finally {
          setBusy(false)
        }
      }
      const handleRead = async (file) => {
        if (!file?.id || typeof readFile !== 'function') return
        setBusy(true)
        try { setSelected(await readFile(file.id) || file) } catch { setStatus('error') } finally { setBusy(false) }
      }
      const handleRename = async (file) => {
        if (!file?.id || typeof updateFile !== 'function') return
        const name = window.prompt('重命名文件', file.file_name || file.name || '')?.trim()
        if (!name || name === file.file_name) return
        setBusy(true)
        try { await updateFile(file.id, { fileName: name }); await refresh(); setSelected((value) => value?.id === file.id ? { ...value, file_name: name } : value) } catch { setStatus('error') } finally { setBusy(false) }
      }
      const handleDelete = async (file) => {
        if (!file?.id || typeof deleteFile !== 'function' || !window.confirm(`确认删除“${file.file_name || file.name || '未命名文件'}”吗？`)) return
        setBusy(true)
        try { await deleteFile(file.id); setSelected((value) => value?.id === file.id ? null : value); await refresh() } catch { setStatus('error') } finally { setBusy(false) }
      }
      return h('section', { className: 'eisKnowledgeFiles', 'data-knowledge-files': '' },
        h('div', { className: 'eisKnowledgeFilesHeader' },
          h('strong', null, '知识文件'),
          h('button', { type: 'button', className: 'eisKnowledgeFilesAction', onClick: refresh, disabled: busy, title: '刷新文件列表' }, '刷新'),
          h('label', { className: 'eisKnowledgeFilesAction', title: '上传文件' },
            busy ? '上传中' : '上传',
            h('input', { className: 'eisKnowledgeFilesInput', type: 'file', onChange: handleUpload, disabled: busy }))
        ),
        h('div', { className: 'eisKnowledgeFilesList' },
          status === 'loading' ? h('div', { className: 'eisKnowledgeFilesStatus' }, '正在加载文件…')
            : status === 'error' ? h('div', { className: 'eisKnowledgeFilesStatus' }, '文件列表暂不可用')
              : files.length ? files.map((file) => h('div', { key: file.id, className: 'eisKnowledgeFileRow', title: file.file_name || file.name },
                h('button', { type: 'button', className: 'eisKnowledgeFileName', onClick: () => handleRead(file) }, file.file_name || file.name || '未命名文件'),
                h('span', { className: 'eisKnowledgeFileMeta' }, file.file_size ? `${Math.ceil(Number(file.file_size) / 1024)}KB` : ''),
                h('button', { type: 'button', className: 'eisKnowledgeFileAction', onClick: () => handleRename(file), disabled: busy, title: '重命名文件' }, '改'),
                h('button', { type: 'button', className: 'eisKnowledgeFileAction', onClick: () => handleDelete(file), disabled: busy, title: '删除文件' }, '删'))
                ) : h('div', { className: 'eisKnowledgeFilesStatus' }, '暂无文件')
        ),
        selected ? h('pre', { className: 'eisKnowledgeFilePreview', 'data-knowledge-file-preview': selected.id }, selected.content_text || `${selected.file_name || selected.name || '文件'}（${selected.file_type || '未知类型'}）`) : null,
        h('button', { type: 'button', className: 'eisKnowledgeFilesAction', onClick: openOntology, style: { width: '100%', justifyContent: 'flex-start', padding: '0 8px' }, title: '打开本体面板' }, '打开本体面板')
      )
    }

    const KnowledgeOntologyBody = ({ loadOntology }) => {
      const [context, setContext] = React.useState({ nodes: [], edges: [] })
      const [status, setStatus] = React.useState('loading')
      const load = async () => {
        if (typeof loadOntology !== 'function') return
        setStatus('loading')
        try {
          const next = await loadOntology()
          setContext({ nodes: Array.isArray(next?.nodes) ? next.nodes : [], edges: Array.isArray(next?.edges) ? next.edges : [] })
          setStatus('ready')
        } catch {
          setStatus('error')
        }
      }
      React.useEffect(() => { load() }, [])
      return h('section', { className: 'eisKnowledgeOntologyTab', 'data-knowledge-ontology': '' },
        h('div', { className: 'eisKnowledgeOntologyHeader' },
          h('strong', null, '本体知识库'),
          h('button', { type: 'button', className: 'eisKnowledgeOntologyRefresh', onClick: load }, '刷新')),
        status === 'loading' ? h('div', { className: 'eisKnowledgeOntologyEmpty' }, '正在加载本体…')
          : status === 'error' ? h('div', { className: 'eisKnowledgeOntologyEmpty' }, '本体暂不可用')
            : h(React.Fragment, null,
              h('div', { className: 'eisKnowledgeOntologyStats' }, h('span', null, `${context.nodes.length} 个节点`), h('span', null, `${context.edges.length} 条关系`)),
              context.nodes.length ? h('div', { className: 'eisKnowledgeOntologyList', role: 'tree' }, context.nodes.slice(0, 200).map((node) => h('div', { key: node.id, className: 'eisKnowledgeOntologyNode', role: 'treeitem', title: node.label || node.id },
                h('span', { className: 'eisKnowledgeOntologyNodeLabel' }, node.label || node.name || node.id),
                h('span', { className: 'eisKnowledgeOntologyNodeType' }, node.type || '节点'))))
                : h('div', { className: 'eisKnowledgeOntologyEmpty' }, '暂无可见本体'))
      )
    }

    const KnowledgeOntologyDock = ({ getOpen, subscribe, close, loadOntology }) => {
      const [open, setOpen] = React.useState(getOpen)
      React.useEffect(() => {
        const unsubscribe = subscribe(setOpen)
        setOpen(getOpen())
        return unsubscribe
      }, [getOpen, subscribe])
      React.useEffect(() => {
        if (!open) return
        const onKeyDown = (event) => { if (event.key === 'Escape') close() }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [open, close])
      if (!open) return null
      return h('aside', { className: 'eisKnowledgeOntologyDock', 'aria-label': '本体面板', 'data-knowledge-ontology-dock': '' },
        h('div', { className: 'eisKnowledgeOntologyDockHeader' },
          h('span', null, '本体'),
          h('button', { type: 'button', className: 'eisKnowledgeTreeIconButton', onClick: close, 'aria-label': '关闭本体面板', title: '关闭本体面板' }, h(IconCloseFill14, {}))),
        h(KnowledgeOntologyBody, { loadOntology }))
    }

    const useLiveSnapshot = (source, fallback) => {
      const [snapshot, setSnapshot] = React.useState(() => source?.getSnapshot?.() || fallback)
      React.useEffect(() => {
        if (!source?.subscribe) return undefined
        setSnapshot(source.getSnapshot())
        return source.subscribe(() => setSnapshot(source.getSnapshot()))
      }, [source])
      return snapshot
    }

    const EnterpriseWorkspaceTree = ({ wide, expandSidebar, listFiles, readFile, uploadFile, updateFile, deleteFile, openOntology }) => {
      if (!wide) return h('div', { className: 'eisKnowledgeTreeRail' }, h('button', {
        type: 'button',
        className: 'eisKnowledgeTreeIconButton',
        'aria-label': '展开知识文件管理',
        title: '展开知识文件管理',
        onClick: expandSidebar
      }, h(IconFolderClose16, { size: 18 })))

      return h('div', { className: 'eisKnowledgeTree', 'data-enterprise-tree': '' },
        h(KnowledgeFilesSection, { listFiles, readFile, uploadFile, updateFile, deleteFile, openOntology }),
      )
    }

    const WorkspaceSessionMenu = ({ workspaceSource, sessionSource, startSession, open, searchSessions }) => {
      const workspaceState = useLiveSnapshot(workspaceSource, { phase: 'pending', items: [], archivedSessionIds: [] })
      const sessionState = useLiveSnapshot(sessionSource, { phase: 'pending', current: undefined, ids: [], byId: {} })
      const workspaces = workspaceState.items || []
      const tree = makeTree(workspaces, sessionState, new Set(workspaceState.archivedSessionIds || []))
      const currentWorkspace = workspaces.find((workspace) => (workspace.sessionIds || []).includes(sessionState.current)) || workspaces.find(isDefaultKnowledgeWorkspace)
      const currentSession = sessionState.byId?.[sessionState.current]
      const currentSessionTitle = currentSession?.blank ? '新会话' : currentSession?.displayTitle || currentSession?.title || '选择会话'
      const currentProjectTitle = currentWorkspace ? isDefaultKnowledgeWorkspace(currentWorkspace) ? '知识库项目' : currentWorkspace.title || '未命名项目' : '知识库项目'
      const initialExpanded = [ROOT_ID].concat(workspaces.filter((workspace) => !isDefaultKnowledgeWorkspace(workspace)).map((workspace) => `workspace:${workspace.workspaceId}`))
      const [menuOpen, setMenuOpen] = React.useState(true)
      const [expanded, setExpanded] = React.useState(() => new Set(initialExpanded))
      const [searchOpen, setSearchOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [searchState, setSearchState] = React.useState({ status: 'idle', items: [], hasMore: false })
      const normalizedQuery = query.trim()

      React.useEffect(() => {
        if (!menuOpen) return undefined
        const onKeyDown = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [menuOpen])
      React.useEffect(() => {
        const current = currentWorkspace
        if (!current) return
        const ids = [ROOT_ID]
        if (!isDefaultKnowledgeWorkspace(current)) ids.push(`workspace:${current.workspaceId}`)
        setExpanded((previous) => new Set([...previous, ...ids]))
      }, [sessionState.current, currentWorkspace])
      React.useEffect(() => {
        if (!menuOpen || !normalizedQuery) {
          setSearchState({ status: 'idle', items: [], hasMore: false })
          return
        }
        const controller = new AbortController()
        setSearchState({ status: 'loading', items: [], hasMore: false })
        const timer = window.setTimeout(() => {
          searchSessions(normalizedQuery, controller.signal).then((result) => {
            if (!controller.signal.aborted) setSearchState({ status: 'ready', items: result.items, hasMore: result.hasMore })
          }).catch(() => {
            if (!controller.signal.aborted) setSearchState({ status: 'error', items: [], hasMore: false })
          })
        }, 180)
        return () => { window.clearTimeout(timer); controller.abort() }
      }, [menuOpen, normalizedQuery, searchSessions])
      React.useEffect(() => {
        const menuOverlay = document.querySelector?.('[data-knowledge-session-menu-overlay]')
        const frame = menuOverlay?.parentElement?.parentElement
        if (!menuOverlay || !frame) return undefined
        const update = () => {
          const firstTrack = String(frame.style?.gridTemplateColumns || '').match(/^\s*([\d.]+)px/)
          menuOverlay.style?.setProperty?.('--eisKnowledge-sidebar-width', `${firstTrack ? Number(firstTrack[1]) : 0}px`)
        }
        update()
        const observer = new MutationObserver(update)
        observer.observe(frame, { attributes: true, attributeFilter: ['style'] })
        return () => observer.disconnect()
      }, [])

      const toggle = (id) => setExpanded((previous) => {
        const next = new Set(previous)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      const selectSession = (id) => { open(id); setMenuOpen(false) }
      const createSession = (workspaceId) => { startSession(workspaceId); setMenuOpen(false) }
      const folderIcon = (isOpen) => h(isOpen ? IconFolderOpen16 : IconFolderClose16, {})
      const renderSession = (node, depth, snippet) => h('button', {
        key: node.id,
        type: 'button',
        className: 'eisKnowledgeTreeSession',
        style: { '--eis-tree-indent': `${depth * 14}px` },
        'aria-current': sessionState.current === node.sessionId ? 'page' : undefined,
        'data-tree-session': node.sessionId,
        title: node.title,
        onClick: () => selectSession(node.sessionId)
      }, h('span', { className: 'eisKnowledgeTreeSessionLabel' }, node.title), snippet ? h('span', { className: 'eisKnowledgeTreeStatus' }, snippet) : null)
      const renderNode = (node, depth) => {
        const isOpen = expanded.has(node.id)
        if (node.kind === 'session') return renderSession(node, depth)
        const children = node.children || []
        return h('div', { key: node.id, className: 'eisKnowledgeTreeBranch' },
          h('div', { className: 'eisKnowledgeTreeRow' },
            h('button', { type: 'button', className: 'eisKnowledgeTreeNode', style: { '--eis-tree-indent': `${depth * 14}px` }, 'aria-expanded': String(isOpen), 'data-tree-node': node.id, onClick: () => toggle(node.id) },
              h('span', { className: 'eisKnowledgeTreeDisclosure', 'data-open': String(isOpen), 'aria-hidden': 'true' }, h(IconTriangleRightFill14, {})),
              h('span', { className: 'eisKnowledgeTreeFolder', 'aria-hidden': 'true' }, folderIcon(isOpen)),
              h('span', { className: 'eisKnowledgeTreeNodeLabel' }, node.title)),
            node.workspaceId ? h('button', { type: 'button', className: 'eisKnowledgeSessionMenuNew', 'aria-label': `在${node.title}中新建会话`, title: '新建会话', 'data-tree-workspace-new': node.workspaceId, onClick: () => createSession(node.workspaceId) }, h(IconProjectAddOutline16, { size: 15 })) : null
          ),
          isOpen ? children.map((child) => renderNode(child, depth + 1)) : null
        )
      }
      const renderSearchResult = (item) => {
        const session = sessionState.byId?.[item.sessionId]
        if (!session) return null
        return renderSession({ id: `search:${item.sessionId}`, sessionId: item.sessionId, title: session.blank ? '新会话' : session.displayTitle || session.title || '未命名会话' }, 0, item.snippet)
      }

      return h('div', { className: 'eisKnowledgeSessionMenu', 'data-knowledge-session-menu': '' },
        h('button', { type: 'button', className: 'eisKnowledgeSessionMenuButton', 'aria-label': `会话历史，当前项目：${currentProjectTitle}，当前会话：${currentSessionTitle}`, title: `会话历史 · ${currentProjectTitle} · ${currentSessionTitle}`, 'aria-expanded': String(menuOpen), onClick: () => setMenuOpen((value) => !value) },
          h('span', { className: 'eisKnowledgeSessionMenuButtonIcon', 'aria-hidden': 'true' }, h(IconFolderOpen16, { size: 15 })),
          h('span', { className: 'eisKnowledgeSessionMenuWorkspace' }, '会话历史'),
          h('span', { className: 'eisKnowledgeSessionMenuProject' }, currentProjectTitle),
          h('span', { className: 'eisKnowledgeSessionMenuDisclosure', 'data-open': String(menuOpen), 'aria-hidden': 'true' }, h(IconTriangleRightFill14, {}))),
        menuOpen ? h('div', { className: 'eisKnowledgeSessionMenuPanel', role: 'region', 'aria-label': '项目和会话', 'data-knowledge-session-panel': '' },
          h('div', { className: 'eisKnowledgeSessionMenuTitle' },
            h('span', null, '项目与会话'),
            h('button', { type: 'button', className: 'eisKnowledgeTreeIconButton', 'aria-label': searchOpen ? '关闭搜索' : '搜索会话', title: searchOpen ? '关闭搜索' : '搜索会话', onClick: () => { setSearchOpen((value) => !value); setQuery('') } }, searchOpen ? h(IconCloseFill14, {}) : h(IconSearchOutline16, { size: 16 }))),
          searchOpen ? h('label', { className: 'eisKnowledgeSessionMenuSearch' }, h(IconSearchOutline16, { size: 14 }), h('input', { type: 'search', value: query, placeholder: '搜索会话内容', 'aria-label': '搜索会话内容', onChange: (event) => setQuery(event.target.value), onKeyDown: (event) => { if (event.key === 'Escape') setQuery('') } })) : null,
          h('div', { className: 'eisKnowledgeSessionMenuScroll', role: 'tree', 'aria-label': '项目和会话树' },
            normalizedQuery ? searchState.status === 'loading' ? h('div', { className: 'eisKnowledgeSessionMenuStatus' }, '搜索中…') : searchState.status === 'error' ? h('div', { className: 'eisKnowledgeSessionMenuStatus' }, '搜索暂不可用') : searchState.items.length ? searchState.items.map(renderSearchResult) : h('div', { className: 'eisKnowledgeSessionMenuStatus' }, '没有找到匹配的会话')
              : workspaceState.phase === 'pending' || sessionState.phase === 'pending' ? h('div', { className: 'eisKnowledgeSessionMenuStatus' }, '正在加载会话…') : tree.children.length ? renderNode(tree, 0) : h('div', { className: 'eisKnowledgeSessionMenuStatus' }, '暂无工作区'))
        ) : null
      )
    }

    const WorkspaceSessionMenuOverlay = (props) => h('div', { className: 'eisKnowledgeSessionMenuOverlay', 'data-knowledge-session-menu-overlay': '', style: { '--eisKnowledge-sidebar-width': '64px' } }, h(WorkspaceSessionMenu, props))

    return {
      inject: ['slots', 'sessions', 'uiWorkspace', 'workspaces'],
      apply(ctx) {
        const sessions = ctx.get('sessions')
        const uiWorkspace = ctx.get('uiWorkspace')
        const workspaces = ctx.get('workspaces')
        let ontologyOpen = false
        const listeners = new Set()
        const setOntologyOpen = (open) => {
          ontologyOpen = open
          for (const listener of listeners) listener(open)
        }
        const getOpen = () => ontologyOpen
        const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
        const close = () => setOntologyOpen(false)
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = styles
        ctx.effect(() => {
          document.head.appendChild(style)
          return () => { listeners.clear(); style.remove() }
        })
        ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
          name: 'sidebar.workspaces',
          priority: -1,
          inject: () => ({
            startSession: (workspaceId) => uiWorkspace.startSession(workspaceId),
            open: (sessionId) => sessions.open(sessionId),
            searchSessions: async (query, signal) => {
              const result = await sessions.search(query, signal)
              if (!result.ok) throw new Error(result.error.message)
              return result.value
            },
            listFiles: () => listKnowledgeFiles(),
            readFile: (id) => readKnowledgeFile(id),
            uploadFile: (file) => uploadKnowledgeFile(file),
            updateFile: (id, patch) => updateKnowledgeFile(id, patch),
            deleteFile: (id) => deleteKnowledgeFile(id),
            openOntology: () => setOntologyOpen(true)
          })
        }, EnterpriseWorkspaceTree))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: '@eiscore/dsh-client-knowledge-session-menu',
          priority: 10,
          inject: () => ({
            workspaceSource: workspaces.list,
            sessionSource: sessions.list,
            startSession: (workspaceId) => uiWorkspace.startSession(workspaceId),
            open: (sessionId) => sessions.open(sessionId),
            searchSessions: async (query, signal) => {
              const result = await sessions.search(query, signal)
              if (!result.ok) throw new Error(result.error.message)
              return result.value
            }
          })
        }, WorkspaceSessionMenuOverlay))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: '@eiscore/dsh-client-knowledge-ontology-dock',
          inject: () => ({ getOpen, subscribe, close, loadOntology: loadKnowledgeOntology })
        }, KnowledgeOntologyDock))
      }
    }
  }
})
