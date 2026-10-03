// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateDatabaseBaseline } from '../../scripts/check-database-baseline.mjs'

const root = resolve(import.meta.dirname, '../..')
const baseline = validateDatabaseBaseline({ root })
assert.deepEqual(baseline.errors, [])
const schema = readFileSync(resolve(root, baseline.manifest.schema.path), 'utf8')
const catalog = JSON.parse(readFileSync(resolve(root, baseline.manifest.objectCatalog.path), 'utf8'))
const usernameClaim = "((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)"
const ownedTables = [
  ['twin_knowledge_files', 'twin_knowledge_own', 'employee_id'],
  ['twin_sessions', 'twin_sessions_own', 'employee_id'],
  ['twin_messages', 'twin_messages_own', 'session_id'],
  ['twin_tool_logs', 'twin_tool_logs_own', 'session_id']
]

for (const [table, policy, ownerColumn] of ownedTables) {
  assert.ok(catalog.objects.some((item) => item.schema === 'app_data' && item.type === 'ROW SECURITY' && item.name === table), `${table} must have RLS enabled in the release baseline`)
  assert.ok(catalog.objects.some((item) => item.schema === 'app_data' && item.type === 'POLICY' && item.name === `${table} ${policy}`), `${table} must retain its owner policy in the release baseline`)
  assert.ok(schema.includes(`ALTER TABLE app_data.${table} ENABLE ROW LEVEL SECURITY;`), `${table} RLS declaration is missing`)
  const start = schema.indexOf(`CREATE POLICY ${policy} ON app_data.${table}`)
  assert.notEqual(start, -1, `${policy} SQL is missing`)
  const statement = schema.slice(start, schema.indexOf(';', start) + 1)
  assert.ok(statement.includes('USING ('), `${policy} must enforce row ownership`)
  assert.ok(statement.includes(usernameClaim), `${policy} must derive ownership from the authenticated JWT username`)
  assert.equal(statement.includes('COALESCE('), false, `${policy} must fail closed when the JWT username claim is absent`)
  if (ownerColumn === 'employee_id') assert.ok(statement.includes(`employee_id = ${usernameClaim}`), `${policy} must scope rows to the current employee`)
  else {
    assert.match(statement, /session_id IN \( SELECT twin_sessions\.id/)
    assert.match(statement, /FROM app_data\.twin_sessions/)
    assert.ok(statement.includes(`twin_sessions.employee_id = ${usernameClaim}`), `${policy} must scope child rows through an owned session`)
  }
}

console.log('PASS: release baseline keeps digital twin tables RLS-protected and owned by the authenticated username')
