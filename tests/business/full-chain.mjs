// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHttpClient, isRemoteTarget, normalizePositiveInteger, sleep } from '../engineering/http-client.mjs'

const BASE_URL = (process.env.EISCORE_CHAIN_BASE_URL || process.env.EISCORE_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')
const USERNAME = process.env.EISCORE_CHAIN_USERNAME || process.env.EISCORE_SMOKE_USERNAME || 'admin'
const PASSWORD = process.env.EISCORE_CHAIN_PASSWORD || process.env.EISCORE_SMOKE_PASSWORD || '123456'
const RESULT_FILE = process.env.EISCORE_CHAIN_RESULT || ''
const KEEP_DATA = process.env.EISCORE_CHAIN_KEEP_DATA === '1'
const REQUEST_TIMEOUT_MS = normalizePositiveInteger(process.env.EISCORE_CHAIN_TIMEOUT_MS, 15000, { min: 1000, max: 180000 })
const IS_REMOTE_TARGET = isRemoteTarget(BASE_URL)
const REQUEST_ATTEMPTS = normalizePositiveInteger(
  process.env.EISCORE_CHAIN_REQUEST_ATTEMPTS,
  IS_REMOTE_TARGET ? 3 : 1,
  { min: 1, max: 8 }
)
const LOGIN_ATTEMPTS = normalizePositiveInteger(
  process.env.EISCORE_CHAIN_LOGIN_ATTEMPTS,
  IS_REMOTE_TARGET ? 5 : 2,
  { min: 1, max: 8 }
)
const DATA_TABLE = process.env.EISCORE_CHAIN_TABLE || 'eiscore_chain_test_records'
const DATA_TABLE_QUALIFIED = `app_data.${DATA_TABLE}`
const http = createHttpClient({
  baseUrl: BASE_URL,
  requestAttempts: REQUEST_ATTEMPTS,
  timeoutMs: REQUEST_TIMEOUT_MS
})

const generatedAt = new Date().toISOString()
const runId = `chain_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
const results = []
const cleanupErrors = []
let token = ''
let ontologyInsightRoleCode = ''

const created = {
  appId: '',
  routeId: null,
  dataRecordId: '',
  workflowDefinitionId: null,
  workflowInstanceId: null,
  hrArchiveId: null,
  warehouseId: '',
  stockInTransactionNo: '',
  stockInBatchNo: ''
}

const dataColumns = [
  { field: 'title', label: 'Title', type: 'text' },
  { field: 'status', label: 'Status', type: 'text' },
  { field: 'run_id', label: 'Run ID', type: 'text' },
  { field: 'amount', label: 'Amount', type: 'number' }
]

function addResult(name, pass, detail, statusCode = null) {
  results.push({ name, pass, detail, statusCode })
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function rowOf(value) {
  return Array.isArray(value) ? value[0] : value
}

function profileHeaders(schema, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Profile': schema,
    'Content-Profile': schema,
    ...extra
  }
}

function filterValue(value) {
  return encodeURIComponent(String(value))
}

async function request(path, { method = 'GET', headers = {}, body, timeout = REQUEST_TIMEOUT_MS } = {}) {
  return http.requestJson(path, { method, headers, body, timeout })
}

async function api(path, options = {}) {
  const out = await request(path, options)
  if (!out.ok) {
    const detail = typeof out.data === 'string' ? out.data : JSON.stringify(out.data)
    throw new Error(`${options.method || 'GET'} ${path} -> ${out.status}: ${String(detail || '').slice(0, 300)}`)
  }
  return out
}

async function loginApi() {
  let lastError = null
  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt += 1) {
    try {
      return await api('/api/rpc/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username: USERNAME, password: PASSWORD }
      })
    } catch (error) {
      lastError = error
      if (attempt < LOGIN_ATTEMPTS) await sleep(500 * attempt)
    }
  }
  throw new Error(`login failed after ${LOGIN_ATTEMPTS} attempts: ${lastError?.message || lastError || 'unknown error'}`)
}

async function step(name, fn) {
  try {
    const value = await fn()
    if (typeof value === 'object' && value !== null && ('detail' in value || 'statusCode' in value)) {
      addResult(name, true, value.detail || 'ok', value.statusCode ?? null)
      return value.value
    }
    addResult(name, true, value === undefined ? 'ok' : String(value), null)
    return value
  } catch (error) {
    addResult(name, false, error?.message || String(error), null)
    return null
  }
}

async function waitForDataTable() {
  let lastError = null
  for (let i = 0; i < 12; i += 1) {
    try {
      const out = await api(`/api/${DATA_TABLE}?select=id,title,status,run_id,amount&limit=1`, {
        headers: profileHeaders('app_data'),
        timeout: 5000
      })
      return { detail: `${DATA_TABLE_QUALIFIED} columns visible`, statusCode: out.status }
    } catch (error) {
      lastError = error
      await sleep(1500)
    }
  }
  throw lastError || new Error(`${DATA_TABLE_QUALIFIED} did not become visible`)
}

async function fetchDataRecord() {
  const out = await api(`/api/${DATA_TABLE}?id=eq.${filterValue(created.dataRecordId)}&select=id,title,status,run_id,amount`, {
    headers: profileHeaders('app_data')
  })
  const record = rowOf(out.data)
  ensure(record?.id === created.dataRecordId, 'data record not found')
  return record
}

async function cleanupPath(path, schema, description) {
  try {
    const out = await api(path, { method: 'DELETE', headers: profileHeaders(schema) })
    return { description, statusCode: out.status }
  } catch (error) {
    cleanupErrors.push(`${description}: ${error?.message || String(error)}`)
    return null
  }
}

async function cleanupArtifacts() {
  if (KEEP_DATA) {
    addResult('99 cleanup skipped by EISCORE_CHAIN_KEEP_DATA', true, 'test artifacts intentionally retained', null)
    return
  }

  const completed = []
  if (created.workflowInstanceId) {
    const item = await cleanupPath(`/api/instances?id=eq.${filterValue(created.workflowInstanceId)}`, 'workflow', 'workflow instance')
    if (item) completed.push(item.description)
  }
  if (created.workflowDefinitionId) {
    const assignments = await cleanupPath(`/api/task_assignments?definition_id=eq.${filterValue(created.workflowDefinitionId)}`, 'workflow', 'workflow task assignments')
    if (assignments) completed.push(assignments.description)
    const definition = await cleanupPath(`/api/definitions?id=eq.${filterValue(created.workflowDefinitionId)}`, 'workflow', 'workflow definition')
    if (definition) completed.push(definition.description)
  }
  if (created.appId) {
    const mappings = await cleanupPath(`/api/workflow_state_mappings?workflow_app_id=eq.${filterValue(created.appId)}`, 'app_center', 'workflow state mappings')
    if (mappings) completed.push(mappings.description)
    const transitionRules = await cleanupPath(`/api/workflow_transition_rules?workflow_app_id=eq.${filterValue(created.appId)}`, 'app_center', 'workflow transition rules')
    if (transitionRules) completed.push(transitionRules.description)
    const permissionPolicy = await cleanupPath(`/api/workflow_permission_policies?workflow_app_id=eq.${filterValue(created.appId)}`, 'app_center', 'workflow permission policy')
    if (permissionPolicy) completed.push(permissionPolicy.description)
  }
  if (created.routeId) {
    const route = await cleanupPath(`/api/published_routes?id=eq.${filterValue(created.routeId)}`, 'app_center', 'published route')
    if (route) completed.push(route.description)
  }
  if (created.appId) {
    const app = await cleanupPath(`/api/apps?id=eq.${filterValue(created.appId)}`, 'app_center', 'app center app')
    if (app) completed.push(app.description)
  }
  if (created.dataRecordId) {
    const record = await cleanupPath(`/api/${DATA_TABLE}?id=eq.${filterValue(created.dataRecordId)}`, 'app_data', 'data app record')
    if (record) completed.push(record.description)
  }
  if (created.hrArchiveId) {
    const archive = await cleanupPath(`/api/archives?id=eq.${filterValue(created.hrArchiveId)}`, 'hr', 'hr archive')
    if (archive) completed.push(archive.description)
  }
  if (created.stockInTransactionNo) {
    const transaction = await cleanupPath(`/api/inventory_transactions?transaction_no=eq.${filterValue(created.stockInTransactionNo)}`, 'scm', 'auto-entry stock-in transaction')
    if (transaction) completed.push(transaction.description)
  }
  if (created.stockInBatchNo) {
    const batch = await cleanupPath(`/api/inventory_batches?batch_no=eq.${filterValue(created.stockInBatchNo)}`, 'scm', 'auto-entry stock-in batch')
    if (batch) completed.push(batch.description)
  }
  if (created.warehouseId) {
    const warehouse = await cleanupPath(`/api/warehouses?id=eq.${filterValue(created.warehouseId)}`, 'scm', 'scm warehouse')
    if (warehouse) completed.push(warehouse.description)
  }

  addResult(
    '99 cleanup removes generated business artifacts',
    cleanupErrors.length === 0,
    cleanupErrors.length === 0 ? completed.join(', ') : cleanupErrors.join('; '),
    null
  )
}

await step('01 login returns JWT token', async () => {
  const out = await loginApi()
  token = String(out.data?.token || '')
  ensure(token.length > 100, 'login response should include a JWT token')
  return { detail: `token_len=${token.length}`, statusCode: out.status }
})

await step('02 app center baseline is readable', async () => {
  const out = await api('/api/apps?select=id,name,app_type,status&order=updated_at.desc&limit=3', {
    headers: profileHeaders('app_center')
  })
  ensure(Array.isArray(out.data), 'apps response should be an array')
  return { detail: `rows=${out.data.length}`, statusCode: out.status }
})

await step('02b V2 role permission view is readable', async () => {
  const out = await api('/api/v_role_permissions?role_code=in.(employee,hr_clerk,hr_admin,dept_manager)&select=role_code,permissions', {
    headers: profileHeaders('public')
  })
  ensure(Array.isArray(out.data), 'v_role_permissions response should be an array')
  ensure(out.data.length > 0, 'v_role_permissions should return candidate roles')
  const readableRows = out.data.filter((row) => Array.isArray(row?.permissions)).length
  ensure(readableRows === out.data.length, 'each role permission row should expose permissions array')
  return { detail: `rows=${out.data.length}`, statusCode: out.status }
})

await step('02c ontology projections cover forms and roles', async () => {
  const forms = await api('/api/v_app_form_ontology?select=app_id,app_name,semantic_class,semantic_domain,qualified_table&order=updated_at.desc&limit=5', {
    headers: profileHeaders('public')
  })
  ensure(Array.isArray(forms.data), 'v_app_form_ontology response should be an array')
  ensure(forms.data.length > 0, 'v_app_form_ontology should expose app forms')
  ensure(forms.data.some((row) => row?.semantic_class === 'workflow_app'), 'workflow apps should be semanticized')

  const roles = await api('/api/v_role_ontology?role_code=in.(employee,hr_clerk,hr_admin,dept_manager)&select=role_code,semantic_class,semantic_name,permission_count', {
    headers: profileHeaders('public')
  })
  ensure(Array.isArray(roles.data), 'v_role_ontology response should be an array')
  ensure(roles.data.length > 0, 'v_role_ontology should expose role entities')
  ensure(roles.data.every((row) => row?.semantic_class === 'role'), 'each role ontology row should be a role semantic entity')
  ensure(roles.data.every((row) => Number(row?.permission_count || 0) > 0), 'role ontology rows should expose granted permission counts')
  return { detail: `forms=${forms.data.length}, roles=${roles.data.length}`, statusCode: roles.status }
})

await step('02d ontology coverage audit has no gaps', async () => {
  const out = await api('/api/v_ontology_coverage_audit?select=api_relations,semanticized_relations,missing_relation_semantics,ontology_columns,semanticized_columns,missing_column_semantics,app_rows,app_form_ontology_rows,role_rows,role_ontology_rows,permission_rows,permission_ontology_rows', {
    headers: profileHeaders('public')
  })
  const audit = rowOf(out.data)
  ensure(audit, 'ontology coverage audit row should exist')
  ensure(Number(audit.missing_relation_semantics || 0) === 0, 'ontology relation coverage should have no missing relation semantics')
  ensure(Number(audit.missing_column_semantics || 0) === 0, 'ontology column coverage should have no missing column semantics')
  ensure(Number(audit.api_relations || 0) === Number(audit.semanticized_relations || 0), 'all API relations should be semanticized')
  ensure(Number(audit.ontology_columns || 0) === Number(audit.semanticized_columns || 0), 'all ontology columns should be semanticized')
  ensure(Number(audit.app_rows || 0) === Number(audit.app_form_ontology_rows || 0), 'all App Center apps should be projected into app form ontology')
  ensure(Number(audit.role_rows || 0) === Number(audit.role_ontology_rows || 0), 'all roles should be projected into role ontology')
  ensure(Number(audit.permission_rows || 0) === Number(audit.permission_ontology_rows || 0), 'all permissions should be projected into permission ontology')
  return { detail: `relations=${audit.semanticized_relations}/${audit.api_relations}, columns=${audit.semanticized_columns}/${audit.ontology_columns}`, statusCode: out.status }
})

await step('02e ontology reasoning engine exposes inferred facts', async () => {
  const summaryOut = await api('/api/v_ontology_reasoning_summary?select=facts_total,seed_facts,inferred_facts,active_rules,role_app_access_facts,role_table_access_facts,sensitive_exposure_facts,transitive_dependency_facts', {
    headers: profileHeaders('public')
  })
  const summary = rowOf(summaryOut.data)
  ensure(summary, 'ontology reasoning summary should exist')
  ensure(Number(summary.facts_total || 0) > 0, 'reasoning engine should expose facts')
  ensure(Number(summary.inferred_facts || 0) > 0, 'reasoning engine should expose inferred facts')
  ensure(Number(summary.active_rules || 0) >= 10, 'reasoning engine should have active rules')
  ensure(Number(summary.role_app_access_facts || 0) > 0, 'reasoning engine should infer role app access')
  ensure(Number(summary.role_table_access_facts || 0) > 0, 'reasoning engine should infer role table access')
  ensure(Number(summary.transitive_dependency_facts || 0) > 0, 'reasoning engine should infer transitive dependencies')

  const factsOut = await api(`/api/v_ontology_reasoning_facts?predicate=eq.${filterValue('acl:canAccessApp')}&select=subject_id,predicate,object_id,inference_rule&limit=3`, {
    headers: profileHeaders('public')
  })
  ensure(Array.isArray(factsOut.data), 'reasoning facts response should be an array')
  ensure(factsOut.data.length > 0, 'reasoning facts should include role app access facts')
  return { detail: `facts=${summary.facts_total}, inferred=${summary.inferred_facts}`, statusCode: factsOut.status }
})

await step('02f ontology reasoning insights expose health and impact', async () => {
  const healthOut = await api('/api/v_ontology_reasoning_health?select=is_healthy,health_code,facts_total,inferred_facts,missing_relation_semantics,missing_column_semantics', {
    headers: profileHeaders('public')
  })
  const health = rowOf(healthOut.data)
  ensure(health, 'ontology reasoning health row should exist')
  ensure(health.is_healthy === true, `ontology reasoning health should be healthy, got ${health.health_code}`)
  ensure(Number(health.missing_relation_semantics || 0) === 0, 'reasoning insight views should be table-semanticized')
  ensure(Number(health.missing_column_semantics || 0) === 0, 'reasoning insight view columns should be semanticized')

  const roleOut = await api('/api/v_ontology_role_access_insights?select=role_code,accessible_apps,accessible_tables,operable_tables,sensitive_columns,sensitive_tables&or=(accessible_apps.gt.0,accessible_tables.gt.0,operable_tables.gt.0,sensitive_columns.gt.0)&order=accessible_apps.desc&limit=1', {
    headers: profileHeaders('public')
  })
  const role = rowOf(roleOut.data)
  ensure(role, 'role access insight should expose at least one role with inferred access')
  ontologyInsightRoleCode = role.role_code
  const roleAccessCount = Number(role.accessible_apps || 0) + Number(role.accessible_tables || 0) + Number(role.operable_tables || 0)
  ensure(roleAccessCount > 0, 'role access insight should include app/table access')
  ensure(Number(role.sensitive_columns || 0) >= 0, 'role access insight should include sensitive exposure count')

  const tableOut = await api('/api/v_ontology_table_impact_insights?has_reasoning_impact=eq.true&select=table_id,roles_can_access,transitive_dependent_tables,sensitive_columns&limit=3', {
    headers: profileHeaders('public')
  })
  ensure(Array.isArray(tableOut.data), 'table impact insight response should be an array')
  ensure(tableOut.data.length > 0, 'table impact insights should expose impacted tables')
  return {
    detail: `health=${health.health_code}, role=${role.role_code}, role_access=${roleAccessCount}, impacted_tables=${tableOut.data.length}`,
    statusCode: tableOut.status
  }
})

await step('02g ontology role access explanation is callable', async () => {
  if (!ontologyInsightRoleCode) {
    const roleOut = await api('/api/v_ontology_role_access_insights?select=role_code&or=(accessible_apps.gt.0,accessible_tables.gt.0,operable_tables.gt.0,sensitive_columns.gt.0)&order=accessible_apps.desc&limit=1', {
      headers: profileHeaders('public')
    })
    ontologyInsightRoleCode = rowOf(roleOut.data)?.role_code || ''
  }
  ensure(ontologyInsightRoleCode, 'role access explanation should have a candidate role code')
  const out = await api('/api/rpc/explain_role_ontology_access', {
    method: 'POST',
    headers: profileHeaders('public'),
    body: { p_role_code: ontologyInsightRoleCode, p_limit: 8 }
  })
  ensure(Array.isArray(out.data), 'role access explanation response should be an array')
  ensure(out.data.length > 0, 'role access explanation should return rows')
  ensure(out.data.some((row) => ['acl:canAccessApp', 'acl:canAccessTable', 'acl:canOperateTable', 'risk:canAccessSensitiveColumn'].includes(row.predicate)), 'role access explanation should include access paths')
  return { detail: `role=${ontologyInsightRoleCode}, paths=${out.data.length}`, statusCode: out.status }
})

await step('02h ontology graph query APIs expose nodes, neighbors, and paths', async () => {
  const roleCode = ontologyInsightRoleCode || 'super_admin'
  const nodeOut = await api(`/api/v_ontology_kg_nodes?node_type=eq.role&node_id=eq.${filterValue(roleCode)}&select=node_type,node_id,node_label,total_degree,outgoing_edges,incoming_edges,predicate_count&limit=1`, {
    headers: profileHeaders('public')
  })
  const node = rowOf(nodeOut.data)
  ensure(node, 'ontology KG node view should expose role nodes')
  ensure(Number(node.total_degree || 0) > 0, 'ontology KG role node should have graph degree')

  const neighborOut = await api('/api/rpc/query_ontology_kg_neighbors', {
    method: 'POST',
    headers: profileHeaders('public'),
    body: {
      p_node_type: 'role',
      p_node_id: roleCode,
      p_direction: 'outgoing',
      p_max_depth: 1,
      p_limit: 30
    }
  })
  ensure(Array.isArray(neighborOut.data), 'KG neighbor query response should be an array')
  ensure(neighborOut.data.length > 0, 'KG neighbor query should return outgoing role facts')
  const target = neighborOut.data.find((row) => ['app', 'table', 'column'].includes(row.to_type))
  ensure(target?.to_type && target?.to_id, 'KG neighbor query should expose a reachable app/table/column target')

  const pathOut = await api('/api/rpc/find_ontology_kg_paths', {
    method: 'POST',
    headers: profileHeaders('public'),
    body: {
      p_source_type: 'role',
      p_source_id: roleCode,
      p_target_type: target.to_type,
      p_target_id: target.to_id,
      p_direction: 'outgoing',
      p_max_depth: 2,
      p_limit: 5
    }
  })
  ensure(Array.isArray(pathOut.data), 'KG path query response should be an array')
  ensure(pathOut.data.length > 0, 'KG path query should return at least one path')
  ensure(pathOut.data.some((row) => Array.isArray(row.path_edges) && row.path_edges.length > 0), 'KG path query should expose path edge ids')

  return {
    detail: `node=${roleCode}, degree=${node.total_degree}, neighbors=${neighborOut.data.length}, target=${target.to_type}:${target.to_id}, paths=${pathOut.data.length}`,
    statusCode: pathOut.status
  }
})

await step('03 HR archive baseline is readable', async () => {
  const out = await api('/api/archives?select=id,name,employee_no&order=id.desc&limit=3', {
    headers: profileHeaders('hr')
  })
  ensure(Array.isArray(out.data), 'archives response should be an array')
  return { detail: `rows=${out.data.length}`, statusCode: out.status }
})

await step('04 SCM warehouse baseline is readable', async () => {
  const out = await api('/api/warehouses?select=id,code,name,status&order=code.asc&limit=3', {
    headers: profileHeaders('scm')
  })
  ensure(Array.isArray(out.data), 'warehouses response should be an array')
  return { detail: `rows=${out.data.length}`, statusCode: out.status }
})

await step('05 materials baseline is readable', async () => {
  const out = await api('/api/raw_materials?select=id,batch_no,name,category&order=id.desc&limit=3', {
    headers: profileHeaders('public')
  })
  ensure(Array.isArray(out.data), 'raw_materials response should be an array')
  return { detail: `rows=${out.data.length}`, statusCode: out.status }
})

// AUTO_ENTRY_CHAIN:fixed-stock-in-document-entry
await step('05b fixed stock-in auto-entry business chain closes loop', async () => {
  const materialsOut = await api('/api/raw_materials?select=id,batch_no,name&order=id.asc&limit=1', {
    headers: profileHeaders('public')
  })
  const material = rowOf(materialsOut.data)
  ensure(material?.id, 'stock-in chain requires at least one raw material')

  const warehousesOut = await api('/api/warehouses?select=id,code,name&order=code.asc&limit=1', {
    headers: profileHeaders('scm')
  })
  const warehouse = rowOf(warehousesOut.data)
  ensure(warehouse?.id, 'stock-in chain requires at least one warehouse')

  const transactionNo = `AUTO-${runId}`
  const batchNo = `AUTO-BATCH-${runId}`
  const remark = `AUTO_ENTRY_CHAIN:fixed-stock-in-document-entry ${runId}`
  const stockIn = await api('/api/rpc/stock_in', {
    method: 'POST',
    headers: profileHeaders('scm'),
    body: {
      p_material_id: Number(material.id),
      p_warehouse_id: warehouse.id,
      p_quantity: 1,
      p_unit: 'kg',
      p_batch_no: batchNo,
      p_transaction_no: transactionNo,
      p_operator: 'auto-entry-chain',
      p_production_date: generatedAt.slice(0, 10),
      p_remark: remark,
      p_io_type: '采购入库'
    }
  })
  const rpcResult = stockIn.data?.result || stockIn.data
  ensure(rpcResult?.success === true, 'stock-in RPC should return success')
  ensure(rpcResult?.transaction_no === transactionNo, 'stock-in transaction_no should match test transaction')
  created.stockInTransactionNo = transactionNo
  created.stockInBatchNo = batchNo

  const verify = await api(`/api/v_inventory_transactions?transaction_no=eq.${filterValue(transactionNo)}&select=transaction_no,transaction_type,io_type,material_id,batch_no,warehouse_id,quantity,unit,operator,remark&limit=1`, {
    headers: profileHeaders('scm')
  })
  const row = rowOf(verify.data)
  ensure(row?.transaction_no === transactionNo, 'stock-in transaction should be visible through inventory view')
  ensure(String(row.batch_no || '') === batchNo, 'stock-in batch_no should be visible')
  ensure(Number(row.quantity) === 1, 'stock-in quantity should be visible')
  ensure(String(row.remark || '').includes('AUTO_ENTRY_CHAIN:fixed-stock-in-document-entry'), 'stock-in remark should carry auto-entry marker')

  return { detail: `transaction_no=${transactionNo}, batch_no=${batchNo}`, statusCode: verify.status }
})

await step('06 create app center data app', async () => {
  const out = await api('/api/apps', {
    method: 'POST',
    headers: profileHeaders('app_center', { Prefer: 'return=representation' }),
    body: {
      name: `__eiscore_chain_${runId}`,
      description: 'Codex full-chain automation data app',
      app_type: 'data',
      status: 'draft',
      icon: 'TestTube',
      version: '0.0.0-test',
      config: {
        chainTest: true,
        runId,
        table: DATA_TABLE_QUALIFIED,
        columns: dataColumns,
        aclModule: 'chain_test',
        permission_mode: 'compat',
        createTable: true
      },
      created_by: 'codex-chain-test',
      updated_by: 'codex-chain-test'
    }
  })
  const app = rowOf(out.data)
  ensure(app?.id, 'created app id missing')
  created.appId = app.id
  return { detail: `app_id=${created.appId}`, statusCode: out.status }
})

await step('07 publish app center data app', async () => {
  const out = await api(`/api/apps?id=eq.${filterValue(created.appId)}`, {
    method: 'PATCH',
    headers: profileHeaders('app_center', { Prefer: 'return=representation' }),
    body: {
      status: 'published',
      updated_by: 'codex-chain-test',
      description: 'Codex full-chain automation data app - published'
    }
  })
  const app = rowOf(out.data)
  ensure(app?.status === 'published', `expected app status published, got ${app?.status}`)
  return { detail: `status=${app.status}`, statusCode: out.status }
})

await step('08 create published route for generated app', async () => {
  const out = await api('/api/published_routes', {
    method: 'POST',
    headers: profileHeaders('app_center', { Prefer: 'return=representation' }),
    body: {
      app_id: created.appId,
      route_path: `/apps/eiscore-chain-${runId}`,
      mount_point: 'app-center',
      is_active: true
    }
  })
  const route = rowOf(out.data)
  ensure(route?.id, 'published route id missing')
  created.routeId = route.id
  return { detail: `route_id=${created.routeId}`, statusCode: out.status }
})

await step('09 ensure dynamic data app table exists', async () => {
  const out = await api('/api/rpc/create_data_app_table', {
    method: 'POST',
    headers: profileHeaders('app_center'),
    body: {
      app_id: created.appId,
      table_name: DATA_TABLE,
      columns: dataColumns
    }
  })
  ensure(String(out.data || '').includes(DATA_TABLE_QUALIFIED), `unexpected table response: ${JSON.stringify(out.data)}`)
  return { detail: String(out.data), statusCode: out.status }
})

await step('10 wait for dynamic table schema cache', waitForDataTable)

// AUTO_ENTRY_CHAIN:generic-app-data-document-entry
await step('11 create data app business record', async () => {
  const out = await api(`/api/${DATA_TABLE}`, {
    method: 'POST',
    headers: profileHeaders('app_data', { Prefer: 'return=representation' }),
    body: {
      title: `Codex full-chain ${runId}`,
      status: 'DRAFT',
      run_id: runId,
      amount: 100,
      properties: { chainTest: true, runId }
    }
  })
  const record = rowOf(out.data)
  ensure(record?.id, 'data record id missing')
  created.dataRecordId = record.id
  return { detail: `record_id=${created.dataRecordId}, status=${record.status}`, statusCode: out.status }
})

await step('12 patch and verify data app business record', async () => {
  await api(`/api/${DATA_TABLE}?id=eq.${filterValue(created.dataRecordId)}`, {
    method: 'PATCH',
    headers: profileHeaders('app_data', { Prefer: 'return=representation' }),
    body: { status: 'READY', amount: 128 }
  })
  const record = await fetchDataRecord()
  ensure(record.status === 'READY', `expected READY, got ${record.status}`)
  ensure(Number(record.amount) === 128, `expected amount 128, got ${record.amount}`)
  return `status=${record.status}, amount=${record.amount}`
})

await step('13 create workflow definition for data record', async () => {
  const out = await api('/api/definitions', {
    method: 'POST',
    headers: profileHeaders('workflow', { Prefer: 'return=representation' }),
    body: {
      name: `__eiscore_chain_${runId}_definition`,
      bpmn_xml: '<definitions><process id="chain_test"><userTask id="Task_Review"/><userTask id="Task_Done"/></process></definitions>',
      associated_table: DATA_TABLE_QUALIFIED,
      app_id: created.appId
    }
  })
  const definition = rowOf(out.data)
  ensure(definition?.id, 'workflow definition id missing')
  created.workflowDefinitionId = definition.id
  return { detail: `definition_id=${created.workflowDefinitionId}`, statusCode: out.status }
})

await step('14 create workflow task assignments', async () => {
  const out = await api('/api/task_assignments', {
    method: 'POST',
    headers: profileHeaders('workflow', { Prefer: 'return=representation' }),
    body: [
      {
        definition_id: created.workflowDefinitionId,
        task_id: 'Task_Review',
        candidate_roles: ['super_admin'],
        candidate_users: [],
        approval_mode: 'any',
        required_approvals: 1,
        require_comment: false
      },
      {
        definition_id: created.workflowDefinitionId,
        task_id: 'Task_Done',
        candidate_roles: ['super_admin'],
        candidate_users: [],
        approval_mode: 'any',
        required_approvals: 1,
        require_comment: false
      }
    ]
  })
  ensure(Array.isArray(out.data) && out.data.length === 2, 'expected two task assignments')
  return { detail: `rows=${out.data.length}`, statusCode: out.status }
})

await step('15 create workflow state mappings', async () => {
  const out = await api('/api/workflow_state_mappings', {
    method: 'POST',
    headers: profileHeaders('app_center', { Prefer: 'return=representation' }),
    body: [
      {
        workflow_app_id: created.appId,
        bpmn_task_id: 'Task_Review',
        target_table: DATA_TABLE_QUALIFIED,
        state_field: 'status',
        state_value: 'FLOW_REVIEW'
      },
      {
        workflow_app_id: created.appId,
        bpmn_task_id: 'Task_Done',
        target_table: DATA_TABLE_QUALIFIED,
        state_field: 'status',
        state_value: 'FLOW_DONE'
      }
    ]
  })
  ensure(Array.isArray(out.data) && out.data.length === 2, 'expected two state mappings')
  return { detail: `rows=${out.data.length}`, statusCode: out.status }
})

await step('16 start workflow and verify state writeback', async () => {
  const out = await api('/api/rpc/start_workflow_instance', {
    method: 'POST',
    headers: profileHeaders('workflow'),
    body: {
      p_definition_id: created.workflowDefinitionId,
      p_business_key: String(created.dataRecordId),
      p_initial_task_id: 'Task_Review',
      p_variables: { runId }
    }
  })
  const instance = rowOf(out.data)
  ensure(instance?.id, 'workflow instance id missing')
  created.workflowInstanceId = instance.id
  const record = await fetchDataRecord()
  ensure(record.status === 'FLOW_REVIEW', `expected FLOW_REVIEW, got ${record.status}`)
  return { detail: `instance_id=${created.workflowInstanceId}, record_status=${record.status}`, statusCode: out.status }
})

await step('17 strict policy rejects missing transition rule', async () => {
  const policy = await api('/api/workflow_permission_policies?on_conflict=workflow_app_id', {
    method: 'POST',
    headers: profileHeaders('app_center', { Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: {
      workflow_app_id: created.appId,
      acl_module: 'chain_test',
      permission_mode: 'strict',
      enforce_assignment: true,
      enforce_workflow_op_perm: true,
      enforce_status_transition_perm: true,
      legacy_fallback_enabled: false
    }
  })
  const policyRow = rowOf(policy.data)
  ensure(policyRow?.permission_mode === 'strict', `expected strict policy, got ${policyRow?.permission_mode}`)

  const out = await request('/api/rpc/transition_workflow_instance', {
    method: 'POST',
    headers: profileHeaders('workflow'),
    body: {
      p_instance_id: created.workflowInstanceId,
      p_next_task_id: 'Task_Done',
      p_complete: false,
      p_variables: { approval_comment: 'strict missing rule probe', runId }
    }
  })
  ensure(out.status === 403, `expected 403, got ${out.status}: ${String(out.text).slice(0, 200)}`)
  ensure(String(out.text).includes('status transition rule required'), `expected missing rule message, got ${String(out.text).slice(0, 200)}`)
  const record = await fetchDataRecord()
  ensure(record.status === 'FLOW_REVIEW', `expected FLOW_REVIEW after rejected transition, got ${record.status}`)
  return { detail: `blocked=${out.status}, record_status=${record.status}`, statusCode: out.status }
})

await step('18 create explicit strict transition rule', async () => {
  const out = await api('/api/workflow_transition_rules', {
    method: 'POST',
    headers: profileHeaders('app_center', { Prefer: 'return=representation' }),
    body: {
      workflow_app_id: created.appId,
      from_task_id: 'Task_Review',
      to_task_id: 'Task_Done',
      from_state: 'FLOW_REVIEW',
      to_state: 'FLOW_DONE',
      required_permission: 'op:chain_test.status_transition.flow_review_flow_done',
      is_active: true
    }
  })
  const rule = rowOf(out.data)
  ensure(rule?.id, 'workflow transition rule id missing')
  return { detail: `rule_id=${rule.id}`, statusCode: out.status }
})

await step('19 transition workflow and verify state writeback', async () => {
  const out = await api('/api/rpc/transition_workflow_instance', {
    method: 'POST',
    headers: profileHeaders('workflow'),
    body: {
      p_instance_id: created.workflowInstanceId,
      p_next_task_id: 'Task_Done',
      p_complete: false,
      p_variables: { approval_comment: 'codex chain transition', runId }
    }
  })
  const instance = rowOf(out.data)
  ensure(instance?.current_task_id === 'Task_Done', `expected Task_Done, got ${instance?.current_task_id}`)
  const record = await fetchDataRecord()
  ensure(record.status === 'FLOW_DONE', `expected FLOW_DONE, got ${record.status}`)
  return { detail: `current_task=${instance.current_task_id}, record_status=${record.status}`, statusCode: out.status }
})

await step('20 complete workflow and verify final state', async () => {
  const out = await api('/api/rpc/transition_workflow_instance', {
    method: 'POST',
    headers: profileHeaders('workflow'),
    body: {
      p_instance_id: created.workflowInstanceId,
      p_next_task_id: null,
      p_complete: true,
      p_variables: { approval_comment: 'codex chain complete', runId }
    }
  })
  const instance = rowOf(out.data)
  ensure(instance?.status === 'COMPLETED', `expected COMPLETED, got ${instance?.status}`)
  const record = await fetchDataRecord()
  ensure(record.status === 'FLOW_DONE', `expected FLOW_DONE, got ${record.status}`)
  return { detail: `instance_status=${instance.status}, record_status=${record.status}`, statusCode: out.status }
})

await step('21 workflow event audit trail is readable', async () => {
  const out = await api(`/api/instance_events?instance_id=eq.${filterValue(created.workflowInstanceId)}&select=id,event_type,from_task_id,to_task_id&order=id.asc`, {
    headers: profileHeaders('workflow')
  })
  ensure(Array.isArray(out.data) && out.data.length >= 3, `expected at least 3 events, got ${out.data?.length || 0}`)
  const eventTypes = out.data.map((row) => row.event_type).join(',')
  ensure(eventTypes.includes('INSTANCE_STARTED'), 'missing INSTANCE_STARTED event')
  ensure(eventTypes.includes('TASK_TRANSITION'), 'missing TASK_TRANSITION event')
  ensure(eventTypes.includes('INSTANCE_COMPLETED'), 'missing INSTANCE_COMPLETED event')
  return { detail: `events=${eventTypes}`, statusCode: out.status }
})

await step('22 HR archive create-update-delete closes loop', async () => {
  const create = await api('/api/archives', {
    method: 'POST',
    headers: profileHeaders('hr', { Prefer: 'return=representation' }),
    body: {
      name: `__eiscore_chain_${runId}_employee`,
      employee_no: `EIS-${runId}`,
      department: 'QA',
      position: 'Automation',
      phone: '13000000000',
      properties: { chainTest: true, runId }
    }
  })
  const archive = rowOf(create.data)
  ensure(archive?.id, 'hr archive id missing')
  created.hrArchiveId = archive.id

  const patch = await api(`/api/archives?id=eq.${filterValue(created.hrArchiveId)}`, {
    method: 'PATCH',
    headers: profileHeaders('hr', { Prefer: 'return=representation' }),
    body: { department: 'QA-Updated', base_salary: 1 }
  })
  const updated = rowOf(patch.data)
  ensure(updated?.department === 'QA-Updated', `expected QA-Updated, got ${updated?.department}`)

  await api(`/api/archives?id=eq.${filterValue(created.hrArchiveId)}`, {
    method: 'DELETE',
    headers: profileHeaders('hr')
  })
  const verify = await api(`/api/archives?id=eq.${filterValue(created.hrArchiveId)}&select=id`, {
    headers: profileHeaders('hr')
  })
  ensure(Array.isArray(verify.data) && verify.data.length === 0, 'hr archive should be deleted')
  const deletedId = created.hrArchiveId
  created.hrArchiveId = null
  return `archive_id=${deletedId} deleted`
})

await step('23 SCM warehouse create-update-delete closes loop', async () => {
  const create = await api('/api/warehouses', {
    method: 'POST',
    headers: profileHeaders('scm', { Prefer: 'return=representation' }),
    body: {
      code: `E2E${Date.now()}`,
      name: `Codex Chain Warehouse ${runId}`,
      level: 1,
      status: '启用',
      created_by: 'codex-chain-test',
      properties: { chainTest: true, runId }
    }
  })
  const warehouse = rowOf(create.data)
  ensure(warehouse?.id, 'warehouse id missing')
  created.warehouseId = warehouse.id

  const patch = await api(`/api/warehouses?id=eq.${filterValue(created.warehouseId)}`, {
    method: 'PATCH',
    headers: profileHeaders('scm', { Prefer: 'return=representation' }),
    body: { name: `Codex Chain Warehouse Updated ${runId}` }
  })
  const updated = rowOf(patch.data)
  ensure(String(updated?.name || '').includes('Updated'), `expected updated name, got ${updated?.name}`)

  await api(`/api/warehouses?id=eq.${filterValue(created.warehouseId)}`, {
    method: 'DELETE',
    headers: profileHeaders('scm')
  })
  const verify = await api(`/api/warehouses?id=eq.${filterValue(created.warehouseId)}&select=id`, {
    headers: profileHeaders('scm')
  })
  ensure(Array.isArray(verify.data) && verify.data.length === 0, 'warehouse should be deleted')
  const deletedId = created.warehouseId
  created.warehouseId = ''
  return `warehouse_id=${deletedId} deleted`
})

await cleanupArtifacts()

const total = results.length
const passCount = results.filter((r) => r.pass).length
const failCount = total - passCount

const output = {
  generatedAt,
  baseUrl: BASE_URL,
  runId,
  dataTable: DATA_TABLE_QUALIFIED,
  keepData: KEEP_DATA,
  summary: { total, pass: passCount, fail: failCount },
  results,
  cleanupErrors
}

const text = `${JSON.stringify(output, null, 2)}\n`
console.log(text)

if (RESULT_FILE) {
  const target = resolve(RESULT_FILE)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text, 'utf8')
}

if (failCount > 0) process.exitCode = 1
