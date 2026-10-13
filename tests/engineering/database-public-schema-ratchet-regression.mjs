// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  baselinePublicObjects,
  creationAllowedBy,
  extractExplicitPublicCreations,
  validatePublicSchemaCatalog,
  validatePublicSchemaRatchet
} from '../../scripts/public-schema-ratchet.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const result = validatePublicSchemaRatchet({ repoRoot })
assert.deepEqual(result.errors, [])
assert.equal(result.descriptor.mode, 'deny-additions-not-in-baseline')
assert.deepEqual(result.descriptor.approvedAdditions, [{
  migrationId: 'core-012',
  adr: 'docs/engineering/adr/0017-user-lifecycle-and-server-timestamps.md',
  objects: [
    'TRIGGER:users tg_users_lifecycle',
    'TRIGGER:user_roles tg_user_roles_lifecycle',
    'TRIGGER:user_roles tg_user_roles_updated_at'
  ]
}, {
  migrationId: 'core-017',
  adr: 'docs/engineering/adr/0018-dynamic-app-permission-lifecycle.md',
  objects: [
    'FUNCTION:sync_dynamic_app_permissions(uuid, text, text, jsonb)',
    'FUNCTION:cleanup_dynamic_app_permissions(uuid, text)',
    'FUNCTION:sync_app_permission_lifecycle()',
    'TRIGGER:apps tg_apps_permission_lifecycle'
  ]
}, {
  migrationId: 'core-025',
  adr: 'docs/engineering/adr/0019-twin-admin-session-overview.md',
  objects: [
    'FUNCTION:admin_twin_sessions'
  ]
}, {
  migrationId: 'core-013',
  adr: 'docs/engineering/adr/0020-acl-lifecycle-public-contract.md',
  objects: [
    'FUNCTION:enforce_role_acl_lifecycle()',
    'FUNCTION:enforce_role_acl_child_lifecycle()',
    'FUNCTION:enforce_role_user_assignment_lifecycle()',
    'FUNCTION:tg_v_roles_manage_insert()',
    'FUNCTION:tg_v_roles_manage_update()',
    'FUNCTION:tg_v_role_permissions_matrix_update()',
    'FUNCTION:tg_v_role_data_scopes_matrix_update()',
    'FUNCTION:upsert_field_acl()',
    'FUNCTION:upsert_permissions()',
    'FUNCTION:apply_role_permission_templates()',
    'FUNCTION:document_current_role_codes()',
    'FUNCTION:document_current_permissions()',
    'FUNCTION:ontology_current_role_codes()',
    'FUNCTION:ontology_current_permissions()',
    'FUNCTION:ensure_field_acl()',
    'TRIGGER:roles tg_roles_acl_lifecycle',
    'TRIGGER:role_permissions tg_role_permissions_acl_lifecycle',
    'TRIGGER:role_data_scopes tg_role_data_scopes_acl_lifecycle',
    'TRIGGER:sys_field_acl tg_sys_field_acl_lifecycle',
    'TRIGGER:user_roles tg_user_roles_acl_lifecycle',
    'TRIGGER:role_permissions tg_role_permissions_updated_at',
    'TRIGGER:v_role_permissions_matrix tg_v_role_permissions_matrix_update',
    'TRIGGER:v_role_data_scopes_matrix tg_v_role_data_scopes_matrix_update'
  ]
}, {
  migrationId: 'core-026',
  adr: 'docs/engineering/adr/0021-flash-agent-public-context.md',
  objects: [
    'FUNCTION:flash_agent_context()'
  ]
}])

const allowed = baselinePublicObjects(result.baselineCatalog, result.descriptor)
for (const exception of result.descriptor.approvedAdditions) {
  for (const key of exception.objects) allowed.add(key)
  assert.ok(/Accepted|接受。/.test(read(exception.adr)), 'public exception requires an accepted ADR')
}
assert.ok(allowed.size > 100, 'public Schema baseline allowlist is unexpectedly small')
for (const marker of [
  'TABLE:users',
  'VIEW:v_role_permissions',
  'FUNCTION:document_current_username()',
  'TYPE:jwt_token',
  'TRIGGER:roles tg_roles_updated_at'
]) assert.ok(allowed.has(marker), `public Schema allowlist lost ${marker}`)

for (const manifestPath of [
  'database/migrations/runtime-v2.json',
  'database/migrations/company-site.json',
  'database/migrations/core.json'
]) {
  const manifest = JSON.parse(read(manifestPath))
  for (const migration of manifest.migrations) {
    for (const creation of extractExplicitPublicCreations(read(migration.path))) {
      assert.ok(
        creationAllowedBy(creation, allowed),
        `${migration.id} creates unapproved public object ${creation.type}:${creation.name}`
      )
    }
  }
}

const syntheticCatalog = {
  relations: [{ schema: 'public', name: 'forbidden_business_table', kind: 'r' }],
  functions: [], types: [], triggers: []
}
assert.deepEqual(
  validatePublicSchemaCatalog({
    catalog: syntheticCatalog,
    descriptor: result.descriptor,
    baselineCatalog: result.baselineCatalog
  }).errors,
  ['unapproved public object addition: TABLE:forbidden_business_table']
)
assert.deepEqual(extractExplicitPublicCreations(`
  CREATE TABLE public.forbidden_business_table(id integer);
  CREATE OR REPLACE FUNCTION public.forbidden_rpc() RETURNS void LANGUAGE sql AS 'select';
  CREATE TRIGGER forbidden_touch BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
`), [
  { type: 'TABLE', name: 'forbidden_business_table' },
  { type: 'FUNCTION', name: 'forbidden_rpc' },
  { type: 'TRIGGER', name: 'users forbidden_touch' }
])

console.log(`PASS: public Schema additive ratchet (${allowed.size} allowed identities, approved lifecycle additions registered)`)
