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
            <span class="node-label">{{ node.label }}</span>
            <span class="node-actions">
              <el-button link size="small" @click.stop="openAddChild(data)">加子类</el-button>
              <el-button link size="small" @click.stop="openRename(data)">改名</el-button>
              <el-button link type="danger" size="small" @click.stop="removeNode(data)">删除</el-button>
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const emit = defineEmits(['select'])

const treeRef = ref(null)
const treeData = ref([])
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
  { id: 'cat_raw', label: '原料' },
  { id: 'cat_aux', label: '辅料' },
  { id: 'cat_pack', label: '包装材料' }
]

const loadCategories = async () => {
  try {
    const res = await request({
      url: '/system_configs?key=eq.materials_categories',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const list = res && res.length > 0 ? res[0].value : []
    treeData.value = Array.isArray(list) ? list : []
    if (treeData.value.length === 0) {
      treeData.value = JSON.parse(JSON.stringify(defaultCategories))
      await saveCategories()
    }
  } catch (e) {
    treeData.value = JSON.parse(JSON.stringify(defaultCategories))
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
      value: treeData.value
    }
  })
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

const openAddChild = (node) => {
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
    treeData.value.push({ id: `cat_${Date.now()}`, label })
  } else if (editDialog.mode === 'add-child') {
    const node = findNodeById(treeData.value, editDialog.targetId)
    if (!node) {
      ElMessage.error('未找到目标分类')
      return
    }
    if (!Array.isArray(node.children)) node.children = []
    node.children.push({ id: `cat_${Date.now()}`, label })
  } else if (editDialog.mode === 'rename') {
    const node = findNodeById(treeData.value, editDialog.targetId)
    if (node) node.label = label
  }
  await saveCategories()
  editDialog.visible = false
}

const removeNode = async (node) => {
  if (!node?.id) return
  const removed = removeNodeById(treeData.value, node.id)
  if (removed) {
    await saveCategories()
    emit('select', null)
  }
}

onMounted(() => {
  loadCategories()
})
</script>

<style scoped>
.tree-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.tree-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.tree-actions {
  display: flex;
  gap: 6px;
}

.tree-body {
  flex: 1;
  overflow: auto;
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
}

.node-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
}

.tree-node:hover .node-actions {
  opacity: 1;
}
</style>
