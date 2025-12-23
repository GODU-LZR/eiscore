<template>
  <div class="app-container" style="padding: 20px;">
    <el-card shadow="never" class="mb-20">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 10px;">
          <el-input 
            v-model="searchQuery" 
            placeholder="🔍 搜姓名/部门/动态字段..." 
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
        
        <div style="display: flex; gap: 10px; align-items: center;">
          <el-popover placement="bottom" title="表格列设置" :width="300" trigger="click">
            <template #reference>
              <el-button icon="Setting" circle title="配置扩展列"></el-button>
            </template>
            
            <div class="column-setting-box">
              <p style="font-size: 12px; color: #999; margin-bottom: 10px;">添加自定义字段（自动存入 JSON）</p>
              <div v-for="(col, index) in extraColumns" :key="index" class="setting-item">
                <el-input v-model="col.label" size="small" placeholder="列名 (如: 鞋码)" style="width: 100px;"/>
                <el-input v-model="col.prop" size="small" placeholder="Key (如: size)" style="width: 80px; margin-left: 5px;" disabled />
                <el-button type="danger" link icon="Delete" size="small" @click="removeColumn(index)" style="margin-left: auto;"></el-button>
              </div>
              
              <div style="margin-top: 10px; display: flex; gap: 5px;">
                 <el-input v-model="newColName" size="small" placeholder="输入新列名 (如: 籍贯)" />
                 <el-button type="primary" size="small" @click="addColumn">添加</el-button>
              </div>
            </div>
          </el-popover>

          <el-tag :type="collaborativeMode ? 'success' : 'info'" effect="plain" style="cursor: pointer" @click="toggleMode">
            协同模式：{{ collaborativeMode ? '开启' : '关闭' }}
          </el-tag>
          <el-button type="info" link @click="fetchData" icon="Refresh">刷新</el-button>
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
            <el-input v-if="row.isEditing" v-model="row.name" />
            <span v-else style="font-weight: bold">{{ row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column label="部门" width="150">
          <template #default="{ row }">
             <el-select v-if="row.isEditing" v-model="row.department" allow-create filterable default-first-option>
              <el-option label="总公司/研发部" value="总公司/研发部" />
              <el-option label="生产部/一车间" value="生产部/一车间" />
            </el-select>
            <span v-else>{{ row.department }}</span>
          </template>
        </el-table-column>
        
        <el-table-column 
          v-for="col in extraColumns" 
          :key="col.prop" 
          :label="col.label + ' (扩展)'" 
          min-width="120"
        >
          <template #default="{ row }">
            <el-input 
              v-if="row.isEditing" 
              v-model="row.properties[col.prop]" 
              :placeholder="'输入' + col.label" 
            />
            <span v-else style="color: #666">{{ row.properties?.[col.prop] || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-select v-if="row.isEditing" v-model="row.status" size="small">
              <el-option label="在职" value="在职" />
              <el-option label="离职" value="离职" />
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
import { ref, onMounted } from 'vue' // 去掉了 watch，改用手动触发保存
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const searchQuery = ref('')
const backupData = new Map()
const collaborativeMode = ref(true)

// 🟢 1. 定义动态列 (默认为空，等待从数据库加载)
const extraColumns = ref([])
const newColName = ref('')

// 🟢 2. 从数据库加载列配置
const loadColumnsConfig = async () => {
  try {
    // 查 public.system_configs 表
    const res = await request({
      url: '/system_configs?key=eq.hr_table_cols',
      method: 'get',
      // 👇 【关键修复】显式覆盖 Header，告诉后端去 public 找表
      headers: {
        'Accept-Profile': 'public' 
      }
    })
    
    if (res && res.length > 0) {
      extraColumns.value = res[0].value 
    } else {
      // 默认值...
      extraColumns.value = [
        { label: '性别', prop: 'gender' },
        { label: '身份证', prop: 'id_card' }
      ]
    }
  } catch (e) {
    console.error('加载列配置失败', e)
  }
}

// 🟢 3. 保存列配置到数据库
const saveColumnsConfig = async () => {
  try {
    await request({
      url: '/system_configs',
      method: 'post',
      headers: {
        'Prefer': 'resolution=merge-duplicates',
        // 👇 【关键修复】读写都必须指定 public
        'Accept-Profile': 'public',
        'Content-Profile': 'public' 
      },
      data: {
        key: 'hr_table_cols',
        value: extraColumns.value 
      }
    })
    console.log('列配置已同步到云端')
  } catch (e) {
    console.error('保存列配置失败', e)
    ElMessage.warning('列配置同步失败')
  }
}

// 🟢 4. 添加列 (修改后)
const addColumn = () => {
  if (!newColName.value) return
  
  const key = 'field_' + Math.floor(Math.random() * 10000)
  extraColumns.value.push({ label: newColName.value, prop: key })
  newColName.value = ''
  
  ElMessage.success('列添加成功')
  saveColumnsConfig() // 立即同步到数据库
}

// 🟢 5. 删除列 (修改后)
const removeColumn = (index) => {
  extraColumns.value.splice(index, 1)
  saveColumnsConfig() // 立即同步到数据库
}

const toggleMode = () => {
  collaborativeMode.value = !collaborativeMode.value
  ElMessage.info(`协同模式已${collaborativeMode.value ? '开启' : '关闭'}`)
}

// 获取员工数据 (保持不变)
const fetchData = async () => {
  loading.value = true
  try {
    let url = '/archives?order=id.desc'
    if (searchQuery.value) {
      const q = searchQuery.value
      url += `&or=(name.like.*${q}*,department.like.*${q}*)`
    }
    const res = await request({ url, method: 'get' })
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

// ... handleCreate, handleEdit, cancelEdit, saveRow, handleDelete 保持不变 ...
// (为了节省篇幅，这里省略重复代码，请保留你原有的 saveRow 逻辑)
// 记得 saveRow 里的 request 需要保留 'Content-Profile': 'hr'

const handleCreate = () => {
  tableData.value.unshift({ name: '', department: '', status: '试用', properties: {}, isEditing: true })
}
const handleEdit = (row) => {
  backupData.set(row.id, JSON.parse(JSON.stringify(row)))
  row.isEditing = true
}
const cancelEdit = (row) => {
  if (!row.id) tableData.value.splice(tableData.value.indexOf(row), 1)
  else { Object.assign(row, backupData.get(row.id)); row.isEditing = false }
}
const saveRow = async (row) => {
  // ... 请保留你之前完善的 saveRow 代码 ...
  // 这里仅示例最关键的部分
  if (!row.name) return ElMessage.warning('姓名必填')
  try {
    const { isEditing, id, ...payload } = row
    if (id) {
       let url = `/archives?id=eq.${id}`
       if (collaborativeMode.value) url += `&version=eq.${payload.version}`
       const nextVer = (payload.version || 1) + 1
       const res = await request({
         url, method: 'patch',
         headers: { 'Prefer': 'return=representation', 'Content-Profile': 'hr' },
         data: { ...payload, version: nextVer, updated_at: new Date().toISOString() }
       })
       if (collaborativeMode.value && res.length===0) return ElMessageBox.alert('版本冲突')
       if(res.length) Object.assign(row, res[0])
    } else {
       if (!payload.employee_no) payload.employee_no = 'EMP'+Date.now()
       const res = await request({
         url: '/archives', method: 'post',
         headers: { 'Prefer': 'return=representation', 'Content-Profile': 'hr' },
         data: payload
       })
       if(res.length) Object.assign(row, res[0])
    }
    row.isEditing = false
    if(!row.properties) row.properties={}
    ElMessage.success('保存成功')
  } catch(e) { ElMessage.error('保存失败') }
}
const handleDelete = (row) => {
    ElMessageBox.confirm('确定删除?').then(async () => {
        await request({ url: `/archives?id=eq.${row.id}`, method: 'delete' })
        ElMessage.success('已删除'); fetchData()
    })
}
const statusColor = (s) => ({'在职':'success','离职':'info'}[s] || 'warning')

// 🟢 初始化
onMounted(() => {
  loadColumnsConfig() // 先加载列配置
  fetchData()         // 再加载数据
})
</script>

<style scoped>
.mb-20 { margin-bottom: 20px; }
.setting-item { display: flex; align-items: center; margin-bottom: 5px; }
.column-setting-box { padding: 5px; }
</style>