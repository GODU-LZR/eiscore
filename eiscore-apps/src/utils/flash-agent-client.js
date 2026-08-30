// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const defaultFetch = (...args) => globalThis.fetch(...args)

export const createFlashAgentClient = ({ fetchImpl = defaultFetch } = {}) => {
  const callTool = async ({ urls = [], token, payload }) => {
    let lastError = null
    for (const url of urls) {
      try {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || result?.ok === false) {
          throw new Error(String(result?.message || result?.code || `工具调用失败 (${response.status})`))
        }
        return result
      } catch (error) {
        lastError = error
      }
    }
    throw new Error(String(lastError?.message || '工具调用失败'))
  }

  const fetchDraftSource = async ({ urls = [], token } = {}) => {
    let lastError = null
    for (const url of urls) {
      try {
        const response = await fetchImpl(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store'
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result?.message || `HTTP ${response.status}`)
        return String(result?.content || result?.data?.content || '')
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('读取草稿失败')
  }

  return { callTool, fetchDraftSource }
}

const defaultClient = createFlashAgentClient()

export const callTool = (options) => defaultClient.callTool(options)
export const fetchDraftSource = (options) => defaultClient.fetchDraftSource(options)
