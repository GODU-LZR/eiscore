<template>
  <div class="ai-copilot-container" :class="{ 'is-open': state.isOpen }">
    <div 
      v-if="!state.isOpen" 
      class="ai-trigger-btn" 
      @click="aiBridge.toggleWindow()"
    >
      <div class="ai-icon-wrapper">
        <span class="sparkle-icon">✨</span>
      </div>
      <span class="ai-label">人工智能</span>
    </div>

    <div v-else class="ai-window">
      <div class="ai-header">
        <div class="header-left" @click="toggleHistory">
          <el-icon class="history-icon" :class="{ 'active': showHistory }"><Operation /></el-icon>
          <span class="title">EIS 智能助手</span>
        </div>
        <div class="header-right">
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
                      ref="markdownRefs"
                    ></div>
                    <span v-if="msg.role === 'assistant' && index === currentSession.messages.length - 1 && state.isStreaming" class="typing-cursor"></span>
                  </div>
                  
                  <div class="msg-actions">
                    <el-button link size="small" type="danger" icon="Delete" @click="aiBridge.deleteMessage(index)"></el-button>
                    <el-button v-if="msg.role === 'user'" link size="small" type="primary" icon="Refresh" @click="retryMessage(msg.content)">重试</el-button>
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
                placeholder="输入消息，或上传图片/文档分析..."
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
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUpdated } from 'vue'
import { aiBridge } from '@/utils/ai-bridge'
import { Operation, Close, Plus, Delete, Paperclip, Position, Loading, Document, Refresh } from '@element-plus/icons-vue'
// 引入核心库
import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'
import * as echarts from 'echarts'

const state = aiBridge.state
const showHistory = ref(false)
const messagesRef = ref(null)
const markdownRefs = ref([])

const currentSession = computed(() => aiBridge.getCurrentSession())

// 初始化 Markdown 解析器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true
})

// 初始化 Mermaid
mermaid.initialize({ startOnLoad: false, theme: 'default' })

// 自定义渲染器：处理图表
const renderMarkdown = (text) => {
  if (!text) return ''
  // 1. 预处理 Mermaid 代码块
  // 将 ```mermaid ... ``` 替换为 <div class="mermaid">...</div>
  // 注意：真实渲染在 onUpdated 中进行
  const mermaidRegex = /```mermaid([\s\S]*?)```/g
  let processed = text.replace(mermaidRegex, '<div class="mermaid-chart">$1</div>')

  // 2. 预处理 ECharts 代码块
  const echartsRegex = /```echarts([\s\S]*?)```/g
  processed = processed.replace(echartsRegex, '<div class="echarts-chart" data-option="$1"></div>')

  return md.render(processed)
}

// 渲染图表的副作用
const renderCharts = async () => {
  await nextTick()
  // 1. 渲染 Mermaid
  const mermaidNodes = document.querySelectorAll('.mermaid-chart:not([data-processed])')
  mermaidNodes.forEach(async (node, index) => {
    try {
      node.setAttribute('data-processed', 'true')
      const text = node.textContent
      const id = `mermaid-${Date.now()}-${index}`
      const { svg } = await mermaid.render(id, text)
      node.innerHTML = svg
    } catch (e) {
      node.innerHTML = `<div style="color:red">流程图渲染失败</div>`
    }
  })

  // 2. 渲染 ECharts
  const echartsNodes = document.querySelectorAll('.echarts-chart:not([data-processed])')
  echartsNodes.forEach((node) => {
    try {
      node.setAttribute('data-processed', 'true')
      const jsonStr = node.getAttribute('data-option')
      // 简单的去除非JSON字符 (有些模型会输出 var option = ...)
      // 这里假设模型输出纯 JSON
      const option = JSON.parse(jsonStr)
      node.style.width = '100%'
      node.style.height = '300px'
      const chart = echarts.init(node)
      chart.setOption(option)
    } catch (e) {
      console.error(e)
      node.innerHTML = `<div style="color:red">统计图渲染失败: 请确保 AI 输出标准 JSON</div>`
    }
  })
}

// 监听更新以渲染图表
onUpdated(renderCharts)

const toggleHistory = () => {
  showHistory.value = !showHistory.value
}

const switchSession = (id) => {
  state.currentSessionId = id
  showHistory.value = false
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const handleEnter = (e) => {
  if (!e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (state.isLoading) return
  const text = state.inputBuffer
  aiBridge.sendMessage(text)
}

const retryMessage = (text) => {
  aiBridge.sendMessage(text, true)
}

watch(() => currentSession.value?.messages.length, scrollToBottom)
watch(() => currentSession.value?.messages[currentSession.value.messages.length-1]?.content, scrollToBottom)
watch(() => state.isOpen, (val) => { if(val) scrollToBottom() })

onMounted(() => {
  aiBridge.loadConfig()
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
  width: 420px; /* 稍微加宽以适应图表 */
  height: 650px;
  background: $bg-color;
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.05);
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
    &.user { align-items: flex-end; }
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

// 输入区域重构
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
    display: flex; align-items: center; /* 修复对齐问题 */
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

// Markdown 样式修正
.markdown-body {
  :deep(p) { margin: 0 0 8px 0; &:last-child { margin-bottom: 0; } } /* 修复空行 */
  :deep(pre) { 
    background: #282c34; color: #abb2bf; padding: 10px; 
    border-radius: 6px; overflow-x: auto; margin: 8px 0; 
  }
  :deep(code) { font-family: 'Consolas', monospace; }
  :deep(img) { max-width: 100%; border-radius: 4px; }
}

// 独立光标动画
.typing-cursor {
  display: inline-block; width: 6px; height: 14px; background: $primary-color;
  animation: blink 1s infinite; vertical-align: middle; margin-left: 4px;
}
@keyframes blink { 50% { opacity: 0; } }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>