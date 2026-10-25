// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getAuthHeader } from '@/utils/auth'

const FILES_PATH = '/harness-knowledge-agent/twin/knowledge/files'

const request = async (path = FILES_PATH, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...getAuthHeader(),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    credentials: 'same-origin'
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const error = new Error(text.slice(0, 240) || `知识文件请求失败（${response.status}）`)
    error.status = response.status
    throw error
  }
  return response.json()
}

export const listKnowledgeFiles = () => request()

export const readKnowledgeFile = (id) => request(`${FILES_PATH}?id=${encodeURIComponent(id)}`)

export const uploadKnowledgeFile = (payload) => request(FILES_PATH, {
  method: 'POST',
  body: JSON.stringify(payload)
})

export const updateKnowledgeFile = (id, payload) => request(`${FILES_PATH}?id=${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(payload)
})

export const deleteKnowledgeFile = (id) => request(`${FILES_PATH}?id=${encodeURIComponent(id)}`, {
  method: 'DELETE'
})

export const fileToKnowledgePayload = async (file, folder = '') => {
  const isText = file.type.startsWith('text/') || /\.(csv|json|md|txt|xml|yaml|yml|log)$/i.test(file.name)
  const contentText = isText ? await file.text() : ''
  if (contentText.length > 200000) throw new Error('文本文件超过 200,000 字符限制')
  let contentB64 = ''
  if (!isText) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    }
    contentB64 = btoa(binary)
    if (contentB64.length > 5000000) throw new Error('文件超过 3.5 MB 限制')
  }
  const folderName = String(folder || '').trim()
  if (folderName.length > 60 || /[\\/\u0000-\u001f\u007f]/.test(folderName)) {
    throw new Error('文件夹名称无效')
  }
  return {
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    contentText: contentText.slice(0, 200000),
    contentB64,
    summary: '',
    tags: [],
    metadata: folderName ? { folder: folderName } : {}
  }
}
