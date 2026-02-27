/**
 * 盘点本地缓存 — 用于冷库/离线模式
 */
const CACHE_KEY = 'eiscore_check_cache_v1'
const MODE_KEY = 'eiscore_check_cold_mode_v1'
const PENDING_KEY = 'eiscore_check_pending_v1'

const safeParse = (raw, fallback) => {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

/* ---- Cache ---- */
export const getCheckCache = () => {
  const cached = safeParse(localStorage.getItem(CACHE_KEY), null)
  if (!cached || !Array.isArray(cached.warehouses)) return null
  return cached
}

export const setCheckCache = (payload) => {
  const data = payload || {}
  const cache = {
    version: 1,
    updatedAt: Date.now(),
    warehouses: Array.isArray(data.warehouses) ? data.warehouses : [],
    meta: data.meta || {}
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  return cache
}

export const clearCheckCache = () => localStorage.removeItem(CACHE_KEY)

/* ---- Cold Mode ---- */
export const getColdMode = () => localStorage.getItem(MODE_KEY) === '1'
export const setColdMode = (on) => localStorage.setItem(MODE_KEY, on ? '1' : '0')

/* ---- Pending Checks ---- */
export const getPendingChecks = () => safeParse(localStorage.getItem(PENDING_KEY), [])

export const addPendingCheck = (entry) => {
  const list = getPendingChecks()
  list.push(entry)
  localStorage.setItem(PENDING_KEY, JSON.stringify(list))
  return list
}

export const removePendingChecks = (ids) => {
  const idSet = new Set(ids || [])
  if (!idSet.size) return getPendingChecks()
  const next = getPendingChecks().filter((i) => !idSet.has(i.id))
  localStorage.setItem(PENDING_KEY, JSON.stringify(next))
  return next
}

export const clearPendingChecks = () => localStorage.removeItem(PENDING_KEY)
