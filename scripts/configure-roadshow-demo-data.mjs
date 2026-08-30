// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHttpClient, normalizePositiveInteger } from '../tests/engineering/http-client.mjs'

const BASE_URL = (process.env.EISCORE_ROADSHOW_BASE_URL || process.env.EISCORE_BASE_URL || 'https://nanpai.eissys.top').replace(/\/+$/, '')
const USERNAME = process.env.EISCORE_ROADSHOW_USERNAME || process.env.EISCORE_SMOKE_USERNAME || 'admin'
const PASSWORD = process.env.EISCORE_ROADSHOW_PASSWORD || process.env.EISCORE_SMOKE_PASSWORD || '123456'
const RESULT_FILE = process.env.EISCORE_ROADSHOW_RESULT || 'tests/.artifacts/roadshow-demo-data-result.json'
const REQUEST_TIMEOUT_MS = normalizePositiveInteger(process.env.EISCORE_ROADSHOW_TIMEOUT_MS, 20000, { min: 1000, max: 180000 })
const REQUEST_ATTEMPTS = normalizePositiveInteger(process.env.EISCORE_ROADSHOW_REQUEST_ATTEMPTS, 3, { min: 1, max: 8 })
const BASE_DATE = process.env.EISCORE_ROADSHOW_DATE || new Date().toISOString().slice(0, 10)

const http = createHttpClient({
  baseUrl: BASE_URL,
  requestAttempts: REQUEST_ATTEMPTS,
  timeoutMs: REQUEST_TIMEOUT_MS,
  retryUnsafeMethods: false
})

const generatedAt = new Date().toISOString()
const results = []
let token = ''

const dayMs = 24 * 60 * 60 * 1000

function dateOffset(days) {
  const date = new Date(`${BASE_DATE}T00:00:00.000Z`)
  date.setTime(date.getTime() + days * dayMs)
  return date.toISOString().slice(0, 10)
}

function addResult(section, pass, detail, extra = {}) {
  results.push({ section, pass, detail, ...extra })
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function enc(value) {
  return encodeURIComponent(String(value))
}

function rowsOf(value) {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  return [value]
}

function rowOf(value) {
  return rowsOf(value)[0] || null
}

function schemaHeaders(schema, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Profile': schema,
    'Content-Profile': schema,
    ...extra
  }
}

function buildQuery(filters = {}, select = '*', extra = []) {
  const params = []
  for (const [key, value] of Object.entries(filters)) {
    params.push(`${key}=eq.${enc(value)}`)
  }
  if (select) params.push(`select=${enc(select)}`)
  params.push(...extra)
  return params.length ? `?${params.join('&')}` : ''
}

async function request(path, { method = 'GET', headers = {}, body, timeout = REQUEST_TIMEOUT_MS } = {}) {
  const out = await http.requestJson(path, { method, headers, body, timeout })
  if (!out.ok) {
    const detail = typeof out.data === 'string' ? out.data : JSON.stringify(out.data)
    throw new Error(`${method} ${path} -> ${out.status}: ${String(detail || '').slice(0, 500)}`)
  }
  return out
}

async function login() {
  const out = await request('/api/rpc/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { username: USERNAME, password: PASSWORD }
  })
  token = String(out.data?.token || '')
  ensure(token.length > 100, 'login response did not include a valid JWT token')
  addResult('login', true, `token_len=${token.length}`, { statusCode: out.status })
}

async function listRows(schema, table, filters = {}, select = '*', extra = []) {
  const out = await request(`/api/${table}${buildQuery(filters, select, extra)}`, {
    headers: schemaHeaders(schema)
  })
  return rowsOf(out.data)
}

async function firstRow(schema, table, filters = {}, select = '*', extra = []) {
  return rowOf(await listRows(schema, table, filters, select, extra))
}

async function upsertOne(schema, table, filters, payload, select = '*') {
  const existing = await firstRow(schema, table, filters, select)
  if (existing) {
    const out = await request(`/api/${table}${buildQuery(filters, select)}`, {
      method: 'PATCH',
      headers: schemaHeaders(schema, { Prefer: 'return=representation' }),
      body: payload
    })
    return { row: rowOf(out.data) || existing, action: 'updated', statusCode: out.status }
  }

  const out = await request(`/api/${table}?select=${enc(select)}`, {
    method: 'POST',
    headers: schemaHeaders(schema, { Prefer: 'return=representation' }),
    body: payload
  })
  return { row: rowOf(out.data), action: 'created', statusCode: out.status }
}

async function deleteRows(schema, table, filters) {
  const out = await request(`/api/${table}${buildQuery(filters, '')}`, {
    method: 'DELETE',
    headers: schemaHeaders(schema)
  })
  return out.status
}

async function section(name, fn) {
  try {
    const value = await fn()
    addResult(name, true, typeof value === 'string' ? value : JSON.stringify(value))
    return value
  } catch (error) {
    addResult(name, false, error?.message || String(error))
    throw error
  }
}

async function upsertMany(schema, table, keyField, rows, select = '*') {
  const stats = { created: 0, updated: 0 }
  const byKey = new Map()
  for (const payload of rows) {
    const result = await upsertOne(schema, table, { [keyField]: payload[keyField] }, payload, select)
    stats[result.action] += 1
    byKey.set(payload[keyField], result.row)
  }
  return { stats, byKey }
}

const hrArchives = [
  { employee_no: 'RS-HR-001', name: '许计划', department: '生产一部', position: '生产计划员', phone: '13800009001', status: '在职', base_salary: 7600, entry_date: dateOffset(-118), properties: { roadshow: true, role: '生产排程', highlight: '负责把销售订单转为生产计划' } },
  { employee_no: 'RS-HR-002', name: '高渠道', department: '销售部', position: '渠道销售', phone: '13800009002', status: '在职', base_salary: 7200, entry_date: dateOffset(-96), properties: { roadshow: true, role: '大客户销售', highlight: '负责华东商超与集采客户' } },
  { employee_no: 'RS-HR-003', name: '罗采购', department: '采购部', position: '采购专员', phone: '13800009003', status: '在职', base_salary: 6900, entry_date: dateOffset(-88), properties: { roadshow: true, role: '采购执行', highlight: '负责香辛料、包材供应商协同' } },
  { employee_no: 'RS-HR-004', name: '马质检', department: '质量部', position: '质检员', phone: '13800009004', status: '在职', base_salary: 6500, entry_date: dateOffset(-74), properties: { roadshow: true, role: '质量闭环', highlight: '负责来料检验与过程巡检' } },
  { employee_no: 'RS-HR-005', name: '朱设备', department: '设备部', position: '设备维修员', phone: '13800009005', status: '在职', base_salary: 6800, entry_date: dateOffset(-60), properties: { roadshow: true, role: '设备维修', highlight: '负责灌装线与包装线维保' } }
]

const materialCodes = ['MAT-RM-004', 'MAT-RM-006', 'MAT-AUX-008', 'MAT-AUX-005', 'MAT-PKG-004', 'MAT-FG-004', 'MAT-FG-005']

const warehouseTree = [
  { code: 'RS-RM', name: '路演原辅料仓', parentCode: null, level: 1, sort: 110, capacity: 7200, unit: '千克', properties: { roadshow: true, temperature: '-18C/常温分区', purpose: '路演原料与辅料' } },
  { code: 'RS-PKG', name: '路演包材仓', parentCode: null, level: 1, sort: 120, capacity: 30000, unit: '个', properties: { roadshow: true, temperature: '常温', purpose: '路演内外包装' } },
  { code: 'RS-FG', name: '路演成品仓', parentCode: null, level: 1, sort: 130, capacity: 5200, unit: '盒', properties: { roadshow: true, temperature: '-18C', purpose: '路演成品冷冻存储' } },
  { code: 'RS-RM-COLD', name: '路演冷冻原料区', parentCode: 'RS-RM', level: 2, sort: 111, capacity: 5200, unit: '千克', properties: { roadshow: true, area: 'A区', temperature: '-18C' } },
  { code: 'RS-RM-AUX', name: '路演辅料常温区', parentCode: 'RS-RM', level: 2, sort: 112, capacity: 1500, unit: '千克', properties: { roadshow: true, area: 'B区', temperature: '常温' } },
  { code: 'RS-PKG-A', name: '路演包材A区', parentCode: 'RS-PKG', level: 2, sort: 121, capacity: 24000, unit: '个', properties: { roadshow: true, area: 'A区', temperature: '常温' } },
  { code: 'RS-FG-A', name: '路演成品A区', parentCode: 'RS-FG', level: 2, sort: 131, capacity: 4200, unit: '盒', properties: { roadshow: true, area: 'A区', temperature: '-18C' } },
  { code: 'RS-RM-A01', name: '路演冷冻A01库位', parentCode: 'RS-RM-COLD', level: 3, sort: 113, capacity: 2600, unit: '千克', properties: { roadshow: true, layout_zone: '冷冻原料主库位' } },
  { code: 'RS-RM-B01', name: '路演辅料B01库位', parentCode: 'RS-RM-AUX', level: 3, sort: 114, capacity: 1800, unit: '千克', properties: { roadshow: true, layout_zone: '辅料常温库位' } },
  { code: 'RS-PKG-A01', name: '路演包材A01库位', parentCode: 'RS-PKG-A', level: 3, sort: 122, capacity: 28000, unit: '个', properties: { roadshow: true, layout_zone: '包材主库位' } },
  { code: 'RS-FG-A01', name: '路演成品A01库位', parentCode: 'RS-FG-A', level: 3, sort: 132, capacity: 3600, unit: '盒', properties: { roadshow: true, layout_zone: '新品成品库位' } }
]

const salesCustomers = [
  { customer_no: 'RS-CUST-001', name: '华东鲜食连锁', level: '战略客户', contact_name: '周明', contact_phone: '13800009101', region: '华东一区', owner_name: '高渠道', customer_status: '已成交', credit_limit: 900000, receivable_balance: 132800, last_follow_up_at: dateOffset(-1), status: 'active', properties: { roadshow: true, channel: 'KA商超', concern: '端午补货和冷链交付' } },
  { customer_no: 'RS-CUST-002', name: '湾区团餐供应链', level: '重点客户', contact_name: '赵琳', contact_phone: '13800009102', region: '华南一区', owner_name: '高渠道', customer_status: '跟进中', credit_limit: 560000, receivable_balance: 0, last_follow_up_at: dateOffset(-2), status: 'active', properties: { roadshow: true, channel: '团餐', concern: '稳定供应和批次追溯' } },
  { customer_no: 'RS-CUST-003', name: '城市生鲜前置仓', level: '重点客户', contact_name: '陈启', contact_phone: '13800009103', region: '华东二区', owner_name: '高渠道', customer_status: '报价中', credit_limit: 420000, receivable_balance: 38600, last_follow_up_at: dateOffset(-3), status: 'active', properties: { roadshow: true, channel: '城市仓配', concern: '新品试销和库存锁定' } }
]

const purchaseSuppliers = [
  { supplier_no: 'RS-SUP-001', name: '海南深海食材', level: '核心', contact_name: '梁敏', contact_phone: '13900009201', category: '水产原料', payment_terms: '月结30天', lead_time_days: 4, buyer_name: '罗采购', supplier_status: '合作中', last_review_at: dateOffset(-18), status: 'active', properties: { roadshow: true, certification: 'SC认证', region: '华南' } },
  { supplier_no: 'RS-SUP-002', name: '江门绿田包装材料', level: '战略', contact_name: '陈辉', contact_phone: '13900009202', category: '包装材料', payment_terms: '货到30天', lead_time_days: 7, buyer_name: '罗采购', supplier_status: '合作中', last_review_at: dateOffset(-21), status: 'active', properties: { roadshow: true, certification: 'ISO22000', category_detail: '耐冻袋/标签' } },
  { supplier_no: 'RS-SUP-003', name: '广州鲜味蛋白科技', level: '核心', contact_name: '孙宁', contact_phone: '13900009203', category: '复合调味', payment_terms: '月结45天', lead_time_days: 5, buyer_name: '罗采购', supplier_status: '合作中', last_review_at: dateOffset(-9), status: 'active', properties: { roadshow: true, certification: 'HACCP' } }
]

const qualityStandards = [
  { standard_no: 'RS-STD-RM-001', standard_name: '冷冻水产原料来料检验标准', item_category: '水产原料', version: 'V2', effective_date: dateOffset(-30), owner_name: '马质检', standard_status: '生效', key_metrics: '温度、净含量、异物、感官、微生物', status: 'active', properties: { roadshow: true } },
  { standard_no: 'RS-STD-FG-001', standard_name: '预制菜成品放行标准', item_category: '成品', version: 'V3', effective_date: dateOffset(-26), owner_name: '马质检', standard_status: '生效', key_metrics: '外观、密封性、净含量、菌落总数', status: 'active', properties: { roadshow: true } }
]

const equipmentStandards = [
  { standard_no: 'RS-ES-FILL-001', standard_name: '灌装线日常点检标准', asset_type: '灌装设备', version: 'V2', effective_date: dateOffset(-25), owner_name: '朱设备', standard_status: '生效', key_items: '扭矩、气压、密封、异响、润滑', status: 'active', properties: { roadshow: true } },
  { standard_no: 'RS-ES-PACK-001', standard_name: '封箱机预防保养标准', asset_type: '包装设备', version: 'V1', effective_date: dateOffset(-18), owner_name: '朱设备', standard_status: '生效', key_items: '传送带、刀片、胶带张力、急停', status: 'active', properties: { roadshow: true } }
]

async function seedHr() {
  const { stats } = await upsertMany('hr', 'archives', 'employee_no', hrArchives, 'id,employee_no,name,department,position,status')
  return `archives created=${stats.created}, updated=${stats.updated}`
}

async function seedMaterialsAndWarehouses() {
  const materialRows = await listRows('public', 'raw_materials', {}, 'id,batch_no,name,category', [
    `batch_no=in.(${materialCodes.map(enc).join(',')})`
  ])
  const materialByCode = new Map(materialRows.map((row) => [row.batch_no, row]))
  for (const code of materialCodes) {
    ensure(materialByCode.has(code), `required remote material not found: ${code}`)
  }

  const warehouseByCode = new Map()
  for (const item of warehouseTree) {
    const parent = item.parentCode ? warehouseByCode.get(item.parentCode) || await firstRow('scm', 'warehouses', { code: item.parentCode }, 'id,code') : null
    const payload = {
      code: item.code,
      name: item.name,
      parent_id: parent?.id || null,
      level: item.level,
      sort: item.sort,
      status: '启用',
      capacity: item.capacity,
      unit: item.unit,
      properties: item.properties,
      created_by: 'roadshow'
    }
    const { row } = await upsertOne('scm', 'warehouses', { code: item.code }, payload, 'id,code,name,parent_id,level')
    warehouseByCode.set(item.code, row)
  }

  const batches = [
    { material: 'MAT-RM-004', batch_no: 'RS-BATCH-RM-001', warehouse: 'RS-RM-A01', available_qty: 610, locked_qty: 40, unit: '千克', production_date: dateOffset(-12), expiry_date: dateOffset(250), supplier: '海南深海食材', purchase_price: 38.5, status: '正常', properties: { roadshow: true, quality_status: '合格' } },
    { material: 'MAT-RM-006', batch_no: 'RS-BATCH-RM-002', warehouse: 'RS-RM-A01', available_qty: 330, locked_qty: 25, unit: '千克', production_date: dateOffset(-11), expiry_date: dateOffset(230), supplier: '福建蓝海贝业', purchase_price: 28, status: '正常', properties: { roadshow: true, quality_status: '待复检' } },
    { material: 'MAT-AUX-008', batch_no: 'RS-BATCH-AUX-001', warehouse: 'RS-RM-B01', available_qty: 145, locked_qty: 10, unit: '千克', production_date: dateOffset(-10), expiry_date: dateOffset(150), supplier: '广州鲜味蛋白科技', purchase_price: 24.8, status: '正常', properties: { roadshow: true, quality_status: '合格' } },
    { material: 'MAT-AUX-005', batch_no: 'RS-BATCH-AUX-002', warehouse: 'RS-RM-B01', available_qty: 165, locked_qty: 12, unit: '千克', production_date: dateOffset(-10), expiry_date: dateOffset(160), supplier: '广东味源香料有限公司', purchase_price: 18.6, status: '正常', properties: { roadshow: true, quality_status: '合格' } },
    { material: 'MAT-PKG-004', batch_no: 'RS-BATCH-PKG-001', warehouse: 'RS-PKG-A01', available_qty: 9800, locked_qty: 600, unit: '个', production_date: dateOffset(-9), expiry_date: null, supplier: '江门绿田包装材料', purchase_price: 0.36, status: '正常', properties: { roadshow: true, quality_status: '合格' } },
    { material: 'MAT-FG-004', batch_no: 'RS-BATCH-FG-001', warehouse: 'RS-FG-A01', available_qty: 260, locked_qty: 90, unit: '盒', production_date: dateOffset(-6), expiry_date: dateOffset(260), supplier: '自产', purchase_price: 0, status: '正常', properties: { roadshow: true, quality_status: '成品放行' } },
    { material: 'MAT-FG-005', batch_no: 'RS-BATCH-FG-002', warehouse: 'RS-FG-A01', available_qty: 180, locked_qty: 60, unit: '盒', production_date: dateOffset(-5), expiry_date: dateOffset(235), supplier: '自产', purchase_price: 0, status: '正常', properties: { roadshow: true, quality_status: '成品待抽检' } }
  ]

  for (const item of batches) {
    const material = materialByCode.get(item.material)
    const warehouse = warehouseByCode.get(item.warehouse)
    ensure(material?.id, `material not found: ${item.material}`)
    ensure(warehouse?.id, `warehouse not found: ${item.warehouse}`)
    const existingBatch = await firstRow('scm', 'inventory_batches', {
      material_id: material.id,
      batch_no: item.batch_no,
      warehouse_id: warehouse.id
    }, 'id,material_id,batch_no,warehouse_id')
    if (!existingBatch) {
      await request('/api/rpc/stock_in', {
        method: 'POST',
        headers: schemaHeaders('scm'),
        body: {
          p_material_id: Number(material.id),
          p_warehouse_id: warehouse.id,
          p_quantity: item.available_qty,
          p_unit: item.unit,
          p_batch_no: item.batch_no,
          p_transaction_no: `RS-STOCKIN-${item.batch_no}`,
          p_operator: 'roadshow',
          p_production_date: item.production_date,
          p_remark: `路演库存初始化：${material.name || item.material}`,
          p_io_type: '演示初始化'
        }
      })
    }
  }

  return `materials reused=${materialRows.length}; warehouses=${warehouseTree.length}; batches=${batches.length}`
}

async function seedSales() {
  const customers = await upsertMany('public', 'sales_customers', 'customer_no', salesCustomers, 'id,customer_no,name')
  const customer = (code) => customers.byKey.get(code)
  const orders = [
    { order_no: 'RS-SO-202607-001', customer: 'RS-CUST-001', product_name: '黑椒龙利鱼柳预制菜', quantity: 520, unit: '盒', unit_price: 128, order_date: dateOffset(-4), delivery_date: dateOffset(3), order_status: '生产中', owner_name: '高渠道', status: 'active', properties: { roadshow: true, delivery_risk: '临期', gross_profit: 11980 } },
    { order_no: 'RS-SO-202607-002', customer: 'RS-CUST-002', product_name: '蒜蓉粉丝扇贝预制菜', quantity: 360, unit: '盒', unit_price: 118, order_date: dateOffset(-3), delivery_date: dateOffset(5), order_status: '已确认', owner_name: '高渠道', status: 'active', properties: { roadshow: true, delivery_risk: '正常', gross_profit: 7650 } },
    { order_no: 'RS-SO-202607-003', customer: 'RS-CUST-003', product_name: '黑椒龙利鱼柳预制菜', quantity: 180, unit: '盒', unit_price: 132, order_date: dateOffset(-1), delivery_date: dateOffset(7), order_status: '草稿', owner_name: '高渠道', status: 'draft', properties: { roadshow: true, delivery_risk: '待确认', gross_profit: 4280 } }
  ]
  const orderRows = new Map()
  for (const item of orders) {
    const c = customer(item.customer)
    ensure(c?.id, `customer not found: ${item.customer}`)
    const payload = {
      order_no: item.order_no,
      customer_id: c.id,
      customer_name: c.name,
      product_name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total_amount: Number((item.quantity * item.unit_price).toFixed(2)),
      order_date: item.order_date,
      delivery_date: item.delivery_date,
      order_status: item.order_status,
      owner_name: item.owner_name,
      status: item.status,
      properties: item.properties
    }
    const { row } = await upsertOne('public', 'sales_orders', { order_no: item.order_no }, payload, 'id,order_no,customer_id,customer_name,total_amount')
    orderRows.set(item.order_no, row)
  }

  const opportunities = [
    { opportunity_no: 'RS-OPP-202607-001', customer: 'RS-CUST-001', opportunity_name: '华东鲜食暑期补货', expected_amount: 168000, stage: '商务谈判', probability: 78, expected_close_date: dateOffset(6), owner_name: '高渠道', next_action: '确认补货排产和冷链窗口', remark: '战略客户追加预制菜新品补货', status: 'active', properties: { roadshow: true, source: '老客复购' } },
    { opportunity_no: 'RS-OPP-202607-002', customer: 'RS-CUST-002', opportunity_name: '湾区团餐试单转量产', expected_amount: 96000, stage: '方案报价', probability: 60, expected_close_date: dateOffset(10), owner_name: '高渠道', next_action: '提交批次追溯说明', remark: '客户关注稳定供货和质量追溯', status: 'active', properties: { roadshow: true, source: '客户跟进' } }
  ]
  for (const item of opportunities) {
    const c = customer(item.customer)
    await upsertOne('public', 'sales_opportunities', { opportunity_no: item.opportunity_no }, {
      opportunity_no: item.opportunity_no,
      opportunity_name: item.opportunity_name,
      customer_id: c.id,
      customer_name: c.name,
      expected_amount: item.expected_amount,
      stage: item.stage,
      probability: item.probability,
      expected_close_date: item.expected_close_date,
      owner_name: item.owner_name,
      next_action: item.next_action,
      remark: item.remark,
      status: item.status,
      properties: item.properties
    }, 'id,opportunity_no')
  }

  const followUps = [
    { follow_no: 'RS-FU-202607-001', customer: 'RS-CUST-001', follow_date: dateOffset(-1), follow_type: '视频会议', follow_result: '已成交', next_follow_at: dateOffset(2), owner_name: '高渠道', follow_content: '确认订单交期，客户要求看到库存锁定和生产进度。', status: 'active', properties: { roadshow: true, next_action: '同步生产进度', priority: '高' } },
    { follow_no: 'RS-FU-202607-002', customer: 'RS-CUST-002', follow_date: dateOffset(-2), follow_type: '上门拜访', follow_result: '报价中', next_follow_at: dateOffset(3), owner_name: '高渠道', follow_content: '客户要求提供来料检验、成品抽检和批次追溯样例。', status: 'active', properties: { roadshow: true, next_action: '发送质量追溯报告', priority: '中' } }
  ]
  for (const item of followUps) {
    const c = customer(item.customer)
    await upsertOne('public', 'sales_follow_ups', { follow_no: item.follow_no }, {
      follow_no: item.follow_no,
      customer_id: c.id,
      customer_name: c.name,
      contact_name: c.contact_name,
      follow_date: item.follow_date,
      follow_type: item.follow_type,
      follow_result: item.follow_result,
      next_follow_at: item.next_follow_at,
      owner_name: item.owner_name,
      follow_content: item.follow_content,
      status: item.status,
      properties: item.properties
    }, 'id,follow_no')
  }

  const paymentOrder = orderRows.get('RS-SO-202607-001')
  const paymentCustomer = customer('RS-CUST-001')
  await upsertOne('public', 'sales_payments', { payment_no: 'RS-PAY-202607-001' }, {
    payment_no: 'RS-PAY-202607-001',
    order_id: paymentOrder?.id || null,
    order_no: paymentOrder?.order_no || 'RS-SO-202607-001',
    customer_id: paymentCustomer.id,
    customer_name: paymentCustomer.name,
    amount: 36000,
    payment_date: dateOffset(-1),
    payment_method: '银行转账',
    verify_status: '部分核销',
    handler_name: '高渠道',
    status: 'active',
    properties: { roadshow: true, note: '路演客户预付款' }
  }, 'id,payment_no')

  return `customers created=${customers.stats.created}, updated=${customers.stats.updated}; orders=${orders.length}; opportunities=${opportunities.length}`
}

async function seedPurchase() {
  const suppliers = await upsertMany('public', 'purchase_suppliers', 'supplier_no', purchaseSuppliers, 'id,supplier_no,name')
  const supplier = (code) => suppliers.byKey.get(code)
  const demands = [
    { demand_no: 'RS-PR-202607-001', material_no: 'MAT-RM-004', material_name: '龙利鱼柳', quantity: 480, unit: '千克', required_date: dateOffset(2), source_dept: '生产一部', requester_name: '许计划', preferred_supplier: '海南深海食材', demand_status: '待采购', remark: '路演销售订单驱动备料', status: 'active', properties: { roadshow: true, source: '销售订单MRP' } },
    { demand_no: 'RS-PR-202607-002', material_no: 'MAT-PKG-004', material_name: '真空袋 500g', quantity: 8000, unit: '个', required_date: dateOffset(4), source_dept: '仓储部', requester_name: '许计划', preferred_supplier: '江门绿田包装材料', demand_status: '已下单', remark: '成品包装补货', status: 'active', properties: { roadshow: true, source: '安全库存' } }
  ]
  const demandRows = new Map()
  for (const item of demands) {
    const { row } = await upsertOne('public', 'purchase_demands', { demand_no: item.demand_no }, item, 'id,demand_no,material_name')
    demandRows.set(item.demand_no, row)
  }

  const purchaseOrders = [
    { order_no: 'RS-PO-202607-001', demand: 'RS-PR-202607-001', supplier: 'RS-SUP-001', material_name: '龙利鱼柳', quantity: 480, unit: '千克', unit_price: 38.5, order_date: dateOffset(-2), expected_arrival_date: dateOffset(1), buyer_name: '罗采购', order_status: '已下单', status: 'active', properties: { roadshow: true, delivery_risk: '临期' } },
    { order_no: 'RS-PO-202607-002', demand: 'RS-PR-202607-002', supplier: 'RS-SUP-002', material_name: '真空袋 500g', quantity: 8000, unit: '个', unit_price: 0.36, order_date: dateOffset(-1), expected_arrival_date: dateOffset(3), buyer_name: '罗采购', order_status: '部分到货', status: 'active', properties: { roadshow: true, delivery_risk: '正常' } }
  ]
  const orderRows = new Map()
  for (const item of purchaseOrders) {
    const s = supplier(item.supplier)
    const d = demandRows.get(item.demand)
    ensure(s?.id, `supplier not found: ${item.supplier}`)
    const payload = {
      order_no: item.order_no,
      demand_id: d?.id || null,
      source_demand_no: item.demand,
      supplier_id: s.id,
      supplier_name: s.name,
      material_name: item.material_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total_amount: Number((item.quantity * item.unit_price).toFixed(2)),
      order_date: item.order_date,
      expected_arrival_date: item.expected_arrival_date,
      buyer_name: item.buyer_name,
      order_status: item.order_status,
      status: item.status,
      properties: item.properties
    }
    const { row } = await upsertOne('public', 'purchase_orders', { order_no: item.order_no }, payload, 'id,order_no,supplier_id,supplier_name')
    orderRows.set(item.order_no, row)
  }

  const arrivals = [
    { arrival_no: 'RS-PA-202607-001', order: 'RS-PO-202607-001', supplier: 'RS-SUP-001', material_name: '龙利鱼柳', arrival_quantity: 480, accepted_quantity: 470, unit: '千克', arrival_date: dateOffset(0), iqc_status: '让步接收', inbound_no: 'RS-IN-202607-001', arrival_status: '已入库', status: 'active', properties: { roadshow: true, exception_note: '外箱轻微破损，内袋完好' } },
    { arrival_no: 'RS-PA-202607-002', order: 'RS-PO-202607-002', supplier: 'RS-SUP-002', material_name: '真空袋 500g', arrival_quantity: 5000, accepted_quantity: 0, unit: '个', arrival_date: dateOffset(0), iqc_status: '待检', inbound_no: '', arrival_status: '待检验', status: 'active', properties: { roadshow: true, exception_note: '等待来料检验' } }
  ]
  for (const item of arrivals) {
    const o = orderRows.get(item.order)
    const s = supplier(item.supplier)
    await upsertOne('public', 'purchase_arrivals', { arrival_no: item.arrival_no }, {
      arrival_no: item.arrival_no,
      order_id: o?.id || null,
      order_no: item.order,
      supplier_id: s?.id || null,
      supplier_name: s?.name || '',
      material_name: item.material_name,
      arrival_quantity: item.arrival_quantity,
      accepted_quantity: item.accepted_quantity,
      unit: item.unit,
      arrival_date: item.arrival_date,
      iqc_status: item.iqc_status,
      inbound_no: item.inbound_no,
      arrival_status: item.arrival_status,
      status: item.status,
      properties: item.properties
    }, 'id,arrival_no')
  }

  return `suppliers created=${suppliers.stats.created}, updated=${suppliers.stats.updated}; demands=${demands.length}; orders=${purchaseOrders.length}; arrivals=${arrivals.length}`
}

async function seedProduction() {
  const materialRows = await listRows('public', 'raw_materials', {}, 'id,batch_no,name', [
    `batch_no=in.(${['MAT-FG-004', 'MAT-FG-005', 'MAT-RM-004', 'MAT-RM-006', 'MAT-AUX-008', 'MAT-AUX-005', 'MAT-PKG-004'].map(enc).join(',')})`
  ])
  const materialByCode = new Map(materialRows.map((row) => [row.batch_no, row]))
  const workOrders = [
    { work_order_no: 'RS-WO-202607-001', product: 'MAT-FG-004', source_order_nos: 'RS-SO-202607-001', planned_qty: 520, unit: '盒', planned_start_date: dateOffset(-1), planned_finish_date: dateOffset(2), work_order_status: '生产中', priority: '高', remark: '路演：销售订单驱动生产工单', items: [
      { line_no: 10, material: 'MAT-RM-004', required_qty: 260, unit: '千克', issued_qty: 120, shortage_qty: 0, issue_status: '部分领料', remark: '主料已领一部分' },
      { line_no: 20, material: 'MAT-AUX-008', required_qty: 42, unit: '千克', issued_qty: 20, shortage_qty: 0, issue_status: '部分领料', remark: '调味料分批领用' },
      { line_no: 30, material: 'MAT-PKG-004', required_qty: 520, unit: '个', issued_qty: 520, shortage_qty: 0, issue_status: '已齐套', remark: '包材库存满足' }
    ] },
    { work_order_no: 'RS-WO-202607-002', product: 'MAT-FG-005', source_order_nos: 'RS-SO-202607-002', planned_qty: 360, unit: '盒', planned_start_date: dateOffset(0), planned_finish_date: dateOffset(4), work_order_status: '待排产', priority: '紧急', remark: '路演：团餐客户试单转量产', items: [
      { line_no: 10, material: 'MAT-RM-006', required_qty: 180, unit: '千克', issued_qty: 0, shortage_qty: 25, issue_status: '部分领料', remark: '青口贝需补料' },
      { line_no: 20, material: 'MAT-AUX-005', required_qty: 36, unit: '千克', issued_qty: 0, shortage_qty: 0, issue_status: '已齐套', remark: '辅料库存满足' },
      { line_no: 30, material: 'MAT-PKG-004', required_qty: 360, unit: '个', issued_qty: 0, shortage_qty: 0, issue_status: '已齐套', remark: '包材库存满足' }
    ] }
  ]

  for (const item of workOrders) {
    const product = materialByCode.get(item.product)
    ensure(product?.id, `production product not found: ${item.product}`)
    const { row: order } = await upsertOne('scm', 'production_work_orders', { work_order_no: item.work_order_no }, {
      work_order_no: item.work_order_no,
      source_type: 'roadshow_sales_order',
      source_order_nos: item.source_order_nos,
      product_material_id: product.id,
      product_material_code: product.batch_no,
      product_material_name: product.name,
      bom_no: `RS-BOM-${product.batch_no}-V1`,
      bom_version: 'V1',
      planned_qty: item.planned_qty,
      unit: item.unit,
      planned_start_date: item.planned_start_date,
      planned_finish_date: item.planned_finish_date,
      work_order_status: item.work_order_status,
      priority: item.priority,
      remark: item.remark,
      properties: { roadshow: true, source_order_nos: item.source_order_nos },
      created_by: 'roadshow'
    }, 'id,work_order_no,product_material_code')

    await deleteRows('scm', 'production_work_order_items', { work_order_id: order.id })
    for (const line of item.items) {
      const component = materialByCode.get(line.material)
      ensure(component?.id, `production component not found: ${line.material}`)
      await request('/api/production_work_order_items?select=*', {
        method: 'POST',
        headers: schemaHeaders('scm', { Prefer: 'return=representation' }),
        body: {
          work_order_id: order.id,
          line_no: line.line_no,
          component_material_id: component.id,
          component_material_code: component.batch_no,
          component_material_name: component.name,
          required_qty: line.required_qty,
          unit: line.unit,
          issued_qty: line.issued_qty,
          shortage_qty: line.shortage_qty,
          issue_status: line.issue_status,
          remark: line.remark,
          properties: { roadshow: true }
        }
      })
    }
  }

  return `work_orders=${workOrders.length}; items=${workOrders.reduce((sum, item) => sum + item.items.length, 0)}`
}

async function seedQuality() {
  await upsertMany('public', 'quality_standards', 'standard_no', qualityStandards, 'id,standard_no')
  const inspectionRows = new Map()
  const inspections = [
    { doc_no: 'RS-QI-202607-001', inspection_type: '来料检验', source_doc_no: 'RS-PA-202607-001', item_code: 'MAT-RM-004', item_name: '龙利鱼柳', source_name: '海南深海食材', batch_no: 'RS-BATCH-RM-001', sample_qty: 80, defect_qty: 2, result: '让步接收', inspector: '马质检', inspection_date: dateOffset(0), remark: '外箱轻微破损，内袋完好，降级接收。', status: 'active', properties: { roadshow: true, standard: '冷冻水产原料来料检验标准', disposition: '放行' } },
    { doc_no: 'RS-QI-202607-002', inspection_type: '过程巡检', source_doc_no: 'RS-WO-202607-001', item_code: 'RS-LINE-001', item_name: '预制菜一线', source_name: '生产一部', batch_no: 'RS-BATCH-FG-001', sample_qty: 50, defect_qty: 6, result: '不合格', inspector: '马质检', inspection_date: dateOffset(0), remark: '封口温度波动，抽检存在密封不良。', status: 'active', properties: { roadshow: true, standard: '预制菜成品放行标准', disposition: '返工' } }
  ]
  for (const item of inspections) {
    const { row } = await upsertOne('public', 'quality_inspections', { doc_no: item.doc_no }, item, 'id,doc_no')
    inspectionRows.set(item.doc_no, row)
  }
  const inspection = inspectionRows.get('RS-QI-202607-002')
  const { row: ncr } = await upsertOne('public', 'quality_ncrs', { doc_no: 'RS-NCR-202607-001' }, {
    doc_no: 'RS-NCR-202607-001',
    inspection_id: inspection?.id || null,
    source_type: '过程巡检',
    source_doc_no: 'RS-QI-202607-002',
    issue_desc: '封口温度波动导致密封不良',
    severity: '严重',
    owner_dept: '生产一部',
    owner_name: '许计划',
    deadline: dateOffset(1),
    ncr_status: '整改中',
    corrective_action: '校准封口温控并追加复检',
    verification_result: '',
    status: 'active',
    properties: { roadshow: true, root_cause_type: '设备' }
  }, 'id,doc_no')
  await upsertOne('public', 'quality_corrective_actions', { action_no: 'RS-QA-202607-001' }, {
    action_no: 'RS-QA-202607-001',
    ncr_id: ncr?.id || null,
    ncr_doc_no: 'RS-NCR-202607-001',
    action_type: '纠正',
    task_desc: '校准封口机温控参数，并对同批次产品追加抽检',
    owner_dept: '设备部',
    owner_name: '朱设备',
    due_date: dateOffset(1),
    action_status: '处理中',
    verify_owner: '马质检',
    verify_date: null,
    verify_result: '',
    status: 'active',
    properties: { roadshow: true }
  }, 'id,action_no')
  await upsertOne('public', 'quality_audits', { audit_no: 'RS-AUD-202607-001' }, {
    audit_no: 'RS-AUD-202607-001',
    audit_type: '过程审核',
    audit_scope: '预制菜一线封口工序',
    plan_date: dateOffset(2),
    auditor: '马质检',
    finding_count: 2,
    audit_status: '待整改',
    conclusion: '封口温控点检记录不完整，需闭环整改。',
    status: 'active',
    properties: { roadshow: true, audit_location: '预制菜一线' }
  }, 'id,audit_no')
  return `standards=${qualityStandards.length}; inspections=${inspections.length}; ncr=1; actions=1`
}

async function seedEquipment() {
  await upsertMany('public', 'equipment_standards', 'standard_no', equipmentStandards, 'id,standard_no')
  const assets = [
    { asset_no: 'RS-EQ-FILL-001', asset_name: '一号灌装封口联线', asset_type: '灌装设备', location_name: '预制菜一线', asset_level: '关键', run_status: '维修中', owner_dept: '设备部', owner_name: '朱设备', commission_date: dateOffset(-860), last_maint_date: dateOffset(-8), next_maint_date: dateOffset(5), health_score: 72, remark: '封口温控波动，正在处理', status: 'active', properties: { roadshow: true, manufacturer: '广州海工自动化', asset_value: 560000 } },
    { asset_no: 'RS-EQ-PACK-001', asset_name: '一号自动封箱机', asset_type: '包装设备', location_name: '包装一线', asset_level: '重要', run_status: '运行', owner_dept: '设备部', owner_name: '朱设备', commission_date: dateOffset(-530), last_maint_date: dateOffset(-6), next_maint_date: dateOffset(9), health_score: 88, remark: '运行稳定', status: 'active', properties: { roadshow: true, manufacturer: '佛山迅捷包装', asset_value: 180000 } }
  ]
  const assetResult = await upsertMany('public', 'equipment_assets', 'asset_no', assets, 'id,asset_no,asset_name')
  const asset = (code) => assetResult.byKey.get(code)
  const mainAsset = asset('RS-EQ-FILL-001')
  await upsertOne('public', 'equipment_checks', { check_no: 'RS-EC-202607-001' }, {
    check_no: 'RS-EC-202607-001',
    asset_id: mainAsset?.id || null,
    asset_no: 'RS-EQ-FILL-001',
    asset_name: mainAsset?.asset_name || '一号灌装封口联线',
    check_type: '班前点检',
    check_item_count: 18,
    abnormal_count: 2,
    check_result: '异常',
    checker: '朱设备',
    check_date: dateOffset(0),
    remark: '封口温度波动，密封抽检异常。',
    status: 'active',
    properties: { roadshow: true, temperature: 92, vibration: 2.4 }
  }, 'id,check_no')
  const { row: issue } = await upsertOne('public', 'equipment_issues', { issue_no: 'RS-EI-202607-001' }, {
    issue_no: 'RS-EI-202607-001',
    asset_id: mainAsset?.id || null,
    asset_no: 'RS-EQ-FILL-001',
    asset_name: mainAsset?.asset_name || '一号灌装封口联线',
    source_type: '班前点检',
    issue_desc: '封口温控波动导致密封不良',
    issue_level: '严重',
    owner_dept: '设备部',
    owner_name: '朱设备',
    occurred_date: dateOffset(0),
    deadline: dateOffset(1),
    issue_status: '处理中',
    repair_action: '校准温控模块并复测封口强度',
    status: 'active',
    properties: { roadshow: true, fault_type: '控制' }
  }, 'id,issue_no')
  await upsertOne('public', 'equipment_work_orders', { work_order_no: 'RS-EW-202607-001' }, {
    work_order_no: 'RS-EW-202607-001',
    issue_id: issue?.id || null,
    issue_no: 'RS-EI-202607-001',
    asset_id: mainAsset?.id || null,
    asset_no: 'RS-EQ-FILL-001',
    asset_name: mainAsset?.asset_name || '一号灌装封口联线',
    work_type: '故障维修',
    task_desc: '校准封口温控模块，复测密封强度并回传质量复检',
    maintainer: '朱设备',
    plan_date: dateOffset(0),
    finish_date: null,
    downtime_hours: 1.5,
    work_status: '处理中',
    acceptance_result: '',
    status: 'active',
    properties: { roadshow: true, spare_parts: '温控探头 x1' }
  }, 'id,work_order_no')
  await upsertOne('public', 'equipment_maintenance_plans', { plan_no: 'RS-EP-202607-001' }, {
    plan_no: 'RS-EP-202607-001',
    plan_name: '预制菜产线月度保养',
    asset_scope: '预制菜一线、包装一线',
    plan_type: '月度保养',
    cycle_name: '月度',
    start_date: dateOffset(-5),
    next_execute_date: dateOffset(5),
    owner_name: '朱设备',
    plan_status: '执行中',
    completion_rate: 68,
    status: 'active',
    properties: { roadshow: true, notify_method: '系统提醒' }
  }, 'id,plan_no')
  return `assets created=${assetResult.stats.created}, updated=${assetResult.stats.updated}; checks=1; issues=1; work_orders=1`
}

async function seedInventoryTransactions() {
  const matFg = await firstRow('public', 'raw_materials', { batch_no: 'MAT-FG-004' }, 'id,batch_no,name')
  const whFg = await firstRow('scm', 'warehouses', { code: 'RS-FG-A01' }, 'id,code,name')
  ensure(matFg?.id && whFg?.id, 'inventory transaction references are incomplete')
  const existingOutbound = await firstRow('scm', 'inventory_transactions', { transaction_no: 'RS-TX-OUT-202607-001' }, 'id,transaction_no')
  if (!existingOutbound) {
    await request('/api/rpc/stock_out', {
      method: 'POST',
      headers: schemaHeaders('scm'),
      body: {
        p_material_id: Number(matFg.id),
        p_warehouse_id: whFg.id,
        p_quantity: 40,
        p_unit: '盒',
        p_batch_no: 'RS-BATCH-FG-001',
        p_transaction_no: 'RS-TX-OUT-202607-001',
        p_operator: '高渠道',
        p_remark: '路演：销售订单锁定后出库',
        p_io_type: '销售出库'
      }
    })
  }
  return existingOutbound ? 'outbound transaction already exists' : 'outbound transaction created by stock_out RPC'
}

async function verify() {
  const checks = [
    ['hr', 'archives', { employee_no: 'RS-HR-001' }],
    ['public', 'raw_materials', { batch_no: 'MAT-FG-004' }],
    ['scm', 'warehouses', { code: 'RS-FG-A01' }],
    ['public', 'sales_orders', { order_no: 'RS-SO-202607-001' }],
    ['public', 'purchase_orders', { order_no: 'RS-PO-202607-001' }],
    ['scm', 'production_work_orders', { work_order_no: 'RS-WO-202607-001' }],
    ['public', 'quality_ncrs', { doc_no: 'RS-NCR-202607-001' }],
    ['public', 'equipment_work_orders', { work_order_no: 'RS-EW-202607-001' }]
  ]
  const summary = {}
  for (const [schema, table, filters] of checks) {
    const rows = await listRows(schema, table, filters, '*')
    summary[`${schema}.${table}`] = rows.length
    ensure(rows.length > 0, `verification failed: ${schema}.${table}`)
  }
  return summary
}

await login()
await section('hr demo staff', seedHr)
await section('materials warehouses inventory batches', seedMaterialsAndWarehouses)
await section('sales demo chain', seedSales)
await section('purchase demo chain', seedPurchase)
await section('production demo chain', seedProduction)
await section('quality demo chain', seedQuality)
await section('equipment demo chain', seedEquipment)
await section('inventory transaction demo chain', seedInventoryTransactions)
await section('verification', verify)

const failCount = results.filter((item) => !item.pass).length
const output = {
  generatedAt,
  baseUrl: BASE_URL,
  baseDate: BASE_DATE,
  username: USERNAME,
  summary: { total: results.length, pass: results.length - failCount, fail: failCount },
  results
}

const text = `${JSON.stringify(output, null, 2)}\n`
console.log(text)

if (RESULT_FILE) {
  const target = resolve(RESULT_FILE)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text, 'utf8')
}

if (failCount > 0) process.exitCode = 1
