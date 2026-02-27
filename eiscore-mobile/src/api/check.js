/**
 * 盘点模块 API —— 移动端版本（基于 fetch，不依赖 axios）
 *
 * 表对照:
 *   scm.warehouses           仓库/库区/库位 (level = 1/2/3)
 *   scm.inventory_batches    库存批次
 *   scm.inventory_checks     盘点单主表
 *   scm.inventory_check_items 盘点单明细
 *   scm.inventory_transactions 库存流水
 *   scm.v_inventory_current  库存视图
 *   public.raw_materials     物料主数据
 */
import { getToken } from '@/utils/auth'

const API_BASE = '/api'

const scmHeaders = {
  'Accept-Profile': 'scm',
  'Content-Profile': 'scm'
}

/** 内部 fetch 封装 */
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
function post(path, data, opts = {}) { return request('POST', path, { ...opts, body: data }) }
function patch(path, data, opts = {}) { return request('PATCH', path, { ...opts, body: data }) }

/* ============ 仓库 / 库位 ============ */

export const fetchWarehouses = () =>
  get('/warehouses', { params: { level: 'eq.1', status: 'eq.启用', order: 'sort.asc,code.asc' } })

export const fetchLocationsByWarehouse = (warehouseId) =>
  get('/warehouses', {
    params: { parent_id: `eq.${warehouseId}`, status: 'eq.启用', order: 'sort.asc,code.asc' }
  })

export const fetchWarehouseByCode = (code) =>
  get('/warehouses', { params: { code: `eq.${code}`, limit: 1 } })

/* ============ 库存视图 ============ */

export const fetchInventoryByLocation = (warehouseId) =>
  get('/v_inventory_current', {
    params: { warehouse_id: `eq.${warehouseId}`, order: 'material_name.asc' }
  })

/* ============ 物料 ============ */

export const fetchMaterialById = (id) =>
  get('/raw_materials', {
    params: { id: `eq.${id}`, limit: 1 },
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })

/* ============ 盘点单 ============ */

export const createCheck = (data) =>
  post('/inventory_checks', data, { headers: { Prefer: 'return=representation' } })

export const createCheckItems = (items) =>
  post('/inventory_check_items', items, { headers: { Prefer: 'return=representation' } })

export const updateCheckStatus = (checkId, status) =>
  patch('/inventory_checks', { status }, { params: { id: `eq.${checkId}` } })

/* ============ 库存调整(盘盈/盘亏) ============ */

export const createTransactions = (list) =>
  post('/inventory_transactions', list, { headers: { Prefer: 'return=representation' } })

export const adjustBatchQty = (batchId, availableQty) =>
  patch('/inventory_batches', { available_qty: availableQty }, { params: { id: `eq.${batchId}` } })

export const fetchBatch = (materialId, warehouseId) =>
  get('/inventory_batches', {
    params: {
      material_id: `eq.${materialId}`,
      warehouse_id: `eq.${warehouseId}`,
      status: 'eq.正常',
      limit: 1,
      order: 'created_at.desc'
    }
  })

/* ============ 辅助 ============ */

export const buildCheckNo = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  const seq = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CK${y}${m}${d}${seq}`
}

export const buildTransactionNo = (prefix = 'ADJ') => {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  const seq = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}${y}${m}${d}${seq}`
}
