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
          <p class="knowledge-subtitle">在三维本体网络中浏览企业语义，并在同一工作区继续向 DeepSeek Harness 提问。</p>
        </div>
      </div>
      <div class="knowledge-actions">
        <el-tag effect="plain">{{ graph.nodes.length }} 个节点</el-tag>
        <el-tag effect="plain">{{ graph.edges.length }} 条关系</el-tag>
        <el-button :loading="loading" @click="loadRelations">
          <el-icon><Refresh /></el-icon>
          刷新图谱
        </el-button>
      </div>
    </header>

    <section class="knowledge-section brain-section" aria-labelledby="knowledge-brain-title">
      <div class="section-heading">
        <div>
          <h2 id="knowledge-brain-title">三维大脑网络图谱</h2>
          <p>默认显示已接入的本体关系，可按业务域聚焦。</p>
        </div>
        <label class="domain-filter">
          <span>业务域</span>
          <select v-model="brainDomain" aria-label="筛选业务域">
            <option value="">全部业务域</option>
            <option v-for="domain in graph.domains" :key="domain.key" :value="domain.key">{{ domain.label }}</option>
          </select>
        </label>
      </div>
      <div class="brain-frame">
        <OntologyBrainGraph
          :graph="graph"
          :loading="loading"
          :error="relationError"
          :active="true"
        />
      </div>
    </section>

    <section class="knowledge-section harness-section" aria-labelledby="knowledge-harness-title">
      <div class="section-heading">
        <div>
          <h2 id="knowledge-harness-title">DeepSeek Harness 对话</h2>
          <p>使用当前登录会话连接智能助手，工作区与知识库上下文保持在同一页面。</p>
        </div>
        <el-tag :type="harnessReady ? 'success' : (harnessFailed ? 'danger' : 'warning')" effect="plain">
          {{ harnessReady ? '已连接' : (harnessFailed ? '连接失败' : '连接中') }}
        </el-tag>
      </div>
      <div class="harness-frame-wrap">
        <iframe
          v-if="harnessReady && !harnessFailed"
          class="harness-frame"
          src="/harness-embed/#digital-twin"
          title="DeepSeek Harness 企业知识库对话"
          allow="clipboard-read; clipboard-write"
          @load="harnessLoading = false"
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
  </main>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { getAuthHeader } from '@/utils/auth'
import OntologyBrainGraph from '@/components/OntologyBrainGraph.vue'
import { buildOntologyBrainRelationGraph } from '@/domain/ontology-brain-graph-policy'
import { ONTOLOGY_RELATIONS_REQUEST, normalizeOntologyRows } from '@/domain/ontology-workbench-query-policy'
import { prepareBusinessHarnessAuth } from '../../../eiscore-base/src/services/business-harness-auth.js'

const router = useRouter()
const relations = ref([])
const brainDomain = ref('')
const loading = ref(false)
const relationError = ref('')
const harnessReady = ref(false)
const harnessFailed = ref(false)
const harnessLoading = ref(true)
let disposed = false
let harnessRequestId = 0

const graph = computed(() => buildOntologyBrainRelationGraph({
  relations: relations.value,
  domainFilter: brainDomain.value
}))

const loadRelations = async () => {
  loading.value = true
  relationError.value = ''
  try {
    relations.value = normalizeOntologyRows(await request(ONTOLOGY_RELATIONS_REQUEST))
  } catch (error) {
    relations.value = []
    relationError.value = '本体关系加载失败，请刷新后重试。'
    ElMessage.error(`本体关系加载失败：${error?.message || '网络错误'}`)
  } finally {
    loading.value = false
  }
}

const prepareHarnessFrame = async () => {
  const requestId = ++harnessRequestId
  const authorization = getAuthHeader().Authorization || ''
  const isCurrent = () => !disposed
    && requestId === harnessRequestId
    && !!authorization
    && getAuthHeader().Authorization === authorization
  harnessLoading.value = true
  harnessFailed.value = false
  harnessReady.value = false
  const ready = await prepareBusinessHarnessAuth({
    harnessWebUrl: '/harness-embed/',
    authApiPrefix: '/harness-embed-api',
    authorization
  }, isCurrent)
  if (!isCurrent()) return
  if (!ready) {
    harnessLoading.value = false
    harnessFailed.value = true
    return
  }
  harnessReady.value = true
}

const handleHarnessError = () => {
  harnessLoading.value = false
  harnessReady.value = false
  harnessFailed.value = true
}

const goBack = () => router.push('/')

onMounted(() => {
  void loadRelations()
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
  padding: 22px;
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
  max-width: 1440px;
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
.knowledge-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.knowledge-section { max-width: 1440px; margin: 0 auto 18px; border: 1px solid #dce5e7; background: #fff; box-shadow: 0 3px 12px #29444d0a; }
.section-heading { padding: 15px 16px 12px; border-bottom: 1px solid #e5ecee; }
h2 { margin: 0; color: #2a414a; font-size: 16px; line-height: 1.4; }
.section-heading p { margin: 4px 0 0; color: #788990; font-size: 12px; line-height: 1.5; }
.domain-filter { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; color: #60737b; font-size: 12px; }
.domain-filter select { min-width: 140px; height: 30px; padding: 0 8px; border: 1px solid #cddadd; border-radius: 4px; color: #344952; background: #fff; font: inherit; }
.brain-frame { padding: 0; }
.brain-frame :deep(.ontology-brain) { border: 0; }
.harness-frame-wrap { min-height: 520px; background: #f7fafb; }
.harness-frame { display: block; width: 100%; height: 520px; border: 0; }
.harness-status { display: flex; min-height: 520px; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #6c7c83; font-size: 13px; }
.harness-status .el-icon { font-size: 22px; color: #14766e; }
.harness-status .el-icon.is-loading { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) {
  .knowledge-workbench { padding: 12px; }
  .knowledge-header, .section-heading { flex-direction: column; }
  .knowledge-actions { justify-content: flex-start; }
  .domain-filter { width: 100%; }
  .domain-filter select { flex: 1; }
  h1 { font-size: 21px; }
  .harness-frame, .harness-status, .harness-frame-wrap { min-height: 460px; height: 460px; }
}
</style>
