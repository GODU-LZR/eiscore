import { reactive, watch } from 'vue'
import request from '@/utils/request'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const STORAGE_KEY = 'eis_ai_history_v5'
const MAX_SESSIONS = 20
const MAX_MESSAGES_PER_SESSION = 50
const HISTORY_WINDOW = 8

/**
 * AI Bridge - 智能文件解析与多模态总线
 */
class AiBridge {
  constructor() {
    this.actions = null
    this.config = null

    const savedData = this.loadFromStorage()
    this.modeStorage = savedData

    this.state = reactive({
      isOpen: false,
      isLoading: false,
      isStreaming: false,
      currentContext: null,
      assistantMode: 'enterprise',
      sessions: savedData.enterprise?.sessions || [],
      currentSessionId: savedData.enterprise?.currentSessionId || null,
      inputBuffer: '',
      selectedFiles: []
    })

    if (this.state.sessions.length === 0) {
      this.createNewSession()
    } else if (!this.state.currentSessionId) {
      this.state.currentSessionId = this.state.sessions[0].id
    }

    watch(() => [this.state.sessions, this.state.currentSessionId], () => {
      this.saveToStorage()
    }, { deep: true })
  }

  initActions(actions) {
    this.actions = actions
    if (this.actions) {
      this.actions.onGlobalStateChange((state) => {
        if (state && state.context) {
          this.state.currentContext = state.context
        }
      }, true)
    }
  }

  async loadConfig() {
    if (this.config) return
    try {
      const res = await request({
        url: '/api/system_configs?key=eq.ai_glm_config',
        method: 'get',
        headers: { 'Accept': 'application/json', 'Accept-Profile': 'public' }
      })
      const data = Array.isArray(res) ? res : (res.data || [])
      if (data && data.length > 0) {
        this.config = data[0].value
      }
    } catch (e) {
      console.error('[AiBridge] Config Load Failed', e)
    }
  }

  loadFromStorage() {
    try {
      const json = localStorage.getItem(STORAGE_KEY)
      return json ? JSON.parse(json) : {
        enterprise: { sessions: [], currentSessionId: null },
        worker: { sessions: [], currentSessionId: null }
      }
    } catch {
      return {
        enterprise: { sessions: [], currentSessionId: null },
        worker: { sessions: [], currentSessionId: null }
      }
    }
  }

  saveToStorage() {
    const mode = this.state.assistantMode
    const data = {
      sessions: this.state.sessions.slice(0, MAX_SESSIONS).map(session => ({
        ...session,
        messages: session.messages.slice(-MAX_MESSAGES_PER_SESSION)
      })),
      currentSessionId: this.state.currentSessionId
    }
    this.modeStorage = {
      ...this.modeStorage,
      [mode]: data
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.modeStorage))
  }

  createNewSession() {
    const newSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [
        {
          role: 'assistant',
          content: this.getWelcomeMessage(),
          time: Date.now()
        }
      ],
      updatedAt: Date.now()
    }
    this.state.sessions.unshift(newSession)
    this.state.currentSessionId = newSession.id
  }

  switchSession(id) {
    if (this.state.currentSessionId !== id) {
      this.state.currentSessionId = id
    }
  }

  deleteSession(id) {
    const index = this.state.sessions.findIndex(session => session.id === id)
    if (index > -1) {
      this.state.sessions.splice(index, 1)
      if (this.state.currentSessionId === id) {
        this.state.currentSessionId = this.state.sessions[0]?.id || null
        if (!this.state.currentSessionId) this.createNewSession()
      }
    }
  }

  getCurrentSession() {
    return this.state.sessions.find(session => session.id === this.state.currentSessionId)
  }

  deleteMessage(index) {
    const session = this.getCurrentSession()
    if (session && session.messages[index]) {
      session.messages.splice(index, 1)
    }
  }

  retryMessageAt(index) {
    const session = this.getCurrentSession()
    const target = session?.messages[index]
    if (!session || !target || target.role !== 'user') return

    session.messages.splice(index + 1)
    this.sendMessage(target.content, { isRetry: true })
  }

  toggleWindow() {
    this.state.isOpen = !this.state.isOpen
  }

  openWindow() {
    this.state.isOpen = true
  }

  closeWindow() {
    this.state.isOpen = false
  }

  setMode(mode) {
    if (!mode || this.state.assistantMode === mode) {
      return
    }

    this.saveToStorage()
    this.state.assistantMode = mode
    const modeData = this.modeStorage?.[mode] || { sessions: [], currentSessionId: null }
    this.state.sessions = modeData.sessions || []
    this.state.currentSessionId = modeData.currentSessionId || null

    if (this.state.sessions.length === 0) {
      this.createNewSession()
    } else if (!this.state.currentSessionId) {
      this.state.currentSessionId = this.state.sessions[0].id
    }
  }

  getSystemPrompt() {
    if (this.state.assistantMode === 'worker') {
      return `你是企业一线员工的工作助手，帮助他们把杂乱的数据整理成能录入系统的内容，并用通俗易懂的语言解释。请避免复杂术语，回答要简单、清晰、一步一步。\n\n【工作目标】\n1. 帮用户整理表格、图片、文字里的数据，输出规范字段。\n2. 帮用户查询/解释表格数据，直接给结论和下一步操作。\n3. 如果用户要填表，请给出清晰的字段清单和示例。\n4. 默认不输出图表，只有在用户明确要求图表时才输出。\n\n【回答风格】\n- 用短句、通俗话。\n- 能一步一步引导最好。\n- 不要使用专业或学术术语。`
    }

    return `你是一名面向中小企业的经营分析助手，精通业务流程梳理、经营指标诊断与数据可视化。你需要输出专业、简洁、结构化的经营报告，并提供可直接渲染的图表或流程图。\n\n【强制输出规则】\n1. 当用户需要统计图表时，必须输出 ECharts JSON 配置，并放在 \`\`\`echarts\`\`\` 代码块内。\n2. 当用户需要流程图时，必须输出 Mermaid 语法，并放在 \`\`\`mermaid\`\`\` 代码块内。\n3. 禁止输出任何 JavaScript 变量或包装（例如 \"var option =\"、\"option =\"）。只允许纯 JSON。\n4. 图表/流程图代码块之外，必须给出业务结论与改进建议。\n5. 输出结构建议：摘要 → 关键指标 → 图表 → 结论 → 建议。\n\n【ECharts 示例】\n\`\`\`echarts\n{\n  \"title\": { \"text\": \"月度收入与成本\" },\n  \"tooltip\": { \"trigger\": \"axis\" },\n  \"legend\": { \"data\": [\"收入\", \"成本\"] },\n  \"xAxis\": { \"type\": \"category\", \"data\": [\"1月\", \"2月\", \"3月\"] },\n  \"yAxis\": { \"type\": \"value\" },\n  \"series\": [\n    { \"name\": \"收入\", \"type\": \"bar\", \"data\": [120, 132, 150] },\n    { \"name\": \"成本\", \"type\": \"bar\", \"data\": [80, 95, 110] }\n  ]\n}\n\`\`\`\n\n【Mermaid 示例】\n\`\`\`mermaid\ngraph TD\n  A[数据采集] --> B[清洗与校验]\n  B --> C[指标计算]\n  C --> D[经营分析]\n  D --> E[报告生成]\n\`\`\`\n\n请严格遵循以上规则。`
  }

  getWelcomeMessage() {
    if (this.state.assistantMode === 'worker') {
      return '你好！我是企业工作助手。把数据、表格或图片发给我，我会帮你整理成能录入系统的内容。'
    }
    return '您好！我是企业经营助手。请上传数据文件，我可以为您生成可视化报表和经营报告。'
  }

  async parseFileContent(file) {
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
          } catch (err) {
            resolve(`[解析错误] ${file.name}`)
          }
        }
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

  async normalizeFileForPayload(file) {
    const raw = file?.raw || file
    if (!raw) return null

    if (file.cachedPayload) {
      return file.cachedPayload
    }

    if (raw instanceof File) {
      const parsed = await this.parseFileContent(raw)
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

  async buildPayloadMessages(messages) {
    const recentMessages = messages.slice(-HISTORY_WINDOW)

    return Promise.all(recentMessages.map(async (message) => {
      const contentParts = []
      if (message.files?.length) {
        for (const file of message.files) {
          const payloadPart = await this.normalizeFileForPayload(file)
          if (payloadPart) contentParts.push(payloadPart)
        }
      }
      if (message.content) {
        contentParts.push({ type: 'text', text: message.content })
      }
      return { role: message.role, content: contentParts }
    }))
  }

  async sendMessage(userText, { isRetry = false } = {}) {
    if ((!userText && this.state.selectedFiles.length === 0) && !isRetry) return
    if (this.state.isLoading) return

    const session = this.getCurrentSession()
    if (!session) return

    if (!isRetry) {
      const userMsg = {
        role: 'user',
        content: userText,
        files: [...this.state.selectedFiles],
        time: Date.now()
      }
      session.messages.push(userMsg)
      if (session.messages.length <= 3) {
        session.title = userText.slice(0, 15) || '数据分析'
      }
    }

    this.state.inputBuffer = ''
    this.state.selectedFiles = []
    this.state.isLoading = true
    this.state.isStreaming = true

    const aiMsg = reactive({ role: 'assistant', content: '', thinking: false, time: Date.now() })
    session.messages.push(aiMsg)

    if (!this.config) await this.loadConfig()
    if (!this.config?.api_key) {
      aiMsg.content = '❌ 未配置 API Key'
      this.state.isLoading = false
      this.state.isStreaming = false
      return
    }

    try {
      const historyWindow = await this.buildPayloadMessages(session.messages)
      const systemContent = this.getSystemPrompt()

      const payload = {
        model: this.config.model || 'glm-4.6v',
        stream: true,
        messages: [{ role: 'system', content: systemContent }, ...historyWindow],
        thinking: { type: 'enabled' }
      }

      const response = await fetch(this.config.api_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`网络错误: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('无可用的流式响应')
      }

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
            const json = JSON.parse(jsonStr)
            const delta = json.choices?.[0]?.delta
            if (delta?.content) {
              aiMsg.content += delta.content
            } else if (json.choices?.[0]?.message?.content) {
              aiMsg.content += json.choices[0].message.content
            }
          } catch (e) {
            console.warn('[AiBridge] SSE Parse Failed', e)
          }
        }
      }
    } catch (e) {
      aiMsg.content += `\n[Error: ${e.message}]`
    } finally {
      this.state.isLoading = false
      this.state.isStreaming = false
      session.updatedAt = Date.now()
    }
  }

  async handleFileSelect(file) {
    if (!file) return
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => this.state.selectedFiles.push({
        type: 'image',
        name: file.name,
        url: reader.result,
        raw: file
      })
    } else {
      this.state.selectedFiles.push({ type: 'file', name: file.name, url: null, raw: file })
    }
  }
}

export const aiBridge = new AiBridge()
