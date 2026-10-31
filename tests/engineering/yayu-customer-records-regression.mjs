// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { createHarnessCustomerRecordsExecutor } = require('../../realtime/customer-records.js')

const customerId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
const user = { id: 'user-1', username: 'yayu', tenant_id: 'tenant-1' }
const context = {
  accessPolicy: { roleScoped: true, superUser: false },
  fieldAclAvailable: true,
  permissions: [
    { code: 'app:sales_customer' },
    { code: 'op:sales_customer.create' },
    { code: 'op:sales_customer.edit' },
    { code: 'op:sales_customer.delete' }
  ],
  fieldAcl: {
    sales_customer: {
      id: { canView: true, canEdit: false },
      name: { canView: true, canEdit: true },
      contact_phone: { canView: false, canEdit: false },
      properties: { canView: true, canEdit: true },
      customer_files: { canView: true, canEdit: false }
    }
  }
}
const calls = []
const fileUpdateEvents = []
const executor = createHarnessCustomerRecordsExecutor({
  fetchSemanticContext: async () => context,
  notifyCustomerFilesUpdated: (event) => fileUpdateEvents.push(event),
  callPostgrestWithUser: async (_user, options) => {
    calls.push(options)
    if (options.method === 'GET' && options.path === '/sales_customers') {
      return { data: [{ id: customerId, name: '客户一', properties: {}, updated_at: '2026-10-27T00:00:00Z' }] }
    }
    if (options.method === 'GET' && options.path === '/files') {
      return { data: [{ id: fileId, filename: 'contract.pdf', mime_type: 'application/pdf', size_bytes: 1024, extra: { source: 'harness_customer_archive', uploaded_by: user.id, tenant_id: user.tenant_id } }] }
    }
    if (options.method === 'POST') return { data: [{ id: customerId, ...options.body }] }
    if (options.method === 'PATCH') return { data: [{ id: customerId, ...options.body, updated_at: '2026-10-27T00:01:00Z' }] }
    return { data: [] }
  }
})

const query = await executor.execute(user, { operation: 'query', select: ['id', 'name', 'contact_phone'], limit: 5 })
assert.deepEqual(query.rows[0], { id: customerId, name: '客户一', properties: {}, updated_at: '2026-10-27T00:00:00Z' })
assert.ok(calls[0].query.select.includes('id'))
assert.equal(calls[0].query.select.includes('contact_phone'), false, 'hidden fields must be removed before PostgREST')
assert.equal(calls[0].query.status, 'neq.deleted', 'default customer queries must exclude soft-deleted rows')

await assert.rejects(
  executor.execute(user, { operation: 'update', customer_id: customerId, expected_updated_at: '2026-10-27T00:00:00Z', values: { contact_phone: '13800000000' } }, { idempotency_key: 'update-contact-phone-1' }),
  (error) => error.code === 'PERMISSION_DENIED' && error.httpStatus === 403
)

await assert.rejects(
  executor.execute(user, { operation: 'update', customer_id: customerId, expected_updated_at: '2026-10-27T00:00:00Z', values: { properties: { customer_files: [] } } }, { idempotency_key: 'update-files-1' }),
  (error) => error.code === 'HARNESS_PERMISSION_DENIED' && error.httpStatus === 403
)

const created = await executor.execute(user, { operation: 'create', values: { name: '新客户', region: '华东' } }, { idempotency_key: 'create-customer-idempotency-1' })
assert.equal(created.operation, 'create')
assert.match(calls.at(-1).body.customer_no, /^AI-[A-F0-9]{24}$/)

await assert.rejects(
  executor.execute(user, { operation: 'attach_file', customer_id: customerId, file_id: fileId, expected_updated_at: '2026-10-27T00:00:00Z', category: '合同' }, { idempotency_key: 'attach-file-idempotency-1' }),
  (error) => error.code === 'HARNESS_PERMISSION_DENIED' && error.httpStatus === 403
)

context.fieldAcl.sales_customer.customer_files.canEdit = true
const attached = await executor.execute(user, { operation: 'attach_file', customer_id: customerId, file_id: fileId, expected_updated_at: '2026-10-27T00:00:00Z', category: '合同' }, { idempotency_key: 'attach-file-idempotency-2' })
assert.equal(attached.operation, 'update')
assert.equal(calls.at(-1).query.updated_at, 'eq.2026-10-27T00:00:00Z')
assert.equal(calls.at(-1).body.properties.customer_files[0].id, fileId)
assert.deepEqual(fileUpdateEvents, [{ userId: user.id, tenantId: user.tenant_id, customerId }], 'successful attachment writes notify the matching user and tenant')

const grid = readFileSync(resolve(import.meta.dirname, '../../eiscore-sales/src/components/SalesAppGrid.vue'), 'utf8')
const frame = readFileSync(resolve(import.meta.dirname, '../../eiscore-base/src/components/harness/BusinessHarnessFrame.vue'), 'utf8')
const businessUi = readFileSync(resolve(import.meta.dirname, '../../agent-harness/web-ui/business-ui.js'), 'utf8')
assert.match(grid, /event\?\.type === 'customer_files_updated'[\s\S]{0,140}scheduleGridReload\(\)/, 'the customer grid reloads when attachment is committed')
assert.match(grid, /enableRealtime\.value \|\| app\.value\.key === 'customers'/, 'customer archive always subscribes to the existing realtime client')
assert.doesNotMatch(frame, /contentExcerpt|extractFileExcerpt/)
assert.doesNotMatch(businessUi, /contentExcerpt|内容节选/)
assert.doesNotMatch(frame, /eis-harness-files-uploaded/)

console.log('PASS: customer archive Harness query/write ACL, idempotency, optimistic concurrency, and attachment ownership contract')
