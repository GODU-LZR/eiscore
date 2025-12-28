<template>
  <div class="app-container" style="padding: 20px; height: 100vh;">
    <el-card shadow="never" style="height: 100%; display: flex; flex-direction: column; padding: 0;" :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }">
      
      <eis-data-grid
        ref="gridRef"
        view-id="employee_list"
        api-url="/archives"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig" 
        @create="handleCreate"
        @config-columns="openColumnConfig"
        @view-document="handleViewDocument"
      >
      </eis-data-grid>

      <el-dialog v-model="colConfigVisible" title="列字段管理" width="550px" append-to-body destroy-on-close @closed="resetForm">
        <div class="column-manager">
          <p class="section-title">已定义扩展列：</p>
          <div v-if="extraColumns.length === 0" class="empty-tip">暂无扩展列</div>
          
          <div class="col-list">
            <div v-for="(col, index) in extraColumns" :key="index" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
                <el-tag v-if="col.type === 'formula'" size="small" type="warning" effect="plain" style="margin-left:8px">公式</el-tag>
              </div>
              <div class="col-actions">
                <el-button type="primary" link icon="Edit" @click="editColumn(index)">编辑</el-button>
                <el-button type="danger" link icon="Delete" @click="removeColumn(index)">删除</el-button>
              </div>
            </div>
          </div>
          
          <el-divider />
          
          <div class="form-header">
            <p class="section-title">{{ isEditing ? '编辑列配置' : '新增列' }}：</p>
            <el-button v-if="isEditing" type="info" link size="small" @click="resetForm">取消编辑，返回新增</el-button>
          </div>

          <el-tabs v-model="addTab" type="border-card" class="add-tabs">
            
            <el-tab-pane label="普通数据" name="text">
              <div class="form-row">
                <el-input v-model="currentCol.label" placeholder="列名称 (如: 籍贯)" @keyup.enter="saveColumn" />
                <el-button type="primary" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加' }}
                </el-button>
              </div>
              <p class="hint-text">用于存储普通的文本、数字或日期数据，可自由编辑。</p>
            </el-tab-pane>

            <el-tab-pane label="公式计算" name="formula">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名称 (如: 总工资)" style="margin-bottom: 10px;" />
                
                <div class="formula-area">
                  <el-input 
                    v-model="currentCol.expression" 
                    type="textarea" 
                    :rows="3"
                    placeholder="输入公式 (例如: {基本工资} + {绩效})"
                  />
                  
                  <div class="variable-tags">
                    <span class="tag-tip">点击插入变量:</span>
                    <div class="tags-wrapper">
                      <el-tag 
                        v-for="col in allAvailableColumns" 
                        :key="col.prop" 
                        size="small" 
                        class="cursor-pointer"
                        @click="insertVariable(col.label)"
                      >
                        {{ col.label }}
                      </el-tag>
                    </div>
                  </div>
                </div>

                <el-button type="warning" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label || !currentCol.expression">
                  {{ isEditing ? '保存公式修改' : '添加计算列' }}
                </el-button>
                <p class="hint-text">公式列的值会自动计算并保存，<b>不可手动编辑</b>。</p>
              </div>
            </el-tab-pane>
          </el-tabs>

        </div>
        <template #footer>
          <el-button @click="colConfigVisible = false">关闭</el-button>
        </template>
      </el-dialog>

    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useRouter } from 'vue-router' // 🟢 引入 Router
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const router = useRouter() // 🟢 初始化 Router
const gridRef = ref(null)
const colConfigVisible = ref(false)
const addTab = ref('text') 

const staticColumns = [
  { label: 'ID', prop: 'id', editable: false, width: 80 },
  { label: '姓名', prop: 'name', width: 120 },
  { label: '工号', prop: 'employee_no', editable: false, width: 120 },
  { label: '部门', prop: 'department', width: 120 },
  { label: '状态', prop: 'status', width: 100 }
]

// 可以在这里配置合计规则
const summaryConfig = {
  label: '总计',
  rules: {},
  expressions: {}
}

const extraColumns = ref([])

const isEditing = ref(false)
const editingIndex = ref(-1)

const currentCol = reactive({
  label: '',
  prop: '',
  expression: ''
})

const allAvailableColumns = computed(() => {
  const all = [...staticColumns, ...extraColumns.value]
  if (isEditing.value) {
    return all.filter((c, i) => i !== (staticColumns.length + editingIndex.value))
  }
  return all
})

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
      extraColumns.value = [{ label: '性别', prop: 'gender', type: 'text' }]
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

const insertVariable = (label) => {
  currentCol.expression += `{${label}}`
}

// 🟢 核心修改：处理表单视图跳转
const handleViewDocument = (row) => {
  console.log('跳转详情页，ID:', row.id)
  // 跳转到详情路由，覆盖当前页面
  // 前提：需要在 router/index.js 中配置好 EmployeeDetail 路由
  router.push({
    name: 'EmployeeDetail',
    params: { id: row.id }
  })
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  currentCol.label = col.label
  currentCol.prop = col.prop
  currentCol.expression = col.expression || ''
  
  isEditing.value = true
  editingIndex.value = index
  
  addTab.value = col.type === 'formula' ? 'formula' : 'text'
}

const resetForm = () => {
  isEditing.value = false
  editingIndex.value = -1
  currentCol.label = ''
  currentCol.prop = ''
  currentCol.expression = ''
  addTab.value = 'text'
}

const saveColumn = () => {
  if (!currentCol.label) return
  
  const type = addTab.value
  
  const colConfig = {
    label: currentCol.label,
    type: type
  }

  if (isEditing.value) {
    colConfig.prop = currentCol.prop
  } else {
    colConfig.prop = 'field_' + Math.floor(Math.random() * 10000)
  }

  if (type === 'formula') {
    colConfig.expression = currentCol.expression
  }

  if (isEditing.value) {
    extraColumns.value[editingIndex.value] = colConfig
    ElMessage.success('列配置已更新')
  } else {
    extraColumns.value.push(colConfig)
    ElMessage.success('列已添加')
  }
  
  saveColumnsConfig()
  resetForm()
}

const removeColumn = (index) => {
  extraColumns.value.splice(index, 1)
  saveColumnsConfig()
  if (isEditing.value && editingIndex.value === index) {
    resetForm()
  }
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const handleCreate = async () => {
    try {
      await request({
          url: '/archives',
          method: 'post',
          headers: { 'Content-Profile': 'hr' },
          data: { 
            name: '新员工', 
            status: '试用', 
            employee_no: 'EMP' + Date.now().toString().slice(-6),
            department: '待分配',
            properties: {}
          }
      })
      if(gridRef.value) await gridRef.value.loadData()
      ElMessage.success('已创建新行')
    } catch(e) {
      console.error(e)
      ElMessage.error('创建失败')
    }
}

onMounted(() => {
  loadColumnsConfig()
})
</script>

<style scoped>
.column-manager { padding: 0 5px; }
.section-title { font-weight: bold; margin-bottom: 10px; color: #303133; font-size: 14px; }
.empty-tip { color: #909399; font-size: 12px; margin-bottom: 10px; font-style: italic; }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }

.col-list { 
  max-height: 180px; 
  overflow-y: auto; 
  margin-bottom: 20px; 
  border: 1px solid #ebeef5; 
  padding: 5px; 
  border-radius: 4px; 
  background-color: #fafafa;
}
.col-item { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 6px 10px; 
  border-bottom: 1px solid #ebeef5; 
  background-color: #fff;
}
.col-item:last-child { border-bottom: none; }
.col-info { display: flex; align-items: center; }
.col-label { font-size: 13px; font-weight: 500; }
.col-actions { display: flex; align-items: center; }

.add-tabs { margin-top: 5px; box-shadow: none; border: 1px solid #dcdfe6; }
.form-row { display: flex; gap: 10px; }
.form-col { display: flex; flex-direction: column; }

.formula-area { 
  background-color: #f5f7fa; 
  padding: 10px; 
  border-radius: 4px; 
  border: 1px solid #dcdfe6; 
}
.variable-tags { margin-top: 8px; }
.tag-tip { font-size: 12px; color: #909399; display: block; margin-bottom: 4px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.cursor-pointer { cursor: pointer; user-select: none; }
.cursor-pointer:hover { opacity: 0.8; transform: translateY(-1px); transition: transform 0.1s; }

.hint-text { font-size: 12px; color: #909399; margin-top: 8px; line-height: 1.4; }
</style>