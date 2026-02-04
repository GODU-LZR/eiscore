<template>
  <div class="app-container">
    <div class="app-header">
      <div class="header-text">
        <h2>{{ app.name }}</h2>
        <p>{{ app.desc }}</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <el-card
      shadow="never"
      class="grid-card"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }"
    >
      <eis-data-grid
        ref="gridRef"
        :view-id="app.viewId"
        :api-url="apiUrl"
        :write-url="apiUrl"
        :accept-profile="schemaName"
        :content-profile="schemaName"
        :include-properties="true"
        write-mode="upsert"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig"
        :can-create="true"
        :can-edit="true"
        :can-delete="true"
        :can-export="true"
        :can-config="true"
        @create="handleCreate"
        @config-columns="openColumnConfig"
      />

      <el-dialog v-model="colConfigVisible" title="列管理" width="600px" append-to-body destroy-on-close @closed="resetForm">
        <div class="column-manager">
          <p class="section-title">固定列显示：</p>
          <div class="col-list">
            <div v-for="col in staticColumnsAll" :key="col.prop" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
              </div>
              <div class="col-actions">
                <el-switch
                  :model-value="isStaticVisible(col.prop)"
                  active-text="显示"
                  inactive-text="隐藏"
                  @change="toggleStaticColumn(col.prop, $event)"
                />
              </div>
            </div>
          </div>

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
                    <el-button type="danger" link @click="removeSelectOption(idx)">删除</el-button>
                  </div>
                  <el-button class="add-opt-btn" type="primary" plain size="small" @click="addSelectOption">
                    + 添加一项
                  </el-button>
                </div>

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加下拉列' }}
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="联动选择" name="cascader">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：岗位）" style="margin-bottom: 10px;" />

                <el-select v-model="currentCol.dependsOn" placeholder="先选哪一列（下拉或联动都可以）" filterable style="width: 100%; margin-bottom: 10px;">
                  <el-option v-for="col in cascaderParentColumns" :key="col.prop" :label="col.label" :value="col.prop" />
                </el-select>

                <div v-if="currentCol.dependsOn && cascaderParentOptions.length === 0" class="hint-text">
                  先给上一级列设置选项，才能配置联动。
                </div>
                <div v-else-if="currentCol.dependsOn" class="cascader-map">
                  <div v-for="opt in cascaderParentOptions" :key="opt.value" class="cascader-node">
                    <div class="cascader-parent-row">
                      <span class="cascader-parent">{{ opt.label }}</span>
                    </div>
                    <div class="cascader-children">
                      <div v-if="getCascaderChildren(opt.value).length > 0" class="cascader-tags">
                        <el-tag
                          v-for="child in getCascaderChildren(opt.value)"
                          :key="child"
                          size="small"
                          closable
                          @close="removeCascaderChild(opt.value, child)"
                        >
                          {{ child }}
                        </el-tag>
                      </div>
                      <div class="cascader-add">
                        <el-input
                          v-model="cascaderInputMap[opt.value]"
                          placeholder="输入一个下级选项"
                          @keyup.enter="addCascaderChild(opt.value)"
                        />
                        <el-button type="primary" plain @click="addCascaderChild(opt.value)">添加</el-button>
                      </div>
                      <div v-if="getCascaderChildren(opt.value).length === 0" class="hint-text">还没有下级选项</div>
                    </div>
                  </div>
                </div>

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
                  <div class="formula-actions">
                    <el-button size="small" type="primary" plain @click="openAiFormula">AI生成公式</el-button>
                    <span class="formula-tip">把需求告诉工作助手，自动生成复杂公式</span>
                  </div>
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
import { ref, onMounted, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const props = defineProps({
  appData: { type: Object, default: null },
  appId: { type: String, default: '' }
})

const router = useRouter()
const gridRef = ref(null)
const colConfigVisible = ref(false)
const addTab = ref('text')

const staticHidden = ref([])
const extraColumns = ref([])
const staticColumnsAll = ref([])

const isEditing = ref(false)
const editingIndex = ref(-1)

const currentCol = reactive({
  label: '',
  prop: '',
  expression: '',
  options: [],
  dependsOn: '',
  cascaderMap: {},
  geoAddress: true,
  fileMaxSizeMb: 20,
  fileMaxCount: 3,
  fileAccept: ''
})

const normalizeConfig = (raw) => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const sanitizeFieldName = (value) => {
  if (value === null || value === undefined) return ''
  let name = String(value).trim().toLowerCase()
  if (!name) return ''
  name = name.replace(/[^a-z0-9_]+/g, '_')
  if (!name) return ''
  if (!/^[a-z]/.test(name)) {
    name = `f_${name}`
  }
  return name
}

const app = computed(() => {
  const cfg = normalizeConfig(props.appData?.config)
  return {
    name: props.appData?.name || '数据应用',
    desc: props.appData?.desc || props.appData?.description || '',
    viewId: cfg.viewId || (props.appId ? `app_center_${props.appId}` : 'app_center')
  }
})

const configRef = ref({
  table: '',
  columns: [],
  summary: { label: '合计', rules: {}, expressions: {} },
  staticHidden: []
})

const schemaName = computed(() => {
  const table = configRef.value.table || ''
  return table.includes('.') ? table.split('.')[0] : 'app_data'
})

const apiUrl = computed(() => {
  const table = configRef.value.table || ''
  if (!table) return ''
  const tableName = table.includes('.') ? table.split('.')[1] : table
  return `/${tableName}`
})

const summaryConfig = computed(() => configRef.value.summary || { label: '合计', rules: {}, expressions: {} })

const staticColumns = computed(() =>
  staticColumnsAll.value.filter(col => !staticHidden.value.includes(col.prop))
)

const normalizeColumns = (raw) => {
  if (!raw) return { columns: [], changed: false }
  let list = []
  if (Array.isArray(raw)) list = raw
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      return { columns: [], changed: false }
    }
  }
  if (list.length === 0) return { columns: [], changed: false }

  let changed = false
  const columns = list.map((item) => {
    const { column, changed: columnChanged } = normalizeColumn(item)
    if (columnChanged) changed = true
    return column
  })

  return { columns, changed }
}

const normalizeColumn = (col) => {
  if (!col) return { column: { prop: '', label: '', type: 'text' }, changed: false }
  if (typeof col === 'string') {
    const sanitized = sanitizeFieldName(col)
    return {
      column: { prop: sanitized || col, label: col, type: 'text', isStatic: true },
      changed: sanitized !== col
    }
  }
  const rawField = col.field || col.prop || col.label || ''
  const sanitized = sanitizeFieldName(rawField)
  const dependsOnRaw = col.dependsOn || ''
  const dependsOn = dependsOnRaw ? sanitizeFieldName(dependsOnRaw) : ''
  const changed = (rawField && sanitized && sanitized !== rawField) || (dependsOnRaw && dependsOn && dependsOnRaw !== dependsOn)
  return {
    column: {
      prop: sanitized || rawField,
      label: col.label || sanitized || rawField || '',
      type: col.type || 'text',
      options: col.options || [],
      expression: col.expression || '',
      dependsOn: dependsOn || '',
      cascaderOptions: col.cascaderOptions || col.cascaderMap || {},
      geoAddress: col.geoAddress,
      fileMaxCount: col.fileMaxCount,
      fileMaxSizeMb: col.fileMaxSizeMb,
      fileAccept: col.fileAccept,
      isStatic: col.isStatic !== false
    },
    changed
  }
}

const normalizeStaticHidden = (raw, availableProps = []) => {
  if (!Array.isArray(raw)) return { list: [], changed: false }
  const next = raw
    .map(item => sanitizeFieldName(item) || item)
    .filter(Boolean)
  const propSet = new Set(availableProps)
  const filtered = next.filter(item => propSet.has(item))
  const changed = JSON.stringify(filtered) !== JSON.stringify(raw)
  return { list: filtered, changed }
}

const loadConfigFromApp = async () => {
  const cfg = normalizeConfig(props.appData?.config)
  const { columns, changed: columnsChanged } = normalizeColumns(cfg.columns)
  const availableProps = columns.map(col => col.prop).filter(Boolean)
  const { list: hiddenList, changed: hiddenChanged } = normalizeStaticHidden(cfg.staticHidden, availableProps)

  staticColumnsAll.value = columns.filter(col => col.isStatic !== false)
  extraColumns.value = columns.filter(col => col.isStatic === false)
  staticHidden.value = hiddenList

  const nextConfig = {
    ...configRef.value,
    ...cfg,
    columns: buildColumnsPayload(),
    staticHidden: hiddenList
  }
  configRef.value = nextConfig

  if ((columnsChanged || hiddenChanged) && props.appId) {
    try {
      await saveAppConfig(nextConfig)
    } catch (error) {
      console.warn('Failed to normalize app config', error)
    }
  }
}

watch(() => props.appData, () => {
  loadConfigFromApp()
}, { immediate: true })

const allAvailableColumns = computed(() => {
  const all = [...staticColumns.value, ...extraColumns.value]
  if (isEditing.value) {
    return all.filter((c, i) => i !== (staticColumns.value.length + editingIndex.value))
  }
  return all
})

const isSelectColumnConfig = (col) => {
  if (!col) return false
  if (Array.isArray(col.options) && col.options.length > 0) return true
  return false
}

const isCascaderColumnConfig = (col) => {
  if (!col) return false
  if (col.type !== 'cascader') return false
  if (col.cascaderOptions && Object.keys(col.cascaderOptions).length > 0) return true
  return false
}

const cascaderParentColumns = computed(() => {
  return allAvailableColumns.value.filter(col => isSelectColumnConfig(col) || isCascaderColumnConfig(col) || col.type === 'cascader')
})

const normalizeCascaderOption = (opt) => {
  if (opt === null || opt === undefined) return null
  if (typeof opt === 'string' || typeof opt === 'number') {
    const text = String(opt)
    return { label: text, value: text }
  }
  const label = opt.label ?? opt.value ?? ''
  const value = opt.value ?? opt.label ?? ''
  const labelText = String(label || value)
  const valueText = String(value || label)
  return { label: labelText, value: valueText }
}

const cascaderParentOptions = computed(() => {
  const parentCol = cascaderParentColumns.value.find(col => col.prop === currentCol.dependsOn)
  if (!parentCol) return []
  if (Array.isArray(parentCol.options)) {
    return parentCol.options
      .map(normalizeCascaderOption)
      .filter(opt => opt && opt.label !== '')
  }
  if (parentCol.type === 'cascader' && parentCol.cascaderOptions) {
    const list = []
    const seen = new Set()
    Object.values(parentCol.cascaderOptions).forEach((items) => {
      if (!Array.isArray(items)) return
      items.forEach((item) => {
        const normalized = normalizeCascaderOption(item)
        if (!normalized) return
        if (normalized.label === '') return
        const key = String(normalized.value)
        if (seen.has(key)) return
        seen.add(key)
        list.push(normalized)
      })
    })
    return list
  }
  return []
})

const cascaderInputMap = reactive({})

const syncCascaderMap = () => {
  const keys = cascaderParentOptions.value.map(opt => String(opt.value))
  Object.keys(currentCol.cascaderMap).forEach((key) => {
    if (!keys.includes(key)) delete currentCol.cascaderMap[key]
  })
  keys.forEach((key) => {
    if (!Array.isArray(currentCol.cascaderMap[key])) {
      currentCol.cascaderMap[key] = []
    }
    if (!(key in cascaderInputMap)) cascaderInputMap[key] = ''
  })
  Object.keys(cascaderInputMap).forEach((key) => {
    if (!keys.includes(key)) delete cascaderInputMap[key]
  })
}

watch([() => currentCol.dependsOn, cascaderParentOptions], () => {
  syncCascaderMap()
})

const insertVariable = (label) => {
  currentCol.expression += `{${label}}`
}

const openAiFormula = () => {
  ElMessage.info('AI 公式能力暂未接入')
}

const addSelectOption = () => {
  currentCol.options.push({ label: '' })
}

const removeSelectOption = (index) => {
  currentCol.options.splice(index, 1)
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  currentCol.label = col.label
  currentCol.prop = col.prop
  currentCol.expression = col.expression || ''
  currentCol.options = Array.isArray(col.options)
    ? col.options.map(opt => ({ label: opt.label ?? opt.value ?? '' }))
    : []
  currentCol.dependsOn = col.dependsOn || ''
  currentCol.cascaderMap = normalizeCascaderMap(col.cascaderOptions)
  Object.keys(cascaderInputMap).forEach((key) => delete cascaderInputMap[key])
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

  syncCascaderMap()
}

const resetForm = () => {
  isEditing.value = false
  editingIndex.value = -1
  currentCol.label = ''
  currentCol.prop = ''
  currentCol.expression = ''
  currentCol.options = []
  currentCol.dependsOn = ''
  currentCol.cascaderMap = {}
  Object.keys(cascaderInputMap).forEach((key) => delete cascaderInputMap[key])
  currentCol.geoAddress = true
  currentCol.fileMaxSizeMb = 20
  currentCol.fileMaxCount = 3
  currentCol.fileAccept = ''
  addTab.value = 'text'
}

const getCascaderChildren = (key) => {
  const list = currentCol.cascaderMap[String(key)] || []
  return Array.isArray(list) ? list : []
}

const addCascaderChild = (key) => {
  const mapKey = String(key)
  const raw = cascaderInputMap[mapKey]
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  if (!text) return
  const list = currentCol.cascaderMap[mapKey] || []
  if (!list.includes(text)) {
    list.push(text)
  }
  currentCol.cascaderMap[mapKey] = list
  cascaderInputMap[mapKey] = ''
}

const removeCascaderChild = (key, child) => {
  const mapKey = String(key)
  const list = currentCol.cascaderMap[mapKey] || []
  currentCol.cascaderMap[mapKey] = list.filter(item => item !== child)
}

const normalizeCascaderMap = (map) => {
  const result = {}
  if (!map || typeof map !== 'object') return result
  Object.entries(map).forEach(([key, list]) => {
    if (!Array.isArray(list)) return
    const normalized = list
      .map(item => {
        if (item === null || item === undefined) return ''
        if (typeof item === 'string' || typeof item === 'number') return String(item)
        const label = item.label ?? item.value ?? ''
        return String(label)
      })
      .filter(Boolean)
    result[String(key)] = normalized
  })
  return result
}

const buildColumnsPayload = () => {
  const toField = (col, isStatic) => ({
    field: col.prop,
    label: col.label,
    type: col.type || 'text',
    options: col.options || [],
    expression: col.expression || '',
    dependsOn: col.dependsOn || '',
    cascaderOptions: col.cascaderOptions || col.cascaderMap || {},
    geoAddress: col.geoAddress,
    fileMaxCount: col.fileMaxCount,
    fileMaxSizeMb: col.fileMaxSizeMb,
    fileAccept: col.fileAccept,
    isStatic
  })
  const statics = staticColumnsAll.value.map(col => toField(col, true))
  const extras = extraColumns.value.map(col => toField(col, false))
  return [...statics, ...extras]
}

const ensureDataTable = async (columnsPayload) => {
  const current = configRef.value.table?.trim()
  const fallback = `data_app_${String(props.appId).replace(/-/g, '').slice(0, 8)}`
  const tableName = current ? current.split('.').pop() : fallback
  const res = await request({
    url: '/rpc/create_data_app_table',
    method: 'post',
    headers: { 'Accept-Profile': 'app_center', 'Content-Profile': 'app_center' },
    data: {
      app_id: props.appId,
      table_name: tableName,
      columns: columnsPayload
    }
  })
  const value = Array.isArray(res) ? res[0] : res
  if (typeof value === 'string' && value) return value
  return `app_data.${tableName}`
}

const saveAppConfig = async (nextConfig) => {
  if (!props.appId) return
  await request({
    url: `/apps?id=eq.${props.appId}`,
    method: 'patch',
    headers: { 'Content-Type': 'application/json' },
    data: {
      config: nextConfig,
      updated_at: new Date().toISOString()
    }
  })
}

const saveColumnsConfig = async () => {
  const columnsPayload = buildColumnsPayload()
  const tableFullName = await ensureDataTable(columnsPayload)
  const nextConfig = {
    ...configRef.value,
    table: tableFullName,
    columns: columnsPayload,
    staticHidden: staticHidden.value
  }
  await saveAppConfig(nextConfig)
  configRef.value = nextConfig
}

const saveColumn = async () => {
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
    const toText = (val) => (val === null || val === undefined) ? '' : String(val)
    const cleanOptions = currentCol.options
      .map(opt => {
        const text = toText(opt.label).trim()
        return { label: text, value: text }
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
    const parentCol = cascaderParentColumns.value.find(col => col.prop === currentCol.dependsOn)
    if (!parentCol) {
      ElMessage.warning('上一级必须是下拉或联动列')
      return
    }
    colConfig.dependsOn = currentCol.dependsOn
    const cascaderOptions = {}
    cascaderParentOptions.value.forEach((opt) => {
      const valueKey = String(opt.value)
      const labelKey = String(opt.label)
      const list = currentCol.cascaderMap[valueKey] || currentCol.cascaderMap[labelKey] || []
      const normalizedList = list.map(item => ({ label: item, value: item }))
      cascaderOptions[valueKey] = normalizedList
      if (labelKey !== valueKey && !(labelKey in cascaderOptions)) {
        cascaderOptions[labelKey] = normalizedList
      }
    })
    const hasAny = Object.values(cascaderOptions).some(list => Array.isArray(list) && list.length > 0)
    if (!hasAny) {
      ElMessage.warning('请至少给一个上一级配置下级选项')
      return
    }
    colConfig.cascaderOptions = cascaderOptions
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
  
  await saveColumnsConfig()
  resetForm()
}

const removeColumn = async (index) => {
  extraColumns.value.splice(index, 1)
  await saveColumnsConfig()
  if (isEditing.value && editingIndex.value === index) {
    resetForm()
  }
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const isStaticVisible = (prop) => !staticHidden.value.includes(prop)
const toggleStaticColumn = async (prop, visible) => {
  const has = staticHidden.value.includes(prop)
  if (visible && has) {
    staticHidden.value = staticHidden.value.filter(item => item !== prop)
  }
  if (!visible && !has) {
    staticHidden.value = [...staticHidden.value, prop]
  }
  await saveColumnsConfig()
}

const handleCreate = async () => {
  if (!apiUrl.value) return
  try {
    await request({
      url: apiUrl.value,
      method: 'post',
      headers: { 'Accept-Profile': schemaName.value, 'Content-Profile': schemaName.value },
      data: { properties: {} }
    })
    if (gridRef.value) await gridRef.value.loadData()
    ElMessage.success('已创建新行')
  } catch (e) {
    ElMessage.error('创建失败')
  }
}

const goApps = () => {
  router.push('/')
}

onMounted(() => {
  loadConfigFromApp()
})
</script>

<style scoped>
.app-container {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.grid-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

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
.formula-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.formula-tip {
  font-size: 12px;
  color: #909399;
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
.cascader-map {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.cascader-node {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
}
.cascader-parent-row {
  display: inline-block;
  margin-bottom: 6px;
}
.cascader-parent {
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  padding: 6px 8px;
  border-radius: 4px;
  text-align: center;
  border: 1px solid #e4e7ed;
}
.cascader-children {
  padding-left: 12px;
  border-left: 2px dashed #e4e7ed;
}
.cascader-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.cascader-add {
  display: flex;
  gap: 8px;
  align-items: center;
}
.cascader-add :deep(.el-input) { flex: 1; }
.variable-tags { margin-top: 8px; }
.tag-tip { font-size: 12px; color: #909399; display: block; margin-bottom: 4px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.cursor-pointer { cursor: pointer; user-select: none; }
.cursor-pointer:hover { opacity: 0.8; transform: translateY(-1px); transition: transform 0.1s; }

.hint-text { font-size: 12px; color: #909399; margin-top: 8px; line-height: 1.4; }
</style>
