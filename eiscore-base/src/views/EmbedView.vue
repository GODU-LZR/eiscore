<template>
  <main class="embed-view" :data-embed-feature="feature">
    <DigitalTwinView v-if="feature === 'digital-twin'" />
    <AiCopilot v-else mode="enterprise" :auto-open="true" />
  </main>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineAsyncComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const feature = route.params.feature === 'smart-bi' ? 'smart-bi' : 'digital-twin'
const DigitalTwinView = defineAsyncComponent(() => import('./DigitalTwinView.vue'))
const AiCopilot = defineAsyncComponent(() => import('@/components/AiCopilot.vue'))

onMounted(() => {
  // The host only needs lifecycle information; auth and business data remain inside EISCore.
  window.parent?.postMessage({ source: 'eiscore', type: 'ready', feature }, '*')
})
</script>

<style scoped>
.embed-view {
  width: 100%;
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  background: var(--el-bg-color-page, #f5f7fa);
}

.embed-view :deep(.ai-copilot-container),
.embed-view :deep(.ai-window),
.embed-view :deep(.enterprise-wrapper) {
  width: 100%;
  height: 100%;
}
</style>
