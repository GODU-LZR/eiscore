<template>
  <div class="app-container" style="padding: 20px; height: 100vh;">
    <el-card shadow="never" style="height: 100%; display: flex; flex-direction: column; padding: 0;" :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }">
      
      <eis-data-grid
        ref="gridRef"
        view-id="employee_list"
        api-url="/archives"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
      >
        <template #toolbar>
          <el-button type="primary" icon="Plus" @click="handleCreate">新增</el-button>
          
          <el-popover placement="bottom" title="扩展列设置" :width="300" trigger="click">
            <template #reference>
              <el-button icon="Setting" circle title="配置扩展列"></el-button>
            </template>
            <div class="column-setting-box">
              <div v-for="(col, index) in extraColumns" :key="index" style="margin-bottom:5px; display:flex;">
                <el-input v-model="col.label" size="small" style="width:100px"/>
                <el-button type="danger" link icon="Delete" size="small" @click="removeColumn(index)"></el-button>
              </div>
              <div style="margin-top:10px; display:flex;">
                 <el-input v-model="newColName" size="small" placeholder="列名" />
                 <el-button type="primary" size="small" @click="addColumn">添加</el-button>
              </div>
            </div>
          </el-popover>

          <el-button type="info" link @click="refresh" icon="Refresh">刷新</el-button>
        </template>
      </eis-data-grid>

    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import EisDataGrid from '@/components/EisDataGrid.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const gridRef = ref(null)

// 1. 固定列定义 (极其简洁)
const staticColumns = [
  { label: 'ID', prop: 'id', editable: false },
  { label: '姓名', prop: 'name' },
  { label: '工号', prop: 'employee_no', editable: false },
  { label: '部门', prop: 'department' },
  { label: '状态', prop: 'status' }
]

// 2. 动态列逻辑 (从 system_configs 读取)
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

// 3. 新增逻辑
const handleCreate = async () => {
    // 插入空行，然后刷新表格让用户去改
    await request({
        url: '/archives',
        method: 'post',
        headers: { 'Content-Profile': 'hr' },
        data: { name: '新员工', status: '试用', employee_no: 'EMP'+Date.now() }
    })
    gridRef.value.loadData()
    ElMessage.success('已创建新行，请编辑')
}

const refresh = () => {
  gridRef.value.loadData()
}

onMounted(() => {
  loadColumnsConfig()
})
</script>