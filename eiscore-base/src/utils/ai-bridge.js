import { reactive } from 'vue'
import request from '@/utils/request' // 🟢 使用项目封装的 request (axios)

/**
 * AI Bridge - 全局 AI 总线控制器
 * 职责：
 * 1. 管理 Qiankun GlobalState (上下文通讯)
 * 2. 对接 PostgREST 获取系统配置 (API Key)
 * 3. 对接智谱 AI GLM-4.6V 接口
 */
class AiBridge {
  constructor() {
    this.actions = null 
    this.config = null
    this.state = reactive({
      isOpen: false,
      messages: [
        { role: 'assistant', content: '您好！我是 EISCore 智能助手。我可以帮您查询数据、生成图表或修改表单配置。' }
      ],
      isLoading: false,
      currentContext: null 
    })
  }

  // 初始化 Qiankun Actions
  initActions(actions) {
    this.actions = actions
    // 监听子应用发来的上下文更新
    if (this.actions) {
      this.actions.onGlobalStateChange((state) => {
        if (state && state.context) {
          this.state.currentContext = state.context
        }
      }, true)
    }
  }

  // 加载配置
  async loadConfig() {
    try {
      console.log('[AiBridge] 正在加载 AI 配置...')
      // 🟢 核心修改：统一使用 /api 前缀
      // Vite 代理会将 /api/system_configs 重写为 /system_configs 并转发给 PostgREST
      const res = await request({
        url: '/api/system_configs?key=eq.ai_glm_config', 
        method: 'get',
        headers: { 
          'Accept': 'application/json',
          'Accept-Profile': 'public' // 显式指定 public schema
        }
      })
      
      // 兼容处理：request 封装可能返回 res.data 或者直接返回 res
      const data = Array.isArray(res) ? res : (res.data || [])

      if (data && data.length > 0) {
        this.config = data[0].value
        console.log('[AiBridge] AI 配置加载成功:', this.config.model)
      } else {
        console.warn('[AiBridge] 数据库中未找到 ai_glm_config 配置，请检查 system_configs 表。')
        this.addMessage('system', '警告：系统未配置 AI 模型参数。')
      }
    } catch (e) {
      console.error('[AiBridge] 加载配置失败:', e)
      this.addMessage('system', `错误：无法连接配置接口 (${e.message})。请检查网络或代理配置。`)
    }
  }

  toggleWindow() {
    this.state.isOpen = !this.state.isOpen
  }

  addMessage(role, content) {
    this.state.messages.push({ role, content })
  }

  // 发送消息到智谱 GLM-4.6V
  async sendMessage(userText) {
    if (!userText.trim()) return
    
    this.addMessage('user', userText)
    this.state.isLoading = true

    // 懒加载配置：如果还没有配置，先去拉取
    if (!this.config || !this.config.api_key) {
      await this.loadConfig()
      if (!this.config) {
        this.state.isLoading = false
        this.addMessage('assistant', '抱歉，系统尚未配置 AI Key，无法响应。')
        return
      }
    }

    try {
      // 构造 System Prompt，注入当前页面上下文
      let systemPrompt = `你是一个企业级信息系统 (EISCore) 的智能助手。
你的目标是协助用户管理数据、生成表单配置或导航系统。
请以 JSON 或 简洁的中文 回复。`

      if (this.state.currentContext) {
        systemPrompt += `\n\n【当前页面上下文】：
App: ${this.state.currentContext.app}
Page: ${this.state.currentContext.page}
Data Schema: ${JSON.stringify(this.state.currentContext.data?.schema || {})}
`
      }

      // 构建请求体
      const payload = {
        model: this.config.model || "glm-4.6v",
        messages: [
          { role: "system", content: systemPrompt },
          ...this.state.messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content
          }))
        ],
        thinking: {
          type: "enabled" // 启用深度思考
        }
      }

      // 🟢 调用智谱 API
      // 这里直接使用 fetch 调用外部接口，不走 /api 代理（因为是跨域的第三方服务）
      // 如果浏览器报 CORS 跨域错误，则需要在 vite.config.js 再配一个 /zhipu-api 的代理
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

      const resJson = await response.json()
      const aiContent = resJson.choices[0].message.content
      
      this.addMessage('assistant', aiContent)

    } catch (e) {
      console.error('[AiBridge] 调用 AI 失败:', e)
      this.addMessage('assistant', `抱歉，遇到了一些问题：${e.message}`)
    } finally {
      this.state.isLoading = false
    }
  }
}

// 导出单例
export const aiBridge = new AiBridge()