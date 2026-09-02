// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import axios from 'axios'
import { ElMessage } from 'element-plus'
import { createPlatformAxiosClient } from '@eiscore/platform/axios-client'
import { getToken, clearAuthAndRedirect } from '@/utils/auth'

const service = createPlatformAxiosClient({
  axios,
  service: 'agent',
  getAccessToken: getToken,
  onUnauthorized: () => clearAuthAndRedirect('/login'),
  notifyError: (message) => ElMessage.error(message),
  resolveErrorMessage: (error, event) => (
    event.status === 403
      ? '暂无企业站点运营权限'
      : error?.response?.data?.message || ''
  ),
  defaultAccept: 'application/json',
  timeoutMs: 12000,
  unauthorizedMessage: '登录已过期，请重新登录'
})

export default service
