// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { shallowReactive } from 'vue'

export const isStandaloneBusinessHarnessPath = (path) => /^\/(?:harness(?:-embed)?|embed\/(?:digital-twin|smart-bi)|ai\/enterprise)(?:\/|[?#]|$)/.test(String(path || ''))

// The layout owns the iframe. Outlets register geometry, never move its DOM.
export const businessHarnessState = shallowReactive({
  assistantOpen: false,
  workerCommandActive: false,
  workspace: null,
  pendingDraft: null
})

export function openHarnessAssistant(command = {}) {
  if (/^\/apps\/flash-builder(?:\/|$)/.test(globalThis.location?.pathname || '')) return false
  if (command.type && command.type !== 'open-worker') return false
  if (command.prompt !== undefined && (typeof command.prompt !== 'string' || command.prompt.length > 12000)) return false
  const id = String(command.id || '')
  if (command.prompt?.trim() && (!id.trim() || id.length > 128)) return false
  businessHarnessState.assistantOpen = true
  if (command.type === 'open-worker') businessHarnessState.workerCommandActive = true
  if (command.prompt?.trim()) businessHarnessState.pendingDraft = { id, prompt: command.prompt }
  return true
}

export function resetBusinessHarness() {
  businessHarnessState.assistantOpen = false
  businessHarnessState.workerCommandActive = false
  businessHarnessState.pendingDraft = null
}
