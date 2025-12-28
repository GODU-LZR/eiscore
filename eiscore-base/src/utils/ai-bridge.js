import { reactive, watch } from 'vue'
import request from '@/utils/request'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const STORAGE_KEY = 'eis_ai_history_v3'

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
      sessions: this.state.sessions.slice(0, 20).map(s => ({
        ...s,
        messages: s.messages.slice(-50)
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
        { role: 'assistant', content: '您好！我是 EIS 智能助手。请上传 Excel/Word 文件，我可以为您生成可视化报表。', time: Date.now() }
      ],
      updatedAt: Date.now()
    }
    this.state.sessions.unshift(newSession)
    this.state.currentSessionId = newSession.id
  }

  deleteSession(id) {
    const index = this.state.sessions.findIndex(s => s.id === id)
    if (index > -1) {
      this.state.sessions.splice(index, 1)
      if (this.state.currentSessionId === id) {
        this.state.currentSessionId = this.state.sessions[0]?.id || null
        if (!this.state.currentSessionId) this.createNewSession()
      }
    }
  }

  getCurrentSession() {
    return this.state.sessions.find(s => s.id === this.state.currentSessionId)
  }

  deleteMessage(index) {
    const session = this.getCurrentSession()
    if (session && session.messages[index]) {
      session.messages.splice(index, 1)
    }
  }

  toggleWindow() {
    this.state.isOpen = !this.state.isOpen
  }

  async parseFileContent(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsArrayBuffer(file)
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result)
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
        reader.onload = (e) => {
          mammoth.extractRawText({ arrayBuffer: e.target.result })
            .then(res => resolve(`[Word文档: ${file.name}]\n${res.value}\n`))
            .catch(() => resolve(`[解析错误] ${file.name}`))
        }
      } else if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file)
        reader.onload = () => resolve({ type: 'image', url: reader.result, name: file.name })
      } else {
        if (file.size > 2 * 1024 * 1024) { resolve(`[跳过] 文件过大: ${file.name}`); return }
        reader.readAsText(file)
        reader.onload = () => resolve(`[文本数据: ${file.name}]\n${reader.result}\n`)
      }
    })
  }

  async sendMessage(userText, isRetry = false) {
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
      if (session.messages.length <= 3) session.title = userText.slice(0, 15) || '数据分析'
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
      this.state.isLoading = false; this.state.isStreaming = false; return
    }

    try {
      const historyWindow = await Promise.all(session.messages.slice(-5).map(async m => {
        const contentParts = []
        if (m.files?.length) {
           for (const f of m.files) {
             const raw = f.raw || f
             if (raw.raw || raw instanceof File) {
                const parsed = await this.parseFileContent(raw.raw || raw)
                if (typeof parsed === 'string') contentParts.push({ type: "text", text: parsed })
                else if (parsed.type === 'image') contentParts.push({ type: "image_url", image_url: { url: parsed.url } })
             } else if (f.type === 'image') {
                contentParts.push({ type: "image_url", image_url: { url: f.url } })
             }
           }
        }
        if (m.content) contentParts.push({ type: "text", text: m.content })
        return { role: m.role, content: contentParts }
      }))

      let systemContent = `你是一个数据可视化专家。
【强制输出规则】
1. 当用户需要图表时，你必须输出 ECharts JSON 配置。
2. 格式必须严格如下：
\`\`\`echarts
{
  "title": { "text": "标题" },
  "tooltip": { "trigger": "axis" },
  "legend": { "data": ["系列1"] },
  "xAxis": { "type": "category", "data": ["A", "B"] },
  "yAxis": { "type": "value" },
  "series": [{ "name": "系列1", "type": "bar", "data": [10, 20] }]
}
\`\`\`
3. **严禁**使用 JavaScript 变量（如 "var option ="）。只允许纯 JSON。
4. 如果是流程图，请使用 \`\`\`mermaid\`\`\`。
5. 即使数据来自 Excel，也要提取数据并生成上述 JSON。`

      const payload = {
        model: this.config.model || "glm-4.6v",
        stream: true,
        messages: [{ role: "system", content: systemContent }, ...historyWindow],
        thinking: { type: "enabled" }
      }

      const response = await fetch(this.config.api_url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.config.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            if (jsonStr === '[DONE]') continue
            try {
              const json = JSON.parse(jsonStr)
              const delta = json.choices[0].delta
              if (delta.content) aiMsg.content += delta.content
            } catch (e) {}
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
      reader.onload = () => this.state.selectedFiles.push({ type: 'image', name: file.name, url: reader.result, raw: file })
    } else {
      this.state.selectedFiles.push({ type: 'file', name: file.name, url: null, raw: file })
    }
  }
}

export const aiBridge = new AiBridge()