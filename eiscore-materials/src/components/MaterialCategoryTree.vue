<template>
  <el-card class="tree-card" shadow="never">
    <div class="tree-header">
      <div class="tree-title">物料分类</div>
      <div class="tree-actions">
        <el-button size="small" @click="selectAll">全部</el-button>
        <el-button size="small" type="primary" @click="openAddRoot">新增</el-button>
      </div>
    </div>

    <div class="tree-body">
      <el-empty v-if="!treeData.length" description="暂无分类" />
      <el-tree
        v-else
        ref="treeRef"
        :data="treeData"
        :props="treeProps"
        node-key="id"
        highlight-current
        :default-expanded-keys="expandedKeys"
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data }">
          <div class="tree-node">
            <span class="node-label">{{ `${data.id} ${node.label}` }}</span>
            <span class="node-actions">
              <el-button
                v-if="node.level < maxDepth"
                link
                size="small"
                :icon="Plus"
                title="新增子类"
                @click.stop="openAddChild(data, node)"
              />
              <el-button link size="small" :icon="Edit" title="改名" @click.stop="openRename(data)" />
              <el-button link type="danger" size="small" :icon="Delete" title="删除" @click.stop="removeNode(data)" />
            </span>
          </div>
        </template>
      </el-tree>
    </div>
  </el-card>

  <el-dialog v-model="editDialog.visible" :title="editDialog.title" width="360px" append-to-body>
    <el-form :model="editDialog.form" label-width="80px">
      <el-form-item label="分类名称">
        <el-input v-model="editDialog.form.label" placeholder="例如：原料" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editDialog.visible = false">取消</el-button>
      <el-button type="primary" @click="submitEdit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import request from '@/utils/request'

const emit = defineEmits(['select'])

const treeRef = ref(null)
const maxDepth = ref(2)
const treeDataAll = ref([])
const treeData = computed(() => cloneAndLimitDepth(treeDataAll.value, maxDepth.value))
const expandedKeys = ref([])

const treeProps = { children: 'children', label: 'label' }

const editDialog = reactive({
  visible: false,
  title: '新增分类',
  mode: 'add-root',
  targetId: '',
  form: {
    label: ''
  }
})

const defaultCategories = [
  { id: '01', label: '原料' },
  { id: '02', label: '辅料' },
  { id: '03', label: '包装材料' }
]

const nextSegment = (siblings = []) => {
  let max = 0
  siblings.forEach((child) => {
    const code = child?.id ? String(child.id) : ''
    if (!code) return
    const segment = code.split('.').pop()
    const num = Number(segment)
    if (Number.isFinite(num) && num > max) max = num
  })
  return String(max + 1).padStart(2, '0')
}

const loadSettings = async () => {
  try {
    const res = await request({
      url: '/system_configs?key=eq.app_settings',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const row = Array.isArray(res) && res.length ? res[0] : null
    const depth = Number(row?.value?.materialsCategoryDepth || 2)
    maxDepth.value = depth === 3 ? 3 : 2
  } catch (e) {
    maxDepth.value = 2
  }
}

const loadCategories = async () => {
  try {
    const res = await request({
      url: '/system_configs?key=eq.materials_categories',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const hasRow = Array.isArray(res) && res.length > 0
    const list = hasRow ? res[0].value : null
    if (Array.isArray(list)) {
      treeDataAll.value = list
    } else {
      treeDataAll.value = []
    }
    if (!hasRow) {
      treeDataAll.value = JSON.parse(JSON.stringify(defaultCategories))
      await saveCategories()
    }
  } catch (e) {
    treeDataAll.value = JSON.parse(JSON.stringify(defaultCategories))
  }
  expandedKeys.value = treeData.value.map(item => item.id)
}

const saveCategories = async () => {
  await request({
    url: '/system_configs',
    method: 'post',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Prefer': 'resolution=merge-duplicates'
    },
    data: {
      key: 'materials_categories',
      value: treeDataAll.value
    }
  })
  try {
    window.dispatchEvent(new CustomEvent('eis-materials-categories-updated', {
      detail: { list: treeDataAll.value }
    }))
  } catch (e) {}
}

const selectAll = () => {
  treeRef.value?.setCurrentKey(null)
  emit('select', null)
}

const handleNodeClick = (data) => {
  emit('select', data)
}

const openAddRoot = () => {
  editDialog.visible = true
  editDialog.title = '新增分类'
  editDialog.mode = 'add-root'
  editDialog.targetId = ''
  editDialog.form.label = ''
}

const openAddChild = (node, treeNode) => {
  if (treeNode?.level >= maxDepth.value) {
    ElMessage.warning(`最多支持${maxDepth.value}级分类`)
    return
  }
  editDialog.visible = true
  editDialog.title = '新增子分类'
  editDialog.mode = 'add-child'
  editDialog.targetId = node?.id || ''
  editDialog.form.label = ''
}

const openRename = (node) => {
  editDialog.visible = true
  editDialog.title = '修改分类名称'
  editDialog.mode = 'rename'
  editDialog.targetId = node?.id || ''
  editDialog.form.label = node?.label || ''
}

const findNodeById = (list, id) => {
  for (const item of list) {
    if (item.id === id) return item
    const children = item.children || []
    const found = findNodeById(children, id)
    if (found) return found
  }
  return null
}

const removeNodeById = (list, id) => {
  const idx = list.findIndex(item => item.id === id)
  if (idx >= 0) {
    list.splice(idx, 1)
    return true
  }
  for (const item of list) {
    if (item.children && item.children.length) {
      const removed = removeNodeById(item.children, id)
      if (removed) return true
    }
  }
  return false
}

const submitEdit = async () => {
  const label = editDialog.form.label ? editDialog.form.label.trim() : ''
  if (!label) {
    ElMessage.warning('请输入分类名称')
    return
  }
  if (editDialog.mode === 'add-root') {
    const segment = nextSegment(treeDataAll.value)
    treeDataAll.value.push({ id: segment, label })
  } else if (editDialog.mode === 'add-child') {
    const node = findNodeById(treeDataAll.value, editDialog.targetId)
    if (!node) {
      ElMessage.error('未找到目标分类')
      return
    }
    if (!Array.isArray(node.children)) node.children = []
    const segment = nextSegment(node.children)
    const prefix = String(node.id || '').trim()
    const code = prefix ? `${prefix}.${segment}` : segment
    node.children.push({ id: code, label })
  } else if (editDialog.mode === 'rename') {
    const node = findNodeById(treeDataAll.value, editDialog.targetId)
    if (node) node.label = label
  }
  await saveCategories()
  editDialog.visible = false
}

const removeNode = async (node) => {
  if (!node?.id) return
  const removed = removeNodeById(treeDataAll.value, node.id)
  if (removed) {
    await saveCategories()
    emit('select', null)
  }
}

function cloneAndLimitDepth(list = [], depth = 2, level = 1) {
  if (!Array.isArray(list)) return []
  return list.map((item) => {
    const next = { ...item }
    if (level >= depth) {
      next.children = []
    } else if (Array.isArray(item.children) && item.children.length) {
      next.children = cloneAndLimitDepth(item.children, depth, level + 1)
    } else {
      next.children = []
    }
    return next
  })
}

onMounted(async () => {
  await loadSettings()
  loadCategories()
  window.addEventListener('eis-materials-categories-updated', loadCategories)
})

onUnmounted(() => {
  window.removeEventListener('eis-materials-categories-updated', loadCategories)
})
</script>

<style scoped>
.tree-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f4f4;
  border: none;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.tree-title {
  font-size: 16px;
  font-weight: 700;
  color: #1f2d3d;
}

.tree-actions {
  display: flex;
  gap: 6px;
}

.tree-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 4px 10px;
  border-radius: 8px;
  background: #ffffff;
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.node-label {
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
}

.tree-node:hover .node-actions {
  opacity: 1;
}

:deep(.el-tree) {
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 6px;
  padding-right: 6px;
}

:deep(.el-tree-node__content:hover) {
  background: #f3eceb;
}

:deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content) {
  background: #efe6e5;
}

.tree-body::-webkit-scrollbar {
  width: 8px;
}

.tree-body::-webkit-scrollbar-track {
  background: transparent;
}

.tree-body::-webkit-scrollbar-thumb {
  background: #d6c7c6;
  border-radius: 8px;
}

.tree-body::-webkit-scrollbar-thumb:hover {
  background: #c7b6b5;
}
</style>
