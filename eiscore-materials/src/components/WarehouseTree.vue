<template>
  <div class="warehouse-tree-component">
    <el-card class="tree-card" shadow="never">
      <div class="tree-header">
        <div class="tree-title">仓库/库位</div>
        <div class="tree-actions">
          <el-button size="small" @click="selectAll">全部</el-button>
          <el-button size="small" type="primary" @click="openAddRoot">新增仓库</el-button>
        </div>
      </div>

      <div class="tree-body">
        <el-empty v-if="!treeData.length" description="暂无仓库" />
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
              <span class="node-label">
                <el-icon><OfficeBuilding v-if="data.level === 1" /><Grid v-else-if="data.level === 2" /><Box v-else /></el-icon>
                {{ `${data.code} ${node.label}` }}
              </span>
              <span class="node-actions">
                <el-button
                  v-if="node.level < 3"
                  link
                  size="small"
                  :icon="Plus"
                  :title="node.level === 1 ? '新增库区' : '新增库位'"
                  @click.stop="openAddChild(data, node)"
                />
                <el-button link size="small" :icon="Edit" title="编辑" @click.stop="openEdit(data)" />
                <el-button link type="danger" size="small" :icon="Delete" title="删除" @click.stop="removeNode(data)" />
              </span>
            </div>
          </template>
        </el-tree>
      </div>
    </el-card>

    <el-dialog v-model="editDialog.visible" :title="editDialog.title" width="500px" append-to-body>
      <el-form :model="editDialog.form" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="editDialog.form.name" placeholder="例如：成品仓" />
        </el-form-item>
        <el-form-item label="编码" v-if="editDialog.mode === 'add-root'">
          <el-input v-model="editDialog.form.code" placeholder="例如：WH001" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editDialog.form.status">
            <el-option label="启用" value="启用" />
            <el-option label="停用" value="停用" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量" v-if="editDialog.form.level === 3">
          <el-input-number v-model="editDialog.form.capacity" :precision="2" :min="0" />
          <el-select v-model="editDialog.form.unit" style="width: 100px; margin-left: 10px;">
            <el-option label="吨" value="吨" />
            <el-option label="立方米" value="立方米" />
            <el-option label="托盘" value="托盘" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, OfficeBuilding, Grid, Box } from '@element-plus/icons-vue'
import request from '@/utils/request'

const emit = defineEmits(['select'])

const treeRef = ref(null)
const treeDataAll = ref([])
const expandedKeys = ref([])

const treeProps = { children: 'children', label: 'name' }

const editDialog = reactive({
  visible: false,
  title: '新增仓库',
  mode: 'add-root',
  targetId: '',
  form: {
    name: '',
    code: '',
    status: '启用',
    level: 1,
    capacity: null,
    unit: '吨'
  }
})

// 将扁平化数据转为树形结构
const buildTree = (flatData) => {
  const map = {}
  const roots = []
  
  flatData.forEach(item => {
    map[item.id] = { ...item, children: [] }
  })
  
  flatData.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id])
    } else {
      roots.push(map[item.id])
    }
  })
  
  return roots
}

const treeData = computed(() => buildTree(treeDataAll.value))

const loadWarehouses = async () => {
  try {
    const res = await request({
      url: '/warehouses?order=code.asc',
      headers: { 'Accept-Profile': 'scm' }
    })
    treeDataAll.value = res || []
    expandedKeys.value = treeDataAll.value.filter(w => w.level === 1).map(w => w.id)
  } catch (e) {
    console.error('加载仓库失败:', e)
    ElMessage.error('加载仓库失败')
  }
}

const selectAll = () => {
  treeRef.value?.setCurrentKey(null)
  emit('select', null)
}

const handleNodeClick = (data) => {
  emit('select', data)
}

const nextSegment = (siblings, parentCode = '') => {
  let max = 0
  siblings.forEach((child) => {
    const code = child?.code ? String(child.code) : ''
    if (!code) return
    const parts = code.split('.')
    const segment = parts[parts.length - 1]
    const num = parseInt(segment.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(num) && num > max) max = num
  })
  const nextNum = String.fromCharCode(65 + max) // A, B, C...
  return nextNum
}

const openAddRoot = () => {
  editDialog.visible = true
  editDialog.title = '新增仓库'
  editDialog.mode = 'add-root'
  editDialog.targetId = ''
  editDialog.form = {
    name: '',
    code: '',
    status: '启用',
    level: 1,
    capacity: null,
    unit: '吨'
  }
}

const openAddChild = (node, treeNode) => {
  if (treeNode?.level >= 3) {
    ElMessage.warning('最多支持3级（仓库→库区→库位）')
    return
  }
  const level = node.level + 1
  editDialog.visible = true
  editDialog.title = level === 2 ? '新增库区' : '新增库位'
  editDialog.mode = 'add-child'
  editDialog.targetId = node?.id || ''
  editDialog.form = {
    name: '',
    code: '',
    status: '启用',
    level: level,
    capacity: null,
    unit: '吨'
  }
}

const openEdit = (node) => {
  editDialog.visible = true
  editDialog.title = '编辑'
  editDialog.mode = 'edit'
  editDialog.targetId = node?.id || ''
  editDialog.form = {
    name: node.name || '',
    code: node.code || '',
    status: node.status || '启用',
    level: node.level || 1,
    capacity: node.capacity || null,
    unit: node.unit || '吨'
  }
}

const submitEdit = async () => {
  const { name, code, status, level, capacity, unit } = editDialog.form
  
  if (!name || !name.trim()) {
    ElMessage.warning('请输入名称')
    return
  }

  try {
    if (editDialog.mode === 'add-root') {
      if (!code || !code.trim()) {
        ElMessage.warning('请输入仓库编码')
        return
      }
      await request({
        url: '/warehouses',
        method: 'post',
        headers: {
          'Accept-Profile': 'scm',
          'Content-Profile': 'scm',
          'Prefer': 'return=representation'
        },
        data: {
          code: code.trim(),
          name: name.trim(),
          level: 1,
          status,
          capacity,
          unit
        }
      })
      ElMessage.success('新增成功')
    } else if (editDialog.mode === 'add-child') {
      const parent = treeDataAll.value.find(w => w.id === editDialog.targetId)
      if (!parent) {
        ElMessage.error('未找到父级')
        return
      }
      const siblings = treeDataAll.value.filter(w => w.parent_id === parent.id)
      const segment = nextSegment(siblings, parent.code)
      const newCode = `${parent.code}.${segment}`
      const paddedSegment = segment.length === 1 ? '0' + segment : segment
      const newCodePadded = level === 3 ? `${parent.code}.${paddedSegment}` : newCode
      
      await request({
        url: '/warehouses',
        method: 'post',
        headers: {
          'Accept-Profile': 'scm',
          'Content-Profile': 'scm',
          'Prefer': 'return=representation'
        },
        data: {
          code: newCodePadded,
          name: name.trim(),
          parent_id: parent.id,
          level,
          status,
          capacity,
          unit
        }
      })
      ElMessage.success('新增成功')
    } else if (editDialog.mode === 'edit') {
      await request({
        url: `/warehouses?id=eq.${editDialog.targetId}`,
        method: 'patch',
        headers: {
          'Accept-Profile': 'scm',
          'Content-Profile': 'scm'
        },
        data: {
          name: name.trim(),
          status,
          capacity,
          unit
        }
      })
      ElMessage.success('更新成功')
    }
    
    await loadWarehouses()
    editDialog.visible = false
  } catch (e) {
    console.error('操作失败:', e)
    ElMessage.error(e.message || '操作失败')
  }
}

const removeNode = async (node) => {
  if (!node?.id) return
  
  try {
    await ElMessageBox.confirm(`确认删除 ${node.name}？`, '提示', {
      type: 'warning'
    })
    
    await request({
      url: `/warehouses?id=eq.${node.id}`,
      method: 'delete',
      headers: {
        'Accept-Profile': 'scm',
        'Content-Profile': 'scm'
      }
    })
    
    ElMessage.success('删除成功')
    await loadWarehouses()
    emit('select', null)
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败:', e)
      ElMessage.error(e.message || '删除失败')
    }
  }
}

onMounted(() => {
  loadWarehouses()
})
</script>

<style scoped>
.warehouse-tree-component {
  height: 100%;
}

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
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
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
  flex-shrink: 0;
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
</style>
