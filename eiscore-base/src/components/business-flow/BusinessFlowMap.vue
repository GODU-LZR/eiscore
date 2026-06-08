<template>
  <div class="business-flow">
    <div class="flow-board">
      <div class="flow-canvas">
        <svg class="flow-lines" viewBox="0 0 1500 850" aria-hidden="true">
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <path v-for="line in flowLines" :key="line.key" class="flow-line" :d="line.path" />
        </svg>

        <button
          v-for="node in flowNodes"
          :key="node.key"
          type="button"
          :disabled="node.disabled"
          :title="node.disabled ? '功能待实现' : node.label"
          class="flow-node"
          :class="[
            `node-${node.variant || 'primary'}`,
            { clickable: !!node.route && !node.disabled, disabled: node.disabled }
          ]"
          :style="getNodeStyle(node)"
          @click="openNode(node)"
        >
          <span>{{ node.label }}</span>
          <em v-if="node.disabled">待实现</em>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { useRouter } from 'vue-router'

const router = useRouter()

const flowNodes = [
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

const flowLines = [
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

const getNodeStyle = (node) => ({
  left: `${node.x}px`,
  top: `${node.y}px`,
  width: `${node.w}px`,
  height: `${node.h}px`
})

const openNode = (node) => {
  if (node.disabled || !node.route) return
  router.push(node.route)
}
</script>

<style scoped lang="scss">
.business-flow {
  --flow-primary: var(--el-color-primary, #409eff);
  --flow-primary-dark: var(--el-color-primary-dark-2, #337ecc);
  --flow-primary-light: var(--el-color-primary-light-3, #79bbff);
  --flow-primary-soft: var(--el-color-primary-light-8, #d9ecff);
  --flow-primary-faint: var(--el-color-primary-light-9, #ecf5ff);
  --flow-node-shadow: color-mix(in srgb, var(--flow-primary) 22%, transparent);
  --flow-node-shadow-hover: color-mix(in srgb, var(--flow-primary) 34%, transparent);
  height: 100%;
  min-height: 0;
  background: var(--page-bg-tint, var(--flow-primary-faint));
  overflow: auto;
  padding: 14px;
}

.flow-board {
  width: 1060px;
  height: 642px;
  margin: 0 auto;
  border-radius: 28px;
  background: var(--card-bg-tint, #fff);
  box-shadow: inset 0 0 0 1px var(--flow-primary-soft);
  padding: 24px;
}

.flow-canvas {
  position: relative;
  width: 1500px;
  height: 850px;
  transform: scale(0.67);
  transform-origin: left top;
}

.flow-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;

  marker path {
    fill: var(--flow-primary);
  }
}

.flow-line {
  fill: none;
  stroke: var(--flow-primary);
  stroke-width: 3.5;
  marker-end: url(#flow-arrow);
}

.flow-node {
  position: absolute;
  z-index: 2;
  border: 0;
  border-radius: 10px;
  background: var(--flow-primary);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0;
  box-shadow: 0 10px 24px var(--flow-node-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  cursor: default;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;

  span,
  em {
    position: relative;
    z-index: 2;
    font-style: normal;
  }

  em {
    height: 18px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.82);
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    line-height: 18px;
    padding: 0 8px;
  }
}

.flow-node.clickable {
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    background: var(--flow-primary-dark);
    box-shadow: 0 16px 30px var(--flow-node-shadow-hover);
  }
}

.node-start {
  border-radius: 35px;
  background: var(--flow-primary-dark);
}

.node-light {
  background: var(--flow-primary-light);
}

.node-outline {
  background: #111827;
  color: #fff;
  border: 0;
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.18);
}

.flow-node.disabled {
  cursor: not-allowed;
  color: #f8fafc;
  background: #94a3b8;
  border-color: #94a3b8;
  box-shadow: none;
  opacity: 1;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: inherit;
    background: rgba(71, 85, 105, 0.48);
    pointer-events: none;
  }
}

.flow-node.disabled.node-outline {
  color: #64748b;
  background: #f8fafc;
  border-color: #94a3b8;
}
</style>
