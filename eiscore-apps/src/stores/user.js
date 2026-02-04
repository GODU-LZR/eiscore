import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userInfoStr = localStorage.getItem('user_info')
  let parsedUser = {}
  try {
    parsedUser = userInfoStr ? JSON.parse(userInfoStr) : {}
  } catch {
    parsedUser = {}
  }
  const userInfo = ref(parsedUser)

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('user_info', JSON.stringify(info))
  }

  return {
    userInfo,
    setUserInfo
  }
})
