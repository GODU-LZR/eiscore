// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import axios from 'axios'
import { ElMessage } from 'element-plus'
import { createPlatformAxiosClient } from '@eiscore/platform/axios-client'
import { getToken, clearAuthAndRedirect } from '@/utils/auth'

const service = createPlatformAxiosClient({
  axios,
  service: 'auto',
  getAccessToken: getToken,
  onUnauthorized: () => clearAuthAndRedirect('/login'),
  notifyError: (message) => ElMessage.error(message),
  shouldHandleUnauthorized: (_config, context) => !(
    context.service === 'agent' && context.path.startsWith('/ai/')
  ),
  shouldNotifyError: (_config, _context, error) => error?.response?.status !== 404,
  resolveErrorMessage: (error) => error?.response
    ? error.message
    : '网络连接超时或断开',
  unauthorizedMessage: '未授权，请重新登录',
  timeoutMs: 10000
})

export default service
