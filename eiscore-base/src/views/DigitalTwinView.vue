<template>
  <div class="digital-twin-view">
    <div class="twin-container">
      <!-- 侧边栏：会话列表 + 知识库 -->
      <div class="twin-sidebar" :class="{ collapsed: !showSidebar }">
        <div class="sidebar-toggle" @click="showSidebar = !showSidebar">
          <el-icon><component :is="showSidebar ? 'DArrowLeft' : 'DArrowRight'" /></el-icon>
        </div>

        <div v-if="showSidebar" class="sidebar-content">
          <!-- 新建对话 -->
          <el-button type="primary" class="new-session-btn" @click="createSession">
            <el-icon><Plus /></el-icon> 新建对话
          </el-button>

          <!-- 会话标签页 -->
          <el-tabs v-model="sidebarTab" class="sidebar-tabs">
            <el-tab-pane label="对话" name="sessions">
              <div class="session-list">
                <div
                  v-for="sess in sessions"
                  :key="sess.id"
                  class="session-item"
                  :class="{ active: sess.id === currentSessionId }"
                  @click="switchSession(sess.id)"
                >
                  <div class="session-info">
                    <span class="session-title">{{ sess.title || '新对话' }}</span>
                    <span class="session-time">{{ formatTime(sess.updated_at || sess.created_at) }}</span>
                  </div>
                  <el-icon class="session-delete" @click.stop="deleteSession(sess.id)"><Delete /></el-icon>
                </div>
                <el-empty v-if="sessions.length === 0" description="暂无对话" :image-size="60" />
              </div>
            </el-tab-pane>

            <el-tab-pane label="知识库" name="knowledge">
              <div class="kb-header">
                <el-upload
                  :show-file-list="false"
                  :before-upload="handleFileUpload"
                  multiple
                  accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.json,.png,.jpg,.jpeg"
                >
                  <el-button size="small" type="primary" :loading="uploading">
                    <el-icon><Upload /></el-icon> 上传文件
                  </el-button>
                </el-upload>
              </div>
              <div class="kb-file-list">
                <div v-for="file in knowledgeFiles" :key="file.id" class="kb-file-item">
                  <div class="file-info">
                    <el-icon class="file-icon"><Document /></el-icon>
                    <span class="file-name">{{ file.file_name }}</span>
                    <span class="file-size">{{ formatSize(file.file_size) }}</span>
                  </div>
                  <el-icon class="file-delete" @click="deleteKnowledgeFile(file.id)"><Delete /></el-icon>
                </div>
                <el-empty v-if="knowledgeFiles.length === 0" description="暂无文件" :image-size="60" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- 主聊天区域 -->
      <div class="twin-main">
        <!-- 头部 -->
        <div class="twin-header">
          <div class="header-info">
            <span class="header-icon">🤖</span>
            <span class="header-title">我的数字分身</span>
            <el-tag size="small" type="success" effect="plain">AI 助手</el-tag>
          </div>
          <div class="header-status">
            <span v-if="isThinking" class="status-dot thinking"></span>
            <span v-if="isThinking" class="status-text">{{ thinkingText }}</span>
          </div>
        </div>

        <!-- 消息列表 -->
        <div class="twin-messages" ref="messagesRef">
          <div v-if="messages.length === 0" class="welcome-block">
            <div class="welcome-avatar">🤖</div>
            <h3>你好，我是你的数字分身</h3>
            <p>我可以帮你查询系统数据、分析工作情况、搜索知识库文件。试试问我：</p>
            <div class="welcome-suggestions">
              <el-button
                v-for="(s, i) in suggestions"
                :key="i"
                size="small"
                @click="sendPredefined(s)"
              >{{ s }}</el-button>
            </div>
          </div>

          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message-row"
            :class="msg.role"
          >
            <div class="msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
            <div class="msg-content">
              <!-- 工具调用状态 -->
              <div v-if="msg.toolEvents && msg.toolEvents.length" class="tool-events">
                <div v-for="(te, ti) in msg.toolEvents" :key="ti" class="tool-event">
                  <el-icon class="tool-icon" :class="{ spinning: te.type === 'tool_start' }">
                    <component :is="te.type === 'tool_done' ? 'CircleCheck' : 'Loading'" />
                  </el-icon>
                  <span class="tool-label">
                    {{ te.type === 'tool_start' ? `正在查询: ${toolNameZh(te.tool)}` : `已查询: ${toolNameZh(te.tool)} (${te.durationMs || 0}ms)` }}
                  </span>
                </div>
              </div>
              <!-- 消息文本 -->
              <div class="msg-bubble" v-if="msg.content">
                <div class="markdown-body" v-html="renderMd(msg.content)"></div>
                <span v-if="msg.role === 'assistant' && idx === messages.length - 1 && isStreaming" class="typing-cursor"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="twin-input-area">
          <div class="input-row">
            <el-input
              v-model="inputText"
              type="textarea"
              :rows="2"
              :autosize="{ minRows: 1, maxRows: 4 }"
              placeholder="输入消息，向你的数字分身提问..."
              resize="none"
              @keydown.enter.exact.prevent="sendMessage"
              :disabled="isThinking"
            />
            <el-button
              type="primary"
              :icon="Promotion"
              circle
              class="send-btn"
              @click="sendMessage"
              :loading="isThinking"
              :disabled="!inputText.trim() || isThinking"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import {
  Plus, Delete, Upload, Document, Promotion,
  DArrowLeft, DArrowRight, CircleCheck, Loading
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import markdownit from 'markdown-it'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

// ── Markdown 渲染器 ──
const md = markdownit({ html: false, linkify: true, typographer: true })
const renderMd = (text) => {
  if (!text) return ''
  return md.render(text)
}

// ── Store & Auth ──
const userStore = useUserStore()

const getAuthHeaders = () => {
  const tokenStr = localStorage.getItem('auth_token') || ''
  let token = tokenStr
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed?.token) token = parsed.token
  } catch {}
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

// ── 状态 ──
const showSidebar = ref(true)
const sidebarTab = ref('sessions')
const sessions = ref([])
const currentSessionId = ref(null)
const messages = ref([])
const inputText = ref('')
const isThinking = ref(false)
const isStreaming = ref(false)
const thinkingText = ref('正在思考...')
const uploading = ref(false)
const knowledgeFiles = ref([])
const messagesRef = ref(null)

const suggestions = [
  '我是谁？查一下我的个人信息',
  '帮我看看仓库里还有多少库存',
  '最近有哪些新入职的同事',
  '列出我知识库里的文件'
]

// ── 工具名中文映射 ──
const TOOL_NAME_MAP = {
  query_employees: '员工信息',
  query_departments: '组织架构',
  query_materials: '物料台账',
  query_inventory: '库存数据',
  query_warehouses: '仓库信息',
  query_apps: '应用中心',
  get_my_info: '个人信息',
  search_knowledge: '知识库',
  list_knowledge: '知识库文件'
}
const toolNameZh = (name) => TOOL_NAME_MAP[name] || name

// ── 格式化 ──
const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400 * 1000) return `${Math.floor(diff / 3600000)}小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const formatSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// ── API 调用 ──
const apiCall = async (path, options = {}) => {
  const url = `/agent${path}`
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: getAuthHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ── 会话管理 ──
const loadSessions = async () => {
  try {
    const data = await apiCall('/twin/sessions')
    sessions.value = data.sessions || []
  } catch (e) {
    console.warn('[twin] load sessions failed:', e)
  }
}

const createSession = async () => {
  currentSessionId.value = null
  messages.value = []
}

const switchSession = async (id) => {
  if (currentSessionId.value === id) return
  currentSessionId.value = id
  try {
    const data = await apiCall(`/twin/messages?session_id=${id}`)
    messages.value = (data.messages || []).map(m => ({
      role: m.role,
      content: m.content,
      toolEvents: []
    }))
    scrollToBottom()
  } catch (e) {
    console.warn('[twin] load messages failed:', e)
    messages.value = []
  }
}

const deleteSession = async (id) => {
  try {
    await apiCall(`/twin/sessions?id=${id}`, { method: 'DELETE' })
    sessions.value = sessions.value.filter(s => s.id !== id)
    if (currentSessionId.value === id) {
      currentSessionId.value = null
      messages.value = []
    }
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

// ── 知识库管理 ──
const loadKnowledgeFiles = async () => {
  try {
    const data = await apiCall('/twin/knowledge')
    knowledgeFiles.value = data.files || []
  } catch (e) {
    console.warn('[twin] load KB failed:', e)
  }
}

const handleFileUpload = async (file) => {
  uploading.value = true
  try {
    // 提取文件文本内容
    let contentText = ''
    let contentB64 = ''

    if (file.type.startsWith('image/')) {
      contentB64 = await readFileAsBase64(file)
      contentText = `[图片文件: ${file.name}]`
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      contentText = await parseExcel(file)
    } else if (file.name.endsWith('.docx')) {
      contentText = await parseDocx(file)
    } else {
      contentText = await readFileAsText(file)
    }

    await apiCall('/twin/knowledge/upload', {
      method: 'POST',
      body: {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        contentText: contentText.slice(0, 200000),
        contentB64: contentB64.slice(0, 2000000),
        tags: [],
        summary: ''
      }
    })

    ElMessage.success(`已上传: ${file.name}`)
    await loadKnowledgeFiles()
  } catch (e) {
    ElMessage.error(`上传失败: ${e.message}`)
  } finally {
    uploading.value = false
  }
  return false // 阻止 el-upload 默认行为
}

const deleteKnowledgeFile = async (id) => {
  try {
    await apiCall(`/twin/knowledge?id=${id}`, { method: 'DELETE' })
    knowledgeFiles.value = knowledgeFiles.value.filter(f => f.id !== id)
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

// ── 文件解析 ──
const readFileAsText = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result || '')
  reader.onerror = () => resolve('')
  reader.readAsText(file)
})

const readFileAsBase64 = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result || ''
    resolve(result.split(',')[1] || '')
  }
  reader.onerror = () => resolve('')
  reader.readAsDataURL(file)
})

const parseExcel = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheets = workbook.SheetNames.map(name => {
        const ws = workbook.Sheets[name]
        return `[Sheet: ${name}]\n${XLSX.utils.sheet_to_csv(ws)}`
      })
      resolve(sheets.join('\n\n'))
    } catch {
      resolve(`[解析失败: ${file.name}]`)
    }
  }
  reader.readAsArrayBuffer(file)
})

const parseDocx = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    mammoth.extractRawText({ arrayBuffer: e.target.result })
      .then(res => resolve(res.value || ''))
      .catch(() => resolve(`[解析失败: ${file.name}]`))
  }
  reader.readAsArrayBuffer(file)
})

// ── 发送消息（SSE 流式） ──
const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || isThinking.value) return

  inputText.value = ''
  isThinking.value = true
  isStreaming.value = true
  thinkingText.value = '正在思考...'

  // 添加用户消息
  messages.value.push({ role: 'user', content: text, toolEvents: [] })

  // 添加空 AI 消息（用于流式填充）
  const aiMsg = reactive({ role: 'assistant', content: '', toolEvents: [] })
  messages.value.push(aiMsg)
  scrollToBottom()

  try {
    const payload = {
      message: text,
      session_id: currentSessionId.value || undefined,
      history: currentSessionId.value ? undefined : messages.value
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
        .slice(-12)
        .map(m => ({ role: m.role, content: m.content }))
    }

    const response = await fetch('/agent/twin/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`请求失败 (${response.status}): ${errText.slice(0, 200)}`)
    }

    if (!response.body) throw new Error('无法获取流式响应')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const jsonStr = line.replace('data:', '').trim()
        if (!jsonStr || jsonStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(jsonStr)

          // 处理不同事件类型
          if (parsed.type === 'thinking') {
            thinkingText.value = parsed.message || '正在思考...'
          } else if (parsed.type === 'tool_start') {
            aiMsg.toolEvents.push({ type: 'tool_start', tool: parsed.tool })
            thinkingText.value = `正在查询${toolNameZh(parsed.tool)}...`
          } else if (parsed.type === 'tool_done') {
            // 更新对应的 tool_start 为 tool_done
            const existing = aiMsg.toolEvents.find(
              e => e.tool === parsed.tool && e.type === 'tool_start'
            )
            if (existing) {
              existing.type = 'tool_done'
              existing.durationMs = parsed.durationMs || parsed.result?.durationMs || 0
            } else {
              aiMsg.toolEvents.push({ type: 'tool_done', tool: parsed.tool, durationMs: parsed.durationMs || 0 })
            }
          } else if (parsed.type === 'meta') {
            // 保存会话 ID
            if (parsed.session_id && !currentSessionId.value) {
              currentSessionId.value = parsed.session_id
            }
          } else if (parsed.type === 'error') {
            aiMsg.content += `\n[错误: ${parsed.message || '未知错误'}]`
          } else if (parsed.choices?.[0]?.delta?.content) {
            // 标准 SSE 文本块
            aiMsg.content += parsed.choices[0].delta.content
          }

          scrollToBottom()
        } catch {
          // skip invalid JSON
        }
      }
    }

    // 刷新会话列表
    await loadSessions()
  } catch (e) {
    aiMsg.content += `\n[请求失败: ${e.message}]`
  } finally {
    isThinking.value = false
    isStreaming.value = false
    thinkingText.value = ''
    scrollToBottom()
  }
}

const sendPredefined = (text) => {
  inputText.value = text
  sendMessage()
}

// ── 滚动 ──
const scrollToBottom = () => {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// ── 生命周期 ──
onMounted(async () => {
  await Promise.all([loadSessions(), loadKnowledgeFiles()])
})
</script>

<style scoped lang="scss">
.digital-twin-view {
  width: 100%;
  height: 100%;
  background: var(--el-bg-color-page, #f5f7fa);
}

.twin-container {
  display: flex;
  height: 100%;
  overflow: hidden;
}

// ── 侧边栏 ──
.twin-sidebar {
  position: relative;
  width: 280px;
  min-width: 280px;
  background: var(--el-bg-color, #fff);
  border-right: 1px solid var(--el-border-color-lighter, #ebeef5);
  display: flex;
  flex-direction: column;
  transition: width 0.2s, min-width 0.2s;

  &.collapsed {
    width: 32px;
    min-width: 32px;
  }
}

.sidebar-toggle {
  position: absolute;
  top: 12px;
  right: -14px;
  z-index: 10;
  width: 28px;
  height: 28px;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--el-color-primary-light-9);
  }
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
}

.new-session-btn {
  width: 100%;
  margin-bottom: 12px;
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-time {
    display: block;
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    margin-top: 2px;
  }

  .session-delete {
    opacity: 0;
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    transition: opacity 0.15s;

    &:hover {
      color: var(--el-color-danger);
    }
  }

  &:hover .session-delete {
    opacity: 1;
  }
}

// ── 知识库 ──
.kb-header {
  margin-bottom: 8px;
}

.kb-file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kb-file-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  transition: background 0.15s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  .file-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .file-icon {
    color: var(--el-color-primary);
  }

  .file-name {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-size {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
  }

  .file-delete {
    opacity: 0;
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    margin-left: 4px;

    &:hover { color: var(--el-color-danger); }
  }

  &:hover .file-delete { opacity: 1; }
}

// ── 主区域 ──
.twin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.twin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color, #fff);

  .header-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon {
    font-size: 24px;
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
  }

  .header-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--el-color-success);

    &.thinking {
      animation: pulse 1s infinite;
      background: var(--el-color-primary);
    }
  }

  .status-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

// ── 消息区 ──
.twin-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.welcome-block {
  text-align: center;
  padding: 60px 20px 30px;

  .welcome-avatar {
    font-size: 48px;
    margin-bottom: 16px;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
  }

  p {
    color: var(--el-text-color-secondary);
    margin: 0 0 20px;
  }

  .welcome-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
}

.message-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  max-width: 85%;

  &.user {
    flex-direction: row-reverse;
    margin-left: auto;

    .msg-bubble {
      background: var(--el-color-primary);
      color: #fff;
      border-radius: 12px 2px 12px 12px;
    }
  }

  &.assistant {
    .msg-bubble {
      background: var(--el-bg-color, #fff);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 2px 12px 12px 12px;
    }
  }
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: var(--el-fill-color-light);
}

.msg-content {
  min-width: 0;
}

.tool-events {
  margin-bottom: 6px;

  .tool-event {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    padding: 2px 0;

    .tool-icon {
      font-size: 14px;
      color: var(--el-color-success);

      &.spinning {
        animation: spin 1s linear infinite;
        color: var(--el-color-primary);
      }
    }
  }
}

.msg-bubble {
  padding: 10px 14px;
  line-height: 1.6;
  font-size: 14px;
  word-break: break-word;

  .markdown-body {
    :deep(p) { margin: 0 0 8px; &:last-child { margin-bottom: 0; } }
    :deep(ul), :deep(ol) { padding-left: 18px; margin: 4px 0; }
    :deep(code) { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-size: 13px; }
    :deep(pre) { background: rgba(0,0,0,0.06); padding: 8px 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0;
      code { background: none; padding: 0; }
    }
    :deep(table) { border-collapse: collapse; margin: 8px 0;
      th, td { border: 1px solid var(--el-border-color); padding: 4px 8px; font-size: 13px; }
      th { background: var(--el-fill-color-light); }
    }
  }
}

.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: currentColor;
  margin-left: 2px;
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
}

// ── 输入区 ──
.twin-input-area {
  padding: 12px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color, #fff);

  .input-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  :deep(.el-textarea__inner) {
    border-radius: 8px;
  }

  .send-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
  }
}

// ── 动画 ──
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
