<template>
  <section v-if="salesWorkbenchFlow" class="business-flow" aria-labelledby="sales-flow-title">
    <header class="flow-heading">
      <h2 id="sales-flow-title">{{ enterpriseConfig.enterprise.displayName }}销售业务流程</h2>
      <p>从客户建档到回款核销，点击业务节点进入办理。</p>
    </header>

    <ol class="flow-board" aria-label="销售业务办理顺序">
      <li
        v-for="(node, index) in flowNodes"
        :key="node.key"
        class="flow-step"
        :class="{ 'flow-step--warehouse': node.module === 'materials' }"
        :style="{ '--column': index < 5 ? index + 1 : 10 - index, '--row': index < 5 ? 1 : 2 }"
      >
        <button
          type="button"
          class="flow-node"
          :disabled="Boolean(unavailableReason(node))"
          :title="unavailableReason(node) || `进入${node.label}`"
          :data-flow-node="node.key"
          @click="openNode(node)"
        >
          <strong>{{ node.label }}</strong>
          <span>{{ node.desc }}</span>
          <small>{{ unavailableReason(node) || (node.module === 'materials' ? '仓库办理' : '销售办理') }}</small>
        </button>
      </li>
    </ol>
    <p class="flow-note">应收计划按合同约定维护；分期或预收款可直接进入回款记录。</p>
  </section>
  <section v-else class="generic-business-flow" aria-label="业务流程">
    <div class="generic-flow-board">
      <div class="generic-flow-canvas">
        <svg class="generic-flow-lines" viewBox="0 0 1500 850" aria-hidden="true">
          <defs>
            <marker id="generic-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <path v-for="line in genericFlowLines" :key="line.key" class="generic-flow-line" :d="line.path" />
        </svg>
        <button
          v-for="node in genericFlowNodes"
          :key="node.key"
          type="button"
          :disabled="node.disabled"
          :title="node.disabled ? '功能待实现' : node.label"
          class="generic-flow-node"
          :class="[
            `node-${node.variant || 'primary'}`,
            { clickable: !!node.route && !node.disabled, disabled: node.disabled }
          ]"
          :style="getGenericNodeStyle(node)"
          @click="openGenericNode(node)"
        >
          <span>{{ node.label }}</span>
          <em v-if="node.disabled">待实现</em>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { hasPerm } from '../../utils/permission'
import { getUserInfo } from '@/utils/auth'
import { getEnterpriseConfig } from '@/platform/enterprise-config'
import { isAppVisible, useDisplayVisibility } from '@shared/eis-display-control'

const emit = defineEmits(['navigate'])
const enterpriseConfig = getEnterpriseConfig(window)
const salesWorkbenchFlow = enterpriseConfig.features?.salesWorkbenchFlow === true
const { visibility } = useDisplayVisibility()

const salesNode = (key, label, desc, perm, route = `/sales/app/${key}`) =>
  ({ key, label, desc, module: 'sales', perm, route })

const flowNodes = [
  salesNode('customers', '客户建档', '客户、联系人与负责人', 'app:sales_customer'),
  salesNode('opportunities', '项目 / 商机', '确认需求与项目阶段', 'app:sales_opportunity'),
  salesNode('follow_ups', '客户跟进', '沟通纪要与下次行动', 'app:sales_follow_up'),
  salesNode('quotes', '销售报价', '报价版本、金额与审批', 'app:sales_quote'),
  salesNode('contracts', '销售合同', '合同签订与账期条件', 'app:sales_contract'),
  salesNode('orders', '销售订单', '产品明细与交付日期', 'app:sales_order'),
  salesNode('shipment_requests', '出货申请', '从销售订单发起出货', 'app:sales_order'),
  {
    key: 'sales-stock-out', label: '销售出库', desc: '核对订单、批次与数量',
    visibilityKey: 'inventory-stock-out',
    module: 'materials', perm: 'app:mms_inventory',
    route: '/materials/inventory-stock-out?ioType=销售出库'
  },
  salesNode('receivables', '应收与账期', '核对应收余额与到期日', 'app:sales_receivable'),
  salesNode('payments', '回款核销', '登记到账与核销状态', 'app:sales_payment')
]

const genericFlowNodes = [
  { key: 'start', label: '开始', x: 105, y: 78, w: 150, h: 70, variant: 'start' },
  { key: 'sales_order', label: '销售订单', x: 345, y: 78, w: 195, h: 70, route: '/sales/app/orders' },
  { key: 'bom', label: 'BOM', x: 585, y: 78, w: 195, h: 70, route: '/production/app/bom_list' },
  { key: 'process_template', label: '工艺模板', x: 825, y: 78, w: 195, h: 70, route: '/production/bom' },
  { key: 'equipment_check', label: '设备巡检', x: 1065, y: 78, w: 195, h: 70, route: '/equipment/app/equipment_patrols' },
  { key: 'purchase_order', label: '采购订单', x: 105, y: 220, w: 195, h: 70, route: '/purchase/app/orders' },
  { key: 'production_order', label: '生产订单', x: 345, y: 220, w: 195, h: 70, route: '/production/app/plans' },
  { key: 'inspection_order', label: '检验单', x: 825, y: 220, w: 195, h: 70, route: '/quality/app/inspection_orders' },
  { key: 'shipment_request', label: '销售出货申请', x: 1065, y: 220, w: 195, h: 70, route: '/sales/app/shipment_requests' },
  { key: 'purchase_inbound', label: '采购入库', x: 105, y: 360, w: 195, h: 70, route: '/materials/inventory-stock-in?ioType=采购入库' },
  { key: 'production_materials', label: '生产订单用料清单', x: 345, y: 360, w: 195, h: 70, route: '/production/app/work_order_items' },
  { key: 'work_order', label: '生产工单', x: 585, y: 360, w: 195, h: 70, route: '/production/app/work_orders' },
  { key: 'production_inspection', label: '生产检验', x: 825, y: 360, w: 195, h: 70, variant: 'light', route: '/quality/app/production_inspections' },
  { key: 'shipment_order', label: '销售出库单', x: 1065, y: 360, w: 195, h: 70, route: '/materials/inventory-stock-out?ioType=销售出库' },
  { key: 'purchase_inventory', label: '库存信息', x: 105, y: 500, w: 195, h: 70, variant: 'outline', route: '/materials/inventory-current' },
  { key: 'picking_order', label: '生产领料单', x: 345, y: 500, w: 195, h: 70, route: '/materials/inventory-stock-out?ioType=生产领料' },
  { key: 'report_order', label: '订单/工单报工', x: 585, y: 500, w: 195, h: 70, variant: 'light', route: '/production/app/work_orders' },
  { key: 'sales_inventory', label: '库存信息', x: 1065, y: 500, w: 195, h: 70, variant: 'outline', route: '/materials/inventory-current' },
  { key: 'material_inventory', label: '库存信息', x: 345, y: 640, w: 195, h: 70, variant: 'outline', route: '/materials/inventory-current' },
  { key: 'production_inbound', label: '生产入库单', x: 585, y: 640, w: 195, h: 70, route: '/materials/inventory-stock-in?ioType=生产入库' },
  { key: 'finished_inventory', label: '库存信息', x: 585, y: 780, w: 195, h: 70, variant: 'outline', route: '/materials/inventory-current' }
]

const genericFlowLines = [
  { key: 'start-sales', path: 'M255 113 H345' },
  { key: 'sales-down', path: 'M442 148 V178 H200 V220' },
  { key: 'sales-production', path: 'M442 148 V220' },
  { key: 'sales-branch', path: 'M442 178 H920 V220' },
  { key: 'sales-shipment', path: 'M920 178 H1162 V220' },
  { key: 'purchase-inbound', path: 'M202 290 V360' },
  { key: 'purchase-inventory', path: 'M202 430 V500' },
  { key: 'production-materials', path: 'M442 290 V360' },
  { key: 'production-work-branch', path: 'M442 325 H682 V360' },
  { key: 'materials-picking', path: 'M442 430 V500' },
  { key: 'picking-inventory', path: 'M442 570 V640' },
  { key: 'work-report', path: 'M682 430 V500' },
  { key: 'report-inbound', path: 'M682 570 V640' },
  { key: 'inbound-finished', path: 'M682 710 V780' },
  { key: 'inspection-production', path: 'M922 290 V360' },
  { key: 'shipment-out', path: 'M1162 290 V360' },
  { key: 'shipment-inventory', path: 'M1162 430 V500' }
]

const getRoleValues = () => {
  const info = getUserInfo() || {}
  return [info.app_role, info.appRole, info.role, info.role_code, info.roleCode, info.dbRole, info.db_role]
    .map((value) => String(value || '').trim().toLowerCase())
}

const isPlatformAdmin = () => getRoleValues().some((role) => (
  ['super_admin', 'system_admin', 'admin', '超级管理员'].includes(role)
))

const salesPermission = (permission) => {
  return isPlatformAdmin() || getRoleValues().includes('sales_manager') || hasPerm('module:sales') || hasPerm(permission)
}

const unavailableReason = (node) => {
  if (!node.route || !node.perm) return '入口待配置'
  if (enterpriseConfig.modules?.[node.module] === false) return '模块未启用'
  if (!isAppVisible(visibility.value, node.module, node.visibilityKey || node.key)) return '入口已隐藏'
  if (isPlatformAdmin()) return ''
  const allowed = node.module === 'sales'
    ? salesPermission(node.perm)
    : hasPerm('module:mms') && hasPerm(node.perm)
  return allowed ? '' : '无访问权限'
}

const openNode = (node) => {
  if (!unavailableReason(node)) emit('navigate', node.route)
}

const getGenericNodeStyle = (node) => ({
  left: `${node.x}px`,
  top: `${node.y}px`,
  width: `${node.w}px`,
  height: `${node.h}px`
})

const openGenericNode = (node) => {
  if (!node.disabled && node.route) emit('navigate', node.route)
}
</script>

<style scoped>
.generic-business-flow {
  --flow-primary: var(--el-color-primary, #409eff);
  --flow-primary-dark: var(--el-color-primary-dark-2, #337ecc);
  --flow-primary-light: var(--el-color-primary-light-3, #79bbff);
  --flow-primary-soft: var(--el-color-primary-light-8, #d9ecff);
  --flow-primary-faint: var(--el-color-primary-light-9, #ecf5ff);
  height: 100%;
  min-height: 0;
  background: var(--page-bg-tint, var(--flow-primary-faint));
  overflow: auto;
  padding: 14px;
}
.generic-flow-board { width: 1060px; height: 642px; margin: 0 auto; border-radius: 28px; background: var(--card-bg-tint, #fff); box-shadow: inset 0 0 0 1px var(--flow-primary-soft); padding: 24px; }
.generic-flow-canvas { position: relative; width: 1500px; height: 850px; transform: scale(0.67); transform-origin: left top; }
.generic-flow-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.generic-flow-lines marker path { fill: var(--flow-primary); }
.generic-flow-line { fill: none; stroke: var(--flow-primary); stroke-width: 3.5; marker-end: url(#generic-flow-arrow); }
.generic-flow-node { position: absolute; z-index: 2; border: 0; border-radius: 10px; background: var(--flow-primary); color: #fff; font-size: 20px; font-weight: 700; letter-spacing: 0; box-shadow: 0 10px 24px color-mix(in srgb, var(--flow-primary) 22%, transparent); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 4px; cursor: default; transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease; }
.generic-flow-node span, .generic-flow-node em { position: relative; z-index: 2; font-style: normal; }
.generic-flow-node em { height: 18px; border-radius: 9px; background: rgba(255, 255, 255, 0.82); color: #64748b; font-size: 12px; font-weight: 700; line-height: 18px; padding: 0 8px; }
.generic-flow-node.clickable { cursor: pointer; }
.generic-flow-node.clickable:hover { transform: translateY(-2px); background: var(--flow-primary-dark); box-shadow: 0 16px 30px color-mix(in srgb, var(--flow-primary) 34%, transparent); }
.generic-flow-node.node-start { border-radius: 35px; background: var(--flow-primary-dark); }
.generic-flow-node.node-light { background: var(--flow-primary-light); }
.generic-flow-node.node-outline { background: #111827; color: #fff; border: 0; box-shadow: 0 10px 24px rgba(17, 24, 39, 0.18); }
.generic-flow-node.disabled { cursor: not-allowed; color: #f8fafc; background: #94a3b8; border-color: #94a3b8; box-shadow: none; opacity: 1; }
.generic-flow-node.disabled::after { content: ""; position: absolute; inset: 0; z-index: 1; border-radius: inherit; background: rgba(71, 85, 105, 0.48); pointer-events: none; }
.generic-flow-node.disabled.node-outline { color: #64748b; background: #f8fafc; border-color: #94a3b8; }
.business-flow { container-type: inline-size; color: #253342; padding: 22px; border: 1px solid #d8dee6; border-radius: 6px; background: #fff; }
.flow-heading h2 { margin: 0; font-size: 18px; font-weight: 650; line-height: 1.4; }
.flow-heading p, .flow-note { margin: 7px 0 0; color: #647282; font-size: 12px; line-height: 1.6; }
.flow-board { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 36px 26px; margin: 24px 0 18px; padding: 0; list-style: none; }
.flow-step { position: relative; grid-column: var(--column); grid-row: var(--row); min-width: 0; }
.flow-step:not(:last-child)::after { content: ''; position: absolute; top: 50%; left: 100%; width: 26px; height: 10px; background: #8295a7; clip-path: polygon(0 42%, 70% 42%, 70% 0, 100% 50%, 70% 100%, 70% 58%, 0 58%); transform: translateY(-50%); }
.flow-step:nth-child(5)::after { top: 100%; left: 50%; width: 10px; height: 36px; clip-path: polygon(42% 0, 58% 0, 58% 78%, 100% 78%, 50% 100%, 0 78%, 42% 78%); transform: translateX(-50%); }
.flow-step:nth-child(n + 6):not(:last-child)::after { left: auto; right: 100%; transform: translateY(-50%) rotate(180deg); }
.flow-node { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; min-height: 112px; padding: 14px 12px; border: 1px solid #aac2d4; border-top: 3px solid #2f6f9f; border-radius: 4px; background: #f5f9fc; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.flow-node strong { font-size: 14px; font-weight: 650; line-height: 1.4; white-space: nowrap; }
.flow-node span, .flow-node small { color: #586d7e; font-size: 12px; line-height: 1.5; }
.flow-node small { margin-top: auto; font-size: 11px; }
.flow-node:hover:enabled { border-color: #2f6f9f; background: #eaf2f8; }
.flow-node:focus-visible { outline: 2px solid #2f6f9f; outline-offset: 3px; }
.flow-step--warehouse .flow-node { border-top-color: #527362; background: #f4f8f5; }
.flow-node:disabled { border-color: #d8dee6; background: #f7f8f9; color: #687684; cursor: not-allowed; }
.flow-note { padding-top: 12px; border-top: 1px solid #e5e9ee; }
@container (max-width: 740px) {
  .flow-board { grid-template-columns: 1fr; gap: 22px; margin-top: 18px; }
  .flow-step { grid-column: auto; grid-row: auto; }
  .flow-step:not(:last-child)::after, .flow-step:nth-child(n + 6):not(:last-child)::after { top: 100%; left: 24px; right: auto; width: 10px; height: 22px; clip-path: polygon(42% 0, 58% 0, 58% 65%, 100% 65%, 50% 100%, 0 65%, 42% 65%); transform: none; }
  .flow-node { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; min-height: 70px; padding: 10px 12px; }
  .flow-node span { grid-column: 1; }
  .flow-node small { grid-column: 2; grid-row: 1 / 3; align-self: center; margin: 0; }
}
@media (max-width: 760px) { .business-flow { padding: 16px; } .flow-heading h2 { font-size: 17px; } }
</style>
