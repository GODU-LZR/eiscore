import { reactive, watch } from 'vue'
import request from '@/utils/request'

const STORAGE_KEY = 'eis_ai_history_v2' // 升级存储 Key 以免旧数据冲突

/**
 * AI Bridge - 增强版全局 AI 总线 (支持多模态文件与图表)
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
      
      // 输入暂存 (支持多模态文件)
      inputBuffer: '',
      selectedFiles: [] // Array<{ type: 'image'|'file', name: string, content: string(base64|text), url: string }>
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

  // --- 基础初始化 ---

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
    // 简单压缩：只存最近20个会话，每个会话最多存最近50条
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
        { role: 'assistant', content: '您好！我是 EIS 智能助手。我可以帮您分析数据、绘制流程图或解答问题。', time: Date.now() }
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

  // 删除单条消息
  deleteMessage(index) {
    const session = this.getCurrentSession()
    if (session && session.messages[index]) {
      session.messages.splice(index, 1)
    }
  }

  // --- 核心消息处理 ---

  toggleWindow() {
    this.state.isOpen = !this.state.isOpen
  }

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
        files: [...this.state.selectedFiles], // 保存文件快照
        time: Date.now() 
      }
      session.messages.push(userMsg)
      
      // 更新标题
      if (session.messages.length <= 3) {
        session.title = userText.slice(0, 15) || '文件分析'
      }
    }

    // 清空输入
    this.state.inputBuffer = ''
    this.state.selectedFiles = []
    this.state.isLoading = true
    this.state.isStreaming = true

    // 2. 准备 AI 消息
    const aiMsg = reactive({ role: 'assistant', content: '', thinking: false, time: Date.now() })
    session.messages.push(aiMsg)

    if (!this.config) await this.loadConfig()
    if (!this.config || !this.config.api_key) {
      aiMsg.content = '❌ 系统未配置 AI API Key。'
      this.state.isLoading = false
      this.state.isStreaming = false
      return
    }

    try {
      // 3. 构建上下文 (Context Construction)
      const historyWindow = session.messages.slice(-11, -1).map(m => {
        const contentParts = []
        
        // 处理文件附件
        if (m.files && m.files.length > 0) {
           m.files.forEach(f => {
             if (f.type === 'image') {
               // GLM-4V 支持 Base64 URL
               contentParts.push({ type: "image_url", image_url: { url: f.url } })
             } else if (f.type === 'file') {
               // 文本类文件直接作为上下文注入
               contentParts.push({ type: "text", text: `\n[文件内容: ${f.name}]\n${f.content}\n` })
             }
           })
        }
        
        if (m.content) {
          contentParts.push({ type: "text", text: m.content })
        }
        return { role: m.role, content: contentParts }
      })

      // 系统提示词：增加图表支持说明
      let systemContent = `你是一个企业级信息系统 (EIS) 的智能助手。
请遵循以下规则：
1. 简洁回答。
2. 如果需要画图，请使用 Mermaid 语法 (包裹在 \`\`\`mermaid 代码块中)。
3. 如果需要画统计图 (柱状图/折线图/饼图等)，请输出 ECharts 的 JSON 配置项 (包裹在 \`\`\`echarts 代码块中)。`
      
      if (this.state.currentContext) {
        systemContent += `\n当前上下文: App=${this.state.currentContext.app}, Page=${this.state.currentContext.page}`
      }

      const payload = {
        model: this.config.model || "glm-4.6v",
        stream: true,
        messages: [
          { role: "system", content: systemContent },
          ...historyWindow
        ],
        thinking: { type: "enabled" } // 启用 GLM 深度思考
      }

      // 4. 发起请求
      const response = await fetch(this.config.api_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error(`API Error ${response.status}`)

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
            } catch (e) { /* ignore partial json */ }
          }
        }
      }

    } catch (e) {
      console.error('[AiBridge] Stream Error:', e)
      aiMsg.content += `\n\n[网络错误: ${e.message}]`
    } finally {
      this.state.isLoading = false
      this.state.isStreaming = false
      session.updatedAt = Date.now()
    }
  }
  
  // 文件选择处理 (支持多模态)
  async handleFileSelect(file) {
    if (!file) return
    
    // 图片处理
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        this.state.selectedFiles.push({
          type: 'image',
          name: file.name,
          url: reader.result, // base64
          content: null
        })
      }
    } 
    // 文本/代码文件处理
    else {
      // 限制大小 1MB，防止 Context 溢出
      if (file.size > 1024 * 1024) {
        alert('文本文件不能超过 1MB')
        return
      }
      const reader = new FileReader()
      reader.readAsText(file)
      reader.onload = () => {
        this.state.selectedFiles.push({
          type: 'file',
          name: file.name,
          url: null,
          content: reader.result // 文本内容
        })
      }
    }
  }
}

export const aiBridge = new AiBridge()