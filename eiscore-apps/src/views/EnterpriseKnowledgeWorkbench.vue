<template>
  <main class="knowledge-harness-host" aria-label="企业知识库 DeepSeekHardness">
    <iframe
      v-if="harnessReady && !harnessFailed"
      class="knowledge-harness-frame"
      src="/harness-knowledge-embed/#digital-twin"
      title="企业知识库 DeepSeekHardness"
      allow="clipboard-read; clipboard-write"
      @error="handleHarnessError"
    ></iframe>
    <div v-else class="knowledge-harness-status" role="status" aria-live="polite">
      <el-icon v-if="!harnessFailed" class="is-loading"><Loading /></el-icon>
      <el-icon v-else><Warning /></el-icon>
      <span>{{ harnessFailed ? '认证或 Harness 服务连接失败，请刷新后重试。' : '正在建立 Harness 会话…' }}</span>
      <el-button v-if="harnessFailed" size="small" @click="prepareHarnessFrame">重新连接</el-button>
    </div>
  </main>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getAuthHeader } from '@/utils/auth'
import { prepareBusinessHarnessAuth } from '../../../eiscore-base/src/services/business-harness-auth.js'

const harnessReady = ref(false)
const harnessFailed = ref(false)
let disposed = false
let harnessRequestId = 0

const KNOWLEDGE_HARNESS_WEB_URL = '/harness-knowledge-embed/'
const KNOWLEDGE_HARNESS_AUTH_API_PREFIX = '/harness-knowledge-embed-api'

const prepareHarnessFrame = async () => {
  const requestId = ++harnessRequestId
  const authorization = getAuthHeader().Authorization || ''
  const isCurrent = () => !disposed
    && requestId === harnessRequestId
    && !!authorization
    && getAuthHeader().Authorization === authorization
  harnessFailed.value = false
  harnessReady.value = false
  const ready = await prepareBusinessHarnessAuth({
    harnessWebUrl: KNOWLEDGE_HARNESS_WEB_URL,
    authApiPrefix: KNOWLEDGE_HARNESS_AUTH_API_PREFIX,
    authorization
  }, isCurrent)
  if (!isCurrent()) return
  if (!ready) {
    harnessFailed.value = true
    return
  }
  harnessReady.value = true
}

const handleHarnessError = () => {
  harnessReady.value = false
  harnessFailed.value = true
}

onMounted(() => { void prepareHarnessFrame() })

onBeforeUnmount(() => {
  disposed = true
  harnessRequestId += 1
})
</script>

<style scoped>
.knowledge-harness-host {
  width: 100%;
  min-height: 100%;
  height: 100%;
  overflow: hidden;
  background: #fff;
}
.knowledge-harness-frame {
  display: block;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 32px);
  border: 0;
  background: #fff;
}
.knowledge-harness-status {
  display: flex;
  min-height: calc(100vh - 32px);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #6c7c83;
  font-size: 13px;
}
.knowledge-harness-status .el-icon { font-size: 22px; color: #14766e; }
.knowledge-harness-status .el-icon.is-loading { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
