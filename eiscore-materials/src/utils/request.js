// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import axios from 'axios'
import { ElMessage } from 'element-plus'
import { createPlatformAxiosClient } from '@eiscore/platform/axios-client'
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

const service = createPlatformAxiosClient({
  axios,
  getAccessToken: getToken,
  onUnauthorized: () => clearAuthAndRedirect('/login'),
  notifyError: (message) => ElMessage.error(message),
  defaultProfile: (_config, { path }) => resolveDefaultProfile(path),
  timeoutMs: 5000
})

export default service
