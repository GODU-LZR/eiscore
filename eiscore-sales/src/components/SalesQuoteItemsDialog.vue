<template>
  <el-dialog
    :model-value="visible"
    :title="`报价明细 - ${quoteNo || ''}`"
    width="1100px"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <el-table v-loading="loading" :data="items" border size="small" max-height="460">
      <el-table-column label="行号" width="72"><template #default="{ row }">{{ row.line_no }}</template></el-table-column>
      <el-table-column label="产品编码" min-width="130"><template #default="{ row }"><el-input v-model="row.product_code" /></template></el-table-column>
      <el-table-column label="产品名称" min-width="180"><template #default="{ row }"><el-input v-model="row.product_name" /></template></el-table-column>
      <el-table-column label="规格" min-width="150"><template #default="{ row }"><el-input v-model="row.specification" /></template></el-table-column>
      <el-table-column label="数量" width="120"><template #default="{ row }"><el-input-number v-model="row.quantity" :min="0" :precision="2" controls-position="right" @change="emit('update-amount', row)" /></template></el-table-column>
      <el-table-column label="单位" width="95"><template #default="{ row }"><el-input v-model="row.unit" /></template></el-table-column>
      <el-table-column label="单价" width="130"><template #default="{ row }"><el-input-number v-model="row.unit_price" :min="0" :precision="2" controls-position="right" @change="emit('update-amount', row)" /></template></el-table-column>
      <el-table-column label="折扣(%)" width="120"><template #default="{ row }"><el-input-number v-model="row.discount_rate" :min="0" :max="100" :precision="2" controls-position="right" @change="emit('update-amount', row)" /></template></el-table-column>
      <el-table-column label="税率(%)" width="110"><template #default="{ row }"><el-input-number v-model="row.tax_rate" :min="0" :max="100" :precision="2" controls-position="right" /></template></el-table-column>
      <el-table-column label="行金额" width="130"><template #default="{ row }">{{ formatAmount(row.line_amount) }}</template></el-table-column>
      <el-table-column label="操作" width="80" fixed="right"><template #default="{ $index }"><el-button type="danger" link @click="emit('remove', $index)">删除</el-button></template></el-table-column>
    </el-table>
    <div class="quote-items-toolbar">
      <el-button type="primary" plain :disabled="!ready" @click="emit('add')">添加明细</el-button>
      <span>报价含税合计：<strong>{{ formatAmount(total) }}</strong></span>
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!ready" @click="emit('save')">保存明细并更新报价</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { toRefs } from 'vue'

const props = defineProps({
  visible: Boolean,
  quoteNo: { type: [String, Number], default: '' },
  loading: Boolean,
  saving: Boolean,
  ready: Boolean,
  items: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  formatAmount: { type: Function, required: true }
})
const emit = defineEmits(['update:visible', 'update-amount', 'add', 'remove', 'save'])
const { visible, quoteNo, loading, saving, ready, items, total, formatAmount } = toRefs(props)
</script>

<style scoped>
.quote-items-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; color: #606266; }
.quote-items-toolbar strong { color: #303133; font-size: 16px; }
</style>
