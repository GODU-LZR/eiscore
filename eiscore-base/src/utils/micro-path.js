// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const MICRO_PREFIXES = new Set([
  'apps',
  'hr',
  'materials',
  'sales',
  'purchase',
  'production',
  'quality',
  'equipment',
  'decision'
])

const APPS_LOCAL_ROUTES = new Set([
  'app',
  'config-center',
  'workflow-designer',
  'flash-builder',
  'data-app',
  'ontology-relations',
  'workflow-approval-center',
  'preview',
  '__preview__'
])

const preserveKnownChildRoute = (segments) => {
  if (segments.length < 3) return false
  if (segments[0] === 'apps' && APPS_LOCAL_ROUTES.has(segments[1])) return true
  if (segments[1] === 'app' || segments[1] === 'document') return true
  if (segments[0] === 'materials' && ['material', 'inventory-draft', 'inventory-check'].includes(segments[1])) return true
  return false
}

const resolveModuleEntryAlias = (segments) => {
  if (segments.length !== 2) return ''
  const [moduleName, child] = segments
  if (moduleName === 'apps') return ''
  if (!MICRO_PREFIXES.has(moduleName)) return ''
  if (child === 'apps' || child === 'index.html') return `/${moduleName}`
  return ''
}

export const ensureAbsoluteHostPath = (value) => {
  const raw = String(value || '').trim() || '/'
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw
  return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`
}

export const canonicalizeMicroChainPath = (value) => {
  const path = ensureAbsoluteHostPath(value)
  if (path === '/' || /^[a-z][a-z0-9+.-]*:/i.test(path)) return path
  const parts = path.split('?')
  const hashParts = parts[0].split('#')
  const pathname = hashParts[0] || '/'
  const suffix = `${hashParts[1] ? `#${hashParts[1]}` : ''}${parts[1] ? `?${parts[1]}` : ''}`
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2 || preserveKnownChildRoute(segments)) return path

  const moduleEntry = resolveModuleEntryAlias(segments)
  if (moduleEntry) return `${moduleEntry}${suffix}`

  const positions = []
  segments.forEach((segment, index) => {
    if (MICRO_PREFIXES.has(segment)) positions.push(index)
  })
  if (positions.length < 2) return path

  const lastPrefixIndex = positions[positions.length - 1]
  const canonical = `/${segments.slice(lastPrefixIndex).join('/')}`
  return `${canonical}${suffix}`
}
