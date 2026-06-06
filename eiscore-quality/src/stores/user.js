// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  let parsedUser = {}
  try {
    const raw = localStorage.getItem('user_info')
    parsedUser = raw ? JSON.parse(raw) : {}
  } catch {
    parsedUser = {}
  }

  const userInfo = ref(parsedUser)
  const setUserInfo = (info) => {
    userInfo.value = info || {}
    localStorage.setItem('user_info', JSON.stringify(userInfo.value))
  }

  return { userInfo, setUserInfo }
})

