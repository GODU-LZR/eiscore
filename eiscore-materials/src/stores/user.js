import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userInfoStr = localStorage.getItem('user_info')
  const userInfo = ref(userInfoStr ? JSON.parse(userInfoStr) : {})

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('user_info', JSON.stringify(info))
  }

  return {
    userInfo,
    setUserInfo
  }
})
