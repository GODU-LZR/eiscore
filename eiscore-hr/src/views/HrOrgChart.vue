<template>
  <div class="org-view">
    <div class="view-header">
      <div class="title-block">
        <h2>部门架构图</h2>
        <p>支持新增、编辑、删除部门与成员查看</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="openDeptDialog()">新增部门</el-button>
        <el-button type="success" plain @click="saveLayout">保存布局</el-button>
        <el-button @click="exportDiagram">导出</el-button>
        <el-button @click="reloadAll">刷新</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="org-body">
      <el-col :span="18" class="diagram-col">
        <el-card shadow="never" class="diagram-card">
          <div
            ref="canvasRef"
            class="diagram-canvas"
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
                class="org-line"
                marker-end="url(#arrow)"
              />

              <g
                v-for="node in nodes"
                :key="node.id"
                :transform="`translate(${node.x} ${node.y})`"
                class="org-node"
                @click.stop="selectNode(node)"
              >
                <rect
                  :width="node.width"
                  :height="node.height"
                  rx="10"
                  ry="10"
                  :class="['org-rect', { active: node.id === selectedDeptId }]"
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
              <el-button type="primary" @click="openEditDialog" :disabled="!deptForm.id">编辑</el-button>
              <el-button type="danger" plain @click="deleteDept" :disabled="!deptForm.id">删除</el-button>
            </div>
          </div>

          <div class="side-section">
            <div class="section-title">部门成员</div>
            <div v-if="members.length === 0" class="empty-tip">暂无成员</div>
            <el-scrollbar v-else class="member-list">
              <div v-for="user in members" :key="user.id" class="member-item">
                <span class="member-name">{{ user.full_name || user.username }}</span>
                <span class="member-sub">{{ user.position_name || user.position || '' }}</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
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

const baseLayout = ref([])
const nodePositions = ref({})
const dragState = ref({ active: false })

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

const layoutTree = (nodes, level = 0, baseX = 80, baseY = 60, positions = []) => {
  let currentX = baseX
  nodes.forEach((node) => {
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
  const overrides = nodePositions.value || {}
  return positions.map((p) => {
    const saved = overrides[p.id]
    return {
      ...p,
      x: saved?.x ?? p.x,
      y: saved?.y ?? p.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT
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
    const startX = from.x + NODE_WIDTH / 2
    const startY = from.y + NODE_HEIGHT
    const endX = to.x + NODE_WIDTH / 2
    const endY = to.y
    const midY = (startY + endY) / 2
    lines.push({
      id: `${d.parent_id}-${d.id}`,
      path: `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`
    })
  })
  return lines
})

const viewBox = computed(() => {
  if (nodes.value.length === 0) return '0 0 800 600'
  const maxX = Math.max(...nodes.value.map(n => n.x + NODE_WIDTH)) + 80
  const maxY = Math.max(...nodes.value.map(n => n.y + NODE_HEIGHT)) + 80
  return `0 0 ${Math.max(800, maxX)} ${Math.max(600, maxY)}`
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

const selectNodeById = (id) => {
  hideContextMenu()
  const node = nodes.value.find(n => n.id === id)
  if (node) selectNode(node)
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

const openEditDialog = () => {
  if (!deptForm.value.id) return
  deptDialog.value.mode = 'edit'
  deptDialog.value.form = {
    id: deptForm.value.id,
    name: deptForm.value.name,
    parent_id: deptForm.value.parent_id || '',
    leader_id: deptForm.value.leader_id || ''
  }
  deptDialog.value.visible = true
}

const openEditDialogById = (deptId) => {
  const dept = departments.value.find(d => d.id === deptId)
  if (!dept) return
  deptDialog.value.mode = 'edit'
  deptDialog.value.form = {
    id: dept.id,
    name: dept.name,
    parent_id: dept.parent_id || '',
    leader_id: dept.leader_id || ''
  }
  deptDialog.value.visible = true
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

const saveLayout = async () => {
  const layout = nodes.value.map(n => ({ id: n.id, x: n.x, y: n.y }))
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: 'hr_org_layout', value: layout }
  })
  ElMessage.success('布局已保存')
}

const applySavedLayout = async () => {
  const res = await request({
    url: '/system_configs?key=eq.hr_org_layout',
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  const layout = res?.[0]?.value
  if (!Array.isArray(layout) || layout.length === 0) return
  const map = new Map(layout.map(item => [item.id, item]))
  const next = {}
  map.forEach((value, key) => {
    next[key] = { x: value.x, y: value.y }
  })
  nodePositions.value = next
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

const exportDiagram = () => {
  const svg = svgRef.value
  if (!svg) return
  const serializer = new XMLSerializer()
  const source = serializer.serializeToString(svg)
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '部门架构图.svg'
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await reloadAll()
  await applySavedLayout()
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

.member-item {
  padding: 6px 0;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed #ebeef5;
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
</style>
