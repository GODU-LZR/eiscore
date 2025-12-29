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

    <div v-else-if="state.isOpen" class="ai-window" :class="{ 'is-worker': isWorker }">
      <div class="ai-header">
        <div class="header-left" @click="toggleHistory">
          <el-icon class="history-icon" :class="{ 'active': showHistory }"><Operation /></el-icon>
          <span class="title">{{ assistantTitle }}</span>
        </div>
        <div class="header-right">
          <el-tooltip v-if="isEnterprise" content="导出PDF" placement="bottom">
            <el-icon class="action-icon" @click="exportReportAsPdf"><Download /></el-icon>
          </el-tooltip>
          <el-tooltip content="新建对话" placement="bottom">
            <el-icon class="action-icon" @click="aiBridge.createNewSession()"><Plus /></el-icon>
          </el-tooltip>
          <el-icon class="close-btn" @click="closeAssistant"><Close /></el-icon>
        </div>
      </div>

      <div class="ai-body">
        <div class="history-sidebar" :class="{ 'show': showHistory }">
          <div class="sidebar-header">对话历史</div>
          <div class="session-list">
            <div
              v-for="sess in state.sessions"
              :key="sess.id"
              class="session-item"
              :class="{ 'active': sess.id === state.currentSessionId }"
              @click="switchSession(sess.id)"
            >
              <span class="session-title">{{ sess.title }}</span>
              <el-icon class="delete-icon" @click.stop="aiBridge.deleteSession(sess.id)"><Delete /></el-icon>
            </div>
          </div>
        </div>

        <div class="chat-area" @click="showHistory = false">
          <div class="messages-container" ref="messagesRef">
            <template v-if="currentSession">
              <div
                v-for="(msg, index) in currentSession.messages"
                :key="index"
                class="message-row"
                :class="msg.role"
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

                  <div class="bubble">
                    <div
                      class="markdown-body"
                      v-html="renderMarkdown(msg.content)"
                    ></div>
                    <span
                      v-if="msg.role === 'assistant' && index === currentSession.messages.length - 1 && state.isStreaming"
                      class="typing-cursor"
                    ></span>
                  </div>

                  <div class="msg-actions">
                    <el-button link size="small" type="danger" icon="Delete" @click="aiBridge.deleteMessage(index)"></el-button>
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
import { ref, computed, nextTick, watch, onMounted, onUpdated } from 'vue'
import { aiBridge } from '@/utils/ai-bridge'
import { Operation, Close, Plus, Delete, Paperclip, Position, Loading, Document, Refresh, Download } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'
import * as echarts from 'echarts'
import { useRouter } from 'vue-router'

const props = defineProps({
  mode: { type: String, default: 'enterprise' },
  closeRoute: { type: String, default: '' },
  autoOpen: { type: Boolean, default: false }
})

const state = aiBridge.state
const showHistory = ref(false)
const messagesRef = ref(null)
const lightboxChartRef = ref(null)
const lightbox = ref({ visible: false, type: '', payload: null })
let lightboxChart = null
const router = useRouter()

const currentSession = computed(() => aiBridge.getCurrentSession())
const isWorker = computed(() => props.mode === 'worker')
const isEnterprise = computed(() => props.mode === 'enterprise')
const assistantTitle = computed(() => (isWorker.value ? '企业工作助手' : '企业经营助手'))
const inputPlaceholder = computed(() => (
  isWorker.value
    ? '把数据或问题告诉我，我帮你整理成能录入系统的格式...'
    : '输入消息，或上传图片/文档分析...'
))
const containerClasses = computed(() => ({
  'is-open': state.isOpen,
  'is-worker': isWorker.value
}))

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true
})

const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info.trim().toLowerCase()
  if (info === 'mermaid') {
    return `<div class="mermaid-chart" data-raw="${encodeURIComponent(token.content)}"></div>`
  }
  if (info === 'echarts') {
    return `<div class="echarts-chart" data-option="${encodeURIComponent(token.content)}"></div>`
  }
  if (defaultFence) {
    return defaultFence(tokens, idx, options, env, self)
  }
  return self.renderToken(tokens, idx, options)
}

mermaid.initialize({ startOnLoad: false, theme: 'default' })

const renderMarkdown = (text) => {
  if (!text) return ''
  return md.render(text)
}

const sanitizeJson = (jsonStr) => {
  if (!jsonStr) return ''
  let cleaned = jsonStr
  cleaned = cleaned.replace(/^\s*[^=]*=\s*/, '')
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1')
  cleaned = cleaned.replace(/\/\/.*(?=[\n\r])/g, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/'([^']*)'/g, (_, p1) => `"${p1.replace(/"/g, '\\"')}"`)
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
  return cleaned.trim()
}

const escapeHtml = (value) => {
  if (!value) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const validateEchartsOption = (option) => {
  if (!option || !option.series || !Array.isArray(option.series) || option.series.length === 0) {
    return '图表配置缺少必要的 series 数据'
  }
  return ''
}

const buildPrintableHtml = () => {
  const container = messagesRef.value?.cloneNode(true)
  if (!container) return ''

  container.querySelectorAll('.msg-actions').forEach(node => node.remove())
  container.querySelectorAll('.typing-cursor').forEach(node => node.remove())

  const echartsNodes = Array.from(container.querySelectorAll('.echarts-chart'))
  echartsNodes.forEach((node, index) => {
    const liveNode = document.querySelectorAll('.echarts-chart')[index]
    const instance = liveNode ? echarts.getInstanceByDom(liveNode) : null
    if (instance) {
      const dataUrl = instance.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' })
      const img = document.createElement('img')
      img.src = dataUrl
      img.style.maxWidth = '100%'
      img.style.display = 'block'
      node.replaceWith(img)
    }
  })

  return container.innerHTML
}

const exportReportAsPdf = () => {
  const html = buildPrintableHtml()
  if (!html) return

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`<!DOCTYPE html>
    <html>
      <head>
        <title>企业经营报告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #303133; }
          .message-row { display: flex; gap: 12px; margin-bottom: 16px; }
          .message-row.user { flex-direction: row-reverse; }
          .bubble { background: #fff; padding: 12px 16px; border-radius: 12px; border: 1px solid #ebeef5; }
          .msg-files { margin-bottom: 8px; }
          pre { background: #f5f7fa; padding: 10px; border-radius: 6px; }
          .mermaid-chart svg { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h2>企业经营报告</h2>
        ${html}
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
  lightbox.value = { visible: true, type, payload }
  await nextTick()
  if (type === 'echarts' && lightboxChartRef.value) {
    if (lightboxChart) {
      lightboxChart.dispose()
    }
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

const bindRetry = (node) => {
  const retryButton = node.querySelector('.chart-retry')
  if (retryButton && !retryButton.dataset.bound) {
    retryButton.dataset.bound = 'true'
    retryButton.addEventListener('click', () => {
      node.removeAttribute('data-processed')
      node.innerHTML = ''
      renderCharts()
    })
  }
}

const renderCharts = async () => {
  await nextTick()

  const mermaidNodes = document.querySelectorAll('.mermaid-chart:not([data-processed])')
  mermaidNodes.forEach(async (node, index) => {
    try {
      node.setAttribute('data-processed', 'true')
      const text = decodeURIComponent(node.getAttribute('data-raw') || '')
      await mermaid.parse(text)
      const id = `mermaid-${Date.now()}-${index}`
      const { svg } = await mermaid.render(id, text)
      node.innerHTML = svg
      if (!node.dataset.bound) {
        node.dataset.bound = 'true'
        node.addEventListener('dblclick', () => openLightbox('mermaid', svg))
      }
    } catch (e) {
      const safeCode = escapeHtml(decodeURIComponent(node.getAttribute('data-raw') || ''))
      node.innerHTML = `
        <div class="chart-error">
          <span>流程图渲染失败</span>
          <button class="chart-retry">重试</button>
        </div>
        <details class="chart-details">
          <summary>查看 Mermaid 代码</summary>
          <pre>${safeCode}</pre>
        </details>
      `
      bindRetry(node)
    }
  })

  const echartsNodes = document.querySelectorAll('.echarts-chart:not([data-processed])')
  echartsNodes.forEach((node) => {
    try {
      node.setAttribute('data-processed', 'true')
      const jsonStr = decodeURIComponent(node.getAttribute('data-option') || '')
      const sanitized = sanitizeJson(jsonStr)
      const option = JSON.parse(sanitized)
      const validationError = validateEchartsOption(option)
      if (validationError) {
        node.innerHTML = `<div class="chart-error">${validationError} <button class="chart-retry">重试</button></div>`
        bindRetry(node)
        return
      }
      node.style.width = '100%'
      node.style.height = '320px'
      const chart = echarts.init(node)
      chart.setOption(option)
      if (!node.dataset.bound) {
        node.dataset.bound = 'true'
        node.addEventListener('dblclick', () => openLightbox('echarts', option))
      }
    } catch (e) {
      console.error(e)
      const raw = decodeURIComponent(node.getAttribute('data-option') || '')
      const safeJson = escapeHtml(raw)
      node.innerHTML = `
        <div class="chart-error">
          <span>统计图渲染失败: 请确保 AI 输出标准 JSON</span>
          <button class="chart-retry">重试</button>
        </div>
        <details class="chart-details">
          <summary>查看原始 JSON</summary>
          <pre>${safeJson}</pre>
        </details>
      `
      bindRetry(node)
    }
  })
}

onUpdated(renderCharts)

const toggleHistory = () => {
  showHistory.value = !showHistory.value
}

const switchSession = (id) => {
  aiBridge.switchSession(id)
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
  aiBridge.sendMessage(text)
}

const retryMessage = (index) => {
  aiBridge.retryMessageAt(index)
}

watch(() => currentSession.value?.messages.length, scrollToBottom)
watch(() => currentSession.value?.messages[currentSession.value?.messages.length - 1]?.content, scrollToBottom)
watch(() => state.isOpen, (val) => { if (val) scrollToBottom() })

onMounted(() => {
  aiBridge.loadConfig()
  aiBridge.setMode(props.mode)
  if (props.autoOpen) {
    aiBridge.openWindow()
  }
})

watch(() => props.mode, (val) => {
  aiBridge.setMode(val)
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

  &.is-open {
    inset: 0;
  }

  &.is-open.is-worker {
    inset: auto;
    right: 30px;
    bottom: 30px;
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
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: $bg-color;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.05);

  &.is-worker {
    position: fixed;
    right: 30px;
    bottom: 30px;
    width: 380px;
    height: 600px;
    inset: auto;
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }
}

.ai-header {
  height: 52px;
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;

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
  position: absolute; left: 0; top: 0; bottom: 0; width: 220px;
  background: #f9fafc; border-right: 1px solid $border-color;
  transform: translateX(-100%); transition: transform 0.3s ease; z-index: 10;
  display: flex; flex-direction: column;
  &.show { transform: translateX(0); }

  .sidebar-header { padding: 12px; font-weight: 600; color: #909399; font-size: 12px; }
  .session-list { flex: 1; overflow-y: auto; padding: 0 8px; }
  .session-item {
    padding: 10px; margin-bottom: 4px; border-radius: 8px; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; color: #606266;
    &:hover { background: #eef0f5; }
    &.active { background: #ecf5ff; color: $primary-color; }
    .session-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .delete-icon { display: none; &:hover { color: #f56c6c; } }
    &:hover .delete-icon { display: block; }
  }
}

.chat-area { flex: 1; display: flex; flex-direction: column; background: $chat-bg; width: 100%; }

.messages-container {
  flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;
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

  .msg-files {
    display: flex; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
    .msg-img { max-width: 200px; height: auto; border-radius: 8px; border: 1px solid $border-color; background: #fff; }
    .doc-file {
      padding: 8px 12px; background: #fff; border: 1px solid $border-color; border-radius: 8px;
      display: flex; align-items: center; gap: 6px; font-size: 12px;
    }
  }

  .bubble {
    padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.6;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05); background: #fff; color: #303133;
    position: relative;
  }
  &.user .bubble { background: $primary-color; color: #fff; border-top-right-radius: 2px; }
  &.assistant .bubble { border-top-left-radius: 2px; }

  .msg-actions {
    margin-top: 4px; opacity: 0; transition: opacity 0.2s; display: flex; gap: 4px;
  }
  &:hover .msg-actions { opacity: 1; }
}

.input-section {
  background: #fff; border-top: 1px solid $border-color; padding: 12px;

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

  .input-box {
    display: flex; align-items: center;
    gap: 10px; background: #f5f7fa; border-radius: 20px; padding: 4px 8px 4px 12px;
    border: 1px solid transparent; transition: all 0.2s;

    &:focus-within { background: #fff; border-color: $primary-color; box-shadow: 0 0 0 2px rgba($primary-color, 0.1); }

    .upload-trigger { display: flex; }
    .tool-icon {
      font-size: 20px; color: #909399; cursor: pointer; padding: 4px;
      &:hover { color: $primary-color; }
    }

    textarea {
      flex: 1; background: transparent; border: none; resize: none;
      height: 36px; padding: 8px 0; font-size: 14px; font-family: inherit;
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
    width: 100%;
    min-height: 240px;
    overflow: hidden;
  }

  :deep(.mermaid-chart svg) {
    max-width: 100%;
    height: auto;
  }
}

.chart-error {
  color: #f56c6c;
  font-size: 12px;
  padding: 8px 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chart-details {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  max-width: 100%;
  summary {
    cursor: pointer;
    color: #606266;
  }
  pre {
    background: #f5f7fa;
    padding: 8px;
    border-radius: 6px;
    overflow: auto;
    max-height: 240px;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.chart-retry {
  background: #fff;
  border: 1px solid $border-color;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  color: #606266;
  &:hover { color: $primary-color; border-color: $primary-color; }
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
</style>
