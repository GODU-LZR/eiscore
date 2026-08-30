// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const CONFIG_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,127}$/i

export class SystemConfigError extends Error {
  constructor(code) {
    super(`System configuration request failed: ${code}`)
    this.name = 'SystemConfigError'
    this.code = code
  }
}

function assertConfigKey(key) {
  if (typeof key !== 'string' || !CONFIG_KEY_PATTERN.test(key)) {
    throw new SystemConfigError('invalid-key')
  }
  return key
}

export function createSystemConfigService({ httpClient, profile = 'public' } = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') {
    throw new SystemConfigError('http-client-required')
  }

  async function readValue(key) {
    const safeKey = assertConfigKey(key)
    const result = await httpClient.requestJson(`/system_configs?key=eq.${encodeURIComponent(safeKey)}`, {
      headers: { 'Accept-Profile': profile }
    })
    if (!Array.isArray(result.data)) throw new SystemConfigError('invalid-response')
    const row = result.data[0]
    return row && Object.hasOwn(row, 'value') ? row.value : null
  }

  async function saveValue(key, value, { description = '' } = {}) {
    const safeKey = assertConfigKey(key)
    await httpClient.requestJson('/system_configs', {
      method: 'POST',
      headers: {
        'Accept-Profile': profile,
        'Content-Profile': profile,
        Prefer: 'resolution=merge-duplicates'
      },
      body: { key: safeKey, value, description: String(description || '') }
    })
    return true
  }

  return Object.freeze({ readValue, saveValue })
}
