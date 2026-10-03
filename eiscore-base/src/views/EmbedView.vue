<template>
  <main class="embed-view" :data-embed-feature="feature">
    <iframe v-if="harnessReady && !harnessFailed" class="harness-frame" :src="frameUrl" :title="feature === 'smart-bi' ? 'DeepSeek Harness 智能 BI' : 'DeepSeek Harness 数字分身'"></iframe>
    <div v-else class="harness-status" role="status">
      {{ harnessFailed ? 'DeepSeek Harness 认证失败，请重新登录' : '正在建立 Harness 会话' }}
    </div>
  </main>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getAuthHeader } from '@/utils/auth'
import { prepareHarnessAuth } from '@/services/harness-auth-client'

const route = useRoute()
const feature = route.params.feature === 'smart-bi' ? 'smart-bi' : 'digital-twin'
const frameUrl = computed(() => `/harness-embed/#${feature}`)
const harnessReady = ref(false)
const harnessFailed = ref(false)

onMounted(async () => {
  harnessReady.value = await prepareHarnessAuth({
    harnessWebUrl: '/harness-embed/',
    authorization: getAuthHeader().Authorization || ''
  })
  harnessFailed.value = !harnessReady.value
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
