import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setThemeColor } from '@/utils/theme' // 引入工具

export const useSystemStore = defineStore('system', () => {
  const defaultConfig = {
    title: '海边姑娘管理系统',
    themeColor: '#409EFF',
    notifications: true
  }

  // 1. 定义状态
  const config = ref({
    ...defaultConfig
  })

  const getAuthToken = () => {
    const raw = localStorage.getItem('auth_token')
    if (!raw) return ''
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.token) return parsed.token
    } catch (e) {}
    return raw
  }

  // 2. 定义动作
  const updateConfig = (newConfig) => {
    // 如果传入了标题，更新标题
    if (newConfig.title !== undefined) {
      config.value.title = newConfig.title
    }
    
    // 如果传入了颜色，更新颜色并应用样式
    if (newConfig.themeColor) {
      config.value.themeColor = newConfig.themeColor
      setThemeColor(newConfig.themeColor)
    }

    if (newConfig.notifications !== undefined) {
      config.value.notifications = !!newConfig.notifications
    }
  }

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/system_configs?key=eq.app_settings', {
        headers: { 'Accept-Profile': 'public' }
      })
      if (!res.ok) return
      const list = await res.json()
      const row = Array.isArray(list) ? list[0] : null
      if (row?.value && typeof row.value === 'object') {
        const next = { ...defaultConfig, ...row.value }
        updateConfig(next)
      }
    } catch (e) {}
  }

  const saveConfig = async (nextConfig) => {
    const payload = { ...config.value, ...(nextConfig || {}) }
    updateConfig(payload)
    try {
      const token = getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Prefer': 'resolution=merge-duplicates'
      }
      if (token) headers.Authorization = `Bearer ${token}`
      await fetch('/api/system_configs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'app_settings', value: payload, description: '系统全局设置' })
      })
      return true
    } catch (e) {
      return false
    }
  }

  // 3. 初始化动作 (App启动时调用)
  const initTheme = () => {
    if (config.value.themeColor) {
      setThemeColor(config.value.themeColor)
    }
  }

  return { config, updateConfig, loadConfig, saveConfig, initTheme }
}, {
  persist: true // 如果你装了 pinia-plugin-persistedstate 插件，这会自动保存到 localStorage
})
