<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="620px"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
    @closed="emit('closed')"
  >
    <el-form v-if="mode === 'order'" class="quick-form" label-width="96px" :model="orderForm">
      <el-form-item label="客户">
        <el-select v-model="orderForm.customer_id" filterable clearable :loading="loading" placeholder="选择客户" style="width: 100%;">
          <el-option v-for="customer in quickCustomers" :key="customer.id" :label="`${customer.name} / ${customer.customer_no}`" :value="customer.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="产品名称"><el-input v-model="orderForm.product_name" placeholder="请输入产品名称" /></el-form-item>
      <el-form-item label="BOM成品">
        <el-select v-model="orderForm.product_material_id" filterable clearable :loading="loading" placeholder="选择后可进入BOM-MRP和生产计划" style="width: 100%;">
          <el-option v-for="material in quickBomProducts" :key="material.parent_material_id" :label="`${material.parent_material_code} / ${material.parent_material_name}`" :value="material.parent_material_id" />
        </el-select>
      </el-form-item>
      <div class="quick-form-row">
        <el-form-item label="数量"><el-input-number v-model="orderForm.quantity" :min="0" :precision="2" controls-position="right" /></el-form-item>
        <el-form-item label="单位"><el-input v-model="orderForm.unit" placeholder="箱" /></el-form-item>
        <el-form-item label="单价"><el-input-number v-model="orderForm.unit_price" :min="0" :precision="2" controls-position="right" /></el-form-item>
      </div>
      <div class="quick-form-row">
        <el-form-item label="订单日期"><el-date-picker v-model="orderForm.order_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" /></el-form-item>
        <el-form-item label="交付日期"><el-date-picker v-model="orderForm.delivery_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" /></el-form-item>
      </div>
      <div class="quick-form-row">
        <el-form-item label="订单状态"><el-select v-model="orderForm.order_status" style="width: 100%;"><el-option v-for="status in orderStatusOptions" :key="status" :label="status" :value="status" /></el-select></el-form-item>
        <el-form-item label="负责人"><el-input v-model="orderForm.owner_name" placeholder="销售负责人" /></el-form-item>
      </div>
      <div class="amount-preview"><span>订单金额</span><strong>{{ formatAmount(orderTotalAmount) }}</strong></div>
    </el-form>

    <el-form v-else-if="mode === 'payment'" class="quick-form" label-width="96px" :model="paymentForm">
      <el-form-item label="订单">
        <el-select v-model="paymentForm.order_id" filterable clearable :loading="loading" placeholder="选择订单" style="width: 100%;">
          <el-option v-for="order in quickOrders" :key="order.id" :label="`${order.order_no} / ${order.customer_name} / ${formatAmount(order.total_amount)}`" :value="order.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="应收计划">
        <el-select v-model="paymentForm.schedule_id" filterable clearable :loading="loading" placeholder="可选：关联未收清的应收节点" style="width: 100%;">
          <el-option v-for="schedule in availableQuickReceivables" :key="schedule.id" :label="`${schedule.schedule_no} / ${schedule.customer_name} / 到期 ${schedule.due_date} / 余额 ${formatAmount(schedule.outstanding_amount)}`" :value="schedule.id" />
        </el-select>
      </el-form-item>
      <div v-if="selectedQuickReceivable" class="quick-info">
        <div><span>应收计划</span><strong>{{ selectedQuickReceivable.schedule_no }}</strong></div>
        <div><span>客户</span><strong>{{ selectedQuickReceivable.customer_name }}</strong></div>
        <div><span>合同 / 订单</span><strong>{{ selectedQuickReceivable.contract_no || '-' }} / {{ selectedQuickReceivable.order_no || '-' }}</strong></div>
        <div><span>到期日</span><strong>{{ selectedQuickReceivable.due_date }}</strong></div>
        <div><span>计划 / 已收</span><strong>{{ formatAmount(selectedQuickReceivable.planned_amount) }} / {{ formatAmount(selectedQuickReceivable.received_amount) }}</strong></div>
        <div><span>未收余额</span><strong>{{ formatAmount(selectedQuickReceivable.outstanding_amount) }}</strong></div>
      </div>
      <div v-if="selectedQuickOrder" class="quick-info">
        <div><span>客户</span><strong>{{ selectedQuickOrder.customer_name }}</strong></div>
        <div><span>产品</span><strong>{{ selectedQuickOrder.product_name }}</strong></div>
        <div><span>订单金额</span><strong>{{ formatAmount(selectedQuickOrder.total_amount) }}</strong></div>
        <div><span>已回款</span><strong>{{ formatAmount(selectedQuickOrderPaidAmount) }}</strong></div>
        <div><span>未回款</span><strong>{{ formatAmount(selectedQuickOrderRemainAmount) }}</strong></div>
      </div>
      <el-form-item v-else-if="!selectedQuickReceivable" label="客户名称"><el-input v-model="paymentForm.customer_name" placeholder="未选择订单时手工填写客户名称" /></el-form-item>
      <div class="quick-form-row">
        <el-form-item label="回款金额"><el-input-number v-model="paymentForm.amount" :min="0" :precision="2" controls-position="right" /></el-form-item>
        <el-form-item label="回款日期"><el-date-picker v-model="paymentForm.payment_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" /></el-form-item>
      </div>
      <div class="quick-form-row">
        <el-form-item label="回款方式"><el-select v-model="paymentForm.payment_method" style="width: 100%;"><el-option v-for="method in paymentMethodOptions" :key="method" :label="method" :value="method" /></el-select></el-form-item>
        <el-form-item label="核销状态"><el-select v-model="paymentForm.verify_status" style="width: 100%;"><el-option v-for="status in paymentStatusOptions" :key="status" :label="status" :value="status" /></el-select></el-form-item>
      </div>
      <el-form-item label="经办人"><el-input v-model="paymentForm.handler_name" placeholder="经办人" /></el-form-item>
    </el-form>

    <el-form v-else-if="mode === 'opportunity'" class="quick-form" label-width="96px" :model="opportunityForm">
      <el-form-item label="客户">
        <el-select v-model="opportunityForm.customer_id" filterable clearable :loading="loading" placeholder="选择客户" style="width: 100%;">
          <el-option v-for="customer in quickCustomers" :key="customer.id" :label="`${customer.name} / ${customer.customer_no}`" :value="customer.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="商机名称"><el-input v-model="opportunityForm.opportunity_name" placeholder="请输入商机名称" /></el-form-item>
      <div class="quick-form-row">
        <el-form-item label="预计金额"><el-input-number v-model="opportunityForm.expected_amount" :min="0" :precision="2" controls-position="right" /></el-form-item>
        <el-form-item label="预计成交"><el-date-picker v-model="opportunityForm.expected_close_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" /></el-form-item>
      </div>
      <div class="quick-form-row">
        <el-form-item label="阶段"><el-select v-model="opportunityForm.stage" style="width: 100%;"><el-option v-for="stage in opportunityStageOptions" :key="stage" :label="stage" :value="stage" /></el-select></el-form-item>
        <el-form-item label="赢率"><el-input-number v-model="opportunityForm.probability" :min="0" :max="100" :precision="0" controls-position="right" /></el-form-item>
      </div>
      <div class="quick-form-row">
        <el-form-item label="负责人"><el-input v-model="opportunityForm.owner_name" placeholder="销售负责人" /></el-form-item>
        <el-form-item label="下次动作"><el-input v-model="opportunityForm.next_action" placeholder="下一步推进动作" /></el-form-item>
      </div>
      <el-form-item label="备注"><el-input v-model="opportunityForm.remark" type="textarea" :rows="3" placeholder="记录需求、预算、竞争情况和成交阻碍" /></el-form-item>
    </el-form>

    <el-form v-else-if="mode === 'follow'" class="quick-form" label-width="96px" :model="followForm">
      <el-form-item label="客户">
        <el-select v-model="followForm.customer_id" filterable clearable :loading="loading" placeholder="选择客户" style="width: 100%;">
          <el-option v-for="customer in quickCustomers" :key="customer.id" :label="`${customer.name} / ${customer.customer_no}`" :value="customer.id" />
        </el-select>
      </el-form-item>
      <div class="quick-form-row">
        <el-form-item label="跟进日期"><el-date-picker v-model="followForm.follow_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" /></el-form-item>
        <el-form-item label="下次跟进"><el-date-picker v-model="followForm.next_follow_at" type="date" value-format="YYYY-MM-DD" style="width: 100%;" /></el-form-item>
      </div>
      <div class="quick-form-row">
        <el-form-item label="跟进方式"><el-select v-model="followForm.follow_type" style="width: 100%;"><el-option v-for="type in followTypeOptions" :key="type" :label="type" :value="type" /></el-select></el-form-item>
        <el-form-item label="跟进结果"><el-select v-model="followForm.follow_result" style="width: 100%;"><el-option v-for="result in followResultOptions" :key="result" :label="result" :value="result" /></el-select></el-form-item>
      </div>
      <div class="quick-form-row">
        <el-form-item label="联系人"><el-input v-model="followForm.contact_name" placeholder="联系人" /></el-form-item>
        <el-form-item label="负责人"><el-input v-model="followForm.owner_name" placeholder="销售负责人" /></el-form-item>
      </div>
      <el-form-item label="跟进纪要"><el-input v-model="followForm.follow_content" type="textarea" :rows="4" placeholder="记录客户诉求、报价反馈、风险和下一步动作" /></el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="loading || submitting" @click="emit('submit')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { toRefs } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '销售快捷操作' },
  mode: { type: String, default: '' },
  loading: Boolean,
  submitting: Boolean,
  orderForm: { type: Object, required: true },
  paymentForm: { type: Object, required: true },
  opportunityForm: { type: Object, required: true },
  followForm: { type: Object, required: true },
  quickCustomers: { type: Array, default: () => [] },
  quickBomProducts: { type: Array, default: () => [] },
  quickOrders: { type: Array, default: () => [] },
  availableQuickReceivables: { type: Array, default: () => [] },
  selectedQuickReceivable: { type: Object, default: null },
  selectedQuickOrder: { type: Object, default: null },
  selectedQuickOrderPaidAmount: { type: Number, default: 0 },
  selectedQuickOrderRemainAmount: { type: Number, default: 0 },
  orderTotalAmount: { type: Number, default: 0 },
  orderStatusOptions: { type: Array, default: () => [] },
  paymentMethodOptions: { type: Array, default: () => [] },
  paymentStatusOptions: { type: Array, default: () => [] },
  followTypeOptions: { type: Array, default: () => [] },
  followResultOptions: { type: Array, default: () => [] },
  opportunityStageOptions: { type: Array, default: () => [] },
  formatAmount: { type: Function, required: true }
})
const emit = defineEmits(['update:visible', 'submit', 'closed'])
const {
  visible, title, mode, loading, submitting, orderForm, paymentForm, opportunityForm, followForm,
  quickCustomers, quickBomProducts, quickOrders, availableQuickReceivables, selectedQuickReceivable,
  selectedQuickOrder, selectedQuickOrderPaidAmount, selectedQuickOrderRemainAmount, orderTotalAmount,
  orderStatusOptions, paymentMethodOptions, paymentStatusOptions, followTypeOptions, followResultOptions,
  opportunityStageOptions, formatAmount
} = toRefs(props)
</script>

<style scoped>
.quick-form { display: flex; flex-direction: column; gap: 2px; }
.quick-form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 12px; }
.quick-form-row:has(.el-form-item:nth-child(3)) { grid-template-columns: 1fr 120px 1fr; }
.quick-form :deep(.el-input-number) { width: 100%; }
.amount-preview { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid #ebeef5; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #606266; }
.amount-preview strong { font-size: 18px; color: #303133; }
.quick-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: -4px 0 16px 96px; padding: 12px; border: 1px solid #ebeef5; border-radius: 8px; background: #f8fafc; }
.quick-info div { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.quick-info span { font-size: 12px; color: #909399; }
.quick-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #303133; }
@media (max-width: 760px) {
  .quick-form-row, .quick-form-row:has(.el-form-item:nth-child(3)), .quick-info { grid-template-columns: 1fr; }
  .quick-info { margin-left: 0; }
}
</style>
