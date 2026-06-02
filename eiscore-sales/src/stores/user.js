// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

// eiscore-sales/src/stores/user.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 从 localStorage 获取用户信息 (由基座登录后写入)
  const userInfoStr = localStorage.getItem('user_info')
  let parsedUser = {}
  try {
    parsedUser = userInfoStr ? JSON.parse(userInfoStr) : {}
  } catch (e) {
    parsedUser = {}
  }
  const userInfo = ref(parsedUser)

  // 如果需要更新用户信息（虽然通常由基座处理）
  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('user_info', JSON.stringify(info))
  }

  return {
    userInfo,
    setUserInfo
  }
})
