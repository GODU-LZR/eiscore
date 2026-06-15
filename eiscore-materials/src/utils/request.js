// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, clearAuthAndRedirect } from '@/utils/auth'

const SCM_ENDPOINTS = new Set([
  '/batch_no_rules',
  '/warehouses',
  '/warehouse_layouts',
  '/inventory_batches',
  '/inventory_transactions',
  '/inventory_drafts',
  '/inventory_checks',
  '/inventory_check_items',
  '/v_inventory_current',
  '/v_inventory_transactions',
  '/v_inventory_drafts',
  '/boms',
  '/bom_items',
  '/v_boms'
])

const normalizeApiPath = (url = '') => {
  try {
    const parsed = new URL(String(url), 'http://eiscore.local')
    return parsed.pathname.replace(/^\/api\b/, '').replace(/\/+$/, '') || '/'
  } catch (e) {
    return String(url || '')
      .split('?')[0]
      .replace(/^\/api\b/, '')
      .replace(/\/+$/, '') || '/'
  }
}

const resolveDefaultProfile = (url = '') => {
  return SCM_ENDPOINTS.has(normalizeApiPath(url)) ? 'scm' : 'public'
}

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

    const defaultProfile = resolveDefaultProfile(config.url)

    // 默认走 public schema；库存/仓储端点默认走 scm，调用方显式指定时优先。
    if (!config.headers['Accept-Profile']) {
      config.headers['Accept-Profile'] = defaultProfile
    }
    if (!config.headers['Content-Profile']) {
      config.headers['Content-Profile'] = defaultProfile
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
