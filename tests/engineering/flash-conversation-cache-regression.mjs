// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildFlashConversationStorageKey,
  createFlashConversationCache
} from '../../shared/eis-flash-conversation-cache.mjs'

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial))
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }
}

assert.equal(buildFlashConversationStorageKey('app-1'), 'flash_shell_conversations:app-1')
assert.equal(buildFlashConversationStorageKey(''), 'flash_shell_conversations:default')

const conversations = [{
  id: 'conv-1',
  title: '会话一',
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
  messages: [{ id: 'msg-1', role: 'user', content: '创建页面', thought: '', toolCalls: [] }],
  attachments: [{ id: 'att-1', name: '需求.md', relativePath: 'uploads/需求.md', textPreview: '摘要' }]
}]
const storage = new MemoryStorage({
  [buildFlashConversationStorageKey('app-1')]: JSON.stringify(conversations)
})
const cache = createFlashConversationCache({ storage })
assert.deepEqual(cache.loadConversations('app-1'), conversations)
assert.equal(cache.saveConversations('app-2', conversations), true)
assert.deepEqual(JSON.parse(storage.getItem(buildFlashConversationStorageKey('app-2'))), conversations)
assert.equal(cache.saveConversations('app-2', { invalid: true }), true)
assert.deepEqual(JSON.parse(storage.getItem(buildFlashConversationStorageKey('app-2'))), [])

storage.setItem(buildFlashConversationStorageKey('app-1'), '{invalid-json')
assert.deepEqual(cache.loadConversations('app-1'), [])
storage.setItem(buildFlashConversationStorageKey('app-1'), JSON.stringify({ invalid: true }))
assert.deepEqual(cache.loadConversations('app-1'), [])

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createFlashConversationCache({ storage: throwingStorage })
assert.deepEqual(unavailable.loadConversations('app-1'), [])
assert.equal(unavailable.saveConversations('app-1', conversations), false)

const repoRoot = resolve(import.meta.dirname, '../..')
const builderSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/FlashBuilder.vue'), 'utf8')
assert.match(builderSource, /buildFlashConversationStorageKey,[\s\S]*loadFlashConversations,[\s\S]*saveFlashConversations[\s\S]*from\s*['"]@shared\/eis-flash-conversation-cache\.mjs['"]/)
assert.match(builderSource, /saveFlashConversations\(appId\.value, shellConversations\.value\)/)
assert.match(builderSource, /const cachedConversations = loadFlashConversations\(appId\.value\)/)
assert.match(builderSource, /cachedConversations\.length > 0 \? cachedConversations : remoteList/)
assert.doesNotMatch(builderSource, /\blocalStorage\b|\bsessionStorage\b/)

console.log('PASS: FlashBuilder uses safe per-app conversation cache with remote fallback')
