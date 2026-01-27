<template>
  <div class="app-container">
    <el-card
      shadow="never"
      class="grid-card"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }"
    >
      <eis-data-grid
        ref="gridRef"
        :view-id="app.viewId"
        :api-url="app.apiUrl || '/raw_materials'"
        :write-url="app.writeUrl || ''"
        :include-properties="app.includeProperties !== false"
        :write-mode="app.writeMode || 'upsert'"
        :field-defaults="app.fieldDefaults || {}"
        :patch-required-fields="app.patchRequiredFields || []"
        :default-order="app.defaultOrder || 'id.desc'"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig"
        @create="handleCreate"
        @config-columns="openColumnConfig"
        @view-document="handleViewDocument"
        @view-label="handleViewLabel"
        @data-loaded="handleDataLoaded"
      />

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
                <el-input v-model="currentCol.label" placeholder="列名（比如：产地）" @keyup.enter="saveColumn" />
                <el-button type="primary" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加' }}
                </el-button>
              </div>
              <p class="hint-text">用于存放普通文字、数字或日期，直接填就行。</p>
            </el-tab-pane>

            <el-tab-pane label="下拉选项" name="select">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：等级）" style="margin-bottom: 10px;" />
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
                <el-input v-model="currentCol.label" placeholder="列名（比如：规格）" style="margin-bottom: 10px;" />

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
                <el-input v-model="currentCol.label" placeholder="列名（比如：质检报告）" style="margin-bottom: 10px;" />
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
                <el-input v-model="currentCol.label" placeholder="列名（比如：折算重量）" style="margin-bottom: 10px;" />

                <div class="formula-area">
                  <div class="formula-actions">
                    <el-button size="small" type="primary" plain @click="openAiFormula">AI生成公式</el-button>
                    <span class="formula-tip">把需求告诉工作助手，自动生成复杂公式</span>
                  </div>
                  <el-input 
                    v-model="currentCol.expression" 
                    type="textarea" 
                    :rows="3"
                    placeholder="写计算方法（比如：{单价}*{数量}）"
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
import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import { findMaterialApp, BASE_STATIC_COLUMNS } from '@/utils/material-apps'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  appKey: { type: String, default: 'a' },
  appConfig: { type: Object, default: null },
  category: { type: String, default: '' }
})

const router = useRouter()
const gridRef = ref(null)
const lastLoadedRows = ref([])
const lastSearchText = ref('')
const colConfigVisible = ref(false)
const addTab = ref('text') 

const userStore = useUserStore()
const currentUser = computed(() => userStore.userInfo?.username || 'Admin')

const app = computed(() => props.appConfig || findMaterialApp(props.appKey) || {
  key: 'a',
  name: '物料台账',
  desc: '原料与批次基础信息管理',
  route: '/app/a',
  viewId: 'materials_list',
  configKey: 'materials_table_cols',
  apiUrl: '/raw_materials',
  enableDetail: true,
  staticColumns: BASE_STATIC_COLUMNS,
  summaryConfig: { label: '总计', rules: {}, expressions: {} },
  defaultExtraColumns: []
})

const staticColumns = computed(() => app.value.staticColumns || BASE_STATIC_COLUMNS)
const summaryConfig = computed(() => app.value.summaryConfig || { label: '总计', rules: {}, expressions: {} })

const extraColumns = ref([])

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

const allAvailableColumns = computed(() => {
  const all = [...staticColumns.value, ...extraColumns.value]
  if (isEditing.value) {
    return all.filter((c, i) => i !== (staticColumns.value.length + editingIndex.value))
  }
  return all
})

function isSelectColumnConfig(col) {
  if (!col) return false
  if (Array.isArray(col.options) && col.options.length > 0) return true
  return false
}

function isCascaderColumnConfig(col) {
  if (!col) return false
  if (col.type !== 'cascader') return false
  if (col.cascaderOptions && Object.keys(col.cascaderOptions).length > 0) return true
  return false
}

function normalizeCascaderOption(opt) {
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

const cascaderParentColumns = computed(() => {
  return allAvailableColumns.value.filter(col => isSelectColumnConfig(col) || isCascaderColumnConfig(col) || col.type === 'cascader')
})

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


const cloneColumns = (cols) => JSON.parse(JSON.stringify(cols || []))

const loadColumnsConfig = async () => {
  const configKey = app.value.configKey || 'materials_table_cols'
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0 && Array.isArray(res[0].value)) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = cloneColumns(app.value.defaultExtraColumns || [])
      if (extraColumns.value.length > 0) {
        await saveColumnsConfig()
      }
    }
    syncAiContext()
  } catch (e) { console.error(e) }
}

const handleDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  lastLoadedRows.value = rows
  lastSearchText.value = payload?.searchText || ''
  syncAiContext(rows, { searchText: lastSearchText.value })
}

const buildDataStats = (rows) => {
  const stats = { totalCount: 0, sampleSize: 0, categoryCounts: {}, creatorCounts: {} }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  stats.sampleSize = rows.length
  rows.forEach((row) => {
    const category = row?.category || row?.properties?.category || '未分类'
    stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1
    const creator = row?.created_by || row?.properties?.created_by
    if (creator) {
      stats.creatorCounts[creator] = (stats.creatorCounts[creator] || 0) + 1
    }
  })
  return stats
}

const buildDataSample = (rows, columns, limit = 50) => {
  if (!Array.isArray(rows)) return []
  const sample = rows.slice(0, limit)
  return sample.map((row) => {
    const item = {}
    columns.forEach((col) => {
      const prop = col.prop
      if (!prop) return
      if (col.type === 'file' || col.type === 'geo') return
      const value = row?.[prop] ?? row?.properties?.[prop]
      if (value !== undefined && value !== null && value !== '') {
        item[prop] = value
      }
    })
    if (row?.id !== undefined) item.id = row.id
    return item
  })
}

const syncAiContext = (rows = lastLoadedRows.value, overrides = {}) => {
  const columns = [...staticColumns.value, ...extraColumns.value].map(col => ({
    label: col.label,
    prop: col.prop,
    type: col.type || 'text',
    options: col.options || [],
    dependsOn: col.dependsOn || '',
    cascaderOptions: col.cascaderOptions || null,
    expression: col.expression || ''
  }))
  const dataStats = buildDataStats(rows)
  const dataSample = buildDataSample(rows, columns, 40)
  const fileColumns = columns.filter(col => col.type === 'file')
  pushAiContext({
    app: 'materials',
    view: app.value.key,
    viewId: app.value.viewId,
    apiUrl: app.value.apiUrl || '/raw_materials',
    profile: 'public',
    columns,
    staticColumns: staticColumns.value,
    extraColumns: extraColumns.value,
    summaryConfig: summaryConfig.value,
    fileColumns,
    dataStats,
    dataSample,
    dataScope: (overrides.searchText ?? lastSearchText.value) ? '当前搜索结果' : '当前列表数据',
    searchText: overrides.searchText ?? lastSearchText.value ?? '',
    aiScene: overrides.aiScene || 'grid_chat',
    allowFormula: !!overrides.allowFormula,
    allowFormulaOnce: !!overrides.allowFormulaOnce,
    allowImport: overrides.allowImport !== undefined ? overrides.allowImport : true,
    importTarget: {
      apiUrl: app.value.apiUrl || '/raw_materials',
      profile: 'public',
      viewId: app.value.viewId
    }
  })
}

const saveColumnsConfig = async () => {
  const configKey = app.value.configKey || 'materials_table_cols'
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: extraColumns.value }
  })
}

const insertVariable = (label) => {
  currentCol.expression += `{${label}}`
}

const buildFormulaPrompt = () => {
  const label = currentCol.label || '计算列'
  const variables = allAvailableColumns.value.map(col => col.label).join('、')
  return [
    '请帮我生成表格“自动计算”公式。',
    `目标列：${label}`,
    '要求：只输出公式，不要解释。',
    '必须放在 ```formula``` 代码块中，内容示例：{单价}*{数量}。',
    `可用字段：${variables || '无'}。`
  ].join('\n')
}

const openAiFormula = () => {
  syncAiContext(lastLoadedRows.value, { aiScene: 'column_formula', allowFormulaOnce: true })
  pushAiCommand({
    id: `formula_${Date.now()}`,
    type: 'open-worker',
    prompt: buildFormulaPrompt()
  })
}

const addSelectOption = () => {
  currentCol.options.push({ label: '' })
}

const removeSelectOption = (index) => {
  currentCol.options.splice(index, 1)
}

const handleViewDocument = (row) => {
  if (!app.value.enableDetail) {
    ElMessage.info('该应用暂不支持表单详情')
    return
  }
  if (!row?.id) return
  router.push({
    name: 'MaterialDetail',
    params: { id: row.id },
    query: { appKey: app.value.key }
  })
}

const handleViewLabel = (row) => {
  if (!row?.id) return
  router.push({
    name: 'MaterialLabelPreview',
    params: { id: row.id },
    query: { appKey: app.value.key }
  })
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  currentCol.label = col.label
  currentCol.prop = col.prop
  currentCol.expression = col.expression || ''
  currentCol.options = Array.isArray(col.options)
    ? col.options.map(opt => ({
        label: opt.label ?? opt.value ?? ''
      }))
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
  if (!colConfigVisible.value) {
    syncAiContext(lastLoadedRows.value, { aiScene: 'grid_chat', allowFormula: false })
  }
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
    const toText = (val) => (val === null || val === undefined) ? '' : String(val)
    const cleanOptions = currentCol.options
      .map(opt => {
        const text = toText(opt.label).trim()
        return {
          label: text,
          value: text
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
  
  saveColumnsConfig()
  syncAiContext()
  resetForm()
}

const removeColumn = (index) => {
  extraColumns.value.splice(index, 1)
  saveColumnsConfig()
  syncAiContext()
  if (isEditing.value && editingIndex.value === index) {
    resetForm()
  }
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const buildBatchNo = () => `MAT${Date.now().toString().slice(-6)}`

const handleCreate = async () => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const payload = { 
      batch_no: buildBatchNo(),
      name: '新物料',
      category: props.category || '未分类',
      weight_kg: null,
      entry_date: today,
      created_by: currentUser.value
    }
    if (app.value.includeProperties !== false) {
      payload.properties = {}
    }
    const writeUrl = app.value.writeUrl || (app.value.apiUrl || '/raw_materials').split('?')[0]
    await request({
      url: writeUrl,
      method: 'post',
      headers: { 'Content-Profile': 'public' },
      data: payload
    })
    if (gridRef.value) await gridRef.value.loadData()
    ElMessage.success('已创建新行')
  } catch(e) {
    console.error(e)
    ElMessage.error('创建失败')
  }
}

onMounted(() => {
  loadColumnsConfig()
})

const handleApplyFormula = (event) => {
  const formula = event?.detail?.formula
  if (!formula) return
  if (!colConfigVisible.value || addTab.value !== 'formula') return
  currentCol.expression = formula
}

const handleImportDone = (event) => {
  const viewId = event?.detail?.viewId
  if (viewId && viewId !== app.value.viewId) return
  if (gridRef.value && typeof gridRef.value.loadData === 'function') {
    gridRef.value.loadData()
  }
}

onMounted(() => {
  window.addEventListener('eis-ai-apply-formula', handleApplyFormula)
  window.addEventListener('eis-grid-imported', handleImportDone)
})

onUnmounted(() => {
  window.removeEventListener('eis-ai-apply-formula', handleApplyFormula)
  window.removeEventListener('eis-grid-imported', handleImportDone)
})
</script>

<style scoped>
.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
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
