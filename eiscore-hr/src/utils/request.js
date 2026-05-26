import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, clearAuthAndRedirect } from '@/utils/auth'

// 创建 axios 实例
const service = axios.create({
  baseURL: '/api', // 指向基座的代理 /api -> localhost:3000
  timeout: 5000
})

// 🟢 请求拦截器
service.interceptors.request.use(
  config => {
    // 1. 获取 Token (从 localStorage)
    const token = getToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // 🟢 2. [核心修复] 智能锁定 Schema
    // 逻辑变更：只有当业务代码没有指定 Schema 时，才默认去 "hr"
    // 这样 system_configs 这种查 public 的请求就不会被误杀了
    
    if (!config.headers['Accept-Profile']) {
      config.headers['Accept-Profile'] = 'hr'
    }
    
    if (!config.headers['Content-Profile']) {
      config.headers['Content-Profile'] = 'hr'
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
      clearAuthAndRedirect('/login')
    } else {
      ElMessage.error(error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

export default service
