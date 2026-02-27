<template>
  <div class="inventory-ledger">
    <EisDataGrid
      ref="gridRef"
      class="ledger-grid"
      :view-id="appConfig.viewId"
      :api-url="appConfig.apiUrl"
      :write-url="appConfig.writeUrl || ''"
      :include-properties="appConfig.includeProperties !== false"
      :write-mode="appConfig.writeMode || 'upsert'"
      :patch-required-fields="appConfig.patchRequiredFields || []"
      :field-defaults="appConfig.fieldDefaults || {}"
      :default-order="appConfig.defaultOrder || 'id.desc'"
      :acl-module="appConfig.aclModule"
      :profile="appProfile"
      :accept-profile="appProfile"
      :content-profile="appProfile"
      :static-columns="staticColumns"
      :extra-columns="extraColumns"
      :summary="summaryConfig"
      :can-create="canCreate"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :can-export="canExport"
      :can-config="canConfig"
      @create="openStockInDialog"
    />
    
    <!-- 入库对话框 -->
    <el-dialog v-model="stockInDialog.visible" title="入库" width="600px" append-to-body>
      <el-form :model="stockInDialog.form" label-width="100px" ref="stockInFormRef">
        <el-form-item label="物料" required>
          <el-select v-model="stockInDialog.form.material_id" filterable placeholder="请选择物料" style="width: 100%;">
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
            v-model="stockInDialog.form.warehouse_path"
            :options="warehouseOptions"
            :props="{ value: 'id', label: 'name', children: 'children', emitPath: false }"
            placeholder="请选择仓库/库位"
            style="width: 100%;"
          />
        </el-form-item>
        
        <el-form-item label="批次号规则">
          <el-select v-model="stockInDialog.form.rule_id" placeholder="选择规则" style="width: 60%;" @change="handleRuleChange">
            <el-option
              v-for="r in batchRules"
              :key="r.id"
              :label="r.rule_name"
              :value="r.id"
            />
          </el-select>
          <el-button style="margin-left: 10px;" @click="generateBatchNo" :disabled="!stockInDialog.form.rule_id">生成</el-button>
        </el-form-item>
        
        <el-form-item label="批次号" required>
          <el-input v-model="stockInDialog.form.batch_no" placeholder="输入或生成批次号" />
        </el-form-item>
        
        <el-form-item label="数量" required>
          <el-input-number v-model="stockInDialog.form.quantity" :min="0.01" :precision="2" style="width: 200px;" />
          <el-select v-model="stockInDialog.form.unit" style="width: 100px; margin-left: 10px;">
            <el-option label="个" value="个" />
            <el-option label="件" value="件" />
            <el-option label="箱" value="箱" />
            <el-option label="吨" value="吨" />
            <el-option label="千克" value="千克" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="生产日期">
          <el-date-picker v-model="stockInDialog.form.production_date" type="date" placeholder="选择日期" />
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input v-model="stockInDialog.form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="stockInDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitStockIn" :loading="stockInDialog.loading">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { hasPerm } from '@/utils/permission'

const gridRef = ref(null)
const materials = ref([])
const warehouseOptions = ref([])
const warehouseFlat = ref([])
const warehouseIndex = ref({})
const batchRules = ref([])
const stockInFormRef = ref(null)

const stockInDialog = reactive({
  visible: false,
  loading: false,
  form: {
    material_id: null,
    warehouse_path: null,
    rule_id: null,
    batch_no: '',
    quantity: 1,
    unit: '个',
    production_date: null,
    remark: ''
  }
})

const appConfig = computed(() => ({
  key: 'inventory-ledger',
  name: '库存台账',
  desc: '库存入库出库流水记录',
  apiUrl: '/v_inventory_transactions',
  schema: 'scm',
  viewId: 'inventory_ledger',
  configKey: 'inventory_ledger_cols',
  writeMode: 'patch',
  aclModule: 'mms_inventory',
  staticColumns: [
    {
      label: '单据号',
      prop: 'transaction_no',
      width: 180,
      editable: false,
      pinned: 'left'
    },
    {
      label: '业务类型',
      prop: 'transaction_type',
      width: 140,
      editable: false,
      valueGetter: (params) => {
        const ioType = String(params.data?.io_type || '').trim()
        if (ioType && !/[?？]/.test(ioType)) return ioType
        return params.data?.transaction_type || ''
      },
      cellStyle: (params) => {
        const baseType = params.data?.transaction_type
        if (baseType === '入库') return { color: '#67c23a', fontWeight: 'bold' }
        if (baseType === '出库') return { color: '#f56c6c', fontWeight: 'bold' }
        if (baseType === '调整') return { color: '#e6a23c', fontWeight: 'bold' }
        return {}
      }
    },
    {
      label: '物料编码',
      prop: 'material_code',
      width: 140,
      editable: false
    },
    {
      label: '物料名称',
      prop: 'material_name',
      width: 180,
      editable: false
    },
    {
      label: '批次号',
      prop: 'batch_no',
      width: 180,
      editable: false
    },
    {
      label: '仓库',
      prop: 'warehouse_name',
      width: 140,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 1)
    },
    {
      label: '库区',
      prop: 'warehouse_area',
      width: 140,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 2)
    },
    {
      label: '库位',
      prop: 'warehouse_slot',
      width: 140,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 3)
    },
    {
      label: '数量',
      prop: 'quantity',
      width: 120,
      editable: false,
      cellStyle: (params) => {
        if (params.value > 0) return { color: '#67c23a' }
        if (params.value < 0) return { color: '#f56c6c' }
        return {}
      }
    },
    {
      label: '单位',
      prop: 'unit',
      width: 80,
      editable: false
    },
    {
      label: '操作前数量',
      prop: 'before_qty',
      width: 120,
      editable: false
    },
    {
      label: '操作后数量',
      prop: 'after_qty',
      width: 120,
      editable: false
    },
    {
      label: '操作人',
      prop: 'operator',
      width: 120,
      editable: false
    },
    {
      label: '操作时间',
      prop: 'transaction_date',
      width: 160,
      editable: false,
      valueFormatter: (params) => {
        if (!params.value) return ''
        return new Date(params.value).toLocaleString('zh-CN')
      }
    },
    {
      label: '备注',
      prop: 'remark',
      width: 200,
      editable: false
    }
  ],
  includeProperties: false,
  enableDetail: false,
  ops: {
    create: 'op:mms_inventory.stock_in',
    edit: false,
    delete: false,
    export: 'op:mms_inventory.export',
    config: 'op:mms_inventory.config'
  },
  customActions: [
    {
      label: '入库',
      icon: 'Plus',
      type: 'success',
      handler: () => {
        openStockInDialog()
      }
    }
  ]
}))

const appProfile = computed(() => appConfig.value.schema || 'public')
const staticColumns = computed(() => appConfig.value.staticColumns || [])
const extraColumns = computed(() => appConfig.value.defaultExtraColumns || [])
const summaryConfig = computed(() => appConfig.value.summaryConfig || { label: '总计', rules: {}, expressions: {} })

const opPerms = computed(() => appConfig.value?.ops || {})
const canCreate = computed(() => hasPerm(opPerms.value.create))
const canEdit = computed(() => hasPerm(opPerms.value.edit))
const canDelete = computed(() => hasPerm(opPerms.value.delete))
const canExport = computed(() => hasPerm(opPerms.value.export))
const canConfig = computed(() => hasPerm(opPerms.value.config))

const loadMaterials = async () => {
  try {
    const res = await request({
      url: '/raw_materials?select=id,batch_no,name&order=batch_no.asc',
      headers: { 'Accept-Profile': 'public' }
    })
    materials.value = res || []
  } catch (e) {
    console.error('加载物料失败:', e)
  }
}

const buildWarehouseIndex = (list) => {
  const map = {}
  list.forEach(item => {
    map[item.id] = item
  })
  warehouseIndex.value = map
}

const resolveWarehouseNameByLevel = (warehouseId, targetLevel) => {
  if (!warehouseId) return ''
  let node = warehouseIndex.value[warehouseId]
  if (!node) return ''
  let guard = 0
  while (node && Number(node.level) > targetLevel && guard < 10) {
    node = warehouseIndex.value[node.parent_id]
    guard += 1
  }
  if (!node) return ''
  if (Number(node.level) !== targetLevel) {
    if (targetLevel === 3 && Number(node.level) === 2) return ''
    if (targetLevel === 2 && Number(node.level) === 1) return ''
    if (targetLevel === 1 && Number(node.level) >= 1) {
      while (node && Number(node.level) > 1 && guard < 20) {
        node = warehouseIndex.value[node.parent_id]
        guard += 1
      }
    }
  }
  return node?.name || node?.code || ''
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
  } catch (e) {
    console.error('加载批次号规则失败:', e)
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

const openStockInDialog = () => {
  stockInDialog.visible = true
  stockInDialog.form = {
    material_id: null,
    warehouse_path: null,
    rule_id: null,
    batch_no: '',
    quantity: 1,
    unit: '个',
    production_date: null,
    remark: ''
  }
}

const handleRuleChange = () => {
  if (stockInDialog.form.rule_id) {
    generateBatchNo()
  }
}

const generateBatchNo = async () => {
  if (!stockInDialog.form.rule_id || !stockInDialog.form.material_id) {
    ElMessage.warning('请先选择物料和批次号规则')
    return
  }
  
  try {
    const res = await request({
      url: '/rpc/generate_batch_no',
      method: 'post',
      headers: {
        'Accept-Profile': 'scm',
        'Content-Profile': 'scm'
      },
      data: {
        p_rule_id: stockInDialog.form.rule_id,
        p_material_id: stockInDialog.form.material_id,
        p_manual_override: null
      }
    })
    stockInDialog.form.batch_no = res
    ElMessage.success('批次号已生成')
  } catch (e) {
    console.error('生成批次号失败:', e)
    ElMessage.error(e.message || '生成批次号失败')
  }
}

const submitStockIn = async () => {
  const { material_id, warehouse_path, batch_no, quantity, unit, production_date, remark } = stockInDialog.form
  
  if (!material_id || !warehouse_path || !batch_no || !quantity) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  stockInDialog.loading = true
  try {
    await request({
      url: '/rpc/stock_in',
      method: 'post',
      headers: {
        'Accept-Profile': 'scm',
        'Content-Profile': 'scm'
      },
      data: {
        p_material_id: material_id,
        p_warehouse_id: warehouse_path,
        p_quantity: quantity,
        p_unit: unit,
        p_batch_no: batch_no,
        p_production_date: production_date,
        p_remark: remark
      }
    })
    
    ElMessage.success('入库成功')
    stockInDialog.visible = false
    
    // 触发刷新表格
    window.dispatchEvent(new CustomEvent('eis-reload-grid'))
  } catch (e) {
    console.error('入库失败:', e)
    ElMessage.error(e.message || '入库失败')
  } finally {
    stockInDialog.loading = false
  }
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
.inventory-ledger {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  box-sizing: border-box;
  background: #f5f7fb;
}

.ledger-grid {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ledger-grid :deep(.eis-grid-wrapper) {
  height: 100%;
  min-height: 0;
}

.ledger-grid :deep(.grid-card) {
  height: 100%;
  min-height: 560px;
}

.ledger-grid :deep(.eis-grid-container) {
  flex: 1;
  min-height: 0;
}

.ledger-grid :deep(.ag-theme-alpine),
.ledger-grid :deep(.ag-root-wrapper),
.ledger-grid :deep(.ag-root-wrapper-body),
.ledger-grid :deep(.ag-root) {
  height: 100%;
  min-height: 480px;
}
</style>
