<template>
  <div class="inventory-current">
    <MaterialAppGrid :app-config="appConfig" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MaterialAppGrid from '@/components/MaterialAppGrid.vue'

const appConfig = computed(() => ({
  key: 'inventory-current',
  name: '库存查询',
  desc: '实时库存汇总',
  apiUrl: '/v_inventory_current',
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
      label: '仓库编码',
      prop: 'warehouse_code',
      width: 120,
      editable: false
    },
    {
      label: '仓库名称',
      prop: 'warehouse_name',
      width: 140,
      editable: false
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
      label: '状态',
      prop: 'status',
      width: 100,
      editable: false,
      cellStyle: (params) => {
        if (params.value === '正常') return { color: '#67c23a' }
        if (params.value === '锁定') return { color: '#e6a23c' }
        if (params.value === '过期') return { color: '#f56c6c' }
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
</script>

<style scoped>
.inventory-current {
  height: 100%;
  width: 100%;
}
</style>
