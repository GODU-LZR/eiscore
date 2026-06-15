<template>
  <div
    v-if="!isPinned"
    class="row-height-handle"
    title="拖动这里或拖动行底边调整行高，双击恢复默认"
    @mousedown.stop.prevent="startResize"
    @dblclick.stop.prevent="resetHeight"
  >
    <span class="handle-pill">
      <span class="handle-grip" aria-hidden="true"></span>
    </span>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed } from 'vue'

const props = defineProps(['params'])
const isPinned = computed(() => !!props.params?.node?.rowPinned)

const resetHeight = () => {
  if (isPinned.value) return
  const parent = props.params?.context?.componentParent
  parent?.resetRowHeight?.(props.params)
}

const startResize = (event) => {
  if (isPinned.value) return
  if (event?.detail >= 2) {
    event?.stopImmediatePropagation?.()
    resetHeight()
    return
  }
  const parent = props.params?.context?.componentParent
  parent?.startRowHeightResize?.(props.params, event)
}
</script>

<style scoped>
.row-height-handle {
  width: 100%;
  height: 100%;
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  user-select: none;
  touch-action: none;
}

.handle-pill {
  width: 18px;
  min-height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d8dee8;
  border-radius: 5px;
  background: linear-gradient(180deg, #ffffff 0%, #f3f6fb 100%);
  color: #606266;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: border-color 0.12s ease, color 0.12s ease, background-color 0.12s ease;
}

.handle-grip {
  width: 4px;
  height: 12px;
  border-radius: 999px;
  background-image: radial-gradient(circle, currentColor 1px, transparent 1.5px);
  background-size: 4px 4px;
  opacity: 0.72;
}

.row-height-handle:hover .handle-pill {
  background: #ecf5ff;
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
</style>
