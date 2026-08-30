// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

/**
 * 仓库查询模块 API
 *
 * 复用 scm.warehouses / scm.v_inventory_current / public.raw_materials
 */
import { createMobileProfileRequest } from './request'

const { get } = createMobileProfileRequest('scm')

/* ============ 仓库 ============ */

/** 所有仓库 (level=1) */
export const fetchWarehouses = () =>
  get('/warehouses', { params: { level: 'eq.1', status: 'eq.启用', order: 'sort.asc,code.asc' } })

/** 所有仓库（含停用） */
export const fetchAllWarehouses = () =>
  get('/warehouses', { params: { level: 'eq.1', order: 'sort.asc,code.asc' } })

/** PDA 首页仓库简表（保持原查询范围） */
export const fetchPdaWarehouses = () =>
  get('/warehouses', { params: { select: 'code,name', order: 'code.asc' } })

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

export const fetchRecentChecks = (limit = 5) =>
  get('/inventory_checks', {
    params: {
      select: 'id,check_no,warehouse_id,check_date,status,total_items,diff_count,created_at',
      order: 'created_at.desc',
      limit
    }
  })

export const fetchCheckItems = (checkId) =>
  get('/inventory_check_items', { params: { check_id: `eq.${checkId}`, order: 'id.asc' } })
