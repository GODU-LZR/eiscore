// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import axios from 'axios'
import { ElMessage } from 'element-plus'
import { createPlatformAxiosClient } from '@eiscore/platform/axios-client'
import { getToken, clearAuthAndRedirect } from '@/utils/auth'

const service = createPlatformAxiosClient({
  axios,
  getAccessToken: getToken,
  onUnauthorized: () => clearAuthAndRedirect('/login'),
  notifyError: (message) => ElMessage.error(message),
  defaultProfile: 'public',
  timeoutMs: 8000
})

export default service

