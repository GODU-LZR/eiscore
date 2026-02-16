<template>
  <div class="inventory-stock">
    <div class="page-header">
      <div class="header-text">
        <h2>入库</h2>
        <p>登记物料入库流水并同步库存</p>
      </div>
      <div class="header-actions">
        <el-button plain @click="goBatchRules">批次号规则</el-button>
        <el-button type="primary" @click="openDrawer">入库登记</el-button>
      </div>
    </div>

    <EisDataGrid
      ref="gridRef"
      class="stock-grid"
      :view-id="gridConfig.viewId"
      :api-url="gridConfig.apiUrl"
      :write-url="gridConfig.writeUrl"
      :include-properties="gridConfig.includeProperties !== false"
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

    <el-drawer v-model="drawer.visible" title="入库登记" size="520px" direction="rtl">
      <div class="selection-tip" v-if="selectedRow">
        <span>已选中表格行：</span>
        <span class="tip-strong">{{ selectedRow.material_name || selectedRow.material_code || '物料' }}</span>
        <el-button size="small" plain @click="applySelectedRow">带入信息</el-button>
      </div>
      <el-form :model="drawer.form" label-width="110px" ref="formRef">
        <el-form-item label="物料" required>
          <el-select v-model="drawer.form.material_id" filterable placeholder="请选择物料" style="width: 100%;">
            <el-option
              v-for="m in materials"
              :key="m.id"
              :label="`${m.batch_no} - ${m.name}`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="仓库" required>
          <el-cascader
            v-model="drawer.form.warehouse_id"
            :options="warehouseOptions"
            :props="{ value: 'id', label: 'name', children: 'children', emitPath: false }"
            placeholder="请选择仓库/库位"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="使用批次号规则">
          <el-switch v-model="drawer.form.useBatchRule" :disabled="drawer.form.allowNoBatch" />
          <span class="hint-text">关闭后可直接手动输入批次号</span>
        </el-form-item>

        <el-form-item label="批次号规则" v-if="drawer.form.useBatchRule">
          <el-select v-model="drawer.form.rule_id" placeholder="选择规则" style="width: 60%;" @change="handleRuleChange">
            <el-option label="手动输入" :value="null" />
            <el-option
              v-for="r in batchRules"
              :key="r.id"
              :label="r.rule_name"
              :value="r.id"
            />
          </el-select>
          <el-button style="margin-left: 10px;" @click="generateBatchNo" :disabled="!drawer.form.rule_id">生成</el-button>
        </el-form-item>

        <el-form-item label="允许无批次号">
          <el-switch v-model="drawer.form.allowNoBatch" />
          <span class="hint-text">开启后将自动生成占位批次号并跳过规则</span>
        </el-form-item>

        <el-form-item label="批次号" required>
          <el-input v-model="drawer.form.batch_no" placeholder="输入或生成批次号" />
        </el-form-item>

        <el-form-item label="数量" required>
          <el-input-number v-model="drawer.form.quantity" :min="0.01" :precision="2" style="width: 200px;" />
          <el-select v-model="drawer.form.unit" style="width: 120px; margin-left: 10px;">
            <el-option v-for="u in unitOptions" :key="u" :label="u" :value="u" />
          </el-select>
        </el-form-item>

        <el-form-item label="生产日期">
          <el-date-picker v-model="drawer.form.production_date" type="date" placeholder="选择日期" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="drawer.form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawer.visible = false">取消</el-button>
          <el-button type="primary" @click="submitStockIn" :loading="drawer.loading">确认入库</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
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
const batchRules = ref([])
const loadedRows = ref([])

const userStore = useUserStore()
const operatorName = computed(() => userStore.userInfo?.username || 'Admin')

const unitOptions = ['个', '件', '箱', '吨', '千克', '克', '斤', '米']
const unitSelectOptions = unitOptions.map(item => ({ label: item, value: item }))
const manualRuleOption = { label: '人工输入', value: '__manual__' }
const ruleSelectOptions = [manualRuleOption]
const materialSelectOptions = []
const warehouseSlotOptions = []
const warehouseLevel1Options = []
const warehouseLevel2OptionsMap = reactive({})
const warehouseLevel3OptionsMap = reactive({})

const getRowStatus = (row) => String(row?.status || 'created')
const isEditableRow = (params) => getRowStatus(params?.data) === 'created'
const canEditField = (params, field) => {
  const status = getRowStatus(params?.data)
  if (status === 'created') return true
  if (status === 'active') return field === 'warehouse_id' || field === 'remark'
  return false
}

const parseNonNegative = (value) => {
  const num = Number(value)
  if (Number.isNaN(num) || num < 0) return null
  return Number(num.toFixed(4))
}

const isUuid = (value) => {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))
}

const buildWarehouseIndex = (list) => {
  const map = {}
  list.forEach(item => {
    map[item.id] = item
  })
  warehouseIndex.value = map
}

const resolveWarehouseIdByLevel = (warehouseId, targetLevel) => {
  if (!warehouseId) return null
  let node = warehouseIndex.value[warehouseId]
  let guard = 0
  while (node && node.level > targetLevel && guard < 10) {
    node = warehouseIndex.value[node.parent_id]
    guard += 1
  }
  if (!node || node.level !== targetLevel) return null
  return node.id || null
}

const resolveWarehouseSelection = (row) => {
  if (!row) return { level1Id: null, level2Id: null }
  const level1Id = row.warehouse_lv1_id ?? resolveWarehouseIdByLevel(row.warehouse_id, 1)
  const level2Id = row.warehouse_lv2_id ?? resolveWarehouseIdByLevel(row.warehouse_id, 2)
  return { level1Id, level2Id }
}

const syncWarehouseLevels = (row, warehouseId) => {
  if (!row) return
  row.warehouse_lv1_id = resolveWarehouseIdByLevel(warehouseId, 1)
  row.warehouse_lv2_id = resolveWarehouseIdByLevel(warehouseId, 2)
}

const handleDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  loadedRows.value = rows
  if (rows.length === 0) return
  if (Object.keys(warehouseIndex.value || {}).length === 0) return
  rows.forEach(row => {
    if (!row) return
    if (!row.warehouse_lv1_id || !row.warehouse_lv2_id) {
      syncWarehouseLevels(row, row.warehouse_id)
    }
  })
  gridRef.value?.refreshCells?.({ force: true })
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

const gridConfig = {
  viewId: 'inventory_stock_in',
  apiUrl: '/v_inventory_drafts?draft_type=eq.in',
  writeUrl: '/inventory_drafts',
  schema: 'scm',
  includeProperties: false,
  patchRequiredFields: ['draft_type', 'status', 'material_id', 'warehouse_id', 'quantity', 'unit'],
  fieldDefaults: { draft_type: 'in', status: 'created' },
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
    { label: '物料', prop: 'material_id', width: 200, editable: (params) => canEditField(params, 'material_id'), type: 'select', options: materialSelectOptions, allowClear: false },
    {
      label: '仓库',
      prop: 'warehouse_lv1_id',
      width: 140,
      editable: (params) => canEditField(params, 'warehouse_id'),
      type: 'select',
      options: warehouseLevel1Options,
      allowClear: true,
      skipSave: true,
      formatter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 1),
      valueGetter: (params) => resolveWarehouseSelection(params.data).level1Id,
      valueSetter: (params) => {
        if (params.newValue === params.oldValue) return false
        if (params.newValue && !isUuid(params.newValue)) {
          ElMessage.warning('仓库选择无效')
          return false
        }
        params.data.warehouse_lv1_id = params.newValue ? String(params.newValue) : null
        params.data.warehouse_lv2_id = null
        params.data.warehouse_id = null
        return true
      }
    },
    {
      label: '库区',
      prop: 'warehouse_lv2_id',
      width: 140,
      editable: (params) => canEditField(params, 'warehouse_id'),
      type: 'cascader',
      dependsOn: 'warehouse_lv1_id',
      cascaderOptions: warehouseLevel2OptionsMap,
      cascaderFlatOptions: warehouseFlat,
      cascaderParentField: 'parent_id',
      cascaderLabelField: 'name',
      cascaderValueField: 'id',
      allowClear: true,
      skipSave: true,
      formatter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 2),
      valueGetter: (params) => resolveWarehouseSelection(params.data).level2Id,
      valueSetter: (params) => {
        if (params.newValue === params.oldValue) return false
        if (params.newValue && !isUuid(params.newValue)) {
          ElMessage.warning('库区选择无效')
          return false
        }
        params.data.warehouse_lv2_id = params.newValue ? String(params.newValue) : null
        params.data.warehouse_id = null
        return true
      }
    },
    {
      label: '库位',
      prop: 'warehouse_id',
      width: 160,
      editable: (params) => canEditField(params, 'warehouse_id'),
      type: 'cascader',
      dependsOn: 'warehouse_lv2_id',
      cascaderOptions: warehouseLevel3OptionsMap,
      cascaderFlatOptions: warehouseFlat,
      cascaderParentField: 'parent_id',
      cascaderLabelField: 'name',
      cascaderValueField: 'id',
      allowClear: false,
      formatter: (params) => {
        const target = params.data?.warehouse_id
        if (!target) return ''
        const node = warehouseIndex.value?.[target]
        return node?.name || node?.code || ''
      },
      valueParser: (params) => (params.newValue ? String(params.newValue) : params.newValue),
      valueGetter: (params) => {
        const row = params.data
        if (!row) return null
        if (row.warehouse_lv2_id && resolveWarehouseIdByLevel(row.warehouse_id, 2) !== row.warehouse_lv2_id) {
          return null
        }
        return row.warehouse_id || null
      },
      valueSetter: (params) => {
        if (params.newValue === params.oldValue) return false
        if (!params.newValue) {
          ElMessage.warning('库位不能为空')
          return false
        }
        if (!isUuid(params.newValue)) {
          ElMessage.warning('库位选择无效')
          return false
        }
        params.data.warehouse_id = params.newValue
        syncWarehouseLevels(params.data, params.newValue)
        return true
      }
    },
    {
      label: '批次规则',
      prop: 'rule_id',
      width: 160,
      editable: (params) => canEditField(params, 'rule_id'),
      type: 'select',
      options: ruleSelectOptions,
      allowClear: false,
      valueGetter: (params) => {
        const value = params.data?.rule_id
        return value ? value : '__manual__'
      },
      valueParser: (params) => {
        if (params.newValue === '__manual__' || params.newValue === '' || params.newValue === null) return null
        return params.newValue
      },
      valueSetter: (params) => {
        const nextValue = params.newValue === '__manual__' ? null : params.newValue
        if (params.data.rule_id === nextValue) return false
        params.data.rule_id = nextValue
        return true
      }
    },
    { label: '批次号', prop: 'batch_no', width: 180, editable: (params) => canEditField(params, 'batch_no') && !params?.data?.rule_id },
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
    { label: '单位', prop: 'unit', width: 80, editable: (params) => canEditField(params, 'unit'), type: 'select', options: unitSelectOptions, allowClear: false },
    { label: '生产日期', prop: 'production_date', width: 120, editable: (params) => canEditField(params, 'production_date') },
    { label: '备注', prop: 'remark', width: 160, editable: (params) => canEditField(params, 'remark') },
    { label: '操作人', prop: 'operator', width: 120, editable: false },
    { label: '单据号', prop: 'transaction_no', width: 180, editable: false },
    { label: '创建时间', prop: 'created_at', width: 160, editable: false }
  ]
}

const canCreate = computed(() => hasPerm('op:mms_inventory.stock_in'))
const canEdit = computed(() => true)
const canExport = computed(() => hasPerm('op:mms_inventory.export'))
const canConfig = computed(() => hasPerm('op:mms_inventory.config'))

const drawer = reactive({
  visible: false,
  loading: false,
  form: {
    material_id: null,
    warehouse_id: null,
    rule_id: null,
    batch_no: '',
    quantity: 1,
    unit: '个',
    production_date: null,
    remark: '',
    useBatchRule: true,
    allowNoBatch: false
  }
})

const goBatchRules = () => {
  router.push('/batch-rules')
}

const openDrawer = () => {
  drawer.visible = true
  drawer.form = {
    material_id: null,
    warehouse_id: null,
    rule_id: null,
    batch_no: '',
    quantity: 1,
    unit: '个',
    production_date: null,
    remark: '',
    useBatchRule: true,
    allowNoBatch: false
  }
}

watch(
  () => drawer.form.useBatchRule,
  (val) => {
    if (!val) {
      drawer.form.rule_id = null
    }
  }
)

watch(
  () => drawer.form.allowNoBatch,
  (val) => {
    if (val) {
      drawer.form.useBatchRule = false
      drawer.form.rule_id = null
    }
  }
)

const getErrorMessage = (error, fallback) => {
  const msg = error?.response?.data?.message || error?.response?.data?.details || error?.message
  return msg || fallback
}

const resolveRule = () => batchRules.value.find(rule => rule.id === drawer.form.rule_id)
const resolveMaterial = () => materials.value.find(item => item.id === drawer.form.material_id)

const buildClientBatchNo = (rule, material) => {
  if (!rule || !material) return ''
  let template = rule.rule_template || ''
  if (!template) return ''
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const seqSeed = Math.floor((Date.now() / 1000) % 1000000)
  template = template
    .replaceAll('{物料编码}', material.batch_no || 'MAT')
    .replaceAll('{物料分类}', material.category || 'CAT')
    .replaceAll('{分类}', material.category || 'CAT')
    .replaceAll('{日期:YYYYMMDD}', `${yyyy}${mm}${dd}`)
  const seqMatch = template.match(/\{序号:(\d+)\}/)
  if (seqMatch) {
    const len = Number(seqMatch[1]) || 3
    const seq = String(seqSeed % Math.pow(10, len)).padStart(len, '0')
    template = template.replace(seqMatch[0], seq)
  }
  return template
}

const handleRuleChange = () => {
  if (drawer.form.rule_id) generateBatchNo()
}

const generateBatchNo = async () => {
  if (!drawer.form.rule_id || !drawer.form.material_id) {
    ElMessage.warning('请先选择物料和批次号规则')
    return
  }
  if (!resolveRule()) {
    ElMessage.warning('当前规则不存在或未启用')
    return
  }
  if (!resolveMaterial()) {
    ElMessage.warning('当前物料不存在，请刷新后重试')
    return
  }
  try {
    const payload = {
      p_rule_id: drawer.form.rule_id,
      p_material_id: drawer.form.material_id,
      p_manual_override: null
    }
    const res = await request({
      url: '/rpc/generate_batch_no',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: payload
    })
    drawer.form.batch_no = res
    ElMessage.success('批次号已生成')
    return res
  } catch (e) {
    console.error('generate_batch_no failed', e)
    const rule = resolveRule()
    const material = resolveMaterial()
    const fallback = buildClientBatchNo(rule, material)
    if (fallback) {
      drawer.form.batch_no = fallback
      ElMessage.warning(`后端生成失败，已使用本地占位批次号：${fallback}`)
      return fallback
    }
    ElMessage.error(getErrorMessage(e, '生成批次号失败'))
    return null
  }
}

const validateManualBatchNo = async (value) => {
  if (!drawer.form.useBatchRule || !drawer.form.rule_id || !drawer.form.material_id) return true
  if (!resolveRule()) {
    ElMessage.warning('当前规则不存在或未启用')
    return false
  }
  if (!resolveMaterial()) {
    ElMessage.warning('当前物料不存在，请刷新后重试')
    return false
  }
  if (!value) return false
  try {
    await request({
      url: '/rpc/generate_batch_no',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: {
        p_rule_id: drawer.form.rule_id,
        p_material_id: drawer.form.material_id,
        p_manual_override: value
      }
    })
    return true
  } catch (e) {
    console.error('validate manual batch failed', e)
    ElMessage.error(getErrorMessage(e, '批次号校验失败'))
    return false
  }
}

const buildFallbackBatchNo = () => {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `AUTO-${stamp}`
}

const submitStockIn = async () => {
  const { material_id, warehouse_id, batch_no, quantity, unit, production_date, remark } = drawer.form

  if (!material_id || !warehouse_id || !quantity) {
    ElMessage.warning('请填写必填项')
    return
  }

  let finalBatchNo = batch_no

  if (drawer.form.allowNoBatch && !finalBatchNo) {
    finalBatchNo = buildFallbackBatchNo()
  }

  if (drawer.form.useBatchRule && !drawer.form.allowNoBatch) {
    if (!drawer.form.rule_id) {
      ElMessage.warning('请选择批次号规则')
      return
    }
    if (!finalBatchNo) {
      finalBatchNo = await generateBatchNo()
      if (!finalBatchNo) return
    } else {
      const ok = await validateManualBatchNo(finalBatchNo)
      if (!ok) return
    }
  }

  if (!finalBatchNo) {
    ElMessage.warning('请输入批次号')
    return
  }

  drawer.loading = true
  try {
    await request({
      url: '/inventory_drafts',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', 'Prefer': 'return=representation' },
      data: {
        draft_type: 'in',
        status: 'created',
        material_id,
        warehouse_id,
        rule_id: drawer.form.useBatchRule ? drawer.form.rule_id : null,
        batch_no: finalBatchNo,
        quantity,
        unit,
        production_date,
        remark,
        operator: operatorName.value
      }
    })

    ElMessage.success('已创建入库草稿')
    drawer.visible = false
    gridRef.value?.loadData?.()
  } catch (e) {
    ElMessage.error(getErrorMessage(e, '创建草稿失败'))
  } finally {
    drawer.loading = false
  }
}

const handleCellValueChanged = async (params) => {
  if (!params || !params.colDef?.field) return
  const field = params.colDef.field
  const row = params.data
  if (!row?.id) return

  if (field === 'rule_id' && row.status === 'created') {
    if (!row.rule_id) return
    try {
      const batchNo = await request({
        url: '/rpc/generate_batch_no',
        method: 'post',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          p_rule_id: row.rule_id,
          p_material_id: row.material_id,
          p_manual_override: null
        }
      })
      await request({
        url: `/inventory_drafts?id=eq.${row.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { batch_no: batchNo }
      })
    } catch (e) {
      await request({
        url: `/inventory_drafts?id=eq.${row.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { batch_no: '' }
      })
      ElMessage.warning(getErrorMessage(e, '批次号生成失败'))
    } finally {
      gridRef.value?.loadData?.()
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
        url: '/rpc/stock_in',
        method: 'post',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          p_material_id: row.material_id,
          p_warehouse_id: row.warehouse_id,
          p_quantity: row.quantity,
          p_unit: row.unit,
          p_batch_no: row.batch_no,
          p_production_date: row.production_date,
          p_remark: row.remark,
          p_operator: operatorName.value
        }
      })

      await request({
        url: `/inventory_drafts?id=eq.${row.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          status: 'active',
          transaction_no: res?.transaction_no || null,
          batch_id: res?.batch_id || null
        }
      })
      ElMessage.success('入库已生效')
    } catch (e) {
      await request({
        url: `/inventory_drafts?id=eq.${row.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { status: 'created' }
      })
      ElMessage.error(getErrorMessage(e, '入库生效失败'))
    } finally {
      gridRef.value?.loadData?.()
    }
    return
  }

  if (field === 'warehouse_id' && row.status === 'active' && row.batch_id) {
    try {
      await request({
        url: `/inventory_batches?id=eq.${row.batch_id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { warehouse_id: row.warehouse_id }
      })
      ElMessage.success('库位已更新')
    } catch (e) {
      ElMessage.error(getErrorMessage(e, '库位更新失败'))
    }
  }
}

const handleSelection = (rows) => {
  const row = Array.isArray(rows) && rows.length ? rows[0] : null
  selectedRow.value = row
}

const applySelectedRow = () => {
  const row = selectedRow.value
  if (!row) return
  drawer.form.material_id = row.material_id || drawer.form.material_id
  drawer.form.warehouse_id = row.warehouse_id || drawer.form.warehouse_id
  drawer.form.unit = row.unit || drawer.form.unit
  if (!drawer.form.batch_no) {
    drawer.form.batch_no = row.batch_no || ''
  }
}

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
    const level1ByLevel = list.filter(item => Number(item.level) === 1)
    const level2ByLevel = list.filter(item => Number(item.level) === 2)
    const level3ByLevel = list.filter(item => Number(item.level) === 3)

    const rootList = list.filter(item => !item.parent_id)
    const level1List = level1ByLevel.length > 0 ? level1ByLevel : rootList
    const level1Ids = new Set(level1List.map(item => item.id))
    const level2ByParent = list.filter(item => level1Ids.has(item.parent_id))
    const level2List = level2ByParent.length > 0 ? level2ByParent : level2ByLevel
    const level2Ids = new Set(level2List.map(item => item.id))
    const level3ByParent = list.filter(item => level2Ids.has(item.parent_id))
    const level3List = level3ByParent.length > 0 ? level3ByParent : level3ByLevel

    warehouseLevel1Options.splice(0, warehouseLevel1Options.length, ...level1List
      .filter(item => item?.id)
      .map(item => ({
        label: `${item.name || item.code || ''}`.trim(),
        value: String(item.id)
      })))

    const pushOption = (map, key, option) => {
      if (!key) return
      const normalizedKey = String(key)
      if (!map[normalizedKey]) map[normalizedKey] = []
      const exists = map[normalizedKey].some(item => item.value === option.value)
      if (!exists) map[normalizedKey].push(option)
    }

    Object.keys(warehouseLevel2OptionsMap).forEach(key => delete warehouseLevel2OptionsMap[key])
    level2List.forEach(item => {
      if (!item?.id || !item?.parent_id) return
      const key = item.parent_id
      const option = { label: `${item.name || item.code || ''}`.trim(), value: String(item.id) }
      pushOption(warehouseLevel2OptionsMap, key, option)
    })

    Object.keys(warehouseLevel3OptionsMap).forEach(key => delete warehouseLevel3OptionsMap[key])
    level3List.forEach(item => {
      if (!item?.id || !item?.parent_id) return
      const key = item.parent_id
      const option = { label: `${item.name || item.code || ''}`.trim(), value: String(item.id) }
      pushOption(warehouseLevel3OptionsMap, key, option)
    })

    warehouseSlotOptions.splice(0, warehouseSlotOptions.length, ...level3List
      .filter(item => item?.id)
      .map(item => ({
        label: `${item.name || ''}`.trim(),
        value: String(item.id)
      })))
    loadedRows.value.forEach(row => {
      if (!row) return
      if (!row.warehouse_lv1_id || !row.warehouse_lv2_id) {
        syncWarehouseLevels(row, row.warehouse_id)
      }
    })
    gridRef.value?.refreshCells?.({ force: true })
  } catch (e) {
    console.error('加载仓库失败:', e)
  }
}

const loadBatchRules = async () => {
  try {
    const res = await request({
      url: '/batch_no_rules?status=eq.启用&order=created_at.desc',
      headers: { 'Accept-Profile': 'scm' }
    })
    batchRules.value = res || []
    ruleSelectOptions.splice(0, ruleSelectOptions.length, manualRuleOption, ...batchRules.value.map(rule => ({
      label: rule.rule_name || rule.rule_code || rule.id,
      value: rule.id
    })))
    gridRef.value?.loadData?.()
  } catch (e) {
    console.error('加载批次规则失败:', e)
  }
}

const buildTree = (flatData) => {
  const map = {}
  const roots = []

  flatData.forEach(item => {
    map[item.id] = { ...item, children: [] }
  })

  flatData.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id])
    } else {
      roots.push(map[item.id])
    }
  })

  return roots
}

onMounted(async () => {
  loadMaterials()
  loadWarehouses()
  loadBatchRules()
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
</style>
