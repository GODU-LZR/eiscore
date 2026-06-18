// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import crypto from 'node:crypto'
import { createHttpClient } from './http-client.mjs'

export const postgrestBaseUrl = String(process.env.EISCORE_POSTGREST_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')
export const jwtSecret = process.env.PGRST_JWT_SECRET || 'my_super_secret_key_for_eiscore_system_2025'

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export function signRuntimeJwt(payload) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = {
    role: 'web_user',
    iat: now,
    exp: now + 60 * 60,
    ...payload
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`
  const signature = crypto
    .createHmac('sha256', jwtSecret)
    .update(unsigned)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${unsigned}.${signature}`
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export function normalizeRows(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && Array.isArray(data.body)) return data.body
  return []
}

export function nodeIds(rows) {
  return new Set(normalizeRows(rows).map((row) => row?.node_id).filter(Boolean))
}

export function createRuntimeV2AccessHarness() {
  const client = createHttpClient({
    baseUrl: postgrestBaseUrl,
    timeoutMs: Number(process.env.EISCORE_RUNTIME_ACCESS_TIMEOUT_MS || 15000)
  })

  const adminToken = signRuntimeJwt({
    username: 'admin',
    app_role: 'super_admin',
    role_code: 'super_admin',
    dept_id: 1
  })

  const employeeToken = signRuntimeJwt({
    username: 'employee',
    app_role: 'employee',
    role_code: 'employee',
    dept_id: 2
  })

  async function request(path, token, body, { method = 'POST' } = {}) {
    return client.requestJson(path, {
      method,
      headers: authHeaders(token),
      body
    })
  }

  return { client, adminToken, employeeToken, request }
}
