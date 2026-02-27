/**
 * 出入库模块 API —— 移动端版本
 *
 * 表对照:
 *   scm.warehouses            仓库/库区/库位 (level = 1/2/3)
 *   scm.inventory_batches     库存批次
 *   scm.inventory_transactions 库存流水
 *   scm.v_inventory_current   库存视图
 *   scm.stock_in              入库 RPC
 *   scm.stock_out             出库 RPC
 *   public.raw_materials      物料主数据
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

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })

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

/* ============ 仓库 / 库位 ============ */

/** 获取顶级仓库列表 */
export const fetchWarehouses = () =>
  get('/warehouses', { params: { level: 'eq.1', status: 'eq.启用', order: 'sort.asc,code.asc' } })

/** 获取仓库的子库位（level 2 和 3） */
export const fetchLocationsByWarehouse = (warehouseId) =>
  get('/warehouses', {
    params: { parent_id: `eq.${warehouseId}`, status: 'eq.启用', order: 'sort.asc,code.asc' }
  })

/** 根据编码查仓库/库位 */
export const fetchWarehouseByCode = (code) =>
  get('/warehouses', { params: { code: `eq.${code}`, limit: 1 } })

/* ============ 物料 ============ */

/** 查询所有物料 */
export const fetchAllMaterials = () =>
  get('/raw_materials', {
    params: { order: 'name.asc' },
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })

/** 根据 ID 查物料 */
export const fetchMaterialById = (id) =>
  get('/raw_materials', {
    params: { id: `eq.${id}`, limit: 1 },
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })

/** 根据编码(batch_no 字段)查物料 */
export const fetchMaterialByCode = (code) =>
  get('/raw_materials', {
    params: { batch_no: `eq.${code}`, limit: 1 },
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })

/** 搜索物料（名称/编码模糊匹配） */
export const searchMaterials = (keyword) =>
  get('/raw_materials', {
    params: { or: `(name.ilike.*${keyword}*,batch_no.ilike.*${keyword}*)`, limit: 20, order: 'name.asc' },
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
  })

/* ============ 库存批次 ============ */

/** 获取指定物料在指定库位的批次列表 */
export const fetchBatches = (materialId, warehouseId) =>
  get('/inventory_batches', {
    params: {
      material_id: `eq.${materialId}`,
      warehouse_id: `eq.${warehouseId}`,
      status: 'eq.正常',
      order: 'created_at.desc'
    }
  })

/** 获取指定库位下所有批次 */
export const fetchBatchesByWarehouse = (warehouseId) =>
  get('/inventory_batches', {
    params: {
      warehouse_id: `eq.${warehouseId}`,
      status: 'eq.正常',
      order: 'created_at.desc'
    }
  })

/* ============ 库存视图 ============ */

/** 获取指定库位的实时库存 */
export const fetchInventoryByLocation = (warehouseId) =>
  get('/v_inventory_current', {
    params: { warehouse_id: `eq.${warehouseId}`, order: 'material_name.asc' }
  })

/* ============ 出入库 RPC ============ */

/**
 * 调用入库 RPC
 * @param {Object} data - { material_id, warehouse_id, quantity, unit, batch_no, operator, production_date, remark, io_type }
 */
export const stockIn = (data) =>
  post('/rpc/stock_in', {
    p_material_id: data.material_id,
    p_warehouse_id: data.warehouse_id,
    p_quantity: data.quantity,
    p_unit: data.unit,
    p_batch_no: data.batch_no,
    p_transaction_no: data.transaction_no || null,
    p_operator: data.operator || null,
    p_production_date: data.production_date || null,
    p_remark: data.remark || null,
    p_io_type: data.io_type || null
  })

/**
 * 调用出库 RPC
 * @param {Object} data - { material_id, warehouse_id, quantity, unit, batch_no, operator, remark, io_type }
 */
export const stockOut = (data) =>
  post('/rpc/stock_out', {
    p_material_id: data.material_id,
    p_warehouse_id: data.warehouse_id,
    p_quantity: data.quantity,
    p_unit: data.unit,
    p_batch_no: data.batch_no,
    p_transaction_no: data.transaction_no || null,
    p_operator: data.operator || null,
    p_remark: data.remark || null,
    p_io_type: data.io_type || null
  })

/* ============ 流水查询 ============ */

/** 查询最近流水 */
export const fetchRecentTransactions = (limit = 20) =>
  get('/v_inventory_transactions', {
    params: { order: 'transaction_date.desc', limit }
  })

/* ============ 辅助 ============ */

/** 生成入库单号 */
export const buildInNo = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  const seq = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `IN${y}${m}${d}${seq}`
}

/** 生成出库单号 */
export const buildOutNo = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  const seq = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `OUT${y}${m}${d}${seq}`
}

/** 默认出入库类型 */
export const IO_TYPES_IN = [
  { label: '采购入库', value: '采购入库' },
  { label: '退货入库', value: '退货入库' },
  { label: '盘盈入库', value: '盘盈入库' },
  { label: '其他入库', value: '其他入库' }
]

export const IO_TYPES_OUT = [
  { label: '销售出库', value: '销售出库' },
  { label: '调拨出库', value: '调拨出库' },
  { label: '盘亏出库', value: '盘亏出库' },
  { label: '其他出库', value: '其他出库' }
]
