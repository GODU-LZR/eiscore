// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const viewSql = readFileSync(resolve(root, 'database/migrations/sql/core-022-complete-department-scope-catalog.sql'), 'utf8')
const aclView = readFileSync(resolve(root, 'eiscore-hr/src/views/HrAclView.vue'), 'utf8')

for (const marker of [
  'FROM public.v_app_form_ontology',
  'FROM app_center.apps a',
  "'app_' || replace(a.id::text, '-', '')",
  "coalesce(a.status, '') <> 'archived'",
  'DISTINCT ON (module)',
  'source_rank DESC',
  'module_label',
  'dept_parent_id',
  'dept_status',
  'dept_sort'
]) assert.ok(viewSql.includes(marker), `scope catalog missing ${marker}`)

for (const marker of [
  'const scopeModuleGroupLabel = (key) =>',
  "value.startsWith('sales_')",
  "value.startsWith('purchase_')",
  "value.startsWith('production_')",
  "value.startsWith('quality_')",
  "value.startsWith('equipment_')",
  'params.data?.module_label || moduleLabel(params.value)',
  "'hr_payroll'"
]) assert.ok(aclView.includes(marker), `ACL scope display missing ${marker}`)

console.log('PASS: ACL scope catalog and module labels cover static, ontology and dynamic applications')
