// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const BASE_URL = (process.env.EISCORE_CHAIN_BASE_URL || process.env.EISCORE_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')
const USERNAME = process.env.EISCORE_CHAIN_USERNAME || process.env.EISCORE_SMOKE_USERNAME || 'admin'
const PASSWORD = process.env.EISCORE_CHAIN_PASSWORD || process.env.EISCORE_SMOKE_PASSWORD || '123456'
const RESULT_FILE = process.env.EISCORE_CHAIN_RESULT || ''
const KEEP_DATA = process.env.EISCORE_CHAIN_KEEP_DATA === '1'
const REQUEST_TIMEOUT_MS = Number(process.env.EISCORE_CHAIN_TIMEOUT_MS || 15000)
const DATA_TABLE = process.env.EISCORE_CHAIN_TABLE || 'eiscore_chain_test_records'
const DATA_TABLE_QUALIFIED = `app_data.${DATA_TABLE}`

const generatedAt = new Date().toISOString()
const runId = `chain_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
const results = []
const cleanupErrors = []
let token = ''

const created = {
  appId: '',
  routeId: null,
  dataRecordId: '',
  workflowDefinitionId: null,
  workflowInstanceId: null,
  hrArchiveId: null,
  warehouseId: ''
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

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function withTimeout(fn, ms = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fn(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

async function request(path, { method = 'GET', headers = {}, body, timeout = REQUEST_TIMEOUT_MS } = {}) {
  return withTimeout(async (signal) => {
    const init = { method, headers, signal }
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body)

    const res = await fetch(`${BASE_URL}${path}`, init)
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { res, status: res.status, ok: res.ok, data, text }
  }, timeout)
}

async function api(path, options = {}) {
  const out = await request(path, options)
  if (!out.ok) {
    const detail = typeof out.data === 'string' ? out.data : JSON.stringify(out.data)
    throw new Error(`${options.method || 'GET'} ${path} -> ${out.status}: ${String(detail || '').slice(0, 300)}`)
  }
  return out
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
  const out = await api('/api/rpc/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { username: USERNAME, password: PASSWORD }
  })
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

await step('17 transition workflow and verify state writeback', async () => {
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

await step('18 complete workflow and verify final state', async () => {
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

await step('19 workflow event audit trail is readable', async () => {
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

await step('20 HR archive create-update-delete closes loop', async () => {
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

await step('21 SCM warehouse create-update-delete closes loop', async () => {
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
