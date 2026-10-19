// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { shallowReactive } from 'vue'

// The layout owns the iframe. Outlets register geometry, never move its DOM.
export const businessHarnessState = shallowReactive({
  assistantOpen: false,
  workspace: null,
  pendingDraft: null
})

export function openHarnessAssistant(command = {}) {
  if (/^\/apps\/flash-builder(?:\/|$)/.test(globalThis.location?.pathname || '')) return false
  if (command.type && command.type !== 'open-worker') return false
  if (command.prompt !== undefined && (typeof command.prompt !== 'string' || command.prompt.length > 12000)) return false
  const id = String(command.id || '')
  if (command.prompt?.trim() && (!id || id.length > 128)) return false
  businessHarnessState.assistantOpen = true
  if (command.prompt?.trim()) {
    businessHarnessState.pendingDraft = { id, prompt: command.prompt }
  }
  return true
}

export function resetBusinessHarness() {
  businessHarnessState.assistantOpen = false
  businessHarnessState.pendingDraft = null
}
