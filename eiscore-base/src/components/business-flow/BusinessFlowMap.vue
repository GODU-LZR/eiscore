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
  { key: 'customer', label: '客户', x: 80, y: 110, w: 195, h: 70, variant: 'start', route: '/sales/app/customers' },
  { key: 'opportunity', label: '销售商机', x: 420, y: 110, w: 195, h: 70, route: '/sales/app/opportunities' },
  { key: 'quote', label: '销售报价', x: 760, y: 110, w: 195, h: 70, route: '/sales/app/quotes' },
  { key: 'contract', label: '销售合同', x: 1100, y: 110, w: 195, h: 70, route: '/sales/app/contracts' },
  { key: 'order', label: '销售订单', x: 420, y: 340, w: 195, h: 70, route: '/sales/app/orders' },
  { key: 'receivable', label: '应收回款', x: 760, y: 340, w: 195, h: 70, variant: 'outline', route: '/sales/app/receivables' }
]

const flowLines = [
  { key: 'customer-opportunity', path: 'M275 145 H420' },
  { key: 'opportunity-quote', path: 'M615 145 H760' },
  { key: 'quote-contract', path: 'M955 145 H1100' },
  { key: 'contract-order', path: 'M1198 180 V275 H518 V340' },
  { key: 'order-receivable', path: 'M615 375 H760' }
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
