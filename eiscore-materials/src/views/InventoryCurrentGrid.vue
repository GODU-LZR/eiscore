<template>
  <div class="inventory-current-page">
    <el-card shadow="never" class="query-card">
      <el-form :inline="true" :model="filters" class="query-form" @submit.prevent>
        <el-form-item label="仓库/库区/库位">
          <el-cascader
            v-model="filters.warehouseId"
            :options="warehouseOptions"
            :props="warehouseCascaderProps"
            placeholder="请选择仓库层级"
            clearable
            filterable
            style="width: 280px"
          />
        </el-form-item>

        <el-form-item label="物料类型">
          <el-cascader
            v-model="filters.materialCategoryCode"
            :options="materialCategoryOptions"
            :props="materialCategoryCascaderProps"
            placeholder="全部类型"
            clearable
            filterable
            style="width: 260px"
          />
        </el-form-item>

        <el-form-item label="物料查询">
          <el-input
            v-model.trim="filters.keyword"
            placeholder="输入物料编码/名称/批次号"
            clearable
            style="width: 260px"
            @keyup.enter="applyFilters"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="grid-wrap">
      <MaterialAppGrid :key="gridKey" :app-config="appConfig" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import MaterialAppGrid from '@/components/MaterialAppGrid.vue'
import request from '@/utils/request'

const filters = reactive({
  warehouseId: null,
  materialCategoryCode: '',
  keyword: ''
})

const appliedFilters = reactive({
  warehouseId: null,
  materialCategoryCode: '',
  keyword: ''
})

const queryVersion = ref(0)
const warehouseOptions = ref([])
const warehouseFlat = ref([])
const warehouseIndex = ref({})
const materialCategoryOptions = ref([])
const materialCategoryDepth = ref(2)

const warehouseCascaderProps = {
  value: 'id',
  label: 'name',
  children: 'children',
  emitPath: false,
  checkStrictly: true
}

const materialCategoryCascaderProps = {
  value: 'value',
  label: 'label',
  children: 'children',
  emitPath: false,
  checkStrictly: true
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
  if (Number(node.level) !== targetLevel) return ''
  return node.name || node.code || ''
}

const collectDescendantIds = (warehouseId) => {
  if (!warehouseId || !warehouseIndex.value[warehouseId]) return []
  const result = []
  const queue = [warehouseId]
  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    result.push(current)
    warehouseFlat.value.forEach((item) => {
      if (item.parent_id === current) queue.push(item.id)
    })
  }
  return result
}

const collectCategoryCodes = (nodes = [], set = new Set()) => {
  if (!Array.isArray(nodes)) return set
  nodes.forEach((node) => {
    const value = String(node?.value || '').trim()
    if (value) set.add(value)
    if (Array.isArray(node?.children) && node.children.length) {
      collectCategoryCodes(node.children, set)
    }
  })
  return set
}

const normalizeSingleValue = (value) => {
  if (Array.isArray(value)) {
    const last = value[value.length - 1]
    return last || null
  }
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text : null
}

const buildApiUrl = () => {
  const params = []
  const warehouseId = normalizeSingleValue(appliedFilters.warehouseId)
  const materialCategoryCode = normalizeSingleValue(appliedFilters.materialCategoryCode)
  const keyword = String(appliedFilters.keyword || '').trim()
  const validCategoryCodes = collectCategoryCodes(materialCategoryOptions.value)

  if (warehouseId) {
    const ids = collectDescendantIds(warehouseId)
    if (ids.length === 1) {
      params.push(`warehouse_id=eq.${ids[0]}`)
    } else if (ids.length > 1) {
      params.push(`warehouse_id=in.(${ids.join(',')})`)
    }
  }

  if (materialCategoryCode && validCategoryCodes.has(materialCategoryCode)) {
    params.push(`material_category=like.${encodeURIComponent(materialCategoryCode)}*`)
  }

  if (keyword) {
    const safeKeyword = keyword.replace(/,/g, '')
    const orExpr = `(material_code.ilike.*${safeKeyword}*,material_name.ilike.*${safeKeyword}*,batch_no.ilike.*${safeKeyword}*)`
    params.push(`or=${encodeURIComponent(orExpr)}`)
  }

  const query = params.join('&')
  return query ? `/v_inventory_current?${query}` : '/v_inventory_current'
}

const gridKey = computed(() => [
  appliedFilters.warehouseId || 'all',
  appliedFilters.materialCategoryCode || 'all',
  appliedFilters.keyword || 'all',
  queryVersion.value
].join('|'))

const appConfig = computed(() => ({
  key: 'inventory-current',
  name: '库存查询',
  desc: '实时库存汇总',
  apiUrl: buildApiUrl(),
  showStatusCol: false,
  schema: 'scm',
  viewId: 'inventory_current',
  configKey: 'inventory_current_cols',
  writeMode: 'patch',
  aclModule: 'mms_inventory',
  staticColumns: [
    {
      label: '物料编码',
      prop: 'material_code',
      width: 140,
      editable: false,
      pinned: 'left'
    },
    {
      label: '物料名称',
      prop: 'material_name',
      width: 180,
      editable: false,
      pinned: 'left'
    },
    {
      label: '物料分类',
      prop: 'material_category',
      width: 120,
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
      prop: 'warehouse_lv1_name',
      width: 140,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 1)
    },
    {
      label: '库区',
      prop: 'warehouse_lv2_name',
      width: 140,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 2)
    },
    {
      label: '库位',
      prop: 'warehouse_lv3_name',
      width: 140,
      editable: false,
      valueGetter: (params) => resolveWarehouseNameByLevel(params.data?.warehouse_id, 3)
    },
    {
      label: '可用数量',
      prop: 'available_qty',
      width: 120,
      editable: false,
      cellStyle: { color: '#67c23a', fontWeight: 'bold' }
    },
    {
      label: '锁定数量',
      prop: 'locked_qty',
      width: 120,
      editable: false,
      cellStyle: { color: '#e6a23c' }
    },
    {
      label: '总数量',
      prop: 'total_qty',
      width: 120,
      editable: false,
      cellStyle: { color: '#409eff', fontWeight: 'bold' }
    },
    {
      label: '单位',
      prop: 'unit',
      width: 80,
      editable: false
    },
    {
      label: '生产日期',
      prop: 'production_date',
      width: 120,
      editable: false,
      valueFormatter: (params) => {
        if (!params.value) return '-'
        return new Date(params.value).toLocaleDateString('zh-CN')
      }
    },
    {
      label: '过期日期',
      prop: 'expiry_date',
      width: 120,
      editable: false,
      valueFormatter: (params) => {
        if (!params.value) return '-'
        return new Date(params.value).toLocaleDateString('zh-CN')
      },
      cellStyle: (params) => {
        if (!params.value) return {}
        const expiry = new Date(params.value)
        const now = new Date()
        const days = (expiry - now) / (1000 * 60 * 60 * 24)
        if (days < 0) return { color: '#f56c6c', fontWeight: 'bold' }
        if (days < 30) return { color: '#e6a23c' }
        return {}
      }
    },
    {
      label: '最后更新',
      prop: 'last_transaction_at',
      width: 160,
      editable: false,
      valueFormatter: (params) => {
        if (!params.value) return '-'
        return new Date(params.value).toLocaleString('zh-CN')
      }
    }
  ],
  includeProperties: false,
  enableDetail: false,
  ops: {
    create: false,
    edit: false,
    delete: false,
    export: 'op:mms_inventory.export',
    config: 'op:mms_inventory.config'
  }
}))

const applyFilters = () => {
  appliedFilters.warehouseId = normalizeSingleValue(filters.warehouseId)
  appliedFilters.materialCategoryCode = normalizeSingleValue(filters.materialCategoryCode) || ''
  appliedFilters.keyword = (filters.keyword || '').trim()
  queryVersion.value++
}

const resetFilters = () => {
  filters.warehouseId = null
  filters.materialCategoryCode = ''
  filters.keyword = ''
  applyFilters()
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
  } catch (e) {
    console.error('加载仓库失败:', e)
  }
}

const loadMaterialCategories = async () => {
  try {
    const settingsRes = await request({
      url: '/system_configs?key=eq.app_settings',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const settingsRow = Array.isArray(settingsRes) && settingsRes.length ? settingsRes[0] : null
    const depth = Number(settingsRow?.value?.materialsCategoryDepth || 2)
    materialCategoryDepth.value = depth === 3 ? 3 : 2

    const res = await request({
      url: '/system_configs?key=eq.materials_categories',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const row = Array.isArray(res) && res.length ? res[0] : null
    const list = Array.isArray(row?.value) ? row.value : []
    const normalizeTree = (nodes = [], level = 1) => {
      if (!Array.isArray(nodes)) return []
      return nodes
        .map((item) => {
          const value = String(item?.id || '').trim()
          const labelText = String(item?.label || '').trim()
          if (!value || !labelText) return null
          const next = {
            value,
            label: `${value} ${labelText}`
          }
          if (level < materialCategoryDepth.value) {
            const children = normalizeTree(item.children || [], level + 1)
            if (children.length) next.children = children
          }
          return next
        })
        .filter(Boolean)
    }
    materialCategoryOptions.value = normalizeTree(list, 1)
  } catch (e) {
    console.error('加载物料类型失败:', e)
    materialCategoryOptions.value = []
  }
}

onMounted(async () => {
  await Promise.all([loadWarehouses(), loadMaterialCategories()])
  applyFilters()
})
</script>

<style scoped>
.inventory-current-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
  background: #f5f7fb;
  overflow: hidden;
}

.query-card {
  border-radius: 8px;
  flex-shrink: 0;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.grid-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
