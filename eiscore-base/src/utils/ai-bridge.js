import { reactive, watch } from 'vue'
import request from '@/utils/request'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const STORAGE_KEY = 'eis_ai_history_v4'
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

    this.state = reactive({
      isOpen: false,
      isWide: false,
      isLoading: false,
      isStreaming: false,
      currentContext: null,
      sessions: savedData.sessions || [],
      currentSessionId: savedData.currentSessionId || null,
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
      return json ? JSON.parse(json) : { sessions: [], currentSessionId: null }
    } catch {
      return { sessions: [], currentSessionId: null }
    }
  }

  saveToStorage() {
    const data = {
      sessions: this.state.sessions.slice(0, MAX_SESSIONS).map(session => ({
        ...session,
        messages: session.messages.slice(-MAX_MESSAGES_PER_SESSION)
      })),
      currentSessionId: this.state.currentSessionId
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  createNewSession() {
    const newSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [
        {
          role: 'assistant',
          content: '您好！我是 EIS 智能助手。请上传数据文件，我可以为您生成可视化报表。',
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

  toggleWide() {
    this.state.isWide = !this.state.isWide
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

      const systemContent = `你是一名精通业务流程与数据分析的中小型企业数字化助手，能够生成图文并茂的经营报告。\n\n【强制输出规则】\n1. 当用户需要图表时，必须输出 ECharts JSON 配置。\n2. 格式必须严格如下：\n\`\`\`echarts\n{\n  "title": { "text": "标题" },\n  "tooltip": { "trigger": "axis" },\n  "legend": { "data": ["系列1"] },\n  "xAxis": { "type": "category", "data": ["A", "B"] },\n  "yAxis": { "type": "value" },\n  "series": [{ "name": "系列1", "type": "bar", "data": [10, 20] }]\n}\n\`\`\`\n3. 严禁输出 JavaScript 变量或配置包装（例如 \"var option =\"）。\n4. 如果是流程图，请使用 \`\`\`mermaid\`\`\`。\n5. 即使数据来自 Excel/Word/文本，也要提取数据后生成上述 JSON。\n6. 文本输出需包含业务结论与建议，突出关键指标。`

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