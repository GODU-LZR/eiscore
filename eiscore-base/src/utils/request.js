import axios from 'axios'
import { ElMessage } from 'element-plus'

const getAuthToken = () => {
  const tokenStr = localStorage.getItem('auth_token')
  if (!tokenStr) return ''
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed?.token) return parsed.token
  } catch (e) {
    // ignore
  }
  return tokenStr
}

// 创建 axios 实例
const service = axios.create({
  // baseURL: '/api', // 🟢 注意：因为我们在 AiBridge 里已经手动写了 /api 前缀，这里留空或者是 '/' 即可，避免双重前缀
  baseURL: '/', 
  timeout: 10000 // 请求超时时间
})

// request 拦截器
service.interceptors.request.use(
  config => {
    // 如果有 token，可以在这里注入
    const token = getAuthToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    console.error('Request Error:', error)
    return Promise.reject(error)
  }
)

// response 拦截器
service.interceptors.response.use(
  response => {
    const res = response.data
    // PostgREST 直接返回数据数组或对象，通常没有 { code: 200, data: ... } 这种包装
    // 所以这里直接返回 res
    return res
  },
  error => {
    console.error('Response Error:', error)
    
    // 处理 HTTP 错误状态
    if (error.response) {
      const status = error.response.status
      const reqUrl = String(error.config?.url || '')
      const isAiEndpoint = reqUrl.includes('/agent/ai/')
      if (status === 401) {
        // AI 接口为可选能力，401 不应影响主业务登录态
        if (!isAiEndpoint) {
          ElMessage.error('未授权，请重新登录')
          try {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user_info')
          } catch (e) {}
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
      } else if (status === 404) {
        // AI Bridge 有时会探测配置，404 不一定报错，留给调用方处理
        // ElMessage.error('请求的资源不存在')
      } else {
        ElMessage.error(error.message || '网络请求失败')
      }
    } else {
      ElMessage.error('网络连接超时或断开')
    }
    return Promise.reject(error)
  }
)

export default service
