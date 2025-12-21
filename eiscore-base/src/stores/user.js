// src/stores/user.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 初始化时尝试从 localStorage 读取，防止刷新丢失
  const token = ref(localStorage.getItem('auth_token') || '')
  // 这里加个 try-catch 防止 JSON 解析报错
  const userInfo = ref({})
  try {
    userInfo.value = JSON.parse(localStorage.getItem('user_info') || '{}')
  } catch (e) {
    userInfo.value = {}
  }

  // 登录动作
  const login = (userData) => {
    token.value = userData.token
    userInfo.value = userData.user
    
    // 持久化
    localStorage.setItem('auth_token', userData.token)
    localStorage.setItem('user_info', JSON.stringify(userData.user))
  }

  // 退出动作
  const logout = () => {
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
  }

  return { token, userInfo, login, logout }
})