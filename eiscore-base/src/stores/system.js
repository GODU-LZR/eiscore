// src/stores/system.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSystemStore = defineStore('system', () => {
  // --- 1. 系统外观配置 ---
  const config = ref({
    title: '企业数字化平台', // 默认系统名
    logo: 'https://element-plus.org/images/element-plus-logo.svg',
    themeColor: '#409EFF',
    isDark: false
  })

  // --- 2. 用户信息 ---
  const user = ref({
    token: localStorage.getItem('auth_token') || '',
    info: JSON.parse(localStorage.getItem('user_info') || '{}')
  })

  // --- Actions (修改数据的方法) ---
  function setSystemConfig(newConfig) {
    Object.assign(config.value, newConfig)
  }

  function login(token, userInfo) {
    user.value.token = token
    user.value.info = userInfo
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user_info', JSON.stringify(userInfo))
  }

  function logout() {
    user.value.token = ''
    user.value.info = {}
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
  }

  return { config, user, setSystemConfig, login, logout }
})