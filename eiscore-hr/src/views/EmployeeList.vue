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

      <el-dialog v-model="colConfigVisible" title="列管理" width="600px" append-to-body destroy-on-close @closed="resetForm">
        <div class="column-manager">
          <p class="section-title">已添加的列：</p>
          <div v-if="extraColumns.length === 0" class="empty-tip">还没有新增列</div>
          
          <div class="col-list">
            <div v-for="(col, index) in extraColumns" :key="index" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
                <el-tag v-if="col.type === 'formula'" size="small" type="warning" effect="plain" style="margin-left:8px">计算</el-tag>
              </div>
              <div class="col-actions">
                <el-button type="primary" link icon="Edit" @click="editColumn(index)">编辑</el-button>
                <el-button type="danger" link icon="Delete" @click="removeColumn(index)">删除</el-button>
              </div>
            </div>
          </div>
          
          <el-divider />
          
          <div class="form-header">
            <p class="section-title">{{ isEditing ? '编辑列' : '新增列' }}：</p>
            <el-button v-if="isEditing" type="info" link size="small" @click="resetForm">取消编辑</el-button>
          </div>

          <el-tabs v-model="addTab" type="border-card" class="add-tabs">
            <el-tab-pane label="普通文字" name="text">
              <div class="form-row">
                <el-input v-model="currentCol.label" placeholder="列名（比如：籍贯）" @keyup.enter="saveColumn" />
                <el-button type="primary" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加' }}
                </el-button>
              </div>
              <p class="hint-text">用于存放普通文字、数字或日期，直接填就行。</p>
            </el-tab-pane>

            <el-tab-pane label="下拉选项" name="select">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：性别）" style="margin-bottom: 10px;" />
                <div class="options-config">
                  <div class="option-row" v-for="(opt, idx) in currentCol.options" :key="idx">
                    <el-input v-model="opt.label" placeholder="选项内容" style="flex: 1;" />
                    <el-select v-model="opt.type" placeholder="颜色(可选)" clearable style="width: 120px;">
                      <el-option label="绿色" value="success" />
                      <el-option label="黄色" value="warning" />
                      <el-option label="红色" value="danger" />
                      <el-option label="蓝色" value="info" />
                    </el-select>
                    <el-button type="danger" link @click="removeSelectOption(idx)">删除</el-button>
                  </div>
                  <el-button class="add-opt-btn" type="primary" plain size="small" @click="addSelectOption">
                    + 添加一项
                  </el-button>
                </div>

                <el-switch
                  v-model="currentCol.tag"
                  active-text="彩色显示"
                  inactive-text="普通样式"
                  style="margin-top: 8px;"
                />

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加下拉列' }}
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="联动选择" name="cascader">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：岗位）" style="margin-bottom: 10px;" />

                <el-select v-model="currentCol.dependsOn" placeholder="先选哪一列" filterable style="width: 100%; margin-bottom: 10px;">
                  <el-option v-for="col in allAvailableColumns" :key="col.prop" :label="col.label" :value="col.prop" />
                </el-select>

                <el-input v-model="currentCol.apiUrl" placeholder="选项来源（管理员给）" style="margin-bottom: 10px;" />

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加联动列' }}
                </el-button>
                <p class="hint-text">上面改了，下面会自动清空，避免选错。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="地图位置" name="geo">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：位置）" style="margin-bottom: 10px;" />
                <el-switch v-model="currentCol.geoAddress" active-text="同时记录地址" inactive-text="只记经纬度" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加地图列' }}
                </el-button>
                <p class="hint-text">后面可在地图上点选位置。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="文件" name="file">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：附件）" style="margin-bottom: 10px;" />
                <div class="form-row">
                  <div class="field-block">
                    <span class="field-label">最多文件数</span>
                    <el-input-number v-model="currentCol.fileMaxCount" :min="1" :max="50" controls-position="right" />
                  </div>
                  <div class="field-block">
                    <span class="field-label">单个文件大小(兆)</span>
                    <el-input-number v-model="currentCol.fileMaxSizeMb" :min="1" :max="50" controls-position="right" />
                  </div>
                </div>
                <el-input v-model="currentCol.fileAccept" placeholder="允许格式（可不写）" style="margin-top: 10px;" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加文件列' }}
                </el-button>
                <p class="hint-text">可上传多个文件，系统自动保存。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="自动计算" name="formula">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：总工资）" style="margin-bottom: 10px;" />

                <div class="formula-area">
                  <el-input 
                    v-model="currentCol.expression" 
                    type="textarea" 
                    :rows="3"
                    placeholder="写计算方法（比如：{基本工资}+{绩效}）"
                  />
                  
                  <div class="variable-tags">
                    <span class="tag-tip">点一下插入列名:</span>
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
                  {{ isEditing ? '保存计算修改' : '添加计算列' }}
                </el-button>
                <p class="hint-text">计算列会自动算好并保存，<b>不能手动改</b>。</p>
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
  { label: '编号', prop: 'id', editable: false, width: 80 },
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
  expression: '',
  options: [],
  tag: false,
  dependsOn: '',
  apiUrl: '',
  labelField: 'label',
  valueField: 'value',
  geoAddress: true,
  fileMaxSizeMb: 20,
  fileMaxCount: 3,
  fileAccept: ''
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

const addSelectOption = () => {
  currentCol.options.push({ label: '', type: '' })
}

const removeSelectOption = (index) => {
  currentCol.options.splice(index, 1)
}

// 🟢 核心修改：处理表单视图跳转
const handleViewDocument = (row) => {
  console.log('跳转详情页，编号:', row.id)
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
  currentCol.options = Array.isArray(col.options)
    ? col.options.map(opt => ({
        label: opt.label ?? opt.value ?? '',
        type: opt.type || ''
      }))
    : []
  currentCol.tag = !!col.tag
  currentCol.dependsOn = col.dependsOn || ''
  currentCol.apiUrl = col.apiUrl || ''
  currentCol.labelField = col.labelField || 'label'
  currentCol.valueField = col.valueField || 'value'
  currentCol.geoAddress = col.geoAddress !== false
  currentCol.fileMaxSizeMb = col.fileMaxSizeMb || 20
  currentCol.fileMaxCount = col.fileMaxCount || 3
  currentCol.fileAccept = col.fileAccept || ''
  
  isEditing.value = true
  editingIndex.value = index
  
  if (col.type === 'formula') addTab.value = 'formula'
  else if (col.type === 'select' || col.type === 'dropdown') addTab.value = 'select'
  else if (col.type === 'cascader') addTab.value = 'cascader'
  else if (col.type === 'geo') addTab.value = 'geo'
  else if (col.type === 'file') addTab.value = 'file'
  else addTab.value = 'text'
}

const resetForm = () => {
  isEditing.value = false
  editingIndex.value = -1
  currentCol.label = ''
  currentCol.prop = ''
  currentCol.expression = ''
  currentCol.options = []
  currentCol.tag = false
  currentCol.dependsOn = ''
  currentCol.apiUrl = ''
  currentCol.labelField = 'label'
  currentCol.valueField = 'value'
  currentCol.geoAddress = true
  currentCol.fileMaxSizeMb = 20
  currentCol.fileMaxCount = 3
  currentCol.fileAccept = ''
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
  } else if (type === 'select') {
    colConfig.type = 'select'
    colConfig.tag = !!currentCol.tag
    const toText = (val) => (val === null || val === undefined) ? '' : String(val)
    const cleanOptions = currentCol.options
      .map(opt => {
        const text = toText(opt.label).trim()
        return {
          label: text,
          value: text,
          type: opt.type || ''
        }
      })
      .filter(opt => opt.label)
    if (cleanOptions.length === 0) {
      ElMessage.warning('请至少添加一个选项')
      return
    }
    colConfig.options = cleanOptions
  } else if (type === 'cascader') {
    if (!currentCol.dependsOn) {
      ElMessage.warning('请选择上一级列')
      return
    }
    if (!currentCol.apiUrl) {
      ElMessage.warning('请填写选项来源')
      return
    }
    colConfig.dependsOn = currentCol.dependsOn
    colConfig.apiUrl = currentCol.apiUrl.trim()
    colConfig.labelField = currentCol.labelField?.trim() || 'label'
    colConfig.valueField = currentCol.valueField?.trim() || 'value'
  } else if (type === 'geo') {
    colConfig.geoAddress = !!currentCol.geoAddress
  } else if (type === 'file') {
    colConfig.fileMaxSizeMb = Math.max(1, Number(currentCol.fileMaxSizeMb) || 20)
    colConfig.fileMaxCount = Math.max(1, Number(currentCol.fileMaxCount) || 3)
    colConfig.fileAccept = currentCol.fileAccept?.trim() || ''
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

.field-block { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.field-label { font-size: 12px; color: #606266; }
.field-block .el-input-number { width: 100%; }

.formula-area { 
  background-color: #f5f7fa; 
  padding: 10px; 
  border-radius: 4px; 
  border: 1px solid #dcdfe6; 
}
.options-config {
  margin-top: 8px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}
.option-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.add-opt-btn { width: 100%; }
.variable-tags { margin-top: 8px; }
.tag-tip { font-size: 12px; color: #909399; display: block; margin-bottom: 4px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.cursor-pointer { cursor: pointer; user-select: none; }
.cursor-pointer:hover { opacity: 0.8; transform: translateY(-1px); transition: transform 0.1s; }

.hint-text { font-size: 12px; color: #909399; margin-top: 8px; line-height: 1.4; }
</style>
