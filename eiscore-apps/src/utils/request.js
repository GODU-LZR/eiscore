import axios from 'axios'
import { ElMessage } from 'element-plus'

const service = axios.create({
  baseURL: '/api',
  timeout: 8000
})

service.interceptors.request.use(
  (config) => {
    const tokenStr = localStorage.getItem('auth_token')
    if (tokenStr) {
      let token = tokenStr
      try {
        const parsed = JSON.parse(tokenStr)
        if (parsed.token) token = parsed.token
      } catch {
        // ignore
      }
      config.headers['Authorization'] = `Bearer ${token}`
    }

    if (!config.headers['Accept-Profile']) {
      config.headers['Accept-Profile'] = 'app_center'
    }

    if (!config.headers['Content-Profile']) {
      config.headers['Content-Profile'] = 'app_center'
    }

    return config
  },
  (error) => Promise.reject(error)
)

service.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      try {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else {
      ElMessage.error(error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

export default service
