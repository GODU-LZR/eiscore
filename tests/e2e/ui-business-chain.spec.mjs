// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect, test } from '@playwright/test'
import {
  createUiErrorMonitor,
  expectGridReady,
  expectSubAppReady,
  gotoWithRetry,
  loginByApi,
  seedAuth
} from './helpers.mjs'

test.setTimeout(420_000)

const KEEP_DATA = process.env.EISCORE_E2E_CHAIN_KEEP_DATA === '1'
const DATA_TABLE = process.env.EISCORE_E2E_CHAIN_TABLE || process.env.EISCORE_CHAIN_TABLE || 'eiscore_chain_test_records'
const DATA_TABLE_QUALIFIED = `app_data.${DATA_TABLE}`

const dataColumns = [
  { field: 'title', label: 'Title', type: 'text' },
  { field: 'status', label: 'Status', type: 'text' },
  { field: 'run_id', label: 'Run ID', type: 'text' },
  { field: 'amount', label: 'Amount', type: 'number' }
]

function rowOf(value) {
  return Array.isArray(value) ? value[0] : value
}

function filterValue(value) {
  return encodeURIComponent(String(value))
}

function profileHeaders(token, schema, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Profile': schema,
    'Content-Profile': schema,
    ...extra
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function api(request, auth, path, { method = 'GET', schema = 'public', data, headers = {}, timeout = 20_000 } = {}) {
  const response = await request.fetch(path, {
    method,
    headers: profileHeaders(auth.token, schema, headers),
    data,
    timeout
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  if (!response.ok()) {
    const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    throw new Error(`${method} ${path} -> ${response.status()}: ${String(detail || '').slice(0, 300)}`)
  }

  return { status: response.status(), data: parsed, text }
}

async function optionalDelete(request, auth, path, schema, description) {
  try {
    await api(request, auth, path, { method: 'DELETE', schema })
    return null
  } catch (error) {
    return `${description}: ${error?.message || String(error)}`
  }
}

async function cleanupArtifacts(request, auth, created) {
  if (KEEP_DATA) return []

  const errors = []
  const cleanup = async (path, schema, description) => {
    const error = await optionalDelete(request, auth, path, schema, description)
    if (error) errors.push(error)
  }

  if (created.workflowInstanceId) {
    await cleanup(`/api/instances?id=eq.${filterValue(created.workflowInstanceId)}`, 'workflow', 'workflow instance')
  }
  if (created.workflowDefinitionId) {
    await cleanup(`/api/task_assignments?definition_id=eq.${filterValue(created.workflowDefinitionId)}`, 'workflow', 'workflow task assignments')
    await cleanup(`/api/definitions?id=eq.${filterValue(created.workflowDefinitionId)}`, 'workflow', 'workflow definition')
  }
  if (created.appId) {
    await cleanup(`/api/workflow_state_mappings?workflow_app_id=eq.${filterValue(created.appId)}`, 'app_center', 'workflow state mappings')
  }
  if (created.routeId) {
    await cleanup(`/api/published_routes?id=eq.${filterValue(created.routeId)}`, 'app_center', 'published route')
  }
  if (created.appId) {
    await cleanup(`/api/apps?id=eq.${filterValue(created.appId)}`, 'app_center', 'app center app')
  }
  if (created.dataRecordId) {
    await cleanup(`/api/${DATA_TABLE}?id=eq.${filterValue(created.dataRecordId)}`, 'app_data', 'data app record')
  }
  if (created.hrArchiveId) {
    await cleanup(`/api/archives?id=eq.${filterValue(created.hrArchiveId)}`, 'hr', 'hr archive')
  }
  if (created.warehouseId) {
    await cleanup(`/api/warehouses?id=eq.${filterValue(created.warehouseId)}`, 'scm', 'scm warehouse')
  }

  return errors
}

async function waitForDataTable(request, auth) {
  let lastError = null
  for (let index = 0; index < 12; index += 1) {
    try {
      await api(request, auth, `/api/${DATA_TABLE}?select=id,title,status,run_id,amount&limit=1`, {
        schema: 'app_data',
        timeout: 5_000
      })
      return
    } catch (error) {
      lastError = error
      await sleep(1_500)
    }
  }
  throw lastError || new Error(`${DATA_TABLE_QUALIFIED} did not become visible`)
}

async function fetchDataRecord(request, auth, created) {
  const out = await api(request, auth, `/api/${DATA_TABLE}?id=eq.${filterValue(created.dataRecordId)}&select=id,title,status,run_id,amount`, {
    schema: 'app_data'
  })
  const record = rowOf(out.data)
  expect(record?.id, 'data record should exist').toBe(created.dataRecordId)
  return record
}

async function createDataApp(request, auth, runId, appName, created) {
  const out = await api(request, auth, '/api/apps', {
    method: 'POST',
    schema: 'app_center',
    headers: { Prefer: 'return=representation' },
    data: {
      name: appName,
      description: 'Codex UI business chain automation data app',
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
        createTable: false
      },
      created_by: 'codex-ui-chain-test',
      updated_by: 'codex-ui-chain-test'
    }
  })
  const app = rowOf(out.data)
  expect(app?.id, 'created app id should exist').toBeTruthy()
  created.appId = String(app.id)

  await api(request, auth, `/api/apps?id=eq.${filterValue(created.appId)}`, {
    method: 'PATCH',
    schema: 'app_center',
    headers: { Prefer: 'return=representation' },
    data: {
      status: 'published',
      updated_by: 'codex-ui-chain-test',
      description: 'Codex UI business chain automation data app - published'
    }
  })

  const route = await api(request, auth, '/api/published_routes', {
    method: 'POST',
    schema: 'app_center',
    headers: { Prefer: 'return=representation' },
    data: {
      app_id: created.appId,
      route_path: `/apps/eiscore-ui-chain-${runId}`,
      mount_point: 'app-center',
      is_active: true
    }
  })
  const routeRow = rowOf(route.data)
  expect(routeRow?.id, 'published route id should exist').toBeTruthy()
  created.routeId = routeRow.id

  const table = await api(request, auth, '/api/rpc/create_data_app_table', {
    method: 'POST',
    schema: 'app_center',
    data: {
      app_id: created.appId,
      table_name: DATA_TABLE,
      columns: dataColumns
    }
  })
  expect(String(table.data || table.text), 'create table response should mention target table').toContain(DATA_TABLE_QUALIFIED)
  await waitForDataTable(request, auth)
}

async function createDataRecord(request, auth, runId, created) {
  const out = await api(request, auth, `/api/${DATA_TABLE}`, {
    method: 'POST',
    schema: 'app_data',
    headers: { Prefer: 'return=representation' },
    data: {
      title: `Codex UI chain ${runId}`,
      status: 'DRAFT',
      run_id: runId,
      amount: 100,
      properties: { chainTest: true, runId }
    }
  })
  const record = rowOf(out.data)
  expect(record?.id, 'data app record id should exist').toBeTruthy()
  created.dataRecordId = String(record.id)

  await api(request, auth, `/api/${DATA_TABLE}?id=eq.${filterValue(created.dataRecordId)}`, {
    method: 'PATCH',
    schema: 'app_data',
    headers: { Prefer: 'return=representation' },
    data: { status: 'READY', amount: 128 }
  })

  const updated = await fetchDataRecord(request, auth, created)
  expect(updated.status).toBe('READY')
  expect(Number(updated.amount)).toBe(128)
}

async function createWorkflow(request, auth, runId, created) {
  const definitionOut = await api(request, auth, '/api/definitions', {
    method: 'POST',
    schema: 'workflow',
    headers: { Prefer: 'return=representation' },
    data: {
      name: `__eiscore_ui_chain_${runId}_definition`,
      bpmn_xml: '<definitions><process id="ui_chain_test"><userTask id="Task_Review"/><userTask id="Task_Done"/></process></definitions>',
      associated_table: DATA_TABLE_QUALIFIED,
      app_id: created.appId
    }
  })
  const definition = rowOf(definitionOut.data)
  expect(definition?.id, 'workflow definition id should exist').toBeTruthy()
  created.workflowDefinitionId = definition.id

  const assignments = await api(request, auth, '/api/task_assignments', {
    method: 'POST',
    schema: 'workflow',
    headers: { Prefer: 'return=representation' },
    data: [
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
  expect(assignments.data, 'workflow should have two task assignments').toHaveLength(2)

  const mappings = await api(request, auth, '/api/workflow_state_mappings', {
    method: 'POST',
    schema: 'app_center',
    headers: { Prefer: 'return=representation' },
    data: [
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
  expect(mappings.data, 'workflow should have two state mappings').toHaveLength(2)
}

async function startWorkflow(request, auth, runId, created) {
  const out = await api(request, auth, '/api/rpc/start_workflow_instance', {
    method: 'POST',
    schema: 'workflow',
    data: {
      p_definition_id: created.workflowDefinitionId,
      p_business_key: String(created.dataRecordId),
      p_initial_task_id: 'Task_Review',
      p_variables: { runId }
    }
  })
  const instance = rowOf(out.data)
  expect(instance?.id, 'workflow instance id should exist').toBeTruthy()
  created.workflowInstanceId = instance.id

  const record = await fetchDataRecord(request, auth, created)
  expect(record.status).toBe('FLOW_REVIEW')
}

async function transitionWorkflow(request, auth, runId, created) {
  const out = await api(request, auth, '/api/rpc/transition_workflow_instance', {
    method: 'POST',
    schema: 'workflow',
    data: {
      p_instance_id: created.workflowInstanceId,
      p_next_task_id: 'Task_Done',
      p_complete: false,
      p_variables: { approval_comment: 'codex ui chain transition', runId }
    }
  })
  const instance = rowOf(out.data)
  expect(instance?.current_task_id).toBe('Task_Done')

  const record = await fetchDataRecord(request, auth, created)
  expect(record.status).toBe('FLOW_DONE')
}

async function completeWorkflow(request, auth, runId, created) {
  const out = await api(request, auth, '/api/rpc/transition_workflow_instance', {
    method: 'POST',
    schema: 'workflow',
    data: {
      p_instance_id: created.workflowInstanceId,
      p_next_task_id: null,
      p_complete: true,
      p_variables: { approval_comment: 'codex ui chain complete', runId }
    }
  })
  const instance = rowOf(out.data)
  expect(instance?.status).toBe('COMPLETED')

  const events = await api(
    request,
    auth,
    `/api/instance_events?instance_id=eq.${filterValue(created.workflowInstanceId)}&select=id,event_type,from_task_id,to_task_id&order=id.asc`,
    { schema: 'workflow' }
  )
  expect(Array.isArray(events.data), 'workflow audit events should be an array').toBeTruthy()
  expect(events.data.map((row) => row.event_type)).toEqual(expect.arrayContaining([
    'INSTANCE_STARTED',
    'TASK_TRANSITION',
    'INSTANCE_COMPLETED'
  ]))
}

async function createHrArchive(request, auth, runId, created) {
  const employeeNo = `EIS-${runId}`
  const out = await api(request, auth, '/api/archives', {
    method: 'POST',
    schema: 'hr',
    headers: { Prefer: 'return=representation' },
    data: {
      name: `__eiscore_ui_chain_${runId}_employee`,
      employee_no: employeeNo,
      department: 'QA',
      position: 'Automation',
      status: '在职',
      phone: '13000000000',
      properties: { chainTest: true, runId }
    }
  })
  const archive = rowOf(out.data)
  expect(archive?.id, 'hr archive id should exist').toBeTruthy()
  created.hrArchiveId = archive.id
  created.employeeNo = employeeNo
}

async function updateHrArchive(request, auth, created) {
  const out = await api(request, auth, `/api/archives?id=eq.${filterValue(created.hrArchiveId)}`, {
    method: 'PATCH',
    schema: 'hr',
    headers: { Prefer: 'return=representation' },
    data: { department: 'QA-Updated', base_salary: 1 }
  })
  const archive = rowOf(out.data)
  expect(archive?.department).toBe('QA-Updated')
}

async function deleteHrArchive(request, auth, created) {
  await api(request, auth, `/api/archives?id=eq.${filterValue(created.hrArchiveId)}`, {
    method: 'DELETE',
    schema: 'hr'
  })
  const verify = await api(request, auth, `/api/archives?id=eq.${filterValue(created.hrArchiveId)}&select=id`, {
    schema: 'hr'
  })
  expect(verify.data).toHaveLength(0)
  created.hrArchiveId = null
}

async function createWarehouse(request, auth, runId, created) {
  const warehouseCode = `UI${Date.now().toString().slice(-10)}`
  const warehouseName = `Codex UI Chain Warehouse ${runId}`
  const out = await api(request, auth, '/api/warehouses', {
    method: 'POST',
    schema: 'scm',
    headers: { Prefer: 'return=representation' },
    data: {
      code: warehouseCode,
      name: warehouseName,
      level: 1,
      status: '启用',
      created_by: 'codex-ui-chain-test',
      properties: { chainTest: true, runId }
    }
  })
  const warehouse = rowOf(out.data)
  expect(warehouse?.id, 'warehouse id should exist').toBeTruthy()
  created.warehouseId = warehouse.id
  created.warehouseCode = warehouseCode
  created.warehouseName = warehouseName
}

async function updateWarehouse(request, auth, runId, created) {
  const updatedName = `Codex UI Chain Warehouse Updated ${runId}`
  const out = await api(request, auth, `/api/warehouses?id=eq.${filterValue(created.warehouseId)}`, {
    method: 'PATCH',
    schema: 'scm',
    headers: { Prefer: 'return=representation' },
    data: { name: updatedName }
  })
  const warehouse = rowOf(out.data)
  expect(warehouse?.name).toBe(updatedName)
  created.warehouseName = updatedName
}

async function deleteWarehouse(request, auth, created) {
  await api(request, auth, `/api/warehouses?id=eq.${filterValue(created.warehouseId)}`, {
    method: 'DELETE',
    schema: 'scm'
  })
  const verify = await api(request, auth, `/api/warehouses?id=eq.${filterValue(created.warehouseId)}&select=id`, {
    schema: 'scm'
  })
  expect(verify.data).toHaveLength(0)
  created.warehouseId = ''
}

async function getGridSearchInput(page) {
  const guided = page.locator('[data-guide="grid-search"] input').first()
  const guidedVisible = await guided.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false)
  if (guidedVisible) return guided
  const placeholder = page.getByPlaceholder('搜索全表...').first()
  await expect(placeholder).toBeVisible()
  return placeholder
}

async function searchGrid(page, query, monitor, label) {
  await expectGridReady(page)
  const input = await getGridSearchInput(page)
  await input.click()
  await input.fill('')
  await input.fill(query)
  await input.press('Enter').catch(() => {})
  await page.waitForTimeout(900)
  await monitor.expectClean(label)
}

async function expectGridText(page, expected, label) {
  await expect(page.locator('[data-guide="grid-wrapper"]').first(), label).toContainText(expected, { timeout: 45_000 })
}

async function expectGridNotText(page, unexpected, label) {
  await expect(page.locator('[data-guide="grid-wrapper"]').first(), label).not.toContainText(unexpected, { timeout: 30_000 })
}

async function reloadGridAndSearch(page, query, monitor, label) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await searchGrid(page, query, monitor, label)
}

async function clickWarehouseNode(page, nodeText) {
  await expectSubAppReady(page)
  const tree = page.locator('.warehouse-tree-component').first()
  await expect(tree).toBeVisible({ timeout: 45_000 })
  const node = tree.locator('.tree-node').filter({ hasText: nodeText }).first()
  await expect(node, `warehouse node ${nodeText} should be visible`).toBeVisible({ timeout: 45_000 })
  await node.scrollIntoViewIfNeeded()
  await node.click()
  await expect(page.locator('.warehouse-main')).toContainText(nodeText, { timeout: 20_000 })
}

test('UI closes the full business chain across app center, workflow, HR, and warehouse', async ({ page, request }) => {
  const auth = await loginByApi(request)
  await seedAuth(page, auth)

  const runId = `ui_chain_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
  const appName = `__eiscore_ui_chain_${runId}`
  const created = {
    appId: '',
    routeId: null,
    dataRecordId: '',
    workflowDefinitionId: null,
    workflowInstanceId: null,
    hrArchiveId: null,
    employeeNo: '',
    warehouseId: '',
    warehouseCode: '',
    warehouseName: ''
  }
  let cleanupErrors = []

  try {
    await test.step('API prepares isolated app center, dynamic data, workflow, HR, and warehouse records', async () => {
      await Promise.all([
        api(request, auth, '/api/apps?select=id,name,app_type,status&order=updated_at.desc&limit=1', { schema: 'app_center' }),
        api(request, auth, '/api/archives?select=id,name,employee_no&order=id.desc&limit=1', { schema: 'hr' }),
        api(request, auth, '/api/warehouses?select=id,code,name,status&order=code.asc&limit=1', { schema: 'scm' })
      ])
      await createDataApp(request, auth, runId, appName, created)
      await createDataRecord(request, auth, runId, created)
      await createWorkflow(request, auth, runId, created)
      await createHrArchive(request, auth, runId, created)
      await createWarehouse(request, auth, runId, created)
    })

    const monitor = createUiErrorMonitor(page)

    await test.step('UI verifies the generated app in app center config', async () => {
      await gotoWithRetry(page, '/apps/config-center')
      await expectSubAppReady(page)
      const search = page.getByPlaceholder('搜索应用').first()
      await expect(search).toBeVisible({ timeout: 45_000 })
      await search.click()
      await search.fill(appName)
      const item = page.locator('.app-list-item').filter({ hasText: appName }).first()
      await expect(item).toBeVisible({ timeout: 45_000 })
      await item.click()

      const panel = page.locator('.app-config-panel').first()
      await expect(panel).toContainText('应用名称')
      await expect(panel.locator('.el-form-item').filter({ hasText: '应用名称' }).locator('input').first()).toHaveValue(appName)
      await expect(panel.locator('.el-form-item').filter({ hasText: '业务表' }).locator('input').first()).toHaveValue(DATA_TABLE_QUALIFIED)
      await monitor.expectClean('app center generated config')
    })

    await test.step('UI verifies dynamic data record before and after workflow state writeback', async () => {
      await gotoWithRetry(page, `/apps/app/${created.appId}?appName=${encodeURIComponent(appName)}`)
      await searchGrid(page, runId, monitor, 'dynamic data READY search')
      await expectGridText(page, runId, 'dynamic data row should include runId')
      await expectGridText(page, 'READY', 'dynamic data row should include READY status')
      await expectGridText(page, '128', 'dynamic data row should include patched amount')

      await startWorkflow(request, auth, runId, created)
      await reloadGridAndSearch(page, runId, monitor, 'dynamic data FLOW_REVIEW search')
      await expectGridText(page, 'FLOW_REVIEW', 'workflow start should write back FLOW_REVIEW')

      await transitionWorkflow(request, auth, runId, created)
      await reloadGridAndSearch(page, runId, monitor, 'dynamic data FLOW_DONE search')
      await expectGridText(page, 'FLOW_DONE', 'workflow transition should write back FLOW_DONE')

      await completeWorkflow(request, auth, runId, created)
      await monitor.expectClean('dynamic workflow status close loop')
    })

    await test.step('UI verifies HR archive create, update, and delete loop', async () => {
      await gotoWithRetry(page, '/hr/employee')
      await searchGrid(page, created.employeeNo, monitor, 'HR created employee search')
      await expectGridText(page, created.employeeNo, 'HR grid should show created employee number')
      await expectGridText(page, 'QA', 'HR grid should show created employee department')

      await updateHrArchive(request, auth, created)
      await reloadGridAndSearch(page, created.employeeNo, monitor, 'HR updated employee search')
      await expectGridText(page, 'QA-Updated', 'HR grid should show updated department')

      await deleteHrArchive(request, auth, created)
      await reloadGridAndSearch(page, created.employeeNo, monitor, 'HR deleted employee search')
      await expectGridNotText(page, created.employeeNo, 'HR grid should no longer show deleted employee')
    })

    await test.step('UI verifies warehouse create, update, and delete loop', async () => {
      await gotoWithRetry(page, '/materials/warehouses')
      await clickWarehouseNode(page, created.warehouseName)
      await expect(page.locator('.warehouse-main')).toContainText(created.warehouseCode)
      await monitor.expectClean('warehouse created node click')

      await updateWarehouse(request, auth, runId, created)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await clickWarehouseNode(page, created.warehouseName)
      await expect(page.locator('.warehouse-main')).toContainText(created.warehouseCode)
      await monitor.expectClean('warehouse updated node click')

      const deletedWarehouseName = created.warehouseName
      const deletedWarehouseCode = created.warehouseCode
      await deleteWarehouse(request, auth, created)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expectSubAppReady(page)
      await expect(page.locator('.warehouse-tree-component')).not.toContainText(deletedWarehouseName, { timeout: 30_000 })
      await expect(page.locator('.warehouse-tree-component')).not.toContainText(deletedWarehouseCode, { timeout: 30_000 })
      await monitor.expectClean('warehouse deleted node absence')
    })
  } finally {
    cleanupErrors = await cleanupArtifacts(request, auth, created)
  }

  expect(cleanupErrors, 'generated UI business chain artifacts should be cleaned up').toEqual([])
})
