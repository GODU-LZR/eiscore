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
    token.value = userData.token
    userInfo.value = userData.user
    setAuth(userData.token, userData.user)
  }

  const logout = () => {
    token.value = ''
    userInfo.value = {}
    clearAuthStorage()
  }

  return { token, userInfo, login, logout }
})
