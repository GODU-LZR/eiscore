<template>
  <div class="inventory-stock">
    <div class="page-header">
      <div class="header-text">
        <h2>出库</h2>
        <p>选择批次号并登记出库流水</p>
      </div>
      <div class="header-actions">
        <el-button plain @click="goBatchRules">批次号规则</el-button>
        <el-button type="primary" @click="openDrawer">出库登记</el-button>
      </div>
    </div>

    <!-- 物料库存信息栏 -->
    <div class="stock-info-bar" v-if="stockInfoList.length > 0">
      <div class="stock-info-header">
        <el-icon><Goods /></el-icon>
        <span class="stock-info-title">{{ currentMaterialName }} - 库存分布</span>
        <el-button size="small" text type="info" @click="clearStockInfo">清除</el-button>
      </div>
      <div class="stock-info-items">
        <div class="stock-info-item" v-for="s in stockInfoList" :key="s.warehouse_id + s.batch_no">
          <span class="stock-wh">{{ s.warehouse_path }}</span>
          <el-tag size="small" type="success">{{ s.batch_no }}</el-tag>
          <span class="stock-qty">可用: <strong>{{ s.available_qty }}</strong> {{ s.unit }}</span>
        </div>
      </div>
    </div>

    <EisDataGrid
      ref="gridRef"
      class="stock-grid"
      :view-id="gridConfig.viewId"
      :api-url="gridConfig.apiUrl"
      :write-url="gridConfig.writeUrl"
      :include-properties="false"
      write-mode="patch"
      :default-order="gridConfig.defaultOrder"
      :acl-module="gridConfig.aclModule"
      :profile="gridConfig.schema"
      :accept-profile="gridConfig.schema"
      :content-profile="gridConfig.schema"
      :static-columns="gridConfig.staticColumns"
      :extra-columns="[]"
      :summary="gridConfig.summaryConfig"
      :show-status-col="false"
      :can-create="canCreate"
      :can-edit="canEdit"
      :can-delete="false"
      :can-export="canExport"
      :can-config="canConfig"
      @create="openDrawer"
      @cell-value-changed="handleCellValueChanged"
      @selection-changed="handleSelection"
      @data-loaded="handleDataLoaded"
    />

    <el-drawer v-model="drawer.visible" title="出库登记" size="520px" direction="rtl">
      <div class="selection-tip" v-if="selectedRow">
        <span>已选中表格行：</span>
        <span class="tip-strong">{{ selectedRow.material_name || selectedRow.material_code || '物料' }}</span>
        <el-button size="small" plain @click="applySelectedRow">带入信息</el-button>
      </div>

      <!-- 抽屉内库存分布提示（固定在抽屉顶部，不夹在表单中间） -->
      <div class="drawer-stock-hint" v-if="drawerStockHints.length > 0">
        <div class="drawer-stock-hint-title">该物料库存分布：</div>
        <div class="drawer-stock-hint-item" v-for="h in drawerStockHints" :key="h.warehouse_id + h.batch_no">
          <span>{{ h.warehouse_path }}</span>
          <el-tag size="small" type="success">{{ h.batch_no }}</el-tag>
          <span>可用 <strong>{{ h.available_qty }}</strong> {{ h.unit }}</span>
        </div>
      </div>

      <el-form :model="drawer.form" label-width="110px" ref="formRef">
        <el-form-item label="物料">
          <el-select v-model="drawer.form.material_id" filterable placeholder="可按物料过滤" style="width: 100%;" @change="onDrawerFilterChange">
            <el-option
              v-for="m in materials"
              :key="m.id"
              :label="`${m.batch_no} - ${m.name}`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="仓库">
          <el-cascader
            v-model="drawer.form.warehouse_id"
            :options="drawerWarehouseOptions"
            :props="{ value: 'id', label: 'name', children: 'children', emitPath: false }"
            placeholder="可按仓库过滤"
            clearable
            style="width: 100%;"
            @change="onDrawerFilterChange"
          />
        </el-form-item>

        <el-form-item label="批次号" required>
          <el-select v-model="drawer.form.batch_id" filterable placeholder="请选择批次号" style="width: 100%;" @change="handleBatchPick">
            <el-option
              v-for="b in filteredBatches"
              :key="b.id"
              :label="buildBatchLabel(b)"
              :value="b.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="无需选择批次号">
          <el-switch v-model="drawer.form.allowNoBatch" />
          <span class="hint-text">开启后自动选择批次号出库</span>
        </el-form-item>

        <el-form-item label="自动策略" v-if="drawer.form.allowNoBatch">
          <el-radio-group v-model="drawer.form.autoStrategy">
            <el-radio-button label="fifo">FIFO</el-radio-button>
            <el-radio-button label="max">最大可用</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="可用数量">
          <el-input :model-value="drawer.form.available_qty != null ? drawer.form.available_qty : '-'" readonly />
        </el-form-item>

        <el-form-item label="数量" required>
          <el-input-number v-model="drawer.form.quantity" :min="0.01" :max="drawer.form.available_qty || 999999" :precision="2" style="width: 200px;" />
          <el-select v-model="drawer.form.unit" style="width: 120px; margin-left: 10px;">
            <el-option v-for="u in unitOptions" :key="u" :label="u" :value="u" />
          </el-select>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="drawer.form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawer.visible = false">取消</el-button>
          <el-button type="primary" @click="submitStockOut" :loading="drawer.loading">确认出库</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Goods } from '@element-plus/icons-vue'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { hasPerm } from '@/utils/permission'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const gridRef = ref(null)
const formRef = ref(null)
const selectedRow = ref(null)
const materials = ref([])
const warehouseOptions = ref([])
const warehouseFlat = ref([])
const warehouseIndex = ref({})
const batchOptions = ref([])
const loadedRows = ref([])

const userStore = useUserStore()
const operatorName = computed(() => userStore.userInfo?.username || 'Admin')

const unitOptions = ['个', '件', '箱', '吨', '千克', '克', '斤', '米']
const unitSelectOptions = unitOptions.map(item => ({ label: item, value: item }))
const materialSelectOptions = []
const warehouseSlotOptions = []
const batchSelectOptions = []

/* ── 物料库存信息栏 ── */
const focusedMaterialId = ref(null)
const currentMaterialName = computed(() => {
  if (!focusedMaterialId.value) return ''
  const m = materials.value.find(item => item.id === focusedMaterialId.value)
  return m ? `${m.batch_no} - ${m.name}` : ''
})

const stockInfoList = computed(() => {
  if (!focusedMaterialId.value) return []
  return batchOptions.value
    .filter(b => b.material_id === focusedMaterialId.value && Number(b.available_qty || 0) > 0)
    .map(b => ({
      warehouse_id: b.warehouse_id,
      warehouse_path: b.warehouse_path || resolveWarehouseFullPath(b.warehouse_id) || b.warehouse_name || '',
      batch_no: b.batch_no,
      available_qty: b.available_qty,
      unit: b.unit || ''
    }))
})

/** 抽屉内根据物料过滤出有库存的仓库 */
const drawerWarehouseOptions = computed(() => {
  const mid = drawer.form.material_id
  if (!mid) return warehouseOptions.value
  const warehouseIdsWithStock = new Set()
  batchOptions.value
    .filter(b => b.material_id === mid && Number(b.available_qty || 0) > 0)
    .forEach(b => {
      let wid = b.warehouse_id
      let guard = 0
      while (wid && guard < 10) {
        warehouseIdsWithStock.add(wid)
        const node = warehouseIndex.value[wid]
        wid = node?.parent_id || null
        guard++
      }
    })
  if (warehouseIdsWithStock.size === 0) return warehouseOptions.value
  const filterTree = (nodes) => {
    return nodes
      .filter(n => warehouseIdsWithStock.has(n.id))
      .map(n => ({
        ...n,
        children: n.children ? filterTree(n.children) : []
      }))
  }
  return filterTree(warehouseOptions.value)
})

const clearStockInfo = () => { focusedMaterialId.value = null }

/* ── 状态与编辑权限（三状态：created / active / void） ── */
const getRowStatus = (row) => String(row?.status || 'created')
const isEditableRow = (params) => getRowStatus(params?.data) === 'created'
const canEditField = (params, field) => {
  const status = getRowStatus(params?.data)
  if (status === 'created') return true
  if (status === 'active') return field === 'remark'
  return false
}

const parseNonNegative = (value) => {
  const num = Number(value)
  if (Number.isNaN(num) || num < 0) return null
  return Number(num.toFixed(4))
}

const getErrorMessage = (error, fallback) => {
  const msg = error?.response?.data?.message || error?.response?.data?.details || error?.message
  return msg || fallback
}

/* ── 仓库名称解析 ── */
const buildWarehouseIndex = (list) => {
  const map = {}
  list.forEach(item => { map[item.id] = item })
  warehouseIndex.value = map
}

const resolveWarehouseNameByLevel = (warehouseId, targetLevel) => {
  if (!warehouseId) return ''
  let node = warehouseIndex.value[warehouseId]
  let guard = 0
  while (node && node.level > targetLevel && guard < 10) {
    node = warehouseIndex.value[node.parent_id]
    guard += 1
  }
  if (!node || node.level !== targetLevel) return ''
  return node.name || node.code || ''
}

const resolveWarehouseFullPath = (warehouseId) => {
  if (!warehouseId) return ''
  const node = warehouseIndex.value[warehouseId]
  if (!node) return ''
  const parts = []
  let cur = node
  let guard = 0
  while (cur && guard < 10) {
    parts.unshift(cur.name || cur.code || '')
    cur = cur.parent_id ? warehouseIndex.value[cur.parent_id] : null
    guard++
  }
  return parts.filter(Boolean).join(' / ')
}

/* ── 批次标签构建 ── */
const buildBatchLabel = (batch) => {
  if (!batch) return ''
  const no = batch.batch_no || ''
  const matName = batch.material_name || ''
  const whName = batch.warehouse_path || batch.warehouse_name || ''
  const qty = batch.available_qty != null ? `(${batch.available_qty})` : ''
  return [no, matName, whName, qty].filter(Boolean).join(' | ')
}

/* ── Grid 配置 ── */
const gridConfig = {
  viewId: 'inventory_stock_out',
  apiUrl: '/v_inventory_drafts?draft_type=eq.out',
  writeUrl: '/inventory_drafts',
  schema: 'scm',
  includeProperties: false,
  patchRequiredFields: ['draft_type', 'status', 'material_id', 'warehouse_id', 'quantity', 'unit', 'batch_id'],
  fieldDefaults: { draft_type: 'out', status: 'created' },
  defaultOrder: 'created_at.desc',
  aclModule: 'mms_inventory',
  summaryConfig: { label: '总计', rules: {}, expressions: {} },
  staticColumns: [
    {
      label: '状态',
      prop: 'status',
      width: 100,
      editable: (params) => isEditableRow(params),
      type: 'status',
      allowClear: false,
      valueSetter: (params) => {
        const next = params.newValue
        if (next === params.oldValue) return false
        if (next !== 'active') {
          ElMessage.warning('锁定由系统自动触发')
          return false
        }
        params.data.status = next
        return true
      }
    },
    {
      label: '物料',
      prop: 'material_id',
      width: 200,
      editable: false,
      type: 'select',
      options: materialSelectOptions,
      allowClear: false
    },
    {
      label: '仓库',
      prop: 'warehouse_name',
      width: 120,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 1)
    },
    {
      label: '库区',
      prop: 'warehouse_area',
      width: 120,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 2)
    },
    {
      label: '库位',
      prop: 'warehouse_slot',
      width: 120,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 3)
    },
    {
      label: '批次号',
      prop: 'batch_no',
      width: 160,
      editable: false
    },
    {
      label: '数量',
      prop: 'quantity',
      width: 120,
      editable: (params) => canEditField(params, 'quantity'),
      valueParser: (params) => parseNonNegative(params.newValue),
      valueSetter: (params) => {
        const next = parseNonNegative(params.newValue)
        if (next === null || next <= 0) {
          ElMessage.warning('数量必须为正数')
          return false
        }
        if (params.data?.quantity === next) return false
        params.data.quantity = next
        return true
      }
    },
    {
      label: '单位',
      prop: 'unit',
      width: 80,
      editable: (params) => canEditField(params, 'unit'),
      type: 'select',
      options: unitSelectOptions,
      allowClear: false
    },
    { label: '可用数量', prop: 'available_qty', width: 120, editable: false },
    { label: '备注', prop: 'remark', width: 160, editable: (params) => canEditField(params, 'remark') },
    { label: '操作人', prop: 'operator', width: 120, editable: false },
    { label: '单据号', prop: 'transaction_no', width: 180, editable: false },
    { label: '创建时间', prop: 'created_at', width: 160, editable: false }
  ]
}

/* ── 权限 ── */
const canCreate = computed(() => hasPerm('op:mms_inventory.stock_out'))
const canEdit = computed(() => true)
const canExport = computed(() => hasPerm('op:mms_inventory.export'))
const canConfig = computed(() => hasPerm('op:mms_inventory.config'))

/* ── 抽屉 ── */
const drawer = reactive({
  visible: false,
  loading: false,
  form: {
    material_id: null,
    warehouse_id: null,
    batch_id: null,
    batch_no: '',
    quantity: 1,
    unit: '个',
    available_qty: null,
    remark: '',
    allowNoBatch: false,
    autoStrategy: 'fifo'
  }
})

/** 抽屉内库存提示（选物料后） */
const drawerStockHints = computed(() => {
  const mid = drawer.form.material_id
  if (!mid) return []
  return batchOptions.value
    .filter(b => b.material_id === mid && Number(b.available_qty || 0) > 0)
    .map(b => ({
      warehouse_id: b.warehouse_id,
      warehouse_path: b.warehouse_path || resolveWarehouseFullPath(b.warehouse_id) || '',
      batch_no: b.batch_no,
      available_qty: b.available_qty,
      unit: b.unit || ''
    }))
})

const goBatchRules = () => router.push('/batch-rules')

const openDrawer = () => {
  drawer.visible = true
  drawer.form = {
    material_id: null,
    warehouse_id: null,
    batch_id: null,
    batch_no: '',
    quantity: 1,
    unit: '个',
    available_qty: null,
    remark: '',
    allowNoBatch: false,
    autoStrategy: 'fifo'
  }
}

/* ── 抽屉批次过滤 ── */
const filteredBatches = computed(() => {
  const mid = drawer.form.material_id
  const wid = drawer.form.warehouse_id
  return batchOptions.value.filter(item => {
    if (mid && item.material_id !== mid) return false
    if (wid) {
      if (item.warehouse_id === wid) return true
      const path = resolveWarehouseFullPath(item.warehouse_id)
      const filterName = warehouseIndex.value[wid]?.name
      if (filterName && path.includes(filterName)) return true
      return false
    }
    return true
  })
})

const onDrawerFilterChange = () => {
  if (!drawer.form.batch_id) return
  const still = filteredBatches.value.find(b => b.id === drawer.form.batch_id)
  if (!still) {
    drawer.form.batch_id = null
    drawer.form.batch_no = ''
    drawer.form.available_qty = null
  }
}

/** 抽屉选物料时同步更新顶栏提示 */
watch(() => drawer.form.material_id, (mid) => {
  if (mid) focusedMaterialId.value = mid
})

const handleBatchPick = (batchId) => {
  const batch = batchOptions.value.find(b => b.id === batchId)
  if (!batch) return
  drawer.form.batch_no = batch.batch_no
  drawer.form.material_id = batch.material_id
  drawer.form.warehouse_id = batch.warehouse_id
  drawer.form.available_qty = batch.available_qty
  drawer.form.unit = batch.unit || drawer.form.unit
}

const resolveBatchTime = (batch) => {
  const dateText = batch.production_date || batch.updated_at || batch.created_at
  const time = dateText ? new Date(dateText).getTime() : NaN
  return Number.isFinite(time) ? time : 0
}

const pickAutoBatch = () => {
  const candidates = filteredBatches.value.filter(b => Number(b.available_qty || 0) > 0)
  if (candidates.length === 0) return null
  if (drawer.form.autoStrategy === 'max') {
    return candidates.slice().sort((a, b) => Number(b.available_qty || 0) - Number(a.available_qty || 0))[0]
  }
  return candidates.slice().sort((a, b) => resolveBatchTime(a) - resolveBatchTime(b))[0]
}

/* ── 提交出库草稿 ── */
const submitStockOut = async () => {
  const { material_id, warehouse_id, quantity, unit, remark } = drawer.form

  if (!material_id || !warehouse_id || !quantity) {
    ElMessage.warning('请填写必填项')
    return
  }

  if (!drawer.form.batch_id && drawer.form.allowNoBatch) {
    const autoBatch = pickAutoBatch()
    if (!autoBatch) {
      ElMessage.warning('当前条件下没有可出库批次号')
      return
    }
    drawer.form.batch_id = autoBatch.id
    handleBatchPick(autoBatch.id)
  }

  if (!drawer.form.batch_id || !drawer.form.batch_no) {
    ElMessage.warning('请选择批次号')
    return
  }

  drawer.loading = true
  try {
    await request({
      url: '/inventory_drafts',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', 'Prefer': 'return=representation' },
      data: {
        draft_type: 'out',
        status: 'created',
        material_id: drawer.form.material_id,
        warehouse_id: drawer.form.warehouse_id,
        batch_id: drawer.form.batch_id,
        batch_no: drawer.form.batch_no,
        quantity,
        unit,
        remark,
        operator: operatorName.value
      }
    })

    ElMessage.success('已创建出库草稿')
    drawer.visible = false
    gridRef.value?.loadData?.()
    loadBatches()
  } catch (e) {
    ElMessage.error(getErrorMessage(e, '创建草稿失败'))
  } finally {
    drawer.loading = false
  }
}

/* ── 表格内编辑事件 ── */
const handleCellValueChanged = async (params) => {
  if (!params || !params.colDef?.field) return
  const field = params.colDef.field
  const row = params.data
  if (!row?.id) return

  if (field === 'batch_id' && row.status === 'created') {
    const batch = batchOptions.value.find(b => b.id === row.batch_id)
    if (batch) {
      try {
        await request({
          url: `/inventory_drafts?id=eq.${row.id}`,
          method: 'patch',
          headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
          data: {
            batch_id: batch.id,
            batch_no: batch.batch_no,
            material_id: batch.material_id,
            warehouse_id: batch.warehouse_id,
            unit: batch.unit || row.unit
          }
        })
      } catch (e) {
        ElMessage.error(getErrorMessage(e, '更新批次号失败'))
      } finally {
        gridRef.value?.loadData?.()
      }
    }
    return
  }

  if (field === 'status') {
    if (params.newValue !== 'active' || params.oldValue === 'active') return
    if (!row.material_id || !row.warehouse_id || !row.quantity || !row.unit || !row.batch_no) {
      ElMessage.warning('草稿信息不完整，无法生效')
      await request({
        url: `/inventory_drafts?id=eq.${row.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { status: 'created' }
      })
      gridRef.value?.loadData?.()
      return
    }
    try {
      const res = await request({
        url: '/rpc/stock_out',
        method: 'post',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          p_material_id: row.material_id,
          p_warehouse_id: row.warehouse_id,
          p_quantity: row.quantity,
          p_unit: row.unit,
          p_batch_no: row.batch_no,
          p_remark: row.remark,
          p_operator: operatorName.value
        }
      })

      await request({
        url: `/inventory_drafts?id=eq.${row.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { status: 'active', transaction_no: res?.transaction_no || null, batch_id: res?.batch_id || row.batch_id || null }
      })
      ElMessage.success('出库已生效')
      loadBatches()
    } catch (e) {
      await request({
        url: `/inventory_drafts?id=eq.${row.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { status: 'created' }
      })
      ElMessage.error(getErrorMessage(e, '出库生效失败'))
    } finally {
      gridRef.value?.loadData?.()
    }
    return
  }
}

/* ── 选择行 ── */
const handleSelection = (rows) => {
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  selectedRow.value = row
  if (row?.material_id) {
    focusedMaterialId.value = row.material_id
  }
}

const handleDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  loadedRows.value = rows
  if (rows.length === 0) return
  gridRef.value?.refreshCells?.({ force: true })
}

const applySelectedRow = () => {
  const row = selectedRow.value
  if (!row) return
  drawer.form.material_id = row.material_id || drawer.form.material_id
  drawer.form.warehouse_id = row.warehouse_id || drawer.form.warehouse_id
  drawer.form.unit = row.unit || drawer.form.unit
  if (row.batch_id) {
    drawer.form.batch_id = row.batch_id
    handleBatchPick(row.batch_id)
  } else if (row.batch_no) {
    const match = batchOptions.value.find(b => b.batch_no === row.batch_no && b.material_id === row.material_id)
    if (match) {
      drawer.form.batch_id = match.id
      handleBatchPick(match.id)
    }
  }
}

/* ── 数据加载 ── */
const loadMaterials = async () => {
  try {
    const res = await request({
      url: '/raw_materials?select=id,batch_no,name&order=batch_no.asc',
      headers: { 'Accept-Profile': 'public' }
    })
    materials.value = res || []
    materialSelectOptions.splice(0, materialSelectOptions.length, ...materials.value.map(item => ({
      label: `${item.batch_no || ''} - ${item.name || ''}`.trim(),
      value: item.id
    })))
  } catch (e) {
    console.error('加载物料失败:', e)
  }
}

const loadWarehouses = async () => {
  try {
    const res = await request({
      url: '/warehouses?order=code.asc',
      headers: { 'Accept-Profile': 'scm' }
    })
    const list = Array.isArray(res) ? res : []
    warehouseFlat.value = list
    buildWarehouseIndex(list)
    warehouseOptions.value = buildTree(list)
    const slotList = list.filter(item => Number(item.level) === 3)
    warehouseSlotOptions.splice(0, warehouseSlotOptions.length, ...slotList.map(item => ({
      label: `${item.name || ''}`.trim(),
      value: item.id
    })))
  } catch (e) {
    console.error('加载仓库失败:', e)
  }
}

const loadBatches = async () => {
  try {
    const res = await request({
      url: '/inventory_batches?available_qty=gt.0&order=updated_at.desc',
      headers: { 'Accept-Profile': 'scm' }
    })
    const list = Array.isArray(res) ? res : []
    const materialMap = new Map(materials.value.map(item => [item.id, item.name]))

    batchOptions.value = list.map(item => ({
      ...item,
      material_name: item.material_name || materialMap.get(item.material_id) || '',
      warehouse_name: resolveWarehouseNameByLevel(item.warehouse_id, 3) || resolveWarehouseNameByLevel(item.warehouse_id, 1) || '',
      warehouse_path: resolveWarehouseFullPath(item.warehouse_id)
    }))

    batchSelectOptions.splice(0, batchSelectOptions.length, ...batchOptions.value.map(item => ({
      label: buildBatchLabel(item),
      value: item.id
    })))
  } catch (e) {
    console.error('加载批次失败:', e)
  }
}

const buildTree = (flatData) => {
  const map = {}
  const roots = []
  flatData.forEach(item => { map[item.id] = { ...item, children: [] } })
  flatData.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id])
    } else {
      roots.push(map[item.id])
    }
  })
  return roots
}

/* ── 初始化：先加载物料+仓库，再加载批次 ── */
onMounted(async () => {
  await Promise.all([loadMaterials(), loadWarehouses()])
  await loadBatches()
  await nextTick()
  gridRef.value?.loadData?.()
})
</script>

<style scoped>
.inventory-stock {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
  background: #f5f7fb;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.stock-grid {
  flex: 1;
  min-height: 0;
}

.stock-grid :deep(.eis-grid-wrapper),
.stock-grid :deep(.ag-theme-alpine),
.stock-grid :deep(.ag-root-wrapper),
.stock-grid :deep(.ag-root-wrapper-body),
.stock-grid :deep(.ag-root) {
  height: 100%;
  min-height: 520px;
}

.hint-text {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.selection-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  font-size: 12px;
  color: #606266;
}

.selection-tip .el-button {
  margin-left: auto;
}

.tip-strong {
  font-weight: 600;
  color: #303133;
}

/* ── 库存信息栏 ── */
.stock-info-bar {
  background: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  border-left: 3px solid #409eff;
}

.stock-info-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #409eff;
}

.stock-info-title {
  font-weight: 600;
  flex: 1;
}

.stock-info-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stock-info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #f0f9eb;
  border-radius: 6px;
  font-size: 12px;
  color: #606266;
}

.stock-wh {
  color: #303133;
  font-weight: 500;
}

.stock-qty strong {
  color: #67c23a;
}

/* ── 抽屉内库存提示 ── */
.drawer-stock-hint {
  background: #f0f9eb;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  border: 1px solid #e1f3d8;
}

.drawer-stock-hint-title {
  font-size: 12px;
  color: #67c23a;
  font-weight: 600;
  margin-bottom: 6px;
}

.drawer-stock-hint-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
  padding: 2px 0;
}

.drawer-stock-hint-item strong {
  color: #67c23a;
}
</style>
