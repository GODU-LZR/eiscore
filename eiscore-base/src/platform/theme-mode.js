// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, watch } from 'vue'
import { useDark } from '@vueuse/core'
import {
  GLOBAL_THEME_STORAGE_KEY,
  getGlobalTheme,
  normalizeGlobalTheme,
  saveGlobalTheme
} from '@shared/eis-ui-preferences.mjs'

const themeMode = ref(getGlobalTheme() || 'auto')
const hostDarkMode = useDark({
  storageKey: null,
  storageRef: themeMode
})

watch(themeMode, (mode) => {
  saveGlobalTheme(mode)
})

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event?.key !== GLOBAL_THEME_STORAGE_KEY) return
    themeMode.value = normalizeGlobalTheme(event.newValue) || 'auto'
  })
}

export const useHostDarkMode = () => hostDarkMode
