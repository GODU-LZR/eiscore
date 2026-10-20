<template>
  <section class="business-flow" aria-labelledby="sales-flow-title">
    <header class="flow-heading">
      <h2 id="sales-flow-title">惠众消防销售业务流程</h2>
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
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { hasPerm } from '../../utils/permission'
import { isAppVisible, useDisplayVisibility } from '@shared/eis-display-control'

const emit = defineEmits(['navigate'])
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
    module: 'materials', perm: 'app:mms_inventory',
    route: '/materials/inventory-stock-out?ioType=销售出库'
  },
  salesNode('receivables', '应收与账期', '核对应收余额与到期日', 'app:sales_receivable'),
  salesNode('payments', '回款核销', '登记到账与核销状态', 'app:sales_payment')
]

const salesPermission = (permission) => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    const role = String(info.app_role || info.appRole || info.role || '').toLowerCase()
    const permissions = Array.isArray(info.permissions) ? info.permissions : []
    return role === 'super_admin' || role === 'sales_manager' || permissions.includes('module:sales') || permissions.includes(permission)
  } catch {
    return false
  }
}

const unavailableReason = (node) => {
  if (!node.route || !node.perm) return '入口待配置'
  if (!isAppVisible(visibility.value, node.module, node.key)) return '入口已隐藏'
  const allowed = node.module === 'sales'
    ? salesPermission(node.perm)
    : hasPerm('module:mms') && hasPerm(node.perm)
  return allowed ? '' : '无访问权限'
}

const openNode = (node) => {
  if (!unavailableReason(node)) emit('navigate', node.route)
}
</script>

<style scoped>
.business-flow {
  container-type: inline-size;
  color: #253342;
  padding: 22px;
  border: 1px solid #d8dee6;
  border-radius: 6px;
  background: #fff;
}

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
