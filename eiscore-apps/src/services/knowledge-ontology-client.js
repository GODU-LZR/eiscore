// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getAuthHeader } from '@/utils/auth'

const CONTEXT_PATH = '/twin/knowledge/ontology/context'

export const loadKnowledgeOntologyContext = async () => {
  const response = await fetch(CONTEXT_PATH, {
    headers: { ...getAuthHeader(), Accept: 'application/json' },
    credentials: 'same-origin'
  })
  if (!response.ok) {
    const error = new Error(`本体知识请求失败（${response.status}）`)
    error.status = response.status
    throw error
  }
  return response.json()
}

export { CONTEXT_PATH }
