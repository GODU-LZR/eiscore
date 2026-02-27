/**
 * 盘点模块 API —— 对接 PostgREST / scm schema
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
import request from '@/utils/request'

const scmHeaders = {
  'Accept-Profile': 'scm',
  'Content-Profile': 'scm'
}

/* ============ 仓库 / 库位 ============ */

/** 获取所有仓库(level=1) */
export const fetchWarehouses = () =>
  request.get('/warehouses', {
    params: { level: 'eq.1', status: 'eq.启用', order: 'sort.asc,code.asc' },
    headers: scmHeaders
  })

/** 获取某仓库下的库区/库位 */
export const fetchLocationsByWarehouse = (warehouseId) =>
  request.get('/warehouses', {
    params: {
      parent_id: `eq.${warehouseId}`,
      status: 'eq.启用',
      order: 'sort.asc,code.asc'
    },
    headers: scmHeaders
  })

/** 递归获取某仓库下所有后代节点 */
export const fetchAllDescendants = async (warehouseId) => {
  const children = await fetchLocationsByWarehouse(warehouseId)
  const all = [...children]
  for (const child of children) {
    if (child.level < 3) {
      const grandchildren = await fetchAllDescendants(child.id)
      all.push(...grandchildren)
    }
  }
  return all
}

/** 按 code 获取单个仓库/库位 */
export const fetchWarehouseByCode = (code) =>
  request.get('/warehouses', {
    params: { code: `eq.${code}`, limit: 1 },
    headers: scmHeaders
  })

/* ============ 库存视图 ============ */

/** 获取当前库存(视图) — 可按仓库/物料筛选 */
export const fetchInventoryCurrent = (filters = {}) => {
  const params = {}
  if (filters.warehouse_id) params.warehouse_id = `eq.${filters.warehouse_id}`
  if (filters.warehouse_code) params.warehouse_code = `eq.${filters.warehouse_code}`
  if (filters.material_id) params.material_id = `eq.${filters.material_id}`
  params.order = 'warehouse_name.asc,material_name.asc'
  return request.get('/v_inventory_current', { params, headers: scmHeaders })
}

/** 获取某库位下所有库存 */
export const fetchInventoryByLocation = (warehouseId) =>
  request.get('/v_inventory_current', {
    params: { warehouse_id: `eq.${warehouseId}`, order: 'material_name.asc' },
    headers: scmHeaders
  })

/* ============ 物料 ============ */

/** 获取物料详情 (public schema) */
export const fetchMaterialById = (id) =>
  request.get('/raw_materials', {
    params: { id: `eq.${id}`, limit: 1 }
  })

/** 按 batch_no(即物料编码) 查物料 */
export const fetchMaterialByCode = (code) =>
  request.get('/raw_materials', {
    params: { batch_no: `eq.${code}`, limit: 1 }
  })

/* ============ 盘点单 ============ */

/** 创建盘点单 */
export const createCheck = (data) =>
  request.post('/inventory_checks', data, {
    headers: {
      ...scmHeaders,
      Prefer: 'return=representation'
    }
  })

/** 创建盘点明细 (批量) */
export const createCheckItems = (items) =>
  request.post('/inventory_check_items', items, {
    headers: {
      ...scmHeaders,
      Prefer: 'return=representation'
    }
  })

/** 更新盘点单状态 */
export const updateCheckStatus = (checkId, status) =>
  request.patch('/inventory_checks', { status }, {
    params: { id: `eq.${checkId}` },
    headers: scmHeaders
  })

/* ============ 库存调整(盘盈/盘亏) ============ */

/** 生成库存调整流水 */
export const createTransaction = (data) =>
  request.post('/inventory_transactions', data, {
    headers: {
      ...scmHeaders,
      Prefer: 'return=representation'
    }
  })

/** 批量生成库存调整流水 */
export const createTransactions = (list) =>
  request.post('/inventory_transactions', list, {
    headers: {
      ...scmHeaders,
      Prefer: 'return=representation'
    }
  })

/** 更新库存批次数量(盘盈增加/盘亏扣减) */
export const adjustBatchQty = (batchId, availableQty) =>
  request.patch('/inventory_batches', { available_qty: availableQty }, {
    params: { id: `eq.${batchId}` },
    headers: scmHeaders
  })

/** 按物料+仓库查询批次 */
export const fetchBatch = (materialId, warehouseId) =>
  request.get('/inventory_batches', {
    params: {
      material_id: `eq.${materialId}`,
      warehouse_id: `eq.${warehouseId}`,
      status: 'eq.正常',
      limit: 1,
      order: 'created_at.desc'
    },
    headers: scmHeaders
  })

/* ============ 辅助 ============ */

/** 生成盘点单号 */
export const buildCheckNo = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  const seq = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CK${y}${m}${d}${seq}`
}

/** 生成调整单号 */
export const buildTransactionNo = (prefix = 'ADJ') => {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  const seq = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}${y}${m}${d}${seq}`
}
