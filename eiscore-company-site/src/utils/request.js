// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, clearAuthAndRedirect } from '@/utils/auth'

const service = axios.create({
  baseURL: '/agent',
  timeout: 12000
})

service.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers.Accept = 'application/json'
  config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json'
  return config
})

service.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const message = error.response.status === 403 ? '暂无企业站点运营权限' : '登录已过期，请重新登录'
      ElMessage.error(message)
      if (error.response.status === 401) clearAuthAndRedirect('/login')
    } else {
      ElMessage.error(error.response?.data?.message || error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

export default service
