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

    <div class="builder-content" :class="{ 'shell-split-layout': !isCodeServerMode }">
      <div class="left-panel" :class="{ 'shell-chat-panel': !isCodeServerMode }">
        <template v-if="isCodeServerMode">
          <div class="panel-head">
            <span>专业模式（Code-Server）</span>
            <div class="panel-head-actions">
              <el-tag size="small" :type="ideChecking ? 'warning' : (ideReachable ? 'success' : 'danger')">
                {{ ideChecking ? '检测中' : (ideReachable ? '可连接' : '不可达') }}
              </el-tag>
              <el-button text size="small" :loading="ideChecking" @click="reloadIdeEmbed">刷新</el-button>
              <el-button text size="small" @click="openIdeInNewTab">新窗口打开</el-button>
            </div>
          </div>
          <div class="ide-shell-only">
            <iframe
              v-if="ideReachable"
              :key="ideIframeNonce"
              class="ide-shell-frame"
              :src="ideUrl"
              ref="ideIframeRef"
              referrerpolicy="no-referrer"
              @load="onIdeFrameLoad"
              @error="onIdeFrameError"
            />
            <div v-if="ideReachable && !ideIframeLoaded" class="ide-shell-mask">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在加载编辑器...</span>
            </div>
            <el-result
              v-if="!ideReachable || ideIframeError"
              icon="warning"
              title="专业模式当前不可用"
              :sub-title="ideShellSubtitle"
            >
              <template #extra>
                <el-space>
                  <el-button type="primary" :loading="ideChecking" @click="reloadIdeEmbed">重试加载</el-button>
                  <el-button @click="openIdeInNewTab">新窗口打开</el-button>
                  <el-button @click="flashMode = 'legacy'">切换壳模式</el-button>
                </el-space>
              </template>
            </el-result>
          </div>
        </template>

        <template v-else>
          <div class="shell-chat-layout" :style="{ '--shell-rail-open-width': `${shellRailWidth}px` }">
            <aside
              class="shell-rail"
              :class="{ collapsed: shellRailCollapsed }"
            >
              <div class="shell-rail-head">
                <button
                  class="shell-rail-float-toggle"
                  :title="shellRailCollapsed ? '展开会话管理' : '收起会话管理'"
                  @click="toggleShellRailCollapse"
                >
                  <el-icon>
                    <CaretRight v-if="shellRailCollapsed" />
                    <CaretLeft v-else />
                  </el-icon>
                </button>
                <div v-if="!shellRailCollapsed" class="shell-rail-head-info">
                  <span class="shell-rail-head-title">会话管理</span>
                </div>
              </div>
              <div v-if="!shellRailCollapsed" class="shell-rail-actions">
                <el-tooltip effect="dark" content="新建会话" placement="bottom">
                  <el-button size="small" :icon="Plus" circle @click="createShellConversation" />
                </el-tooltip>
                <el-tooltip effect="dark" content="删除会话" placement="bottom">
                  <el-button size="small" :icon="Delete" circle @click="deleteShellConversationWithConfirm" />
                </el-tooltip>
              </div>
              <div class="shell-rail-list">
                <template v-for="item in shellConversationOptions" :key="item.value">
                  <el-tooltip
                    v-if="shellRailCollapsed"
                    effect="dark"
                    placement="right"
                    :content="`${item.label} · ${formatConversationMeta(item.value)}`"
                  >
                    <button
                      class="shell-rail-item"
                      :class="{ active: item.value === shellConversationId }"
                      @click="switchShellConversation(item.value)"
                    >
                      <span class="shell-rail-item-icon-wrap">
                        <el-icon class="shell-rail-item-icon"><Clock /></el-icon>
                      </span>
                    </button>
                  </el-tooltip>
                  <button
                    v-else
                    class="shell-rail-item"
                    :class="{ active: item.value === shellConversationId }"
                    @click="switchShellConversation(item.value)"
                  >
                    <span class="shell-rail-title">{{ item.label }}</span>
                    <span class="shell-rail-meta">{{ formatConversationMeta(item.value) }}</span>
                  </button>
                </template>
              </div>
            </aside>
            <div v-if="!shellRailCollapsed" class="shell-rail-resizer" @mousedown.prevent="startShellRailResize"></div>

            <section class="shell-chat-main">
              <div class="shell-chat-head">
                <el-tooltip effect="dark" placement="bottom" :content="shellConnected ? '已连接' : (shellConnecting ? '连接中' : '未连接')">
                  <div class="shell-conn-dot-wrap">
                    <span
                      class="shell-conn-dot"
                      :class="{ connected: shellConnected, connecting: shellConnecting, disconnected: !shellConnected && !shellConnecting }"
                    ></span>
                  </div>
                </el-tooltip>
                <div class="shell-chat-head-actions">
                  <el-tooltip v-if="codeServerEnabled" effect="dark" content="切换到专业模式" placement="bottom">
                    <el-button
                      text
                      size="small"
                      :disabled="shellBusy || shellConnecting"
                      @click="flashMode = FLASH_MODES.CODE_SERVER"
                    >
                      专业模式
                    </el-button>
                  </el-tooltip>
                  <el-tooltip effect="dark" content="重连" placement="bottom">
                    <el-button text size="small" :icon="RefreshRight" :disabled="shellConnecting" @click="reconnectShell" />
                  </el-tooltip>
                  <el-tooltip effect="dark" content="新会话" placement="bottom">
                    <el-button text size="small" :icon="Plus" :disabled="shellBusy" @click="resetShellSession" />
                  </el-tooltip>
                </div>
              </div>

              <div class="shell-chat-card">
                <div ref="shellMessagesRef" class="shell-console-body shell-chat-messages">
                  <div v-if="visibleShellMessages.length === 0" class="shell-empty">
                    <el-result icon="info" title="开始对话" />
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
                      <div v-if="msg.role === 'assistant' && Array.isArray(msg.toolCalls) && msg.toolCalls.length" class="shell-tool-results">
                        <div class="shell-tool-results-head">工具结果</div>
                        <div
                          v-for="tool in msg.toolCalls"
                          :key="tool.id"
                          class="shell-tool-item"
                          :class="{ ok: tool.ok === true, fail: tool.ok === false }"
                        >
                          <div class="shell-tool-item-main">
                            <span class="shell-tool-name">{{ tool.toolId }}</span>
                            <span v-if="tool.ok === true" class="shell-tool-state ok">ok</span>
                            <span v-else-if="tool.ok === false" class="shell-tool-state fail">fail</span>
                            <span v-if="tool.code" class="shell-tool-meta">code {{ tool.code }}</span>
                            <span v-if="tool.httpStatus" class="shell-tool-meta">http {{ tool.httpStatus }}</span>
                          </div>
                          <div v-if="tool.message" class="shell-tool-message">{{ tool.message }}</div>
                        </div>
                      </div>
                      <div
                        v-if="msg.role === 'assistant' && msg.registryCheck && msg.registryCheck.matched === false"
                        class="shell-tool-warning"
                      >
                        工具数量校验：模型声称 {{ msg.registryCheck.claimed }}，后端实际 {{ msg.registryCheck.actual }}。
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
                    <div v-if="shellSlowHintVisible" class="shell-hint shell-hint-inline">
                      <el-icon class="is-loading"><Loading /></el-icon>
                      <span>{{ shellSlowHintText }}</span>
                    </div>
                  </transition>
                  <el-alert
                    v-if="shellError"
                    class="shell-error shell-error-inline"
                    type="error"
                    :closable="false"
                    :title="shellError"
                  />
                </div>

                <div class="shell-composer shell-composer-inline">
                  <input
                    ref="shellFileInputRef"
                    type="file"
                    class="shell-file-input"
                    :accept="SHELL_UPLOAD_ACCEPT"
                    multiple
                    @change="handleShellFilesSelected"
                  />
                  <div class="shell-dialog-slot">
                    <div class="shell-input-stack">
                      <el-input
                        v-model="shellInput"
                        type="textarea"
                        :rows="2"
                        resize="none"
                        placeholder="描述你希望在 FlashDraft.vue 中生成或修改的界面..."
                        @keydown.ctrl.enter.prevent="sendShellPrompt"
                      />
                      <div class="shell-input-actions">
                        <el-tooltip effect="dark" placement="top" content="上传多模态附件">
                          <el-badge :value="shellAttachments.length" :hidden="shellAttachments.length === 0" :max="SHELL_MAX_ATTACHMENTS">
                            <el-button
                              circle
                              size="small"
                              class="shell-upload-clip-btn shell-upload-clip-btn-inline"
                              :icon="Paperclip"
                              :loading="shellUploading"
                              @click="triggerShellFilePicker"
                            />
                          </el-badge>
                        </el-tooltip>
                        <el-button
                          type="primary"
                          class="shell-send-btn shell-send-btn-inline"
                          :loading="shellBusy"
                          :disabled="!shellInput.trim() || !shellConnected || shellUploading"
                          @click="sendShellPrompt"
                        >
                          发送
                        </el-button>
                      </div>
                    </div>
                    <div v-if="shellAttachments.length > 0" class="shell-attachment-list shell-attachment-list-compact">
                      <el-tag
                        v-for="item in shellAttachments"
                        :key="item.id"
                        closable
                        class="shell-attachment-tag"
                        @close="removeShellAttachment(item.id)"
                      >
                        {{ item.name }} ({{ formatFileSize(item.size) }})
                      </el-tag>
                    </div>
                    <el-alert
                      v-if="shellUploadError"
                      class="shell-upload-error"
                      type="warning"
                      :closable="false"
                      :title="shellUploadError"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>
      </div>

      <div class="right-panel" :class="{ 'shell-preview-panel': !isCodeServerMode }">
        <div class="preview-header" :class="{ 'shell-preview-header': !isCodeServerMode }">
          <div class="preview-title">
            <span>实时预览</span>
            <el-tag size="small" :type="previewReady ? 'success' : 'warning'">{{ previewReady ? '已就绪' : '编译中' }}</el-tag>
          </div>
          <div class="preview-actions">
            <div v-if="!isCodeServerMode" class="preview-ratio-group">
              <el-input
                v-model="previewRatioWidth"
                size="small"
                clearable
                class="preview-ratio-field"
                placeholder="宽"
              />
              <span class="preview-ratio-sep">:</span>
              <el-input
                v-model="previewRatioHeight"
                size="small"
                clearable
                class="preview-ratio-field"
                placeholder="高"
              />
            </div>
            <el-button text :icon="RefreshRight" @click="refreshPreview()">刷新</el-button>
          </div>
        </div>

        <div class="preview-wrapper" :class="{ 'shell-preview-wrapper': !isCodeServerMode, 'has-custom-ratio': !!previewRatioValue }">
          <div class="preview-stage" :class="{ 'shell-preview-stage': !isCodeServerMode, 'custom-ratio': !!previewRatioValue }" :style="previewStageStyle">
            <div class="preview-stage-inner">
              <iframe
                ref="previewIframeRef"
                :src="previewUrl"
                class="preview-frame"
                sandbox="allow-scripts allow-same-origin allow-forms"
                @load="onPreviewLoad"
                @error="onPreviewError"
              />
              <transition name="glass">
                <div v-if="previewMaskVisible || shellBusy" class="panel-mask preview-mask">
                  <div class="preview-glass">
                    <div class="glass-dots">
                      <span v-for="dot in 9" :key="dot" class="glass-dot"></span>
                    </div>
                    <div class="glass-text">{{ previewGlassText }}</div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
          <div v-if="previewFatal" class="preview-fallback">
            <el-result icon="error" title="预览暂不可用" sub-title="系统正在后台重试，你也可以手动刷新。">
              <template #extra>
                <el-button type="primary" @click="refreshPreview()">手动刷新</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  Clock,
  Delete,
  Loading,
  Paperclip,
  Plus,
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
const SHELL_RAIL_MIN_WIDTH = 200
const SHELL_RAIL_MAX_WIDTH = 360
const SHELL_DEFAULT_RAIL_WIDTH = 248
const SHELL_MAX_ATTACHMENTS = 12
const SHELL_MAX_FILE_BYTES = 8 * 1024 * 1024
const SHELL_UPLOAD_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json'
const SHELL_PROMPT_ECHO_LINE_PATTERNS = [
  /^你是闪念应用开发助手/,
  /^硬性约束[:：]/,
  /^输出要求[:：]/,
  /^严禁输出思考过程/,
  /^禁止出现/,
  /^可调用系统语义接口/,
  /^先运行\s*`?node\s+\/app\/flash-semantic-tool\.js\s+--registry/i,
  /^读接口示例[:：]/,
  /^写接口必须添加\s*--confirm/i,
  /^执行要求[:：]/,
  /^步骤[:：]?$/,
  /^最终输出[:：]/,
  /^当前用户请求[:：]/,
  /^以下是最近上下文[:：]/,
  /^node\s+\/app\/flash-semantic-tool\.js/i,
  /^-?\s*运行[:：]\s*node\s+\/app\/flash-semantic-tool\.js/i,
  /^<toolcall>/i,
  /^<\/toolcall>/i
]
const IDE_AGENT_FULLSCREEN_RETRY_MS = 360
const IDE_AGENT_FULLSCREEN_MAX_ATTEMPTS = 32
const IDE_AGENT_FULLSCREEN_SELECTORS = [
  'button[aria-label*="Maximize"]',
  'button[title*="Maximize"]',
  'a[aria-label*="Maximize"]',
  'a[title*="Maximize"]',
  'button[aria-label*="最大化"]',
  'button[title*="最大化"]',
  'a[aria-label*="最大化"]',
  'a[title*="最大化"]'
]
const IDE_AGENT_FULLSCREEN_RESTORE_KEYWORDS = ['Restore', '还原']
const DEFAULT_FLASH_DRAFT_SOURCE = `<template>
  <div class="flash-draft-page">
    <section class="hero">
      <div class="hero-badge">Flash Builder</div>
      <h1>闪念应用草稿画板</h1>
      <p>在左侧描述你的需求，智能体会持续生成并优化这里的页面效果。</p>
    </section>
  </div>
</template>
<style scoped>
.flash-draft-page { min-height: 100vh; padding: 36px; color: #0f172a; background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%); font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
.hero { max-width: 860px; margin: 0 auto; padding: 34px 30px; border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 20px; background: rgba(255, 255, 255, 0.78); box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08); }
.hero-badge { width: fit-content; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #1d4ed8; background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.22); }
.hero h1 { margin: 14px 0 10px; font-size: 38px; line-height: 1.15; }
.hero p { margin: 0; font-size: 17px; color: #475569; }
</style>
`

const appId = computed(() => String(route.params.appId || ''))
const appData = ref(null)
const saving = ref(false)
const publishing = ref(false)

const flashMode = ref(FLASH_MODES.LEGACY)
const ideChecking = ref(false)
const ideReachable = ref(false)
const ideProbeError = ref('')
const ideIframeRef = ref(null)
const ideIframeLoaded = ref(false)
const ideIframeError = ref('')
const ideIframeNonce = ref(Date.now())

const previewIframeRef = ref(null)
const previewNonce = ref(Date.now())
const previewReady = ref(false)
const previewMaskVisible = ref(true)
const previewMaskText = ref('正在加载预览...')
const previewRatioWidth = ref('')
const previewRatioHeight = ref('')
const previewFatal = ref(false)
const previewRetries = ref(0)
const previewMaskStartAt = ref(0)
let previewRetryTimer = null

const shellMessagesRef = ref(null)
const shellFileInputRef = ref(null)
const shellInput = ref('')
const shellMessages = ref([])
const shellAttachments = ref([])
const shellConversations = ref([])
const shellConversationId = ref('')
const shellMessageExpandMap = ref({})
const shellThoughtExpandMap = ref({})
const shellRailCollapsed = ref(true)
const shellRailWidth = ref(SHELL_DEFAULT_RAIL_WIDTH)
const shellConnected = ref(false)
const shellConnecting = ref(false)
const shellBusy = ref(false)
const shellError = ref('')
const shellUploadError = ref('')
const shellUploading = ref(false)
const shellSlowHintVisible = ref(false)
const shellSlowHintText = ref('')
const shellHasFirstChunk = ref(false)
const shellAutoRetryCount = ref(0)
const shellLastRequest = ref(null)
const shellRegistryActualCount = ref(0)
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
let shellPersistRemoteTimer = null
let ideFrameLoadTimer = null
let ideAgentFullscreenTimer = null
let shellRailResizeStartX = 0
let shellRailResizeStartWidth = SHELL_DEFAULT_RAIL_WIDTH
let shellRailResizeActive = false
const shellStreamQueue = []
const shellMarkdownCache = new Map()
let shellLastAssistantChunk = ''
let shellLastThoughtChunk = ''

// Enable code-server mode by default; set VITE_FLASH_CODE_SERVER_ENABLED=false to hard-disable.
const codeServerFlagRaw = String(import.meta.env.VITE_FLASH_CODE_SERVER_ENABLED || '').trim().toLowerCase()
const codeServerEnabled = codeServerFlagRaw === ''
  ? true
  : ['1', 'true', 'yes', 'on'].includes(codeServerFlagRaw)
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
  // Prefer same-origin /ide first so parent page can drive editor UI behaviors
  // (e.g., auto-maximize chat/agent view) when browser security allows.
  const host = String(window.location.hostname || 'localhost').trim() || 'localhost'
  const defaults = [
    normalizeUrlBase('/ide/'),
    normalizeUrlBase(`${proto}://${host}:8443/`),
    normalizeUrlBase(`${proto}://localhost:8443/`)
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
  ideIframeError.value
    ? `${ideIframeError.value}，可重试或新窗口打开。`
    : (ideReachable.value
      ? '已接入编辑器，可直接在本页使用，也可新窗口打开。'
      : `当前 IDE 不可达（${ideProbeError.value || '连接失败'}），可重试或先使用壳模式。`)
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
const activeShellConversationLabel = computed(() => {
  const target = shellConversations.value.find((item) => item.id === shellConversationId.value)
  return target?.title || '新会话'
})
const canRetryShell = computed(() => !!String(shellLastRequest.value?.prompt || '').trim())
const previewGlassText = computed(() => {
  if (shellBusy.value && !shellHasFirstChunk.value) return 'AI 正在加工界面...'
  if (shellBusy.value) return 'AI 正在完善细节...'
  if (previewFatal.value) return '预览恢复中，请稍候...'
  if (previewMaskText.value) return previewMaskText.value
  return '正在加载预览...'
})
const visibleShellMessages = computed(() => shellMessages.value.filter((item) => {
  if (item.role !== 'assistant') return true
  return (
    !!String(item.content || '').trim() ||
    !!String(item.thought || '').trim() ||
    (Array.isArray(item.toolCalls) && item.toolCalls.length > 0) ||
    !!item.registryCheck
  )
}))
const previewRatioValue = computed(() => {
  const wRaw = String(previewRatioWidth.value || '').trim()
  const hRaw = String(previewRatioHeight.value || '').trim()
  if (!wRaw || !hRaw) return null
  const w = Number(wRaw)
  const h = Number(hRaw)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
  const ratio = w / h
  if (ratio < 0.4 || ratio > 4) return null
  return ratio
})
const previewStageStyle = computed(() => {
  if (!previewRatioValue.value || isCodeServerMode.value) return null
  const ratio = previewRatioValue.value
  return {
    width: `min(100%, calc((100dvh - 240px) * ${ratio}))`,
    maxWidth: '100%',
    margin: '0 auto',
    flex: 'none',
    aspectRatio: String(ratio),
    maxHeight: 'calc(100dvh - 240px)'
  }
})

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
const normalizeAppStatus = (value) => String(value || '').trim().toLowerCase()
const indentMultiline = (text, spaces = 4) => String(text || '')
  .split('\n')
  .map((line) => `${' '.repeat(spaces)}${line}`)
  .join('\n')
const stripSourceMapMarkers = (text) => String(text || '')
  .replace(/\/\/#\s*sourceMappingURL=.*$/gim, '')
  .replace(/\/\*#\s*sourceMappingURL=[\s\S]*?\*\//gim, '')
  .trim()

const extractPublishedBodyHtml = (rawHtml) => {
  const source = stripSourceMapMarkers(rawHtml)
  if (!source) return ''

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(source, 'text/html')
      ;['script', 'noscript'].forEach((selector) => {
        doc.querySelectorAll(selector).forEach((node) => node.remove())
      })
      return String(doc.body?.innerHTML || '').trim()
    } catch {
      // fallback to regexp extraction
    }
  }

  const noScript = source
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
  const bodyMatch = noScript.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch?.[1]) return String(bodyMatch[1]).trim()
  return noScript.trim()
}

const buildDraftFromPublishedHtml = (publishedHtml) => {
  const bodyHtml = extractPublishedBodyHtml(publishedHtml)
  if (!bodyHtml) return ''
  return `<template>
  <div class="flash-legacy-draft">
${indentMultiline(bodyHtml, 4)}
  </div>
</template>
`
}

const getAgentHeaders = (token) => ({
  Authorization: `Bearer ${token}`
})

const FLASH_WRITE_TOOL_IDS = new Set([
  'flash.draft.write',
  'flash.attachment.upload',
  'flash.app.save',
  'flash.app.publish',
  'flash.route.upsert',
  'flash.audit.write'
])

const buildTraceId = (prefix = 'tr') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const buildIdempotencyKey = (prefix = 'idem') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

const callFlashTool = async (toolId, toolArgs = {}, options = {}) => {
  const token = getAuthToken()
  if (!token) throw new Error('缺少登录令牌，请重新登录')

  const writeTool = FLASH_WRITE_TOOL_IDS.has(toolId) || options.write === true
  const actor = readCurrentUser()
  const payload = {
    trace_id: options.traceId || buildTraceId('tr'),
    tool_id: toolId,
    session_id: options.sessionId || shellSessionId.value || 'default',
    app_id: options.appId || appId.value || String(toolArgs?.appId || ''),
    arguments: toolArgs,
    context: {
      mode: flashMode.value,
      user_role: actor.appRole,
      source: 'flash_builder'
    }
  }

  if (writeTool) {
    payload.confirmed = options.confirmed ?? true
    payload.idempotency_key = options.idempotencyKey || buildIdempotencyKey('idem')
  }

  try {
    const response = await axios.post('/agent/flash/tools/call', payload, {
      headers: {
        ...getAgentHeaders(token),
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 120000
    })
    const result = response?.data || {}
    if (result?.ok === false) {
      throw new Error(String(result?.message || result?.code || '工具调用失败'))
    }
    return result
  } catch (error) {
    const message = String(error?.response?.data?.message || error?.message || '工具调用失败')
    throw new Error(message)
  }
}

const readRemoteDraftSource = async () => {
  const result = await callFlashTool('flash.draft.read', {}, { write: false })
  return String(result?.data?.content || '')
}

const writeRemoteDraftSource = async (content, reason = '') => {
  const normalized = String(content || '')
  if (!normalized.trim()) return false
  await callFlashTool('flash.draft.write', {
    content: normalized,
    reason
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
  const row = baseRow || appData.value
  const currentSourceCode = normalizeSourceCode(row?.source_code)
  const nextSourceCode = buildNextSourceCodeWithDraft(currentSourceCode, draftSource)
  const result = await callFlashTool('flash.app.save', {
    appId: appId.value,
    payload: {
      source_code: nextSourceCode,
      updated_at: new Date().toISOString()
    }
  })
  const item = result?.data?.item
  if (item && typeof item === 'object') {
    appData.value = item
  }
}

const syncDraftFromRuntimeToApp = async () => {
  if (!appId.value) return
  try {
    const latestDraft = normalizeDraftSourceText(await readRemoteDraftSource())
    if (!latestDraft) return
    await persistDraftSourceToApp(latestDraft, appData.value)
  } catch {
    // best-effort sync; preview should not be blocked by metadata persistence
  }
}

const applyDraftIsolationForApp = async (row) => {
  if (!appId.value) return
  const sourceCode = normalizeSourceCode(row?.source_code)
  const flashSource = sourceCode?.flash && typeof sourceCode.flash === 'object' ? sourceCode.flash : {}
  const savedDraft = normalizeDraftSourceText(flashSource?.draft_source)
  const publishedDraft = normalizeDraftSourceText(flashSource?.published_draft_source)
  const legacyPublishedDraft = normalizeDraftSourceText(buildDraftFromPublishedHtml(flashSource?.published_html))
  const isDraftApp = normalizeAppStatus(row?.status) === 'draft'
  const fallbackDraft = normalizeDraftSourceText(DEFAULT_FLASH_DRAFT_SOURCE)
  const targetDraft = savedDraft || publishedDraft || legacyPublishedDraft || fallbackDraft
  if (!targetDraft) return

  let reason = 'init_new_app_draft'
  if (savedDraft) {
    reason = 'restore_app_draft'
  } else if (publishedDraft) {
    reason = 'restore_published_draft'
  } else if (legacyPublishedDraft) {
    reason = isDraftApp ? 'restore_draft_seed' : 'restore_legacy_published_snapshot'
  }

  let remoteDraft = ''
  try {
    remoteDraft = normalizeDraftSourceText(await readRemoteDraftSource())
  } catch {
    remoteDraft = ''
  }

  if (remoteDraft !== targetDraft) {
    await writeRemoteDraftSource(targetDraft, reason)
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
  const actor = readCurrentUser()

  try {
    await callFlashTool('flash.audit.write', {
      payload: {
        app_id: appId.value,
        task_id: taskId,
        status,
        input_data: input,
        output_data: output,
        executed_by: actor.username
      }
    })
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
  ideIframeError.value = ''
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

const clearIdeLoadTimer = () => {
  if (!ideFrameLoadTimer) return
  clearTimeout(ideFrameLoadTimer)
  ideFrameLoadTimer = null
}

const clearIdeAgentFullscreenTimer = () => {
  if (!ideAgentFullscreenTimer) return
  clearTimeout(ideAgentFullscreenTimer)
  ideAgentFullscreenTimer = null
}

const getIdeFrameDocument = () => {
  const frame = ideIframeRef.value
  if (!frame) return null
  try {
    return frame.contentDocument || frame.contentWindow?.document || null
  } catch {
    // Cross-origin iframe cannot be inspected from parent page.
    return null
  }
}

const isVisibleElement = (el) => {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const win = el.ownerDocument?.defaultView
  if (!win?.getComputedStyle) return true
  const style = win.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

const clickIdeAgentFullscreenButton = () => {
  const doc = getIdeFrameDocument()
  if (!doc) return 'wait'

  for (const selector of IDE_AGENT_FULLSCREEN_SELECTORS) {
    const nodes = Array.from(doc.querySelectorAll(selector))
    const target = nodes.find((node) => isVisibleElement(node))
    if (!target) continue

    const label = `${target.getAttribute('aria-label') || ''} ${target.getAttribute('title') || ''}`.trim()
    if (IDE_AGENT_FULLSCREEN_RESTORE_KEYWORDS.some((keyword) => label.includes(keyword))) {
      return 'done'
    }

    const eventView = doc.defaultView || window
    target.dispatchEvent(new eventView.MouseEvent('click', { bubbles: true, cancelable: true }))
    return 'done'
  }

  return 'wait'
}

const scheduleIdeAgentFullscreen = () => {
  clearIdeAgentFullscreenTimer()
  let attempts = 0

  const run = () => {
    if (!isCodeServerMode.value || !ideIframeLoaded.value) return
    attempts += 1
    const result = clickIdeAgentFullscreenButton()
    if (result === 'done') return
    if (attempts >= IDE_AGENT_FULLSCREEN_MAX_ATTEMPTS) return
    ideAgentFullscreenTimer = setTimeout(run, IDE_AGENT_FULLSCREEN_RETRY_MS)
  }

  ideAgentFullscreenTimer = setTimeout(run, 260)
}

const scheduleIdeLoadTimeout = () => {
  clearIdeLoadTimer()
  ideFrameLoadTimer = setTimeout(() => {
    if (!isCodeServerMode.value || ideIframeLoaded.value) return
    ideIframeError.value = '页面内嵌加载超时'
  }, 12000)
}

const onIdeFrameLoad = () => {
  ideIframeLoaded.value = true
  ideIframeError.value = ''
  ideReachable.value = true
  clearIdeLoadTimer()
  scheduleIdeAgentFullscreen()
}

const onIdeFrameError = () => {
  ideIframeLoaded.value = false
  ideIframeError.value = '页面内嵌加载失败'
  clearIdeLoadTimer()
  clearIdeAgentFullscreenTimer()
}

const reloadIdeEmbed = async () => {
  ideIframeLoaded.value = false
  ideIframeError.value = ''
  clearIdeAgentFullscreenTimer()
  ideIframeNonce.value = Date.now()
  const ok = await checkIdeReachability()
  if (ok) scheduleIdeLoadTimeout()
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

const normalizeShellToolCall = (raw) => {
  const fromObject = raw && typeof raw === 'object' && !Array.isArray(raw)
  const text = fromObject ? JSON.stringify(raw) : String(raw || '').trim()
  if (!text) return null
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  let parsed = null
  if (fromObject) {
    parsed = raw
  } else {
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = null
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const toolId = String(parsed.tool_id || parsed.toolId || parsed.id || parsed.command || '').trim()
    const message = String(
      parsed.message ||
      parsed.result ||
      parsed.error_message ||
      parsed.error?.message ||
      ''
    ).trim()
    const code = String(parsed.code || parsed.reason_code || parsed.error?.reason_code || '').trim()
    const httpStatusRaw = Number(
      parsed.http_status ??
      parsed.httpStatus ??
      parsed.status ??
      parsed.error?.http_status
    )
    const httpStatus = Number.isFinite(httpStatusRaw) ? httpStatusRaw : null
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      toolId: toolId || 'toolcall',
      ok: typeof parsed.ok === 'boolean' ? parsed.ok : null,
      code: code || '',
      httpStatus,
      message: message || cleaned.slice(0, 220)
    }
  }
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    toolId: 'toolcall',
    ok: null,
    code: '',
    httpStatus: null,
    message: cleaned.slice(0, 220)
  }
}

const createShellMessage = (role, content, extra = {}) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content: String(content || '').trim(),
  thought: String(extra.thought || '').trim(),
  toolCalls: Array.isArray(extra.toolCalls)
    ? extra.toolCalls.map((item) => normalizeShellToolCall(item)).filter(Boolean)
    : [],
  registryCheck: extra.registryCheck && typeof extra.registryCheck === 'object'
    ? {
      claimed: Number(extra.registryCheck.claimed || 0),
      actual: Number(extra.registryCheck.actual || 0),
      matched: !!extra.registryCheck.matched
    }
    : null
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
    thought: String(item?.thought || '').trim(),
    toolCalls: Array.isArray(item?.toolCalls)
      ? item.toolCalls.map((entry) => normalizeShellToolCall(entry)).filter(Boolean)
      : [],
    registryCheck: item?.registryCheck && typeof item.registryCheck === 'object'
      ? {
        claimed: Number(item.registryCheck.claimed || 0),
        actual: Number(item.registryCheck.actual || 0),
        matched: !!item.registryCheck.matched
      }
      : null
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

const stripPromptEchoLines = (rawText) => {
  const lines = String(rawText || '').split(/\r?\n/)
  const kept = []
  lines.forEach((line) => {
    const text = String(line || '').trim()
    if (!text) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('')
      return
    }
    if (SHELL_PROMPT_ECHO_LINE_PATTERNS.some((pattern) => pattern.test(text))) return
    kept.push(line)
  })
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const extractRegistryCountClaim = (rawText) => {
  const source = String(rawText || '')
  const matches = source.match(/(?:共|总计|total)\s*(\d+)\s*(?:个工具|tools?)/ig) || []
  if (!matches.length) return 0
  const last = matches[matches.length - 1]
  const numberMatch = String(last).match(/(\d+)/)
  const count = Number(numberMatch?.[1] || 0)
  return Number.isFinite(count) && count > 0 ? count : 0
}

const extractToolCallsFromText = (rawText) => {
  let working = String(rawText || '')
  const toolCalls = []
  working = working.replace(/<toolcall>([\s\S]*?)<\/toolcall>/gi, (_, inner = '') => {
    const item = normalizeShellToolCall(inner)
    if (item) toolCalls.push(item)
    return ''
  })
  working = working
    .replace(/<\/?toolcall>/gi, '')
    .replace(/<toolcall>\s*$/gi, '')
    .trim()
  return {
    text: working,
    toolCalls
  }
}

const parseThoughtAndAnswer = (rawContent) => {
  const source = String(rawContent || '').trim()
  if (!source) return { answer: '', thought: '', toolCalls: [], registryClaimedCount: 0 }

  const extracted = extractToolCallsFromText(source)
  let working = extracted.text
  const thoughtChunks = []
  const extractTag = (regex) => {
    working = working.replace(regex, (_, inner = '') => {
      const text = String(inner || '').trim()
      if (text) thoughtChunks.push(stripPromptEchoLines(text))
      return ''
    })
  }
  extractTag(/<think>([\s\S]*?)<\/think>/gi)
  extractTag(/<analysis>([\s\S]*?)<\/analysis>/gi)
  extractTag(/<environment_details>([\s\S]*?)<\/environment_details>/gi)
  extractTag(/<task>([\s\S]*?)<\/task>/gi)

  const finalAnswerMatch = working.match(/(?:最终回答|最终答复|回答|答复)\s*[:：]\s*([\s\S]+)/i)
  if (finalAnswerMatch && finalAnswerMatch[1]) {
    const prior = stripPromptEchoLines(working.slice(0, finalAnswerMatch.index).trim())
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

  const answerSource = stripPromptEchoLines(answerLines.join('\n'))
  const thoughtSource = stripPromptEchoLines(thoughtChunks.join('\n'))
  return {
    answer: answerSource.replace(/\n{3,}/g, '\n\n').trim(),
    thought: thoughtSource.replace(/\n{3,}/g, '\n\n').trim(),
    toolCalls: extracted.toolCalls,
    registryClaimedCount: extractRegistryCountClaim(answerSource || source)
  }
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

const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const normalizeShellAttachment = (item) => {
  const relativePath = String(item?.relativePath || item?.path || '').replace(/\\/g, '/').trim()
  if (!relativePath) return null
  return {
    id: String(item?.id || `att-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name: String(item?.name || relativePath.split('/').pop() || 'file').trim(),
    mimeType: String(item?.mimeType || item?.type || 'application/octet-stream').trim() || 'application/octet-stream',
    size: Math.max(0, Number(item?.size) || 0),
    relativePath,
    textPreview: String(item?.textPreview || '').slice(0, 8000),
    uploadedAt: String(item?.uploadedAt || new Date().toISOString())
  }
}

const buildDefaultConversation = (id = '') => {
  const now = new Date().toISOString()
  return {
    id: id || `conv-${Date.now()}`,
    title: `会话 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    attachments: []
  }
}

const writeShellConversations = () => {
  if (!shellStorageKey.value) return
  try {
    localStorage.setItem(shellStorageKey.value, JSON.stringify(shellConversations.value))
  } catch {
    // ignore storage errors
  }
  schedulePersistShellConversationsRemote()
}

const writeShellConversationsRemote = async () => {
  if (!appId.value || !appData.value) return

  const baseSource = normalizeSourceCode(appData.value.source_code)
  const flashPart = baseSource?.flash && typeof baseSource.flash === 'object' ? baseSource.flash : {}
  const savedConversations = Array.isArray(flashPart.shell_conversations) ? flashPart.shell_conversations : []
  const savedConversationId = String(flashPart.shell_conversation_id || '')
  if (
    JSON.stringify(savedConversations) === JSON.stringify(shellConversations.value) &&
    savedConversationId === String(shellConversationId.value || '')
  ) {
    return
  }
  let latestDraft = ''
  try {
    latestDraft = normalizeDraftSourceText(await readRemoteDraftSource())
  } catch {
    latestDraft = ''
  }
  const nextSource = {
    ...baseSource,
    flash: {
      ...flashPart,
      ...(latestDraft ? {
        draft_file: DRAFT_FILE_PATH,
        draft_source: latestDraft,
        draft_updated_at: new Date().toISOString()
      } : {}),
      shell_conversations: shellConversations.value,
      shell_conversation_id: shellConversationId.value || '',
      shell_updated_at: new Date().toISOString()
    }
  }

  try {
    const result = await callFlashTool('flash.app.save', {
      appId: appId.value,
      payload: {
        source_code: nextSource,
        updated_at: new Date().toISOString()
      }
    }, {
      idempotencyKey: buildIdempotencyKey('idem_shell_sync')
    })
    const item = result?.data?.item
    if (item && typeof item === 'object') {
      appData.value = item
    } else {
      appData.value = {
        ...(appData.value || {}),
        source_code: nextSource
      }
    }
  } catch {
    // keep local persistence as primary fallback
  }
}

const schedulePersistShellConversations = () => {
  if (shellPersistTimer) clearTimeout(shellPersistTimer)
  shellPersistTimer = setTimeout(() => {
    shellPersistTimer = null
    writeShellConversations()
  }, 140)
}

const schedulePersistShellConversationsRemote = () => {
  if (shellBusy.value) return
  if (shellPersistRemoteTimer) clearTimeout(shellPersistRemoteTimer)
  shellPersistRemoteTimer = setTimeout(() => {
    shellPersistRemoteTimer = null
    writeShellConversationsRemote()
  }, 1000)
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
  const attachments = shellAttachments.value
    .map((item) => normalizeShellAttachment(item))
    .filter(Boolean)
    .slice(-SHELL_MAX_ATTACHMENTS)
  target.attachments = attachments
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
  shellAttachments.value = (target.attachments || [])
    .map((att) => normalizeShellAttachment(att))
    .filter(Boolean)
  shellMessageExpandMap.value = {}
  shellThoughtExpandMap.value = {}
  shellError.value = ''
  shellUploadError.value = ''
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
  shellAttachments.value = []
  shellConversationId.value = item.id
  shellMessageExpandMap.value = {}
  shellThoughtExpandMap.value = {}
  shellError.value = ''
  shellUploadError.value = ''
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

const deleteShellConversationWithConfirm = async () => {
  if (!shellConversationId.value || shellBusy.value) return
  try {
    await ElMessageBox.confirm(
      '删除后当前会话的消息与附件将不可恢复，是否继续？',
      '删除对话',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        autofocus: false
      }
    )
  } catch {
    return
  }
  deleteShellConversation()
}

const loadShellConversations = () => {
  const key = shellStorageKey.value
  if (!key) return
  const remoteSource = normalizeSourceCode(appData.value?.source_code)
  const remoteFlash = remoteSource?.flash && typeof remoteSource.flash === 'object' ? remoteSource.flash : {}
  const remoteList = Array.isArray(remoteFlash?.shell_conversations) ? remoteFlash.shell_conversations : []
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    const sourceList = Array.isArray(parsed) && parsed.length > 0 ? parsed : remoteList
    const list = Array.isArray(sourceList)
      ? sourceList.map((item) => {
        const conv = buildDefaultConversation(String(item?.id || ''))
        conv.title = sanitizeConversationTitle(item?.title, conv.title)
        conv.createdAt = String(item?.createdAt || conv.createdAt)
        conv.updatedAt = String(item?.updatedAt || conv.updatedAt)
        conv.messages = Array.isArray(item?.messages)
          ? item.messages.map((msg) => normalizeSavedMessage(msg)).filter(Boolean).slice(-SHELL_MAX_MESSAGE_PER_CONVERSATION)
          : []
        conv.attachments = Array.isArray(item?.attachments)
          ? item.attachments.map((att) => normalizeShellAttachment(att)).filter(Boolean).slice(-SHELL_MAX_ATTACHMENTS)
          : []
        return conv
      }).filter((item) => item.id)
      : []

    shellConversations.value = list.slice(0, SHELL_MAX_CONVERSATIONS)
  } catch {
    shellConversations.value = remoteList
      .map((item) => {
        const conv = buildDefaultConversation(String(item?.id || ''))
        conv.title = sanitizeConversationTitle(item?.title, conv.title)
        conv.createdAt = String(item?.createdAt || conv.createdAt)
        conv.updatedAt = String(item?.updatedAt || conv.updatedAt)
        conv.messages = Array.isArray(item?.messages)
          ? item.messages.map((msg) => normalizeSavedMessage(msg)).filter(Boolean).slice(-SHELL_MAX_MESSAGE_PER_CONVERSATION)
          : []
        conv.attachments = Array.isArray(item?.attachments)
          ? item.attachments.map((att) => normalizeShellAttachment(att)).filter(Boolean).slice(-SHELL_MAX_ATTACHMENTS)
          : []
        return conv
      })
      .filter((item) => item.id)
      .slice(0, SHELL_MAX_CONVERSATIONS)
  }

  if (shellConversations.value.length === 0) {
    const fallback = buildDefaultConversation()
    shellConversations.value = [fallback]
    shellConversationId.value = fallback.id
    shellMessages.value = []
    shellAttachments.value = []
    writeShellConversations()
    return
  }

  const remoteCurrentId = String(remoteFlash?.shell_conversation_id || '').trim()
  const latest = [...shellConversations.value]
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
  shellConversationId.value = shellConversations.value.some((item) => item.id === remoteCurrentId) ? remoteCurrentId : latest.id
  const current = shellConversations.value.find((item) => item.id === shellConversationId.value) || latest
  shellMessages.value = (current.messages || []).map((msg) => normalizeSavedMessage(msg)).filter(Boolean)
  shellAttachments.value = (current.attachments || []).map((att) => normalizeShellAttachment(att)).filter(Boolean)
  writeShellConversations()
}

const formatConversationMeta = (conversationId) => {
  const target = shellConversations.value.find((item) => item.id === conversationId)
  if (!target) return ''
  const msgCount = Array.isArray(target.messages) ? target.messages.length : 0
  const attCount = Array.isArray(target.attachments) ? target.attachments.length : 0
  if (attCount > 0) return `${msgCount} 条消息 · ${attCount} 个附件`
  return `${msgCount} 条消息`
}

const toggleShellRailCollapse = () => {
  shellRailCollapsed.value = !shellRailCollapsed.value
}

const stopShellRailResize = () => {
  if (!shellRailResizeActive) return
  shellRailResizeActive = false
  window.removeEventListener('mousemove', onShellRailResizeMove)
  window.removeEventListener('mouseup', stopShellRailResize)
}

const onShellRailResizeMove = (event) => {
  if (!shellRailResizeActive) return
  const delta = Number(event?.clientX || 0) - shellRailResizeStartX
  const next = Math.min(SHELL_RAIL_MAX_WIDTH, Math.max(SHELL_RAIL_MIN_WIDTH, shellRailResizeStartWidth + delta))
  shellRailWidth.value = next
}

const startShellRailResize = (event) => {
  if (shellRailCollapsed.value) return
  shellRailResizeActive = true
  shellRailResizeStartX = Number(event?.clientX || 0)
  shellRailResizeStartWidth = shellRailWidth.value
  window.addEventListener('mousemove', onShellRailResizeMove)
  window.addEventListener('mouseup', stopShellRailResize)
}

const triggerShellFilePicker = () => {
  if (shellUploading.value) return
  const input = shellFileInputRef.value
  if (!input) return
  input.click()
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const raw = String(reader.result || '')
    const payload = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw
    resolve(payload)
  }
  reader.onerror = () => reject(new Error('读取文件失败'))
  reader.readAsDataURL(file)
})

const uploadShellAttachment = async (file) => {
  const contentBase64 = await fileToBase64(file)
  const result = await callFlashTool('flash.attachment.upload', {
    appId: appId.value || 'default',
    conversationId: shellConversationId.value || 'default',
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contentBase64
  })
  return normalizeShellAttachment(result?.data?.file || {})
}

const removeShellAttachment = (id) => {
  if (!id) return
  shellAttachments.value = shellAttachments.value.filter((item) => item.id !== id)
  syncCurrentConversationMessages()
}

const handleShellFilesSelected = async (event) => {
  const input = event?.target
  const selected = Array.from(input?.files || [])
  if (!selected.length) return

  const remain = Math.max(0, SHELL_MAX_ATTACHMENTS - shellAttachments.value.length)
  const files = selected.slice(0, remain)
  if (selected.length > remain) {
    ElMessage.warning(`最多保留 ${SHELL_MAX_ATTACHMENTS} 个附件，已截取前 ${remain} 个。`)
  }

  shellUploadError.value = ''
  shellUploading.value = true
  try {
    for (const file of files) {
      if (file.size > SHELL_MAX_FILE_BYTES) {
        ElMessage.error(`${file.name} 超过大小限制（${formatFileSize(SHELL_MAX_FILE_BYTES)}）`)
        continue
      }
      const uploaded = await uploadShellAttachment(file)
      if (!uploaded) continue
      const exists = shellAttachments.value.some((item) => item.relativePath === uploaded.relativePath)
      if (exists) continue
      shellAttachments.value.push(uploaded)
      shellAttachments.value = shellAttachments.value.slice(-SHELL_MAX_ATTACHMENTS)
    }
    syncCurrentConversationMessages()
  } catch (error) {
    const message = String(error?.response?.data?.message || error?.message || '附件上传失败')
    shellUploadError.value = message
    ElMessage.error(message)
  } finally {
    shellUploading.value = false
    if (input) input.value = ''
  }
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

const mergeShellToolCalls = (existing, incoming) => {
  const base = Array.isArray(existing) ? existing.slice() : []
  const queue = Array.isArray(incoming) ? incoming : []
  queue.forEach((item) => {
    const normalized = normalizeShellToolCall(item)
    if (!normalized) return
    const signature = `${normalized.toolId}|${normalized.code}|${normalized.httpStatus || ''}|${normalized.message}`
    const duplicated = base.some((entry) => (
      `${entry.toolId}|${entry.code}|${entry.httpStatus || ''}|${entry.message}` === signature
    ))
    if (!duplicated) base.push(normalized)
  })
  return base.slice(-20)
}

const buildRegistryCheck = (claimedCount) => {
  const claimed = Number(claimedCount || 0)
  const actual = Number(shellRegistryActualCount.value || 0)
  if (!Number.isFinite(claimed) || claimed <= 0 || !Number.isFinite(actual) || actual <= 0) return null
  return {
    claimed,
    actual,
    matched: claimed === actual
  }
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
  if (text === shellLastAssistantChunk) return
  shellLastAssistantChunk = text
  const active = ensureShellAssistantMessage()
  const needsBreak = !!String(active?.content || '').trim() || shellStreamQueue.length > 0
  shellStreamQueue.push(needsBreak ? `\n\n${text}` : text)
  consumeShellStreamQueue()
  schedulePersistShellConversations()
}

const resetShellTaskRuntime = () => {
  shellHasFirstChunk.value = false
  shellStreamQueue.length = 0
  shellLastAssistantChunk = ''
  shellLastThoughtChunk = ''
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

const dispatchShellTask = ({ prompt, history, attachments = [] }, options = {}) => {
  if (!shellSocket || shellSocket.readyState !== WebSocket.OPEN) {
    shellError.value = '连接不可用，请先重连'
    shellBusy.value = false
    return false
  }
  shellBusy.value = true
  shellError.value = ''
  shellHasFirstChunk.value = false
  shellLastAssistantChunk = ''
  shellLastThoughtChunk = ''
  armShellSlowHint(options.slowHint || '响应较慢，正在后台处理...')

  if (!options.keepAssistant) {
    const placeholder = createShellMessage('assistant', '')
    shellActiveAssistantId = placeholder.id
    shellMessages.value.push(placeholder)
  }

  shellSocket.send(JSON.stringify({
    type: 'flash:cline_task',
    sessionId: shellSessionId.value,
    prompt,
    history,
    attachments
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

const appendToolResultToAssistant = (toolResult) => {
  const normalized = normalizeShellToolCall(toolResult)
  if (!normalized) return
  const active = ensureShellAssistantMessage()
  active.toolCalls = mergeShellToolCalls(active.toolCalls, [normalized])
  schedulePersistShellConversations()
}

const handleShellEvent = (event) => {
  if (!event?.type) return
  if (event.type === 'flash:tool_result') {
    appendToolResultToAssistant({
      tool_id: event.tool_id,
      ok: event.ok,
      code: event.code,
      status: event.http_status || event.status,
      message: event.message || event.error?.message || ''
    })
    return
  }
  if (!String(event.type).startsWith('flash:cline_')) return
  if (event.sessionId && event.sessionId !== shellSessionId.value) return

  if (event.type === 'flash:cline_output') {
    const { answer, thought, toolCalls, registryClaimedCount } = parseThoughtAndAnswer(event.content)
    if (!answer && !thought && (!Array.isArray(toolCalls) || toolCalls.length === 0) && registryClaimedCount <= 0) return
    shellHasFirstChunk.value = true
    disarmShellSlowHint()
    let active = null
    if (thought || (Array.isArray(toolCalls) && toolCalls.length > 0) || registryClaimedCount > 0) {
      active = ensureShellAssistantMessage()
    }
    if (thought) {
      if (thought !== shellLastThoughtChunk) {
        shellLastThoughtChunk = thought
        active.thought = active.thought ? `${active.thought}\n\n${thought}` : thought
        schedulePersistShellConversations()
      }
    }
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      active.toolCalls = mergeShellToolCalls(active.toolCalls, toolCalls)
      schedulePersistShellConversations()
    }
    if (registryClaimedCount > 0) {
      const registryCheck = buildRegistryCheck(registryClaimedCount)
      if (registryCheck) {
        active.registryCheck = registryCheck
        schedulePersistShellConversations()
      }
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
      const { answer, thought, toolCalls, registryClaimedCount } = parseThoughtAndAnswer(event.content)
      if (thought) {
        const current = ensureShellAssistantMessage()
        if (thought !== shellLastThoughtChunk) {
          shellLastThoughtChunk = thought
          current.thought = current.thought ? `${current.thought}\n\n${thought}` : thought
          schedulePersistShellConversations()
        }
      }
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        const current = ensureShellAssistantMessage()
        current.toolCalls = mergeShellToolCalls(current.toolCalls, toolCalls)
        schedulePersistShellConversations()
      }
      if (registryClaimedCount > 0) {
        const current = ensureShellAssistantMessage()
        const registryCheck = buildRegistryCheck(registryClaimedCount)
        if (registryCheck) {
          current.registryCheck = registryCheck
          schedulePersistShellConversations()
        }
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
    endPreviewMask()
    syncCurrentConversationMessages()
    return
  }
  if (event.type === 'flash:cline_status') {
    if (event.status === 'registry_meta') {
      const count = Number(event.registryCount || 0)
      if (Number.isFinite(count) && count > 0) shellRegistryActualCount.value = count
      return
    }
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
    if (event.success) {
      if (event.draftChanged === false) {
        shellError.value = '任务已完成，但未检测到 FlashDraft.vue 变更。请调整提示词后重试。'
        shellMessages.value.push(createShellMessage(
          'assistant',
          '系统校验：未检测到 FlashDraft.vue 内容变化，上一条“已修改”结果可能不准确。请让 AI 先读取文件并产出最小可见改动后重试。'
        ))
      } else {
        syncDraftFromRuntimeToApp()
        refreshPreview('AI 加工完成，正在呈现...')
      }
    } else {
      endPreviewMask()
    }
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
  shellAttachments.value = []
  shellInput.value = ''
  shellError.value = ''
  shellUploadError.value = ''
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

const retryShellConversation = () => {
  if (shellBusy.value) return
  const payload = shellLastRequest.value
  if (!payload || !String(payload.prompt || '').trim()) {
    ElMessage.warning('暂无可重试的对话')
    return
  }

  shellError.value = ''
  shellUploadError.value = ''
  shellAutoRetryCount.value = 0
  clearShellAutoRetryTimer()
  resetShellTaskRuntime()
  beginPreviewMask('正在重试并修复...')
  const sent = dispatchShellTask(payload, {
    keepAssistant: false,
    slowHint: '正在重试，请稍候...'
  })
  if (!sent) {
    endPreviewMask()
    shellBusy.value = false
    shellError.value = '重试失败，请检查连接后再试'
  }
}

const sendShellPrompt = () => {
  const prompt = shellInput.value.trim()
  if (!prompt || shellBusy.value) return
  const history = buildShellHistory()
  const attachments = shellAttachments.value
    .map((item) => normalizeShellAttachment(item))
    .filter(Boolean)
  shellMessages.value.push(createShellMessage('user', prompt))
  syncCurrentConversationMessages()
  shellError.value = ''
  shellUploadError.value = ''
  shellAutoRetryCount.value = 0
  shellLastRequest.value = { prompt, history, attachments }
  resetShellTaskRuntime()
  beginPreviewMask('AI 正在加工界面...')
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

const refreshPreview = (maskText = '正在刷新预览...') => {
  const safeMaskText = typeof maskText === 'string' ? maskText : '正在刷新预览...'
  previewReady.value = false
  previewFatal.value = false
  beginPreviewMask(safeMaskText)
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
    const result = await callFlashTool('flash.app.detail', {
      appId: appId.value,
      query: { limit: '1' }
    })
    const row = result?.data?.item || null
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

    const result = await callFlashTool('flash.app.save', {
      appId: appId.value,
      payload: {
        config: nextConfig,
        source_code: nextSourceCode,
        updated_at: new Date().toISOString()
      }
    })
    if (result?.data?.item) {
      appData.value = result.data.item
    }

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

const ensurePublishedRoute = async () => {
  const routePath = `/apps/app/${appId.value}`
  const existing = await callFlashTool('flash.route.resolve', {
    appId: appId.value,
    query: {
      order: 'id.desc',
      limit: '1'
    }
  }, { write: false })

  const row = existing?.data?.item || null
  await callFlashTool('flash.route.upsert', {
    id: row?.id || '',
    appId: appId.value,
    routePath,
    is_active: true
  })
}

const publishApp = async () => {
  if (!appId.value || !appData.value) return

  publishing.value = true
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
        published_draft_source: draftSource,
        published_html: snapshotHtml,
        published_at: now,
        published_by: actor.username
      }
    }

    const publishResult = await callFlashTool('flash.app.publish', {
      appId: appId.value,
      payload: {
        status: 'published',
        config: nextConfig,
        source_code: nextSourceCode,
        updated_at: now
      }
    })
    if (publishResult?.data?.item) {
      appData.value = publishResult.data.item
    }

    await ensurePublishedRoute()
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
    clearIdeLoadTimer()
    clearIdeAgentFullscreenTimer()
    ideIframeLoaded.value = false
    ideIframeError.value = ''
    shellManualClose = false
    connectShellSocket()
  } else {
    shellManualClose = true
    closeShellSocket()
    reloadIdeEmbed()
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
  shellUploadError.value = ''
  shellMarkdownCache.clear()
  shellMessageExpandMap.value = {}
  shellThoughtExpandMap.value = {}
  shellAttachments.value = []

  if (!isCodeServerMode.value) {
    shellManualClose = true
    closeShellSocket()
  }

  await loadAppData()
  loadShellConversations()
  refreshPreview()

  if (isCodeServerMode.value) {
    ideBaseIndex.value = 0
    reloadIdeEmbed()
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
    reloadIdeEmbed()
  } else {
    shellManualClose = false
    connectShellSocket()
  }
})

onUnmounted(() => {
  shellManualClose = true
  closeShellSocket()
  stopShellRailResize()
  clearPreviewRetryTimer()
  clearIdeLoadTimer()
  clearIdeAgentFullscreenTimer()
  if (shellPersistTimer) {
    clearTimeout(shellPersistTimer)
    shellPersistTimer = null
  }
  if (shellPersistRemoteTimer) {
    clearTimeout(shellPersistRemoteTimer)
    shellPersistRemoteTimer = null
  }
})
</script>

<style scoped>
.flash-builder {
  --flash-primary: var(--el-color-primary);
  --flash-primary-soft: var(--el-color-primary-light-8);
  --flash-surface: var(--el-bg-color);
  --flash-surface-muted: var(--el-fill-color-light);
  --flash-line: var(--el-border-color-light);
  --flash-chat-bg: linear-gradient(
    150deg,
    var(--el-color-primary-light-9, #f4f8ff) 0%,
    var(--el-fill-color-extra-light, #f6f8fc) 46%,
    var(--el-bg-color-page, #eef2f9) 100%
  );
  --flash-bubble-shadow: 0 8px 26px rgba(15, 23, 42, 0.08);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
  overflow: hidden;
}

.builder-header {
  height: 64px;
  background: var(--flash-surface);
  border-bottom: 1px solid var(--flash-line);
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

.builder-content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 42% 58%;
  gap: 0;
  margin: 12px 20px 20px;
  padding: 0;
  border: 1px solid var(--flash-line);
  border-radius: 12px;
  background: var(--flash-surface);
  overflow: hidden;
}

.builder-content.shell-split-layout {
  grid-template-columns: minmax(420px, 42%) minmax(0, 58%);
}

.builder-content > .left-panel {
  border-right: 1px solid var(--flash-line);
}

.left-panel,
.right-panel {
  min-width: 0;
  min-height: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
}

.shell-chat-panel,
.shell-preview-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
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

.ide-shell-only {
  position: relative;
  height: calc(100% - 44px);
  min-height: 0;
  padding: 10px;
  background: var(--flash-surface-muted);
}

.ide-shell-frame {
  width: 100%;
  height: 100%;
  border: 1px solid var(--flash-line);
  border-radius: 10px;
  background: #fff;
}

.ide-shell-mask {
  position: absolute;
  inset: 10px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #4b5563;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(2px);
}

.ide-shell-only :deep(.el-result) {
  position: absolute;
  inset: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  display: flex;
  align-items: center;
  justify-content: center;
}

.shell-workbench {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: stretch;
  background: var(--flash-chat-bg);
  overflow: hidden;
}

.shell-shell-v2 {
  background:
    radial-gradient(120% 130% at 0% 0%, rgba(59, 130, 246, 0.12), transparent 58%),
    radial-gradient(120% 130% at 100% 100%, rgba(16, 185, 129, 0.08), transparent 56%),
    linear-gradient(165deg, #eef3fb 0%, #f8faff 48%, #edf3fb 100%);
}

.shell-rail {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 5;
  width: var(--shell-rail-open-width, 248px);
  min-height: 0;
  border-right: 1px solid rgba(148, 163, 184, 0.2);
  background: color-mix(in srgb, var(--flash-surface-muted) 92%, transparent);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}

.shell-rail.collapsed {
  transform: translateX(calc(-1 * (var(--shell-rail-open-width, 248px) - var(--shell-rail-collapsed-width))));
}

.shell-rail-float-toggle {
  position: relative;
  z-index: 1;
  width: var(--shell-rail-toggle-size);
  height: var(--shell-rail-toggle-size);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: 0 0 auto;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.shell-rail-float-toggle:hover {
  border-color: rgba(59, 130, 246, 0.45);
  background: rgba(255, 255, 255, 0.98);
}

.shell-rail-head {
  height: 54px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0 12px;
  font-size: 12px;
  color: #64748b;
}

.shell-rail-head-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.shell-rail-head-title {
  font-size: 13px;
  color: #1e293b;
  font-weight: 700;
  line-height: 1.15;
}

.shell-rail-actions {
  display: flex;
  gap: 8px;
  padding: 10px 10px 8px;
}

.shell-rail-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overflow-x: hidden;
  padding: 0 8px 10px;
}

.shell-rail.collapsed .shell-rail-list {
  padding: 14px 8px 10px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.shell-rail.collapsed .shell-rail-head {
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  justify-content: flex-end;
  padding: 0 10px 0 0;
}

.shell-rail-foot {
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shell-rail-foot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.shell-rail-foot-label {
  font-size: 11px;
  color: #64748b;
}

.shell-rail-foot-value {
  max-width: 118px;
  font-size: 11px;
  color: #334155;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-rail-item {
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  border-radius: 8px;
  margin-bottom: 8px;
  text-align: left;
  padding: 8px 9px;
  color: #334155;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.shell-rail-item:hover {
  background: rgba(148, 163, 184, 0.14);
}

.shell-rail-item.active {
  background: rgba(59, 130, 246, 0.1);
  box-shadow: none;
}

.shell-rail-title {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-rail-item-icon-wrap {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.shell-rail-item-icon {
  font-size: 17px;
  color: #4b5563;
}

.shell-rail-meta {
  font-size: 11px;
  color: #64748b;
}

.shell-rail.collapsed .shell-rail-item {
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  padding: 0;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
}

.shell-rail.collapsed .shell-rail-item-icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: rgba(148, 163, 184, 0.14);
}

.shell-rail.collapsed .shell-rail-item.active .shell-rail-item-icon-wrap {
  background: rgba(59, 130, 246, 0.2);
}

.shell-rail.collapsed .shell-rail-item .shell-rail-item-icon {
  color: #334155;
}

.shell-rail.collapsed .shell-rail-item.active .shell-rail-item-icon {
  color: #1d4ed8;
}

.shell-rail-item.active .shell-rail-item-icon {
  color: var(--el-color-primary);
}

.shell-rail-resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--shell-rail-open-width, 248px) - 4px);
  z-index: 6;
  width: 8px;
  cursor: col-resize;
  background: linear-gradient(to right, rgba(148, 163, 184, 0.18), rgba(148, 163, 184, 0));
}

.shell-rail.collapsed + .shell-rail-resizer {
  display: none;
}

.shell-chat-layout {
  --shell-rail-collapsed-width: 56px;
  --shell-rail-toggle-size: 30px;
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: block;
  position: relative;
  background: transparent;
  overflow: hidden;
}

.shell-chat-main {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: 8px 10px 10px 64px;
  overflow: hidden;
}

.shell-chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.shell-chat-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shell-conn-dot-wrap {
  display: inline-flex;
  align-items: center;
}

.shell-conn-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #f56c6c;
  box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.15);
}

.shell-conn-dot.connected {
  background: #67c23a;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.16);
}

.shell-conn-dot.connecting {
  background: #e6a23c;
  box-shadow: 0 0 0 3px rgba(230, 162, 60, 0.15);
  animation: shellConnPulse 1.1s ease-in-out infinite;
}

.shell-chat-card {
  min-height: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
  box-shadow: none;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.shell-chat-messages {
  min-height: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 8px 6px;
}

.shell-main {
  height: 100%;
  min-height: 0;
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) minmax(160px, 28vh) auto;
  padding: 14px 16px 14px 14px;
  gap: 12px;
  overflow: hidden;
}

.shell-main-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 0;
}

.shell-main-top-title {
  min-width: 0;
}

.shell-main-top-title h3 {
  margin: 0;
  font-size: 16px;
  line-height: 1.3;
  font-weight: 700;
  color: #1e293b;
}

.shell-main-top-title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #64748b;
}

.shell-main-top-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shell-preview-zone {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.shell-console {
  min-height: 0;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shell-console.empty {
  border-style: dashed;
  background: rgba(255, 255, 255, 0.68);
}

.shell-console-head {
  height: 36px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #475569;
}

.shell-console-sub {
  font-size: 11px;
  color: #94a3b8;
}

.shell-console-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
}

.shell-empty {
  padding: 6px 0;
}

.shell-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
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
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 10px 12px;
  color: #303133;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.07);
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
  font-size: 13px;
  line-height: 1.65;
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
  background: var(--el-color-primary-light-9);
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

.shell-tool-results {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(148, 163, 184, 0.32);
  display: grid;
  gap: 8px;
}

.shell-tool-results-head {
  font-size: 12px;
  color: #64748b;
}

.shell-tool-item {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(248, 250, 252, 0.9);
}

.shell-tool-item.ok {
  border-color: rgba(34, 197, 94, 0.34);
}

.shell-tool-item.fail {
  border-color: rgba(239, 68, 68, 0.34);
}

.shell-tool-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.shell-tool-name {
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
}

.shell-tool-state {
  font-size: 11px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.shell-tool-state.ok {
  color: #166534;
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.28);
}

.shell-tool-state.fail {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.28);
}

.shell-tool-meta {
  font-size: 11px;
  color: #64748b;
}

.shell-tool-message {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: #475569;
  word-break: break-word;
}

.shell-tool-warning {
  margin-top: 10px;
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(245, 158, 11, 0.36);
  background: rgba(254, 243, 199, 0.75);
  color: #92400e;
  font-size: 12px;
  line-height: 1.45;
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
  margin: 4px 0 6px 0;
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

.shell-composer-inline,
.shell-composer-prototype {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 0;
  display: block;
  padding: 0;
  background: transparent;
  min-width: 0;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: none;
}

.shell-upload-title {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.shell-upload-counter {
  font-size: 0;
  color: #64748b;
}

.shell-upload-clip-btn {
  width: 28px;
  height: 28px;
}

.shell-dialog-slot {
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px 8px;
}

.shell-input-stack {
  position: relative;
}

.shell-input-actions {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 8px;
  bottom: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  z-index: 2;
}

.shell-send-btn {
  height: 28px;
  padding: 0 12px;
}

.shell-file-input {
  display: none;
}

.shell-attachment-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.shell-attachment-hint {
  font-size: 12px;
  color: #64748b;
}

.shell-attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  max-width: 100%;
  overflow: hidden;
}

.shell-attachment-list-compact {
  margin-bottom: 0;
}

.shell-attachment-tag {
  max-width: 100%;
}

.shell-dialog-slot :deep(.el-textarea),
.shell-dialog-slot :deep(.el-textarea__inner) {
  width: 100%;
}

.shell-dialog-slot :deep(.el-textarea__inner) {
  min-height: 70px !important;
  max-height: 152px;
  border-radius: 10px;
  line-height: 1.6;
  overflow: auto;
  padding-top: 40px;
  padding-left: 40px;
  padding-right: 84px;
  padding-bottom: 10px;
}

.shell-upload-clip-btn-inline {
  width: 26px;
  height: 26px;
}

.shell-send-btn-inline {
  min-width: 56px;
  height: 28px;
  border-radius: 8px;
  padding: 0 12px;
}

.shell-upload-error {
  margin-bottom: 4px;
}

.shell-hint-inline {
  margin: 0;
  width: fit-content;
}

.shell-error-inline {
  margin-top: 2px;
}

.shell-preview-header {
  border: none;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0;
  background: transparent;
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

.preview-wrapper {
  position: relative;
  width: 100%;
  height: calc(100% - 44px);
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
  background: transparent;
  overflow: hidden;
}

.shell-preview-wrapper {
  flex: 1;
  min-height: 0;
  min-width: 0;
  height: auto;
  border: none;
  border-radius: 0;
  padding: 8px;
  overflow: hidden;
  align-items: stretch;
  justify-content: stretch;
}

.shell-preview-wrapper .preview-stage {
  width: 100%;
  max-width: none;
  margin: 0;
  flex: none;
  height: 100%;
}

.shell-preview-stage {
  aspect-ratio: auto;
  max-height: none;
}

.preview-stage {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: var(--flash-surface);
  overflow: hidden;
}

.preview-wrapper.has-custom-ratio {
  align-items: center;
  justify-content: center;
  padding: 14px 16px 16px;
}

.preview-stage.custom-ratio {
  height: auto;
  border-radius: 0;
  border: none;
  box-shadow: none;
}

.preview-ratio-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.preview-ratio-field {
  width: 56px;
}

.preview-ratio-sep {
  color: #64748b;
  font-size: 12px;
  line-height: 1;
}

.preview-stage-inner {
  position: relative;
  width: 100%;
  height: 100%;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--flash-surface);
}

.panel-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  color: #606266;
  z-index: 3;
}

.preview-mask {
  backdrop-filter: blur(12px) saturate(120%);
}

.preview-glass {
  width: min(72%, 560px);
  min-height: 150px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0.18));
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
}

.glass-dots {
  display: flex;
  align-items: center;
  gap: 8px;
}

.glass-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--flash-primary);
  animation: glassDotPulse 1s ease-in-out infinite;
}

.glass-dot:nth-child(2) { animation-delay: 0.08s; }
.glass-dot:nth-child(3) { animation-delay: 0.16s; }
.glass-dot:nth-child(4) { animation-delay: 0.24s; }
.glass-dot:nth-child(5) { animation-delay: 0.32s; }
.glass-dot:nth-child(6) { animation-delay: 0.40s; }
.glass-dot:nth-child(7) { animation-delay: 0.48s; }
.glass-dot:nth-child(8) { animation-delay: 0.56s; }
.glass-dot:nth-child(9) { animation-delay: 0.64s; }

.glass-text {
  color: #0f172a;
  font-size: 14px;
  letter-spacing: 0.2px;
  text-align: center;
  font-weight: 600;
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

.glass-enter-active,
.glass-leave-active {
  transition: opacity 0.36s ease, transform 0.36s ease;
}

.glass-enter-from,
.glass-leave-to {
  opacity: 0;
  transform: scale(1.02);
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

@keyframes glassDotPulse {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  45% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

@keyframes shellConnPulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 1280px) {
  .builder-content {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(360px, 1fr);
  }

  .builder-content > .left-panel {
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-light);
  }

  .shell-chat-head {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .shell-composer-inline,
  .shell-composer-prototype {
    display: block;
  }

  .shell-workbench {
    flex-direction: column;
  }

  .shell-rail {
    width: 100% !important;
    height: auto;
    border-right: none;
    border-bottom: 1px solid rgba(148, 163, 184, 0.28);
  }

  .shell-preview-wrapper .preview-stage {
    width: 100%;
  }

  .shell-rail-resizer {
    display: none;
  }
}

@media (max-width: 992px) {
  .builder-header {
    padding: 0 12px;
  }

  .builder-content {
    margin: 10px 12px 12px;
  }

  .shell-chat-main {
    grid-template-rows: auto minmax(220px, 1fr);
    padding: 10px;
    gap: 10px;
  }
}
</style>
