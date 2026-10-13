// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  clearAuthStorage,
  getToken,
  getUserInfo,
  setAuth
} from '@/utils/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(getToken())
  const userInfo = ref(getUserInfo() || {})

  const login = (userData) => {
    if (!setAuth(userData.token, userData.user)) {
      logout()
      throw new Error('登录信息保存失败，请允许浏览器存储后重试；仍失败请联系管理员')
    }
    token.value = userData.token
    userInfo.value = userData.user
  }

  const logout = () => {
    token.value = ''
    userInfo.value = {}
    clearAuthStorage()
  }

  return { token, userInfo, login, logout }
})
