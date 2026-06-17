<template>
  <div class="ai-copilot-container" :class="containerClasses">
    <div
      v-if="!state.isOpen && isWorker"
      class="ai-trigger-btn"
      @click="openAssistant"
    >
      <div class="ai-icon-wrapper">
        <span class="sparkle-icon">✨</span>
      </div>
      <span class="ai-label">工作助手</span>
    </div>

    <div v-else-if="state.isOpen" class="ai-window" :class="{ 'is-worker': isWorker, 'is-fullscreen': isWorkerFullscreen }">
      <div class="ai-header">
        <div class="header-left" @click="toggleHistory">
          <el-icon class="history-icon" :class="{ 'active': showHistory }"><Operation /></el-icon>
          <span class="title">{{ assistantTitle }}</span>
        </div>
        <div class="header-right">
          <el-tooltip v-if="isWorker" :content="isWorkerFullscreen ? '退出全屏' : '全屏'" placement="bottom">
            <el-icon class="action-icon" @click="toggleFullscreen">
              <component :is="isWorkerFullscreen ? ScaleToOriginal : FullScreen" />
            </el-icon>
          </el-tooltip>
          <el-tooltip content="新建对话" placement="bottom">
            <el-icon class="action-icon" @click="aiBridge.createNewSession()"><Plus /></el-icon>
          </el-tooltip>
          <el-icon class="close-btn" @click="closeAssistant"><Close /></el-icon>
        </div>
      </div>

      <div class="ai-body">
        <div
          v-if="isEnterprise"
          class="history-sidebar"
          :class="{ show: showHistory }"
        >
          <div class="sidebar-content">
            <el-tabs v-model="historyTab" class="sidebar-tabs">
              <el-tab-pane label="对话" name="sessions">
                <div class="session-list">
                  <div
                    v-for="sess in state.sessions"
                    :key="sess.id"
                    class="session-item"
                    :class="{ active: sess.id === state.currentSessionId }"
                    @click="switchSession(sess.id)"
                  >
                    <div class="session-info">
                      <span class="session-title">{{ sess.title || '新对话' }}</span>
                      <span class="session-time">{{ formatSessionTime(sess.updatedAt || sess.createdAt) }}</span>
                    </div>
                    <el-icon class="session-delete" @click.stop="aiBridge.deleteSession(sess.id)"><Delete /></el-icon>
                  </div>
                  <el-empty v-if="state.sessions.length === 0" description="暂无对话" :image-size="60" />
                </div>
              </el-tab-pane>

              <el-tab-pane label="指标" name="metrics">
                <div class="metric-list">
                  <div
                    v-for="domain in smartBiMetricDomains"
                    :key="domain.key"
                    class="metric-item"
                    @click="runSmartBiDomain(domain)"
                  >
                    <div class="metric-info">
                      <span class="metric-name">{{ domain.label }}</span>
                      <span class="metric-desc">{{ domain.metrics.length }} 个指标 · {{ domain.charts.length }} 类图表</span>
                    </div>
                    <el-icon class="metric-icon"><Document /></el-icon>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>

        <div v-else class="history-sidebar worker-history-sidebar" :class="{ show: showHistory }">
          <div class="sidebar-content">
            <div class="sidebar-header">
              <div>
                <div class="sidebar-title">{{ historyTitle }}</div>
                <div class="sidebar-count">{{ state.sessions.length }} 个会话</div>
              </div>
              <el-tooltip :content="isEnterprise ? '新建分析' : '新建对话'" placement="right">
                <el-button
                  class="sidebar-new-btn"
                  type="primary"
                  :icon="Plus"
                  circle
                  @click.stop="createSessionFromHistory"
                />
              </el-tooltip>
            </div>
            <div class="session-list">
              <div
                v-for="sess in state.sessions"
                :key="sess.id"
                class="session-item"
                :class="{ active: sess.id === state.currentSessionId }"
                @click="switchSession(sess.id)"
              >
                <div class="session-info">
                  <span class="session-title">{{ sess.title || '新对话' }}</span>
                  <span class="session-time">{{ formatSessionTime(sess.updatedAt || sess.createdAt) }}</span>
                </div>
                <el-tooltip content="删除会话" placement="top">
                  <el-icon class="session-delete" @click.stop="aiBridge.deleteSession(sess.id)"><Delete /></el-icon>
                </el-tooltip>
              </div>
              <el-empty
                v-if="state.sessions.length === 0"
                description="暂无对话"
                :image-size="60"
              >
                <el-button type="primary" size="small" @click.stop="createSessionFromHistory">
                  新建对话
                </el-button>
              </el-empty>
            </div>
          </div>
        </div>

        <div class="chat-area" @click="handleChatAreaClick">
          <div class="messages-container" ref="messagesRef">
            <div v-if="showSmartBiWorkbench" class="smart-bi-workbench">
              <div class="smart-bi-head">
                <div>
                  <div class="smart-bi-title">经营指标工作台</div>
                  <div class="smart-bi-meta">
                    {{ smartBiSnapshotLoading ? '快照刷新中' : smartBiSnapshotStatusText }}
                  </div>
                </div>
                <el-button
                  size="small"
                  plain
                  :loading="smartBiSnapshotLoading"
                  @click.stop="loadSmartBiSnapshot(true)"
                >
                  刷新
                </el-button>
              </div>
              <div class="smart-bi-card-grid">
                <button
                  v-for="card in smartBiWorkbenchCards"
                  :key="card.key"
                  type="button"
                  class="smart-bi-card"
                  :class="`risk-${card.riskLevel || 'normal'}`"
                  :data-risk="card.riskLevel"
                  @click="runSmartBiCard(card)"
                >
                  <div class="card-top">
                    <span class="card-label">{{ card.label }}</span>
                    <span class="card-status" :data-risk="card.riskLevel">{{ card.riskStatusLabel }}</span>
                  </div>
                  <div class="card-value">{{ card.metricValue }}</div>
                  <div class="card-metric">{{ card.metricLabel }}</div>
                  <div class="card-rule">
                    <span>口径：{{ card.metricDefinition }}</span>
                    <span>图表：{{ card.chartTemplate }}</span>
                  </div>
                  <div class="card-risk">状态：{{ card.riskReason }}</div>
                  <div class="card-foot">
                    <span>{{ card.subLabel }}：{{ card.subValue }}</span>
                    <span>{{ card.riskLabel }}：{{ card.riskValue }}</span>
                  </div>
                </button>
              </div>
            </div>

            <template v-if="currentSession">
              <div
                v-for="(msg, index) in currentSession.messages"
                :key="index"
                class="message-row"
                :class="msg.role"
                :data-message-index="index"
              >
                <div class="avatar-wrapper">
                  <div class="avatar">{{ msg.role === 'user' ? '👤' : '✨' }}</div>
                </div>

                <div class="content-wrapper">
                  <div v-if="msg.files && msg.files.length" class="msg-files">
                    <div v-for="(file, idx) in msg.files" :key="idx" class="file-card">
                      <el-image
                        v-if="file.type === 'image'"
                        :src="file.url"
                        :preview-src-list="[file.url]"
                        class="msg-img"
                        fit="contain"
                      />
                      <div v-else class="doc-file">
                        <el-icon><Document /></el-icon>
                        <span>{{ file.name }}</span>
                      </div>
                    </div>
                  </div>

                <div class="bubble" v-if="shouldShowBubble(msg)">
                  <div
                    class="markdown-body"
                    v-html="renderMarkdown(msg.content, { enableVisualBlocks: !isStreamingMessage(index), smartBiReport: isEnterprise && msg.role === 'assistant' })"
                  ></div>
                  <span
                    v-if="msg.role === 'assistant' && index === currentSession.messages.length - 1 && state.isStreaming"
                    class="typing-cursor"
                  ></span>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getFormTemplateInfo(msg).schema"
                  class="form-template-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到表单模板</span>
                    <span class="card-name">{{ getFormTemplateInfo(msg).schema.title || '未命名模板' }}</span>
                  </div>
                  <div class="card-meta">
                    <span>区块: {{ getTemplateSectionCount(getFormTemplateInfo(msg).schema) }}</span>
                    <span>表格: {{ getTemplateTableCount(getFormTemplateInfo(msg).schema) }}</span>
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="templateSaveState[msg.time] === 'saving'"
                      @click="saveFormTemplate(getFormTemplateInfo(msg).schema, msg.time)"
                    >
                      {{ templateSaveState[msg.time] === 'saved' ? '已保存' : '保存到模板库' }}
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getFormulaInfo(msg).formula && !isStreamingMessage(index)"
                  class="formula-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到公式</span>
                    <span class="card-name">{{ getFormulaInfo(msg).formula }}</span>
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="formulaApplyState[msg.time] === 'applying'"
                      @click="applyAiFormula(getFormulaInfo(msg).formula, msg.time)"
                    >
                      {{ formulaApplyState[msg.time] === 'applied' ? '已应用' : '应用公式' }}
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getImportInfo(msg).rows && getImportInfo(msg).rows.length > 0 && !isStreamingMessage(index)"
                  class="import-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到表格导入数据</span>
                    <span class="card-name">共 {{ getImportInfo(msg).rows.length }} 行</span>
                  </div>
                  <div class="preview-table">
                    <el-table
                      :data="getImportPreview(getImportInfo(msg)).rows"
                      size="small"
                      border
                      style="width: 100%"
                      max-height="220"
                    >
                      <el-table-column
                        v-for="col in getImportPreview(getImportInfo(msg)).columns"
                        :key="col.prop"
                        :prop="col.prop"
                        :label="col.label"
                        min-width="120"
                      />
                    </el-table>
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="importState[msg.time] === 'importing'"
                      @click="applyDataImport(getImportInfo(msg), msg.time)"
                    >
                      {{ importState[msg.time] === 'done' ? '已导入' : '导入到当前表格' }}
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getWorkflowInfo(msg).xml && !isStreamingMessage(index)"
                  class="workflow-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到流程</span>
                    <span class="card-name">{{ getWorkflowInfo(msg).meta?.name || '未命名流程' }}</span>
                  </div>
                  <div class="card-meta">
                    <span>关联表: {{ resolveAssociatedTable(getWorkflowInfo(msg).meta || {}) || '未指定' }}</span>
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="workflowSaveState[msg.time] === 'saving'"
                      @click="saveWorkflowDefinition(getWorkflowInfo(msg), msg.time)"
                    >
                      {{ workflowSaveState[msg.time] === 'saved' ? '已保存为流程应用' : '保存为流程应用' }}
                    </el-button>
                    <el-button
                      size="small"
                      @click="copyWorkflowXml(getWorkflowInfo(msg).xml)"
                    >
                      复制XML
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getCategoryInfo(msg).data && !isStreamingMessage(index)"
                  class="import-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到物料分类</span>
                    <span class="card-name">共 {{ getCategoryInfo(msg).data.length }} 项</span>
                  </div>
                  <div class="preview-tree">
                    <el-tree
                      :data="getCategoryInfo(msg).data"
                      :props="{ label: 'label', children: 'children' }"
                      node-key="id"
                      default-expand-all
                    />
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="categoryImportState[msg.time] === 'importing'"
                      @click="applyCategoryImport(getCategoryInfo(msg), msg.time)"
                    >
                      {{ categoryImportState[msg.time] === 'done' ? '已保存' : '保存到物料分类' }}
                    </el-button>
                  </div>
                </div>


                <div
                  v-else-if="msg.role === 'assistant' && getFormTemplateInfo(msg).error && !(state.isStreaming && index === currentSession.messages.length - 1)"
                  class="form-template-error"
                >
                  模板解析失败，请检查 JSON 格式。
                </div>

                <div class="msg-actions">
                  <el-button link size="small" type="danger" icon="Delete" @click="aiBridge.deleteMessage(index)"></el-button>
                  <el-button
                    v-if="shouldShowReportDownload(msg, index)"
                    link
                    size="small"
                    type="primary"
                    @click="exportMessageReportAsPdf(index)"
                  >下载报告</el-button>
                  <el-button
                      v-if="msg.role === 'user'"
                      link
                      size="small"
                      type="primary"
                      icon="Refresh"
                      @click="retryMessage(index)"
                    >重试</el-button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div class="input-section">
            <div v-if="state.selectedFiles.length" class="file-preview-bar">
              <div v-for="(file, idx) in state.selectedFiles" :key="idx" class="preview-item">
                <img v-if="file.type === 'image'" :src="file.url" />
                <div v-else class="doc-preview"><el-icon><Document /></el-icon></div>
                <div class="remove-btn" @click="state.selectedFiles.splice(idx, 1)">×</div>
              </div>
            </div>

            <div
              v-if="smartBiRoutePreview"
              class="smart-bi-route-preview"
              :data-confidence="smartBiRoutePreview.confidence"
            >
              <span class="route-label">范围</span>
              <span class="route-domain">{{ smartBiRoutePreview.label }}</span>
              <span class="route-keywords">{{ smartBiRouteKeywordText }}</span>
            </div>

            <div v-if="quickActions.length" class="quick-actions">
              <el-button
                v-for="action in quickActions"
                :key="action.key || action.label"
                size="small"
                plain
                :disabled="state.isLoading"
                @click="runQuickAction(action)"
              >
                {{ action.label }}
              </el-button>
            </div>

            <div class="input-box">
              <el-upload
                action="#"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="(file) => aiBridge.handleFileSelect(file.raw)"
                class="upload-trigger"
              >
                <el-icon class="tool-icon"><Paperclip /></el-icon>
              </el-upload>

              <textarea
                v-model="state.inputBuffer"
                :placeholder="inputPlaceholder"
                @keydown.enter="handleEnter"
                :disabled="state.isLoading"
              ></textarea>

              <div class="send-btn" :class="{ 'disabled': state.isLoading || (!state.inputBuffer && !state.selectedFiles.length) }" @click="handleSend">
                <el-icon v-if="state.isLoading" class="is-loading"><Loading /></el-icon>
                <el-icon v-else><Position /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="lightbox.visible" class="chart-lightbox" @click.self="closeLightbox">
      <div class="lightbox-content">
        <div class="lightbox-header">
          <span>{{ lightbox.type === 'echarts' ? '统计图预览' : '流程图预览' }}</span>
          <el-icon class="lightbox-close" @click="closeLightbox"><Close /></el-icon>
        </div>
        <div class="lightbox-body">
          <div v-if="lightbox.type === 'echarts'" ref="lightboxChartRef" class="lightbox-chart"></div>
          <div v-else class="lightbox-mermaid" v-html="lightbox.payload"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, computed, nextTick, watch, onMounted, onUpdated, onBeforeUnmount } from 'vue'
import { useDark } from '@vueuse/core'
import { aiBridge } from '@/utils/ai-bridge'
import {
  SMART_BI_DOMAINS,
  SMART_BI_COMMON_QUESTIONS,
  buildSmartBiContext,
  buildSmartBiReportRequest,
  getSmartBiWorkbenchCards,
  routeSmartBiQuestion
} from '@shared/smart-bi-config'
import { Operation, Close, Plus, Delete, Paperclip, Position, Loading, Document, Refresh, FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import { useRouter } from 'vue-router'

const FULLSCREEN_KEY = 'eis_ai_worker_fullscreen'

const props = defineProps({
  mode: { type: String, default: 'enterprise' },
  closeRoute: { type: String, default: '' },
  autoOpen: { type: Boolean, default: false }
})

const state = aiBridge.state
const showHistory = ref(false)
const historyTab = ref('sessions')
const messagesRef = ref(null)
const lightboxChartRef = ref(null)
const lightbox = ref({ visible: false, type: '', payload: null })
const smartBiSnapshot = ref(null)
const smartBiSnapshotLoading = ref(false)
const smartBiSnapshotError = ref('')
let lightboxChart = null
let chartResizeObserver = null
let resizeRafId = 0
let mermaidRenderSeed = 0
const chartResizeTimers = new Map()
const router = useRouter()
const isFullscreen = ref(false)
const isDark = useDark({ storageKey: 'eis_theme_global' })

let echartsModulePromise = null
const loadEcharts = async () => {
  echartsModulePromise ||= import('echarts')
  return echartsModulePromise
}

let mermaidModulePromise = null
let mermaidInitialized = false
const loadMermaid = async () => {
  mermaidModulePromise ||= import('mermaid')
  const module = await mermaidModulePromise
  const mermaid = module.default || module
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, theme: 'default' })
    mermaidInitialized = true
  }
  return mermaid
}

const currentSession = computed(() => aiBridge.getCurrentSession())
const isWorker = computed(() => props.mode === 'worker')
const isEnterprise = computed(() => props.mode === 'enterprise')
const isWorkerFullscreen = computed(() => isWorker.value && isFullscreen.value)
const assistantTitle = computed(() => (isWorker.value ? '企业工作助手' : '智能 BI'))
const historyTitle = computed(() => (isEnterprise.value ? '智能 BI 历史' : '对话历史'))
const inputPlaceholder = computed(() => (
  isWorker.value
    ? '把数据或问题告诉我，我帮你整理成能录入系统的格式...'
    : '直接问经营数据，或上传表格生成指标图表...'
))
const containerClasses = computed(() => ({
  'is-open': state.isOpen,
  'is-worker': isWorker.value,
  'is-fullscreen': isWorkerFullscreen.value && state.isOpen,
  'is-dark': isDark.value
}))
const quickActions = computed(() => {
  const actions = state.currentContext?.aiQuickActions
  const contextActions = Array.isArray(actions) ? actions : []
  const normalizedActions = contextActions
    .filter((action) => action && action.label && action.prompt)
    .slice(0, 6)
  if (normalizedActions.length) return normalizedActions
  if (!isEnterprise.value) return []
  return SMART_BI_COMMON_QUESTIONS
    .filter((item) => item.key !== 'upload')
    .map((item) => ({
      key: `smart_bi_${item.key}`,
      label: item.label,
      prompt: item.prompt,
      mode: 'enterprise'
    }))
})
const smartBiWorkbenchCards = computed(() => getSmartBiWorkbenchCards(smartBiSnapshot.value || {}))
const smartBiMetricDomains = computed(() => SMART_BI_DOMAINS)
const smartBiRoutePreview = computed(() => {
  if (!isEnterprise.value) return null
  const text = String(state.inputBuffer || '').trim()
  if (!text) return null
  return routeSmartBiQuestion(text)
})
const smartBiRouteKeywordText = computed(() => {
  const keywords = smartBiRoutePreview.value?.matchedKeywords || []
  if (!keywords.length) return '默认总览'
  return `命中 ${keywords.slice(0, 3).join('、')}`
})
const showSmartBiWorkbench = computed(() => {
  if (!isEnterprise.value || !currentSession.value) return false
  return !currentSession.value.messages.some((message) => message.role === 'user')
})
const smartBiSnapshotTimeText = computed(() => {
  const snapshotTime = smartBiSnapshot.value?.snapshotTime
  if (!snapshotTime) return '等待数据快照'
  try {
    return `快照时间 ${new Date(snapshotTime).toLocaleString('zh-CN', { hour12: false })}`
  } catch {
    return '快照已加载'
  }
})
const smartBiSnapshotStatusText = computed(() => {
  if (smartBiSnapshotError.value) return smartBiSnapshotError.value
  const meta = smartBiSnapshot.value?._meta
  if (meta?.fallback) return `快照降级：${meta.error || '已使用空快照'}`
  if (meta?.partial && Number(meta.failedSourceCount) > 0) {
    return `快照部分加载：${meta.failedSourceCount} 个数据源读取失败`
  }
  return smartBiSnapshotTimeText.value
})

const buildSmartBiActionContext = (prompt = '', reportMode = 'common_question') => buildSmartBiContext(prompt, {
  reportMode,
  snapshot: smartBiSnapshot.value || {}
})

const formatSessionTime = (value) => {
  if (!value) return '刚刚'
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return '刚刚'
  const diff = Date.now() - time
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400 * 1000) return `${Math.floor(diff / 3600000)}小时前`
  return new Date(time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const FORM_TEMPLATE_BLOCKS = ['form-template', 'form_template', 'form-schema', 'form_schema']
const FORMULA_BLOCKS = ['formula']
const IMPORT_BLOCKS = ['data-import', 'data_import', 'grid-import', 'grid_import']
const BPMN_BLOCKS = ['bpmn-xml', 'bpmn_xml', 'workflow-bpmn', 'workflow_bpmn']
const WORKFLOW_META_BLOCKS = ['workflow-meta', 'workflow_meta']
const MATERIAL_CATEGORY_BLOCKS = [
  'materials-categories',
  'material-categories',
  'materials_categories',
  'material_categories'
]

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

const allowedHtmlTags = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img', 'hr', 'span', 'div', 'section', 'details', 'summary'
])
const allowedHtmlAttrs = {
  '*': new Set(['class', 'id']),
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title'])
}

const isSafeUrl = (value, allowDataImage = false) => {
  if (!value) return false
  const raw = String(value).trim()
  const lower = raw.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/html')) {
    return false
  }
  if (allowDataImage && lower.startsWith('data:image/')) return true
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:') || lower.startsWith('tel:')) return true
  if (lower.startsWith('#') || lower.startsWith('/') || lower.startsWith('./') || lower.startsWith('../')) return true
  if (lower.startsWith('blob:')) return true
  return false
}

const sanitizeHtml = (dirty) => {
  if (!dirty) return ''
  if (typeof window === 'undefined' || !window.DOMParser) return dirty
  const parser = new DOMParser()
  const doc = parser.parseFromString(dirty, 'text/html')

  const walk = (node) => {
    const children = Array.from(node.childNodes || [])
    children.forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove()
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const tag = child.tagName.toLowerCase()
      if (!allowedHtmlTags.has(tag)) {
        const textNode = doc.createTextNode(child.textContent || '')
        child.replaceWith(textNode)
        return
      }
      Array.from(child.attributes || []).forEach((attr) => {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on') || name === 'style') {
          child.removeAttribute(attr.name)
          return
        }
        if (name.startsWith('data-')) return
        const allowed = (allowedHtmlAttrs[tag] && allowedHtmlAttrs[tag].has(name)) ||
          (allowedHtmlAttrs['*'] && allowedHtmlAttrs['*'].has(name))
        if (!allowed) {
          child.removeAttribute(attr.name)
          return
        }
        if (tag === 'a' && name === 'href' && !isSafeUrl(attr.value)) {
          child.removeAttribute(attr.name)
        }
        if (tag === 'img' && name === 'src' && !isSafeUrl(attr.value, true)) {
          child.removeAttribute(attr.name)
        }
      })
      if (tag === 'a' && child.getAttribute('target') === '_blank') {
        const rel = child.getAttribute('rel') || ''
        if (!rel.includes('noopener')) {
          child.setAttribute('rel', 'noopener noreferrer')
        }
      }
      walk(child)
    })
  }

  walk(doc.body)
  return doc.body.innerHTML
}

const sanitizeSvg = (svgText) => {
  if (!svgText) return ''
  if (typeof window === 'undefined' || !window.DOMParser) return svgText
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const scripts = doc.querySelectorAll('script')
  scripts.forEach((node) => node.remove())
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const el = walker.currentNode
    Array.from(el.attributes || []).forEach((attr) => {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
      }
      if ((name === 'href' || name === 'xlink:href') && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name)
      }
    })
  }
  return doc.documentElement.outerHTML
}

const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info.trim().toLowerCase()
  if (
    MATERIAL_CATEGORY_BLOCKS.includes(info) ||
    IMPORT_BLOCKS.includes(info) ||
    BPMN_BLOCKS.includes(info) ||
    WORKFLOW_META_BLOCKS.includes(info)
  ) {
    return ''
  }
  if (info === 'mermaid') {
    if (env?.enableVisualBlocks === false) {
      if (defaultFence) return defaultFence(tokens, idx, options, env, self)
      return self.renderToken(tokens, idx, options)
    }
    return `<div class="mermaid-chart chart-pending" data-raw="${encodeURIComponent(token.content)}"></div>`
  }
  if (info === 'echarts') {
    if (env?.enableVisualBlocks === false) {
      if (defaultFence) return defaultFence(tokens, idx, options, env, self)
      return self.renderToken(tokens, idx, options)
    }
    return `<div class="echarts-chart chart-pending" data-option="${encodeURIComponent(token.content)}"></div>`
  }
  if (defaultFence) {
    return defaultFence(tokens, idx, options, env, self)
  }
  return self.renderToken(tokens, idx, options)
}

const SMART_BI_REPORT_SECTIONS = [
  { key: 'summary', label: '摘要', aliases: ['摘要', '经营摘要', '分析摘要', '结论', '总览'] },
  { key: 'metrics', label: '关键指标', aliases: ['关键指标', '核心指标', '指标口径'] },
  { key: 'charts', label: '指标图表', aliases: ['指标图表', '图表', '图表分析', '数据图表'] },
  { key: 'risks', label: '风险提醒', aliases: ['风险提醒', '风险', '风险预警', '异常提醒'] },
  { key: 'actions', label: '行动建议', aliases: ['行动建议', '建议', '改善建议', '下一步'] }
]

const normalizeSmartBiHeading = (value = '') => String(value || '')
  .replace(/^#+\s*/, '')
  .replace(/[：:]/g, '')
  .replace(/[【】\[\]（）()]/g, '')
  .replace(/\s+/g, '')
  .trim()

const matchSmartBiReportSection = (text = '') => {
  const normalized = normalizeSmartBiHeading(text)
  if (!normalized) return null
  return SMART_BI_REPORT_SECTIONS.find((section) => (
    section.aliases.some((alias) => {
      const normalizedAlias = normalizeSmartBiHeading(alias)
      return normalized === normalizedAlias || normalized.startsWith(normalizedAlias)
    })
  )) || null
}

const isMeaningfulSmartBiNode = (node) => {
  if (!node) return false
  if (node.nodeType === Node.TEXT_NODE) return Boolean(String(node.textContent || '').trim())
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  return Boolean(String(node.textContent || '').trim()) || node.querySelector?.('.echarts-chart, .mermaid-chart, img, table')
}

const enhanceSmartBiReportHtml = (html = '') => {
  if (!html || typeof window === 'undefined' || !window.DOMParser) return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div class="smart-bi-report-source">${html}</div>`, 'text/html')
  const source = doc.querySelector('.smart-bi-report-source')
  if (!source) return html

  const children = Array.from(source.childNodes || [])
  const headingSections = children
    .filter((node) => node.nodeType === Node.ELEMENT_NODE && /^H[1-4]$/.test(node.tagName))
    .map((node) => matchSmartBiReportSection(node.textContent || ''))
    .filter(Boolean)
  if (new Set(headingSections.map((section) => section.key)).size < 2) return html

  const report = doc.createElement('div')
  report.className = 'smart-bi-report'
  let intro = doc.createElement('div')
  intro.className = 'smart-bi-report-intro'
  let currentContent = intro

  const appendIntroIfNeeded = () => {
    if (!intro || !Array.from(intro.childNodes || []).some(isMeaningfulSmartBiNode)) return
    report.appendChild(intro)
    intro = null
  }

  children.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && /^H[1-4]$/.test(node.tagName)) {
      const section = matchSmartBiReportSection(node.textContent || '')
      if (section) {
        appendIntroIfNeeded()
        const sectionNode = doc.createElement('section')
        sectionNode.className = `smart-bi-report-section section-${section.key}`
        sectionNode.setAttribute('data-section', section.key)

        const heading = doc.createElement('div')
        heading.className = 'smart-bi-report-heading'
        const badge = doc.createElement('span')
        badge.className = 'section-badge'
        badge.textContent = String(SMART_BI_REPORT_SECTIONS.findIndex((item) => item.key === section.key) + 1).padStart(2, '0')
        const title = doc.createElement('span')
        title.className = 'section-title'
        title.textContent = section.label
        heading.appendChild(badge)
        heading.appendChild(title)

        currentContent = doc.createElement('div')
        currentContent.className = 'smart-bi-report-content'
        sectionNode.appendChild(heading)
        sectionNode.appendChild(currentContent)
        report.appendChild(sectionNode)
        return
      }
    }
    currentContent.appendChild(node)
  })

  appendIntroIfNeeded()
  if (!Array.from(report.childNodes || []).some(isMeaningfulSmartBiNode)) return html
  return report.outerHTML
}

const renderMarkdown = (text, env = {}) => {
  if (!text) return ''
  const sanitized = sanitizeHtml(md.render(text, env))
  if (!env?.smartBiReport) return sanitized
  return sanitizeHtml(enhanceSmartBiReportHtml(sanitized))
}

const waitTwoFrames = () => new Promise((resolve) => {
  if (typeof window === 'undefined') {
    resolve()
    return
  }
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
})

const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const stripFunctionValueBlocks = (input) => {
  const text = String(input || '')
  if (!text.includes(': function')) return text
  let out = ''
  let cursor = 0
  while (cursor < text.length) {
    const fnToken = text.indexOf(': function', cursor)
    if (fnToken < 0) {
      out += text.slice(cursor)
      break
    }

    out += text.slice(cursor, fnToken) + ': null'
    let i = fnToken + 1
    const keyword = text.indexOf('function', i)
    if (keyword < 0) {
      cursor = fnToken + 1
      continue
    }
    i = keyword + 'function'.length
    while (i < text.length && text[i] !== '{') i += 1
    if (i >= text.length) {
      cursor = text.length
      break
    }

    let depth = 0
    let inString = false
    let escaped = false
    for (; i < text.length; i += 1) {
      const ch = text[i]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (ch === '\\') {
          escaped = true
        } else if (ch === '"') {
          inString = false
        }
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') depth += 1
      if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          i += 1
          break
        }
      }
    }
    cursor = i
  }
  return out
}

const sanitizeJson = (jsonStr) => {
  if (!jsonStr) return ''
  let cleaned = jsonStr
  cleaned = cleaned.replace(/^\s*[^=]*=\s*/, '')
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1')
  cleaned = cleaned.replace(/\/\/.*(?=[\n\r])/g, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/\bundefined\b/g, 'null')
  cleaned = cleaned.replace(/\bNaN\b/g, '0')
  cleaned = cleaned.replace(/\bInfinity\b/g, '0')
  cleaned = cleaned.replace(/\b-Infinity\b/g, '0')
  cleaned = stripFunctionValueBlocks(cleaned)
  cleaned = cleaned.replace(/'([^']*)'/g, (_, p1) => `"${p1.replace(/"/g, '\\"')}"`)
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
  return cleaned.trim()
}

const extractBalancedJson = (input) => {
  const text = String(input || '')
  const start = text.search(/[{[]/)
  if (start < 0) return ''
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) depth += 1
    if (ch === close) depth -= 1
    if (depth === 0) return text.slice(start, i + 1)
  }
  return ''
}

const normalizeGridItem = (grid) => {
  const base = { left: 56, right: 28, top: 64, bottom: 44, containLabel: true }
  const next = { ...base, ...(grid && typeof grid === 'object' ? grid : {}) }
  const widthNum = typeof next.width === 'number' ? next.width : Number.NaN
  const heightNum = typeof next.height === 'number' ? next.height : Number.NaN
  const widthPct = typeof next.width === 'string' && next.width.endsWith('%') ? Number.parseFloat(next.width) : Number.NaN
  const heightPct = typeof next.height === 'string' && next.height.endsWith('%') ? Number.parseFloat(next.height) : Number.NaN

  if ((Number.isFinite(widthNum) && widthNum < 260) || (Number.isFinite(widthPct) && widthPct < 70)) delete next.width
  if ((Number.isFinite(heightNum) && heightNum < 180) || (Number.isFinite(heightPct) && heightPct < 55)) delete next.height
  return next
}

const normalizeEchartsOption = (option) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null
  const cloned = JSON.parse(JSON.stringify(option))
  if (cloned.series && !Array.isArray(cloned.series)) {
    cloned.series = [cloned.series]
  }
  if (!Array.isArray(cloned.series) || cloned.series.length === 0) return null
  cloned.series = cloned.series
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      type: item.type || 'line',
      ...item
    }))
  if (!cloned.series.length) return null
  cloned.animation = false
  if (Array.isArray(cloned.grid)) {
    cloned.grid = cloned.grid.map(item => normalizeGridItem(item))
  } else {
    cloned.grid = normalizeGridItem(cloned.grid)
  }
  if (!cloned.tooltip) {
    cloned.tooltip = { trigger: 'axis' }
  }
  return cloned
}

const parseEchartsOptionSafely = (raw) => {
  const source = String(raw || '')
  const primary = sanitizeJson(source)
  const candidates = []

  const rawTrimmed = source.trim()
  if (rawTrimmed) candidates.push(rawTrimmed)
  const rawBalanced = extractBalancedJson(rawTrimmed)
  if (rawBalanced) candidates.push(rawBalanced)
  if (primary) {
    candidates.push(primary)
    const firstBrace = primary.search(/[{[]/)
    const lastCurly = primary.lastIndexOf('}')
    const lastSquare = primary.lastIndexOf(']')
    const lastBrace = Math.max(lastCurly, lastSquare)
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      candidates.push(primary.slice(firstBrace, lastBrace + 1))
    }
    const balanced = extractBalancedJson(primary)
    if (balanced) candidates.push(balanced)
  }

  const seen = new Set()
  for (const candidate of candidates) {
    if (!candidate) continue
    const key = candidate.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    try {
      const parsed = JSON.parse(key)
      const normalized = normalizeEchartsOption(parsed)
      if (normalized) return normalized
    } catch {}
  }
  return null
}

const isOmittedOption = (option) => {
  if (!option || typeof option !== 'object') return false
  const xAxis = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis
  const yAxis = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis
  const firstSeries = Array.isArray(option.series) ? option.series[0] : null
  if (!xAxis || !yAxis || !firstSeries) return false
  const hiddenAxis = xAxis.show === false && yAxis.show === false
  const hiddenLine = Number(firstSeries?.lineStyle?.opacity) === 0
  const hiddenPoint = Number(firstSeries?.itemStyle?.opacity) === 0
  return hiddenAxis && hiddenLine && hiddenPoint
}

const templateSaveState = ref({})
const formulaApplyState = ref({})
const importState = ref({})
const categoryImportState = ref({})
const workflowSaveState = ref({})

const getAuthToken = () => {
  const tokenStr = localStorage.getItem('auth_token')
  if (!tokenStr) return ''
  let token = tokenStr
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed && parsed.token) token = parsed.token
  } catch (e) {
    token = tokenStr
  }
  if (token && token.length > 8192) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    return ''
  }
  return token
}

const parseJwtPayload = (token) => {
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch (e) {
    return null
  }
}

const getTokenUsername = (token) => {
  const payload = parseJwtPayload(token)
  const username = payload?.username
  return username ? String(username) : ''
}

const isTokenExpired = (token) => {
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  return Date.now() / 1000 >= payload.exp
}

const extractFormTemplate = (text) => {
  if (!text) return { schema: null, error: null }
  for (const tag of FORM_TEMPLATE_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const schema = JSON.parse(raw)
        if (!schema || !schema.layout) {
          return { schema: null, error: 'invalid' }
        }
        return { schema, error: null }
      } catch (e) {
        return { schema: null, error: 'parse' }
      }
    }
  }
  return { schema: null, error: null }
}

const getFormTemplateInfo = (msg) => extractFormTemplate(msg?.content || '')

const extractFormula = (text) => {
  if (!text) return { formula: null, error: null }
  for (const tag of FORMULA_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      const formula = match[1].trim()
      if (!formula) return { formula: null, error: 'empty' }
      return { formula, error: null }
    }
  }
  return { formula: null, error: null }
}

const extractImportData = (text) => {
  if (!text) return { rows: null, error: null }
  for (const tag of IMPORT_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const data = JSON.parse(raw)
        const rows = Array.isArray(data) ? data : (data.rows || data.data || data.items || null)
        if (!Array.isArray(rows)) return { rows: null, error: 'invalid' }
        return { rows, error: null }
      } catch (e) {
        return { rows: null, error: 'parse' }
      }
    }
  }
  return { rows: null, error: null }
}

const extractBpmnXml = (text) => {
  if (!text) return { xml: null, error: null }
  for (const tag of BPMN_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      const xml = match[1].trim()
      if (!xml) return { xml: null, error: 'empty' }
      return { xml, error: null }
    }
  }
  return { xml: null, error: null }
}

const extractWorkflowMeta = (text) => {
  if (!text) return { meta: null, error: null }
  for (const tag of WORKFLOW_META_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const meta = JSON.parse(raw)
        return { meta, error: null }
      } catch (e) {
        return { meta: null, error: 'parse' }
      }
    }
  }
  return { meta: null, error: null }
}

const getWorkflowInfo = (msg) => {
  const { xml, error } = extractBpmnXml(msg?.content || '')
  const meta = extractWorkflowMeta(msg?.content || '').meta
  return { xml, meta, error }
}

const getFormulaInfo = (msg) => extractFormula(msg?.content || '')
const getImportInfo = (msg) => extractImportData(msg?.content || '')

const normalizeCategoryTree = (list, parentId = '') => {
  if (!Array.isArray(list)) return []
  return list.map((item, idx) => {
    const raw = item && typeof item === 'object' ? item : { label: String(item ?? '').trim() }
    const label = String(raw.label ?? raw.name ?? '').trim() || `分类${idx + 1}`
    let id = String(raw.id ?? raw.code ?? '').trim()
    if (!id) {
      const segment = String(idx + 1).padStart(2, '0')
      id = parentId ? `${parentId}.${segment}` : segment
    }
    const children = normalizeCategoryTree(raw.children || raw.items || [], id)
    return { id, label, children: children.length ? children : undefined }
  })
}

const extractCategoryData = (text, blocks) => {
  if (!text) return { data: null, error: null }
  for (const tag of blocks) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const json = JSON.parse(raw)
        const list = Array.isArray(json)
          ? json
          : (json.list || json.items || json.categories || json.data || null)
        if (!Array.isArray(list)) return { data: null, error: 'invalid' }
        return { data: normalizeCategoryTree(list), error: null }
      } catch (e) {
        return { data: null, error: 'parse' }
      }
    }
  }
  return { data: null, error: null }
}

const getCategoryInfo = (msg) => extractCategoryData(msg?.content || '', MATERIAL_CATEGORY_BLOCKS)

const shouldShowBubble = (msg) => {
  const html = renderMarkdown(msg?.content || '')
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text.length > 0
}

const getImportPreview = (info) => {
  const rows = Array.isArray(info?.rows) ? info.rows : []
  if (rows.length === 0) return { columns: [], rows: [] }
  const keySet = new Set()
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => keySet.add(key))
  })
  const contextColumns = Array.isArray(state.currentContext?.columns)
    ? state.currentContext.columns
    : []
  const orderedKeys = []
  contextColumns.forEach((col) => {
    if (keySet.has(col.prop)) orderedKeys.push(col.prop)
  })
  keySet.forEach((key) => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key)
  })
  const labelMap = new Map(contextColumns.map(col => [col.prop, col.label]))
  const columns = orderedKeys.map((key) => ({
    prop: key,
    label: labelMap.get(key) || key
  }))
  return { columns, rows: rows.slice(0, 8) }
}

const getTemplateSectionCount = (schema) => {
  if (!schema?.layout) return 0
  return schema.layout.filter(item => item.type === 'section').length
}

const getTemplateTableCount = (schema) => {
  if (!schema?.layout) return 0
  return schema.layout.filter(item => item.type === 'table').length
}

const getCurrentTemplateLibraryKey = () => {
  const key = state.currentContext?.templateLibraryKey || state.currentContext?.formTemplateKey
  if (!key || typeof key !== 'string') return 'form_templates'
  return key
}

const getCurrentTemplateScope = () => {
  const scope = state.currentContext?.templateScope || state.currentContext?.formTemplateScope || null
  return scope && typeof scope === 'object' ? scope : {}
}

const getTemplateRecordScope = (template) => {
  const scope = template?.scope || template?.schema?.scope || null
  return scope && typeof scope === 'object' ? scope : {}
}

const isSameTemplateScope = (left, right) => {
  const keys = ['app', 'key', 'appId', 'configKey', 'apiUrl', 'templateLibraryKey']
  return keys.every((key) => String(left?.[key] ?? '') === String(right?.[key] ?? ''))
}

const loadTemplateLibrary = async () => {
  try {
    const token = getAuthToken()
    const headers = { 'Accept': 'application/json', 'Accept-Profile': 'public' }
    if (token) headers.Authorization = `Bearer ${token}`
    const key = encodeURIComponent(getCurrentTemplateLibraryKey())
    const res = await fetch(`/api/system_configs?key=eq.${key}`, {
      headers
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? (data[0].value || []) : []
  } catch (e) {
    return []
  }
}

const saveTemplateLibrary = async (templates) => {
  const token = getAuthToken()
  const key = getCurrentTemplateLibraryKey()
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public',
    'Prefer': 'resolution=merge-duplicates'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch('/api/system_configs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value: templates })
  })
}

const buildTemplateRecord = (schema) => {
  const now = new Date().toISOString()
  const scope = {
    ...getCurrentTemplateScope(),
    templateLibraryKey: getCurrentTemplateLibraryKey()
  }
  const scopedSchema = {
    ...schema,
    scope: {
      ...(schema.scope || {}),
      ...scope
    }
  }
  const templateId = schema.templateId || schema.docType || `tpl_${Date.now()}`
  const name = schema.title || schema.name || 'AI生成模板'
  return {
    id: templateId,
    name,
    schema: scopedSchema,
    scope,
    source: 'ai',
    created_at: now,
    updated_at: now
  }
}

const saveFormTemplate = async (schema, messageKey) => {
  if (!schema) return
  if (templateSaveState.value[messageKey] === 'saved') return
  templateSaveState.value[messageKey] = 'saving'
  try {
    const templates = await loadTemplateLibrary()
    const record = buildTemplateRecord(schema)
    const idx = templates.findIndex(item => (
      item.id === record.id && isSameTemplateScope(getTemplateRecordScope(item), record.scope)
    ))
    if (idx >= 0) {
      templates[idx] = { ...templates[idx], ...record, updated_at: new Date().toISOString() }
    } else {
      templates.unshift(record)
    }
    const res = await saveTemplateLibrary(templates)
    if (!res.ok) throw new Error('保存失败')
    templateSaveState.value[messageKey] = 'saved'
    ElMessage.success('模板已保存到模板库')
    window.dispatchEvent(new CustomEvent('eis-form-templates-updated', {
      detail: { templates, record, templateLibraryKey: getCurrentTemplateLibraryKey(), templateScope: record.scope }
    }))
  } catch (e) {
    templateSaveState.value[messageKey] = 'error'
    ElMessage.error('模板保存失败')
  }
}

const isStreamingMessage = (index) => {
  if (!currentSession.value) return false
  return state.isStreaming && index === currentSession.value.messages.length - 1
}

const applyAiFormula = (formula, messageKey) => {
  if (!formula) return
  if (formulaApplyState.value[messageKey] === 'applied') return
  formulaApplyState.value[messageKey] = 'applying'
  try {
    const event = new CustomEvent('eis-ai-apply-formula', { detail: { formula } })
    window.dispatchEvent(event)
    formulaApplyState.value[messageKey] = 'applied'
    ElMessage.success('公式已应用')
  } catch (e) {
    formulaApplyState.value[messageKey] = 'error'
    ElMessage.error('公式应用失败')
  }
}

const isImportBlankValue = (value) => {
  if (value === undefined || value === null) return true
  return typeof value === 'string' && value.trim() === ''
}

const hasImportValue = (value) => {
  if (isImportBlankValue(value)) return false
  if (Array.isArray(value)) return value.some(hasImportValue)
  if (typeof value === 'object') return Object.values(value).some(hasImportValue)
  return true
}

const isMaterialsImportContext = (context, target) => {
  const app = String(context?.app || '').toLowerCase()
  const apiUrl = String(target?.apiUrl || context?.apiUrl || '')
  return app === 'materials' || apiUrl.includes('/raw_materials')
}

const shouldAttachCurrentUser = (context) => {
  const columns = Array.isArray(context?.columns) ? context.columns : []
  const staticColumns = Array.isArray(context?.staticColumns) ? context.staticColumns : []
  return columns.concat(staticColumns).some(col => col?.prop === 'created_by')
}

const getImportDefaultMap = (context, target) => ({
  ...((context?.importDefaults && typeof context.importDefaults === 'object') ? context.importDefaults : {}),
  ...((target?.defaults && typeof target.defaults === 'object') ? target.defaults : {})
})

const getImportRequiredFields = (context, target) => {
  const fields = []
  if (Array.isArray(context?.importRequiredFields)) fields.push(...context.importRequiredFields)
  if (Array.isArray(target?.requiredFields)) fields.push(...target.requiredFields)
  return Array.from(new Set(fields.filter(Boolean)))
}

const getImportGeneratedFields = (context, target) => {
  const fields = []
  if (Array.isArray(context?.importGeneratedFields)) fields.push(...context.importGeneratedFields)
  if (Array.isArray(target?.generatedFields)) fields.push(...target.generatedFields)
  return fields.filter(field => field?.prop)
}

const generateImportCode = (prefix, index) => {
  const date = new Date()
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  const seq = String(index + 1).padStart(4, '0')
  return `${prefix || 'NO-'}${yyyy}${mm}${dd}${hh}${mi}${ss}${ms}-${seq}`
}

const normalizeImportRow = (row, context) => {
  const labelToProp = new Map((context?.columns || []).map(col => [col.label, col.prop]))
  const normalized = {}
  Object.entries(row || {}).forEach(([key, value]) => {
    if (key === 'properties') return
    const prop = labelToProp.get(key) || key
    if (hasImportValue(normalized[prop]) && prop !== key) return
    normalized[prop] = value
  })
  if (row?.properties && typeof row.properties === 'object') {
    normalized.properties = row.properties
  }
  return normalized
}

const prepareGenericImportRows = (rows, context, target) => {
  const defaults = getImportDefaultMap(context, target)
  const requiredFields = getImportRequiredFields(context, target)
  const generatedFields = getImportGeneratedFields(context, target)
  let skipped = 0
  const cleanedRows = []

  rows.forEach((row) => {
    const normalizedRow = normalizeImportRow(row, context)
    if (!Object.values(normalizedRow).some(hasImportValue)) {
      skipped += 1
      return
    }

    const nextRow = { ...defaults, ...normalizedRow }
    generatedFields.forEach((field) => {
      if (!hasImportValue(nextRow[field.prop])) {
        nextRow[field.prop] = generateImportCode(field.prefix, cleanedRows.length)
      }
    })

    const hasRequiredFields = requiredFields.every((field) => hasImportValue(nextRow[field]))
    if (!hasRequiredFields) {
      skipped += 1
      return
    }

    cleanedRows.push(nextRow)
  })

  return { rows: cleanedRows, skipped }
}

const buildImportPayload = (rows, context) => {
  const staticProps = new Set((context?.staticColumns || []).map(col => col.prop))
  const labelToProp = new Map((context?.columns || []).map(col => [col.label, col.prop]))
  const propertyFields = new Set(context?.propertyFields || [])
  const token = getAuthToken()
  const tokenUsername = getTokenUsername(token)
  const currentUser = tokenUsername || context?.currentUser || ''
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return null
    const payload = { properties: {} }
    const rowProps = row.properties && typeof row.properties === 'object' ? row.properties : null
    let hasValue = false
    Object.entries(row).forEach(([key, value]) => {
      if (key === 'properties') return
      if (!hasImportValue(value)) return
      let prop = key
      if (!staticProps.has(prop) && labelToProp.has(prop)) {
        prop = labelToProp.get(prop)
      }
      hasValue = true
      if (staticProps.has(prop)) {
        if (propertyFields.has(prop)) {
          payload.properties[prop] = value
        } else {
          payload[prop] = value
        }
      } else {
        payload.properties[prop] = value
      }
    })
    if (rowProps) {
      Object.entries(rowProps).forEach(([key, value]) => {
        if (!hasImportValue(value)) return
        payload.properties[key] = value
        hasValue = true
      })
    }
    if (staticProps.has('created_by') && currentUser) {
      payload.created_by = currentUser
    }
    if (Object.keys(payload.properties).length === 0) delete payload.properties
    return hasValue ? payload : null
  }).filter(Boolean)
}

const applyDataImport = async (info, messageKey) => {
  if (importState.value[messageKey] === 'done') return
  const context = aiBridge.state.currentContext
  const target = context?.importTarget
  if (!target?.apiUrl) {
    ElMessage.error('未找到可导入的表格上下文')
    return
  }
  const token = getAuthToken()
  const tokenUsername = getTokenUsername(token)
  const currentUser = tokenUsername || context?.currentUser || ''
  const rows = Array.isArray(info?.rows) ? info.rows : []
  const sourceRows = rows.filter(row => row && typeof row === 'object')
  if (!sourceRows.length) {
    ElMessage.warning('没有可导入的数据')
    return
  }
  const isMaterialsImport = isMaterialsImportContext(context, target)
  const labelToProp = new Map((context?.columns || []).map(col => [col.label, col.prop]))
  const categories = Array.isArray(context?.materialsCategories) ? context.materialsCategories : []
  const categoryMap = new Map()
  const buildCategoryMap = (list, parentName = '') => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      const label = String(item?.label || '').trim()
      const id = String(item?.id || '').trim()
      if (!label || !id) return
      const fullName = parentName ? `${parentName}-${label}` : label
      categoryMap.set(label, id)
      categoryMap.set(fullName, id)
      if (Array.isArray(item.children)) {
        buildCategoryMap(item.children, fullName)
      }
    })
  }
  buildCategoryMap(categories)
  const getRowValue = (row, prop, labels = []) => {
    if (row[prop] !== undefined && row[prop] !== null && row[prop] !== '') return row[prop]
    for (const label of labels) {
      if (row[label] !== undefined && row[label] !== null && row[label] !== '') return row[label]
      const mapped = labelToProp.get(label)
      if (mapped && row[mapped] !== undefined && row[mapped] !== null && row[mapped] !== '') return row[mapped]
    }
    return ''
  }
  const parseSeq = (code) => {
    if (!code) return 0
    const parts = String(code).split('.')
    const tail = parts[parts.length - 1]
    const num = Number(tail)
    return Number.isFinite(num) ? num : 0
  }
  const nextSeqMap = new Map()
  const fetchNextCode = async (prefix) => {
    if (nextSeqMap.has(prefix)) {
      const next = nextSeqMap.get(prefix) + 1
      nextSeqMap.set(prefix, next)
      return `${prefix}.${String(next).padStart(4, '0')}`
    }
    const token = getAuthToken()
    const headers = { 'Accept': 'application/json', 'Accept-Profile': 'public' }
    if (token) headers.Authorization = `Bearer ${token}`
    const likePattern = `${prefix}.%`
    const url = `/api/raw_materials?select=batch_no&batch_no=like.${encodeURIComponent(
      likePattern
    )}&order=batch_no.desc&limit=1`
    const res = await fetch(url, { headers })
    const data = res.ok ? await res.json() : []
    const latest = Array.isArray(data) && data.length ? data[0].batch_no : ''
    const next = parseSeq(latest) + 1
    nextSeqMap.set(prefix, next)
    return `${prefix}.${String(next).padStart(4, '0')}`
  }

  let skipped = 0
  const cleanedRows = []
  if (isMaterialsImport) {
    for (const row of sourceRows) {
      const name = getRowValue(row, 'name', ['物料名称', '名称'])
      if (!name) {
        skipped += 1
        continue
      }
      const categoryRaw = getRowValue(row, 'category', ['物料分类', '物料分类编码'])
      const categoryCode = typeof categoryRaw === 'string'
        ? (categoryMap.get(categoryRaw.trim()) || categoryRaw.trim())
        : categoryRaw
      if (categoryCode) row.category = categoryCode
      const batchNo = getRowValue(row, 'batch_no', ['物料编码'])
      if (!batchNo) {
        if (!categoryCode) {
          skipped += 1
          continue
        }
        row.batch_no = await fetchNextCode(categoryCode)
      }
      if (currentUser) {
        row.created_by = currentUser
      }
      row.name = name
      cleanedRows.push(row)
    }
  } else {
    const genericImport = prepareGenericImportRows(sourceRows, context, target)
    cleanedRows.push(...genericImport.rows)
    skipped = genericImport.skipped
  }

  if (!cleanedRows.length) {
    ElMessage.warning('导入数据格式不正确')
    return
  }

  const payload = buildImportPayload(cleanedRows, context)
  if (currentUser && shouldAttachCurrentUser(context)) {
    payload.forEach((item) => {
      if (!item.created_by) item.created_by = currentUser
    })
  }
  if (!payload.length) {
    if (skipped === 0) {
      skipped = sourceRows.length
    }
    ElMessage.warning('导入数据格式不正确')
    return
  }
  importState.value[messageKey] = 'importing'
  try {
    if (token && isTokenExpired(token)) {
      importState.value[messageKey] = 'error'
      ElMessage.error('登录已过期，请重新登录后再导入')
      return
    }
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    if (target.profile) {
      headers['Accept-Profile'] = target.profile
      headers['Content-Profile'] = target.profile
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const url = target.apiUrl.startsWith('/api') ? target.apiUrl : `/api${target.apiUrl}`
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
    if (res.status === 401) {
      importState.value[messageKey] = 'error'
      ElMessage.error('登录已过期，请重新登录后再导入')
      return
    }
    if (!res.ok) throw new Error(`导入失败: ${res.status}`)
    importState.value[messageKey] = 'done'
    const skippedReason = isMaterialsImport ? '物料名称或分类缺失' : '空行或无有效字段'
    const extra = skipped > 0 ? `，跳过 ${skipped} 行（${skippedReason}）` : ''
    ElMessage.success(`已导入 ${payload.length} 行${extra}`)
    const event = new CustomEvent('eis-grid-imported', { detail: { viewId: target.viewId } })
    window.dispatchEvent(event)
  } catch (e) {
    importState.value[messageKey] = 'error'
    ElMessage.error('导入失败')
  }
}

const saveSystemConfig = async (key, value) => {
  const token = getAuthToken()
  if (token && isTokenExpired(token)) {
    throw new Error('登录已过期')
  }
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public',
    'Prefer': 'resolution=merge-duplicates'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/system_configs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value })
  })
  if (res.status === 401) throw new Error('登录已过期')
  if (!res.ok) throw new Error('保存失败')
}

const getNextSegment = (siblings = []) => {
  let max = 0
  siblings.forEach((item) => {
    const id = String(item?.id || '')
    const segment = id.split('.').pop()
    const num = Number(segment)
    if (Number.isFinite(num) && num > max) max = num
  })
  return String(max + 1).padStart(2, '0')
}

const assignCategoryCodes = (items = [], siblings = [], parentId = '', level = 1, maxDepth = 2) => {
  if (!Array.isArray(items)) return []
  if (level > maxDepth) return []
  const localSiblings = Array.isArray(siblings) ? siblings : []
  const assigned = []
  items.forEach((item) => {
    const label = String(item?.label || item?.name || '').trim()
    if (!label) return
    const segment = getNextSegment(localSiblings.concat(assigned))
    const id = parentId ? `${parentId}.${segment}` : segment
    const children = assignCategoryCodes(item?.children || [], [], id, level + 1, maxDepth)
    assigned.push({ id, label, children: children.length ? children : undefined })
  })
  return assigned
}

const applyCategoryImport = async (info, messageKey) => {
  if (categoryImportState.value[messageKey] === 'done') return
  const list = info?.data || []
  if (!Array.isArray(list) || list.length === 0) {
    ElMessage.warning('没有可保存的物料分类')
    return
  }
  categoryImportState.value[messageKey] = 'importing'
  try {
    const existingRes = await fetch('/api/system_configs?key=eq.materials_categories', {
      headers: { 'Accept-Profile': 'public' }
    })
    const existingJson = existingRes.ok ? await existingRes.json() : []
    const existingRow = Array.isArray(existingJson) && existingJson.length ? existingJson[0] : null
    const existingList = Array.isArray(existingRow?.value) ? existingRow.value : []
    const maxDepth = Number(aiBridge.state.currentContext?.materialsCategoryDepth || 2) === 3 ? 3 : 2
    const appended = assignCategoryCodes(list, existingList, '', 1, maxDepth)
    const nextList = existingList.concat(appended)
    await saveSystemConfig('materials_categories', nextList)
    categoryImportState.value[messageKey] = 'done'
    ElMessage.success('物料分类已保存')
    window.dispatchEvent(new CustomEvent('eis-materials-categories-updated', { detail: { list: nextList } }))
  } catch (e) {
    categoryImportState.value[messageKey] = 'error'
    ElMessage.error(e?.message || '保存失败')
  }
}

const resolveAssociatedTable = (meta = {}) => {
  const raw = meta?.associated_table || meta?.associatedTable || ''
  if (raw) return normalizeWorkflowAssociatedTable(raw)
  const context = aiBridge.state.currentContext || {}
  const fallback = context?.workflowAssociatedTable || context?.associatedTable || ''
  if (fallback) return normalizeWorkflowAssociatedTable(fallback)
  const apiUrl = context?.apiUrl || context?.importTarget?.apiUrl || ''
  if (!apiUrl) return ''
  const cleaned = String(apiUrl).replace(/^\/api/, '').replace(/^\//, '')
  return cleaned ? normalizeWorkflowAssociatedTable(`public.${cleaned}`) : ''
}

const WORKFLOW_TABLE_ALIASES = {
  archives: 'hr.archives',
  'hr_archives': 'hr.archives',
  employee_changes: 'hr.employee_changes',
  attendance_records: 'hr.attendance_records',
  users: 'public.users',
  raw_materials: 'public.raw_materials',
  inventory_drafts: 'scm.inventory_drafts',
  production_work_orders: 'scm.production_work_orders',
  sales_orders: 'public.sales_orders',
  purchase_demands: 'public.purchase_demands'
}

const WORKFLOW_TABLE_BINDINGS = {
  'hr.archives': 'legacy:hr_employee',
  'hr.employee_changes': 'legacy:hr_change',
  'hr.attendance_records': 'legacy:hr_attendance',
  'public.users': 'legacy:hr_user',
  'public.raw_materials': 'legacy:mms_ledger',
  'scm.inventory_drafts': 'legacy:mms_inventory_stock_in',
  'scm.production_work_orders': 'legacy:production_work_order',
  'public.sales_orders': 'legacy:sales_order',
  'public.purchase_demands': 'legacy:purchase_demand'
}

const normalizeWorkflowAssociatedTable = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withoutApi = raw.replace(/^\/api\//, '').replace(/^\/api/, '').replace(/^\//, '')
  const table = withoutApi.includes('?') ? withoutApi.split('?')[0] : withoutApi
  const normalized = table.replace(/\//g, '.').trim()
  if (!normalized) return ''
  const lower = normalized.toLowerCase()
  if (WORKFLOW_TABLE_ALIASES[lower]) return WORKFLOW_TABLE_ALIASES[lower]
  if (normalized.includes('.')) return normalized
  return WORKFLOW_TABLE_ALIASES[lower] || `public.${normalized}`
}

const normalizeWorkflowList = (value) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/[,\s，、;；]+/).map(item => item.trim()).filter(Boolean)
  }
  return []
}

const normalizeWorkflowBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y', '是', '需要'].includes(text)) return true
    if (['false', '0', 'no', 'n', '否', '不需要'].includes(text)) return false
  }
  return fallback
}

const toWorkflowArray = (value) => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => (
      item && typeof item === 'object'
        ? { ...item, task_id: item.task_id || item.taskId || item.bpmn_task_id || key }
        : { task_id: key, value: item }
    ))
  }
  return []
}

const normalizeWorkflowBindingValue = (value, associatedTable = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('legacy:')) return raw
  if (raw.startsWith('table:')) {
    const table = normalizeWorkflowAssociatedTable(raw.slice('table:'.length))
    return table ? `table:${table}` : ''
  }
  const table = normalizeWorkflowAssociatedTable(raw)
  return WORKFLOW_TABLE_BINDINGS[table] || raw
}

const inferWorkflowBusinessAppId = (meta = {}, associatedTable = '') => {
  const explicit = meta.workflowBusinessAppId
    || meta.workflow_business_app_id
    || meta.business_app_id
    || meta.businessAppId
    || meta.binding
  if (explicit) return normalizeWorkflowBindingValue(explicit, associatedTable)
  const table = normalizeWorkflowAssociatedTable(associatedTable)
  return WORKFLOW_TABLE_BINDINGS[table] || (table ? `table:${table}` : '')
}

const normalizeWorkflowTaskBindings = (meta = {}, globalBinding = '') => {
  const source = meta.workflowTaskBusinessAppBindings
    || meta.workflow_task_business_app_bindings
    || meta.task_business_app_bindings
    || meta.taskBusinessAppBindings
    || {}
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const next = {}
  Object.entries(source).forEach(([taskId, binding]) => {
    const key = String(taskId || '').trim()
    const value = normalizeWorkflowBindingValue(binding)
    if (key && value && value !== globalBinding) next[key] = value
  })
  return next
}

const getWorkflowProfileHeaders = (token, prefer = '') => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Profile': 'workflow',
    'Content-Profile': 'workflow'
  }
  if (prefer) headers.Prefer = prefer
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const getAppCenterProfileHeaders = (token, prefer = '') => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Profile': 'app_center',
    'Content-Profile': 'app_center'
  }
  if (prefer) headers.Prefer = prefer
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const parseResponseJson = async (res) => {
  try {
    return await res.json()
  } catch (e) {
    return null
  }
}

const assertWorkflowSaveResponse = async (res, label) => {
  if (res.ok) return
  let detail = ''
  try {
    detail = String(await res.text()).slice(0, 180)
  } catch (e) {}
  throw new Error(`${label}失败: ${res.status}${detail ? ` ${detail}` : ''}`)
}

const getFirstRow = (data) => Array.isArray(data) ? (data[0] || null) : (data || null)

const buildWorkflowAclModule = (appId) => {
  const raw = String(appId || '').replace(/-/g, '').trim()
  return raw ? `app_${raw}` : ''
}

const buildWorkflowOps = (moduleKey) => {
  if (!moduleKey) return {}
  return {
    create: `op:${moduleKey}.create`,
    edit: `op:${moduleKey}.edit`,
    delete: `op:${moduleKey}.delete`,
    export: `op:${moduleKey}.export`,
    config: `op:${moduleKey}.config`,
    workflowStart: `op:${moduleKey}.workflow_start`,
    workflowTransition: `op:${moduleKey}.workflow_transition`,
    workflowComplete: `op:${moduleKey}.workflow_complete`
  }
}

const createWorkflowAppFromAi = async ({ name, description, xml, associatedTable, businessAppId, taskBindings, meta, token, username }) => {
  const now = new Date().toISOString()
  const appPayload = {
    name,
    description,
    category_id: 1,
    app_type: 'workflow',
    status: 'draft',
    icon: '🔀',
    version: '1.0.0',
    bpmn_xml: xml,
    source_code: {
      ai: {
        source: 'ai_copilot',
        saved_at: now,
        meta
      }
    },
    config: {
      table: associatedTable || null,
      workflowBusinessAppId: businessAppId || null,
      workflowTaskBusinessAppBindings: taskBindings || {},
      workflowAutoAdvanceEnabled: normalizeWorkflowBool(meta?.workflowAutoAdvanceEnabled ?? meta?.workflow_auto_advance_enabled, false),
      workflowDesignerPanelMode: 'simple',
      aiGenerated: true
    },
    created_by: username || 'ai_copilot',
    updated_by: username || 'ai_copilot',
    created_at: now,
    updated_at: now
  }
  const res = await fetch('/api/apps', {
    method: 'POST',
    headers: getAppCenterProfileHeaders(token, 'return=representation'),
    body: JSON.stringify(appPayload)
  })
  await assertWorkflowSaveResponse(res, '创建流程应用')
  return getFirstRow(await parseResponseJson(res))
}

const createWorkflowDefinitionForApp = async ({ appId, name, xml, associatedTable, token }) => {
  const payload = {
    name,
    bpmn_xml: xml,
    associated_table: associatedTable || null,
    app_id: appId
  }
  const res = await fetch('/api/definitions', {
    method: 'POST',
    headers: getWorkflowProfileHeaders(token, 'return=representation'),
    body: JSON.stringify(payload)
  })
  await assertWorkflowSaveResponse(res, '写入流程定义')
  return getFirstRow(await parseResponseJson(res))
}

const patchWorkflowAppDefinitionId = async ({ appId, definitionId, xml, associatedTable, businessAppId, taskBindings, meta, token }) => {
  const aclModule = buildWorkflowAclModule(appId)
  const config = {
    table: associatedTable || null,
    workflowDefinitionId: definitionId || null,
    workflowBusinessAppId: businessAppId || null,
    workflowTaskBusinessAppBindings: taskBindings || {},
    workflowAutoAdvanceEnabled: normalizeWorkflowBool(meta?.workflowAutoAdvanceEnabled ?? meta?.workflow_auto_advance_enabled, false),
    workflowDesignerPanelMode: 'simple',
    aiGenerated: true,
    aclModule,
    perm: aclModule ? `app:${aclModule}` : '',
    ops: buildWorkflowOps(aclModule)
  }
  const res = await fetch(`/api/apps?id=eq.${encodeURIComponent(appId)}`, {
    method: 'PATCH',
    headers: getAppCenterProfileHeaders(token, 'return=representation'),
    body: JSON.stringify({
      bpmn_xml: xml,
      config,
      updated_at: new Date().toISOString()
    })
  })
  await assertWorkflowSaveResponse(res, '回写流程应用配置')
  return getFirstRow(await parseResponseJson(res))
}

const normalizeWorkflowAssignmentRows = (meta = {}, definitionId) => {
  const source = meta.task_assignments || meta.taskAssignments || meta.assignments || []
  return toWorkflowArray(source)
    .map((item) => {
      const taskId = String(item?.task_id || item?.taskId || item?.bpmn_task_id || item?.id || '').trim()
      if (!taskId) return null
      const approvalMode = String(item?.approval_mode || item?.approvalMode || 'any').trim().toLowerCase()
      const requiredApprovals = Number(item?.required_approvals || item?.requiredApprovals || 1)
      return {
        definition_id: definitionId,
        task_id: taskId,
        candidate_roles: normalizeWorkflowList(item?.candidate_roles || item?.candidateRoles || item?.roles),
        candidate_users: normalizeWorkflowList(item?.candidate_users || item?.candidateUsers || item?.users),
        approval_mode: ['any', 'quota', 'all'].includes(approvalMode) ? approvalMode : 'any',
        required_approvals: Number.isFinite(requiredApprovals) && requiredApprovals > 0 ? Math.floor(requiredApprovals) : 1,
        require_comment: normalizeWorkflowBool(item?.require_comment ?? item?.requireComment, false)
      }
    })
    .filter(Boolean)
}

const saveWorkflowAssignments = async ({ meta, definitionId, token }) => {
  const rows = normalizeWorkflowAssignmentRows(meta, definitionId)
  if (!rows.length) return 0
  const res = await fetch('/api/task_assignments', {
    method: 'POST',
    headers: getWorkflowProfileHeaders(token, 'return=representation'),
    body: JSON.stringify(rows)
  })
  await assertWorkflowSaveResponse(res, '写入任务分派')
  const data = await parseResponseJson(res)
  return Array.isArray(data) ? data.length : rows.length
}

const normalizeWorkflowStateMappingRows = (meta = {}, workflowAppId, associatedTable = '') => {
  const source = meta.state_mappings || meta.stateMappings || meta.workflow_state_mappings || meta.workflowStateMappings || []
  const fallbackTable = normalizeWorkflowAssociatedTable(associatedTable)
  return toWorkflowArray(source)
    .map((item) => {
      const taskId = String(item?.bpmn_task_id || item?.bpmnTaskId || item?.task_id || item?.taskId || item?.id || '').trim()
      const stateValue = String(item?.state_value ?? item?.stateValue ?? item?.status ?? item?.value ?? '').trim()
      if (!taskId || !stateValue) return null
      const targetTable = normalizeWorkflowAssociatedTable(item?.target_table || item?.targetTable || item?.table || fallbackTable)
      return {
        workflow_app_id: workflowAppId,
        bpmn_task_id: taskId,
        target_table: targetTable || fallbackTable || null,
        state_field: String(item?.state_field || item?.stateField || 'status').trim() || 'status',
        state_value: stateValue
      }
    })
    .filter(item => item && item.target_table)
}

const saveWorkflowStateMappings = async ({ meta, workflowAppId, associatedTable, token }) => {
  const rows = normalizeWorkflowStateMappingRows(meta, workflowAppId, associatedTable)
  if (!rows.length) return 0
  const res = await fetch('/api/workflow_state_mappings?on_conflict=workflow_app_id,bpmn_task_id', {
    method: 'POST',
    headers: getAppCenterProfileHeaders(token, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(rows)
  })
  await assertWorkflowSaveResponse(res, '写入状态映射')
  const data = await parseResponseJson(res)
  return Array.isArray(data) ? data.length : rows.length
}

const saveWorkflowDefinition = async (info, messageKey) => {
  if (!info?.xml) return
  if (workflowSaveState.value[messageKey] === 'saved') return
  workflowSaveState.value[messageKey] = 'saving'
  try {
    const token = getAuthToken()
    if (token && isTokenExpired(token)) {
      workflowSaveState.value[messageKey] = 'error'
      ElMessage.error('登录已过期')
      return
    }
    const meta = info?.meta || {}
    const name = String(meta?.name || meta?.title || 'AI流程').trim() || 'AI流程'
    const associatedTable = resolveAssociatedTable(meta)
    const businessAppId = inferWorkflowBusinessAppId(meta, associatedTable)
    const taskBindings = normalizeWorkflowTaskBindings(meta, businessAppId)
    const username = getTokenUsername(token)
    const app = await createWorkflowAppFromAi({
      name,
      description: meta?.description || '由工作助手生成的流程应用',
      xml: info.xml,
      associatedTable,
      businessAppId,
      taskBindings,
      meta,
      token,
      username
    })
    const appId = app?.id
    if (!appId) throw new Error('创建流程应用失败：未返回应用ID')
    const definition = await createWorkflowDefinitionForApp({
      appId,
      name,
      xml: info.xml,
      associatedTable,
      token
    })
    const definitionId = definition?.id || null
    await patchWorkflowAppDefinitionId({
      appId,
      definitionId,
      xml: info.xml,
      associatedTable,
      businessAppId,
      taskBindings,
      meta,
      token
    })
    if (definitionId) {
      await saveWorkflowAssignments({ meta, definitionId, token })
    }
    await saveWorkflowStateMappings({ meta, workflowAppId: appId, associatedTable, token })
    workflowSaveState.value[messageKey] = 'saved'
    ElMessage.success('流程已保存为应用中心流程应用')
    window.dispatchEvent(new CustomEvent('eis-workflow-app-created', {
      detail: { appId, definitionId, name, associatedTable, businessAppId }
    }))
  } catch (e) {
    workflowSaveState.value[messageKey] = 'error'
    ElMessage.error(e?.message || '流程保存失败')
  }
}

const copyWorkflowXml = async (xml) => {
  if (!xml) return
  try {
    await navigator.clipboard.writeText(xml)
    ElMessage.success('XML 已复制')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

const validateEchartsOption = (option) => {
  if (!option || !option.series || !Array.isArray(option.series) || option.series.length === 0) {
    return '图表配置缺少必要的 series 数据'
  }
  return ''
}

const REPORT_FILLER_LINE_RE = /^(好的|当然|收到|已收到|明白|了解|下面|以下|我将|我会|请查看|这里是|先给出|先汇总).{0,120}(智能\s*BI|经营分析|经营报告|分析报告|报告|图表|洞察|结论)/
const REPORT_FILLER_SENTENCE_RE = /(好的|当然|收到|已收到|明白|了解)[，,。！!\s].{0,100}(智能\s*BI|经营分析|经营报告|分析报告|报告)/

const shouldShowReportDownload = (msg, index) => {
  if (!isEnterprise.value) return false
  if (msg?.role !== 'assistant') return false
  if (isStreamingMessage(index)) return false
  return Boolean(String(msg?.content || '').trim())
}

const normalizeInlineText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const isReportFillerLine = (text) => {
  const value = normalizeInlineText(text)
  if (!value) return false
  return REPORT_FILLER_LINE_RE.test(value) || REPORT_FILLER_SENTENCE_RE.test(value)
}

const stripReportLeadPreamble = (bubbleNode) => {
  const markdownNode = bubbleNode ? bubbleNode.querySelector('.markdown-body') : null
  if (!markdownNode) return
  const nodes = Array.from(markdownNode.childNodes || [])
  let scanned = 0
  for (const node of nodes) {
    if (scanned >= 12) break
    scanned += 1
    if (node.nodeType === 3 && !normalizeInlineText(node.textContent)) {
      node.remove()
      continue
    }
    if (node.nodeType === 3) {
      const text = normalizeInlineText(node.textContent)
      if (isReportFillerLine(text) && text.length <= 180) {
        node.remove()
      }
      continue
    }
    if (node.nodeType === 1) {
      const text = normalizeInlineText(node.textContent)
      if (!text) {
        node.remove()
        continue
      }
      const tag = String(node.tagName || '').toLowerCase()
      const canTrim = tag === 'p' || tag === 'div' || tag === 'span'
      if (canTrim && isReportFillerLine(text) && text.length <= 180) {
        node.remove()
        continue
      }
      if (canTrim && REPORT_FILLER_SENTENCE_RE.test(text) && text.length <= 200) {
        const cleaned = normalizeInlineText(text.replace(REPORT_FILLER_SENTENCE_RE, ''))
        if (!cleaned) {
          node.remove()
        } else {
          node.textContent = cleaned
        }
      }
    }
  }
}

const buildPrintableHtmlForMessage = async (messageIndex) => {
  const sourceRow = messagesRef.value
    ? messagesRef.value.querySelector(`.message-row[data-message-index="${messageIndex}"]`)
    : null
  const sourceBubble = sourceRow ? sourceRow.querySelector('.bubble') : null
  if (!sourceBubble) return ''

  const printableBubble = sourceBubble.cloneNode(true)
  printableBubble.querySelectorAll('.msg-actions').forEach(node => node.remove())
  printableBubble.querySelectorAll('.typing-cursor').forEach(node => node.remove())
  printableBubble.querySelectorAll('.chart-error, .chart-details, .chart-retry, .chart-inline-status').forEach(node => node.remove())

  stripReportLeadPreamble(printableBubble)

  const printableCharts = Array.from(printableBubble.querySelectorAll('.echarts-chart'))
  const sourceCharts = Array.from(sourceBubble.querySelectorAll('.echarts-chart'))
  if (printableCharts.length && echartsModulePromise) {
    const echarts = await echartsModulePromise
    printableCharts.forEach((node, index) => {
      const liveNode = sourceCharts[index]
      const instance = liveNode ? echarts.getInstanceByDom(liveNode) : null
      if (!instance) return
      const dataUrl = instance.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' })
      const img = document.createElement('img')
      img.src = dataUrl
      img.style.maxWidth = '100%'
      img.style.display = 'block'
      node.replaceWith(img)
    })
  }
  printableBubble.querySelectorAll('.echarts-chart, .mermaid-chart').forEach((node) => node.remove())

  return printableBubble.innerHTML
}

const exportMessageReportAsPdf = async (messageIndex) => {
  const html = await buildPrintableHtmlForMessage(messageIndex)
  if (!html) {
    ElMessage.warning('当前消息没有可导出的报告内容')
    return
  }

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`<!DOCTYPE html>
    <html>
      <head>
        <title>智能 BI 报告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #303133; }
          .report-content { background: #fff; }
          .markdown-body p { margin: 0 0 8px; line-height: 1.7; }
          .markdown-body pre { background: #f5f7fa; padding: 10px; border-radius: 6px; overflow: auto; }
          .markdown-body table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .markdown-body th, .markdown-body td { border: 1px solid #ebeef5; padding: 6px 8px; text-align: left; }
          .mermaid-chart svg { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h2>智能 BI 报告</h2>
        <div class="report-content">${html}</div>
      </body>
    </html>`)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 500)
}

const openLightbox = async (type, payload) => {
  const safePayload = type === 'mermaid' ? sanitizeSvg(payload) : payload
  lightbox.value = { visible: true, type, payload: safePayload }
  await nextTick()
  if (type === 'echarts' && lightboxChartRef.value) {
    if (lightboxChart) {
      lightboxChart.dispose()
    }
    const echarts = await loadEcharts()
    lightboxChart = echarts.init(lightboxChartRef.value)
    lightboxChart.setOption(payload)
  }
}

const closeLightbox = () => {
  lightbox.value = { visible: false, type: '', payload: null }
  if (lightboxChart) {
    lightboxChart.dispose()
    lightboxChart = null
  }
}

const clearChartResizeTimer = (node) => {
  if (!node) return
  const timer = chartResizeTimers.get(node)
  if (timer) {
    clearTimeout(timer)
    chartResizeTimers.delete(node)
  }
}

const shouldSkipChartResize = (node) => {
  if (!node) return true
  return node.classList.contains('is-rendering') ||
    node.classList.contains('chart-pending') ||
    node.classList.contains('is-retrying')
}

const queueNodeChartResize = (node, delay = 60) => {
  if (!node || shouldSkipChartResize(node)) return
  clearChartResizeTimer(node)
  const timer = setTimeout(() => {
    clearChartResizeTimer(node)
    if (shouldSkipChartResize(node)) return
    void loadEcharts().then((echarts) => {
      const chart = echarts.getInstanceByDom(node)
      if (!chart) return
      requestAnimationFrame(() => {
        try {
          chart.resize()
        } catch (e) {
          if (typeof window !== 'undefined' && window.__EIS_DEBUG__) {
            console.warn('[AiCopilot] chart.resize skipped', e)
          }
        }
      })
    })
  }, Math.max(20, delay))
  chartResizeTimers.set(node, timer)
}

const scheduleResizeAllCharts = () => {
  if (typeof window === 'undefined') return
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId)
  }
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = 0
    document.querySelectorAll('.echarts-chart[data-processed="true"]').forEach((node) => {
      queueNodeChartResize(node, 72)
    })
  })
}

const getChartResizeObserver = () => {
  if (chartResizeObserver || typeof ResizeObserver === 'undefined') return chartResizeObserver
  chartResizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      queueNodeChartResize(entry.target, 96)
    })
  })
  return chartResizeObserver
}

const observeChartNode = (node) => {
  if (!node) return
  const observer = getChartResizeObserver()
  if (observer) observer.observe(node)
}

const unobserveChartNode = (node) => {
  if (!node) return
  clearChartResizeTimer(node)
  if (!chartResizeObserver) return
  try {
    chartResizeObserver.unobserve(node)
  } catch {}
}

const openAssistant = () => {
  aiBridge.setMode(props.mode)
  aiBridge.openWindow()
}

const closeAssistant = () => {
  if (props.closeRoute) {
    aiBridge.closeWindow()
    router.push(props.closeRoute)
    return
  }
  aiBridge.toggleWindow()
}

const toggleFullscreen = () => {
  if (!isWorker.value) return
  isFullscreen.value = !isFullscreen.value
  try {
    localStorage.setItem(FULLSCREEN_KEY, isFullscreen.value ? '1' : '0')
  } catch {}
}

const renderFallbackEcharts = async (node) => {
  const echarts = await loadEcharts()
  const previous = echarts.getInstanceByDom(node)
  if (previous) previous.dispose()
  unobserveChartNode(node)
  node.innerHTML = ''
  node.classList.add('chart-omitted')
  node.classList.remove('is-rendering')
  node.classList.remove('chart-pending')
  node.classList.remove('is-retrying')
}

const renderMermaidNode = async (node) => {
  try {
    node.setAttribute('data-processed', 'true')
    node.classList.add('is-rendering')
    const text = decodeURIComponent(node.getAttribute('data-raw') || '')
    const mermaid = await loadMermaid()
    await mermaid.parse(text)
    const id = `mermaid-${Date.now()}-${mermaidRenderSeed++}`
    const { svg } = await mermaid.render(id, text)
    const safeSvg = sanitizeSvg(svg)
    node.innerHTML = safeSvg
    await waitTwoFrames()
    node.classList.remove('is-rendering')
    node.classList.remove('chart-pending')
    if (!node.dataset.bound) {
      node.dataset.bound = 'true'
      node.addEventListener('dblclick', () => openLightbox('mermaid', safeSvg))
    }
  } catch (e) {
    node.classList.remove('is-rendering')
    node.classList.remove('chart-pending')
    node.innerHTML = '<div class="chart-inline-status">流程图暂不可用</div>'
  }
}

const renderEchartsNode = async (node, attempt = 0) => {
  const maxRetries = 16
  try {
    node.classList.remove('chart-omitted')
    const hasRendered = node.getAttribute('data-processed') === 'true'
    node.setAttribute('data-processed', 'true')
    if (!hasRendered) {
      node.classList.add('is-rendering')
    }
    const jsonStr = decodeURIComponent(node.getAttribute('data-option') || '')
    const option = parseEchartsOptionSafely(jsonStr)
    if (!option) {
      throw new Error('ECharts JSON parse failed')
    }
    const validationError = validateEchartsOption(option)
    if (validationError) {
      throw new Error(validationError)
    }
    if (isOmittedOption(option)) {
      await renderFallbackEcharts(node)
      return
    }
    const echarts = await loadEcharts()
    const previous = echarts.getInstanceByDom(node)
    if (previous) previous.dispose()
    unobserveChartNode(node)
    node.style.width = '100%'
    node.style.height = '360px'
    const chart = echarts.init(node)
    chart.setOption(option, true)
    await waitTwoFrames()
    node.classList.remove('is-rendering')
    node.classList.remove('chart-pending')
    observeChartNode(node)
    if (!node.dataset.bound) {
      node.dataset.bound = 'true'
      node.addEventListener('dblclick', () => openLightbox('echarts', option))
    }
    queueNodeChartResize(node, 110)
  } catch (e) {
    if (typeof window !== 'undefined' && window.__EIS_DEBUG__) {
      console.warn('[AiCopilot] ECharts render failed', e)
    }
    if (attempt < maxRetries) {
      node.classList.add('is-retrying')
      node.classList.remove('is-rendering')
      await delayMs(240 + attempt * 180)
      return renderEchartsNode(node, attempt + 1)
    }
    await renderFallbackEcharts(node)
  }
}

const renderCharts = async () => {
  await nextTick()

  const mermaidNodes = Array.from(document.querySelectorAll('.mermaid-chart:not([data-processed])'))
  for (const node of mermaidNodes) {
    await renderMermaidNode(node)
  }

  const echartsNodes = Array.from(document.querySelectorAll('.echarts-chart:not([data-processed])'))
  echartsNodes.forEach((node) => {
    void renderEchartsNode(node)
  })
}

onUpdated(renderCharts)

const toggleHistory = () => {
  showHistory.value = !showHistory.value
  if (showHistory.value && isEnterprise.value) {
    historyTab.value = 'sessions'
  }
}

const createSessionFromHistory = () => {
  aiBridge.createNewSession()
  historyTab.value = 'sessions'
}

const handleChatAreaClick = () => {
  showHistory.value = false
}

const switchSession = (id) => {
  aiBridge.switchSession(id)
  if (!isEnterprise.value) {
    showHistory.value = false
  }
}

const emitSmartBiHistoryState = (visible = showHistory.value) => {
  if (typeof window === 'undefined' || !isEnterprise.value) return
  window.dispatchEvent(new CustomEvent('eis-smart-bi-history-state', {
    detail: { visible: Boolean(visible) }
  }))
}

const handleSmartBiToggleHistory = () => {
  if (!isEnterprise.value) return
  showHistory.value = !showHistory.value
  historyTab.value = 'sessions'
}

const handleSmartBiNewSession = () => {
  if (!isEnterprise.value) return
  createSessionFromHistory()
  showHistory.value = false
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const handleEnter = (event) => {
  if (!event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (state.isLoading) return
  const text = state.inputBuffer
  const smartBiContext = isEnterprise.value
    ? buildSmartBiContext(text, {
        reportMode: 'manual_question',
        snapshot: smartBiSnapshot.value || {}
      })
    : null
  aiBridge.sendMessage(text, { smartBiContext })
}

const loadSmartBiSnapshot = async (force = false) => {
  if (!isEnterprise.value) return
  if (smartBiSnapshotLoading.value) return
  if (!force && smartBiSnapshot.value?.snapshotTime) return
  smartBiSnapshotLoading.value = true
  smartBiSnapshotError.value = ''
  try {
    const res = await fetch('/agent/ai/business-snapshot', {
      method: 'GET',
      headers: aiBridge.buildAuthHeaders()
    })
    if (!res.ok) throw new Error(`快照读取失败 (${res.status})`)
    const data = await res.json()
    smartBiSnapshot.value = data?.snapshot || {}
  } catch (error) {
    smartBiSnapshotError.value = error?.message || '快照读取失败'
  } finally {
    smartBiSnapshotLoading.value = false
  }
}

const runSmartBiCard = (card) => {
  const request = buildSmartBiReportRequest(card, smartBiSnapshot.value || {})
  runQuickAction({
    key: `smart_bi_workbench_${card.key}`,
    label: card.label,
    prompt: request.prompt,
    displayText: request.displayText,
    smartBiContext: request.context,
    mode: 'enterprise'
  })
}

const runSmartBiDomain = (domain) => {
  if (!domain?.key) return
  const commonQuestion = SMART_BI_COMMON_QUESTIONS.find(item => item.key === domain.key)
  const prompt = commonQuestion?.prompt || `请分析${domain.label}经营指标，必须包含关键指标、图表、风险和建议。`
  runQuickAction({
    key: `smart_bi_metric_${domain.key}`,
    label: `${domain.label}分析`,
    prompt,
    displayText: `${domain.label}分析`,
    reportMode: 'metric_catalog',
    smartBiContext: buildSmartBiActionContext(prompt, 'metric_catalog'),
    mode: 'enterprise'
  })
}

const runQuickAction = (action) => {
  if (state.isLoading || !action?.prompt) return
  aiBridge.setMode(action.mode || 'worker')
  aiBridge.openWindow()
  const context = aiBridge.state.currentContext
  if (context && action.scene) {
    context.aiScene = action.scene
    if (action.allowImport !== undefined) context.allowImport = !!action.allowImport
    if (action.allowFormula !== undefined) context.allowFormula = !!action.allowFormula
    if (action.allowFormulaOnce !== undefined) context.allowFormulaOnce = !!action.allowFormulaOnce
  }
  const smartBiContext = isEnterprise.value
    ? (action.smartBiContext || buildSmartBiActionContext(action.prompt, action.reportMode || 'common_question'))
    : null
  aiBridge.sendMessage(action.displayText || action.prompt, {
    payloadText: action.prompt,
    smartBiContext
  })
}

const retryMessage = (index) => {
  aiBridge.retryMessageAt(index)
}

watch(() => currentSession.value?.messages.length, scrollToBottom)
watch(() => currentSession.value?.messages[currentSession.value?.messages.length - 1]?.content, scrollToBottom)
watch(() => state.isOpen, (val) => { if (val) scrollToBottom() })
watch(showHistory, (visible) => {
  emitSmartBiHistoryState(visible)
})
watch(() => isWorkerFullscreen.value, () => {
  if (!state.isOpen) return
  setTimeout(() => scheduleResizeAllCharts(), 80)
})

onMounted(() => {
  try {
    isFullscreen.value = localStorage.getItem(FULLSCREEN_KEY) === '1'
  } catch {}
  aiBridge.setMode(props.mode)
  showHistory.value = false
  if (props.autoOpen) {
    aiBridge.openWindow()
  }
  if (isEnterprise.value) {
    void loadSmartBiSnapshot()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleResizeAllCharts)
    window.addEventListener('eis-smart-bi-toggle-history', handleSmartBiToggleHistory)
    window.addEventListener('eis-smart-bi-new-session', handleSmartBiNewSession)
  }
  emitSmartBiHistoryState(false)
})

watch(() => props.mode, (val) => {
  aiBridge.setMode(val)
  showHistory.value = false
  if (val === 'enterprise') void loadSmartBiSnapshot()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', scheduleResizeAllCharts)
    window.removeEventListener('eis-smart-bi-toggle-history', handleSmartBiToggleHistory)
    window.removeEventListener('eis-smart-bi-new-session', handleSmartBiNewSession)
    emitSmartBiHistoryState(false)
  }
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = 0
  }
  Array.from(chartResizeTimers.keys()).forEach((node) => {
    clearChartResizeTimer(node)
  })
  if (echartsModulePromise) {
    void echartsModulePromise.then((echarts) => {
      document.querySelectorAll('.echarts-chart').forEach((node) => {
        unobserveChartNode(node)
        const chart = echarts.getInstanceByDom(node)
        if (chart) chart.dispose()
      })
    })
  }
  if (chartResizeObserver) {
    chartResizeObserver.disconnect()
    chartResizeObserver = null
  }
  if (lightboxChart) {
    lightboxChart.dispose()
    lightboxChart = null
  }
})
</script>

<style scoped lang="scss">
$primary-color: var(--el-color-primary, #409EFF);
$bg-color: #ffffff;
$chat-bg: #f5f7fa;
$border-color: #e4e7ed;

.ai-copilot-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 9999;
  --ai-panel-bg: var(--el-color-primary-light-9, #f5f7fa);
  --ai-panel-surface: #ffffff;
  --ai-panel-border: #e4e7ed;

  &.is-open {
    inset: 0;
  }

  &.is-open.is-worker {
    inset: auto;
    right: 30px;
    top: 80px;
    width: 380px;
    height: calc(100vh - 160px);
    left: auto;
  }

  &.is-open.is-worker.is-fullscreen {
    inset: 0;
    width: 100vw;
    height: 100vh;
    right: 0;
    left: 0;
    top: 0;
    bottom: 0;
  }
}

.ai-trigger-btn {
  width: 60px;
  height: 60px;
  background: $primary-color;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba($primary-color, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  transition: all 0.3s;

  &:hover { transform: translateY(-2px); }
  .sparkle-icon { font-size: 24px; }
  .ai-label { font-size: 10px; font-weight: 600; }
}

.ai-window {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: var(--ai-panel-bg);
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.05);

  &.is-worker {
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }

  &.is-worker.is-fullscreen {
    border-radius: 0;
    box-shadow: none;
  }
}

.ai-header {
  height: 52px;
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  background: var(--ai-panel-surface);

  .header-left {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
    .history-icon.active { transform: rotate(90deg); color: $primary-color; }
    .title { font-weight: 600; font-size: 15px; }
  }
  .header-right {
    display: flex; gap: 12px; font-size: 18px; color: #909399;
    .el-icon { cursor: pointer; &:hover { color: $primary-color; } }
  }
}

.ai-body { flex: 1; display: flex; position: relative; overflow: hidden; }

.history-sidebar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: min(260px, 82vw);
  background: var(--el-bg-color, #fff);
  border-right: 1px solid $border-color;
  box-shadow: 12px 0 28px rgba(15, 23, 42, 0.08);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
  &.show { transform: translateX(0); }

  .sidebar-content { min-width: 0; height: 100%; display: flex; flex-direction: column; }
}

.worker-history-sidebar {
  padding: 0;

  .sidebar-header {
    padding: 14px;
    border-bottom: 1px solid $border-color;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .sidebar-title {
    font-weight: 650;
    color: #303133;
    font-size: 14px;
    line-height: 1.3;
  }

  .sidebar-count {
    margin-top: 2px;
    color: #909399;
    font-size: 12px;
  }

  .sidebar-new-btn {
    width: 28px;
    height: 28px;
    flex: none;
  }
}

.sidebar-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.el-tabs__content) {
    flex: 1;
    overflow-y: auto;
  }

  :deep(.el-tabs__header) {
    margin-bottom: 8px;
  }
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
  }

  &.active {
    background: var(--el-color-primary-light-9, #ecf5ff);
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-title {
    display: block;
    font-size: 13px;
    color: var(--el-text-color-primary, #303133);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-time {
    display: block;
    font-size: 11px;
    color: var(--el-text-color-placeholder, #a8abb2);
    margin-top: 2px;
  }

  .session-delete {
    opacity: 0;
    color: var(--el-text-color-placeholder, #a8abb2);
    cursor: pointer;
    transition: opacity 0.15s;

    &:hover {
      color: var(--el-color-danger, #f56c6c);
    }
  }

  &:hover .session-delete {
    opacity: 1;
  }
}

.metric-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
  }

  .metric-info {
    flex: 1;
    min-width: 0;
  }

  .metric-name {
    display: block;
    font-size: 13px;
    color: var(--el-text-color-primary, #303133);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metric-desc {
    display: block;
    font-size: 11px;
    color: var(--el-text-color-placeholder, #a8abb2);
    margin-top: 2px;
  }

  .metric-icon {
    color: var(--el-color-primary, #409EFF);
    margin-left: 6px;
  }
}

.worker-history-sidebar {
  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :deep(.el-empty) {
    padding: 24px 0;
  }
}

.chat-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--ai-panel-bg);
  width: 100%;
}

.messages-container {
  flex: 1; overflow-y: auto; padding: 28px; display: flex; flex-direction: column; gap: 18px;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
}

.smart-bi-workbench {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(100%, 1180px);
  align-self: center;
}

.smart-bi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.smart-bi-title {
  font-size: 16px;
  font-weight: 650;
  color: #1f2d3d;
}

.smart-bi-meta {
  margin-top: 3px;
  font-size: 12px;
  color: #909399;
}

.smart-bi-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.smart-bi-card {
  appearance: none;
  border: 1px solid #e4e7ed;
  border-left-width: 3px;
  background: #fff;
  border-radius: 8px;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  min-height: 162px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5, #a0cfff);
    box-shadow: 0 8px 22px rgba(31, 45, 61, 0.08);
    transform: translateY(-1px);
  }

  .card-top,
  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .card-label {
    color: #303133;
    font-size: 14px;
    font-weight: 650;
  }

  .card-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid rgba(103, 194, 58, 0.28);
    background: rgba(103, 194, 58, 0.1);
    color: #529b2e;
    font-size: 12px;
    font-weight: 650;
    flex-shrink: 0;
  }

  .card-status[data-risk='focus'] {
    border-color: rgba(64, 158, 255, 0.28);
    background: rgba(64, 158, 255, 0.1);
    color: #337ecc;
  }

  .card-status[data-risk='warning'] {
    border-color: rgba(230, 162, 60, 0.3);
    background: rgba(230, 162, 60, 0.12);
    color: #b88230;
  }

  .card-status[data-risk='critical'] {
    border-color: rgba(245, 108, 108, 0.3);
    background: rgba(245, 108, 108, 0.12);
    color: #c45656;
  }

  .card-value {
    color: #1f2d3d;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.15;
  }

  .card-metric,
  .card-foot {
    color: #606266;
    font-size: 12px;
  }

  .card-rule {
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: #909399;
    font-size: 11px;
    line-height: 1.35;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .card-risk {
    color: #606266;
    font-size: 11px;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-foot {
    margin-top: auto;
    color: #909399;
  }
}

.smart-bi-card.risk-normal {
  border-left-color: #67c23a;
}

.smart-bi-card.risk-normal:hover {
  border-left-color: #67c23a;
}

.smart-bi-card.risk-focus {
  border-left-color: #409eff;
}

.smart-bi-card.risk-focus:hover {
  border-left-color: #409eff;
}

.smart-bi-card.risk-warning {
  border-left-color: #e6a23c;
}

.smart-bi-card.risk-warning:hover {
  border-left-color: #e6a23c;
}

.smart-bi-card.risk-critical {
  border-left-color: #f56c6c;
}

.smart-bi-card.risk-critical:hover {
  border-left-color: #f56c6c;
}

.message-row {
  display: flex; gap: 12px;
  &.user { flex-direction: row-reverse; }

  .avatar {
    width: 32px; height: 32px; border-radius: 8px; background: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  &.user .avatar { background: $primary-color; color: white; }

  .content-wrapper {
    max-width: 85%; display: flex; flex-direction: column;
  }
  &.assistant .content-wrapper {
    width: min(85%, 1200px);
  }

  .msg-files {
    display: flex; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
    .msg-img { max-width: 200px; height: auto; border-radius: 8px; border: 1px solid $border-color; background: #fff; }
    .doc-file {
      padding: 8px 12px; background: #fff; border: 1px solid $border-color; border-radius: 8px;
      display: flex; align-items: center; gap: 6px; font-size: 12px;
    }
  }

  .bubble {
    padding: 14px 20px; border-radius: 12px; font-size: 14px; line-height: 1.7;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05); background: #fff; color: #303133;
    position: relative;
  }
  &.assistant .bubble {
    width: 100%;
  }
  &.user .bubble { background: $primary-color; color: #fff; border-top-right-radius: 2px; }
  &.assistant .bubble { border-top-left-radius: 2px; }

  .msg-actions {
    margin-top: 4px; opacity: 0; transition: opacity 0.2s; display: flex; gap: 4px;
  }
  &:hover .msg-actions { opacity: 1; }
}

.input-section {
  background: var(--ai-panel-surface); border-top: 1px solid $border-color; padding: 12px;

  .file-preview-bar {
    display: flex; gap: 8px; margin-bottom: 8px; overflow-x: auto; padding-bottom: 4px;
    .preview-item {
      position: relative; width: 48px; height: 48px; flex-shrink: 0;
      border-radius: 6px; border: 1px solid $border-color; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
      .doc-preview { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f0f2f5; }
      .remove-btn {
        position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.5); color: #fff;
        width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;
        font-size: 10px; cursor: pointer;
      }
    }
  }

  .quick-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;

    :deep(.el-button) {
      margin-left: 0;
      border-radius: 999px;
      background: #fff;
      color: #606266;
    }
  }

  .smart-bi-route-preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    margin-bottom: 8px;
    padding: 4px 8px;
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    border-radius: 999px;
    background: #fff;
    color: var(--el-text-color-regular, #606266);
    font-size: 12px;
    line-height: 1.4;
    vertical-align: top;

    .route-label {
      color: var(--el-text-color-placeholder, #a8abb2);
    }

    .route-domain {
      font-weight: 650;
      color: var(--el-color-primary, #409EFF);
    }

    .route-keywords {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &[data-confidence="low"] .route-domain {
      color: var(--el-color-warning, #e6a23c);
    }
  }

  .input-box {
    display: flex; align-items: flex-end;
    gap: 10px; background: #f5f7fa; border-radius: 16px; padding: 10px 10px 10px 14px;
    border: 1px solid transparent; transition: all 0.2s;

    &:focus-within { background: #fff; border-color: $primary-color; box-shadow: 0 0 0 2px rgba($primary-color, 0.1); }

    .upload-trigger { display: flex; padding-bottom: 5px; }
    .tool-icon {
      font-size: 20px; color: #909399; cursor: pointer; padding: 4px;
      &:hover { color: $primary-color; }
    }

    textarea {
      flex: 1; background: transparent; border: none; resize: none;
      height: 52px; padding: 0; font-size: 14px; font-family: inherit; line-height: 1.7;
      &:focus { outline: none; }
    }

    .send-btn {
      width: 32px; height: 32px; background: $primary-color; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; color: white;
      cursor: pointer; transition: transform 0.2s; flex-shrink: 0;
      &.disabled { background: #c0c4cc; cursor: not-allowed; }
      &:not(.disabled):hover { transform: scale(1.1); }
      .is-loading { animation: rotate 1s linear infinite; }
    }
  }
}

.markdown-body {
  :deep(p) { margin: 0 0 8px 0; &:last-child { margin-bottom: 0; } }
  :deep(pre) {
    background: #282c34; color: #abb2bf; padding: 10px;
    border-radius: 6px; overflow-x: auto; margin: 8px 0;
  }
  :deep(code) { font-family: 'Consolas', monospace; }
  :deep(img) { max-width: 100%; border-radius: 4px; }

  :deep(.echarts-chart),
  :deep(.mermaid-chart) {
    display: block;
    position: relative;
    width: 100%;
    max-width: 100%;
    min-height: 240px;
    margin: 10px 0;
    overflow: hidden;
    transition: opacity 0.16s ease;
  }

  :deep(.echarts-chart > div),
  :deep(.echarts-chart canvas) {
    max-width: 100%;
  }

  :deep(.echarts-chart:empty),
  :deep(.mermaid-chart:empty) {
    display: none;
  }
  :deep(.echarts-chart.chart-omitted),
  :deep(.mermaid-chart.chart-omitted) {
    display: none !important;
    min-height: 0 !important;
    margin: 0 !important;
  }

  :deep(.echarts-chart.chart-pending),
  :deep(.mermaid-chart.chart-pending),
  :deep(.echarts-chart.is-rendering),
  :deep(.mermaid-chart.is-rendering) {
    opacity: 0;
    pointer-events: none;
  }

  :deep(.echarts-chart.is-retrying),
  :deep(.mermaid-chart.is-retrying) {
    pointer-events: none;
    cursor: progress;
  }

  :deep(.mermaid-chart svg) {
    max-width: 100%;
    height: auto;
  }

  :deep(.smart-bi-report) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  :deep(.smart-bi-report-intro) {
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    border-radius: 8px;
    background: var(--el-fill-color-extra-light, #fafafa);
  }

  :deep(.smart-bi-report-section) {
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    border-left: 4px solid var(--el-color-primary, #409EFF);
    border-radius: 8px;
    background: #fff;
    overflow: hidden;
  }

  :deep(.smart-bi-report-section.section-risks) {
    border-left-color: var(--el-color-warning, #e6a23c);
  }

  :deep(.smart-bi-report-section.section-actions) {
    border-left-color: var(--el-color-success, #67c23a);
  }

  :deep(.smart-bi-report-heading) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
    background: var(--el-fill-color-extra-light, #fafafa);
  }

  :deep(.section-badge) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 20px;
    border-radius: 999px;
    background: var(--el-color-primary-light-9, #ecf5ff);
    color: var(--el-color-primary, #409EFF);
    font-size: 11px;
    font-weight: 700;
  }

  :deep(.section-title) {
    color: var(--el-text-color-primary, #303133);
    font-size: 14px;
    font-weight: 700;
  }

  :deep(.smart-bi-report-content) {
    padding: 12px 14px;
  }

  :deep(.smart-bi-report-content > :last-child) {
    margin-bottom: 0;
  }

  :deep(.smart-bi-report-content table) {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 13px;
  }

  :deep(.smart-bi-report-content th),
  :deep(.smart-bi-report-content td) {
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    padding: 8px 10px;
    text-align: left;
  }

  :deep(.smart-bi-report-content th) {
    background: var(--el-fill-color-extra-light, #fafafa);
    color: var(--el-text-color-primary, #303133);
  }
}

.form-template-card {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid $border-color;
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.formula-card,
.import-card,
.workflow-card {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid $border-color;
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-template-card .card-header,
.formula-card .card-header,
.import-card .card-header,
.workflow-card .card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
}

.form-template-card .card-title,
.formula-card .card-title,
.import-card .card-title,
.workflow-card .card-title {
  font-size: 12px;
  color: #909399;
}

.form-template-card .card-name,
.formula-card .card-name,
.import-card .card-name,
.workflow-card .card-name {
  font-size: 13px;
}

.form-template-card .card-meta,
.formula-card .card-meta,
.import-card .card-meta,
.workflow-card .card-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  gap: 12px;
}

.form-template-card .card-actions,
.formula-card .card-actions,
.import-card .card-actions,
.workflow-card .card-actions {
  display: flex;
  justify-content: flex-end;
}

.preview-table,
.preview-tree {
  margin-top: 8px;
  background: #fff;
  border: none;
  border-radius: 8px;
  padding: 0;
  max-height: 240px;
  overflow: auto;
}

.preview-table :deep(.el-table) {
  border: none;
}
.preview-table :deep(.el-table__inner-wrapper::before),
.preview-table :deep(.el-table::before) {
  height: 0;
}

.form-template-error {
  margin-top: 6px;
  font-size: 12px;
  color: #f56c6c;
}

.chart-error {
  display: none !important;
}

.chart-details {
  display: none !important;
}

.chart-retry {
  display: none !important;
}

.chart-inline-status {
  padding: 8px 0;
  font-size: 12px;
  color: #909399;
}

.typing-cursor {
  display: inline-block; width: 6px; height: 14px; background: $primary-color;
  animation: blink 1s infinite; vertical-align: middle; margin-left: 4px;
}

.chart-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.lightbox-content {
  width: min(90vw, 980px);
  height: min(90vh, 720px);
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;
  font-weight: 600;
}

.lightbox-close {
  cursor: pointer;
  &:hover { color: $primary-color; }
}

.lightbox-body {
  flex: 1;
  padding: 12px;
}

.lightbox-chart {
  width: 100%;
  height: 100%;
}

.lightbox-mermaid {
  width: 100%;
  height: 100%;
  overflow: auto;
}

@keyframes blink { 50% { opacity: 0; } }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

@media (max-width: 1180px) {
  .smart-bi-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .messages-container {
    padding: 18px 14px;
  }

  .smart-bi-card-grid {
    grid-template-columns: 1fr;
  }

  .smart-bi-head {
    align-items: flex-start;
  }
}

.ai-copilot-container.is-dark .ai-window {
  background: #0f172a;
  border-color: #1f2937;
}
.ai-copilot-container.is-dark .ai-header {
  border-bottom-color: #1f2937;
  color: #f3f4f6;
}
.ai-copilot-container.is-dark .ai-header .header-right {
  color: #cbd5f5;
}
.ai-copilot-container.is-dark .history-sidebar {
  background: #0b1220;
  border-right-color: #1f2937;
  box-shadow: 12px 0 28px rgba(0, 0, 0, 0.28);
}
.ai-copilot-container.is-dark .history-sidebar .sidebar-header {
  border-bottom-color: #1f2937;
}
.ai-copilot-container.is-dark .history-sidebar .sidebar-title,
.ai-copilot-container.is-dark .history-sidebar .session-title,
.ai-copilot-container.is-dark .history-sidebar .metric-name {
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .history-sidebar .sidebar-count,
.ai-copilot-container.is-dark .history-sidebar .session-time,
.ai-copilot-container.is-dark .history-sidebar .metric-desc {
  color: #94a3b8;
}
.ai-copilot-container.is-dark .session-item {
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .session-item:hover,
.ai-copilot-container.is-dark .metric-item:hover {
  background: rgba(148, 163, 184, 0.15);
}
.ai-copilot-container.is-dark .session-item.active {
  background: rgba(96, 165, 250, 0.2);
}
.ai-copilot-container.is-dark .chat-area {
  background: #0b1220;
}
.ai-copilot-container.is-dark .message-row .avatar {
  background: #111827;
  color: #f3f4f6;
  box-shadow: none;
}
.ai-copilot-container.is-dark .message-row .bubble {
  background: #111827;
  color: #f3f4f6;
  border: 1px solid #1f2937;
  box-shadow: none;
}
.ai-copilot-container.is-dark .markdown-body :deep(.smart-bi-report-intro),
.ai-copilot-container.is-dark .markdown-body :deep(.smart-bi-report-section) {
  background: #0f172a;
  border-color: #1f2937;
}
.ai-copilot-container.is-dark .markdown-body :deep(.smart-bi-report-heading),
.ai-copilot-container.is-dark .markdown-body :deep(.smart-bi-report-content th) {
  background: #111827;
  border-color: #1f2937;
}
.ai-copilot-container.is-dark .markdown-body :deep(.section-title),
.ai-copilot-container.is-dark .markdown-body :deep(.smart-bi-report-content th) {
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .markdown-body :deep(.smart-bi-report-content td) {
  border-color: #1f2937;
}
.ai-copilot-container.is-dark .message-row.user .bubble {
  color: #ffffff;
}
.ai-copilot-container.is-dark .msg-files .doc-file,
.ai-copilot-container.is-dark .msg-files .msg-img {
  background: #0f172a;
  border-color: #1f2937;
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .input-section {
  background: #0f172a;
  border-top-color: #1f2937;
}
.ai-copilot-container.is-dark .quick-actions :deep(.el-button) {
  background: #0b1220;
  border-color: #1f2937;
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .smart-bi-title,
.ai-copilot-container.is-dark .smart-bi-card .card-label,
.ai-copilot-container.is-dark .smart-bi-card .card-value {
  color: #e5edf7;
}
.ai-copilot-container.is-dark .smart-bi-card {
  background: #1f2937;
  border-color: rgba(148, 163, 184, 0.22);
}
.ai-copilot-container.is-dark .smart-bi-card.risk-normal {
  border-left-color: #22c55e;
}
.ai-copilot-container.is-dark .smart-bi-card.risk-focus {
  border-left-color: #60a5fa;
}
.ai-copilot-container.is-dark .smart-bi-card.risk-warning {
  border-left-color: #f59e0b;
}
.ai-copilot-container.is-dark .smart-bi-card.risk-critical {
  border-left-color: #f87171;
}
.ai-copilot-container.is-dark .smart-bi-card .card-metric {
  color: #cbd5e1;
}
.ai-copilot-container.is-dark .smart-bi-card .card-rule,
.ai-copilot-container.is-dark .smart-bi-card .card-risk,
.ai-copilot-container.is-dark .smart-bi-card .card-foot,
.ai-copilot-container.is-dark .smart-bi-meta {
  color: #94a3b8;
}
.ai-copilot-container.is-dark .smart-bi-card .card-status {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.24);
  color: #86efac;
}
.ai-copilot-container.is-dark .smart-bi-card .card-status[data-risk='focus'] {
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.24);
  color: #93c5fd;
}
.ai-copilot-container.is-dark .smart-bi-card .card-status[data-risk='warning'] {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.24);
  color: #fcd34d;
}
.ai-copilot-container.is-dark .smart-bi-card .card-status[data-risk='critical'] {
  background: rgba(248, 113, 113, 0.14);
  border-color: rgba(248, 113, 113, 0.24);
  color: #fca5a5;
}
.ai-copilot-container.is-dark .input-box {
  background: #0b1220;
  border-color: #1f2937;
}
.ai-copilot-container.is-dark .input-box textarea {
  color: #f3f4f6;
}
.ai-copilot-container.is-dark .tool-icon {
  color: #cbd5f5;
}
.ai-copilot-container.is-dark .form-template-card,
.ai-copilot-container.is-dark .formula-card,
.ai-copilot-container.is-dark .import-card,
.ai-copilot-container.is-dark .workflow-card {
  background: #0f172a;
  border-color: #1f2937;
  color: #f3f4f6;
}
.ai-copilot-container.is-dark .form-template-card .card-title,
.ai-copilot-container.is-dark .formula-card .card-title,
.ai-copilot-container.is-dark .import-card .card-title,
.ai-copilot-container.is-dark .workflow-card .card-title,
.ai-copilot-container.is-dark .form-template-card .card-meta,
.ai-copilot-container.is-dark .formula-card .card-meta,
.ai-copilot-container.is-dark .import-card .card-meta,
.ai-copilot-container.is-dark .workflow-card .card-meta {
  color: #cbd5f5;
}
.ai-copilot-container.is-dark .lightbox-content {
  background: #0f172a;
}
.ai-copilot-container.is-dark .lightbox-header {
  border-bottom-color: #1f2937;
  color: #f3f4f6;
}
</style>
