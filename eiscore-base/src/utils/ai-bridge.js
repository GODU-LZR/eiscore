import { reactive, watch } from 'vue'
import request from '@/utils/request'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const STORAGE_KEY = 'eis_ai_history_v3' // 升级 Key，避免旧缓存污染

/**
 * AI Bridge - 智能文件解析与多模态总线
 * 职责：
 * 1. 管理会话 (Session)
 * 2. 处理多模态文件 (图片Base64 / 文档内容解析)
 * 3. 对接大模型 (流式传输)
 */
class AiBridge {
  constructor() {
    this.actions = null 
    this.config = null
    
    // 从本地加载历史
    const savedData = this.loadFromStorage()

    this.state = reactive({
      isOpen: false,
      isLoading: false,
      isStreaming: false, 
      currentContext: null,
      
      // 会话管理
      sessions: savedData.sessions || [], 
      currentSessionId: savedData.currentSessionId || null,
      
      // 输入暂存
      inputBuffer: '',
      // 选中的文件：{ type: 'image'|'file', name: string, url: string, raw: File }
      selectedFiles: [] 
    })

    // 初始化默认会话
    if (this.state.sessions.length === 0) {
      this.createNewSession()
    } else if (!this.state.currentSessionId) {
      this.state.currentSessionId = this.state.sessions[0].id
    }

    // 自动持久化
    watch(() => [this.state.sessions, this.state.currentSessionId], () => {
      this.saveToStorage()
    }, { deep: true })
  }

  // --- 初始化与配置 ---

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

  // --- 会话管理 ---

  loadFromStorage() {
    try {
      const json = localStorage.getItem(STORAGE_KEY)
      return json ? JSON.parse(json) : { sessions: [], currentSessionId: null }
    } catch {
      return { sessions: [], currentSessionId: null }
    }
  }

  saveToStorage() {
    // 存储压缩：只存最近20个会话，每个会话最近50条消息
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
        { role: 'assistant', content: '您好！我是 EIS 智能助手。请上传 Excel/Word 文件进行分析，或直接提问。', time: Date.now() }
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

  // --- 核心：智能文件解析 ---
  // 将文件对象转换为 AI 可理解的文本或 Base64
  async parseFileContent(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      // 1. Excel 文件 (.xlsx, .xls) -> CSV 文本
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsArrayBuffer(file)
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result)
            const workbook = XLSX.read(data, { type: 'array' })
            // 读取第一个 Sheet
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            // 转为 CSV 格式 (比 JSON 更省 Token 且对 LLM 友好)
            const csv = XLSX.utils.sheet_to_csv(worksheet)
            resolve(`[Excel文件内容: ${file.name}]\n${csv}\n`)
          } catch (err) {
            console.error('Excel parse error:', err)
            resolve(`[解析失败: ${file.name}] 无法读取 Excel 内容`)
          }
        }
      }
      // 2. Word 文件 (.docx) -> 纯文本
      else if (file.name.endsWith('.docx')) {
        reader.readAsArrayBuffer(file)
        reader.onload = (e) => {
          mammoth.extractRawText({ arrayBuffer: e.target.result })
            .then(result => resolve(`[Word文件内容: ${file.name}]\n${result.value}\n`))
            .catch(err => {
              console.error('Word parse error:', err)
              resolve(`[解析失败: ${file.name}] 无法读取 Word 内容`)
            })
        }
      }
      // 3. 图片文件 -> Base64 URL (不转文本，直接返回对象供 payload 使用)
      else if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file)
        reader.onload = () => resolve({ type: 'image', url: reader.result, name: file.name })
      }
      // 4. 其他文本文件 (txt, md, json, js, etc.) -> 纯文本
      else {
        // 简单限制大小，防止过大文件卡死
        if (file.size > 2 * 1024 * 1024) {
          resolve(`[文件跳过: ${file.name}] 文件过大(>2MB)，请只上传关键内容。`)
          return
        }
        reader.readAsText(file)
        reader.onload = () => resolve(`[文本文件内容: ${file.name}]\n${reader.result}\n`)
        reader.onerror = () => resolve(`[读取失败: ${file.name}]`)
      }
    })
  }

  // --- 发送消息逻辑 ---

  async sendMessage(userText, isRetry = false) {
    if ((!userText && this.state.selectedFiles.length === 0) && !isRetry) return
    if (this.state.isLoading) return

    const session = this.getCurrentSession()
    if (!session) return

    // 1. 处理用户消息
    if (!isRetry) {
      const userMsg = { 
        role: 'user', 
        content: userText, 
        files: [...this.state.selectedFiles], // 快照
        time: Date.now() 
      }
      session.messages.push(userMsg)
      
      // 更新标题
      if (session.messages.length <= 3) {
        session.title = userText.slice(0, 15) || '文件分析'
      }
    }

    // 重置输入状态
    this.state.inputBuffer = ''
    this.state.selectedFiles = []
    this.state.isLoading = true
    this.state.isStreaming = true

    // 2. 预备 AI 消息
    const aiMsg = reactive({ role: 'assistant', content: '', thinking: false, time: Date.now() })
    session.messages.push(aiMsg)

    // 3. 检查配置
    if (!this.config) await this.loadConfig()
    if (!this.config || !this.config.api_key) {
      aiMsg.content = '❌ 系统未配置 AI API Key，请联系管理员。'
      this.state.isLoading = false
      this.state.isStreaming = false
      return
    }

    try {
      // 4. 构建上下文 (解析文件内容)
      // 我们只取最近 5 条消息以节省 Token，但确保包含当前这条
      const historyWindow = await Promise.all(session.messages.slice(-5).map(async m => {
        const contentParts = []
        
        // 如果消息包含文件，先解析文件内容
        if (m.files && m.files.length > 0) {
           for (const f of m.files) {
             // 传入 raw File 对象 (如果已存盘可能没有 raw，需要兼容逻辑)
             const fileObj = f.raw || f 
             // 这里做一个容错：如果 f 已经是持久化的对象且没有 raw，我们无法重新解析内容
             // 但如果是持久化的文本文件，我们假设内容不需要重新读取(太复杂)，暂只处理新上传的
             // 实际生产中应把解析后的内容存入 messages，这里为了简化，我们每次实时解析新上传的
             if (f.raw) {
                const parsed = await this.parseFileContent(f.raw)
                if (typeof parsed === 'string') {
                  contentParts.push({ type: "text", text: parsed })
                } else if (parsed.type === 'image') {
                  contentParts.push({ type: "image_url", image_url: { url: parsed.url } })
                }
             } else if (f.type === 'image') {
                // 旧图片，直接用 url
                contentParts.push({ type: "image_url", image_url: { url: f.url } })
             }
           }
        }
        
        if (m.content) {
          contentParts.push({ type: "text", text: m.content })
        }
        return { role: m.role, content: contentParts }
      }))

      // 5. 增强型 System Prompt (JSON 约束)
      let systemContent = `你是一个高级数据分析师。
【重要规则】
1. 如果用户要求画图（统计图、饼图、柱状图等），你必须返回 **标准的 ECharts JSON 配置项**。
   - 必须使用 \`\`\`echarts\n{ ... }\n\`\`\` 包裹 JSON。
   - JSON 必须包含 \`tooltip\`, \`legend\`, \`series\`, \`xAxis\`, \`yAxis\` 等必要字段。
   - **严禁** 在 JSON 代码块外部添加 "var option =" 或其他 JavaScript 语法。
2. 如果是流程图，请使用 \`\`\`mermaid\n...\n\`\`\`。
3. 对于 Excel/Word 数据，请深入分析并给出见解。
4. 保持回答简洁专业。`

      if (this.state.currentContext) {
        systemContent += `\n当前页面上下文: App=${this.state.currentContext.app}, Page=${this.state.currentContext.page}`
      }

      const payload = {
        model: this.config.model || "glm-4.6v",
        stream: true,
        messages: [
          { role: "system", content: systemContent },
          ...historyWindow
        ],
        thinking: { type: "enabled" }
      }

      // 6. 发起流式请求
      const response = await fetch(this.config.api_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`API Error ${response.status}: ${errText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6)
            if (jsonStr.trim() === '[DONE]') continue
            
            try {
              const json = JSON.parse(jsonStr)
              const delta = json.choices[0].delta
              if (delta.content) {
                aiMsg.content += delta.content
              }
              // 处理 reasoning_content (如果需要显示思考过程)
            } catch (e) { /* partial json ignored */ }
          }
        }
      }

    } catch (e) {
      console.error('[AiBridge] Error:', e)
      aiMsg.content += `\n\n[错误: ${e.message}]`
    } finally {
      this.state.isLoading = false
      this.state.isStreaming = false
      session.updatedAt = Date.now()
    }
  }
  
  // 文件选择处理 (仅做预览准备，不解析内容)
  async handleFileSelect(file) {
    if (!file) return
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        // 保存 raw File 对象用于发送时解析，url 用于预览
        this.state.selectedFiles.push({ type: 'image', name: file.name, url: reader.result, raw: file })
      }
    } else {
      // 文档类，url 为空，依靠 icon 预览
      this.state.selectedFiles.push({ type: 'file', name: file.name, url: null, raw: file })
    }
  }
}

export const aiBridge = new AiBridge()