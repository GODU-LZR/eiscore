<template>
  <div class="ai-copilot-container" :class="{ 'is-open': state.isOpen, 'is-expanded': isExpanded }">
    <div v-if="!state.isOpen" class="ai-trigger-btn" @click="aiBridge.toggleWindow()">
      <div class="ai-icon-wrapper"><span class="sparkle-icon">✨</span></div>
      <span class="ai-label">人工智能</span>
    </div>

    <div v-else class="ai-window">
      <div class="ai-header">
        <div class="header-left" @click="toggleHistory">
          <el-icon class="history-icon" :class="{ 'active': showHistory }"><Operation /></el-icon>
          <span class="title">EIS 智能助手</span>
        </div>
        <div class="header-right">
          <el-tooltip :content="isExpanded ? '恢复小窗' : '宽屏模式'" placement="bottom">
            <el-icon class="action-icon" @click="toggleExpand">
              <component :is="isExpanded ? 'Rank' : 'FullScreen'" />
            </el-icon>
          </el-tooltip>
          <el-tooltip content="新建对话" placement="bottom">
            <el-icon class="action-icon" @click="aiBridge.createNewSession()"><Plus /></el-icon>
          </el-tooltip>
          <el-icon class="close-btn" @click="aiBridge.toggleWindow()"><Close /></el-icon>
        </div>
      </div>

      <div class="ai-body">
        <div class="history-sidebar" :class="{ 'show': showHistory }">
          <div class="sidebar-header">对话历史</div>
          <div class="session-list">
            <div v-for="sess in state.sessions" :key="sess.id" class="session-item" :class="{ 'active': sess.id === state.currentSessionId }" @click="switchSession(sess.id)">
              <span class="session-title">{{ sess.title }}</span>
              <el-icon class="delete-icon" @click.stop="aiBridge.deleteSession(sess.id)"><Delete /></el-icon>
            </div>
          </div>
        </div>

        <div class="chat-area" @click="showHistory = false">
          <div class="messages-container" ref="messagesRef">
            <template v-if="currentSession">
              <div v-for="(msg, index) in currentSession.messages" :key="index" class="message-row" :class="msg.role">
                <div class="avatar-wrapper"><div class="avatar">{{ msg.role === 'user' ? '👤' : '✨' }}</div></div>
                <div class="content-wrapper">
                  <div v-if="msg.files && msg.files.length" class="msg-files">
                    <div v-for="(file, idx) in msg.files" :key="idx" class="file-card">
                      <el-image v-if="file.type === 'image'" :src="file.url" :preview-src-list="[file.url]" class="msg-img" fit="cover" />
                      <div v-else class="doc-file"><el-icon><Document /></el-icon><span class="fname">{{ file.name }}</span></div>
                    </div>
                  </div>
                  
                  <div class="bubble">
                    <div class="markdown-body" 
                         v-html="renderMarkdown(msg.content)"
                         @dblclick="handleChartDoubleClick"
                    ></div>
                    <div v-if="msg.role === 'assistant' && index === currentSession.messages.length - 1 && state.isStreaming" class="typing-indicator"><span></span><span></span><span></span></div>
                  </div>
                  
                  <div class="msg-actions">
                    <el-button link size="small" icon="Delete" @click="aiBridge.deleteMessage(index)"></el-button>
                    <el-button v-if="msg.role === 'user'" link size="small" icon="Refresh" @click="retryMessage(msg.content)">重试</el-button>
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
              <el-upload action="#" :auto-upload="false" :show-file-list="false" :on-change="(file) => aiBridge.handleFileSelect(file.raw)" class="upload-trigger">
                <div class="tool-btn"><el-icon><Paperclip /></el-icon></div>
              </el-upload>
              <textarea v-model="state.inputBuffer" placeholder="输入消息..." @keydown.enter="handleEnter" :disabled="state.isLoading"></textarea>
              <div class="send-btn" :class="{ 'disabled': state.isLoading }" @click="handleSend">
                <el-icon v-if="state.isLoading" class="is-loading"><Loading /></el-icon>
                <el-icon v-else><Position /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="previewDialog.visible" width="90%" top="5vh" append-to-body class="chart-preview-dialog">
      <template #header>
        <span class="dialog-title">图表详情预览</span>
      </template>
      <div class="preview-content" ref="previewContainer" style="height: 80vh; width: 100%;"></div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted, onUpdated } from 'vue' // 🟢 已添加 reactive
import { aiBridge } from '@/utils/ai-bridge'
import { Operation, Close, Plus, Delete, Paperclip, Position, Loading, Document, Refresh, FullScreen, Rank } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'
import * as echarts from 'echarts'

const state = aiBridge.state
const showHistory = ref(false)
const isExpanded = ref(false)
const messagesRef = ref(null)
const previewDialog = reactive({ visible: false, content: '', type: '' })
const previewContainer = ref(null)

const currentSession = computed(() => aiBridge.getCurrentSession())
const md = new MarkdownIt({ html: true, linkify: true, breaks: true })

mermaid.initialize({ startOnLoad: false, theme: 'default', themeVariables: { fontSize: '16px' } })

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
  setTimeout(renderCharts, 350) 
}

const tryFixJson = (jsonStr) => {
  try { return JSON.parse(jsonStr) } catch (e) {
    try {
      let fixed = jsonStr.replace(/^\s*(var|let|const)\s+\w+\s*=\s*/, '').replace(/;\s*$/, '').replace(/'/g, '"').replace(/,\s*([\]}])/g, '$1')
      return JSON.parse(fixed)
    } catch (e2) { return null }
  }
}

const renderMarkdown = (text) => {
  if (!text) return ''
  text = text.replace(/```echarts([\s\S]*?)```/g, (m, code) => `<div class="echarts-wrapper"><div class="echarts-chart" data-code="${encodeURIComponent(code)}"></div><div class="chart-hint">双击放大</div></div>`)
  text = text.replace(/```mermaid([\s\S]*?)```/g, (m, code) => `<div class="mermaid-wrapper"><div class="mermaid-chart" data-code="${encodeURIComponent(code)}">${code}</div><div class="chart-hint">双击放大</div></div>`)
  return md.render(text)
}

const renderChartElement = async (el, isPreview = false) => {
  const type = el.classList.contains('echarts-chart') ? 'echarts' : 'mermaid'
  const code = decodeURIComponent(el.getAttribute('data-code') || el.textContent)
  
  if (type === 'mermaid') {
    try {
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const { svg } = await mermaid.render(id, code)
      el.innerHTML = svg
      if (isPreview) {
        const svgEl = el.querySelector('svg')
        if(svgEl) { svgEl.style.width = '100%'; svgEl.style.height = '100%'; }
      }
    } catch (e) { el.innerHTML = `<span style="color:red">流程图渲染失败</span>` }
  } 
  else if (type === 'echarts') {
    const option = tryFixJson(code)
    if (option) {
      if (echarts.getInstanceByDom(el)) echarts.dispose(el)
      const chart = echarts.init(el)
      chart.setOption(option)
      chart.resize()
    } else {
      el.innerHTML = `<div style="color:orange;padding:10px">图表数据异常</div>`
    }
  }
}

const renderCharts = async () => {
  await nextTick()
  document.querySelectorAll('.mermaid-chart:not([data-processed]), .echarts-chart').forEach(async el => {
    el.setAttribute('data-processed', 'true')
    renderChartElement(el)
  })
}

// 双击放大处理 (完全重写)
const handleChartDoubleClick = async (e) => {
  const target = e.target.closest('.echarts-chart, .mermaid-chart')
  if (!target) return

  previewDialog.visible = true
  const type = target.classList.contains('echarts-chart') ? 'echarts' : 'mermaid'
  const code = decodeURIComponent(target.getAttribute('data-code'))

  await nextTick()
  if (previewContainer.value) {
    previewContainer.value.innerHTML = `<div class="${type === 'echarts' ? 'echarts-chart' : 'mermaid-chart'}" style="width:100%;height:100%;"></div>`
    const newEl = previewContainer.value.firstElementChild
    newEl.setAttribute('data-code', encodeURIComponent(code))
    renderChartElement(newEl, true)
  }
}

onUpdated(renderCharts)

const toggleHistory = () => { showHistory.value = !showHistory.value }
const switchSession = (id) => { state.currentSessionId = id; showHistory.value = false }
const scrollToBottom = () => { nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight }) }
const handleEnter = (e) => { if (!e.shiftKey) { e.preventDefault(); handleSend() } }
const handleSend = () => { if (state.isLoading) return; const text = state.inputBuffer; aiBridge.sendMessage(text) }
const retryMessage = (text) => { aiBridge.sendMessage(text, true) }

watch(() => currentSession.value?.messages.length, scrollToBottom)
watch(() => currentSession.value?.messages[currentSession.value.messages.length-1]?.content, scrollToBottom)
watch(() => state.isOpen, (val) => { if(val) scrollToBottom() })
onMounted(() => { aiBridge.loadConfig() })
</script>

<style scoped lang="scss">
$primary-color: var(--el-color-primary, #409EFF);
$bg-color: #ffffff;
$border-color: #e4e7ed;

.ai-copilot-container { position: fixed; bottom: 30px; right: 30px; z-index: 2000; }

.ai-trigger-btn {
  width: 60px; height: 60px; background: $primary-color; border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #fff; transition: transform 0.2s;
  &:hover { transform: scale(1.05); }
  .sparkle-icon { font-size: 24px; }
  .ai-label { font-size: 10px; font-weight: bold; margin-top: 2px; }
}

/* 2. 主窗口 */
.ai-window {
  width: 420px; height: 650px; background: $bg-color; border-radius: 16px;
  box-shadow: 0 12px 50px rgba(0,0,0,0.2); 
  display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid $border-color;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 🟢 宽屏模式修复：使用 fixed 定位和高 z-index 确保不被遮挡 */
.ai-copilot-container.is-expanded .ai-window {
  position: fixed; 
  top: 50%; left: 50%; 
  width: 90vw !important; height: 85vh !important;
  transform: translate(-50%, -50%) !important;
  bottom: auto; right: auto;
  z-index: 2001; /* 提升层级 */
}

.ai-header {
  height: 52px; border-bottom: 1px solid $border-color; display: flex; justify-content: space-between;
  align-items: center; padding: 0 16px; background: #fff; flex-shrink: 0;
  .header-left { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; }
  .header-right { display: flex; gap: 12px; font-size: 18px; color: #606266; .el-icon:hover { color: $primary-color; } }
}

.ai-body { flex: 1; display: flex; position: relative; overflow: hidden; }

.history-sidebar {
  position: absolute; left: 0; top: 0; bottom: 0; width: 220px; background: #f9f9f9;
  border-right: 1px solid $border-color; z-index: 10;
  transform: translateX(-100%); transition: transform 0.3s ease;
  display: flex; flex-direction: column;
  &.show { transform: translateX(0); }
  .sidebar-header { padding: 12px; font-weight: 600; color: #909399; }
  .session-list { flex: 1; overflow-y: auto; padding: 0 8px; }
  .session-item {
    padding: 10px; margin-bottom: 4px; border-radius: 8px; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center; color: #606266; font-size: 13px;
    &:hover { background: #eef0f5; }
    &.active { background: #ecf5ff; color: $primary-color; }
    .session-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
  }
}

.chat-area { flex: 1; display: flex; flex-direction: column; background: #f5f7fa; width: 100%; }

.messages-container { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }

.message-row {
  display: flex; gap: 10px;
  &.user { flex-direction: row-reverse; }
  .avatar {
    width: 32px; height: 32px; border-radius: 8px; background: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  &.user .avatar { background: $primary-color; color: #fff; }
  
  .content-wrapper { max-width: 85%; display: flex; flex-direction: column; gap: 4px; }
  /* 宽屏下允许更宽 */
  .ai-copilot-container.is-expanded .message-row .content-wrapper { max-width: 95%; }
  
  &.user .content-wrapper { align-items: flex-end; }

  .bubble {
    padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.6;
    background: #fff; color: #303133; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    min-width: 40px;
  }
  &.user .bubble { background: $primary-color; color: #fff; border-top-right-radius: 2px; }
  &.assistant .bubble { border-top-left-radius: 2px; }

  .msg-actions { opacity: 0; transition: opacity 0.2s; display: flex; gap: 4px; }
  &:hover .msg-actions { opacity: 1; }
}

/* 🟢 文件图片预览修正：限制最大宽高，防止撑爆 */
.msg-files {
  display: flex; flex-wrap: wrap; gap: 6px;
  .file-card {
    background: #fff; border: 1px solid $border-color; border-radius: 8px; overflow: hidden;
    .msg-img { 
      width: 140px; height: 140px; display: block; 
      object-fit: cover; /* 保持比例填充 */
    }
    .doc-file { padding: 8px; display: flex; align-items: center; gap: 6px; font-size: 12px; max-width: 180px; }
    .fname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
}

.input-section {
  background: #fff; padding: 12px; border-top: 1px solid $border-color; flex-shrink: 0;
  .file-preview-bar { display: flex; gap: 8px; margin-bottom: 8px; overflow-x: auto; }
  .input-box {
    display: flex; align-items: flex-end; gap: 8px; background: #f5f7fa;
    border-radius: 20px; padding: 6px 8px; transition: all 0.2s;
    border: 1px solid transparent;
    &:focus-within { background: #fff; border-color: $primary-color; box-shadow: 0 0 0 2px rgba($primary-color, 0.1); }
    .tool-btn { padding: 6px; cursor: pointer; color: #909399; &:hover { color: $primary-color; } }
    textarea {
      flex: 1; background: transparent; border: none; resize: none; height: 24px; max-height: 120px;
      padding: 4px 0; font-size: 14px; outline: none; font-family: inherit;
    }
    .send-btn {
      width: 32px; height: 32px; background: $primary-color; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer;
      &.disabled { background: #dcdfe6; cursor: not-allowed; }
    }
  }
}

.markdown-body {
  :deep(p) { margin: 0 0 8px 0; &:last-child { margin-bottom: 0; } }
  :deep(pre) { background: #282c34; color: #abb2bf; padding: 10px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
  
  :deep(.echarts-wrapper), :deep(.mermaid-wrapper) {
    position: relative; margin: 12px 0; border: 1px solid $border-color; border-radius: 8px; overflow: hidden;
    background: #fff; cursor: zoom-in;
    &:hover .chart-hint { opacity: 1; }
  }
  :deep(.echarts-chart), :deep(.mermaid-chart) { width: 100%; min-height: 250px; }
  :deep(.chart-hint) {
    position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff;
    padding: 2px 6px; border-radius: 4px; font-size: 11px; opacity: 0; transition: opacity 0.2s; pointer-events: none;
  }
}

.typing-indicator {
  display: flex; gap: 3px; padding: 4px 0;
  span { width: 4px; height: 4px; background: #909399; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
  span:nth-child(1) { animation-delay: -0.32s; }
  span:nth-child(2) { animation-delay: -0.16s; }
}
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
.ai-slide-enter-active, .ai-slide-leave-active { transition: all 0.3s ease; }
.ai-slide-enter-from, .ai-slide-leave-to { opacity: 0; transform: translateY(20px) scale(0.95); }
</style>