// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const bootstrap = read('database/bootstrap/roles-v2.sql')
const secrets = read('scripts/configure-database-runtime-secrets-v2.sh')
const migration = read('database/migrations/sql/core-026-flash-agent-role-boundary.sql')
const postcheck = read('database/migrations/postchecks/core.sql')
const manifest = JSON.parse(read('database/migrations/core.json'))
const entry = manifest.migrations.find(({ id }) => id === 'core-026')

assert.match(bootstrap, /rolname = 'eiscore_flash_agent'/)
assert.match(bootstrap, /ALTER ROLE eiscore_flash_agent NOLOGIN NOINHERIT NOBYPASSRLS/)
assert.match(secrets, /FLASH_AGENT_DB_PASSWORD/)
assert.match(secrets, /FLASH_AGENT_DB_PASSWORD must be independent/)
assert.match(secrets, /ALTER ROLE eiscore_flash_agent LOGIN PASSWORD/)
assert.ok(entry, 'core-026 must be registered in the ordered core manifest')
assert.equal(entry.path, 'database/migrations/sql/core-026-flash-agent-role-boundary.sql')
assert.match(entry.sha256, /^[0-9a-f]{64}$/)
for (const marker of [
  "CREATE ROLE eiscore_flash_agent",
  'REVOKE ALL ON SCHEMA public, hr, scm, app_center, app_data, company_site, workflow',
  'GRANT USAGE ON SCHEMA public TO eiscore_flash_agent',
  'GRANT USAGE ON SCHEMA app_center, app_data TO eiscore_flash_agent',
  'CREATE OR REPLACE FUNCTION public.flash_agent_context()',
  "'source', 'flash_agent_context_v1'",
  'GRANT EXECUTE ON FUNCTION public.flash_agent_context() TO eiscore_flash_agent',
  'app_type = \'flash\'',
  'AS RESTRICTIVE FOR SELECT TO eiscore_flash_agent',
  'flash_agent_apps_delete',
  'create_flash_data_app_table',
  'REVOKE ALL ON FUNCTION app_center.create_data_app_table(uuid, text, jsonb) FROM eiscore_flash_agent',
  'no Twin/BI/business access'
]) assert.match(migration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), marker)
for (const forbidden of ['GRANT SELECT ON TABLE app_data.twin_sessions', 'GRANT SELECT ON TABLE app_data.twin_messages', 'GRANT USAGE ON SCHEMA hr TO eiscore_flash_agent']) {
  assert.doesNotMatch(migration, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), forbidden)
}
assert.match(migration, /GROUP BY acl\.module, acl\.field_code/, 'field ACL flags must be reduced before JSON aggregation')
assert.doesNotMatch(migration, /jsonb_object_agg\(acl\.field_code[\s\S]*bool_or\(/, 'PostgreSQL forbids nested bool_or inside jsonb_object_agg')
assert.match(migration, /FROM app_center\.data_app_table_registry r[\s\S]*JOIN app_center\.apps a ON a\.id = r\.app_id[\s\S]*a\.app_type = 'flash'/, 'Flash context must scope registered tables to Flash apps')
assert.match(migration, /acl\.module IN \([\s\S]*a\.id::text IN \(SELECT value ->> 'app_id' FROM jsonb_array_elements\(apps\)\)/, 'Flash field ACL must be limited to visible Flash apps')
for (const forbidden of ['kgNodes', 'relations', 'agent_ontology_context']) {
  assert.doesNotMatch(migration, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Flash migration must not expose ${forbidden}`)
}
for (const marker of [
  "has_function_privilege('eiscore_flash_agent', 'public.flash_agent_context()', 'EXECUTE')",
  "has_function_privilege('eiscore_flash_agent', 'app_center.create_flash_data_app_table(uuid,text,jsonb)', 'EXECUTE')",
  "has_schema_privilege('eiscore_flash_agent', 'hr', 'USAGE')",
  "has_function_privilege('eiscore_flash_agent', 'public.agent_ontology_context(text,integer)', 'EXECUTE')",
  "has_function_privilege('eiscore_flash_agent', 'app_center.create_data_app_table(uuid,text,jsonb)', 'EXECUTE')"
]) assert.match(postcheck, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), marker)
for (const marker of [
  "has_table_privilege('eiscore_flash_agent', 'app_center.apps', 'INSERT')",
  "has_table_privilege('eiscore_flash_agent', 'app_center.execution_logs', 'DELETE')",
  "has_table_privilege('eiscore_flash_agent', 'public.users', 'SELECT')",
  "has_table_privilege('eiscore_flash_agent', 'app_data.twin_sessions', 'SELECT')"
]) assert.match(postcheck, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), marker)

console.log('PASS: Flash database role is fail-closed, manifest-governed, and limited to Flash app data')
