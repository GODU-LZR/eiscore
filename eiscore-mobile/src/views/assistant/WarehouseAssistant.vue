<template>
  <div class="assistant-page">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>仓储助手</p>
      <span class="header-action" @click="showHistory = !showHistory">
        <i class="history-icon" />
      </span>
    </div>

    <div class="assistant-body">
      <!-- Hero 区域 -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">Warehouse AI</span>
          <h1>仓储智能助手</h1>
          <p>自然语言查询仓库、库存与出入库数据，支持图表可视化。</p>
        </div>
      </section>

      <!-- 会话历史面板 -->
      <transition name="slide">
        <div v-if="showHistory" class="history-panel">
          <div class="history-head">
            <span class="history-title">对话历史</span>
            <button class="ghost-btn" @click="createNewSession">新对话</button>
          </div>
          <div class="history-list">
            <div
              v-for="s in sessions"
              :key="s.id"
              class="history-item"
              :class="{ active: s.id === currentSessionId }"
              @click="switchSession(s.id)"
            >
              <div class="history-item-title">{{ s.title }}</div>
              <div class="history-item-time">{{ formatTime(s.updatedAt) }}</div>
              <button
                v-if="sessions.length > 1"
                class="history-del"
                @click.stop="deleteSession(s.id)"
              >×</button>
            </div>
          </div>
        </div>
      </transition>

      <!-- 消息区域 -->
      <section ref="messagesRef" class="messages-area">
        <div
          v-for="(msg, index) in currentMessages"
          :key="index"
          class="message-row"
          :class="msg.role"
        >
          <div class="avatar">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
          <div class="bubble-wrap">
            <div
              class="bubble"
              :class="{ streaming: isStreaming && index === currentMessages.length - 1 && msg.role === 'assistant' }"
              v-html="renderMarkdown(msg.content)"
            />
            <div v-if="msg.role === 'user'" class="msg-actions">
              <button class="retry-btn" @click="retryMessage(index)">重试</button>
            </div>
          </div>
        </div>

        <!-- 加载指示 -->
        <div v-if="isLoading && !isStreaming" class="message-row assistant">
          <div class="avatar">AI</div>
          <div class="bubble-wrap">
            <div class="bubble loading-bubble">
              <span class="dot-anim"><i /><i /><i /></span>
              思考中...
            </div>
          </div>
        </div>
      </section>

      <!-- 快捷问题 -->
      <section v-if="currentMessages.length <= 1" class="suggest-section">
        <div class="suggest-title">试试问我</div>
        <div class="suggest-grid">
          <button
            v-for="(q, i) in suggestQuestions"
            :key="i"
            class="suggest-card"
            @click="sendSuggestion(q)"
          >{{ q }}</button>
        </div>
      </section>
    </div>

    <!-- 底部输入栏 -->
    <div class="input-bar">
      <textarea
        v-model="inputText"
        class="input-field"
        placeholder="输入查询，如：各仓库库存分布"
        rows="1"
        @keydown.enter.exact.prevent="handleSend"
      />
      <button
        class="send-btn"
        :class="{ active: inputText.trim() && !isLoading }"
        :disabled="isLoading || !inputText.trim()"
        @click="handleSend"
      >
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getToken } from '@/utils/auth'
import MarkdownIt from 'markdown-it'
import * as echarts from 'echarts'

const router = useRouter()

// ── 常量 ───────────────────────────────────────────────
const STORAGE_KEY = 'eis_warehouse_assistant_v1'
const MAX_SESSIONS = 10
const MAX_MESSAGES = 40
const HISTORY_WINDOW = 8
const CODE_FENCE = '```'

const SYSTEM_PROMPT = `你是一名仓储数据查询助手，专注于帮用户查询和分析仓库、库存、出入库等数据。你只回答与仓储相关的查询问题，不做任何数据写入或修改操作。

【强制输出规则】
1. 当用户需要统计图表时，必须输出 ECharts JSON 配置，并放在 ${CODE_FENCE}echarts${CODE_FENCE} 代码块内。
2. 禁止输出任何 JavaScript 变量或包装（例如 "var option ="、"option ="）。只允许纯 JSON。
3. 图表代码块之外，必须给出数据说明与分析结论。
4. 输出结构建议：摘要 → 关键数据 → 图表（如需要）→ 结论。
5. 你只能查询信息，不能执行任何写入、修改、删除操作。

【ECharts 图表示例】
${CODE_FENCE}echarts
{
  "title": { "text": "各仓库库存数量" },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["主仓库", "冷库", "原材料库"] },
  "yAxis": { "type": "value" },
  "series": [
    { "name": "库存数量", "type": "bar", "data": [320, 150, 280] }
  ]
}
${CODE_FENCE}

【能力范围】
- 查询仓库基本信息（名称、编码、库位数量）
- 查询库存数据（物料库存量、库位使用率）
- 查询出入库记录（入库/出库数量、趋势）
- 数据分析与可视化（库存分布、趋势图、对比图）
- 物料信息查询（物料编码、名称、分类）

【回答风格】
- 简洁、专业、数据驱动
- 有数据时用图表展示，直观清晰
- 如果没有足够信息，明确告知用户需要什么数据`

// ── Markdown 渲染 ──────────────────────────────────────
const md = new MarkdownIt({ html: false, linkify: true, typographer: false })

const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info.trim().toLowerCase()
  if (info === 'echarts') {
    return `<div class="echarts-chart chart-pending" data-option="${encodeURIComponent(token.content)}"></div>`
  }
  if (defaultFence) return defaultFence(tokens, idx, options, env, self)
  return self.renderToken(tokens, idx, options)
}

const renderMarkdown = (text) => {
  if (!text) return ''
  return md.render(text)
}

// ── 状态 ─────────────────────────────────────────────
const inputText = ref('')
const isLoading = ref(false)
const isStreaming = ref(false)
const showHistory = ref(false)
const messagesRef = ref(null)

const sessions = reactive([])
const currentSessionId = ref(null)

const currentSession = computed(() => sessions.find(s => s.id === currentSessionId.value))
const currentMessages = computed(() => currentSession.value?.messages || [])

const suggestQuestions = [
  '各仓库当前库存总量对比',
  '物料分类库存分布饼图',
  '最近7天出入库趋势',
  '库位使用率排名',
  '库存量前10的物料',
  '各仓库库位数量统计'
]

// ── ECharts 管理 ────────────────────────────────────────
let chartResizeObserver = null
const chartResizeTimers = new Map()

const stripFunctionValueBlocks = (input) => {
  const text = String(input || '')
  if (!text.includes(': function')) return text
  let out = ''
  let cursor = 0
  while (cursor < text.length) {
    const fnToken = text.indexOf(': function', cursor)
    if (fnToken < 0) { out += text.slice(cursor); break }
    out += text.slice(cursor, fnToken) + ': null'
    let i = fnToken + 1
    const keyword = text.indexOf('function', i)
    if (keyword < 0) { cursor = fnToken + 1; continue }
    i = keyword + 'function'.length
    while (i < text.length && text[i] !== '{') i += 1
    if (i >= text.length) { cursor = text.length; break }
    let depth = 0
    let inString = false
    let escaped = false
    for (; i < text.length; i += 1) {
      const ch = text[i]
      if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue }
      if (ch === '"') { inString = true; continue }
      if (ch === '{') depth += 1
      if (ch === '}') { depth -= 1; if (depth === 0) { i += 1; break } }
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
    if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue }
    if (ch === '"') { inString = true; continue }
    if (ch === open) depth += 1
    if (ch === close) depth -= 1
    if (depth === 0) return text.slice(start, i + 1)
  }
  return ''
}

const normalizeGridItem = (grid) => {
  const base = { left: 40, right: 20, top: 52, bottom: 36, containLabel: true }
  const next = { ...base, ...(grid && typeof grid === 'object' ? grid : {}) }
  const widthNum = typeof next.width === 'number' ? next.width : Number.NaN
  const heightNum = typeof next.height === 'number' ? next.height : Number.NaN
  if (Number.isFinite(widthNum) && widthNum < 200) delete next.width
  if (Number.isFinite(heightNum) && heightNum < 140) delete next.height
  return next
}

const normalizeEchartsOption = (option) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null
  const cloned = JSON.parse(JSON.stringify(option))
  if (cloned.series && !Array.isArray(cloned.series)) cloned.series = [cloned.series]
  if (!Array.isArray(cloned.series) || cloned.series.length === 0) return null
  cloned.series = cloned.series
    .filter(item => item && typeof item === 'object')
    .map(item => ({ type: item.type || 'line', ...item }))
  if (!cloned.series.length) return null
  cloned.animation = false
  if (Array.isArray(cloned.grid)) {
    cloned.grid = cloned.grid.map(item => normalizeGridItem(item))
  } else {
    cloned.grid = normalizeGridItem(cloned.grid)
  }
  if (!cloned.tooltip) cloned.tooltip = { trigger: 'axis' }
  // 移动端适配：缩小标题字号、旋转横轴标签
  if (cloned.title) {
    if (typeof cloned.title === 'object' && !Array.isArray(cloned.title)) {
      cloned.title.textStyle = { ...cloned.title.textStyle, fontSize: 14 }
    }
  }
  if (cloned.legend) {
    const legend = Array.isArray(cloned.legend) ? cloned.legend[0] : cloned.legend
    if (legend && typeof legend === 'object') {
      legend.textStyle = { ...legend.textStyle, fontSize: 11 }
      legend.itemWidth = legend.itemWidth || 14
      legend.itemHeight = legend.itemHeight || 10
    }
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
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(primary.slice(firstBrace, lastBrace + 1))
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

const validateEchartsOption = (option) => {
  if (!option || !option.series || !Array.isArray(option.series) || option.series.length === 0) {
    return '图表配置缺少必要的 series 数据'
  }
  return ''
}

const waitTwoFrames = () => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
})

const delayMs = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const clearChartResizeTimer = (node) => {
  const timer = chartResizeTimers.get(node)
  if (timer) { clearTimeout(timer); chartResizeTimers.delete(node) }
}

const observeChartNode = (node) => {
  if (!node || !chartResizeObserver) return
  chartResizeObserver.observe(node)
}

const unobserveChartNode = (node) => {
  if (!node) return
  clearChartResizeTimer(node)
  if (chartResizeObserver) try { chartResizeObserver.unobserve(node) } catch {}
}

const renderEchartsNode = async (node, attempt = 0) => {
  const maxRetries = 8
  try {
    node.setAttribute('data-processed', 'true')
    node.classList.add('is-rendering')
    const jsonStr = decodeURIComponent(node.getAttribute('data-option') || '')
    const option = parseEchartsOptionSafely(jsonStr)
    if (!option) throw new Error('ECharts JSON parse failed')
    const err = validateEchartsOption(option)
    if (err) throw new Error(err)
    const previous = echarts.getInstanceByDom(node)
    if (previous) previous.dispose()
    unobserveChartNode(node)
    node.style.width = '100%'
    node.style.height = '280px'
    const chart = echarts.init(node)
    chart.setOption(option, true)
    await waitTwoFrames()
    node.classList.remove('is-rendering')
    node.classList.remove('chart-pending')
    observeChartNode(node)
  } catch (e) {
    if (attempt < maxRetries) {
      node.classList.remove('is-rendering')
      await delayMs(200 + attempt * 150)
      return renderEchartsNode(node, attempt + 1)
    }
    node.classList.remove('is-rendering')
    node.classList.remove('chart-pending')
    node.innerHTML = '<div class="chart-error">图表暂不可用</div>'
  }
}

const renderCharts = async () => {
  await nextTick()
  const nodes = Array.from(document.querySelectorAll('.echarts-chart:not([data-processed])'))
  nodes.forEach(node => void renderEchartsNode(node))
}

// ── 会话管理 (localStorage) ────────────────────────────
const loadSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (Array.isArray(data.sessions)) {
      sessions.splice(0, sessions.length, ...data.sessions.slice(0, MAX_SESSIONS))
      currentSessionId.value = data.currentSessionId || sessions[0]?.id || null
    }
  } catch {}
}

const saveSessions = () => {
  try {
    const data = {
      sessions: sessions.slice(0, MAX_SESSIONS).map(s => ({
        ...s,
        messages: s.messages.slice(-MAX_MESSAGES)
      })),
      currentSessionId: currentSessionId.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

const createNewSession = () => {
  const newSession = {
    id: Date.now().toString(),
    title: '新对话',
    messages: [
      { role: 'assistant', content: '你好！我是仓储智能助手，可以帮你查询仓库、库存和出入库数据，并以图表展示分析结果。', time: Date.now() }
    ],
    updatedAt: Date.now()
  }
  sessions.unshift(newSession)
  currentSessionId.value = newSession.id
  showHistory.value = false
  saveSessions()
}

const switchSession = (id) => {
  if (currentSessionId.value !== id) {
    currentSessionId.value = id
    showHistory.value = false
  }
}

const deleteSession = (id) => {
  const index = sessions.findIndex(s => s.id === id)
  if (index > -1) {
    sessions.splice(index, 1)
    if (currentSessionId.value === id) {
      currentSessionId.value = sessions[0]?.id || null
      if (!currentSessionId.value) createNewSession()
    }
    saveSessions()
  }
}

// ── SSE 通信 ───────────────────────────────────────────
const buildAuthHeaders = () => {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

const buildPayloadMessages = () => {
  const session = currentSession.value
  if (!session) return []
  const msgs = session.messages.filter(m => m.role === 'user' || m.role === 'assistant')
  return msgs.slice(-HISTORY_WINDOW).map(m => ({ role: m.role, content: m.content }))
}

const sendMessage = async (text) => {
  const content = (text || '').trim()
  if (!content || isLoading.value) return

  const session = currentSession.value
  if (!session) return

  // 推入用户消息
  session.messages.push({ role: 'user', content, time: Date.now() })
  // 更新标题
  if (session.messages.filter(m => m.role === 'user').length === 1) {
    session.title = content.slice(0, 20) || '新对话'
  }
  session.updatedAt = Date.now()
  inputText.value = ''
  isLoading.value = true
  isStreaming.value = false
  scrollToBottom()

  // 创建 AI 回复占位
  const aiMsg = reactive({ role: 'assistant', content: '', time: Date.now() })
  session.messages.push(aiMsg)

  try {
    const payload = {
      stream: true,
      assistant_mode: 'enterprise',
      context: { scene: 'warehouse_assistant', readOnly: true },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...buildPayloadMessages()
      ]
    }

    const response = await fetch('/agent/ai/chat/completions', {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`请求失败 (${response.status}): ${errText.slice(0, 100)}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    isStreaming.value = true

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue
        try {
          const json = JSON.parse(dataStr)
          const delta = json?.choices?.[0]?.delta?.content
          if (delta) {
            aiMsg.content += delta
            scrollToBottom()
          }
        } catch {}
      }
    }
  } catch (e) {
    if (!aiMsg.content) {
      aiMsg.content = `抱歉，请求出现错误：${e.message || '未知错误'}。请稍后重试。`
    }
  } finally {
    isLoading.value = false
    isStreaming.value = false
    session.updatedAt = Date.now()
    saveSessions()
    await renderCharts()
  }
}

const handleSend = () => sendMessage(inputText.value)
const sendSuggestion = (q) => sendMessage(q)
const retryMessage = (index) => {
  const session = currentSession.value
  const target = session?.messages[index]
  if (!session || !target || target.role !== 'user') return
  session.messages.splice(index + 1)
  sendMessage(target.content)
}

// ── 工具函数 ──────────────────────────────────────────
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Watch & 生命周期 ──────────────────────────────────
watch(() => currentMessages.value?.length, scrollToBottom)
watch(() => currentMessages.value?.[currentMessages.value.length - 1]?.content, () => {
  scrollToBottom()
  renderCharts()
})

onMounted(() => {
  loadSessions()
  if (sessions.length === 0) createNewSession()
  if (!currentSessionId.value && sessions.length) currentSessionId.value = sessions[0].id

  chartResizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(entries => {
        entries.forEach(entry => {
          const node = entry.target
          clearChartResizeTimer(node)
          const timer = setTimeout(() => {
            chartResizeTimers.delete(node)
            const chart = echarts.getInstanceByDom(node)
            if (chart) requestAnimationFrame(() => { try { chart.resize() } catch {} })
          }, 80)
          chartResizeTimers.set(node, timer)
        })
      })
    : null

  window.addEventListener('resize', handleWindowResize)
})

const handleWindowResize = () => {
  document.querySelectorAll('.echarts-chart[data-processed="true"]').forEach(node => {
    const chart = echarts.getInstanceByDom(node)
    if (chart) requestAnimationFrame(() => { try { chart.resize() } catch {} })
  })
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  chartResizeTimers.forEach(timer => clearTimeout(timer))
  chartResizeTimers.clear()
  document.querySelectorAll('.echarts-chart').forEach(node => {
    unobserveChartNode(node)
    const chart = echarts.getInstanceByDom(node)
    if (chart) chart.dispose()
  })
  if (chartResizeObserver) { chartResizeObserver.disconnect(); chartResizeObserver = null }
})
</script>

<style scoped>
/* ===== Page Layout ===== */
.assistant-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f8f9;
}

/* ===== Header ===== */
.header-top {
  width: 100%;
  height: 44px;
  background: #007cff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-sizing: border-box;
  font-size: 16px;
  font-weight: 400;
  color: #ffffff;
  position: sticky;
  top: 0;
  z-index: 30;
  flex-shrink: 0;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.back-icon {
  width: 10px;
  height: 10px;
  border-left: 2px solid #ffffff;
  border-bottom: 2px solid #ffffff;
  transform: rotate(45deg);
  display: inline-block;
}
.header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.history-icon {
  width: 18px;
  height: 14px;
  border-top: 2px solid #fff;
  border-bottom: 2px solid #fff;
  display: inline-block;
  position: relative;
}
.history-icon::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: #fff;
  transform: translateY(-50%);
}

/* ===== Body ===== */
.assistant-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  --ink: #1d2433;
  --muted: #5a6b7c;
  --accent: #1b6dff;
  --accent-dark: #0e3fa5;
  --accent-soft: rgba(27, 109, 255, 0.12);
  --fresh: #21c189;
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  color: var(--ink);
}

/* ===== Hero ===== */
.hero {
  padding: 16px;
  flex-shrink: 0;
}
.hero-copy {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 18px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 12px 30px rgba(20, 37, 90, 0.1);
  animation: riseIn 0.6s ease both;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--accent-dark);
  background: var(--accent-soft);
  letter-spacing: 0.4px;
}
.hero-copy h1 {
  margin: 8px 0 6px;
  font-size: 20px;
  letter-spacing: 0.5px;
}
.hero-copy p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

/* ===== History Panel ===== */
.history-panel {
  position: absolute;
  top: 44px;
  right: 0;
  left: 0;
  z-index: 25;
  background: #fff;
  border-bottom: 1px solid #e3e9f2;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  max-height: 60vh;
  overflow-y: auto;
}
.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
}
.history-title {
  font-size: 15px;
  font-weight: 600;
}
.ghost-btn {
  background: none;
  border: 1px solid var(--accent);
  color: var(--accent);
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}
.history-list {
  padding: 8px 0;
}
.history-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 8px;
}
.history-item:active,
.history-item.active {
  background: var(--accent-soft);
}
.history-item-title {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-item-time {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}
.history-del {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* ===== Messages ===== */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  -webkit-overflow-scrolling: touch;
}
.message-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  animation: riseIn 0.3s ease both;
}
.message-row.user {
  flex-direction: row-reverse;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}
.message-row.assistant .avatar {
  background: linear-gradient(135deg, #1b6dff, #4b8bff);
  color: #fff;
}
.message-row.user .avatar {
  background: linear-gradient(135deg, #1f2d3d, #44556b);
  color: #fff;
}
.bubble-wrap {
  max-width: calc(100% - 52px);
  min-width: 60px;
}
.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
}
.message-row.assistant .bubble {
  background: #ffffff;
  border: 1px solid rgba(227, 233, 242, 0.8);
  border-top-left-radius: 4px;
  box-shadow: 0 4px 12px rgba(20, 37, 90, 0.06);
}
.message-row.user .bubble {
  background: linear-gradient(135deg, #1b6dff 0%, #4b8bff 100%);
  color: #ffffff;
  border-top-right-radius: 4px;
}
.bubble.streaming::after {
  content: '▎';
  animation: blink 0.8s infinite;
  color: var(--accent);
  margin-left: 2px;
}
.msg-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  justify-content: flex-end;
}
.retry-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
}
.retry-btn:active {
  color: var(--accent);
}

/* ===== Loading ===== */
.loading-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}
.dot-anim {
  display: inline-flex;
  gap: 3px;
}
.dot-anim i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: dotBounce 1.2s infinite ease-in-out;
}
.dot-anim i:nth-child(2) { animation-delay: 0.15s; }
.dot-anim i:nth-child(3) { animation-delay: 0.3s; }

/* ===== Suggest ===== */
.suggest-section {
  padding: 0 16px 16px;
  flex-shrink: 0;
}
.suggest-title {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 10px;
  font-weight: 600;
}
.suggest-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.suggest-card {
  background: #ffffff;
  border: 1px solid rgba(227, 233, 242, 0.8);
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 12px rgba(20, 37, 90, 0.05);
  line-height: 1.4;
  animation: riseIn 0.5s ease both;
}
.suggest-card:active {
  transform: translateY(1px);
  box-shadow: 0 2px 6px rgba(20, 37, 90, 0.08);
}

/* ===== Input Bar ===== */
.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1px solid #e3e9f2;
  flex-shrink: 0;
}
.input-field {
  flex: 1;
  border: 1px solid #e3e9f2;
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 14px;
  resize: none;
  outline: none;
  background: #f5f8f9;
  font-family: inherit;
  line-height: 1.4;
  max-height: 100px;
  transition: border-color 0.2s;
}
.input-field:focus {
  border-color: var(--accent);
}
.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #e0e4e8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  transition: background 0.2s, transform 0.15s;
  flex-shrink: 0;
}
.send-btn.active {
  background: var(--accent);
  cursor: pointer;
}
.send-btn.active:active {
  transform: scale(0.92);
}

/* ===== ECharts 图表 ===== */
:deep(.echarts-chart) {
  width: 100%;
  min-height: 200px;
  margin: 12px 0;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid rgba(227, 233, 242, 0.6);
  box-shadow: 0 4px 12px rgba(20, 37, 90, 0.05);
}
:deep(.echarts-chart.chart-pending),
:deep(.echarts-chart.is-rendering) {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 12px;
  min-height: 120px;
}
:deep(.echarts-chart.chart-pending)::after {
  content: '图表加载中...';
}
:deep(.chart-error) {
  text-align: center;
  padding: 20px;
  color: #ef4444;
  font-size: 13px;
}

/* ===== Markdown 样式 ===== */
:deep(.bubble h1),
:deep(.bubble h2),
:deep(.bubble h3) {
  margin: 12px 0 6px;
  font-size: 15px;
  font-weight: 700;
}
:deep(.bubble h1) { font-size: 17px; }
:deep(.bubble p) {
  margin: 0 0 6px;
  line-height: 1.65;
}
:deep(.bubble ul),
:deep(.bubble ol) {
  margin: 4px 0;
  padding-left: 18px;
}
:deep(.bubble li) {
  margin-bottom: 3px;
}
:deep(.bubble pre) {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  font-size: 12px;
  margin: 8px 0;
}
:deep(.bubble code) {
  background: rgba(27, 109, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}
:deep(.bubble pre code) {
  background: none;
  padding: 0;
}
:deep(.bubble table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}
:deep(.bubble th),
:deep(.bubble td) {
  border: 1px solid #e3e9f2;
  padding: 5px 8px;
  text-align: left;
}
:deep(.bubble th) {
  background: #f5f7fa;
  font-weight: 600;
}
:deep(.bubble strong) {
  font-weight: 700;
}
:deep(.bubble blockquote) {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 8px 8px 0;
  font-size: 13px;
}

/* ===== Animations ===== */
@keyframes riseIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
