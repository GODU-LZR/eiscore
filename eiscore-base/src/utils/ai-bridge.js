import { reactive, watch } from 'vue'
import request from '@/utils/request'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const STORAGE_KEY = 'eis_ai_history_v5'
const MAX_SESSIONS = 20
const MAX_MESSAGES_PER_SESSION = 50
const HISTORY_WINDOW = 8
const CODE_FENCE = '```'

/**
 * AI Bridge - 智能文件解析与多模态总线
 */
class AiBridge {
  constructor() {
    this.actions = null
    this.config = null
    this.lastCommandId = null
    this.eventBound = false

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

    this.bindWindowEvents()
  }

  initActions(actions) {
    this.actions = actions
    if (this.actions) {
      this.actions.onGlobalStateChange((state) => {
        if (state && state.context) {
          this.state.currentContext = state.context
        }
        if (state && state.command) {
          this.handleCommand(state.command)
        }
      }, true)
    }
  }

  bindWindowEvents() {
    if (this.eventBound || typeof window === 'undefined') return
    this.eventBound = true
    window.addEventListener('eis-ai-command', (event) => {
      const cmd = event?.detail
      if (cmd) this.handleCommand(cmd)
    })
    window.addEventListener('eis-ai-context', (event) => {
      const ctx = event?.detail
      if (ctx) this.state.currentContext = ctx
    })
  }

  handleCommand(command) {
    if (!command || !command.id) return
    if (this.lastCommandId === command.id) return
    this.lastCommandId = command.id

    if (command.type === 'open-worker') {
      this.setMode('worker')
      this.openWindow()
      if (typeof command.prompt === 'string' && command.prompt.trim()) {
        this.sendMessage(command.prompt)
      }
    }
  }

  async loadConfig() {
    if (this.config) return
    try {
      const res = await request({
        url: '/agent/ai/config',
        method: 'get',
        headers: { 'Accept': 'application/json' }
      })
      if (res && typeof res === 'object') {
        this.config = res
      }
    } catch (e) {
      console.error('[AiBridge] Config Load Failed', e)
    }
  }

  getAuthToken() {
    const tokenStr = localStorage.getItem('auth_token')
    if (!tokenStr) return ''
    try {
      const parsed = JSON.parse(tokenStr)
      if (parsed?.token) return parsed.token
    } catch (e) {
      // ignore
    }
    return tokenStr
  }

  buildAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' }
    const token = this.getAuthToken()
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  loadFromStorage() {
    const fallback = {
      enterprise: { sessions: [], currentSessionId: null },
      worker: { sessions: [], currentSessionId: null }
    }
    try {
      const json = localStorage.getItem(STORAGE_KEY)
      if (!json) return fallback
      const parsed = JSON.parse(json)
      return {
        enterprise: parsed.enterprise || fallback.enterprise,
        worker: parsed.worker || fallback.worker
      }
    } catch {
      return fallback
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

  resetTransientState() {
    this.state.inputBuffer = ''
    this.state.selectedFiles = []
    this.state.isLoading = false
    this.state.isStreaming = false
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
    this.resetTransientState()
    this.state.isOpen = false

    if (this.state.sessions.length === 0) {
      this.createNewSession()
    } else if (!this.state.currentSessionId) {
      this.state.currentSessionId = this.state.sessions[0].id
    }
  }

  getSystemPrompt() {
    const fence = CODE_FENCE
    if (this.state.assistantMode === 'worker') {
      const context = this.state.currentContext || {}
      const allowFormula = context?.allowFormula === true || context?.allowFormulaOnce === true || ['column_formula', 'summary_formula', 'formula', 'summary'].includes(context?.aiScene)
      const allowImport = context?.allowImport === true || !!context?.importTarget
      const materialsDepth = Number(context?.materialsCategoryDepth || 2) === 3 ? 3 : 2

      const dataRuleBlock = context?.dataStats
        ? `【数据回答规则】\n1. 当用户问“人数/数量/统计”时，必须用上下文 dataStats 直接给答案。\n2. 不要用公式代替结果，不要只给计算方法。\n3. 如果 dataStats 有 totalCount，直接回答“当前人数 = totalCount”。\n4. 可以结合 statusCounts / departmentCounts 说明分布。\n`
        : `【数据回答规则】\n如果用户问人数或统计，但上下文没有 dataStats，请说明“当前没有统计数据”，提示用户刷新表格或重新进入页面后再问。\n`

      const formulaRuleBlock = allowFormula
        ? `【公式输出规则】\n当用户要求生成/优化/校验“公式/计算/合计”时，必须只输出 ${fence}formula${fence} 代码块，内容为可直接写入系统的表达式，例如 {工资}+{绩效}，不要附加解释。\n`
        : `【公式输出规则】\n除非明确处于“计算列/合计行”配置场景，否则不要输出公式代码块。若用户仍要求公式，请提示在“计算列/合计行”里使用 AI 公式功能。\n`

      const importRuleBlock = allowImport
        ? `【表格导入规则】\n当用户要求导入 Excel/表格到系统时，必须输出 ${fence}data-import${fence} 代码块，格式如下：\n${fence}data-import\n{\n  \"rows\": [\n    { \"name\": \"张三\", \"employee_no\": \"EMP001\", \"field_1234\": \"100\" }\n  ]\n}\n${fence}\n字段名必须使用当前上下文中的列 prop；如果不确定，可使用列的 label，但要尽量匹配。\n`
        : `【表格导入规则】\n当前场景不支持导入表格数据。\n`

      const materialsRuleBlock = `【物料分类规则】\n当用户要求“创建/导入/整理物料分类”时：\n1. 只输出 ${fence}materials-categories${fence} 代码块。\n2. 结构是 JSON 数组，元素包含 {\"label\":\"原材料\",\"children\":[]}。\n3. 只输出名称，禁止输出 id/编码，系统会按顺序自动生成编码，避免重复。\n4. 层级最多 ${materialsDepth} 级；超过请合并或忽略。\n5. 若导入物料台账数据，category 字段可填“分类名称或名称链路(用-连接)”，系统会自动映射为编码。\n`

      const workflowRuleBlock = `【流程输出规则】\n当用户描述“流程/审批/办理路径/节点流转/业务流程”等需求时：\n1. 必须同时输出 Mermaid 流程图，放在 ${fence}mermaid${fence} 代码块。\n2. 必须输出 BPMN XML，放在 ${fence}bpmn-xml${fence} 代码块。\n3. 必须输出流程元信息，放在 ${fence}workflow-meta${fence} 代码块，格式：\n${fence}workflow-meta\n{\n  \"name\": \"流程名称\",\n  \"associated_table\": \"public.raw_materials\"\n}\n${fence}\n4. BPMN XML 中必须包含 startEvent、userTask、endEvent。\n5. 节点命名使用中文，ID 使用英文下划线。\n6. 若用户未指定关联表，associated_table 留空字符串。\n`

      return `你是企业一线员工的工作助手，帮助他们把杂乱的数据整理成能录入系统的内容，并用通俗易懂的语言解释。请避免复杂术语，回答要简单、清晰、一步一步。\n\n【工作目标】\n1. 帮用户整理表格、图片、文字里的数据，输出规范字段。\n2. 帮用户查询/解释表格数据，直接给结论和下一步操作。\n3. 如果用户要填表，请给出清晰的字段清单和示例。\n4. 默认不输出图表，只有在用户明确要求图表时才输出。\n\n${dataRuleBlock}\n${materialsRuleBlock}\n${workflowRuleBlock}\n【表单模板输出规则】\n当用户要求“生成表单/模板/单据/拍照识别表单”等需求时，你必须输出模板 JSON，并放在 ${fence}form-template${fence} 代码块中。不要添加多余说明。\n模板 JSON 结构要求：\n${fence}form-template\n{\n  \"docType\": \"employee_profile\",\n  \"title\": \"员工详细档案表\",\n  \"docNo\": \"employee_no\",\n  \"layout\": [\n    {\n      \"type\": \"section\",\n      \"title\": \"基本信息\",\n      \"cols\": 2,\n      \"children\": [\n        { \"label\": \"姓名\", \"field\": \"name\", \"widget\": \"input\" },\n        { \"label\": \"身份证号\", \"field\": \"id_card\", \"widget\": \"input\" },\n        { \"label\": \"照片\", \"field\": \"id_photo\", \"widget\": \"image\", \"fileSource\": \"field_1001\" }\n      ]\n    },\n    {\n      \"type\": \"table\",\n      \"title\": \"工作履历\",\n      \"field\": \"work_history\",\n      \"columns\": [\n        { \"label\": \"公司名称\", \"field\": \"company\" },\n        { \"label\": \"职位\", \"field\": \"position\" },\n        { \"label\": \"开始时间\", \"field\": \"start_date\" },\n        { \"label\": \"结束时间\", \"field\": \"end_date\" }\n      ]\n    }\n  ]\n}\n${fence}\n字段说明：\n- widget 可选：text/input/textarea/date/number/image/select/cascader。\n- 当字段类型是 select/cascader 时，优先使用对应 widget，并可附带 options / cascaderOptions。\n- image 字段可选 fileSource，值为文件列 prop，用于提示从哪个文件列选图。\n- table 用于多行表格区，field 对应一个数组字段。\n- 若表单字段在系统列里不存在，请仍给出 field（后端会保存到扩展字段表）。\n- 所有 label 必须中文，输出内容要正规、简洁。\n\n${formulaRuleBlock}\n${importRuleBlock}\n【回答风格】\n- 用短句、通俗话。\n- 能一步一步引导最好。\n- 不要使用专业或学术术语。`
    }

    return `你是一名面向中小企业的经营分析助手，精通业务流程梳理、经营指标诊断与数据可视化。你需要输出专业、简洁、结构化的经营报告，并提供可直接渲染的图表或流程图。\n\n【强制输出规则】\n1. 当用户需要统计图表时，必须输出 ECharts JSON 配置，并放在 ${fence}echarts${fence} 代码块内。\n2. 当用户需要流程图时，必须输出 Mermaid 语法，并放在 ${fence}mermaid${fence} 代码块内。\n3. 当用户需要“流程落地/审批流/业务流程”时，必须额外输出 ${fence}bpmn-xml${fence} 与 ${fence}workflow-meta${fence} 代码块。\n4. 禁止输出任何 JavaScript 变量或包装（例如 \"var option =\"、\"option =\"）。只允许纯 JSON。\n5. 图表/流程图代码块之外，必须给出业务结论与改进建议。\n6. 输出结构建议：摘要 → 关键指标 → 图表 → 结论 → 建议。\n\n【ECharts 示例】\n${fence}echarts\n{\n  \"title\": { \"text\": \"月度收入与成本\" },\n  \"tooltip\": { \"trigger\": \"axis\" },\n  \"legend\": { \"data\": [\"收入\", \"成本\"] },\n  \"xAxis\": { \"type\": \"category\", \"data\": [\"1月\", \"2月\", \"3月\"] },\n  \"yAxis\": { \"type\": \"value\" },\n  \"series\": [\n    { \"name\": \"收入\", \"type\": \"bar\", \"data\": [120, 132, 150] },\n    { \"name\": \"成本\", \"type\": \"bar\", \"data\": [80, 95, 110] }\n  ]\n}\n${fence}\n\n【Mermaid 示例】\n${fence}mermaid\ngraph TD\n  A[数据采集] --> B[清洗与校验]\n  B --> C[指标计算]\n  C --> D[经营分析]\n  D --> E[报告生成]\n${fence}\n\n请严格遵循以上规则。`
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

  async sendMessage(userText, { isRetry = false, silentRetryCount = 0 } = {}) {
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

    const aiMsg = reactive({ role: 'assistant', content: '', thinking: false, time: Date.now(), agent: '' })
    session.messages.push(aiMsg)

    if (!this.config) await this.loadConfig()
    let silentRetryNeeded = false
    try {
      const historyWindow = await this.buildPayloadMessages(session.messages)
      const contextPayload = this.state.currentContext
      if (contextPayload?.allowFormulaOnce) {
        contextPayload.allowFormulaOnce = false
      }

      const payload = {
        model: this.config?.model || 'glm-4.6v',
        stream: true,
        assistant_mode: this.state.assistantMode,
        context: contextPayload || null,
        messages: historyWindow,
        thinking: { type: 'enabled' }
      }

      const response = await fetch('/agent/ai/chat/completions', {
        method: 'POST',
        headers: this.buildAuthHeaders(),
        body: JSON.stringify(payload)
      })
      const routedAgent = response.headers.get('x-eis-ai-agent')
      if (routedAgent) {
        aiMsg.agent = routedAgent
      }

      if (!response.ok) {
        let detail = ''
        try {
          const text = await response.text()
          detail = String(text || '').slice(0, 180)
        } catch {}
        const error = new Error(`网络错误: ${response.status}${detail ? ` ${detail}` : ''}`)
        error.status = response.status
        throw error
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
      const message = String(e?.message || '')
      const status = Number(e?.status || 0)
      const isTransientStatus = [429, 500, 502, 503, 504].includes(status)
      const isTransientStreamError = /input stream|networkerror|failed to fetch|stream|网络错误:\s*(429|500|502|503|504)/i.test(message.toLowerCase()) || isTransientStatus
      if (silentRetryCount < 2 && isTransientStreamError) {
        silentRetryNeeded = true
        const idx = session.messages.indexOf(aiMsg)
        if (idx >= 0) session.messages.splice(idx, 1)
      } else {
        aiMsg.content += `\n[Error: ${message || 'Unknown Error'}]`
      }
    } finally {
      this.state.isLoading = false
      this.state.isStreaming = false
      session.updatedAt = Date.now()
    }

    if (silentRetryNeeded) {
      const waitMs = 220 * (silentRetryCount + 1)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      return this.sendMessage(userText, { isRetry: true, silentRetryCount: silentRetryCount + 1 })
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










