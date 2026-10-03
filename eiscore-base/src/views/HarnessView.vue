<template>
  <main class="harness-view" :aria-busy="!harnessReady && !harnessFailed">
    <iframe
      v-if="harnessReady && !harnessFailed"
      class="harness-frame"
      src="/harness-embed/#digital-twin"
      title="DeepSeek Harness 数字分身"
    ></iframe>
    <div v-else class="harness-status" role="status">
      <span v-if="!harnessFailed">正在建立 Harness 会话</span>
      <span v-else>Harness 认证交接失败，请重新登录</span>
    </div>
  </main>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { onMounted, ref } from 'vue'
import { getAuthHeader } from '@/utils/auth'
import { prepareHarnessAuth } from '@/services/harness-auth-client'

const harnessReady = ref(false)
const harnessFailed = ref(false)

onMounted(async () => {
  const ready = await prepareHarnessAuth({
    harnessWebUrl: '/harness-embed/',
    authorization: getAuthHeader().Authorization || ''
  })
  harnessReady.value = ready
  harnessFailed.value = !ready
})
</script>

<style scoped>
.harness-view,
.harness-frame {
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  border: 0;
  overflow: hidden;
  display: block;
}

.harness-status {
  display: grid;
  min-height: 100vh;
  place-items: center;
  color: var(--el-text-color-secondary, #64748b);
  background: var(--el-bg-color-page, #f5f7fa);
}
</style>
