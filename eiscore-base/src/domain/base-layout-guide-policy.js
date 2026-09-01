// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const BASE_SOP_ROLE_ALIASES = {
  warehouse: 'warehouse',
  warehouse_keeper: 'warehouse',
  storekeeper: 'warehouse',
  mms: 'warehouse',
  materials: 'warehouse',
  sales: 'sales',
  salesperson: 'sales',
  sale: 'sales',
  purchase: 'purchase',
  procurement: 'purchase',
  buyer: 'purchase',
  production: 'production',
  pmc: 'production',
  production_supervisor: 'production',
  quality: 'quality',
  qc: 'quality',
  qa: 'quality',
  inspector: 'quality',
  equipment: 'equipment',
  maintenance: 'equipment',
  equipment_admin: 'equipment',
  hr: 'hr_admin',
  hr_admin: 'hr_admin',
  human_resource: 'hr_admin',
  manager: 'manager',
  management: 'manager',
  decision: 'manager',
  boss: 'manager'
}

export const normalizeBaseSopRole = (value) => {
  const key = String(value || '').trim().toLowerCase()
  return BASE_SOP_ROLE_ALIASES[key] || key
}

export const normalizeBaseGuideText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

export const normalizeBaseGuideId = (value) => normalizeBaseGuideText(value)
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
  .replace(/^-+|-+$/g, '') || 'current'

export const parseBaseSopStepTexts = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((item) => normalizeBaseGuideText(item)).filter(Boolean)
  } catch (e) {}
  return raw
    .split('|')
    .map((item) => normalizeBaseGuideText(item))
    .filter(Boolean)
}

export const normalizeBaseExternalGuide = (input) => {
  if (!input || typeof input !== 'object') return null
  const id = String(input.id || '').trim()
  const title = String(input.title || '').trim()
  const steps = Array.isArray(input.steps) ? input.steps : []
  if (!id || !title || !steps.length) return null
  return {
    id,
    title,
    description: String(input.description || ''),
    type: input.type === 'sop' ? 'sop' : 'guide',
    category: String(input.category || ''),
    routes: Array.isArray(input.routes) ? input.routes.map((item) => String(item || '').trim()).filter(Boolean) : [],
    priority: Number(input.priority || 30),
    steps: steps
      .map((step) => {
        const selector = String(step?.selector || step?.element || '').trim()
        if (!selector) return null
        return {
          element: selector,
          popover: {
            title: String(step?.title || '操作提示'),
            description: String(step?.description || ''),
            side: String(step?.side || 'bottom'),
            align: String(step?.align || 'start')
          }
        }
      })
      .filter(Boolean)
  }
}

export const pickBaseRecommendedGuide = (guides, unseenOnly = false, hasSeen = () => false) => {
  const list = Array.isArray(guides) ? guides : []
  const candidates = unseenOnly ? list.filter((guide) => !hasSeen(guide)) : list
  if (!candidates.length) return null
  return candidates.find((guide) => guide.category === '当前应用') ||
    candidates.find((guide) => guide.category === '应用卡片' && !String(guide.id || '').includes('-app-cards')) ||
    candidates.find((guide) => guide.type === 'sop') ||
    candidates[0] ||
    null
}

export const shortenBaseGuideDescription = (value, maxLength = 180) => {
  const text = normalizeBaseGuideText(value)
  if (text.length <= maxLength) return text
  const sentenceEnd = text.slice(0, maxLength).search(/[。；;.!?？]/)
  if (sentenceEnd >= 36) return text.slice(0, sentenceEnd + 1)
  return `${text.slice(0, maxLength).trim()}...`
}

export const compactBaseGuideSteps = (steps) => steps.map((step) => ({
  ...step,
  popover: {
    ...(step.popover || {}),
    description: shortenBaseGuideDescription(step.popover?.description || '')
  }
}))

export const normalizeBaseGuideProgressEntry = (entry) => {
  if (!entry) return null
  if (typeof entry === 'string') return { seenAt: entry, completedAt: '' }
  if (typeof entry === 'object') {
    return {
      seenAt: String(entry.seenAt || entry.seen_at || entry.viewedAt || ''),
      completedAt: String(entry.completedAt || entry.completed_at || '')
    }
  }
  return null
}

export const normalizeBaseGuideProgress = (progress = {}) => Object.fromEntries(
  Object.entries(progress)
    .map(([key, entry]) => [key, normalizeBaseGuideProgressEntry(entry)])
    .filter(([, entry]) => entry)
)
