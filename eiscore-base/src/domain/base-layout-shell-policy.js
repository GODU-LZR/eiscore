// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const BASE_DEFAULT_AVATAR = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

export const buildBaseAvatarRenderSrc = (avatarSrc, avatarTick, fallback = BASE_DEFAULT_AVATAR) => {
  const src = avatarSrc || fallback
  if (!src) return fallback
  if (src.startsWith('data:')) return `${src}#t=${avatarTick}`
  if (src.startsWith('http')) {
    const joiner = src.includes('?') ? '&' : '?'
    return `${src}${joiner}t=${avatarTick}`
  }
  return src
}

export const getBaseGuideProgressSyncPresentation = (state) => {
  if (state === 'syncing') return { label: '同步中', tagType: 'warning' }
  if (state === 'synced') return { label: '已同步', tagType: 'success' }
  return { label: '本地记录', tagType: 'info' }
}

export const resolveBaseAsideTheme = ({ primaryColor = '#409EFF', isDark = false, mixColor }) => {
  if (isDark) {
    return {
      menuBg: '#001529',
      menuText: '#fff',
      menuActiveText: primaryColor,
      logoBg: '#002140',
      headerBg: '#001529'
    }
  }
  return {
    menuBg: primaryColor,
    menuText: '#ffffff',
    menuActiveText: '#ffffff',
    logoBg: mixColor(primaryColor, '#000000', 0.1),
    headerBg: mixColor(primaryColor, '#ffffff', 0.85)
  }
}

export const BASE_WORKER_ASSISTANT_HIDDEN_ROUTES = [
  '/materials/inventory-dashboard',
  '/sales/cockpit',
  '/purchase/dashboard',
  '/quality/dashboard',
  '/equipment/dashboard'
]

export const isBaseWorkerAssistantVisible = (path) => {
  const routePath = path || '/'
  if (routePath === '/' || routePath.startsWith('/ai/enterprise')) return false
  return !BASE_WORKER_ASSISTANT_HIDDEN_ROUTES.some((prefix) => (
    routePath === prefix || routePath.startsWith(`${prefix}/`)
  ))
}
