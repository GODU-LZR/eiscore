import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建 axios 实例
const service = axios.create({
  baseURL: '/api/hr', // 假设人事系统的接口前缀是 /api/hr
  timeout: 5000
})

// 🟢 请求拦截器：每次请求都自动带上基座存的 Token
service.interceptors.request.use(
  (config) => {
    // 直接从 localStorage 读取基座存进去的 Token
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 🟢 响应拦截器：处理 Token 过期
service.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    // 如果后端返回 401 (未授权)，说明 Token 过期了
    if (error.response && error.response.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      // 这里的处理有点讲究：
      // 如果是微前端环境，最好通知基座去跳转登录页
      // 简单做法：直接 reload，基座的路由守卫会发现没 Token 并跳去登录
      // localStorage.removeItem('auth_token')
      // window.location.reload() 
    }
    return Promise.reject(error)
  }
)

export default service