<template>
  <div class="flash-builder">
    <div class="builder-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>{{ appData?.name || '闪念应用构建器' }}</h2>
        <el-tag size="small" type="info">{{ modeLabel }}</el-tag>
      </div>
      <div class="header-right">
        <el-radio-group v-if="codeServerEnabled" v-model="flashMode" size="small">
          <el-radio-button label="code_server">专业模式</el-radio-button>
          <el-radio-button label="legacy">壳模式</el-radio-button>
        </el-radio-group>
        <el-tag v-else size="small" type="success">只聊天壳</el-tag>
        <el-button @click="saveApp" :loading="saving">保存</el-button>
        <el-button type="primary" @click="publishApp" :loading="publishing">校验并发布</el-button>
      </div>
    </div>

    <el-alert
      class="builder-notice"
      type="info"
      :closable="false"
      show-icon
      title="写入约束：仅允许修改 src/views/drafts 目录，默认主文件为 FlashDraft.vue"
    />

    <div class="builder-content">
      <div class="left-panel">
        <template v-if="isCodeServerMode">
          <div class="panel-head">
            <span>专业模式（Cline 窗口）</span>
            <div class="panel-head-actions">
              <el-tag size="small" :type="ideChecking ? 'warning' : (ideReachable ? 'success' : 'danger')">
                {{ ideChecking ? '检测中' : (ideReachable ? '可连接' : '不可达') }}
              </el-tag>
              <el-button text size="small" :loading="ideChecking" @click="checkIdeReachability">检测</el-button>
              <el-button text size="small" @click="openIdeInNewTab">新窗口打开</el-button>
            </div>
          </div>
          <div class="ide-shell-only">
            <el-result
              icon="info"
              title="专业模式仅在独立窗口运行"
              :sub-title="ideShellSubtitle"
            >
              <template #extra>
                <el-space>
                  <el-button type="primary" @click="openIdeInNewTab">打开 Cline 窗口</el-button>
                  <el-button @click="flashMode = 'legacy'">切换壳模式</el-button>
                </el-space>
              </template>
            </el-result>
          </div>
        </template>

        <template v-else>
          <div class="panel-head">
            <span>壳模式（Cline CLI 对话）</span>
            <div class="panel-head-actions">
              <el-tag size="small" :type="shellConnected ? 'success' : (shellConnecting ? 'warning' : 'danger')">
                {{ shellConnected ? '已连接' : (shellConnecting ? '连接中' : '未连接') }}
              </el-tag>
              <el-button text size="small" :disabled="shellConnecting" @click="reconnectShell">重连</el-button>
              <el-button text size="small" :disabled="shellBusy" @click="resetShellSession">新会话</el-button>
              <el-button v-if="codeServerEnabled" text size="small" @click="openIdeInNewTab">专业窗口</el-button>
            </div>
          </div>
          <div class="shell-chat">
            <div class="shell-session-bar">
              <el-select
                v-model="shellConversationId"
                class="shell-session-select"
                size="small"
                :teleported="false"
                @change="switchShellConversation"
              >
                <el-option
                  v-for="item in shellConversationOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-button size="small" @click="createShellConversation">新建会话</el-button>
              <el-button size="small" text @click="deleteShellConversation">删除会话</el-button>
            </div>
            <div ref="shellMessagesRef" class="shell-messages">
              <div v-if="visibleShellMessages.length === 0" class="shell-empty">
                <el-result icon="info" title="开始对话" sub-title="输入需求后将直接调用 Cline CLI 生成/修改草稿。" />
              </div>
              <div v-for="msg in visibleShellMessages" :key="msg.id" class="shell-row" :class="msg.role">
                <div class="shell-avatar">{{ msg.role === 'user' ? 'U' : 'AI' }}</div>
                <div class="shell-bubble">
                  <template v-if="msg.role === 'assistant' && msg.thought">
                    <div class="shell-thought-head">
                      <span>思考过程（已隔离）</span>
                      <el-button text size="small" @click="toggleMessageThought(msg.id)">
                        {{ isMessageThoughtExpanded(msg.id) ? '收起' : '展开' }}
                      </el-button>
                    </div>
                    <transition name="fade">
                      <pre v-if="isMessageThoughtExpanded(msg.id)" class="shell-thought-text">{{ msg.thought }}</pre>
                    </transition>
                  </template>
                  <div
                    v-if="msg.role === 'assistant'"
                    class="shell-markdown"
                    :class="{ collapsed: isMessageCollapsed(msg) }"
                    v-html="renderShellMarkdown(msg.content)"
                  />
                  <pre v-else class="shell-text">{{ msg.content }}</pre>
                  <div v-if="canToggleMessage(msg)" class="shell-text-toggle">
                    <el-button text size="small" @click="toggleMessageExpand(msg.id)">
                      {{ isMessageCollapsed(msg) ? '展开全文' : '收起' }}
                    </el-button>
                  </div>
                </div>
              </div>
              <transition name="fade">
                <div v-if="shellBusy" class="shell-row assistant">
                  <div class="shell-avatar">AI</div>
                  <div class="shell-bubble shell-thinking">{{ shellHasFirstChunk ? 'AI 正在继续输出...' : 'AI 正在思考...' }}</div>
                </div>
              </transition>
              <transition name="fade">
                <div v-if="shellSlowHintVisible" class="shell-hint">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  <span>{{ shellSlowHintText }}</span>
                </div>
              </transition>
              <el-alert
                v-if="shellError"
                class="shell-error"
                type="error"
                :closable="false"
                :title="shellError"
              />
            </div>

            <div class="shell-composer">
              <el-input
                v-model="shellInput"
                type="textarea"
                :rows="4"
                resize="none"
                placeholder="描述你希望在 FlashDraft.vue 中生成或修改的界面..."
                @keydown.ctrl.enter.prevent="sendShellPrompt"
              />
              <div class="shell-composer-actions">
                <el-button
                  type="primary"
                  :loading="shellBusy"
                  :disabled="!shellInput.trim() || !shellConnected"
                  @click="sendShellPrompt"
                >
                  发送（Ctrl+Enter）
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="right-panel">
        <div class="preview-header">
          <div class="preview-title">
            <span>实时预览</span>
            <el-tag size="small" :type="previewReady ? 'success' : 'warning'">{{ previewReady ? '已就绪' : '编译中' }}</el-tag>
          </div>
          <div class="preview-actions">
            <el-button text :icon="RefreshRight" @click="refreshPreview">刷新</el-button>
          </div>
        </div>

        <div class="preview-wrapper">
          <iframe
            ref="previewIframeRef"
            :src="previewUrl"
            class="preview-frame"
            sandbox="allow-scripts allow-same-origin allow-forms"
            @load="onPreviewLoad"
            @error="onPreviewError"
          />

          <transition name="fade">
            <div v-if="previewMaskVisible" class="panel-mask preview-mask">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>{{ previewMaskText }}</span>
            </div>
          </transition>

          <div v-if="previewFatal" class="preview-fallback">
            <el-result icon="error" title="预览暂不可用" sub-title="系统正在后台重试，你也可以手动刷新。">
              <template #extra>
                <el-button type="primary" @click="refreshPreview">手动刷新</el-button>
              </template>
            </el-result>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Loading,
  RefreshRight
} from '@element-plus/icons-vue'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

const FLASH_MODES = {
  CODE_SERVER: 'code_server',
  LEGACY: 'legacy'
}

const DRAFT_ROOT_PATH = 'src/views/drafts'
const DRAFT_FILE_PATH = 'src/views/drafts/FlashDraft.vue'
const IDE_DRAFT_WORKSPACE = '/config/workspace/drafts'
const PREVIEW_ROUTE = '/flash-preview/apps/preview/flash-draft'
const MAX_PREVIEW_RETRIES = 8
const PREVIEW_MASK_MIN_MS = 420
const SHELL_WS_RETRY_DELAY_MS = 1800
const SHELL_HISTORY_LIMIT = 10
const SHELL_TYPE_INTERVAL_MS = 14
const SHELL_TYPE_STEP = 3
const SHELL_SLOW_HINT_DELAY_MS = 6500
const SHELL_AUTO_RETRY_DELAY_MS = 1200
const SHELL_MAX_AUTO_RETRY = 1
const SHELL_MAX_CONVERSATIONS = 12
const SHELL_MAX_MESSAGE_PER_CONVERSATION = 120
const SHELL_COLLAPSE_LENGTH = 320
const SHELL_MARKDOWN_CACHE_MAX = 180
const DEFAULT_FLASH_DRAFT_SOURCE = `<template>
  <div class="flash-draft-container">
    <h2>闪念应用草稿画板</h2>
    <p>请通过左侧智能体持续迭代此文件，发布前请先在构建器内校验。</p>
  </div>
</template>
`

const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})

const appId = computed(() => String(route.params.appId || ''))
const appData = ref(null)
const saving = ref(false)
const publishing = ref(false)

const flashMode = ref(FLASH_MODES.LEGACY)
const ideChecking = ref(false)
const ideReachable = ref(false)
const ideProbeError = ref('')

const previewIframeRef = ref(null)
const previewNonce = ref(Date.now())
const previewReady = ref(false)
const previewMaskVisible = ref(true)
const previewMaskText = ref('正在加载预览...')
const previewFatal = ref(false)
const previewRetries = ref(0)
const previewMaskStartAt = ref(0)
let previewRetryTimer = null

const shellMessagesRef = ref(null)
const shellInput = ref('')
const shellMessages = ref([])
const shellConversations = ref([])
const shellConversationId = ref('')
const shellMessageExpandMap = ref({})
const shellThoughtExpandMap = ref({})
const shellConnected = ref(false)
const shellConnecting = ref(false)
const shellBusy = ref(false)
const shellError = ref('')
const shellSlowHintVisible = ref(false)
const shellSlowHintText = ref('')
const shellHasFirstChunk = ref(false)
const shellAutoRetryCount = ref(0)
const shellLastRequest = ref(null)
const shellSessionId = computed(() => {
  const appPart = String(appId.value || 'default').replace(/[^a-zA-Z0-9_-]/g, '')
  const convPart = String(shellConversationId.value || 'default').replace(/[^a-zA-Z0-9_-]/g, '')
  return `flash-${appPart}-${convPart}`.slice(0, 96)
})
let shellSocket = null
let shellReconnectTimer = null
let shellManualClose = false
let shellActiveAssistantId = ''
let shellTypingTimer = null
let shellSlowHintTimer = null
let shellAutoRetryTimer = null
let shellPersistTimer = null
const shellStreamQueue = []
const shellMarkdownCache = new Map()

// Keep code-server as optional "professional mode", but default to pure chat-shell.
const codeServerEnabled = String(import.meta.env.VITE_FLASH_CODE_SERVER_ENABLED || 'false').trim().toLowerCase() === 'true'
const defaultMode = FLASH_MODES.LEGACY
const normalizeUrlBase = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.endsWith('/') ? raw : `${raw}/`
}
const ideBaseCandidates = (() => {
  const configured = String(import.meta.env.VITE_FLASH_IDE_URL || '')
    .split(',')
    .map((item) => normalizeUrlBase(item))
    .filter(Boolean)
  const proto = window.location.protocol === 'https:' ? 'https' : 'http'
  // Prefer direct IDE in dev mode to avoid proxy websocket instability.
  const host = String(window.location.hostname || 'localhost').trim() || 'localhost'
  const defaults = [
    normalizeUrlBase(`${proto}://${host}:8443/`),
    normalizeUrlBase(`${proto}://localhost:8443/`),
    normalizeUrlBase('/ide/')
  ]
  const deduped = []
  ;[...defaults, ...configured].forEach((url) => {
    if (!url || deduped.includes(url)) return
    deduped.push(url)
  })
  return deduped.length ? deduped : [normalizeUrlBase('/ide/')]
})()
const ideBaseIndex = ref(0)

const isCodeServerMode = computed(() => codeServerEnabled && flashMode.value === FLASH_MODES.CODE_SERVER)
const modeLabel = computed(() => {
  if (!codeServerEnabled) return '壳模式'
  return isCodeServerMode.value ? '专业模式' : '壳模式'
})
const ideBaseUrl = computed(() => ideBaseCandidates[ideBaseIndex.value] || ideBaseCandidates[0])
const ideShellSubtitle = computed(() => (
  ideReachable.value
    ? '当前仅提供 Cline 独立窗口，不在页面内嵌入 IDE，避免主界面抖动或白屏。'
    : `当前 IDE 不可达（${ideProbeError.value || '连接失败'}），可稍后“检测”或先使用壳模式。`
))

const ideUrl = computed(() => {
  const base = ideBaseUrl.value
  const search = new URLSearchParams({
    folder: IDE_DRAFT_WORKSPACE,
    folderName: 'flash-drafts'
  })
  return `${base}?${search.toString()}`
})

const previewUrl = computed(() => `${PREVIEW_ROUTE}?appId=${encodeURIComponent(appId.value)}&_t=${previewNonce.value}`)
const shellStorageKey = computed(() => `flash_shell_conversations:${appId.value || 'default'}`)
const shellConversationOptions = computed(() => shellConversations.value.map((item) => ({
  value: item.id,
  label: item.title
})))
const visibleShellMessages = computed(() => shellMessages.value.filter((item) => {
  if (item.role !== 'assistant') return true
  return !!String(item.content || '').trim() || !!String(item.thought || '').trim()
}))

const getAuthToken = () => {
  const raw = localStorage.getItem('auth_token')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) return String(parsed.token)
  } catch {
    // ignore
  }
  return String(raw)
}

const readCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      username: String(parsed?.username || '').trim() || 'unknown',
      appRole: String(parsed?.app_role || parsed?.role || '').trim() || 'unknown'
    }
  } catch {
    return { username: 'unknown', appRole: 'unknown' }
  }
}

const normalizeConfig = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const normalizeSourceCode = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const normalizeDraftSourceText = (value) => String(value || '').replace(/\r\n/g, '\n').trim()

const getAgentHeaders = (token) => ({
  Authorization: `Bearer ${token}`
})

const readRemoteDraftSource = async () => {
  const token = getAuthToken()
  if (!token) return ''
  const response = await axios.get('/agent/flash/draft', {
    headers: getAgentHeaders(token)
  })
  return String(response?.data?.content || '')
}

const writeRemoteDraftSource = async (content, reason = '') => {
  const token = getAuthToken()
  if (!token) return false
  const normalized = String(content || '')
  if (!normalized.trim()) return false
  await axios.post('/agent/flash/draft', {
    content: normalized,
    reason
  }, {
    headers: {
      ...getAgentHeaders(token),
      'Content-Type': 'application/json'
    }
  })
  return true
}

const buildNextSourceCodeWithDraft = (baseSourceCode, draftSource, extraFlash = {}) => {
  const source = normalizeSourceCode(baseSourceCode)
  const flash = source?.flash && typeof source.flash === 'object' ? source.flash : {}
  const now = new Date().toISOString()
  return {
    ...source,
    flash: {
      ...flash,
      draft_file: DRAFT_FILE_PATH,
      draft_source: String(draftSource || ''),
      draft_updated_at: now,
      mode: flashMode.value,
      ...extraFlash
    }
  }
}

const persistDraftSourceToApp = async (draftSource, baseRow = null) => {
  if (!appId.value) return
  const token = getAuthToken()
  if (!token) return
  const row = baseRow || appData.value
  const currentSourceCode = normalizeSourceCode(row?.source_code)
  const nextSourceCode = buildNextSourceCodeWithDraft(currentSourceCode, draftSource)
  await axios.patch(
    `/api/apps?id=eq.${appId.value}`,
    {
      source_code: nextSourceCode,
      updated_at: new Date().toISOString()
    },
    {
      headers: {
        ...getAppCenterHeaders(token),
        'Content-Type': 'application/json'
      }
    }
  )
}

const applyDraftIsolationForApp = async (row) => {
  if (!appId.value) return
  const sourceCode = normalizeSourceCode(row?.source_code)
  const savedDraft = normalizeDraftSourceText(sourceCode?.flash?.draft_source)
  const targetDraft = savedDraft || normalizeDraftSourceText(DEFAULT_FLASH_DRAFT_SOURCE)
  if (!targetDraft) return

  let remoteDraft = ''
  try {
    remoteDraft = normalizeDraftSourceText(await readRemoteDraftSource())
  } catch {
    remoteDraft = ''
  }

  if (remoteDraft !== targetDraft) {
    await writeRemoteDraftSource(targetDraft, savedDraft ? 'restore_app_draft' : 'init_new_app_draft')
    refreshPreview()
  }

  if (!savedDraft) {
    await persistDraftSourceToApp(targetDraft, row)
  }
}

const buildFlashConfig = (baseConfig = {}) => {
  const flashConfig = {
    ...(baseConfig.flash || {}),
    mode: codeServerEnabled ? flashMode.value : FLASH_MODES.LEGACY,
    draftRoot: DRAFT_ROOT_PATH,
    draftFile: DRAFT_FILE_PATH,
    previewRoute: PREVIEW_ROUTE,
    featureFlag: 'flash_builder_v2',
    updatedAt: new Date().toISOString()
  }
  return {
    ...baseConfig,
    flash: flashConfig
  }
}

const writeAuditLog = async (taskId, status, input = {}, output = {}) => {
  if (!appId.value) return
  const token = getAuthToken()
  if (!token) return
  const actor = readCurrentUser()

  try {
    await axios.post(
      '/api/execution_logs',
      {
        app_id: appId.value,
        task_id: taskId,
        status,
        input_data: input,
        output_data: output,
        executed_by: actor.username
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        }
      }
    )
  } catch {
    // audit is best-effort and should not block user flow
  }
}

const probeIdeAvailability = async (baseUrl = ideBaseUrl.value) => {
  const targetUrl = new URL(baseUrl, window.location.origin).toString()
  try {
    const ideOrigin = new URL(targetUrl, window.location.origin).origin
    if (ideOrigin !== window.location.origin) {
      // Cross-origin IDE cannot be reliably probed with fetch due CORS;
      // rely on iframe load/error + timeout instead.
      return true
    }
  } catch {
    // keep going with best-effort fetch probe
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal
    })
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` }
    }
    return { ok: true, reason: '' }
  } catch (error) {
    return { ok: false, reason: error?.name === 'AbortError' ? '连接超时' : (error?.message || '网络不可达') }
  } finally {
    clearTimeout(timeout)
  }
}

const checkIdeReachability = async () => {
  ideChecking.value = true
  ideProbeError.value = ''
  let firstError = ''
  for (let index = 0; index < ideBaseCandidates.length; index += 1) {
    const result = await probeIdeAvailability(ideBaseCandidates[index])
    if (result.ok) {
      ideBaseIndex.value = index
      ideReachable.value = true
      ideChecking.value = false
      return true
    }
    if (!firstError && result.reason) firstError = result.reason
  }
  ideReachable.value = false
  ideProbeError.value = firstError || '连接失败'
  ideChecking.value = false
  return false
}

const openIdeInNewTab = () => {
  const target = new URL(ideUrl.value, window.location.origin).toString()
  window.open(target, '_blank', 'noopener,noreferrer')
}

const buildShellWsCandidates = () => {
  const configured = String(import.meta.env.VITE_FLASH_AGENT_WS || '')
    .split(',')
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  const hostname = window.location.hostname || 'localhost'
  const defaults = [
    `${protocol}://${host}/agent/ws`,
    `${protocol}://${hostname}:8078/ws`
  ]
  const deduped = []
  ;[...configured, ...defaults].forEach((item) => {
    if (!item || deduped.includes(item)) return
    deduped.push(item)
  })
  return deduped
}

const scrollShellToBottom = () => {
  nextTick(() => {
    const el = shellMessagesRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

const createShellMessage = (role, content, extra = {}) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content: String(content || '').trim(),
  thought: String(extra.thought || '').trim()
})

const sanitizeConversationTitle = (value, fallback = '新会话') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > 28 ? `${text.slice(0, 28)}...` : text
}

const normalizeSavedMessage = (item) => {
  const role = String(item?.role || '').toLowerCase()
  if (role !== 'user' && role !== 'assistant') return null
  return {
    id: String(item?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    role,
    content: String(item?.content || '').trim(),
    thought: String(item?.thought || '').trim()
  }
}

const escapeHtml = (raw) => String(raw || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const isSafeMarkdownUrl = (raw) => {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return false
  if (value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html')) {
    return false
  }
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('#') ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../')
  ) {
    return true
  }
  return false
}

const renderInlineMarkdown = (source) => {
  let text = escapeHtml(source)
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, label, href, title = '') => {
    if (!isSafeMarkdownUrl(href)) return label
    const safeHref = escapeHtml(href)
    const safeTitle = title ? ` title="${escapeHtml(title)}"` : ''
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${safeTitle}>${label}</a>`
  })
  return text
}

const renderMarkdownTable = (lines) => {
  if (!Array.isArray(lines) || lines.length < 2) return ''
  const divider = String(lines[1] || '').trim()
  if (!/^\|?[\s:-]+\|[\s|:-]*$/.test(divider)) return ''

  const splitRow = (row) => String(row || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => renderInlineMarkdown(cell.trim()))

  const header = splitRow(lines[0])
  const bodyRows = lines.slice(2).map(splitRow)
  const thead = `<thead><tr>${header.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>`
  const tbody = bodyRows.length
    ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`
    : '<tbody></tbody>'
  return `<table>${thead}${tbody}</table>`
}

const renderShellMarkdown = (rawContent) => {
  const source = String(rawContent || '').trim()
  if (!source) return ''
  const cacheKey = source
  if (shellMarkdownCache.has(cacheKey)) return shellMarkdownCache.get(cacheKey)

  const codeBlocks = []
  const codeToken = (index) => `@@FLASH_CODE_${index}@@`
  let text = source.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_, lang = '', code = '') => {
    const idx = codeBlocks.length
    codeBlocks.push({
      lang: String(lang || '').trim(),
      code: String(code || '')
    })
    return `\n${codeToken(idx)}\n`
  })

  const blocks = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  const htmlBlocks = []

  blocks.forEach((block) => {
    if (/^@@FLASH_CODE_\d+@@$/.test(block)) {
      const idx = Number(block.replace(/\D+/g, ''))
      const node = codeBlocks[idx]
      if (!node) return
      const langTag = node.lang ? `<span class="lang">${escapeHtml(node.lang)}</span>` : ''
      htmlBlocks.push(
        `<pre class="md-code"><code>${escapeHtml(node.code)}</code>${langTag}</pre>`
      )
      return
    }

    const tableLines = block.split(/\r?\n/).map((line) => line.trim())
    const tableHtml = renderMarkdownTable(tableLines)
    if (tableHtml) {
      htmlBlocks.push(tableHtml)
      return
    }

    if (block.startsWith('>')) {
      const lines = block
        .split(/\r?\n/)
        .map((line) => renderInlineMarkdown(line.replace(/^>\s?/, '')))
      htmlBlocks.push(`<blockquote>${lines.join('<br/>')}</blockquote>`)
      return
    }

    const headingMatch = block.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length)
      htmlBlocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`)
      return
    }

    const listLines = block.split(/\r?\n/)
    const ordered = listLines.every((line) => /^\d+\.\s+/.test(line.trim()))
    const unordered = listLines.every((line) => /^[-*]\s+/.test(line.trim()))
    if (ordered || unordered) {
      const tag = ordered ? 'ol' : 'ul'
      const items = listLines
        .map((line) => line.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ''))
        .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
        .join('')
      htmlBlocks.push(`<${tag}>${items}</${tag}>`)
      return
    }

    const paragraph = block
      .split(/\r?\n/)
      .map((line) => renderInlineMarkdown(line))
      .join('<br/>')
    htmlBlocks.push(`<p>${paragraph}</p>`)
  })

  let html = htmlBlocks.join('')
  codeBlocks.forEach((node, idx) => {
    const langTag = node.lang ? `<span class="lang">${escapeHtml(node.lang)}</span>` : ''
    const codeHtml = `<pre class="md-code"><code>${escapeHtml(node.code)}</code>${langTag}</pre>`
    html = html.replace(new RegExp(codeToken(idx), 'g'), codeHtml)
  })

  if (shellMarkdownCache.size >= SHELL_MARKDOWN_CACHE_MAX) {
    const firstKey = shellMarkdownCache.keys().next().value
    if (firstKey) shellMarkdownCache.delete(firstKey)
  }
  shellMarkdownCache.set(cacheKey, html)
  return html
}

const parseThoughtAndAnswer = (rawContent) => {
  const source = String(rawContent || '').trim()
  if (!source) return { answer: '', thought: '' }

  let working = source
  const thoughtChunks = []
  const extractTag = (regex) => {
    working = working.replace(regex, (_, inner = '') => {
      const text = String(inner || '').trim()
      if (text) thoughtChunks.push(text)
      return ''
    })
  }
  extractTag(/<think>([\s\S]*?)<\/think>/gi)
  extractTag(/<analysis>([\s\S]*?)<\/analysis>/gi)
  extractTag(/<environment_details>([\s\S]*?)<\/environment_details>/gi)
  extractTag(/<task>([\s\S]*?)<\/task>/gi)

  const finalAnswerMatch = working.match(/(?:最终回答|最终答复|回答|答复)\s*[:：]\s*([\s\S]+)/i)
  if (finalAnswerMatch && finalAnswerMatch[1]) {
    const prior = working.slice(0, finalAnswerMatch.index).trim()
    if (prior) thoughtChunks.push(prior)
    working = String(finalAnswerMatch[1]).trim()
  }

  const thoughtLinePatterns = [
    /^用户要求/,
    /^当前用户请求/,
    /^以下是最近上下文/,
    /^最近上下文/,
    /^历史上下文/,
    /^recent context/i,
    /^current user request/i,
    /^这意味着/,
    /^从环境信息来看/,
    /^环境信息/,
    /^工作目录/,
    /^任务路径/,
    /^硬性约束/,
    /^我需要/,
    /^我将/,
    /^我会/,
    /^思考[:：]/,
    /^分析[:：]/,
    /^\d+\.\s*\[(user|assistant)\]/i,
    /^\[(user|assistant)\]/i,
    /^-\s*\[[xX\s]\]/
  ]

  const answerLines = []
  const lines = working.split(/\r?\n/)
  lines.forEach((line) => {
    const text = String(line || '').trim()
    if (!text) {
      answerLines.push('')
      return
    }
    const matched = thoughtLinePatterns.some((pattern) => pattern.test(text))
    if (matched) {
      thoughtChunks.push(text)
      return
    }
    answerLines.push(line)
  })

  const answer = answerLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const thought = thoughtChunks.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { answer, thought }
}

const canToggleMessage = (msg) => {
  if (!msg || msg.role !== 'assistant') return false
  return String(msg.content || '').length > SHELL_COLLAPSE_LENGTH
}

const isMessageCollapsed = (msg) => {
  if (!canToggleMessage(msg)) return false
  return shellMessageExpandMap.value[msg.id] !== true
}

const toggleMessageExpand = (id) => {
  if (!id) return
  shellMessageExpandMap.value[id] = !shellMessageExpandMap.value[id]
}

const isMessageThoughtExpanded = (id) => shellThoughtExpandMap.value[id] === true

const toggleMessageThought = (id) => {
  if (!id) return
  shellThoughtExpandMap.value[id] = !shellThoughtExpandMap.value[id]
}

const buildDefaultConversation = (id = '') => {
  const now = new Date().toISOString()
  return {
    id: id || `conv-${Date.now()}`,
    title: `会话 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    createdAt: now,
    updatedAt: now,
    messages: []
  }
}

const writeShellConversations = () => {
  if (!shellStorageKey.value) return
  try {
    localStorage.setItem(shellStorageKey.value, JSON.stringify(shellConversations.value))
  } catch {
    // ignore storage errors
  }
}

const schedulePersistShellConversations = () => {
  if (shellPersistTimer) clearTimeout(shellPersistTimer)
  shellPersistTimer = setTimeout(() => {
    shellPersistTimer = null
    writeShellConversations()
  }, 140)
}

const syncCurrentConversationMessages = () => {
  const currentId = shellConversationId.value
  if (!currentId) return
  const target = shellConversations.value.find((item) => item.id === currentId)
  if (!target) return

  const normalized = shellMessages.value
    .map((msg) => normalizeSavedMessage(msg))
    .filter(Boolean)
    .slice(-SHELL_MAX_MESSAGE_PER_CONVERSATION)
  target.messages = normalized
  target.updatedAt = new Date().toISOString()

  const firstUser = normalized.find((msg) => msg.role === 'user' && msg.content)
  if (firstUser) {
    target.title = sanitizeConversationTitle(firstUser.content, target.title || '新会话')
  }
  schedulePersistShellConversations()
}

const switchShellConversation = (conversationId) => {
  const nextId = String(conversationId || '').trim()
  const target = shellConversations.value.find((item) => item.id === nextId)
  if (!target) return
  shellConversationId.value = target.id
  shellMessages.value = (target.messages || [])
    .map((msg) => normalizeSavedMessage(msg))
    .filter(Boolean)
  shellMessageExpandMap.value = {}
  shellThoughtExpandMap.value = {}
  shellError.value = ''
  shellBusy.value = false
  shellAutoRetryCount.value = 0
  shellLastRequest.value = null
  clearShellAutoRetryTimer()
  resetShellTaskRuntime()
  scrollShellToBottom()
}

const createShellConversation = () => {
  const item = buildDefaultConversation()
  shellConversations.value = [item, ...shellConversations.value].slice(0, SHELL_MAX_CONVERSATIONS)
  shellMessages.value = []
  shellConversationId.value = item.id
  shellMessageExpandMap.value = {}
  shellThoughtExpandMap.value = {}
  shellError.value = ''
  shellBusy.value = false
  shellAutoRetryCount.value = 0
  shellLastRequest.value = null
  clearShellAutoRetryTimer()
  resetShellTaskRuntime()
  schedulePersistShellConversations()
}

const deleteShellConversation = () => {
  if (!shellConversationId.value) return
  const currentId = shellConversationId.value
  const rest = shellConversations.value.filter((item) => item.id !== currentId)
  shellConversations.value = rest
  if (rest.length === 0) {
    createShellConversation()
    return
  }
  switchShellConversation(rest[0].id)
  schedulePersistShellConversations()
}

const loadShellConversations = () => {
  const key = shellStorageKey.value
  if (!key) return
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    const list = Array.isArray(parsed)
      ? parsed.map((item) => {
        const conv = buildDefaultConversation(String(item?.id || ''))
        conv.title = sanitizeConversationTitle(item?.title, conv.title)
        conv.createdAt = String(item?.createdAt || conv.createdAt)
        conv.updatedAt = String(item?.updatedAt || conv.updatedAt)
        conv.messages = Array.isArray(item?.messages)
          ? item.messages.map((msg) => normalizeSavedMessage(msg)).filter(Boolean).slice(-SHELL_MAX_MESSAGE_PER_CONVERSATION)
          : []
        return conv
      }).filter((item) => item.id)
      : []

    shellConversations.value = list.slice(0, SHELL_MAX_CONVERSATIONS)
  } catch {
    shellConversations.value = []
  }

  if (shellConversations.value.length === 0) {
    const fallback = buildDefaultConversation()
    shellConversations.value = [fallback]
    shellConversationId.value = fallback.id
    shellMessages.value = []
    writeShellConversations()
    return
  }

  const latest = [...shellConversations.value]
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
  shellConversationId.value = latest.id
  shellMessages.value = (latest.messages || []).map((msg) => normalizeSavedMessage(msg)).filter(Boolean)
}

const clearShellTypingTimer = () => {
  if (!shellTypingTimer) return
  clearInterval(shellTypingTimer)
  shellTypingTimer = null
}

const clearShellSlowHintTimer = () => {
  if (!shellSlowHintTimer) return
  clearTimeout(shellSlowHintTimer)
  shellSlowHintTimer = null
}

const clearShellAutoRetryTimer = () => {
  if (!shellAutoRetryTimer) return
  clearTimeout(shellAutoRetryTimer)
  shellAutoRetryTimer = null
}

const disarmShellSlowHint = () => {
  clearShellSlowHintTimer()
  shellSlowHintVisible.value = false
  shellSlowHintText.value = ''
}

const armShellSlowHint = (text = '响应较慢，正在后台处理...') => {
  disarmShellSlowHint()
  shellSlowHintTimer = setTimeout(() => {
    if (!shellBusy.value || shellHasFirstChunk.value) return
    shellSlowHintText.value = text
    shellSlowHintVisible.value = true
    scrollShellToBottom()
  }, SHELL_SLOW_HINT_DELAY_MS)
}

const ensureShellAssistantMessage = () => {
  const active = shellMessages.value.find((item) => item.id === shellActiveAssistantId)
  if (active) return active
  const message = createShellMessage('assistant', '')
  shellActiveAssistantId = message.id
  shellMessages.value.push(message)
  return message
}

const consumeShellStreamQueue = () => {
  if (shellTypingTimer || shellStreamQueue.length === 0) return
  shellTypingTimer = setInterval(() => {
    const active = ensureShellAssistantMessage()
    if (!active || shellStreamQueue.length === 0) {
      clearShellTypingTimer()
      return
    }

    let chunk = String(shellStreamQueue[0] || '')
    if (!chunk) {
      shellStreamQueue.shift()
      return
    }

    const piece = chunk.slice(0, SHELL_TYPE_STEP)
    active.content = `${active.content || ''}${piece}`
    chunk = chunk.slice(SHELL_TYPE_STEP)
    if (chunk) {
      shellStreamQueue[0] = chunk
    } else {
      shellStreamQueue.shift()
    }
    scrollShellToBottom()

    if (shellStreamQueue.length === 0) {
      clearShellTypingTimer()
      if (!shellBusy.value) {
        shellActiveAssistantId = ''
      }
    }
  }, SHELL_TYPE_INTERVAL_MS)
}

const enqueueShellAssistant = (content) => {
  const text = String(content || '').trim()
  if (!text) return
  const active = ensureShellAssistantMessage()
  const needsBreak = !!String(active?.content || '').trim() || shellStreamQueue.length > 0
  shellStreamQueue.push(needsBreak ? `\n\n${text}` : text)
  consumeShellStreamQueue()
  schedulePersistShellConversations()
}

const resetShellTaskRuntime = () => {
  shellHasFirstChunk.value = false
  shellStreamQueue.length = 0
  clearShellTypingTimer()
  disarmShellSlowHint()
}

const isRecoverableShellError = (rawMessage) => {
  const text = String(rawMessage || '').toLowerCase()
  if (!text) return true
  return /timeout|network|socket|connection|disconnect|temporary|temporarily|upstream|503|502|504|rate limit|busy|unavailable|econnreset|econnrefused/.test(text)
}

const buildShellHistory = () => shellMessages.value
  .slice(-SHELL_HISTORY_LIMIT * 2)
  .map((item) => ({ role: item.role, content: item.content }))
  .filter((item) => (item.role === 'user' || item.role === 'assistant') && String(item.content || '').trim())

const dispatchShellTask = ({ prompt, history }, options = {}) => {
  if (!shellSocket || shellSocket.readyState !== WebSocket.OPEN) {
    shellError.value = '连接不可用，请先重连'
    shellBusy.value = false
    return false
  }
  shellBusy.value = true
  shellError.value = ''
  shellHasFirstChunk.value = false
  armShellSlowHint(options.slowHint || '响应较慢，正在后台处理...')

  if (!options.keepAssistant) {
    shellActiveAssistantId = createShellMessage('assistant', '').id
    shellMessages.value.push({ id: shellActiveAssistantId, role: 'assistant', content: '' })
  }

  shellSocket.send(JSON.stringify({
    type: 'flash:cline_task',
    sessionId: shellSessionId.value,
    prompt,
    history
  }))
  scrollShellToBottom()
  return true
}

const tryShellAutoRetry = (reason) => {
  if (!shellLastRequest.value) return false
  if (shellAutoRetryCount.value >= SHELL_MAX_AUTO_RETRY) return false
  if (!isRecoverableShellError(reason)) return false

  shellAutoRetryCount.value += 1
  shellError.value = ''
  shellBusy.value = true
  shellHasFirstChunk.value = false
  shellSlowHintVisible.value = true
  shellSlowHintText.value = `连接波动，正在自动重试（${shellAutoRetryCount.value}/${SHELL_MAX_AUTO_RETRY}）...`
  clearShellAutoRetryTimer()
  clearShellSlowHintTimer()
  clearShellTypingTimer()
  shellStreamQueue.length = 0

  const payload = shellLastRequest.value
  shellAutoRetryTimer = setTimeout(() => {
    shellAutoRetryTimer = null
    const sent = dispatchShellTask(payload, {
      keepAssistant: true,
      slowHint: '自动重试中，正在继续处理...'
    })
    if (!sent) {
      shellError.value = '自动重试失败，请手动重试'
      shellBusy.value = false
      disarmShellSlowHint()
    }
  }, SHELL_AUTO_RETRY_DELAY_MS)
  return true
}

const clearShellReconnectTimer = () => {
  if (!shellReconnectTimer) return
  clearTimeout(shellReconnectTimer)
  shellReconnectTimer = null
}

const closeShellSocket = () => {
  clearShellReconnectTimer()
  clearShellAutoRetryTimer()
  resetShellTaskRuntime()
  if (shellSocket) {
    try {
      shellSocket.close()
    } catch {
      // ignore
    }
    shellSocket = null
  }
  shellConnected.value = false
  shellConnecting.value = false
  shellBusy.value = false
}

const scheduleShellReconnect = () => {
  if (shellManualClose || isCodeServerMode.value || shellReconnectTimer) return
  shellReconnectTimer = setTimeout(() => {
    shellReconnectTimer = null
    connectShellSocket()
  }, SHELL_WS_RETRY_DELAY_MS)
}

const handleShellEvent = (event) => {
  if (!event?.type || !String(event.type).startsWith('flash:cline_')) return
  if (event.sessionId && event.sessionId !== shellSessionId.value) return

  if (event.type === 'flash:cline_output') {
    const { answer, thought } = parseThoughtAndAnswer(event.content)
    if (!answer && !thought) return
    shellHasFirstChunk.value = true
    disarmShellSlowHint()
    if (thought) {
      const active = ensureShellAssistantMessage()
      active.thought = active.thought ? `${active.thought}\n\n${thought}` : thought
      schedulePersistShellConversations()
    }
    if (answer) {
      enqueueShellAssistant(answer)
    }
    return
  }
  if (event.type === 'flash:cline_summary') {
    const active = shellMessages.value.find((item) => item.id === shellActiveAssistantId)
    const hasQueue = shellStreamQueue.length > 0
    // summary 只在没有正文时兜底，避免重复回显
    if ((!active || !String(active.content || '').trim()) && !hasQueue) {
      const { answer, thought } = parseThoughtAndAnswer(event.content)
      if (thought) {
        const current = ensureShellAssistantMessage()
        current.thought = current.thought ? `${current.thought}\n\n${thought}` : thought
        schedulePersistShellConversations()
      }
      if (answer) enqueueShellAssistant(answer)
    }
    return
  }
  if (event.type === 'flash:cline_error') {
    const errorText = String(event.error || 'Cline 任务失败')
    if (tryShellAutoRetry(errorText)) return
    shellError.value = errorText
    shellBusy.value = false
    shellAutoRetryCount.value = 0
    disarmShellSlowHint()
    clearShellTypingTimer()
    shellStreamQueue.length = 0
    shellActiveAssistantId = ''
    syncCurrentConversationMessages()
    return
  }
  if (event.type === 'flash:cline_status') {
    if (event.status === 'retry' && event.message) {
      shellSlowHintVisible.value = true
      shellSlowHintText.value = String(event.message)
    }
    if (event.status === 'running') {
      shellError.value = ''
    }
    return
  }
  if (event.type === 'flash:cline_done') {
    if (!event.success && shellAutoRetryTimer) {
      return
    }
    if (!event.success) {
      const failReason = shellError.value || `任务执行失败（exit ${event.exitCode ?? '?'})`
      if (tryShellAutoRetry(failReason)) return
      if (!shellError.value) shellError.value = failReason
    }
    shellBusy.value = false
    shellAutoRetryCount.value = 0
    disarmShellSlowHint()
    const active = shellMessages.value.find((item) => item.id === shellActiveAssistantId)
    if (active && !active.content.trim()) {
      const hasThought = !!String(active.thought || '').trim()
      if (event.success) {
        active.content = hasThought ? '已完成。思考内容已收纳，可按需展开查看。' : '任务执行完成。'
      } else {
        active.content = shellError.value || '任务执行失败。'
      }
    }
    if (shellStreamQueue.length === 0 && !shellTypingTimer) {
      shellActiveAssistantId = ''
    }
    syncCurrentConversationMessages()
    scrollShellToBottom()
  }
}

const getWsProtocols = () => {
  const token = getAuthToken()
  return token ? ['bearer', token] : []
}

const connectShellSocket = async () => {
  if (shellSocket && (shellSocket.readyState === WebSocket.OPEN || shellSocket.readyState === WebSocket.CONNECTING)) {
    return
  }
  shellConnecting.value = true
  shellConnected.value = false
  shellError.value = ''
  clearShellReconnectTimer()
  clearShellAutoRetryTimer()

  const candidates = buildShellWsCandidates()
  let connected = false

  for (let i = 0; i < candidates.length; i += 1) {
    const target = candidates[i]
    try {
      const ws = new WebSocket(target, getWsProtocols())
      const opened = await new Promise((resolve) => {
        let settled = false
        const done = (ok) => {
          if (settled) return
          settled = true
          resolve(ok)
        }
        const timer = setTimeout(() => done(false), 3500)
        ws.onopen = () => {
          clearTimeout(timer)
          done(true)
        }
        ws.onerror = () => {
          clearTimeout(timer)
          done(false)
        }
      })

      if (!opened) {
        try { ws.close() } catch {}
        continue
      }

      shellSocket = ws
      connected = true
      shellConnected.value = true
      shellConnecting.value = false
      shellError.value = ''

      ws.onmessage = (msg) => {
        try {
          handleShellEvent(JSON.parse(String(msg.data || '{}')))
        } catch {
          // ignore invalid event
        }
      }
      ws.onclose = () => {
        shellConnected.value = false
        shellBusy.value = false
        disarmShellSlowHint()
        if (!shellManualClose) {
          shellError.value = '连接已断开，正在自动重连...'
          scheduleShellReconnect()
        }
      }
      ws.onerror = () => {
        shellConnected.value = false
      }
      break
    } catch {
      // try next
    }
  }

  if (!connected) {
    shellConnected.value = false
    shellConnecting.value = false
    shellBusy.value = false
    disarmShellSlowHint()
    shellError.value = '无法连接到 agent-runtime (/agent/ws)'
    scheduleShellReconnect()
  }
}

const reconnectShell = () => {
  shellManualClose = false
  closeShellSocket()
  connectShellSocket()
}

const resetShellSession = () => {
  shellMessages.value = []
  shellInput.value = ''
  shellError.value = ''
  shellAutoRetryCount.value = 0
  shellLastRequest.value = null
  clearShellAutoRetryTimer()
  resetShellTaskRuntime()
  shellActiveAssistantId = ''
  if (shellSocket && shellSocket.readyState === WebSocket.OPEN) {
    shellSocket.send(JSON.stringify({
      type: 'flash:cline_reset',
      sessionId: shellSessionId.value
    }))
  }
  syncCurrentConversationMessages()
}

const sendShellPrompt = () => {
  const prompt = shellInput.value.trim()
  if (!prompt || shellBusy.value) return
  const history = buildShellHistory()
  shellMessages.value.push(createShellMessage('user', prompt))
  syncCurrentConversationMessages()
  shellError.value = ''
  shellAutoRetryCount.value = 0
  shellLastRequest.value = { prompt, history }
  resetShellTaskRuntime()
  shellInput.value = ''
  dispatchShellTask(shellLastRequest.value, {
    keepAssistant: false,
    slowHint: '响应较慢，正在后台处理...'
  })
}

const beginPreviewMask = (text = '正在刷新预览...') => {
  previewMaskText.value = text
  previewMaskVisible.value = true
  previewMaskStartAt.value = Date.now()
}

const endPreviewMask = () => {
  const elapsed = Date.now() - previewMaskStartAt.value
  const wait = Math.max(0, PREVIEW_MASK_MIN_MS - elapsed)
  window.setTimeout(() => {
    previewMaskVisible.value = false
    previewMaskText.value = '正在加载预览...'
  }, wait)
}

const clearPreviewRetryTimer = () => {
  if (previewRetryTimer) {
    clearTimeout(previewRetryTimer)
    previewRetryTimer = null
  }
}

const isPreviewDocumentReady = () => {
  try {
    const doc = previewIframeRef.value?.contentDocument
    if (!doc) return false
    const appRoot = doc.getElementById('app')
    if (!appRoot) return false
    // Wait until Vite app has mounted any visible node into #app.
    if (appRoot.childElementCount > 0) return true
    const textLen = String(appRoot.textContent || '').trim().length
    return textLen > 0
  } catch {
    return false
  }
}

const waitPreviewDomReady = async (maxWaitMs = 5000) => {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    if (isPreviewDocumentReady()) return true
    await new Promise((resolve) => setTimeout(resolve, 160))
  }
  return false
}

const schedulePreviewRetry = () => {
  clearPreviewRetryTimer()

  if (previewRetries.value >= MAX_PREVIEW_RETRIES) {
    previewFatal.value = true
    previewMaskText.value = '预览加载失败，请稍后重试'
    return
  }

  previewRetries.value += 1
  previewFatal.value = false
  beginPreviewMask(`编译中，后台重试 (${previewRetries.value}/${MAX_PREVIEW_RETRIES})...`)

  previewRetryTimer = setTimeout(() => {
    previewNonce.value = Date.now()
  }, 500)
}

const onPreviewLoad = async () => {
  const mounted = await waitPreviewDomReady(4500)
  if (!mounted) {
    previewReady.value = false
    schedulePreviewRetry()
    return
  }
  previewReady.value = true
  previewFatal.value = false
  previewRetries.value = 0
  endPreviewMask()
}

const onPreviewError = () => {
  previewReady.value = false
  schedulePreviewRetry()
}

const refreshPreview = () => {
  previewReady.value = false
  previewFatal.value = false
  beginPreviewMask('正在刷新预览...')
  previewNonce.value = Date.now()
}

const waitForPreviewReady = async () => {
  if (previewReady.value && !previewFatal.value) return true
  refreshPreview()

  const deadline = Date.now() + 12000
  while (Date.now() < deadline) {
    if (previewReady.value && !previewFatal.value) return true
    await new Promise((resolve) => setTimeout(resolve, 280))
  }
  return previewReady.value && !previewFatal.value
}

const validateDraftBeforePublish = async () => {
  const ready = await waitForPreviewReady()
  if (!ready) {
    return {
      ok: false,
      message: '草稿预览未就绪，请等待编译完成后再发布。'
    }
  }

  try {
    const doc = previewIframeRef.value?.contentDocument
    const contentSize = String(doc?.body?.innerText || '').trim().length
    if (!contentSize) {
      return {
        ok: false,
        message: '草稿内容为空，无法发布。'
      }
    }
  } catch {
    return {
      ok: false,
      message: '草稿校验失败（预览访问异常），请刷新后重试。'
    }
  }

  return {
    ok: true,
    message: '草稿校验通过'
  }
}

const sanitizePreviewSnapshotHtml = (rawHtml) => {
  const source = String(rawHtml || '').trim()
  if (!source) return ''

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(source, 'text/html')
      const dynamicSelectors = [
        'script',
        'noscript',
        'link[rel="modulepreload"]',
        'link[rel="preload"][as="script"]'
      ]
      dynamicSelectors.forEach((selector) => {
        doc.querySelectorAll(selector).forEach((node) => node.remove())
      })

      const html = String(doc.documentElement?.outerHTML || '').trim()
      if (!html) return ''
      return `<!doctype html>\n${html}`
    } catch {
      // fallback to regexp cleanup below
    }
  }

  return source
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']preload["'][^>]*as=["']script["'][^>]*>/gi, '')
    .trim()
}

const capturePreviewSnapshot = () => {
  const doc = previewIframeRef.value?.contentDocument
  if (!doc) return ''
  return sanitizePreviewSnapshotHtml(String(doc.documentElement?.outerHTML || ''))
}

const loadAppData = async () => {
  if (!appId.value) return

  try {
    const token = getAuthToken()
    const response = await axios.get(`/api/apps?id=eq.${appId.value}&limit=1`, {
      headers: getAppCenterHeaders(token)
    })

    const row = Array.isArray(response.data) ? response.data[0] : null
    appData.value = row

    const cfg = normalizeConfig(row?.config)
    const configuredMode = String(cfg?.flash?.mode || '').toLowerCase()
    const routeMode = String(route.query.mode || '').toLowerCase()
    if (!codeServerEnabled) {
      flashMode.value = FLASH_MODES.LEGACY
    } else if (routeMode === FLASH_MODES.LEGACY || routeMode === FLASH_MODES.CODE_SERVER) {
      flashMode.value = routeMode
    } else if (configuredMode === FLASH_MODES.LEGACY || configuredMode === FLASH_MODES.CODE_SERVER) {
      flashMode.value = configuredMode
    } else {
      flashMode.value = defaultMode
    }

    try {
      await applyDraftIsolationForApp(row)
    } catch (syncError) {
      ElMessage.warning(`草稿同步失败：${syncError?.message || '请重试'}`)
    }
  } catch (error) {
    ElMessage.error('加载应用数据失败')
  }
}

const saveApp = async () => {
  if (!appId.value || !appData.value) return

  saving.value = true
  const token = getAuthToken()
  const currentConfig = normalizeConfig(appData.value.config)
  const currentSourceCode = normalizeSourceCode(appData.value.source_code)

  try {
    const nextConfig = buildFlashConfig(currentConfig)
    let draftSource = ''
    try {
      draftSource = await readRemoteDraftSource()
    } catch {
      draftSource = normalizeDraftSourceText(currentSourceCode?.flash?.draft_source || DEFAULT_FLASH_DRAFT_SOURCE)
    }
    const nextSourceCode = buildNextSourceCodeWithDraft(currentSourceCode, draftSource)

    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        config: nextConfig,
        source_code: nextSourceCode,
        updated_at: new Date().toISOString()
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )

    await writeAuditLog('flash_save', 'completed', { mode: flashMode.value }, { configUpdated: true })
    ElMessage.success('配置已保存')
    await loadAppData()
  } catch (error) {
    await writeAuditLog('flash_save', 'failed', { mode: flashMode.value }, { error: error.message })
    ElMessage.error(`保存失败: ${error.message}`)
  } finally {
    saving.value = false
  }
}

const ensurePublishedRoute = async (token) => {
  const routePath = `/apps/app/${appId.value}`
  const existing = await axios.get(
    `/api/published_routes?app_id=eq.${appId.value}&order=id.desc&limit=1`,
    { headers: getAppCenterHeaders(token) }
  )

  const row = Array.isArray(existing.data) ? existing.data[0] : null
  if (row?.id) {
    await axios.patch(
      `/api/published_routes?id=eq.${row.id}`,
      { route_path: routePath, is_active: true },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    return
  }

  await axios.post(
    '/api/published_routes',
    {
      app_id: appId.value,
      route_path: routePath,
      is_active: true
    },
    {
      headers: {
        ...getAppCenterHeaders(token),
        'Content-Type': 'application/json'
      }
    }
  )
}

const publishApp = async () => {
  if (!appId.value || !appData.value) return

  publishing.value = true
  const token = getAuthToken()
  const actor = readCurrentUser()

  try {
    const validation = await validateDraftBeforePublish()
    if (!validation.ok) {
      ElMessage.warning(validation.message)
      await writeAuditLog('flash_publish', 'failed', { mode: flashMode.value }, { reason: validation.message })
      return
    }

    const currentConfig = normalizeConfig(appData.value.config)
    const currentSourceCode = normalizeSourceCode(appData.value.source_code)
    const snapshotHtml = capturePreviewSnapshot()
    let draftSource = ''
    try {
      draftSource = await readRemoteDraftSource()
    } catch {
      draftSource = normalizeDraftSourceText(currentSourceCode?.flash?.draft_source || DEFAULT_FLASH_DRAFT_SOURCE)
    }

    if (!snapshotHtml.trim()) {
      ElMessage.warning('未捕获到有效预览快照，请刷新后重试。')
      await writeAuditLog('flash_publish', 'failed', { mode: flashMode.value }, { reason: 'empty_snapshot' })
      return
    }

    const now = new Date().toISOString()
    const nextConfig = buildFlashConfig(currentConfig)
    nextConfig.flash = {
      ...(nextConfig.flash || {}),
      validatedAt: now,
      publishedAt: now,
      publishedBy: actor.username
    }

    const draftSeedSourceCode = buildNextSourceCodeWithDraft(currentSourceCode, draftSource)
    const nextSourceCode = {
      ...draftSeedSourceCode,
      flash: {
        ...(draftSeedSourceCode?.flash || {}),
        published_html: snapshotHtml,
        published_at: now,
        published_by: actor.username
      }
    }

    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        status: 'published',
        config: nextConfig,
        source_code: nextSourceCode,
        updated_at: now
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )

    await ensurePublishedRoute(token)
    await writeAuditLog('flash_publish', 'completed', { mode: flashMode.value, draftFile: DRAFT_FILE_PATH }, { publishedAt: now })

    ElMessage.success('已完成校验并发布')
    await loadAppData()
    router.push(`/app/${appId.value}`)
  } catch (error) {
    await writeAuditLog('flash_publish', 'failed', { mode: flashMode.value }, { error: error.message })
    ElMessage.error(`发布失败: ${error.message}`)
  } finally {
    publishing.value = false
  }
}

const goBack = () => {
  router.push('/')
}

watch(flashMode, (value) => {
  if (!codeServerEnabled && value === FLASH_MODES.CODE_SERVER) {
    flashMode.value = FLASH_MODES.LEGACY
    return
  }
  ideBaseIndex.value = 0
  if (value === FLASH_MODES.LEGACY) {
    shellManualClose = false
    connectShellSocket()
  } else {
    shellManualClose = true
    closeShellSocket()
    checkIdeReachability()
  }
})

watch(shellMessages, () => {
  syncCurrentConversationMessages()
}, { deep: true })

watch(shellStorageKey, () => {
  loadShellConversations()
})

watch(appId, async (nextId, prevId) => {
  if (!nextId || nextId === prevId) return

  clearPreviewRetryTimer()
  beginPreviewMask('正在切换闪念应用...')
  previewReady.value = false
  previewFatal.value = false
  previewRetries.value = 0
  appData.value = null
  shellError.value = ''
  shellMarkdownCache.clear()
  shellMessageExpandMap.value = {}
  shellThoughtExpandMap.value = {}

  if (!isCodeServerMode.value) {
    shellManualClose = true
    closeShellSocket()
  }

  await loadAppData()
  loadShellConversations()
  refreshPreview()

  if (isCodeServerMode.value) {
    ideBaseIndex.value = 0
    checkIdeReachability()
  } else {
    shellManualClose = false
    connectShellSocket()
  }
})

onMounted(async () => {
  beginPreviewMask('正在加载预览...')
  await loadAppData()
  loadShellConversations()

  if (isCodeServerMode.value) {
    ideBaseIndex.value = 0
    checkIdeReachability()
  } else {
    shellManualClose = false
    connectShellSocket()
  }
})

onUnmounted(() => {
  shellManualClose = true
  closeShellSocket()
  clearPreviewRetryTimer()
  if (shellPersistTimer) {
    clearTimeout(shellPersistTimer)
    shellPersistTimer = null
  }
})
</script>

<style scoped>
.flash-builder {
  --flash-primary: var(--el-color-primary);
  --flash-primary-soft: var(--el-color-primary-light-8);
  --flash-chat-bg: linear-gradient(150deg, var(--el-color-primary-light-9, #f4f8ff) 0%, #f6f8fc 46%, #eef2f9 100%);
  --flash-bubble-shadow: 0 8px 26px rgba(15, 23, 42, 0.08);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.builder-header {
  height: 64px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.builder-notice {
  margin: 12px 20px 0;
}

.builder-content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 42% 58%;
  gap: 12px;
  padding: 12px 20px 20px;
}

.left-panel,
.right-panel {
  min-height: 0;
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
}

.panel-head {
  height: 44px;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 14px;
  color: #606266;
  font-size: 13px;
  font-weight: 500;
}

.panel-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.preview-wrapper {
  position: relative;
  width: 100%;
  height: calc(100% - 44px);
}

.ide-shell-only {
  height: calc(100% - 44px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

.shell-chat {
  height: calc(100% - 44px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--flash-chat-bg);
}

.shell-session-bar {
  height: 42px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--el-color-primary-light-9, #f5f8ff);
}

.shell-session-select {
  width: 200px;
}

.shell-messages {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 18px;
  background: #f5f7fb;
}

.shell-empty {
  padding-top: 8px;
}

.shell-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  animation: shellRowIn 0.24s ease;
}

.shell-row.user {
  justify-content: flex-end;
}

.shell-row.user .shell-avatar {
  order: 2;
}

.shell-row.user .shell-bubble {
  order: 1;
  background: var(--flash-primary);
  color: #fff;
  border-color: var(--flash-primary);
}

.shell-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  font-size: 11px;
  font-weight: 700;
  color: #3b4a66;
  flex: 0 0 30px;
}

.shell-bubble {
  max-width: calc(100% - 64px);
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  padding: 16px 18px;
  color: #303133;
  box-shadow: var(--flash-bubble-shadow);
}

.shell-thinking {
  color: #606266;
}

.shell-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.72;
}

.shell-markdown {
  font-size: 14px;
  line-height: 1.72;
  color: inherit;
  word-break: break-word;
}

.shell-markdown :deep(p) {
  margin: 0 0 10px;
}

.shell-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.shell-markdown :deep(h1),
.shell-markdown :deep(h2),
.shell-markdown :deep(h3),
.shell-markdown :deep(h4),
.shell-markdown :deep(h5),
.shell-markdown :deep(h6) {
  margin: 10px 0 8px;
  line-height: 1.4;
}

.shell-markdown :deep(ul),
.shell-markdown :deep(ol) {
  margin: 8px 0 10px 20px;
  padding: 0;
}

.shell-markdown :deep(li) {
  margin: 4px 0;
}

.shell-markdown :deep(code) {
  font-family: "JetBrains Mono", Consolas, "Courier New", monospace;
  background: rgba(148, 163, 184, 0.16);
  padding: 1px 5px;
  border-radius: 5px;
  font-size: 12px;
}

.shell-markdown :deep(.md-code) {
  margin: 10px 0;
  padding: 12px;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
  position: relative;
}

.shell-markdown :deep(.md-code code) {
  background: transparent;
  padding: 0;
  color: inherit;
  white-space: pre;
}

.shell-markdown :deep(.md-code .lang) {
  position: absolute;
  top: 6px;
  right: 8px;
  color: #94a3b8;
  font-size: 11px;
}

.shell-markdown :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--flash-primary);
  background: rgba(59, 130, 246, 0.08);
  border-radius: 6px;
  color: #4b5563;
}

.shell-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 13px;
}

.shell-markdown :deep(th),
.shell-markdown :deep(td) {
  border: 1px solid var(--el-border-color-light);
  padding: 6px 8px;
  text-align: left;
}

.shell-markdown :deep(th) {
  background: rgba(148, 163, 184, 0.12);
}

.shell-markdown :deep(a) {
  color: var(--flash-primary);
  text-decoration: none;
}

.shell-markdown :deep(a:hover) {
  text-decoration: underline;
}

.shell-markdown.collapsed {
  max-height: 230px;
  overflow: hidden;
  position: relative;
}

.shell-markdown.collapsed::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 58px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.95));
}

.shell-text-toggle {
  margin-top: 8px;
}

.shell-thought-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}

.shell-thought-text {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed #d6dbe6;
  background: rgba(255, 255, 255, 0.72);
  color: #5b6474;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.shell-error {
  margin-top: 8px;
}

.shell-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 10px 42px;
  color: #8a6d1f;
  font-size: 13px;
  background: #fff8e1;
  border: 1px solid #f3deb3;
  border-radius: 8px;
  padding: 8px 10px;
}

.shell-composer {
  border-top: 1px solid var(--el-border-color-light);
  padding: 12px 12px 14px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(2px);
}

.shell-composer-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.preview-header {
  height: 44px;
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.panel-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.88);
  color: #606266;
  z-index: 3;
}

.preview-mask {
  backdrop-filter: blur(1px);
}

.preview-fallback {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.96);
  z-index: 4;
  overflow: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes shellRowIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1280px) {
  .builder-content {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(360px, 1fr);
  }
}
</style>
