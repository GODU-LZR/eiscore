// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createAssistantHistory,
  createAssistantModeHistory
} from '../../shared/eis-assistant-history.mjs'

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

  removeItem(key) {
    this.values.delete(key)
  }
}

const key = 'assistant_history_test'
const storage = new MemoryStorage()
const history = createAssistantHistory({ storageKey: key, storage, maxSessions: 10, maxMessages: 40 })
assert.equal(history.load(), null)

const sessions = Array.from({ length: 12 }, (_, sessionIndex) => ({
  id: `session-${sessionIndex}`,
  title: `会话 ${sessionIndex}`,
  messages: Array.from({ length: 45 }, (_, messageIndex) => ({
    id: `${sessionIndex}-${messageIndex}`,
    role: messageIndex % 2 ? 'assistant' : 'user'
  }))
}))
const saved = history.save(sessions, 'session-3')
assert.equal(saved.sessions.length, 10)
assert.equal(saved.sessions[0].messages.length, 40)
assert.equal(saved.sessions[0].messages[0].id, '0-5')
assert.equal(saved.currentSessionId, 'session-3')
assert.deepEqual(JSON.parse(storage.getItem(key)), saved)
assert.deepEqual(history.load(), saved)

storage.setItem(key, JSON.stringify({ sessions: sessions.slice(0, 2), currentSessionId: '' }))
assert.equal(history.load().currentSessionId, 'session-0')
storage.setItem(key, JSON.stringify({ sessions: 'invalid' }))
assert.equal(history.load(), null)
storage.setItem(key, '{invalid-json')
assert.equal(history.load(), null)

const fileHistory = createAssistantHistory({
  storageKey: 'enterprise_files',
  storage,
  transformMessage: (message) => ({
    ...message,
    files: message.files?.map((file) => ({
      type: file.type,
      name: file.name,
      url: file.type === 'image' ? file.url : null
    }))
  })
})
const rawFile = { type: 'document', name: '报价单.xlsx', url: 'blob:secret', raw: { size: 1024 } }
const imageFile = { type: 'image', name: '现场.png', url: 'data:image/png;base64,ok', raw: { size: 2048 } }
const fileSaved = fileHistory.save([{
  id: 'files',
  messages: [{ role: 'user', content: '分析', files: [rawFile, imageFile] }]
}], 'files')
assert.deepEqual(fileSaved.sessions[0].messages[0].files, [
  { type: 'document', name: '报价单.xlsx', url: null },
  { type: 'image', name: '现场.png', url: 'data:image/png;base64,ok' }
])
assert.doesNotMatch(storage.getItem('enterprise_files'), /blob:secret|"raw"/)

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createAssistantHistory({ storageKey: key, storage: throwingStorage })
assert.equal(unavailable.load(), null)
assert.doesNotThrow(() => unavailable.save(sessions, 'session-1'))
assert.throws(() => createAssistantHistory(), /storageKey/)
assert.throws(() => createAssistantHistory({ storageKey: key, transformMessage: null }), /transformMessage/)

const modeKey = 'eis_ai_history_v5'
const modeStorage = new MemoryStorage({
  [modeKey]: JSON.stringify({
    enterprise: { sessions: sessions.slice(0, 2), currentSessionId: 'session-1' },
    worker: { sessions: sessions.slice(2, 4), currentSessionId: 'session-2' }
  })
})
const modeHistory = createAssistantModeHistory({
  storageKey: modeKey,
  modes: ['enterprise', 'worker'],
  maxSessions: 20,
  maxMessages: 50,
  storage: modeStorage
})
assert.deepEqual(modeHistory.load(), JSON.parse(modeStorage.getItem(modeKey)))
const manySessions = Array.from({ length: 22 }, (_, sessionIndex) => ({
  id: `desktop-${sessionIndex}`,
  messages: Array.from({ length: 55 }, (_, messageIndex) => ({ id: `${sessionIndex}-${messageIndex}` }))
}))
const modeSaved = modeHistory.saveMode(modeHistory.load(), 'enterprise', manySessions, 'desktop-3')
assert.equal(modeSaved.enterprise.sessions.length, 20)
assert.equal(modeSaved.enterprise.sessions[0].messages.length, 50)
assert.equal(modeSaved.enterprise.sessions[0].messages[0].id, '0-5')
assert.equal(modeSaved.enterprise.currentSessionId, 'desktop-3')
assert.equal(modeSaved.worker.currentSessionId, 'session-2')
assert.deepEqual(JSON.parse(modeStorage.getItem(modeKey)), modeSaved)
modeStorage.setItem(modeKey, '{invalid-json')
assert.deepEqual(modeHistory.load(), {
  enterprise: { sessions: [], currentSessionId: null },
  worker: { sessions: [], currentSessionId: null }
})
assert.throws(() => modeHistory.saveMode({}, 'unknown', [], null), /Unsupported assistant history mode/)
assert.throws(() => createAssistantModeHistory({ storageKey: modeKey }), /modes/)

const unavailableModes = createAssistantModeHistory({
  storageKey: modeKey,
  modes: ['enterprise', 'worker'],
  storage: throwingStorage
})
assert.doesNotThrow(() => unavailableModes.saveMode(unavailableModes.load(), 'worker', manySessions, 'desktop-1'))

const repoRoot = resolve(import.meta.dirname, '../..')
const assistantSources = new Map([
  ['eiscore-mobile/src/views/assistant/EnterpriseAssistant.vue', /transformMessage:\s*\(message\)/],
  ['eiscore-mobile/src/views/assistant/WarehouseAssistant.vue', /maxMessages:\s*MAX_MESSAGES/]
])
for (const [path, specificPattern] of assistantSources) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8')
  assert.match(source, /createAssistantHistory\s*}\s*from\s*['"]@shared\/eis-assistant-history\.mjs['"]/, path)
  assert.match(source, /assistantHistory\.load\(\)/, path)
  assert.match(source, /assistantHistory\.save\(sessions,\s*currentSessionId\.value\)/, path)
  assert.match(source, specificPattern, path)
  assert.doesNotMatch(source, /\blocalStorage\b|JSON\.parse\(raw\)|localStorage\.setItem/, path)
}

const desktopBridge = readFileSync(resolve(repoRoot, 'eiscore-base/src/utils/ai-bridge.js'), 'utf8')
assert.match(desktopBridge, /createAssistantModeHistory\s*}\s*from\s*['"]@shared\/eis-assistant-history\.mjs['"]/)
assert.match(desktopBridge, /modes:\s*\[['"]enterprise['"],\s*['"]worker['"]\]/)
assert.match(desktopBridge, /return aiModeHistory\.load\(\)/)
assert.match(desktopBridge, /this\.modeStorage = aiModeHistory\.saveMode\(/)
assert.doesNotMatch(desktopBridge, /\blocalStorage\b|\bsessionStorage\b/)

console.log('PASS: mobile and desktop assistants share bounded safe history storage with mode and file policies')
