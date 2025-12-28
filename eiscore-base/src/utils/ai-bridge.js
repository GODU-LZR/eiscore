import { reactive, watch } from 'vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const STORAGE_KEY = 'eis_ai_history_v1'

/**
 * AI Bridge - 增强版全局 AI 总线
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
      isStreaming: false, // 是否正在流式输出
      currentContext: null, // 页面上下文
      
      // 会话管理
      sessions: savedData.sessions || [], 
      currentSessionId: savedData.currentSessionId || null,
      
      // 当前输入暂存
      inputBuffer: '',
      selectedImages: [] // [{ url: 'base64...', file: File }]
    })

    // 如果没有会话，创建一个新的
    if (this.state.sessions.length === 0) {
      this.createNewSession()
    } else if (!this.state.currentSessionId) {
      this.state.currentSessionId = this.state.sessions[0].id
    }

    // 监听状态变化，自动持久化
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
    const data = {
      sessions: this.state.sessions.slice(0, 20), // 只存最近20个会话
      currentSessionId: this.state.currentSessionId
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  createNewSession() {
    const newSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [
        { role: 'assistant', content: '您好！我是 EIS 人工智能助手，请问有什么可以帮您？', time: Date.now() }
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
      // 如果删除了当前会话，切换到其他的
      if (this.state.currentSessionId === id) {
        this.state.currentSessionId = this.state.sessions[0]?.id || null
        if (!this.state.currentSessionId) this.createNewSession()
      }
    }
  }

  getCurrentSession() {
    return this.state.sessions.find(s => s.id === this.state.currentSessionId)
  }

  clearHistory() {
    const session = this.getCurrentSession()
    if (session) {
      session.messages = []
      session.updatedAt = Date.now()
    }
  }

  // --- 核心消息处理 ---

  toggleWindow() {
    this.state.isOpen = !this.state.isOpen
  }

  // 发送消息（支持流式、多模态）
  async sendMessage(userText, isRetry = false) {
    if ((!userText && this.state.selectedImages.length === 0) && !isRetry) return
    if (this.state.isLoading) return

    const session = this.getCurrentSession()
    if (!session) return

    // 1. 处理用户消息
    if (!isRetry) {
      const userMsg = { 
        role: 'user', 
        content: userText, 
        images: [...this.state.selectedImages], // 存储图片副本
        time: Date.now() 
      }
      session.messages.push(userMsg)
      
      // 自动生成标题 (如果是第一条用户消息)
      if (session.messages.length === 2) {
        session.title = userText.slice(0, 10) + (userText.length > 10 ? '...' : '')
      }
    }

    // 清空输入区
    this.state.inputBuffer = ''
    this.state.selectedImages = []
    this.state.isLoading = true
    this.state.isStreaming = true

    // 2. 准备 AI 回复占位符
    const aiMsg = reactive({ role: 'assistant', content: '', thinking: false, time: Date.now() })
    session.messages.push(aiMsg)

    // 3. 加载配置
    if (!this.config) await this.loadConfig()
    if (!this.config || !this.config.api_key) {
      aiMsg.content = '❌ 系统未配置 AI API Key，请联系管理员。'
      this.state.isLoading = false
      this.state.isStreaming = false
      return
    }

    try {
      // 4. 构建上下文 (Context Compression: Sliding Window)
      // 只取最近 10 条消息，避免 Token 溢出
      const historyWindow = session.messages.slice(-11, -1).map(m => {
        const content = []
        // 处理图片多模态格式
        if (m.images && m.images.length > 0) {
           m.images.forEach(img => {
             content.push({ type: "image_url", image_url: { url: img.url } })
           })
        }
        if (m.content) {
          content.push({ type: "text", text: m.content })
        }
        return { role: m.role, content: content }
      })

      // 注入系统级 Prompt
      let systemContent = `你是一个企业级信息系统 (EIS) 的智能助手。请简洁回答。`
      if (this.state.currentContext) {
        systemContent += `\n当前上下文: App=${this.state.currentContext.app}, Page=${this.state.currentContext.page}`
      }

      const payload = {
        model: this.config.model || "glm-4.6v",
        stream: true, // 🟢 开启流式传输
        messages: [
          { role: "system", content: systemContent },
          ...historyWindow
        ],
        thinking: { type: "enabled" }
      }

      // 5. 发起 Fetch 请求
      const response = await fetch(this.config.api_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error(`API Error ${response.status}`)

      // 6. 处理流式响应
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
              // 处理 reasoning_content (思考过程，如果有的话)
              if (delta.reasoning_content) {
                 // 可以在这里处理思考内容的展示，暂时简化为追加
                 // aiMsg.thinking = true ...
              }
            } catch (e) {
              // 忽略解析错误 (可能是不完整的 chunk)
            }
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
  
  // 图片处理辅助
  async handleFileSelect(file) {
    if (!file) return
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      this.state.selectedImages.push({
        url: reader.result,
        file: file
      })
    }
  }
}

export const aiBridge = new AiBridge()