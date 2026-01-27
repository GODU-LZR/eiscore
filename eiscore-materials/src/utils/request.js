import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建 axios 实例
const service = axios.create({
  baseURL: '/api', // 指向基座的代理 /api -> localhost:3000
  timeout: 5000
})

// 🟢 请求拦截器
service.interceptors.request.use(
  config => {
    // 1. 获取 Token (从 localStorage)
    const tokenStr = localStorage.getItem('auth_token')
    if (tokenStr) {
      // 兼容直接存字符串或存 JSON 的情况
      let token = tokenStr
      try {
        const parsed = JSON.parse(tokenStr)
        if (parsed.token) token = parsed.token
      } catch (e) {
        // 是纯字符串，不用处理
      }
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // 默认走 public schema，除非调用方显式指定
    if (!config.headers['Accept-Profile']) {
      config.headers['Accept-Profile'] = 'public'
    }
    if (!config.headers['Content-Profile']) {
      config.headers['Content-Profile'] = 'public'
    }

    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器 (保持不变)
service.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    if (error.response && error.response.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

export default service
