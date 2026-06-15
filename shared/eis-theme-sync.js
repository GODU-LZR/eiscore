// SPDX-License-Identifier: AGPL-3.0-or-later

export const EIS_THEME_UPDATED_EVENT = 'eis:theme-updated'

export const EIS_THEME_VARIABLES = [
  '--el-color-primary',
  '--el-color-primary-rgb',
  '--el-color-primary-dark-2',
  '--primary-color',
  '--page-bg-tint',
  '--card-bg-tint',
  ...Array.from({ length: 9 }, (_, index) => `--el-color-primary-light-${index + 1}`)
]

const canUseDom = () => typeof document !== 'undefined' && !!document.documentElement

const addTarget = (set, target) => {
  if (target && target.nodeType === 1) set.add(target)
}

const collectThemeTargets = (mountPoint, container) => {
  const targets = new Set()
  addTarget(targets, mountPoint)
  addTarget(targets, container)
  addTarget(targets, mountPoint?.closest?.('[data-qiankun], [data-name]'))
  addTarget(targets, container?.closest?.('[data-qiankun], [data-name]'))

  if (canUseDom()) {
    document
      .querySelectorAll('#subapp-viewport [data-qiankun], #subapp-viewport [data-name], #subapp-viewport #app')
      .forEach((target) => addTarget(targets, target))
  }

  return Array.from(targets)
}

export const readEisThemeVariables = () => {
  if (!canUseDom()) return {}
  const rootStyle = getComputedStyle(document.documentElement)
  return EIS_THEME_VARIABLES.reduce((acc, name) => {
    const value = rootStyle.getPropertyValue(name).trim()
    if (value) acc[name] = value
    return acc
  }, {})
}

export const syncEisThemeScopes = (mountPoint = null, options = {}) => {
  if (!canUseDom()) return
  const variables = readEisThemeVariables()
  const isDark = document.documentElement.classList.contains('dark')

  collectThemeTargets(mountPoint, options.container).forEach((target) => {
    target.classList.toggle('dark', isDark)
    Object.entries(variables).forEach(([name, value]) => {
      target.style.setProperty(name, value)
    })
  })
}

export const installEisThemeSync = (mountPoint, options = {}) => {
  if (!canUseDom() || !mountPoint) return () => {}

  const sync = () => syncEisThemeScopes(mountPoint, options)
  sync()
  window.requestAnimationFrame?.(sync)
  window.setTimeout(sync, 0)

  const observer = new MutationObserver(sync)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style']
  })
  window.addEventListener(EIS_THEME_UPDATED_EVENT, sync)

  return () => {
    observer.disconnect()
    window.removeEventListener(EIS_THEME_UPDATED_EVENT, sync)
  }
}
