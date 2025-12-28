import { reactive } from 'vue'
import axios from 'axios' // 🟢 改用 axios 或封装的 request

/**
 * AI Bridge - 全局 AI 总线控制器
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

  // 🟢 核心修复：加载配置
  async loadConfig() {
    try {
      // 参考 useGridFormula 的请求格式
      // 注意：这里假设 vite.config.js 已经代理了 /system_configs -> PostgREST
      const response = await axios({
        url: '/system_configs?key=eq.ai_glm_config',
        method: 'get',
        headers: { 
          'Accept': 'application/json',
          // 如果 PostgREST 需要指定 schema，可以加这个，通常默认为 public
          // 'Accept-Profile': 'public' 
        }
      })
      
      const data = response.data
      if (data && data.length > 0) {
        this.config = data[0].value
        console.log('[AiBridge] AI 配置加载成功')
      } else {
        console.warn('[AiBridge] 未找到 ai_glm_config 配置')
      }
    } catch (e) {
      console.error('[AiBridge] 加载配置失败:', e)
      this.addMessage('system', '错误：无法加载 AI 系统配置，请确保 system_configs 表存在且 PostgREST 已重启。')
    }
  }

  toggleWindow() {
    this.state.isOpen = !this.state.isOpen
  }

  addMessage(role, content) {
    this.state.messages.push({ role, content })
  }

  async sendMessage(userText) {
    if (!userText.trim()) return
    
    this.addMessage('user', userText)
    this.state.isLoading = true

    if (!this.config || !this.config.api_key) {
      await this.loadConfig()
      if (!this.config) {
        this.state.isLoading = false
        return
      }
    }

    try {
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

      const payload = {
        model: this.config.model || "glm-4.6v",
        messages: [
          { role: "system", content: systemPrompt },
          ...this.state.messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content
          }))
        ],
        thinking: { type: "enabled" }
      }

      // 🟢 调用智谱 API (这是一个外部请求，通常不需要走代理，除非有跨域限制)
      // 如果浏览器报 CORS 错误，您可能需要在 Vite 里再配一个 /zhipu-api 的代理
      const response = await axios({
        url: this.config.api_url, // https://open.bigmodel.cn/api/paas/v4/chat/completions
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        },
        data: payload
      })

      const aiContent = response.data.choices[0].message.content
      this.addMessage('assistant', aiContent)

    } catch (e) {
      console.error('[AiBridge] 调用 AI 失败:', e)
      this.addMessage('assistant', `抱歉，遇到了一些问题：${e.message || '网络错误'}`)
    } finally {
      this.state.isLoading = false
    }
  }
}

export const aiBridge = new AiBridge()