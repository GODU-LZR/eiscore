<template>
  <div class="flash-builder">
    <!-- Header -->
    <div class="builder-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>{{ appData?.name || '快搭应用构建器' }}</h2>
      </div>
      <div class="header-right">
        <el-button @click="saveApp" :loading="saving">保存</el-button>
        <el-button type="primary" @click="publishApp">发布</el-button>
      </div>
    </div>

    <!-- Main Content: Split View -->
    <div class="builder-content">
      <!-- Left Panel: Chat + Code Editor -->
      <div class="left-panel">
        <!-- Chat Interface -->
        <div class="chat-container">
          <div class="chat-messages" ref="chatMessagesRef">
            <div
              v-for="(msg, index) in chatMessages"
              :key="index"
              :class="['message', msg.type]"
            >
              <div v-if="msg.type === 'user'" class="message-content">
                <el-icon><User /></el-icon>
                <span>{{ msg.content }}</span>
              </div>
              <div v-else-if="msg.type === 'agent'" class="message-content">
                <el-icon><Robot /></el-icon>
                <span v-html="formatAgentMessage(msg.content)"></span>
              </div>
              <div v-else-if="msg.type === 'tool'" class="message-content tool">
                <el-tag size="small" type="success">{{ msg.tool }}</el-tag>
                <pre>{{ msg.result }}</pre>
              </div>
              <div v-else-if="msg.type === 'status'" class="message-content status">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>{{ msg.content }}</span>
              </div>
            </div>

            <!-- Thinking Indicator -->
            <div v-if="isThinking" class="message status">
              <div class="message-content status">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>助手正在思考...</span>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="chat-input">
            <el-input
              v-model="userInput"
              type="textarea"
              :rows="3"
              placeholder="描述你想要的应用功能...（例如：创建一个联系人表单）"
              @keydown.ctrl.enter="sendMessage"
            />
            <el-button
              type="primary"
              :icon="Promotion"
              @click="sendMessage"
              :loading="isThinking"
              :disabled="!userInput.trim()"
            >
              发送（Ctrl+Enter）
            </el-button>
          </div>
        </div>

        <!-- Monaco Editor (Optional Toggle) -->
        <div v-if="showCodeEditor" class="code-editor-container">
          <div class="editor-header">
            <span>代码编辑器</span>
            <el-button text :icon="Close" @click="showCodeEditor = false" />
          </div>
          <div ref="monacoEditorRef" class="monaco-editor"></div>
        </div>
      </div>

      <!-- Right Panel: Live Preview -->
      <div class="right-panel">
        <div class="preview-header">
          <span>实时预览</span>
          <el-button text :icon="RefreshRight" @click="refreshPreview">
            刷新
          </el-button>
        </div>
        <iframe
          ref="previewIframeRef"
          :src="previewUrl"
          class="preview-frame"
          sandbox="allow-scripts allow-same-origin"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  User,
  Robot,
  Promotion,
  Loading,
  RefreshRight,
  Close
} from '@element-plus/icons-vue'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})

const appId = computed(() => route.params.appId)
const appData = ref(null)

// WebSocket connection
let wsConnection = null
const wsConnected = ref(false)

// Chat state
const chatMessages = ref([])
const userInput = ref('')
const isThinking = ref(false)
const chatMessagesRef = ref(null)

// Editor state
const showCodeEditor = ref(false)
const monacoEditorRef = ref(null)
let monacoEditor = null

// Preview state
const previewIframeRef = ref(null)
const previewUrl = computed(() => {
  if (!appId.value) return 'about:blank'
  return `/__preview/${appId.value}`
})

const saving = ref(false)

onMounted(async () => {
  await loadAppData()
  connectWebSocket()
})

onUnmounted(() => {
  disconnectWebSocket()
  if (monacoEditor) {
    monacoEditor.dispose()
  }
})

async function loadAppData() {
  if (!appId.value) return

  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/apps?id=eq.${appId.value}`,
      {
        headers: getAppCenterHeaders(token)
      }
    )
    appData.value = response.data[0]
  } catch (error) {
    ElMessage.error('加载应用数据失败')
  }
}

function connectWebSocket() {
  const token = localStorage.getItem('auth_token')
  const wsUrl = `ws://${window.location.hostname}:8078/ws`

  wsConnection = new WebSocket(wsUrl, ['bearer', token])

  wsConnection.onopen = () => {
    wsConnected.value = true
    ElMessage.success('已连接到智能助手')
  }

  wsConnection.onmessage = (event) => {
    const data = JSON.parse(event.data)
    handleWebSocketMessage(data)
  }

  wsConnection.onerror = () => {
    ElMessage.error('WebSocket 连接失败')
  }

  wsConnection.onclose = () => {
    wsConnected.value = false
  }
}

function disconnectWebSocket() {
  if (wsConnection) {
    wsConnection.close()
  }
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'agent:status':
      if (data.status === 'thinking') {
        isThinking.value = true
      }
      chatMessages.value.push({
        type: 'status',
        content: data.message
      })
      break

    case 'agent:result':
      isThinking.value = false
      // Display execution log
      if (data.executionLog) {
        data.executionLog.forEach(logEntry => {
          if (logEntry.type === 'tool_results') {
            logEntry.data.results.forEach(toolResult => {
              chatMessages.value.push({
                type: 'tool',
                tool: toolResult.tool,
                result: JSON.stringify(toolResult.result, null, 2)
              })
            })
          }
        })
      }
      if (data.success) {
        ElMessage.success(`任务完成 (共 ${data.totalTurns} 轮)`)
      } else {
        ElMessage.warning('任务未完全完成，已达到最大轮次')
      }
      break

    case 'agent:file_change':
      // File changed - show toast
      ElMessage.info({
        message: `文件已更新: ${data.data.path}`,
        duration: 2000,
        showClose: true
      })
      // Auto refresh preview
      setTimeout(() => refreshPreview(), 500)
      break

    case 'agent:error':
      ElMessage.error(data.error)
      isThinking.value = false
      break

    case 'error':
      ElMessage.error(data.message)
      isThinking.value = false
      break
  }

  scrollToBottom()
}

async function sendMessage() {
  if (!userInput.value.trim() || !wsConnected.value) return

  const message = userInput.value.trim()
  
  // Add user message to chat
  chatMessages.value.push({
    type: 'user',
    content: message
  })
  
  userInput.value = ''

  // Send to agent via WebSocket
  wsConnection.send(JSON.stringify({
    type: 'agent:task',
    prompt: message,
    projectPath: 'eiscore-apps'
  }))

  isThinking.value = true
  scrollToBottom()
}

function formatAgentMessage(content) {
  // Simple markdown formatting
  return content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

function scrollToBottom() {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
}

function refreshPreview() {
  if (previewIframeRef.value) {
    previewIframeRef.value.src = previewIframeRef.value.src
  }
}

async function saveApp() {
  saving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        updated_at: new Date().toISOString()
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

async function publishApp() {
  try {
    const token = localStorage.getItem('auth_token')
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        status: 'published',
        updated_at: new Date().toISOString()
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    ElMessage.success('应用已发布')
    await loadAppData()
  } catch (error) {
    ElMessage.error('发布失败: ' + error.message)
  }
}

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.flash-builder {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.builder-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.header-right {
  display: flex;
  gap: 12px;
}

.builder-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message {
  margin-bottom: 16px;
}

.message-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.message.user .message-content {
  justify-content: flex-end;
}

.message.user .message-content span {
  background: var(--el-color-primary);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  max-width: 70%;
}

.message.agent .message-content span {
  background: var(--el-fill-color-light);
  padding: 8px 16px;
  border-radius: 8px;
  max-width: 70%;
}

.message-content.tool {
  flex-direction: column;
  background: var(--el-fill-color-lighter);
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
}

.message-content.tool pre {
  margin: 8px 0 0 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.message-content.status {
  color: var(--el-color-info);
  font-size: 14px;
}

.chat-input {
  padding: 16px;
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  gap: 12px;
}

.chat-input .el-textarea {
  flex: 1;
}

.code-editor-container {
  height: 300px;
  border-top: 1px solid var(--el-border-color-light);
}

.editor-header {
  height: 40px;
  background: var(--el-fill-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
}

.monaco-editor {
  height: calc(100% - 40px);
}

.right-panel {
  width: 50%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.preview-header {
  height: 48px;
  background: var(--el-fill-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.preview-frame {
  flex: 1;
  width: 100%;
  border: none;
}
</style>
