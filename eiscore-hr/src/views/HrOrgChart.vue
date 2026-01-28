<template>
  <div class="org-view">
    <div class="view-header">
      <div class="title-block">
        <h2>部门架构图</h2>
        <p>拖拽显示虚线预览，松开后按预览结果调整层级或顺序</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="openDeptDialog()">新增部门</el-button>
        <el-button @click="reloadAll">刷新</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="org-body">
      <el-col :span="18" class="diagram-col">
        <el-card shadow="never" class="diagram-card">
          <div class="zoom-controls">
            <el-button size="small" @click="zoomOut">-</el-button>
            <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
            <el-button size="small" @click="zoomIn">+</el-button>
          </div>
          <div
            ref="canvasRef"
            class="diagram-canvas"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseUp"
          >
            <svg ref="svgRef" class="org-svg" :viewBox="viewBox" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#2c6cf6" />
                </marker>
              </defs>

  <path
    v-for="edge in edges"
    :key="edge.id"
    :d="edge.path"
    :class="['org-line', { preview: edge.preview }]"
    marker-end="url(#arrow)"
  />

              <g
                v-for="node in nodes"
                :key="node.id"
                :transform="`translate(${node.x} ${node.y})`"
                class="org-node"
                @click.stop="selectNode(node)"
                @mousedown.stop="onMouseDown($event, node)"
              >
                <rect
                  :width="node.width"
                  :height="node.height"
                  rx="10"
                  ry="10"
                :class="['org-rect', { active: node.id === selectedDeptId, preview: node.isPreviewTarget }]"
              />
                <text
                  :x="node.width / 2"
                  :y="node.height / 2"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="org-text"
                >
                  {{ node.label }}
                </text>
              </g>
            </svg>

          </div>
        </el-card>
      </el-col>
      <el-col :span="6" class="side-col">
        <el-card shadow="never" class="side-card">
          <div class="side-section">
            <div class="section-title">部门信息</div>
            <el-form label-width="80px" class="dept-form">
              <el-form-item label="部门名称">
                <el-input v-model="deptForm.name" placeholder="请输入部门名称" />
              </el-form-item>
              <el-form-item label="上级部门">
                <el-select v-model="deptForm.parent_id" placeholder="无上级" clearable>
                  <el-option v-for="d in parentOptions" :key="d.id" :label="d.name" :value="d.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="负责人">
                <el-select v-model="deptForm.leader_id" placeholder="可不选" clearable>
                  <el-option v-for="u in leaderOptions" :key="u.id" :label="u.full_name || u.username" :value="u.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="状态">
                <el-select v-model="deptForm.status">
                  <el-option label="启用" value="active" />
                  <el-option label="停用" value="inactive" />
                </el-select>
              </el-form-item>
            </el-form>
            <div class="side-actions">
              <el-button type="primary" @click="saveDept" :disabled="!deptForm.id">保存</el-button>
              <el-button type="danger" plain @click="deleteDept" :disabled="!deptForm.id">删除</el-button>
            </div>
          </div>

          <div class="side-section">
            <div class="section-title">部门成员</div>
            <div class="member-actions">
              <el-button size="small" type="primary" plain @click="openMemberDialog" :disabled="!deptForm.id">
                添加成员
              </el-button>
            </div>
            <div v-if="members.length === 0" class="empty-tip">暂无成员</div>
            <el-scrollbar v-else class="member-list">
              <div v-for="user in members" :key="user.id" class="member-item">
                <div class="member-main">
                  <span class="member-name">{{ user.full_name || user.username }}</span>
                  <span class="member-sub">{{ user.position_name || user.position || '' }}</span>
                </div>
                <el-button size="small" text type="danger" @click="removeMember(user)">移除</el-button>
              </div>
            </el-scrollbar>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="deptDialog.visible" :title="deptDialogTitle" width="420px" append-to-body @closed="resetDeptDialog">
      <el-form label-width="90px">
        <el-form-item label="部门名称">
          <el-input v-model="deptDialog.form.name" placeholder="例如：生产部" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-select v-model="deptDialog.form.parent_id" placeholder="无上级" clearable>
            <el-option v-for="d in parentOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="deptDialog.form.leader_id" placeholder="可不选" clearable>
            <el-option v-for="u in leaderOptions" :key="u.id" :label="u.full_name || u.username" :value="u.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deptDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitDeptDialog" :disabled="!deptDialog.form.name">
          {{ deptDialog.mode === 'create' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="memberDialog.visible" title="添加成员" width="520px" append-to-body>
      <el-form label-width="80px">
        <el-form-item label="搜索">
          <el-input v-model="memberDialog.keyword" placeholder="输入姓名筛选" clearable />
        </el-form-item>
        <el-form-item label="选择人员">
          <el-scrollbar class="member-pick-list">
            <el-checkbox-group v-model="memberDialog.selectedIds">
              <el-checkbox
                v-for="u in filteredAvailableMembers"
                :key="u.id"
                :label="u.id"
              >
                {{ u.name }}
              </el-checkbox>
            </el-checkbox-group>
          </el-scrollbar>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="addMember" :disabled="memberDialog.selectedIds.length === 0">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import request from '@/utils/request'
import { getRealtimeClient } from '@/utils/realtime'

const departments = ref([])
const members = ref([])
const leaderOptions = ref([])
const selectedDeptId = ref('')
const canvasRef = ref(null)
const svgRef = ref(null)

const deptForm = ref({
  id: '',
  name: '',
  parent_id: '',
  leader_id: '',
  status: 'active'
})
const deptDialog = ref({
  visible: false,
  mode: 'create',
  form: { id: '', name: '', parent_id: '', leader_id: '' }
})

const NODE_WIDTH = 180
const NODE_HEIGHT = 60
const H_GAP = 220
const V_GAP = 140
const PREVIEW_DISTANCE = 120

const baseLayout = ref([])
const dragPreview = ref({})
const dragState = ref({
  active: false,
  id: '',
  offsetX: 0,
  offsetY: 0,
  raf: 0,
  lastPoint: null,
  startPoint: null,
  subtreeIds: [],
  subtreeBase: {},
  previewTargetId: '',
  previewType: ''
})
const zoom = ref(1)

const memberDialog = ref({ visible: false, keyword: '', selectedIds: [] })
const availableMembers = ref([])

const parentOptions = computed(() => departments.value.filter(d => d.id !== deptForm.value.id))
const deptDialogTitle = computed(() => (deptDialog.value.mode === 'create' ? '新增部门' : '编辑部门'))
let realtimeUnsub = null
let realtimeTimer = null

const buildTree = () => {
  const map = new Map()
  departments.value.forEach((d) => {
    map.set(d.id, { ...d, children: [] })
  })
  const roots = []
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

const rebuildLayout = () => {
  const tree = buildTree()
  baseLayout.value = layoutTree(tree)
}

const sortChildren = (children) => {
  return [...children].sort((a, b) => {
    const sa = a.sort ?? 0
    const sb = b.sort ?? 0
    if (sa !== sb) return sa - sb
    return (a.name || '').localeCompare(b.name || '', 'zh')
  })
}

const isDescendant = (parentId, childId) => {
  const map = new Map()
  departments.value.forEach(d => map.set(d.id, d.parent_id))
  let current = childId
  while (current) {
    if (current === parentId) return true
    current = map.get(current)
  }
  return false
}

const getDescendantIds = (rootId) => {
  const childrenMap = new Map()
  departments.value.forEach((d) => {
    const parent = d.parent_id || ''
    if (!childrenMap.has(parent)) childrenMap.set(parent, [])
    childrenMap.get(parent).push(d.id)
  })
  const result = []
  const stack = [rootId]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    result.push(current)
    const children = childrenMap.get(current) || []
    children.forEach(id => stack.push(id))
  }
  return result
}

const distanceToRect = (point, node) => {
  const left = node.x
  const right = node.x + NODE_WIDTH
  const top = node.y
  const bottom = node.y + NODE_HEIGHT
  const dx = Math.max(0, Math.max(left - point.x, point.x - right))
  const dy = Math.max(0, Math.max(top - point.y, point.y - bottom))
  return Math.hypot(dx, dy)
}

const layoutTree = (nodes, level = 0, baseX = 80, baseY = 60, positions = []) => {
  let currentX = baseX
  const ordered = sortChildren(nodes)
  ordered.forEach((node) => {
    const x = currentX
    const y = baseY + level * V_GAP
    positions.push({ id: node.id, x, y, label: node.name })
    currentX += H_GAP
    if (node.children && node.children.length) {
      const childStart = currentX - H_GAP
      layoutTree(node.children, level + 1, childStart, baseY, positions)
      const childXs = positions.filter(p => node.children.some(c => c.id === p.id)).map(p => p.x)
      if (childXs.length) {
        const midX = (Math.min(...childXs) + Math.max(...childXs)) / 2
        const self = positions.find(p => p.id === node.id)
        if (self) self.x = midX
      }
      currentX = Math.max(currentX, ...positions.map(p => p.x + H_GAP))
    }
  })
  return positions
}

const nodes = computed(() => {
  const positions = baseLayout.value.length ? baseLayout.value : layoutTree(buildTree())
  const overrides = dragPreview.value || {}
  return positions.map((p) => {
    const saved = overrides[p.id]
    return {
      ...p,
      x: saved?.x ?? p.x,
      y: saved?.y ?? p.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      isPreviewTarget: dragState.value.previewTargetId === p.id
    }
  })
})

const edges = computed(() => {
  const map = new Map(nodes.value.map(n => [n.id, n]))
  const lines = []
  departments.value.forEach((d) => {
    if (!d.parent_id) return
    const from = map.get(d.parent_id)
    const to = map.get(d.id)
    if (!from || !to) return
    if (dragState.value.active && dragState.value.id === d.id) return
    const startX = from.x + NODE_WIDTH / 2
    const startY = from.y + NODE_HEIGHT
    const endX = to.x + NODE_WIDTH / 2
    const endY = to.y
    const midY = (startY + endY) / 2
    lines.push({
      id: `${d.parent_id}-${d.id}`,
      path: `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`,
      preview: false
    })
  })
  if (dragState.value.active && dragState.value.previewTargetId) {
    const moved = nodes.value.find(n => n.id === dragState.value.id)
    const target = nodes.value.find(n => n.id === dragState.value.previewTargetId)
    const movedDept = departments.value.find(d => d.id === dragState.value.id)
    if (moved && target && movedDept) {
      const parentNode = dragState.value.previewType === 'reparent'
        ? target
        : map.get(movedDept.parent_id || '')
      if (parentNode) {
        const startX = parentNode.x + NODE_WIDTH / 2
        const startY = parentNode.y + NODE_HEIGHT
        const endX = moved.x + NODE_WIDTH / 2
        const endY = moved.y
        const midY = (startY + endY) / 2
        lines.push({
          id: `preview-${parentNode.id}-${moved.id}`,
          path: `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`,
          preview: true
        })
      }
    }
  }
  return lines
})

const viewBox = computed(() => {
  if (nodes.value.length === 0) return '0 0 800 600'
  const maxX = Math.max(...nodes.value.map(n => n.x + NODE_WIDTH)) + 80
  const maxY = Math.max(...nodes.value.map(n => n.y + NODE_HEIGHT)) + 80
  const width = Math.max(800, maxX)
  const height = Math.max(600, maxY)
  const scale = Math.max(0.5, Math.min(2, zoom.value))
  return `0 0 ${width / scale} ${height / scale}`
})

const loadDepartments = async () => {
  const res = await request({
    url: '/departments?order=sort.asc,name.asc',
    method: 'get',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })
  departments.value = Array.isArray(res) ? res : []
}

const loadLeaders = async () => {
  const res = await request({
    url: '/users?select=id,username,full_name&order=username.asc',
    method: 'get',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })
  leaderOptions.value = Array.isArray(res) ? res : []
}

const loadMembers = async (deptId) => {
  if (!deptId) {
    members.value = []
    return
  }
  const dept = departments.value.find(d => d.id === deptId)
  if (!dept) {
    members.value = []
    return
  }
  const res = await request({
    url: `/archives?department=eq.${encodeURIComponent(dept.name)}&order=id.desc`,
    method: 'get',
    headers: { 'Accept-Profile': 'hr', 'Content-Profile': 'hr' }
  })
  members.value = Array.isArray(res)
    ? res.map(item => ({
        id: item.id,
        username: item.name,
        full_name: item.name,
        position: item.properties?.position || ''
      }))
    : []
}

const loadAvailableMembers = async () => {
  const res = await request({
    url: '/archives?department=is.null&order=id.desc&limit=200',
    method: 'get',
    headers: { 'Accept-Profile': 'hr', 'Content-Profile': 'hr' }
  })
  availableMembers.value = Array.isArray(res)
    ? res.map(item => ({ id: item.id, name: item.name }))
    : []
}

const filteredAvailableMembers = computed(() => {
  const keyword = memberDialog.value.keyword?.trim()
  if (!keyword) return availableMembers.value
  return availableMembers.value.filter(item => item.name?.includes(keyword))
})

const selectNode = async (node) => {
  if (!node?.id) return
  selectedDeptId.value = node.id
  const dept = departments.value.find(d => d.id === node.id)
  if (!dept) return
  deptForm.value = {
    id: dept.id,
    name: dept.name,
    parent_id: dept.parent_id || '',
    leader_id: dept.leader_id || '',
    status: dept.status || 'active'
  }
  await loadMembers(dept.id)
}

const openDeptDialog = (parentId = '') => {
  deptDialog.value.mode = 'create'
  deptDialog.value.form = { id: '', name: '', parent_id: parentId || '', leader_id: '' }
  deptDialog.value.visible = true
}

const resetDeptDialog = () => {
  deptDialog.value.mode = 'create'
  deptDialog.value.form = { id: '', name: '', parent_id: '', leader_id: '' }
}

const submitDeptDialog = async () => {
  const payload = {
    name: deptDialog.value.form.name,
    parent_id: deptDialog.value.form.parent_id || null,
    leader_id: deptDialog.value.form.leader_id || null,
    status: 'active'
  }
  if (deptDialog.value.mode === 'create') {
    await request({
      url: '/departments',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
      data: payload
    })
  } else {
    await request({
      url: `/departments?id=eq.${deptDialog.value.form.id}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: payload
    })
  }
  deptDialog.value.visible = false
  await reloadAll()
}

const saveDept = async () => {
  if (!deptForm.value.id) return
  await request({
    url: `/departments?id=eq.${deptForm.value.id}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: {
      name: deptForm.value.name,
      parent_id: deptForm.value.parent_id || null,
      leader_id: deptForm.value.leader_id || null,
      status: deptForm.value.status || 'active'
    }
  })
  await reloadAll()
}

const openMemberDialog = async () => {
  if (!deptForm.value.id) return
  await loadAvailableMembers()
  memberDialog.value.keyword = ''
  memberDialog.value.selectedIds = []
  memberDialog.value.visible = true
}

const addMember = async () => {
  const selectedIds = memberDialog.value.selectedIds || []
  if (selectedIds.length === 0) return
  await Promise.all(
    selectedIds.map(id =>
      request({
        url: `/archives?id=eq.${id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'hr', 'Content-Profile': 'hr' },
        data: { department: deptForm.value.name }
      })
    )
  )
  memberDialog.value.visible = false
  await loadMembers(deptForm.value.id)
}

const removeMember = async (user) => {
  if (!user?.id) return
  await request({
    url: `/archives?id=eq.${user.id}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'hr', 'Content-Profile': 'hr' },
    data: { department: null }
  })
  await loadMembers(deptForm.value.id)
}

const deleteDeptById = async (deptId) => {
  if (!deptId) return
  await request({
    url: `/departments?id=eq.${deptId}`,
    method: 'delete',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })
  if (deptForm.value.id === deptId) {
    deptForm.value = { id: '', name: '', parent_id: '', leader_id: '', status: 'active' }
    members.value = []
    selectedDeptId.value = ''
  }
  await reloadAll()
}

const deleteDept = async () => {
  await deleteDeptById(deptForm.value.id)
}

const reloadAll = async () => {
  await Promise.all([loadDepartments(), loadLeaders()])
  rebuildLayout()
}

const scheduleReload = () => {
  if (realtimeTimer) return
  realtimeTimer = setTimeout(() => {
    realtimeTimer = null
    reloadAll()
  }, 600)
}

const parseRealtimePayload = (event) => {
  if (!event) return null
  if (event.payload && typeof event.payload === 'string') {
    try {
      return JSON.parse(event.payload)
    } catch (e) {
      return null
    }
  }
  return event.payload && typeof event.payload === 'object' ? event.payload : null
}

const handleRealtimeEvent = (event) => {
  const payload = parseRealtimePayload(event)
  if (!payload) return
  if (payload.schema === 'public' && payload.table === 'departments') {
    scheduleReload()
  }
}

const zoomIn = () => {
  zoom.value = Math.min(2, Number((zoom.value + 0.1).toFixed(2)))
}

const zoomOut = () => {
  zoom.value = Math.max(0.5, Number((zoom.value - 0.1).toFixed(2)))
}

const getSvgPoint = (event) => {
  const svg = svgRef.value
  if (!svg) return { x: event.offsetX, y: event.offsetY }
  const rect = svg.getBoundingClientRect()
  const vb = viewBox.value.split(' ').map(Number)
  const scaleX = vb[2] / rect.width
  const scaleY = vb[3] / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

const onMouseDown = (event, node) => {
  if (event.button !== 0) return
  const point = getSvgPoint(event)
  const subtreeIds = getDescendantIds(node.id)
  const basePositions = {}
  nodes.value.forEach((n) => {
    if (subtreeIds.includes(n.id)) {
      basePositions[n.id] = { x: n.x, y: n.y }
    }
  })
  dragPreview.value = { ...basePositions }
  dragState.value = {
    active: true,
    id: node.id,
    offsetX: point.x - node.x,
    offsetY: point.y - node.y,
    raf: 0,
    lastPoint: point,
    startPoint: point,
    subtreeIds,
    subtreeBase: basePositions,
    previewTargetId: '',
    previewType: ''
  }
}

const detectPreviewTarget = (point) => {
  const movedId = dragState.value.id
  const excludeIds = new Set(dragState.value.subtreeIds || [movedId])
  const candidates = nodes.value.filter(n => !excludeIds.has(n.id))
  if (candidates.length === 0) return { targetId: '', type: '' }
  const movedDept = departments.value.find(d => d.id === movedId)
  if (!movedDept) return { targetId: '', type: '' }
  const scale = Math.max(0.5, Math.min(2, zoom.value))
  const threshold = PREVIEW_DISTANCE / scale
  const insideTarget = candidates.find((node) => {
    const insideX = point.x >= node.x && point.x <= node.x + NODE_WIDTH
    const insideY = point.y >= node.y && point.y <= node.y + NODE_HEIGHT
    return insideX && insideY
  })
  if (insideTarget) {
    return { targetId: insideTarget.id, type: 'reparent' }
  }
  let best = null
  let bestDistance = Number.POSITIVE_INFINITY
  candidates.forEach((node) => {
    const distance = distanceToRect(point, node)
    if (distance < bestDistance) {
      bestDistance = distance
      best = node
    }
  })
  if (!best || bestDistance > threshold) return { targetId: '', type: '' }
  const targetDept = departments.value.find(d => d.id === best.id)
  if (!targetDept) return { targetId: '', type: '' }
  const sameParent = (movedDept.parent_id || null) === (targetDept.parent_id || null)
  return { targetId: best.id, type: sameParent ? 'reorder' : 'reparent' }
}

const onMouseMove = (event) => {
  if (!dragState.value.active) return
  dragState.value.lastPoint = getSvgPoint(event)
  const preview = detectPreviewTarget(dragState.value.lastPoint)
  dragState.value.previewTargetId = preview.targetId
  dragState.value.previewType = preview.type
  if (dragState.value.raf) return
  dragState.value.raf = requestAnimationFrame(() => {
    const { subtreeIds, subtreeBase, startPoint, lastPoint } = dragState.value
    if (!startPoint || !subtreeIds || !subtreeIds.length) {
      dragState.value.raf = 0
      return
    }
    const deltaX = lastPoint.x - startPoint.x
    const deltaY = lastPoint.y - startPoint.y
    const next = { ...(dragPreview.value || {}) }
    subtreeIds.forEach((subId) => {
      const base = subtreeBase[subId]
      if (!base) return
      next[subId] = {
        x: Math.max(20, base.x + deltaX),
        y: Math.max(20, base.y + deltaY)
      }
    })
    dragPreview.value = next
    dragState.value.raf = 0
  })
}

const onMouseUp = async () => {
  if (!dragState.value.active) return
  if (dragState.value.raf) {
    cancelAnimationFrame(dragState.value.raf)
    dragState.value.raf = 0
  }
  const dropId = dragState.value.id
  const previewTargetId = dragState.value.previewTargetId
  const previewType = dragState.value.previewType
  dragState.value.active = false
  dragState.value.previewTargetId = ''
  dragState.value.previewType = ''
  dragState.value.subtreeIds = []
  dragState.value.subtreeBase = {}
  dragState.value.startPoint = null
  const moved = dragPreview.value?.[dropId]
  dragPreview.value = {}
  if (!moved) return

  const target = nodes.value.find(n => n.id === previewTargetId)
  if (!target) return

  const movedDept = departments.value.find(d => d.id === dropId)
  const targetDept = departments.value.find(d => d.id === target.id)
  if (!movedDept || !targetDept) return

  if (previewType === 'reparent') {
    if (isDescendant(movedDept.id, targetDept.id)) return
    await request({
      url: `/departments?id=eq.${movedDept.id}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { parent_id: targetDept.id }
    })
    await reloadAll()
    return
  }

  // 同级拖拽调整顺序
  const siblings = sortChildren(
    departments.value.filter(d => (d.parent_id || null) === (movedDept.parent_id || null))
  )
  const fromIndex = siblings.findIndex(d => d.id === movedDept.id)
  const toIndex = siblings.findIndex(d => d.id === targetDept.id)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

  const nextOrder = siblings.filter(d => d.id !== movedDept.id)
  nextOrder.splice(toIndex, 0, movedDept)

  await Promise.all(
    nextOrder.map((dept, index) =>
      request({
        url: `/departments?id=eq.${dept.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { sort: (index + 1) * 10 }
      })
    )
  )
  await reloadAll()
}

onMounted(async () => {
  await reloadAll()
  const realtime = getRealtimeClient()
  realtimeUnsub = realtime.subscribe(handleRealtimeEvent)
})

onUnmounted(() => {
  if (realtimeUnsub) realtimeUnsub()
  realtimeUnsub = null
  if (realtimeTimer) {
    clearTimeout(realtimeTimer)
    realtimeTimer = null
  }
})
</script>

<style scoped>
.org-view {
  padding: 20px;
  min-height: 100vh;
  box-sizing: border-box;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.title-block h2 {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.title-block p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.org-body {
  min-height: 640px;
}

.diagram-card {
  height: 100%;
  min-height: 640px;
  position: relative;
}

.diagram-canvas {
  width: 100%;
  height: 640px;
  position: relative;
}

.org-svg {
  width: 100%;
  height: 100%;
}

.org-line {
  fill: none;
  stroke: #2c6cf6;
  stroke-width: 2;
}

.org-line.preview {
  stroke-dasharray: 6 4;
  opacity: 0.8;
}

.org-rect {
  fill: #ffffff;
  stroke: #2c6cf6;
  stroke-width: 2;
  transition: fill 0.2s ease, stroke 0.2s ease;
}

.org-rect.active {
  fill: #ecf5ff;
  stroke: #409eff;
}

.org-rect.preview {
  stroke: #67c23a;
  stroke-width: 2.5;
  stroke-dasharray: 6 4;
}

.org-text {
  font-size: 16px;
  fill: #303133;
  font-weight: 600;
  pointer-events: none;
}

.org-node {
  cursor: pointer;
}

.org-node:active {
  cursor: pointer;
}

.side-card {
  height: 100%;
  min-height: 640px;
}

.side-section {
  margin-bottom: 24px;
}

.section-title {
  font-weight: 600;
  margin-bottom: 10px;
  color: #303133;
}

.dept-form :deep(.el-select) {
  width: 100%;
}

.dept-form :deep(.el-input__inner),
.dept-form :deep(.el-select__wrapper) {
  font-size: 14px;
}

.side-actions {
  display: flex;
  gap: 10px;
}

.member-list {
  max-height: 240px;
}

.member-actions {
  margin-bottom: 8px;
}

.member-pick-list {
  max-height: 240px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px 10px;
  width: 100%;
}

.member-pick-list :deep(.el-checkbox) {
  display: flex;
  margin: 6px 0;
}

.member-item {
  padding: 6px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px dashed #ebeef5;
}

.member-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-weight: 500;
  color: #303133;
}

.member-sub {
  color: #909399;
  font-size: 13px;
}

.empty-tip {
  color: #909399;
  font-size: 12px;
}

.context-menu {
  position: absolute;
  min-width: 140px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  z-index: 20;
}

.menu-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.menu-item:hover {
  background: #f5f7fa;
}

.menu-item.danger {
  color: #f56c6c;
}

.zoom-controls {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 6px 10px;
  z-index: 2;
}

.zoom-label {
  font-size: 12px;
  color: #606266;
  min-width: 44px;
  text-align: center;
}
</style>
