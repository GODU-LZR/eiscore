// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

/**
 * DeepSeek Harness HTTP usage examples.
 *
 * The browser only calls EISCore's authenticated Gateway. It never sends
 * tenant, user, JWT, SQL, or provider details as capability input.
 */

import { getToken } from '@/utils/auth'

const defaultFetch = (...args) => globalThis.fetch(...args)

export class HarnessClient {
  constructor({ fetchImpl = defaultFetch, baseUrl = '' } = {}) {
    this.fetchImpl = fetchImpl
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '')
  }

  async execute({
    pluginId,
    agentId,
    capabilityId,
    payload = {},
    confirmed = false,
    idempotencyKey,
    requestId,
    token = getToken()
  } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}/ai/harness/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plugin_id: pluginId,
        agent_id: agentId,
        capability_id: capabilityId,
        payload,
        confirmed,
        idempotency_key: idempotencyKey,
        request_id: requestId
      })
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(result?.message || result?.code || `Harness request failed (${response.status})`))
    return result
  }

  async callFlashTool({ toolId, payload = {}, confirmed = false, idempotencyKey, token = getToken() } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}/flash/tools/call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool_id: toolId,
        payload,
        confirmed,
        idempotency_key: idempotencyKey
      })
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(result?.message || result?.code || `Flash tool request failed (${response.status})`))
    return result
  }
}

const defaultClient = new HarnessClient()

export const executeHarnessCapability = (options) => defaultClient.execute(options)
export const callHarnessFlashTool = (options) => defaultClient.callFlashTool(options)

// Example: read a permission-filtered enterprise snapshot through Harness.
export const readEnterpriseSnapshot = (options = {}) => executeHarnessCapability({
  pluginId: 'enterprise-bi',
  agentId: 'enterprise_analyst',
  capabilityId: 'eiscore_enterprise_snapshot',
  ...options
})

// Example: invoke a registered Flash tool; writes still require confirmation
// and a server-validated idempotency key.
export const readFlashApps = (options = {}) => callHarnessFlashTool({
  toolId: 'flash.app.list',
  ...options
})
