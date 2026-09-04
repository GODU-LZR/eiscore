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
assert.deepEqual(result.descriptor.approvedAdditions, [])

const allowed = baselinePublicObjects(result.baselineCatalog, result.descriptor)
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

console.log(`PASS: public Schema additive ratchet (${allowed.size} grandfathered object identities, zero approved additions)`)
