import axios from 'axios'
import { ElMessage } from 'element-plus'

// 1. 创建 axios 实例
const service = axios.create({
  // 🟢 关键：指向 Nginx 转发的 API 地址
  // 在开发环境下，Vite 代理会把它转到 http://localhost/api
  baseURL: '/api', 
  timeout: 5000
})

// 2. 请求拦截器：自动带上 Token
service.interceptors.request.use(
  (config) => {
    // 从 localStorage 读取基座存入的 Token
    const token = localStorage.getItem('auth_token')
    if (token) {
      // PostgREST 要求格式: Bearer <token>
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 3. 响应拦截器：处理错误
service.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    // 处理 401 未授权 (Token 过期或无效)
    if (error.response && error.response.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      // 可选：通知基座跳转登录页
    } else {
      ElMessage.error(error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

export default service