import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setThemeColor } from '@/utils/theme' // 引入工具

const defaultLoginBranding = {
  companyName: '广东南派食品有限公司',
  slogan: '深耕热带水果全产业链，打造高品质水果制品方案',
  description: '根据企业官网公开信息：公司成立于 2009 年，注册资金 1000 万元，总部位于中国雷州半岛；拥有湛江、广西两大加工基地和多条水果加工生产线，面向茶饮、烘焙、饮料与生鲜客户提供一站式水果制品解决方案。',
  backgroundImage: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgx6CtnwYoh8fKtgcwgA84vAU!1500x1500.jpg',
  carouselImages: [
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg5uqnnwYoiNO9CjDcCziIBQ.jpg',
      title: '热带水果全产业链布局',
      subtitle: '覆盖种植、加工、研发、销售与服务'
    },
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3-CwnwYo_qL0ggIwjgI4nwM.jpg',
      title: '加工与品控能力',
      subtitle: '支持多品类水果制品的规模化生产'
    },
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgheiwnwYoj7jo0QQwjgI4nwM.jpg',
      title: '面向多场景客户',
      subtitle: '服务茶饮、烘焙、饮料与生鲜渠道'
    }
  ],
  leaders: []
}

const normalizeCarouselImages = (input) => {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (typeof item === 'string') {
        return { url: item.trim(), title: '', subtitle: '' }
      }
      if (!item || typeof item !== 'object') return null
      return {
        url: String(item.url || '').trim(),
        title: String(item.title || ''),
        subtitle: String(item.subtitle || '')
      }
    })
    .filter((item) => item && item.url)
}

const normalizeLeaders = (input) => {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const name = String(item.name || '').trim()
      if (!name) return null
      return {
        name,
        title: String(item.title || '').trim(),
        intro: String(item.intro || '').trim(),
        avatar: String(item.avatar || '').trim()
      }
    })
    .filter(Boolean)
}

const normalizeLoginBranding = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  const legacyName = String(source.companyName || '').trim() === 'EISCore 企业数字化平台'
  const legacySlogan = String(source.slogan || '').includes('让企业管理更高效')
  const noCustomMedia = !String(source.backgroundImage || '').trim()
    && (!Array.isArray(source.carouselImages) || source.carouselImages.length === 0)
    && (!Array.isArray(source.leaders) || source.leaders.length === 0)
  const resolved = legacyName && legacySlogan && noCustomMedia ? {} : source
  return {
    ...defaultLoginBranding,
    ...resolved,
    companyName: String(resolved.companyName || defaultLoginBranding.companyName),
    slogan: String(resolved.slogan || defaultLoginBranding.slogan),
    description: String(resolved.description || defaultLoginBranding.description),
    backgroundImage: String(resolved.backgroundImage || ''),
    carouselImages: normalizeCarouselImages(resolved.carouselImages),
    leaders: normalizeLeaders(resolved.leaders)
  }
}

const normalizeConfig = (input = {}) => {
  const source = input && typeof input === 'object' ? input : {}
  const depth = Number(source.materialsCategoryDepth)
  return {
    title: String(source.title || '海边姑娘管理系统'),
    themeColor: String(source.themeColor || '#409EFF'),
    notifications: source.notifications !== false,
    materialsCategoryDepth: depth === 3 ? 3 : 2,
    loginBranding: normalizeLoginBranding(source.loginBranding)
  }
}

export const useSystemStore = defineStore('system', () => {
  const defaultConfig = normalizeConfig()

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
  const updateConfig = (newConfig = {}) => {
    const previousTheme = config.value?.themeColor || defaultConfig.themeColor
    const merged = normalizeConfig({
      ...(config.value || {}),
      ...(newConfig || {})
    })
    config.value = merged
    const hasDom = typeof document !== 'undefined' && !!document.documentElement
    const themeMissing = hasDom ? !document.documentElement.style.getPropertyValue('--el-color-primary') : false
    if (merged.themeColor !== previousTheme || themeMissing) {
      setThemeColor(merged.themeColor)
    }
  }

  const loadConfig = async () => {
    try {
      const token = getAuthToken()
      const headers = { 'Accept-Profile': 'public' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/system_configs?key=eq.app_settings', {
        headers
      })
      if (!res.ok) return
      const list = await res.json()
      const row = Array.isArray(list) ? list[0] : null
      if (row?.value && typeof row.value === 'object') {
        const next = normalizeConfig({ ...defaultConfig, ...row.value })
        updateConfig(next)
      }
    } catch (e) {}
  }

  const saveConfig = async (nextConfig) => {
    const payload = normalizeConfig({
      ...(config.value || {}),
      ...(nextConfig || {})
    })
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
      const res = await fetch('/api/system_configs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'app_settings', value: payload, description: '系统全局设置' })
      })
      if (!res.ok) return false
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
