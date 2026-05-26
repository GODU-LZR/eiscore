import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, clearAuthAndRedirect } from '@/utils/auth'

const service = axios.create({
  baseURL: '/api',
  timeout: 8000
})

service.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
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
      clearAuthAndRedirect('/login')
    } else {
      ElMessage.error(error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

export default service
