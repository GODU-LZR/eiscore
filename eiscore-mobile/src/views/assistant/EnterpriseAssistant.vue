<template>
  <div class="assistant-page">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>经营助手</p>
      <span class="header-action" @click="showHistory = !showHistory">
        <i class="history-icon" />
      </span>
    </div>

    <div class="assistant-body">
      <!-- Hero 区域 -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">Enterprise AI</span>
          <h1>企业经营助手</h1>
          <p>全域数据分析：库存、物料、人事、业务，图表可视化一站呈现。</p>
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
            <!-- 用户附件预览 -->
            <div v-if="msg.role === 'user' && msg.files && msg.files.length" class="msg-files">
              <div v-for="(f, fi) in msg.files" :key="fi" class="msg-file-tag">
                <svg v-if="f.type === 'image'" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z"/></svg>
                <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
                <span>{{ f.name }}</span>
              </div>
            </div>
            <div
              class="bubble"
              :class="{ streaming: isStreaming && index === currentMessages.length - 1 && msg.role === 'assistant' }"
              v-html="renderMarkdown(msg.content)"
              :data-message-index="index"
            />
            <div class="msg-actions">
              <button v-if="msg.role === 'user'" class="retry-btn" @click="retryMessage(index)">重试</button>
              <button
                v-if="shouldShowReportDownload(msg, index)"
                class="report-btn"
                @click="exportMessageReportAsPdf(index)"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                下载报告
              </button>
            </div>
          </div>
        </div>

        <!-- 加载指示 -->
        <div v-if="isLoading && !isStreaming" class="message-row assistant">
          <div class="avatar">AI</div>
          <div class="bubble-wrap">
            <div class="bubble loading-bubble">
              <span class="dot-anim"><i /><i /><i /></span>
              正在分析企业数据...
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
      <!-- 附件预览 -->
      <div v-if="selectedFiles.length" class="file-preview-bar">
        <div v-for="(file, idx) in selectedFiles" :key="idx" class="preview-item">
          <img v-if="file.type === 'image'" :src="file.url" />
          <div v-else class="doc-preview">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#909399"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
          </div>
          <div class="remove-btn" @click="selectedFiles.splice(idx, 1)">×</div>
          <div class="file-name-tag">{{ file.name.length > 6 ? file.name.slice(0, 6) + '…' : file.name }}</div>
        </div>
      </div>
      <div class="input-row">
        <label class="attach-btn">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.docx,.txt,.json,.png,.jpg,.jpeg,.gif,.webp"
            style="display:none"
            @change="onFileInput"
          />
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16.5 6v11.5a4 4 0 01-8 0V5a2.5 2.5 0 015 0v10.5a1 1 0 01-2 0V6h-1.5v9.5a2.5 2.5 0 005 0V5a4 4 0 00-8 0v12.5a5.5 5.5 0 0011 0V6H16.5z"/></svg>
        </label>
        <textarea
          v-model="inputText"
          class="input-field"
          placeholder="输入经营分析问题，或上传数据文件"
          rows="1"
          @keydown.enter.exact.prevent="handleSend"
        />
        <button
          class="send-btn"
          :class="{ active: (inputText.trim() || selectedFiles.length) && !isLoading }"
          :disabled="isLoading || (!inputText.trim() && !selectedFiles.length)"
          @click="handleSend"
        >
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getToken } from '@/utils/auth'
import MarkdownIt from 'markdown-it'
import * as echarts from 'echarts'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const router = useRouter()

// ── 常量 ───────────────────────────────────────────────
const STORAGE_KEY = 'eis_enterprise_assistant_v1'
const MAX_SESSIONS = 10
const MAX_MESSAGES = 40
const HISTORY_WINDOW = 10
const CODE_FENCE = '```'

const SYSTEM_PROMPT = `你是一名企业经营分析助手，具备全域数据查询和智能分析能力。你可以查询和分析以下业务数据：

【可查数据范围】
1. 仓储数据：仓库列表、库位信息、仓库状态
2. 库存数据：实时库存数量、物料库位分布、库存汇总
3. 出入库记录：入库/出库/调拨/退库记录、趋势分析
4. 物料信息：物料编码、名称、分类、规格型号、单位
5. 人事数据：员工总数、部门分布、在职/离职统计
6. 盘点数据：盘点任务、盘点状态、盘亏盘盈分析
7. 应用数据：已注册应用列表与使用情况
8. 批次信息：物料批次、批次库存、效期管理

【强制输出规则】
1. 当用户需要统计图表时，必须输出 ECharts JSON 配置，并放在 ${CODE_FENCE}echarts${CODE_FENCE} 代码块内。
2. 禁止输出任何 JavaScript 变量或包装（例如 "var option ="、"option ="）。只允许纯 JSON。
3. ECharts JSON 必须严格：双引号、无注释、无尾逗号、禁止函数（如 formatter/itemStyle.color function）。
4. 图表之外，必须给出数据说明与分析结论。
5. 输出结构：摘要 → 核心指标 → 图表（如需）→ 风险与建议。
6. 先给结论，再给证据（数据/图表），最后给行动建议。
7. 每条建议都要可落地：包含负责方向、时间节点、目标。
8. 你只能查询信息，不能执行任何写入、修改、删除操作。
9. 当系统提供了【企业实时数据快照】时，必须基于真实数据进行分析和图表生成，禁止编造或使用示例假数据。

【ECharts 图表示例】
${CODE_FENCE}echarts
{
  "title": { "text": "各仓库库存分布" },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["主仓库", "冷库", "原材料库"] },
  "yAxis": { "type": "value" },
  "series": [
    { "name": "库存数量", "type": "bar", "data": [320, 150, 280] }
  ]
}
${CODE_FENCE}

【回答风格】
- 专业但通俗易懂，用业务语言解释指标
- 数据驱动，有数据时用图表展示
- 建议可执行、有方向，避免空话
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
const selectedFiles = reactive([])

const sessions = reactive([])
const currentSessionId = ref(null)

const currentSession = computed(() => sessions.find(s => s.id === currentSessionId.value))
const currentMessages = computed(() => currentSession.value?.messages || [])

const suggestQuestions = [
  '各仓库当前库存总量对比分析',
  '物料分类库存分布与占比',
  '近期出入库趋势分析',
  '员工部门分布与人员结构',
  '盘点任务执行情况汇总',
  '库存周转与物料消耗排名',
  '各仓库库位使用率对比',
  '企业经营数据总览'
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
  // 移动端适配
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

// ── 文件处理 ────────────────────────────────────────────
const parseFileContent = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file)
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const csv = XLSX.utils.sheet_to_csv(worksheet)
          resolve(`[Excel数据: ${file.name}]\n${csv}\n`)
        } catch {
          resolve(`[解析错误] ${file.name}`)
        }
      }
    } else if (file.name.endsWith('.csv')) {
      reader.readAsText(file)
      reader.onload = () => resolve(`[CSV数据: ${file.name}]\n${reader.result}\n`)
    } else if (file.name.endsWith('.docx')) {
      reader.readAsArrayBuffer(file)
      reader.onload = (event) => {
        mammoth.extractRawText({ arrayBuffer: event.target.result })
          .then(res => resolve(`[Word文档: ${file.name}]\n${res.value}\n`))
          .catch(() => resolve(`[解析错误] ${file.name}`))
      }
    } else if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file)
      reader.onload = () => resolve({ type: 'image', url: reader.result, name: file.name })
    } else {
      if (file.size > 2 * 1024 * 1024) {
        resolve(`[跳过] 文件过大: ${file.name}`)
        return
      }
      reader.readAsText(file)
      reader.onload = () => resolve(`[文本数据: ${file.name}]\n${reader.result}\n`)
    }
  })
}

const handleFileSelect = (file) => {
  if (!file) return
  if (file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => selectedFiles.push({
      type: 'image',
      name: file.name,
      url: reader.result,
      raw: file
    })
  } else {
    selectedFiles.push({ type: 'file', name: file.name, url: null, raw: file })
  }
}

const onFileInput = (event) => {
  const file = event?.target?.files?.[0]
  if (file) handleFileSelect(file)
  event.target.value = ''
}

const normalizeFileForPayload = async (file) => {
  const raw = file?.raw || file
  if (!raw) return null
  if (file.cachedPayload) return file.cachedPayload
  if (raw instanceof File) {
    const parsed = await parseFileContent(raw)
    if (typeof parsed === 'string') {
      file.cachedPayload = { type: 'text', text: parsed }
      return file.cachedPayload
    }
    if (parsed?.type === 'image') {
      file.cachedPayload = { type: 'image_url', image_url: { url: parsed.url } }
      return file.cachedPayload
    }
  }
  if (file.type === 'image' && file.url) {
    file.cachedPayload = { type: 'image_url', image_url: { url: file.url } }
    return file.cachedPayload
  }
  return null
}

// ── 报告下载 ────────────────────────────────────────────
const REPORT_FILLER_LINE_RE = /^(好的|当然|收到|已收到|明白|了解|下面|以下|我将|我会|请查看|这里是|先给出|先汇总).{0,120}(经营分析|经营报告|分析报告|报告|图表|洞察|结论)/
const REPORT_FILLER_SENTENCE_RE = /(好的|当然|收到|已收到|明白|了解)[，,。！!\s].{0,100}(经营分析|经营报告|分析报告|报告)/

const shouldShowReportDownload = (msg, index) => {
  if (msg?.role !== 'assistant') return false
  if (isStreaming.value && index === currentMessages.value.length - 1) return false
  return Boolean(String(msg?.content || '').trim())
}

const normalizeInlineText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const isReportFillerLine = (text) => {
  const value = normalizeInlineText(text)
  if (!value) return false
  return REPORT_FILLER_LINE_RE.test(value) || REPORT_FILLER_SENTENCE_RE.test(value)
}

const stripReportLeadPreamble = (markdownNode) => {
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
      if (isReportFillerLine(text) && text.length <= 180) node.remove()
      continue
    }
    if (node.nodeType === 1) {
      const text = normalizeInlineText(node.textContent)
      if (!text) { node.remove(); continue }
      const tag = String(node.tagName || '').toLowerCase()
      const canTrim = tag === 'p' || tag === 'div' || tag === 'span'
      if (canTrim && isReportFillerLine(text) && text.length <= 180) {
        node.remove()
        continue
      }
      if (canTrim && REPORT_FILLER_SENTENCE_RE.test(text) && text.length <= 200) {
        const cleaned = normalizeInlineText(text.replace(REPORT_FILLER_SENTENCE_RE, ''))
        if (!cleaned) node.remove()
        else node.textContent = cleaned
      }
    }
  }
}

const buildPrintableHtml = (messageIndex) => {
  const row = messagesRef.value
    ? messagesRef.value.querySelector(`.bubble[data-message-index="${messageIndex}"]`)
    : null
  if (!row) return ''

  const printable = row.cloneNode(true)
  printable.querySelectorAll('.msg-actions').forEach(n => n.remove())
  printable.querySelectorAll('.chart-error').forEach(n => n.remove())

  stripReportLeadPreamble(printable)

  // 将 ECharts 实例转换为图片
  const printCharts = Array.from(printable.querySelectorAll('.echarts-chart'))
  const liveCharts = Array.from(row.querySelectorAll('.echarts-chart'))
  printCharts.forEach((node, i) => {
    const liveNode = liveCharts[i]
    const instance = liveNode ? echarts.getInstanceByDom(liveNode) : null
    if (!instance) return
    const dataUrl = instance.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' })
    const img = document.createElement('img')
    img.src = dataUrl
    img.style.maxWidth = '100%'
    img.style.display = 'block'
    img.style.margin = '12px 0'
    node.replaceWith(img)
  })
  printable.querySelectorAll('.echarts-chart').forEach(n => n.remove())

  return printable.innerHTML
}

const exportMessageReportAsPdf = (messageIndex) => {
  const html = buildPrintableHtml(messageIndex)
  if (!html) return

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>企业经营报告 - ${dateStr}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; padding: 20px; color: #303133; line-height: 1.7; font-size: 14px; }
    h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
    .report-date { text-align: center; color: #909399; font-size: 12px; margin-bottom: 20px; }
    .report-content h2, .report-content h3 { margin: 16px 0 8px; font-size: 15px; }
    .report-content p { margin: 0 0 8px; }
    .report-content ul, .report-content ol { margin: 4px 0; padding-left: 20px; }
    .report-content pre { background: #f5f7fa; padding: 10px; border-radius: 6px; overflow: auto; font-size: 12px; margin: 8px 0; }
    .report-content table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
    .report-content th, .report-content td { border: 1px solid #ebeef5; padding: 6px 8px; text-align: left; }
    .report-content th { background: #f5f7fa; font-weight: 600; }
    .report-content img { max-width: 100%; height: auto; border-radius: 8px; }
    .report-content blockquote { margin: 8px 0; padding: 6px 12px; border-left: 3px solid #6c3bff; background: rgba(108,59,255,0.06); border-radius: 0 6px 6px 0; }
    .report-content strong { font-weight: 700; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <h1>企业经营报告</h1>
  <div class="report-date">${dateStr}</div>
  <div class="report-content">${html}</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  <\/script>
</body>
</html>`)
  printWindow.document.close()
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
        messages: s.messages.slice(-MAX_MESSAGES).map(m => {
          if (!m.files?.length) return m
          // 保存文件元信息但不存 raw File 对象
          return {
            ...m,
            files: m.files.map(f => ({ type: f.type, name: f.name, url: f.type === 'image' ? f.url : null }))
          }
        })
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
      { role: 'assistant', content: '你好！我是企业经营助手，可以帮你分析全域业务数据——库存、物料、人事、出入库等，并以图表呈现洞察结论。有什么需要分析的？', time: Date.now() }
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

const buildPayloadMessages = async () => {
  const session = currentSession.value
  if (!session) return []
  const msgs = session.messages.filter(m => m.role === 'user' || m.role === 'assistant')
  const recent = msgs.slice(-HISTORY_WINDOW)
  return Promise.all(recent.map(async (m) => {
    const contentParts = []
    if (m.files?.length) {
      for (const file of m.files) {
        const part = await normalizeFileForPayload(file)
        if (part) contentParts.push(part)
      }
    }
    if (m.content) {
      contentParts.push({ type: 'text', text: m.content })
    }
    return { role: m.role, content: contentParts.length === 1 && contentParts[0].type === 'text' ? m.content : contentParts }
  }))
}

const sendMessage = async (text) => {
  const content = (text || '').trim()
  if ((!content && selectedFiles.length === 0) || isLoading.value) return

  const session = currentSession.value
  if (!session) return

  // 推入用户消息（包含附件）
  const userMsg = {
    role: 'user',
    content,
    files: selectedFiles.length ? [...selectedFiles] : undefined,
    time: Date.now()
  }
  session.messages.push(userMsg)
  // 更新标题
  if (session.messages.filter(m => m.role === 'user').length === 1) {
    session.title = content.slice(0, 20) || '数据分析'
  }
  session.updatedAt = Date.now()
  inputText.value = ''
  selectedFiles.splice(0)
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
      context: {
        scene: 'enterprise_analyst',
        readOnly: true,
        injectBusinessData: true
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(await buildPayloadMessages())
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
  background: linear-gradient(135deg, #1b6dff, #6c3bff);
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
  --accent: #6c3bff;
  --accent-dark: #4a1fb8;
  --accent-soft: rgba(108, 59, 255, 0.10);
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
  background: linear-gradient(135deg, #6c3bff, #9b6eff);
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
  background: linear-gradient(135deg, #6c3bff 0%, #9b6eff 100%);
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
  align-items: center;
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
.report-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: none;
  border: 1px solid var(--accent);
  color: var(--accent);
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.report-btn:active {
  background: var(--accent);
  color: #fff;
}

/* ===== 用户消息附件标签 ===== */
.msg-files {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
  justify-content: flex-end;
}
.msg-file-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  max-width: 140px;
}
.msg-file-tag span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  flex-direction: column;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1px solid #e3e9f2;
  flex-shrink: 0;
}
.file-preview-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.preview-item {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid #e3e9f2;
  overflow: hidden;
  background: #f5f7fa;
}
.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.doc-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.remove-btn {
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  border-radius: 0 8px 0 6px;
}
.file-name-tag {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 9px;
  text-align: center;
  padding: 1px 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.attach-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  color: var(--muted);
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
}
.attach-btn:active {
  background: var(--accent-soft);
  color: var(--accent);
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
  background: rgba(108, 59, 255, 0.08);
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
