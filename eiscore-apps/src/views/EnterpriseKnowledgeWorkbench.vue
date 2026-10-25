<template>
  <main class="knowledge-workbench">
    <header class="knowledge-header">
      <div class="knowledge-heading">
        <button type="button" class="back-button" aria-label="返回应用中心" title="返回应用中心" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div>
          <p class="knowledge-eyebrow">企业知识库</p>
          <h1>知识网络工作台</h1>
          <p class="knowledge-subtitle">通过知识库专属 DeepSeek Harness 进行对话。</p>
        </div>
      </div>
    </header>

    <section class="knowledge-section workspace-section" aria-label="企业知识库工作区">
      <nav class="mobile-workspace-tabs" aria-label="工作区视图">
        <button type="button" :aria-pressed="mobileView === 'files'" @click="mobileView = 'files'">文件</button>
        <button type="button" :aria-pressed="mobileView === 'chat'" @click="mobileView = 'chat'">对话</button>
        <button type="button" :aria-pressed="mobileView === 'ontology'" @click="mobileView = 'ontology'">本体</button>
      </nav>
      <KnowledgeFilesPanel
        :class="['workspace-files', { 'mobile-hidden': mobileView !== 'files' }]"
        :selected-file="selectedKnowledgeFile"
        @select-file="handleKnowledgeFileSelect"
        @file-updated="handleKnowledgeFileUpdate"
      />
      <section :class="['harness-column', { 'mobile-hidden': mobileView !== 'chat' }]" aria-labelledby="knowledge-harness-title">
        <div class="section-heading">
          <div>
            <h2 id="knowledge-harness-title">DeepSeek Harness 对话</h2>
            <p>当前用户的知识文件与本体范围通过受控接口提供给知识库助手。</p>
          </div>
          <el-tag :type="harnessConnected ? 'success' : (harnessFailed ? 'danger' : 'warning')" effect="plain">
            {{ harnessConnected ? '已连接' : (harnessFailed ? '连接失败' : '连接中') }}
          </el-tag>
        </div>
        <div class="harness-frame-wrap">
          <iframe
            v-if="harnessReady && !harnessFailed"
            class="harness-frame"
            src="/harness-knowledge-embed/#digital-twin"
            title="DeepSeek Harness 企业知识库对话"
            allow="clipboard-read; clipboard-write"
            @error="handleHarnessError"
          ></iframe>
          <div v-else class="harness-status" role="status" aria-live="polite">
            <el-icon v-if="!harnessFailed" class="is-loading"><Loading /></el-icon>
            <el-icon v-else><Warning /></el-icon>
            <span>{{ harnessFailed ? '认证或 Harness 服务连接失败，请刷新后重试。' : '正在建立 Harness 会话…' }}</span>
            <el-button v-if="harnessFailed" size="small" @click="prepareHarnessFrame">重新连接</el-button>
          </div>
        </div>
      </section>
      <KnowledgeOntologyPanel
        :class="['workspace-ontology', { 'mobile-hidden': mobileView !== 'ontology' }]"
        :selected-file="selectedKnowledgeFile"
        @file-updated="handleKnowledgeFileUpdate"
      />
    </section>
  </main>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAuthHeader } from '@/utils/auth'
import { prepareBusinessHarnessAuth } from '../../../eiscore-base/src/services/business-harness-auth.js'
import KnowledgeFilesPanel from '@/components/KnowledgeFilesPanel.vue'
import KnowledgeOntologyPanel from '@/components/KnowledgeOntologyPanel.vue'

const router = useRouter()
const harnessReady = ref(false)
const harnessFailed = ref(false)
const harnessConnected = computed(() => harnessReady.value && !harnessFailed.value)
const mobileView = ref('chat')
const selectedKnowledgeFile = ref(null)
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

const handleKnowledgeFileSelect = (file) => {
  selectedKnowledgeFile.value = file || null
}

const handleKnowledgeFileUpdate = (file) => {
  if (!file?.id || selectedKnowledgeFile.value?.id !== file.id) return
  selectedKnowledgeFile.value = file
}

const goBack = () => router.push('/')

onMounted(() => {
  void prepareHarnessFrame()
})

onBeforeUnmount(() => {
  disposed = true
  harnessRequestId += 1
})
</script>

<style scoped>
.knowledge-workbench {
  min-height: 100vh;
  padding: 16px;
  color: #24343b;
  background: #f4f7f8;
  box-sizing: border-box;
}
.knowledge-header,
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.knowledge-header {
  margin: 0 auto 18px;
}
.knowledge-heading { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.back-button {
  display: inline-flex;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-top: 3px;
  padding: 0;
  border: 1px solid #cdd9dc;
  border-radius: 5px;
  color: #31515a;
  background: #fff;
  cursor: pointer;
}
.back-button:hover { color: #146b64; border-color: #8bbdb7; background: #f2fbf9; }
.knowledge-eyebrow { margin: 0 0 4px; color: #14766e; font-size: 12px; font-weight: 700; letter-spacing: .08em; }
h1 { margin: 0; color: #20353d; font-size: 24px; line-height: 1.25; }
.knowledge-subtitle { max-width: 720px; margin: 7px 0 0; color: #63757c; font-size: 13px; line-height: 1.6; }
.knowledge-section { margin: 0 auto 18px; border: 1px solid #dce5e7; background: #fff; box-shadow: 0 3px 12px #29444d0a; }
.section-heading { padding: 15px 16px 12px; border-bottom: 1px solid #e5ecee; }
h2 { margin: 0; color: #2a414a; font-size: 16px; line-height: 1.4; }
.section-heading p { margin: 4px 0 0; color: #788990; font-size: 12px; line-height: 1.5; }
.workspace-section { display: grid; grid-template-columns: minmax(220px, 260px) minmax(440px, 1fr) minmax(260px, 320px); min-height: clamp(600px, 75vh, 900px); overflow: hidden; }
.mobile-workspace-tabs { display: none; }
.workspace-files, .workspace-ontology { min-height: clamp(600px, 75vh, 900px); }
.harness-column { min-width: 0; border-right: 1px solid #e5ecee; border-left: 1px solid #e5ecee; }
.harness-frame-wrap { min-height: clamp(540px, 68vh, 820px); background: #f7fafb; }
.harness-frame { display: block; width: 100%; height: clamp(540px, 68vh, 820px); border: 0; }
.harness-status { display: flex; min-height: clamp(540px, 68vh, 820px); flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #6c7c83; font-size: 13px; }
.harness-status .el-icon { font-size: 22px; color: #14766e; }
.harness-status .el-icon.is-loading { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 960px) {
  .knowledge-workbench { padding: 12px; }
  .knowledge-header, .section-heading { flex-direction: column; }
  h1 { font-size: 21px; }
  .workspace-section { display: block; min-height: 0; overflow: visible; }
  .mobile-workspace-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 5px; border-bottom: 1px solid #e5ecee; background: #f7fafb; }
  .mobile-workspace-tabs button { min-height: 36px; border: 1px solid transparent; border-radius: 4px; color: #60747b; background: transparent; cursor: pointer; }
  .mobile-workspace-tabs button[aria-pressed="true"] { border-color: #b9d8d4; color: #146b64; background: #e9f5f3; font-weight: 600; }
  .mobile-hidden { display: none !important; }
  .workspace-files, .workspace-ontology { min-height: clamp(520px, 72vh, 760px); }
  .harness-column { border: 0; }
  .harness-frame, .harness-status, .harness-frame-wrap { min-height: clamp(520px, 76vh, 720px); height: clamp(520px, 76vh, 720px); }
}
</style>
