// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserInfo, setUserInfo as persistUserInfo } from '@/utils/auth'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref(getUserInfo() || {})

  const setUserInfo = (info) => {
    userInfo.value = info
    persistUserInfo(userInfo.value)
  }

  return {
    userInfo,
    setUserInfo
  }
})
