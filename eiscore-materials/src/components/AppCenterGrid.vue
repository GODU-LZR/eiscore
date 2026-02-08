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
        :profile="schemaName"
        :accept-profile="schemaName"
        :content-profile="schemaName"
        :include-properties="true"
        write-mode="upsert"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig"
        :can-create="canCreate"
        :can-edit="canEdit"
        :can-delete="canDelete"
        :can-export="canExport"
        :can-config="canConfig"
        :enable-actions="enableActions"
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
                    placeholder="写计算方法（比如：{单价}*{数量}）"
                  />
                </div>

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label || !currentCol.expression">
                  {{ isEditing ? '保存修改' : '添加计算列' }}
                </el-button>
                <p class="hint-text">计算列会自动算，不能手工改。</p>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, computed, watch, defineExpose } from 'vue'
import { useRouter } from 'vue-router'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import { hasPerm } from '@/utils/permission'
import { getRealtimeClient } from '@/utils/realtime'

const props = defineProps({
  appData: { type: Object, default: null },
  appId: { type: String, default: '' },
  createMode: { type: String, default: 'row' }
})

const emit = defineEmits(['create'])

const router = useRouter()
const gridRef = ref(null)
const colConfigVisible = ref(false)
const addTab = ref('text')
const isHydrating = ref(true)

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
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(normalizeColumn)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(normalizeColumn)
    } catch {
      return []
    }
  }
  return []
}

const normalizeColumn = (col) => {
  if (!col) return { prop: '', label: '', type: 'text' }
  if (typeof col === 'string') return { prop: col, label: col, type: 'text', isStatic: true }
  const field = col.field || col.prop || ''
  return {
    prop: field,
    label: col.label || field || '',
    type: col.type || 'text',
    editable: col.editable !== false,
    options: col.options || [],
    expression: col.expression || '',
    dependsOn: col.dependsOn || '',
    cascaderOptions: col.cascaderOptions || col.cascaderMap || {},
    geoAddress: col.geoAddress,
    fileMaxCount: col.fileMaxCount,
    fileMaxSizeMb: col.fileMaxSizeMb,
    fileAccept: col.fileAccept,
    isStatic: col.isStatic !== false
  }
}

const loadConfigFromApp = () => {
  const cfg = normalizeConfig(props.appData?.config)
  configRef.value = {
    ...configRef.value,
    ...cfg
  }
  staticHidden.value = Array.isArray(cfg.staticHidden) ? cfg.staticHidden : []
  const columns = normalizeColumns(cfg.columns)
  staticColumnsAll.value = columns.filter(col => col.isStatic !== false)
  extraColumns.value = columns.filter(col => col.isStatic === false)
}

watch(() => props.appData, () => {
  loadConfigFromApp()
}, { immediate: true })

watch(() => configRef.value.columns, (cols) => {
  const columns = normalizeColumns(cols)
  if (columns.length === 0) return
  staticColumnsAll.value = columns.filter(col => col.isStatic !== false)
  extraColumns.value = columns.filter(col => col.isStatic === false)
}, { immediate: true, deep: true })

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
        if (!normalized || seen.has(normalized.value)) return
        seen.add(normalized.value)
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
  const configKey = configRef.value?.configKey || 'app_center_cols'
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0 && Array.isArray(res[0].value)) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = cloneColumns(configRef.value.defaultExtraColumns || [])
      if (extraColumns.value.length > 0) {
        await saveColumnsConfig()
      }
    }
  } catch (e) { console.error(e) }
}

const loadStaticColumnsConfig = async () => {
  const configKey = `${configRef.value?.configKey || 'app_center_cols'}_static_hidden`
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const hidden = Array.isArray(res) && res.length ? res[0].value : []
    const props = new Set(staticColumnsAll.value.map(col => col.prop).filter(Boolean))
    const nextHidden = Array.isArray(hidden)
      ? hidden.filter(prop => props.has(prop))
      : []
    if (staticColumnsAll.value.length > 0 && nextHidden.length >= staticColumnsAll.value.length) {
      staticHidden.value = []
      await saveStaticColumnsConfig()
      return
    }
    staticHidden.value = nextHidden
  } catch (e) {
    staticHidden.value = []
  }
}

const saveStaticColumnsConfig = async () => {
  const configKey = `${configRef.value?.configKey || 'app_center_cols'}_static_hidden`
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: staticHidden.value }
  })
}

const scheduleGridReload = () => {
  if (realtimeTimer) return
  realtimeTimer = setTimeout(() => {
    realtimeTimer = null
    if (gridRef.value?.loadData) {
      gridRef.value.loadData()
    }
  }, 600)
}

const parseRealtimePayload = (event) => {
  if (!event) return null
  if (event.payload && typeof event.payload === 'string') {
    try {
      return JSON.parse(event.payload)
    } catch (e) {
      return null
    }
  }
  return event.payload && typeof event.payload === 'object' ? event.payload : null
}

const handleRealtimeEvent = (event) => {
  const payload = parseRealtimePayload(event)
  if (!payload) return
  if (payload.schema === 'app_data') {
    scheduleGridReload()
  }
}

const addSelectOption = () => {
  if (!Array.isArray(currentCol.options)) currentCol.options = []
  currentCol.options.push({ label: '', value: '' })
}

const removeSelectOption = (idx) => {
  currentCol.options.splice(idx, 1)
}

const addCascaderChild = (parent) => {
  if (!currentCol.cascaderMap[parent]) currentCol.cascaderMap[parent] = []
  const text = cascaderInputMap[parent]
  if (!text || !text.trim()) return
  if (!currentCol.cascaderMap[parent].includes(text)) {
    currentCol.cascaderMap[parent].push(text)
  }
  cascaderInputMap[parent] = ''
}

const removeCascaderChild = (parent, child) => {
  const list = currentCol.cascaderMap[parent]
  if (!list) return
  const idx = list.indexOf(child)
  if (idx >= 0) list.splice(idx, 1)
}

const resetForm = () => {
  isEditing.value = false
  editingIndex.value = -1
  currentCol.label = ''
  currentCol.expression = ''
  currentCol.options = []
  currentCol.dependsOn = ''
  currentCol.cascaderMap = {}
  currentCol.geoAddress = true
  currentCol.fileMaxSizeMb = 20
  currentCol.fileMaxCount = 3
  currentCol.fileAccept = ''
}

const buildPropName = (label) => {
  if (!label) return ''
  return String(label).trim().replace(/[\s\-.]/g, '_')
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const saveColumn = () => {
  if (!currentCol.label) return
  const prop = buildPropName(currentCol.label)
  if (!prop) return
  const column = {
    label: currentCol.label,
    prop,
    type: currentCol.type || addTab.value,
    options: currentCol.options || [],
    expression: currentCol.expression,
    dependsOn: currentCol.dependsOn || '',
    cascaderOptions: currentCol.cascaderMap || {},
    geoAddress: currentCol.geoAddress,
    fileMaxCount: currentCol.fileMaxCount,
    fileMaxSizeMb: currentCol.fileMaxSizeMb,
    fileAccept: currentCol.fileAccept,
    isStatic: false
  }

  if (addTab.value === 'formula' && !column.expression) {
    ElMessage.warning('请填写计算公式')
    return
  }

  if (isEditing.value && editingIndex.value >= 0) {
    extraColumns.value.splice(editingIndex.value, 1, column)
  } else {
    extraColumns.value.push(column)
  }

  resetForm()
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  if (!col) return
  isEditing.value = true
  editingIndex.value = index
  currentCol.label = col.label
  currentCol.expression = col.expression || ''
  currentCol.options = Array.isArray(col.options) ? JSON.parse(JSON.stringify(col.options)) : []
  currentCol.dependsOn = col.dependsOn || ''
  currentCol.cascaderMap = col.cascaderOptions || {}
  currentCol.geoAddress = col.geoAddress !== false
  currentCol.fileMaxCount = col.fileMaxCount || 3
  currentCol.fileMaxSizeMb = col.fileMaxSizeMb || 20
  currentCol.fileAccept = col.fileAccept || ''
}

const removeColumn = (index) => {
  extraColumns.value.splice(index, 1)
}

const toggleStaticColumn = (prop, visible) => {
  if (visible) {
    staticHidden.value = staticHidden.value.filter(p => p !== prop)
  } else {
    staticHidden.value = [...staticHidden.value, prop]
  }
}

const isStaticVisible = (prop) => {
  return !staticHidden.value.includes(prop)
}

const saveColumnsConfig = async () => {
  const configKey = configRef.value?.configKey || 'app_center_cols'
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: extraColumns.value }
  })
}

const saveConfig = async (silent = false) => {
  if (configRef.value?.skipColumnConfig === true) {
    if (!silent) {
      ElMessage.success('列配置已保存')
    }
    colConfigVisible.value = false
    return
  }
  await saveColumnsConfig()
  await saveStaticColumnsConfig()
  if (!silent) {
    ElMessage.success('列配置已保存')
  }
  colConfigVisible.value = false
}

const buildSummaryConfig = () => {
  return configRef.value.summary || { label: '合计', rules: {}, expressions: {} }
}

const handleCreate = () => {
  if (props.createMode === 'dialog') {
    emit('create')
    return
  }
  if (gridRef.value?.appendRow) {
    gridRef.value.appendRow({})
  }
}

const goApps = () => {
  router.push('/apps')
}

const loadColumnsFromConfig = () => {
  loadConfigFromApp()
  if (configRef.value?.skipColumnConfig === true) {
    staticHidden.value = Array.isArray(configRef.value.staticHidden) ? configRef.value.staticHidden : []
    return
  }
  loadColumnsConfig()
  loadStaticColumnsConfig()
}

watch([staticColumnsAll, extraColumns], () => {
  if (configRef.value?.table && !isHydrating.value) {
    saveConfig(true)
  }
})

const opPerms = computed(() => configRef.value.ops || props.appData?.ops || {})
const enableRealtime = computed(() => configRef.value.enableRealtime === true)
const canCreate = computed(() => hasPerm(opPerms.value.create))
const canEdit = computed(() => hasPerm(opPerms.value.edit))
const canDelete = computed(() => hasPerm(opPerms.value.delete))
const canExport = computed(() => hasPerm(opPerms.value.export))
const canConfig = computed(() => hasPerm(opPerms.value.config))
const enableActions = computed(() => configRef.value.hideActions !== true && configRef.value.enableActions !== false)
let realtimeUnsub = null
let realtimeTimer = null

const initRealtime = () => {
  if (!enableRealtime.value) return
  const client = getRealtimeClient()
  if (!client) return
  if (realtimeUnsub) realtimeUnsub()
  realtimeUnsub = client.subscribe({ schema: schemaName.value, table: configRef.value.table?.split('.').pop() }, handleRealtimeEvent)
}

const syncAiContext = (rows = []) => {
  const columns = [...staticColumns.value, ...extraColumns.value].map(col => ({
    label: col.label,
    prop: col.prop,
    type: col.type || 'text',
    options: col.options || [],
    dependsOn: col.dependsOn || '',
    cascaderOptions: col.cascaderOptions || null,
    expression: col.expression || '',
    storeInProperties: col.storeInProperties === true
  }))
  pushAiContext({
    app: 'app_center',
    view: app.value?.viewId || props.appId || 'data_app',
    viewId: app.value.viewId,
    apiUrl: apiUrl.value,
    profile: schemaName.value,
    columns,
    dataStats: {
      totalCount: rows.length,
      sampleSize: Math.min(rows.length, 40)
    },
    dataSample: rows.slice(0, 40),
    dataScope: '当前列表数据',
    aiScene: 'grid_chat',
    allowImport: true,
    importTarget: {
      apiUrl: apiUrl.value,
      profile: schemaName.value,
      viewId: app.value.viewId
    }
  })
}

const onGridDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  syncAiContext(rows)
}

const createTableIfNotExists = async () => {
  const table = configRef.value.table
  if (!table) return
  const tableName = table.includes('.') ? table.split('.')[1] : table
  if (tableName.startsWith('data_app_')) return
  if (!props.appId) return

  const fallback = `data_app_${String(props.appId).replace(/-/g, '').slice(0, 8)}`

  try {
    await request({
      url: '/rpc/create_data_app_table',
      method: 'post',
      data: { app_id: props.appId, table_name: fallback, columns: extraColumns.value }
    })
  } catch (e) {
    console.warn('create data app table failed', e)
  }
}

watch([extraColumns, staticHidden], () => {
  if (props.appId) {
    createTableIfNotExists()
  }
})

watch([extraColumns], () => {
  if (props.appId) {
    saveConfig()
  }
})

watch(() => configRef.value.table, () => {
  initRealtime()
})

watch(() => apiUrl.value, () => {
  if (gridRef.value?.loadData) gridRef.value.loadData()
})

watch(() => configRef.value.table, () => {
  if (gridRef.value?.loadData) gridRef.value.loadData()
})

onMounted(() => {
  loadColumnsFromConfig()
  initRealtime()
  setTimeout(() => {
    isHydrating.value = false
  }, 0)
})

onUnmounted(() => {
  if (realtimeUnsub) realtimeUnsub()
})

defineExpose({
  reload: () => gridRef.value?.loadData?.()
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fb;
  padding: 16px;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-text h2 {
  margin: 0;
  font-size: 18px;
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
  border-radius: 10px;
}

.column-manager {
  max-height: 520px;
  overflow: auto;
  padding-right: 6px;
}

.section-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.col-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.col-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}

.col-label {
  font-size: 13px;
  font-weight: 500;
}

.col-actions {
  display: flex;
  gap: 8px;
}

.form-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.form-col {
  display: flex;
  flex-direction: column;
}

.hint-text {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.options-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.add-opt-btn {
  margin-top: 6px;
}

.formula-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.formula-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.formula-tip {
  font-size: 12px;
  color: #909399;
}

.cascader-map {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cascader-node {
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  padding: 8px;
}

.cascader-parent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cascader-parent {
  font-weight: 600;
  color: #606266;
}

.cascader-children {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cascader-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cascader-add {
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>
