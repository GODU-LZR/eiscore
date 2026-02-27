/**
 * 仓库查询模块 API
 *
 * 复用 scm.warehouses / scm.v_inventory_current / public.raw_materials
 */
import { getToken } from '@/utils/auth'

const API_BASE = '/api'

const scmHeaders = {
  'Accept-Profile': 'scm',
  'Content-Profile': 'scm'
}

async function request(method, path, { params, body, headers: extraHeaders } = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...scmHeaders,
    ...extraHeaders
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let url = `${API_BASE}${path}`
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    window.location.href = '/mobile/login'
    throw new Error('登录已过期')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `请求失败 (${res.status})`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function get(path, opts) { return request('GET', path, opts) }

/* ============ 仓库 ============ */

/** 所有仓库 (level=1) */
export const fetchWarehouses = () =>
  get('/warehouses', { params: { level: 'eq.1', status: 'eq.启用', order: 'sort.asc,code.asc' } })

/** 所有仓库（含停用） */
export const fetchAllWarehouses = () =>
  get('/warehouses', { params: { level: 'eq.1', order: 'sort.asc,code.asc' } })

/** 仓库下的子节点（库区/库位） */
export const fetchChildren = (parentId) =>
  get('/warehouses', { params: { parent_id: `eq.${parentId}`, order: 'sort.asc,code.asc' } })

/** 按编码查仓库 */
export const fetchWarehouseByCode = (code) =>
  get('/warehouses', { params: { code: `eq.${code}`, limit: 1 } })

/* ============ 库存 ============ */

/** 指定仓库/库位的当前库存 */
export const fetchInventory = (warehouseId) =>
  get('/v_inventory_current', { params: { warehouse_id: `eq.${warehouseId}`, order: 'material_name.asc' } })

/** 全部当前库存 */
export const fetchAllInventory = () =>
  get('/v_inventory_current', { params: { order: 'material_name.asc' } })

/* ============ 物料 ============ */

export const fetchAllMaterials = () =>
  get('/raw_materials', {
    params: { order: 'name.asc' },
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })

export const fetchMaterialById = (id) =>
  get('/raw_materials', {
    params: { id: `eq.${id}`, limit: 1 },
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })

/* ============ 库存批次 ============ */

export const fetchBatches = (warehouseId) =>
  get('/inventory_batches', {
    params: { warehouse_id: `eq.${warehouseId}`, status: 'eq.正常', order: 'created_at.desc' }
  })

export const fetchAllBatches = () =>
  get('/inventory_batches', { params: { status: 'eq.正常', order: 'created_at.desc' } })

/* ============ 流水 ============ */

export const fetchTransactions = (opts = {}) => {
  const params = { order: 'created_at.desc', ...opts }
  return get('/inventory_transactions', { params })
}

export const fetchRecentTransactions = (limit = 20) =>
  get('/inventory_transactions', { params: { order: 'created_at.desc', limit } })

/* ============ 盘点单 ============ */

export const fetchChecks = (opts = {}) => {
  const params = { order: 'created_at.desc', ...opts }
  return get('/inventory_checks', { params })
}

export const fetchCheckItems = (checkId) =>
  get('/inventory_check_items', { params: { check_id: `eq.${checkId}`, order: 'id.asc' } })
