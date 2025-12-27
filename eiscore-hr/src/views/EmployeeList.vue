<template>
  <div class="app-container" style="padding: 20px; height: 100vh;">
    <el-card shadow="never" style="height: 100%; display: flex; flex-direction: column; padding: 0;" :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }">
      
      <eis-data-grid
        ref="gridRef"
        view-id="employee_list"
        api-url="/archives"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        @create="handleCreate"
        @config-columns="openColumnConfig"
      >
      </eis-data-grid>

      <el-dialog v-model="colConfigVisible" title="扩展列设置" width="400px" append-to-body>
        <div class="column-setting-box">
          <p style="margin-bottom: 12px; color: #909399; font-size: 13px;">管理动态扩展字段：</p>
          <div v-for="(col, index) in extraColumns" :key="index" style="margin-bottom:8px; display:flex; gap: 8px;">
            <el-input v-model="col.label" size="small" placeholder="列显示名称"/>
            <el-button type="danger" plain icon="Delete" size="small" @click="removeColumn(index)">删除</el-button>
          </div>
          
          <el-divider content-position="left">新增列</el-divider>
          
          <div style="display:flex; gap: 8px;">
             <el-input v-model="newColName" size="small" placeholder="输入新列名称 (如: 籍贯)" @keyup.enter="addColumn" />
             <el-button type="primary" size="small" @click="addColumn" :disabled="!newColName">添加</el-button>
          </div>
        </div>
        <template #footer>
          <el-button @click="colConfigVisible = false">关闭</el-button>
        </template>
      </el-dialog>

    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import EisDataGrid from '@/components/EisDataGrid.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const gridRef = ref(null)
const colConfigVisible = ref(false) // 控制列配置弹窗

// 1. 固定列定义
const staticColumns = [
  { label: 'ID', prop: 'id', editable: false, width: 80 },
  { label: '姓名', prop: 'name', width: 120 },
  { label: '工号', prop: 'employee_no', editable: false, width: 120 },
  { label: '部门', prop: 'department', width: 120 },
  { label: '状态', prop: 'status', width: 100 }
]

// 2. 动态列逻辑
const extraColumns = ref([])
const newColName = ref('')

const loadColumnsConfig = async () => {
  try {
    const res = await request({
      url: '/system_configs?key=eq.hr_table_cols',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = [{ label: '性别', prop: 'gender' }]
    }
  } catch (e) { console.error(e) }
}

const saveColumnsConfig = async () => {
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: 'hr_table_cols', value: extraColumns.value }
  })
}

const addColumn = () => {
  if (!newColName.value) return
  const key = 'field_' + Math.floor(Math.random() * 10000)
  extraColumns.value.push({ label: newColName.value, prop: key })
  newColName.value = ''
  saveColumnsConfig()
}

const removeColumn = (index) => {
  extraColumns.value.splice(index, 1)
  saveColumnsConfig()
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

// 3. 新增逻辑 (这是之前正确的逻辑)
const handleCreate = async () => {
    // 插入数据
    try {
      await request({
          url: '/archives',
          method: 'post',
          headers: { 'Content-Profile': 'hr' },
          data: { 
            name: '新员工', 
            status: '试用', 
            employee_no: 'EMP' + Date.now().toString().slice(-6), // 自动生成工号
            department: '待分配',
            properties: {}
          }
      })
      // 刷新子组件表格
      if(gridRef.value) {
        await gridRef.value.loadData()
      }
      ElMessage.success('已创建新行，请直接编辑')
    } catch(e) {
      console.error(e)
      ElMessage.error('创建失败')
    }
}

onMounted(() => {
  loadColumnsConfig()
})
</script>