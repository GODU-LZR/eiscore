import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setThemeColor } from '@/utils/theme' // 引入工具

export const useSystemStore = defineStore('system', () => {
  // 1. 定义状态
  const config = ref({
    title: '海边姑娘管理系统', // 默认标题
    themeColor: '#409EFF'    // 默认主题色
  })

  // 2. 定义动作
  const updateConfig = (newConfig) => {
    // 如果传入了标题，更新标题
    if (newConfig.title) {
      config.value.title = newConfig.title
    }
    
    // 如果传入了颜色，更新颜色并应用样式
    if (newConfig.themeColor) {
      config.value.themeColor = newConfig.themeColor
      setThemeColor(newConfig.themeColor)
    }
  }

  // 3. 初始化动作 (App启动时调用)
  const initTheme = () => {
    if (config.value.themeColor) {
      setThemeColor(config.value.themeColor)
    }
  }

  return { config, updateConfig, initTheme }
}, {
  persist: true // 如果你装了 pinia-plugin-persistedstate 插件，这会自动保存到 localStorage
})