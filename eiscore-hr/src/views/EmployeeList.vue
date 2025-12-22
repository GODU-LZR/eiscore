<template>
  <div class="app-container" style="padding: 20px;">
    <el-card shadow="never" class="mb-20">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 10px;">
          <el-input 
            v-model="searchQuery" 
            placeholder="🔍 输入姓名或部门搜索..." 
            style="width: 250px;" 
            clearable 
            @keyup.enter="fetchData"
            @clear="fetchData"
          >
            <template #append>
              <el-button @click="fetchData" icon="Search" />
            </template>
          </el-input>

          <el-button type="primary" @click="handleCreate">
            <el-icon style="margin-right: 5px"><Plus /></el-icon> 新增员工
          </el-button>
        </div>
        
        <div>
          <el-tag type="warning" effect="plain">协同模式：开启</el-tag>
          <el-button type="info" link @click="fetchData" icon="Refresh" style="margin-left: 10px">刷新</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table 
        v-loading="loading"
        :data="tableData" 
        border 
        stripe 
        highlight-current-row
        style="width: 100%"
        height="calc(100vh - 220px)"
      >
        <el-table-column prop="id" label="ID" width="60" align="center" fixed />

        <el-table-column label="姓名" width="120" fixed>
          <template #default="{ row }">
            <el-input v-if="row.isEditing" v-model="row.name" placeholder="输入姓名" />
            <span v-else style="font-weight: bold">{{ row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column label="部门/车间" width="180">
          <template #default="{ row }">
            <el-select 
              v-if="row.isEditing" 
              v-model="row.department" 
              allow-create 
              filterable 
              default-first-option
              placeholder="选择或输入"
            >
              <el-option label="总公司/研发部" value="总公司/研发部" />
              <el-option label="总公司/人事部" value="总公司/人事部" />
              <el-option label="生产部/一车间" value="生产部/一车间" />
              <el-option label="生产部/二车间" value="生产部/二车间" />
            </el-select>
            <span v-else>{{ row.department }}</span>
          </template>
        </el-table-column>

        <el-table-column label="职位" width="140">
          <template #default="{ row }">
            <el-input v-if="row.isEditing" v-model="row.position" />
            <span v-else>{{ row.position }}</span>
          </template>
        </el-table-column>

        <el-table-column label="手机号" width="140">
          <template #default="{ row }">
            <el-input v-if="row.isEditing" v-model="row.phone" />
            <span v-else>{{ row.phone }}</span>
          </template>
        </el-table-column>

        <el-table-column label="性别 (扩展)" width="100">
          <template #default="{ row }">
            <el-select v-if="row.isEditing" v-model="row.properties.gender">
              <el-option label="男" value="男" />
              <el-option label="女" value="女" />
            </el-select>
            <el-tag v-else type="info" size="small">{{ row.properties?.gender || '-' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="身份证号 (扩展)" min-width="180">
          <template #default="{ row }">
            <el-input v-if="row.isEditing" v-model="row.properties.id_card" placeholder="扩展字段演示" />
            <span v-else style="color: #666">{{ row.properties?.id_card || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-select v-if="row.isEditing" v-model="row.status">
              <el-option label="在职" value="在职" />
              <el-option label="离职" value="离职" />
              <el-option label="试用" value="试用" />
            </el-select>
            <el-tag v-else :type="statusColor(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <div v-if="row.isEditing">
              <el-button type="success" size="small" icon="Check" circle @click="saveRow(row)"></el-button>
              <el-button type="info" size="small" icon="Close" circle @click="cancelEdit(row)"></el-button>
            </div>
            <div v-else>
              <el-button type="primary" link icon="Edit" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" link icon="Delete" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const searchQuery = ref('')
// 备份数据，用于取消编辑时恢复
const backupData = new Map()

// 1. 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    let url = '/archives?order=id.desc' // 🟢 注意：因为有 Schema 隔离，这里直接查 archives
    // 模糊搜索：PostgREST 语法 name.like.*key* or department.like.*key*
    if (searchQuery.value) {
      const q = searchQuery.value
      url += `&or=(name.like.*${q}*,department.like.*${q}*)`
    }
    
    const res = await request({ url, method: 'get' })
    
    // 数据处理：确保 properties 是对象，isEditing 为 false
    tableData.value = res.map(item => ({
      ...item,
      properties: item.properties || {}, 
      isEditing: false
    }))
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 2. 新增空行
const handleCreate = () => {
  const newRow = {
    name: '',
    department: '',
    position: '',
    phone: '',
    status: '试用',
    properties: { gender: '', id_card: '' },
    isEditing: true // 默认进入编辑模式
  }
  // 插入到第一行
  tableData.value.unshift(newRow)
}

// 3. 进入编辑模式
const handleEdit = (row) => {
  // 备份当前行数据 (深拷贝)
  backupData.set(row.id, JSON.parse(JSON.stringify(row)))
  row.isEditing = true
}

// 4. 取消编辑
const cancelEdit = (row) => {
  if (!row.id) {
    // 如果是新建的还没保存的行，直接从表格移除
    const index = tableData.value.indexOf(row)
    if (index > -1) tableData.value.splice(index, 1)
  } else {
    // 恢复旧数据
    const old = backupData.get(row.id)
    if (old) Object.assign(row, old)
    row.isEditing = false
  }
}

// 5. 保存数据 (核心: P0 智能花名册逻辑)
const saveRow = async (row) => {
  if (!row.name) return ElMessage.warning('姓名不能为空')

  try {
    // 提取纯净数据 (去掉 isEditing 等前端字段)
    const { isEditing, id, ...payload } = row
    
    // 自动生成工号 (如果是新增)
    if (!payload.employee_no) {
      payload.employee_no = 'EMP' + Date.now().toString().slice(-6)
    }

    if (id) {
      // === 更新 (带乐观锁) ===
      // 请求：UPDATE ... WHERE id=xx AND version=old_version
      const nextVersion = (payload.version || 1) + 1
      
      const res = await request({
        url: `/archives?id=eq.${id}&version=eq.${payload.version}`,
        method: 'patch',
        headers: { 'Prefer': 'return=representation' }, // 让后端返回更新后的新数据
        data: {
          ...payload,
          version: nextVersion,
          updated_at: new Date().toISOString()
        }
      })
      
      if (res.length === 0) {
        ElMessageBox.alert('保存失败！该数据已被其他人修改，请刷新后重试。', '协同冲突')
        return
      }
      
      Object.assign(row, res[0]) // 更新前端数据
      ElMessage.success('更新成功')
      
    } else {
      // === 新增 ===
      const res = await request({
        url: '/archives',
        method: 'post',
        headers: { 'Prefer': 'return=representation' },
        data: payload
      })
      
      if (res && res.length > 0) {
        Object.assign(row, res[0]) // 回填 ID 和其他后端生成的字段
      }
      ElMessage.success('创建成功')
    }
    
    // 退出编辑模式
    row.isEditing = false
    // 确保 properties 还是对象 (防止后端返回 null)
    if (!row.properties) row.properties = {}
    
  } catch (error) {
    console.error(error)
    // 检查是否是唯一键冲突 (如工号重复)
    if (error.response?.data?.message?.includes('duplicate key')) {
      ElMessage.error('保存失败：工号重复')
    } else {
      ElMessage.error('保存失败')
    }
  }
}

// 6. 删除
const handleDelete = (row) => {
  ElMessageBox.confirm(`确认删除员工 "${row.name}" 吗？`, '警告', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(async () => {
    await request({
      url: `/archives?id=eq.${row.id}`,
      method: 'delete'
    })
    ElMessage.success('已删除')
    fetchData() // 重新加载
  })
}

// 辅助：状态颜色
const statusColor = (status) => {
  const map = { '在职': 'success', '离职': 'info', '试用': 'warning' }
  return map[status] || ''
}

onMounted(fetchData)
</script>

<style scoped>
.mb-20 { margin-bottom: 20px; }
</style>