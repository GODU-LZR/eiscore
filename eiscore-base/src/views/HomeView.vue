<template>
  <div class="home-view">
    <!-- 顶部模式切换栏 -->
    <div class="home-header">
      <div class="header-left">
        <el-icon class="header-icon" :size="22">
          <component :is="activeMode === 'twin' ? 'Service' : 'DataAnalysis'" />
        </el-icon>
        <span class="header-title">{{ activeMode === 'twin' ? '我的数字分身' : '企业经营助手' }}</span>
        <el-tag v-if="activeMode === 'twin'" size="small" type="success" effect="plain">AI 助手</el-tag>
        <el-tag v-else size="small" type="warning" effect="plain">经营分析</el-tag>
      </div>
      <div class="header-right">
        <!-- 管理员才显示模式切换 -->
        <el-segmented
          v-if="isAdmin"
          v-model="activeMode"
          :options="modeOptions"
          size="small"
          class="mode-switcher"
        />
        <div v-if="activeMode === 'twin'" class="header-actions">
          <el-tooltip content="历史会话" placement="bottom">
            <el-icon class="action-icon" :class="{ active: showSidebar }" @click="showSidebar = !showSidebar">
              <Operation />
            </el-icon>
          </el-tooltip>
          <el-tooltip content="新建对话" placement="bottom">
            <el-icon class="action-icon" @click="createSession"><Plus /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- 数字分身聊天区域 -->
    <div v-show="activeMode === 'twin'" class="twin-wrapper">
      <div class="twin-body">
        <!-- 侧边栏 -->
        <div class="history-sidebar" :class="{ show: showSidebar }">
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
                  <span class="session-title">{{ sess.title || '新对话' }}</span>
                  <span class="session-time">{{ formatTime(sess.updated_at || sess.created_at) }}</span>
                  <el-icon class="delete-icon" @click.stop="deleteSession(sess.id)"><Delete /></el-icon>
                </div>
                <el-empty v-if="sessions.length === 0" description="暂无对话" :image-size="50" />
              </div>
            </el-tab-pane>
            <el-tab-pane label="知识库" name="knowledge">
              <div class="kb-section">
                <el-upload
                  :show-file-list="false"
                  :before-upload="handleFileUpload"
                  multiple
                  accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.json,.png,.jpg,.jpeg"
                >
                  <el-button size="small" type="primary" :loading="uploading" class="kb-upload-btn">
                    <el-icon><Upload /></el-icon> 上传文件
                  </el-button>
                </el-upload>
                <div class="kb-file-list">
                  <div v-for="file in knowledgeFiles" :key="file.id" class="kb-file-item">
                    <el-icon class="file-icon"><Document /></el-icon>
                    <span class="file-name">{{ file.file_name }}</span>
                    <span class="file-size">{{ formatSize(file.file_size) }}</span>
                    <el-icon class="delete-icon" @click="deleteKnowledgeFile(file.id)"><Delete /></el-icon>
                  </div>
                  <el-empty v-if="knowledgeFiles.length === 0" description="暂无文件" :image-size="50" />
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 聊天区域 -->
        <div class="chat-area" @click="showSidebar = false">
          <div class="messages-container" ref="messagesRef">
            <!-- 欢迎界面 -->
            <div v-if="messages.length === 0" class="welcome-block">
              <div class="welcome-icon">
                <el-icon :size="48" color="var(--el-color-primary)"><Service /></el-icon>
              </div>
              <h3>你好，我是你的数字分身</h3>
              <p>我可以帮你查询系统数据、分析工作情况、搜索知识库文件。试试问我：</p>
              <div class="welcome-suggestions">
                <div
                  v-for="(s, i) in suggestions"
                  :key="i"
                  class="suggestion-item"
                  @click="sendPredefined(s.text)"
                >
                  <el-icon class="suggestion-icon"><component :is="s.icon" /></el-icon>
                  <span>{{ s.text }}</span>
                </div>
              </div>
            </div>

            <!-- 消息列表 -->
            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              class="message-row"
              :class="msg.role"
            >
              <div class="avatar-wrapper">
                <div class="avatar">
                  <el-icon v-if="msg.role === 'user'" :size="16"><UserFilled /></el-icon>
                  <el-icon v-else :size="16"><Service /></el-icon>
                </div>
              </div>
              <div class="content-wrapper">
                <!-- 工具调用状态 -->
                <div v-if="msg.toolEvents && msg.toolEvents.length" class="tool-events">
                  <div v-for="(te, ti) in msg.toolEvents" :key="ti" class="tool-event-item">
                    <el-icon class="tool-status-icon" :class="{ spinning: te.type === 'tool_start', error: te.type === 'tool_done' && te.success === false }">
                      <component :is="te.type === 'tool_start' ? 'Loading' : (te.success === false ? 'WarningFilled' : 'CircleCheck')" />
                    </el-icon>
                    <span class="tool-label">
                      {{ te.type === 'tool_start' ? `正在查询: ${toolNameZh(te.tool)}` : (te.success === false ? `查询失败: ${toolNameZh(te.tool)}` : `已查询: ${toolNameZh(te.tool)}`) }}
                      <span v-if="te.type === 'tool_done' && te.durationMs" class="tool-duration">({{ te.durationMs }}ms)</span>
                    </span>
                  </div>
                </div>
                <!-- 消息气泡 -->
                <div class="bubble" v-if="msg.content">
                  <div class="markdown-body" v-html="renderMd(msg.content)"></div>
                  <span
                    v-if="msg.role === 'assistant' && idx === messages.length - 1 && isStreaming"
                    class="typing-cursor"
                  ></span>
                </div>
              </div>
            </div>

            <!-- 思考状态 -->
            <div v-if="isThinking && (!messages.length || messages[messages.length - 1].role !== 'assistant')" class="thinking-indicator">
              <el-icon class="thinking-icon spinning"><Loading /></el-icon>
              <span>{{ thinkingText }}</span>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="input-section">
            <div class="input-box">
              <el-upload
                action="#"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="(file) => handleChatFileAttach(file.raw)"
                class="upload-trigger"
              >
                <el-icon class="tool-icon"><Paperclip /></el-icon>
              </el-upload>

              <textarea
                v-model="inputText"
                placeholder="输入消息，向你的数字分身提问..."
                @keydown.enter.exact.prevent="sendMessage"
                :disabled="isThinking"
              ></textarea>

              <div
                class="send-btn"
                :class="{ disabled: isThinking || !inputText.trim() }"
                @click="sendMessage"
              >
                <el-icon v-if="isThinking" class="is-loading"><Loading /></el-icon>
                <el-icon v-else><Position /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 企业经营助手（内联嵌入） -->
    <div v-show="activeMode === 'enterprise'" class="enterprise-wrapper">
      <AiCopilot mode="enterprise" :auto-open="true" />
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import AiCopilot from '@/components/AiCopilot.vue'
import { aiBridge } from '@/utils/ai-bridge'
import {
  Plus, Delete, Upload, Document, Position, Paperclip,
  CircleCheck, Loading, Operation, Service, UserFilled,
  DataAnalysis, Search, User, List, FolderOpened, WarningFilled
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
const router = useRouter()
const userStore = useUserStore()

const isAdmin = computed(() => {
  const role = userStore.userInfo?.role
  return role === 'super_admin' || role === 'admin'
})

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

// ── 模式切换 ──
const activeMode = ref('twin')
const modeOptions = [
  { label: '数字分身', value: 'twin' },
  { label: '经营助手', value: 'enterprise' }
]

watch(activeMode, (val) => {
  if (val === 'enterprise') {
    // 内联显示企业经营助手
    aiBridge.setMode('enterprise')
    aiBridge.openWindow()
  } else {
    // 切回数字分身时关闭企业助手
    aiBridge.closeWindow()
  }
})

onBeforeUnmount(() => {
  // 离开首页时关闭企业助手窗口
  if (activeMode.value === 'enterprise') {
    aiBridge.closeWindow()
  }
})

// ── 数字分身状态 ──
const showSidebar = ref(false)
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
  { text: '我是谁？查一下我的个人信息', icon: 'User' },
  { text: '帮我看看仓库里还有多少库存', icon: 'Search' },
  { text: '最近有哪些新入职的同事', icon: 'List' },
  { text: '列出我知识库里的文件', icon: 'FolderOpened' }
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

const createSession = () => {
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
  return false
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

// ── 聊天附件（暂存提示） ──
const handleChatFileAttach = () => {
  ElMessage.info('请通过知识库上传文件后，再在对话中引用')
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

  messages.value.push({ role: 'user', content: text, toolEvents: [] })
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

          if (parsed.type === 'thinking') {
            thinkingText.value = parsed.message || '正在思考...'
          } else if (parsed.type === 'tool_start') {
            aiMsg.toolEvents.push({ type: 'tool_start', tool: parsed.tool })
            thinkingText.value = `正在查询${toolNameZh(parsed.tool)}...`
          } else if (parsed.type === 'tool_done') {
            const existing = aiMsg.toolEvents.find(
              e => e.tool === parsed.tool && e.type === 'tool_start'
            )
            if (existing) {
              existing.type = 'tool_done'
              existing.durationMs = parsed.durationMs || parsed.result?.durationMs || 0
              existing.success = parsed.success !== false
              if (parsed.success === false) {
                existing.error = parsed.error || parsed.output?.error || ''
              }
            } else {
              aiMsg.toolEvents.push({
                type: 'tool_done',
                tool: parsed.tool,
                durationMs: parsed.durationMs || 0,
                success: parsed.success !== false,
                error: parsed.success === false ? (parsed.error || parsed.output?.error || '') : ''
              })
            }
          } else if (parsed.type === 'meta') {
            if (parsed.session_id && !currentSessionId.value) {
              currentSessionId.value = parsed.session_id
            }
          } else if (parsed.type === 'error') {
            aiMsg.content += `\n[错误: ${parsed.message || '未知错误'}]`
          } else if (parsed.choices?.[0]?.delta?.content) {
            aiMsg.content += parsed.choices[0].delta.content
          }
          scrollToBottom()
        } catch {
          // skip invalid JSON
        }
      }
    }

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
$primary-color: var(--el-color-primary, #409EFF);
$border-color: var(--el-border-color, #dcdfe6);

.home-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 覆盖 el-main 默认 overflow:auto 对本页的影响 */
  flex: 1;
  min-height: 0;
  --ai-panel-bg: var(--el-color-primary-light-9, #f5f7fa);
  --ai-panel-surface: #ffffff;
}

// ── 顶部栏 ──
.home-header {
  height: 52px;
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: var(--ai-panel-surface);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-icon { color: $primary-color; }
    .header-title { font-weight: 600; font-size: 15px; }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    font-size: 18px;
    color: #909399;

    .action-icon {
      cursor: pointer;
      transition: color 0.2s;
      &:hover { color: $primary-color; }
      &.active { color: $primary-color; }
    }
  }

  .mode-switcher {
    :deep(.el-segmented-item) {
      padding: 2px 12px;
    }
  }
}

// ── 数字分身整体 ──
.twin-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// ── 企业经营助手内联容器 ──
.enterprise-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;

  // 覆盖 AiCopilot 的 position: fixed 全屏定位，变为内联
  :deep(.ai-copilot-container) {
    position: relative !important;
    inset: unset !important;
    bottom: unset !important;
    right: unset !important;
    z-index: auto !important;
    width: 100% !important;
    height: 100% !important;
  }
  :deep(.ai-copilot-container.is-open) {
    inset: unset !important;
  }
  :deep(.ai-window) {
    position: relative !important;
    inset: unset !important;
    border-radius: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }
  // 隐藏 AiCopilot 自带的 header，HomeView 已有自己的
  :deep(.ai-header) {
    display: none !important;
  }
  // 隐藏触发按钮
  :deep(.ai-trigger-btn) {
    display: none !important;
  }
}

.twin-body {
  display: flex;
  height: 100%;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

// ── 侧边栏 ──
.history-sidebar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px;
  background: var(--ai-panel-surface);
  border-right: 1px solid $border-color;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: 0 8px;

  &.show {
    transform: translateX(0);
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
  gap: 2px;
}

.session-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
  transition: background 0.15s;

  &:hover { background: var(--el-fill-color-light, #f5f7fa); }
  &.active { background: var(--el-color-primary-light-9, #ecf5ff); color: $primary-color; }

  .session-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-time {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    margin-left: 6px;
    flex-shrink: 0;
  }

  .delete-icon {
    display: none;
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    margin-left: 4px;
    &:hover { color: var(--el-color-danger); }
  }

  &:hover .delete-icon { display: block; }
}

// ── 知识库 ──
.kb-section {
  padding-top: 4px;
}

.kb-upload-btn {
  width: 100%;
  margin-bottom: 8px;
}

.kb-file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kb-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;
  transition: background 0.15s;

  &:hover { background: var(--el-fill-color-light); }

  .file-icon { color: $primary-color; flex-shrink: 0; }

  .file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
  }

  .delete-icon {
    opacity: 0;
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    &:hover { color: var(--el-color-danger); }
  }

  &:hover .delete-icon { opacity: 1; }
}

// ── 聊天区域 ──
.chat-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ai-panel-bg);
  width: 100%;
}

.messages-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

// ── 欢迎界面 ──
.welcome-block {
  text-align: center;
  padding: 20px;
  margin: auto 0;

  .welcome-icon {
    margin-bottom: 16px;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
  }

  p {
    color: var(--el-text-color-secondary);
    margin: 0 0 24px;
    font-size: 14px;
  }
}

.welcome-suggestions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  max-width: 480px;
  margin: 0 auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--ai-panel-surface);
  border: 1px solid $border-color;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
  transition: all 0.2s;

  &:hover {
    border-color: $primary-color;
    color: $primary-color;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .suggestion-icon {
    font-size: 16px;
    color: $primary-color;
    flex-shrink: 0;
  }
}

// ── 消息行 ──
.message-row {
  display: flex;
  gap: 12px;

  &.user { flex-direction: row-reverse; }

  .avatar-wrapper {
    flex-shrink: 0;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    color: var(--el-text-color-secondary);
  }

  &.user .avatar {
    background: $primary-color;
    color: #fff;
  }

  .content-wrapper {
    max-width: 85%;
    display: flex;
    flex-direction: column;
  }

  &.assistant .content-wrapper {
    width: min(85%, 1200px);
  }

  .bubble {
    padding: 14px 20px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.7;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    background: #fff;
    color: #303133;
    position: relative;
  }

  &.user .bubble {
    background: $primary-color;
    color: #fff;
    border-top-right-radius: 2px;
  }

  &.assistant .bubble {
    border-top-left-radius: 2px;
    width: 100%;
  }
}

// ── 工具事件 ──
.tool-events {
  margin-bottom: 6px;
}

.tool-event-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 2px 0;

  .tool-status-icon {
    font-size: 14px;
    color: var(--el-color-success);

    &.spinning {
      animation: spin 1s linear infinite;
      color: $primary-color;
    }

    &.error {
      color: var(--el-color-danger);
    }
  }

  .tool-duration {
    color: var(--el-text-color-placeholder);
    font-size: 11px;
  }
}

// ── 思考状态 ──
.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--el-text-color-secondary);

  .thinking-icon {
    color: $primary-color;
  }
}

// ── Markdown 样式 ──
.markdown-body {
  :deep(p) { margin: 0 0 8px 0; &:last-child { margin-bottom: 0; } }
  :deep(pre) {
    background: #282c34;
    color: #abb2bf;
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
  }
  :deep(code) { font-family: 'Consolas', monospace; }
  :deep(ul), :deep(ol) { padding-left: 18px; margin: 4px 0; }
  :deep(table) {
    border-collapse: collapse;
    margin: 8px 0;
    th, td { border: 1px solid var(--el-border-color); padding: 4px 8px; font-size: 13px; }
    th { background: var(--el-fill-color-light); }
  }
  :deep(img) { max-width: 100%; border-radius: 4px; }
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

// ── 输入区域 ──
.input-section {
  background: var(--ai-panel-surface);
  border-top: 1px solid $border-color;
  padding: 12px;
}

.input-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f5f7fa;
  border-radius: 20px;
  padding: 4px 8px 4px 12px;
  border: 1px solid transparent;
  transition: all 0.2s;

  &:focus-within {
    background: #fff;
    border-color: $primary-color;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
  }

  .upload-trigger { display: flex; }

  .tool-icon {
    font-size: 20px;
    color: #909399;
    cursor: pointer;
    padding: 4px;
    &:hover { color: $primary-color; }
  }

  textarea {
    flex: 1;
    background: transparent;
    border: none;
    resize: none;
    height: 36px;
    padding: 8px 0;
    font-size: 14px;
    font-family: inherit;
    &:focus { outline: none; }
  }

  .send-btn {
    width: 32px;
    height: 32px;
    background: $primary-color;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: transform 0.2s;
    flex-shrink: 0;

    &.disabled { background: #c0c4cc; cursor: not-allowed; }
    &:not(.disabled):hover { transform: scale(1.1); }
    .is-loading { animation: rotate 1s linear infinite; }
  }
}

// ── 动画 ──
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes blink {
  50% { opacity: 0; }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
