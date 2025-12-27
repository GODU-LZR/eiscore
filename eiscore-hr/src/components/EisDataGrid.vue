<template>
  <div class="eis-grid-wrapper">
    <div class="grid-toolbar">
      <div class="left-tools">
        <el-input 
          v-model="searchText" 
          placeholder="搜索全表..." 
          style="width: 240px" 
          clearable
          @input="onSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        
        <el-button-group class="ml-2">
          <el-button type="danger" plain icon="Delete" @click="deleteSelectedRows" :disabled="selectedRowsCount === 0">
            删除选中行 ({{ selectedRowsCount }})
          </el-button>
          <el-button plain icon="Download" @click="exportData">
            导出表格
          </el-button>
        </el-button-group>

        <div class="tip-text" v-if="rangeSelection.active">
          已选中: {{ realRangeRowCount }} 行 x {{ realRangeColCount }} 列
        </div>
      </div>
      
      <div class="toolbar-actions">
        <slot name="toolbar"></slot>
      </div>
    </div>

    <div class="grid-container" @mouseleave="onGridMouseLeave">
      <ag-grid-vue
        ref="agGridRef"
        style="width: 100%; height: 100%;"
        class="ag-theme-alpine no-user-select"
        :columnDefs="gridColumns"
        :rowData="gridData"
        :pinnedBottomRowData="pinnedBottomRowData"
        :defaultColDef="defaultColDef"
        :localeText="AG_GRID_LOCALE_CN"
        :theme="'legacy'" 
        :rowSelection="rowSelectionConfig"
        :animateRows="true"
        :getRowId="getRowId"
        
        :context="context" 
        :components="gridComponents"
        
        :undoRedoCellEditing="true"
        :undoRedoCellEditingLimit="50"
        :enableCellChangeFlash="true"
        :suppressClipboardPaste="true" 
        :enterNavigatesVertically="true" 
        :enterNavigatesVerticallyAfterEdit="true"
        :suppressRowHoverHighlight="true"
        :enableRangeSelection="false"
        :preventDefaultOnContextMenu="true" 
        
        @grid-ready="onGridReady"
        @cell-value-changed="onCellValueChanged"
        @cell-key-down="onCellKeyDown"
        @selection-changed="onSelectionChanged"
        
        @cell-mouse-down="onCellMouseDown"
        @cell-mouse-over="onCellMouseOver"
        @cell-double-clicked="onCellDoubleClicked"
      >
      </ag-grid-vue>

      <el-dialog
        v-model="configDialog.visible"
        :title="configDialog.title"
        width="360px"
        align-center
        destroy-on-close
        append-to-body
      >
        <div class="config-dialog-content">
          <template v-if="configDialog.type === 'data'">
            <p class="dialog-tip">请选择该列的统计方式：</p>
            <el-radio-group v-model="configDialog.tempValue" class="agg-radio-group">
              <el-radio 
                v-for="opt in aggOptions" 
                :key="opt.value" 
                :value="opt.value" 
                border
              >
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
          </template>

          <template v-else-if="configDialog.type === 'label'">
            <p class="dialog-tip">自定义底部合计行的名称：</p>
            <el-input 
              v-model="configDialog.tempValue" 
              placeholder="例如：本月总计" 
              clearable 
              @keyup.enter="saveConfig"
            />
          </template>
        </div>
        
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="configDialog.visible = false">取消</el-button>
            <el-button type="primary" :loading="isSavingConfig" @click="saveConfig">
              保存配置
            </el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, reactive, onMounted, onUnmounted, defineComponent, h, markRaw, nextTick } from 'vue'
import { AgGridVue } from "ag-grid-vue3"
import request from '@/utils/request'
import { ElMessage, ElMessageBox, ElTooltip, ElIcon, ElDialog, ElRadioGroup, ElRadio, ElInput, ElButton } from 'element-plus'
import { Lock, Unlock, Search, Delete, Download, Filter, SortUp, SortDown, Sort, CirclePlus, CircleCheck, Check, Edit } from '@element-plus/icons-vue'
import { buildSearchQuery } from '@/utils/grid-query'
import { debounce } from 'lodash'
import { useUserStore } from '@/stores/user' 

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
ModuleRegistry.registerModules([ AllCommunityModule ]);

import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"

// --- 🟢 自定义组件定义区 ---

// 1. 状态显示渲染器
const StatusRenderer = defineComponent({
  props: ['params'],
  setup(props) {
    const statusMap = {
      'created': { label: '创建', icon: CirclePlus, color: '#409EFF' },
      'active': { label: '生效', icon: CircleCheck, color: '#67C23A' },
      'locked': { label: '锁定', icon: Lock, color: '#F56C6C' },
      'total': { icon: null, color: 'var(--el-color-primary)', fontWeight: 'bold' }
    }
    
    const currStatus = computed(() => {
      if (props.params.node.rowPinned === 'bottom') return 'total'
      const data = props.params.data
      if (data?.properties?.row_locked_by) return 'locked'
      return data?.properties?.status || 'created'
    })
    
    const info = computed(() => {
      const base = statusMap[currStatus.value] || statusMap['created']
      if (currStatus.value === 'total') {
        return { ...base, label: props.params.value }
      }
      return base
    })

    return () => h('div', { 
      style: { 
        display: 'flex', alignItems: 'center', gap: '6px', height: '100%', 
        color: info.value.color, 
        fontWeight: info.value.fontWeight || '500', 
        fontSize: '13px',
        width: '100%', paddingLeft: '4px',
        pointerEvents: 'none'
      } 
    }, [
      info.value.icon ? h(ElIcon, { size: 14 }, { default: () => h(info.value.icon) }) : null,
      h('span', info.value.label)
    ])
  }
})

// 2. 状态编辑器
const StatusEditor = defineComponent({
  props: ['params'],
  setup(props, { expose }) {
    const selectedValue = ref(props.params.value)
    const cellWidth = props.params.column.getActualWidth() + 'px'

    const options = [
      { value: 'created', label: '创建', color: '#409EFF', icon: CirclePlus },
      { value: 'active', label: '生效', color: '#67C23A', icon: CircleCheck },
      { value: 'locked', label: '锁定', color: '#F56C6C', icon: Lock }
    ]

    const onSelect = (val) => {
      selectedValue.value = val
      props.params.stopEditing() 
    }

    const getValue = () => selectedValue.value
    expose({ getValue })

    return () => h('div', { 
      class: 'status-editor-popup',
      style: { width: cellWidth } 
    }, [
      options.map(opt => 
        h('div', {
          class: ['status-editor-item', { 'is-selected': opt.value === selectedValue.value }],
          onClick: () => onSelect(opt.value)
        }, [
          h(ElIcon, { color: opt.color, size: 16 }, { default: () => h(opt.icon) }),
          h('span', { class: 'status-label' }, opt.label),
          opt.value === selectedValue.value ? h('div', { class: 'status-check-mark' }) : null
        ])
      )
    ])
  }
})

// 3. 自定义表头组件
const LockHeader = defineComponent({
  props: ['params'],
  setup(props) {
    const colId = props.params.column.colId
    const gridComp = props.params.context.componentParent
    const lockInfo = computed(() => gridComp.columnLockState[colId])
    const isLocked = computed(() => !!lockInfo.value)
    
    const showMenu = computed(() => {
      return props.params.enableMenu || props.params.column.isFilterAllowed()
    })

    const sortState = ref(null) 
    const onSortChanged = () => {
      if (props.params.column.isSortAscending()) sortState.value = 'asc'
      else if (props.params.column.isSortDescending()) sortState.value = 'desc'
      else sortState.value = null
    }
    
    props.params.column.addEventListener('sortChanged', onSortChanged)
    onSortChanged()

    const onLabelClick = (e) => props.params.progressSort(e.shiftKey)
    const onMenuClick = (e) => { e.stopPropagation(); props.params.showColumnMenu(e.target) }
    const onLockClick = (e) => { e.stopPropagation(); gridComp.toggleColumnLock(colId) }

    return () => h('div', { class: 'custom-header-wrapper' }, [
      h('div', { class: 'custom-header-main', onClick: onLabelClick }, [
        h('span', { class: 'custom-header-label' }, props.params.displayName),
        sortState.value === 'asc' ? h(ElIcon, { size: 12, color: '#409EFF', style: 'margin-left:4px' }, { default: () => h(SortUp) }) : null,
        sortState.value === 'desc' ? h(ElIcon, { size: 12, color: '#409EFF', style: 'margin-left:4px' }, { default: () => h(SortDown) }) : null,
      ]),
      h('div', { class: 'custom-header-tools' }, [
        h('span', { class: 'custom-header-icon lock-btn', onClick: onLockClick }, [
          isLocked.value
            ? h(ElTooltip, { content: `列锁定: ${lockInfo.value}`, placement: 'top' }, { default: () => h(ElIcon, { color: '#F56C6C', size: 14 }, { default: () => h(Lock) }) })
            : h(ElIcon, { class: 'header-unlock-icon', size: 14, color: '#909399' }, { default: () => h(Unlock) })
        ]),
        showMenu.value
          ? h('span', { class: 'custom-header-icon menu-btn', onClick: onMenuClick }, [
              h(ElIcon, { size: 14, color: '#909399' }, { default: () => h(Filter) })
            ])
          : null
      ])
    ])
  }
})

// --- 🟢 主逻辑区 ---

const AG_GRID_LOCALE_CN = {
  loadingOoo: '数据加载中...', noRowsToShow: '暂无数据', to: '至', of: '共', page: '页',
  next: '下一页', last: '尾页', first: '首页', previous: '上一页',
  filterOoo: '筛选...', applyFilter: '应用', clearFilter: '清除', resetFilter: '重置', cancelFilter: '取消',
  equals: '等于', notEqual: '不等于', contains: '包含', notContains: '不包含',
  startsWith: '开始于', endsWith: '结束于', blank: '为空', notBlank: '不为空',
  lessThan: '小于', greaterThan: '大于', lessThanOrEqual: '小于等于', greaterThanOrEqual: '大于等于',
  inRange: '在范围内', inRangeStart: '从', inRangeEnd: '到',
  andCondition: '并且', orCondition: '或者',
  pinColumn: '冻结列', pinLeft: '冻结到左侧', pinRight: '冻结到右侧', noPin: '取消冻结',
  autosizeThiscolumn: '自动调整列宽', autosizeAllColumns: '自动调整所有列宽', resetColumns: '重置列设置',
  copy: '复制 (Ctrl+C)', paste: '粘贴 (Ctrl+V)', ctrlC: 'Ctrl+C', ctrlV: 'Ctrl+V',
  export: '导出', csvExport: '导出 CSV'
}

const props = defineProps({
  apiUrl: { type: String, required: true },
  viewId: { type: String, required: false, default: null },
  staticColumns: { type: Array, default: () => [] },
  extraColumns: { type: Array, default: () => [] },
  summary: { type: Object, default: () => ({ label: '合计', rules: {} }) }
})

const userStore = useUserStore()
const currentUser = computed(() => userStore.userInfo?.username || 'Admin')
const isAdmin = computed(() => currentUser.value === 'Admin') 

const gridApi = ref(null)
const gridData = shallowRef([])
const pinnedBottomRowData = ref([])

const activeSummaryConfig = reactive({
  label: '合计',
  rules: {},
  ...props.summary
})

// 弹窗状态管理
const configDialog = reactive({
  visible: false,
  title: '',
  type: null, 
  colId: null,
  tempValue: '' 
})
const isSavingConfig = ref(false)

const aggOptions = [
  { label: '求和 (Sum)', value: 'sum' },
  { label: '计数 (Count)', value: 'count' },
  { label: '平均 (Avg)', value: 'avg' },
  { label: '最大 (Max)', value: 'max' },
  { label: '最小 (Min)', value: 'min' },
  { label: '不显示', value: '' }
]

watch(() => props.summary, (newVal) => {
  Object.assign(activeSummaryConfig, newVal)
}, { deep: true })

const searchText = ref('')
const isLoading = ref(false)
const selectedRowsCount = ref(0)
const pendingChanges = [] 
const isRemoteUpdating = ref(false) 

const columnLockState = reactive({})

const isDragging = ref(false)
const rangeSelection = reactive({
  startRowIndex: -1, startColId: null, endRowIndex: -1, endColId: null, active: false
})

const rowSelectionConfig = { mode: 'multiRow', headerCheckbox: false, checkboxes: false, enableClickSelection: true }

const isCellReadOnly = (params) => {
  const colId = params.colDef.field
  if (colId === '_status') return false 
  if (params.node.rowPinned) return true
  const rowData = params.data
  if (columnLockState[colId]) return true
  if (rowData?.properties?.row_locked_by) return true
  return false
}

const defaultColDef = { 
  sortable: true, filter: true, resizable: true, minWidth: 100, 
  editable: (params) => !isCellReadOnly(params)
}

const getRowId = (params) => String(params.data.id)

const getColIndex = (colId) => {
  if (!gridApi.value) return -1
  const allCols = gridApi.value.getAllGridColumns()
  return allCols.findIndex(c => c.getColId() === colId)
}

const isCellInSelection = (params) => {
  if (!rangeSelection.active) return false
  const rowIndex = params.node.rowIndex
  const colId = params.column.colId
  const startColIdx = getColIndex(rangeSelection.startColId)
  const endColIdx = getColIndex(rangeSelection.endColId)
  const currentColIdx = getColIndex(colId)
  if (startColIdx === -1 || endColIdx === -1 || currentColIdx === -1) return false
  
  const minRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
  const maxRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)
  return rowIndex >= minRow && rowIndex <= maxRow && currentColIdx >= minCol && currentColIdx <= maxCol
}

const cellClassRules = { 
  'custom-range-selected': (params) => isCellInSelection(params),
  'cell-locked-pattern': (params) => isCellReadOnly(params),
  'status-cell': (params) => params.colDef.field === '_status'
}

const getCellStyle = (params) => {
  const baseStyle = { 'line-height': '34px' }
  if (params.node.rowPinned) {
    return { 
      ...baseStyle, 
      backgroundColor: 'var(--el-color-primary-light-9)', 
      color: 'var(--el-color-primary)', 
      fontWeight: 'bold',
      borderTop: '2px solid var(--el-color-primary-light-5)' 
    }
  }
  if (params.colDef.field === '_status') {
    return { ...baseStyle, cursor: 'pointer' }
  }
  if (params.colDef.editable === false) return { ...baseStyle, backgroundColor: '#f5f7fa', color: '#909399' }
  return baseStyle
}

const rowClassRules = { 'row-locked-bg': (params) => !!params.data?.properties?.row_locked_by }

const handleToggleColumnLock = (colId) => {
  if (columnLockState[colId]) {
    delete columnLockState[colId]
    ElMessage.success('列已解锁')
  } else {
    columnLockState[colId] = currentUser.value
    ElMessage.success('列已锁定')
  }
  gridApi.value.redrawRows()
}

const context = reactive({
  componentParent: {
    toggleColumnLock: handleToggleColumnLock,
    columnLockState 
  }
})

const gridComponents = {
  StatusRenderer: markRaw(StatusRenderer),
  StatusEditor: markRaw(StatusEditor),
  LockHeader: markRaw(LockHeader)
}

const gridColumns = computed(() => {
  const checkboxCol = {
    colId: 'rowCheckbox',
    headerCheckboxSelection: true,
    checkboxSelection: true,
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    pinned: 'left',
    resizable: false,
    sortable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellStyle: { padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  }

  const statusCol = {
    headerName: '状态',
    field: '_status',
    width: 100,
    minWidth: 100,
    pinned: 'left',
    filter: true,
    sortable: false,
    resizable: false,
    suppressHeaderMenuButton: false,
    editable: (params) => !params.node.rowPinned,
    cellRenderer: 'StatusRenderer',
    cellEditor: 'StatusEditor',
    cellEditorPopup: true,
    cellEditorPopupPosition: 'under',
    valueGetter: (params) => {
      if (params.node.rowPinned) return activeSummaryConfig.label
      if (params.data.properties?.row_locked_by) return 'locked'
      return params.data.properties?.status || 'created'
    },
    valueSetter: (params) => {
      if (params.node.rowPinned) return false
      const newVal = params.newValue
      const oldVal = params.oldValue
      if (newVal === oldVal) return false
      if (!params.data.properties) params.data.properties = {}
      params.data.properties.status = newVal
      if (newVal === 'locked') {
        params.data.properties.row_locked_by = currentUser.value
      } else {
        params.data.properties.row_locked_by = null
      }
      return true 
    }
  }

  const staticCols = props.staticColumns.map(col => ({
    headerName: col.label, field: col.prop, 
    editable: col.editable !== false ? (params) => !isCellReadOnly(params) : false,
    cellEditor: 'agTextCellEditor', width: col.width, flex: col.width ? 0 : 1,
    cellStyle: getCellStyle, 
    cellClassRules: cellClassRules,
    headerComponent: 'LockHeader'
  }))
  
  const dynamicCols = props.extraColumns.map(col => ({
    headerName: col.label, field: `properties.${col.prop}`, 
    editable: (params) => !isCellReadOnly(params),
    headerClass: 'dynamic-header', 
    cellStyle: getCellStyle, 
    cellClassRules: cellClassRules,
    headerComponent: 'LockHeader'
  }))
  
  return [checkboxCol, statusCol, ...staticCols, ...dynamicCols]
})

const mouseX = ref(0)
const mouseY = ref(0)
let autoScrollRaf = null

const onGlobalMouseMove = (e) => {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

const autoScroll = () => {
  if (!isDragging.value || !gridApi.value) return

  const viewport = document.querySelector('.ag-body-viewport')
  const hViewport = document.querySelector('.ag-body-horizontal-scroll-viewport')
  if (!viewport) return

  const rect = viewport.getBoundingClientRect()
  const buffer = 50 
  const speed = 15  

  let scrollX = 0
  let scrollY = 0

  if (mouseY.value < rect.top + buffer) scrollY = -speed
  else if (mouseY.value > rect.bottom - buffer) scrollY = speed

  if (mouseX.value < rect.left + buffer) scrollX = -speed
  else if (mouseX.value > rect.right - buffer) scrollX = speed

  if (scrollY !== 0) viewport.scrollTop += scrollY
  
  if (scrollX !== 0) {
    if (hViewport) hViewport.scrollLeft += scrollX 
    else viewport.scrollLeft += scrollX
  }

  if (scrollX !== 0 || scrollY !== 0) {
    const target = document.elementFromPoint(mouseX.value, mouseY.value)
    if (target) {
      const cell = target.closest('.ag-cell')
      if (cell) {
        const rowId = cell.getAttribute('row-id')
        const colId = cell.getAttribute('col-id')
        
        if (rowId && colId) {
          const rowNode = gridApi.value.getRowNode(rowId)
          if (rowNode) {
            if (rangeSelection.endRowIndex !== rowNode.rowIndex || rangeSelection.endColId !== colId) {
              rangeSelection.endRowIndex = rowNode.rowIndex
              rangeSelection.endColId = colId
              gridApi.value.refreshCells({ force: false })
            }
          }
        }
      }
    }
  }

  autoScrollRaf = requestAnimationFrame(autoScroll)
}

const onCellMouseDown = (params) => {
  if (params.event.button === 2) return 

  if (params.colDef.field === '_status') {
    const editingCells = gridApi.value.getEditingCells()
    const isEditingThisCell = editingCells.some(cell => 
      cell.rowIndex === params.node.rowIndex && 
      cell.column.getColId() === params.column.getColId()
    )
    if (isEditingThisCell) {
      gridApi.value.stopEditing()
      return 
    }
  }

  isDragging.value = true
  autoScroll()
  
  rangeSelection.startRowIndex = params.node.rowIndex
  rangeSelection.startColId = params.column.colId
  rangeSelection.endRowIndex = params.node.rowIndex
  rangeSelection.endColId = params.column.colId
  rangeSelection.active = true
  gridApi.value.refreshCells({ force: false })
}

const onCellMouseOver = (params) => {
  if (!isDragging.value) return
  
  if (rangeSelection.endRowIndex !== params.node.rowIndex || rangeSelection.endColId !== params.column.colId) {
    rangeSelection.endRowIndex = params.node.rowIndex
    rangeSelection.endColId = params.column.colId
    gridApi.value.refreshCells({ force: false }) 
    gridApi.value.ensureIndexVisible(params.node.rowIndex)
    gridApi.value.ensureColumnVisible(params.column)
  }
}

const onGridMouseLeave = () => { }

const onCellContextMenu = (params) => {
  params.event.preventDefault() 
}

const onCellDoubleClicked = (params) => {
  if (params.node.rowPinned !== 'bottom') return

  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以配置合计规则')
    return
  }

  const colId = params.column.colId
  const colName = params.colDef.headerName

  if (colId === '_status' || colId === 'rowCheckbox') {
    configDialog.type = 'label'
    configDialog.title = '重命名合计'
    configDialog.tempValue = activeSummaryConfig.label
    configDialog.visible = true
  } 
  else {
    configDialog.type = 'data'
    configDialog.title = `列统计方式: ${colName}`
    const field = params.colDef.field.replace('properties.', '')
    configDialog.colId = field
    configDialog.tempValue = activeSummaryConfig.rules[field] || ''
    configDialog.visible = true
  }
}

// 🟢 核心修复：添加 Accept-Profile: public 标头
// 确保 API 明确在 public schema 中查找表，避免因环境问题误入其他 schema 导致 404
const loadGridConfig = async () => {
  if (!props.viewId) return
  try {
    const res = await request({
      url: `/sys_grid_configs?view_id=eq.${props.viewId}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' } 
    })
    if (res && res.length > 0) {
      const remoteConfig = res[0].summary_config
      if (remoteConfig) {
        Object.assign(activeSummaryConfig, remoteConfig)
        pinnedBottomRowData.value = calculateTotals(gridData.value)
      }
    }
  } catch(e) {
    // 忽略 404 (说明还没配置过)
    if (e.response && e.response.status !== 404) {
      console.warn('Failed to load grid config', e)
    }
  }
}

const saveConfig = async () => {
  if (configDialog.type === 'label') {
    if (configDialog.tempValue) {
      activeSummaryConfig.label = configDialog.tempValue
    }
  } else {
    if (configDialog.tempValue === '') {
      delete activeSummaryConfig.rules[configDialog.colId]
    } else {
      activeSummaryConfig.rules[configDialog.colId] = configDialog.tempValue
    }
    pinnedBottomRowData.value = calculateTotals(gridData.value)
  }
  
  gridApi.value.refreshCells({ rowNodes: [gridApi.value.getPinnedBottomRow(0)], force: true })
  configDialog.visible = false

  if (props.viewId) {
    isSavingConfig.value = true
    try {
      await request({
        // 使用 UPSERT 语法
        url: '/sys_grid_configs?on_conflict=view_id', 
        method: 'post',
        headers: { 
          'Prefer': 'resolution=merge-duplicates',
          'Content-Profile': 'public' 
        }, 
        data: {
          view_id: props.viewId,
          summary_config: activeSummaryConfig,
          updated_by: currentUser.value
        }
      })
      ElMessage.success('配置已保存')
    } catch(e) {
      console.error(e)
      ElMessage.error('配置保存失败')
    } finally {
      isSavingConfig.value = false
    }
  }
}

watch(isLoading, (val) => {
  if (!gridApi.value) return
  gridApi.value.setGridOption('loading', val)
})

const calculateTotals = (data) => {
  if (!data || data.length === 0) return []
  
  const totalRow = {
    id: 'bottom_total',
    _status: activeSummaryConfig.label, 
    properties: {}
  }

  const columns = [...props.staticColumns, ...props.extraColumns]
  
  columns.forEach(col => {
    const isProp = !props.staticColumns.find(c => c.prop === col.prop)
    const values = data.map(row => {
      const v = isProp ? row.properties?.[col.prop] : row[col.prop]
      return (v === null || v === undefined || v === '') ? null : v
    }).filter(v => v !== null)

    let rule = activeSummaryConfig.rules[col.prop]
    
    if (!rule) {
      const isAllNumbers = values.length > 0 && values.every(v => !isNaN(Number(v)))
      if (isAllNumbers) rule = 'sum'
    }

    let result = ''
    if (values.length > 0 && rule) {
      const numbers = values.map(Number)
      const validNumbers = numbers.filter(n => !isNaN(n))
      
      switch (rule) {
        case 'sum': result = validNumbers.reduce((a, b) => a + b, 0); break
        case 'avg': if (validNumbers.length) result = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length; break
        case 'count': result = values.length; break
        case 'max': if (validNumbers.length) result = Math.max(...validNumbers); break
        case 'min': if (validNumbers.length) result = Math.min(...validNumbers); break
      }
    }

    if (typeof result === 'number') {
      result = Number(result.toFixed(2))
    }

    if (isProp) totalRow.properties[col.prop] = result
    else totalRow[col.prop] = result
  })

  return [totalRow]
}

watch(gridData, (newData) => {
  pinnedBottomRowData.value = calculateTotals(newData)
}, { immediate: true })

onMounted(() => { 
  document.addEventListener('mouseup', onGlobalMouseUp)
  document.addEventListener('mousemove', onGlobalMouseMove) 
  document.addEventListener('paste', handleGlobalPaste)
})

const onGridReady = (params) => { 
  gridApi.value = params.api; 
  loadData();
  loadGridConfig();
}

onUnmounted(() => { 
  if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf)
  document.removeEventListener('mouseup', onGlobalMouseUp)
  document.removeEventListener('mousemove', onGlobalMouseMove)
  document.removeEventListener('paste', handleGlobalPaste)
})

const onGlobalMouseUp = () => { 
  if (isDragging.value) {
    isDragging.value = false 
    if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf) 
  }
}

const realRangeRowCount = computed(() => {
  if (!rangeSelection.active) return 0
  return Math.abs(rangeSelection.endRowIndex - rangeSelection.startRowIndex) + 1
})
const realRangeColCount = computed(() => {
  if (!rangeSelection.active) return 0
  const startIdx = getColIndex(rangeSelection.startColId)
  const endIdx = getColIndex(rangeSelection.endColId)
  if (startIdx === -1 || endIdx === -1) return 0
  return Math.abs(endIdx - startIdx) + 1
})

const loadData = async () => {
  isLoading.value = true 
  try {
    let url = `${props.apiUrl}?order=id.desc`
    if (searchText.value) {
      url += buildSearchQuery(searchText.value, props.staticColumns, props.extraColumns)
    }
    const res = await request({ url, method: 'get' })
    gridData.value = res
    setTimeout(() => {
      if (gridApi.value) {
        const allColIds = gridApi.value.getColumns().map(col => col.getColId())
        gridApi.value.autoSizeColumns(allColIds, false) 
      }
    }, 100)
  } catch (e) {
    console.error(e)
    ElMessage.error('数据加载失败')
  } finally {
    isLoading.value = false 
  }
}

const buildCompletePayload = (rowData) => {
  const payload = JSON.parse(JSON.stringify(rowData))
  if (!payload.properties) payload.properties = {}
  payload.updated_at = new Date().toISOString()
  return payload
}

const sanitizeValue = (field, value) => {
  const key = field.includes('.') ? field.split('.').pop() : field
  const textFields = ['name', 'code', 'employee_id', 'username', 'email', 'phone', 'id_card', 'address']
  const isEmpty = value === null || value === undefined || value === ''
  if (isEmpty) {
    if (textFields.includes(key)) return "" 
    return null 
  }
  return value
}

const onCellValueChanged = (event) => {
  if (event.node.rowPinned) return 
  if (isRemoteUpdating.value || event.oldValue === event.newValue) return
  const safeValue = sanitizeValue(event.colDef.field, event.newValue)
  
  if (safeValue !== event.newValue) {
    isRemoteUpdating.value = true
    event.node.setDataValue(event.colDef.field, safeValue)
    isRemoteUpdating.value = false
  }

  pinnedBottomRowData.value = calculateTotals(gridData.value)

  pendingChanges.push({
    rowNode: event.node,
    colDef: event.colDef,
    newValue: safeValue,
    oldValue: event.oldValue
  })
  debouncedSave()
}

const debouncedSave = debounce(async () => {
  if (pendingChanges.length === 0) return
  const changesToProcess = [...pendingChanges]
  pendingChanges.length = 0
  isRemoteUpdating.value = true 
  try {
    const rowUpdatesMap = new Map()
    changesToProcess.forEach(({ rowNode, colDef, newValue }) => {
      const id = rowNode.data.id
      if (!rowUpdatesMap.has(id)) {
        const basePayload = buildCompletePayload(rowNode.data)
        rowUpdatesMap.set(id, { rowNode, payload: basePayload, properties: basePayload.properties })
      }
      const group = rowUpdatesMap.get(id)
      
      if (colDef.field === '_status') {
        Object.assign(group.properties, rowNode.data.properties)
      } else if (colDef.field.startsWith('properties.')) {
        const propKey = colDef.field.split('.')[1]
        group.properties[propKey] = newValue
      } else {
        group.payload[colDef.field] = newValue
      }
    })
    const apiPayload = []
    const affectedNodes = []
    for (const group of rowUpdatesMap.values()) {
      group.payload.version = (group.payload.version || 1) + 1
      apiPayload.push(group.payload)
      affectedNodes.push({ node: group.rowNode, newVer: group.payload.version })
    }
    if (apiPayload.length > 0) {
      await request({
        url: `${props.apiUrl}`, 
        method: 'post',
        headers: { 'Content-Profile': 'hr', 'Prefer': 'resolution=merge-duplicates,return=representation' },
        data: apiPayload
      })
      affectedNodes.forEach(({ node, newVer }) => { node.data.version = newVer })
      gridApi.value.refreshCells({ rowNodes: affectedNodes.map(i => i.node), force: false })
      ElMessage.success(`已保存 ${apiPayload.length} 行变更`)
    }
  } catch (e) {
    ElMessage.error('保存失败')
    for (let i = changesToProcess.length - 1; i >= 0; i--) {
      const change = changesToProcess[i]
      change.rowNode.setDataValue(change.colDef.field, change.oldValue)
    }
  } finally {
    setTimeout(() => { isRemoteUpdating.value = false }, 50)
  }
}, 100)

const deleteSelectedRows = async () => {
  const selectedNodes = gridApi.value.getSelectedNodes()
  if (selectedNodes.length === 0) return
  const lockedNodes = selectedNodes.filter(n => n.data.properties?.row_locked_by)
  if (lockedNodes.length > 0) {
    return ElMessage.warning(`选中行中有 ${lockedNodes.length} 行已被锁定，无法删除`)
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedNodes.length} 条数据吗？`, '警告', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    const ids = selectedNodes.map(n => n.data.id)
    await request({ url: `${props.apiUrl}?id=in.(${ids.join(',')})`, method: 'delete' })
    gridApi.value.applyTransaction({ remove: selectedNodes.map(node => node.data) })
    pinnedBottomRowData.value = calculateTotals(gridData.value)
    ElMessage.success('删除成功')
    selectedRowsCount.value = 0
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const handleGlobalPaste = async (event) => {
  if (!gridApi.value) return
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) if (!activeEl.closest('.ag-root-wrapper')) return 
  const focusedCell = gridApi.value.getFocusedCell()
  const hasRange = rangeSelection.active
  if (!focusedCell && !hasRange) return
  const clipboardData = event.clipboardData || window.clipboardData
  if (!clipboardData) return
  const text = clipboardData.getData('text')
  if (!text) return
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let rows = cleanText.split('\n');
  if (rows[rows.length - 1] === '') rows.pop(); 
  const pasteMatrix = rows.map(row => row.split('\t'));
  const pasteRowCount = pasteMatrix.length;
  const pasteColCount = pasteMatrix.length > 0 ? pasteMatrix[0].length : 0;
  if (pasteRowCount === 0) return;
  const isSingleValue = pasteRowCount === 1 && pasteColCount === 1;
  const isMultiCellSelection = realRangeRowCount.value > 1 || realRangeColCount.value > 1;
  let startRowIdx = -1, startColIdx = -1;
  if (rangeSelection.active) {
    startRowIdx = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex);
    const sC = getColIndex(rangeSelection.startColId);
    const eC = getColIndex(rangeSelection.endColId);
    startColIdx = Math.min(sC, eC);
  } else {
    if (focusedCell) {
      startRowIdx = focusedCell.rowIndex;
      startColIdx = getColIndex(focusedCell.column.colId);
    }
  }
  if (startRowIdx === -1 || startColIdx === -1) return;
  const allCols = gridApi.value.getAllGridColumns();
  if (isSingleValue && isMultiCellSelection && rangeSelection.active) {
    const valToPaste = pasteMatrix[0][0].trim();
    const endRowIdx = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex);
    const sC = getColIndex(rangeSelection.startColId);
    const eC = getColIndex(rangeSelection.endColId);
    const endColIdx = Math.max(sC, eC);
    for (let r = startRowIdx; r <= endRowIdx; r++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(r);
      for (let c = startColIdx; c <= endColIdx; c++) {
        const col = allCols[c];
        if (col && col.isCellEditable(rowNode)) {
          rowNode.setDataValue(col.getColDef().field, valToPaste)
        }
      }
    }
  } else {
    for (let i = 0; i < pasteRowCount; i++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(startRowIdx + i);
      if (!rowNode) break; 
      for (let j = 0; j < pasteColCount; j++) {
        const colIndex = startColIdx + j;
        if (colIndex < allCols.length) {
          const col = allCols[colIndex];
          const cellValue = pasteMatrix[i][j];
          if (col && col.isCellEditable(rowNode)) {
            rowNode.setDataValue(col.getColDef().field, cellValue.trim())
          }
        }
      }
    }
  }
}

const onCellKeyDown = async (e) => {
  const event = e.event
  const key = event.key
  if (!gridApi.value) return
  
  if (key === 'Delete' || key === 'Backspace') {
    if (rangeSelection.active) {
      const startIdx = getColIndex(rangeSelection.startColId)
      const endIdx = getColIndex(rangeSelection.endColId)
      const minRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      const maxRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      const minCol = Math.min(startIdx, endIdx)
      const maxCol = Math.max(startIdx, endIdx)
      const allCols = gridApi.value.getAllGridColumns()

      for (let r = minRow; r <= maxRow; r++) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
        if (rowNode) {
          for (let c = minCol; c <= maxCol; c++) {
            const col = allCols[c]
            if (col.isCellEditable(rowNode)) {
              rowNode.setDataValue(col.getColDef().field, null)
            }
          }
        }
      }
    } else {
      const focusedCell = gridApi.value.getFocusedCell()
      if (focusedCell) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(focusedCell.rowIndex)
        const col = gridApi.value.getColumn(focusedCell.column.colId)
        if (col.isCellEditable(rowNode)) {
          rowNode.setDataValue(col.getColDef().field, null)
        }
      }
    }
    return
  }

  if ((event.ctrlKey || event.metaKey) && key === 'c') {
    const focusedCell = gridApi.value.getFocusedCell()
    const isRangeActive = rangeSelection.active
    if (!isRangeActive && !focusedCell) return

    let startRow, endRow, startCol, endCol
    if (isRangeActive) {
      startRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      endRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      const idx1 = getColIndex(rangeSelection.startColId)
      const idx2 = getColIndex(rangeSelection.endColId)
      startCol = Math.min(idx1, idx2)
      endCol = Math.max(idx1, idx2)
    } else {
      startRow = endRow = focusedCell.rowIndex
      startCol = endCol = getColIndex(focusedCell.column.colId)
    }

    const allCols = gridApi.value.getAllGridColumns()
    let clipboardText = ''

    for (let r = startRow; r <= endRow; r++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
      if (!rowNode) continue
      let rowCells = []
      for (let c = startCol; c <= endCol; c++) {
        const col = allCols[c]
        if (!col) continue
        const field = col.getColDef().field
        let val = null
        if (field) val = field.split('.').reduce((obj, key) => obj?.[key], rowNode.data)
        const strVal = (val === null || val === undefined) ? '' : String(val)
        rowCells.push(strVal)
      }
      clipboardText += rowCells.join('\t') + (r === endRow ? '' : '\n')
    }

    const copyToClipboard = async (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text)
        } else {
          const textArea = document.createElement("textarea")
          textArea.value = text
          textArea.style.position = "fixed"; textArea.style.left = "-9999px";
          document.body.appendChild(textArea)
          textArea.focus(); textArea.select();
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        ElMessage.success(`已复制 ${Math.abs(endRow - startRow) + 1} 行`)
      } catch(e) { ElMessage.error('复制失败') }
    }
    
    await copyToClipboard(clipboardText)
    event.preventDefault()
    return
  }
}

const onSelectionChanged = () => {
  const selectedNodes = gridApi.value.getSelectedNodes()
  selectedRowsCount.value = selectedNodes.length
}
const exportData = () => { gridApi.value.exportDataAsCsv({ fileName: '导出数据.csv' }) }
const onSearch = debounce(() => loadData(), 300)
watch(() => props.extraColumns, () => {}, { deep: true })
defineExpose({ loadData })
</script>

<style scoped lang="scss">
.eis-grid-wrapper { height: 100%; display: flex; flex-direction: column; background-color: #fff; border-radius: 4px; }
.grid-toolbar { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--el-border-color-light); background-color: #f8f9fa; }
.left-tools { display: flex; align-items: center; }
.ml-2 { margin-left: 8px; }
.tip-text { margin-left: 12px; font-size: 12px; color: #909399; font-family: monospace; }
.toolbar-actions { display: flex; gap: 12px; }
.grid-container { flex: 1; width: 100%; padding: 0; }

.dialog-tip {
  margin-bottom: 12px;
  color: #606266;
  font-size: 14px;
}
.agg-radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
</style>

<style lang="scss">
/* 🟢 滚动条美化 */
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar,
.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb,
.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
  background-color: var(--el-color-primary-light-5);
  border-radius: 8px;
  border: 3px solid transparent; 
  background-clip: content-box;
}
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb:hover,
.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover {
  background-color: var(--el-color-primary);
}
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-track,
.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
  background-color: #f5f7fa;
  box-shadow: inset 0 0 4px rgba(0,0,0,0.05);
}
/* 强制显示滚动条 */
.ag-theme-alpine .ag-body-viewport {
  overflow-y: scroll !important;
}

.ag-theme-alpine { --ag-font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; --ag-font-size: 13px; --ag-foreground-color: #303133; --ag-background-color: #fff; --ag-header-background-color: #f1f3f4; --ag-header-foreground-color: #606266; --ag-header-height: 32px; --ag-row-height: 35px; --ag-borders: solid 1px; --ag-border-color: #dcdfe6; --ag-row-border-color: #e4e7ed; --ag-row-hover-color: #f5f7fa; --ag-selected-row-background-color: rgba(64, 158, 255, 0.1); --ag-input-focus-border-color: var(--el-color-primary); --ag-range-selection-border-color: var(--el-color-primary); --ag-range-selection-border-style: solid; }
.no-user-select { user-select: none; }
.ag-theme-alpine .dynamic-header { font-weight: 600; }
.ag-theme-alpine .ag-cell { border-right: 1px solid var(--ag-border-color); }
.ag-root-wrapper { border: 1px solid var(--el-border-color-light) !important; }
.custom-range-selected { background-color: rgba(0, 120, 215, 0.15) !important; border: 1px solid rgba(0, 120, 215, 0.6) !important; z-index: 1; }

.cell-locked-pattern {
  background-image: repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 10px, #ffffff 10px, #ffffff 20px);
  color: #a8abb2;
  cursor: not-allowed;
}
.row-locked-bg {
  background-color: #fafafa !important; 
}

.custom-header-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  justify-content: space-between;
}
.custom-header-main {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
  cursor: pointer;
  padding-right: 8px;
}
.custom-header-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.custom-header-tools {
  display: flex;
  align-items: center;
  gap: 2px;
}
.custom-header-icon {
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.custom-header-icon:hover {
  background-color: #e6e8eb;
}
.header-unlock-icon, .menu-btn {
  opacity: 0;
  transition: opacity 0.2s;
}
.custom-header-wrapper:hover .header-unlock-icon,
.custom-header-wrapper:hover .menu-btn {
  opacity: 1;
}

.status-editor-popup {
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e4e7ed;
  overflow: hidden;
  padding: 4px 0;
}
.status-editor-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 13px;
  color: #606266;
  position: relative;
}
.status-editor-item:hover {
  background-color: #f5f7fa;
}
.status-editor-item.is-selected {
  background-color: #ecf5ff;
  color: #409EFF;
  font-weight: 500;
}
.status-label {
  margin-left: 8px;
  flex: 1;
}
.status-check-mark {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #409EFF;
}
</style>