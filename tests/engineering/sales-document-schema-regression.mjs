// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 EISCore contributors
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { findSalesApp } from '../../eiscore-sales/src/utils/sales-apps.js'
import { loadAndValidateMigrationManifest } from '../../scripts/check-database-migrations.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const manifest = loadAndValidateMigrationManifest({ repoRoot, manifestPath: 'database/migrations/core.json' })
assert.deepEqual(manifest.errors, [])
assert.equal(manifest.migrations.at(-1).id, 'core-032')
const salesMigration = manifest.migrations.find(({ id }) => id === 'core-029')
assert.ok(salesMigration, 'sales document schema must remain in core-029')
const sql = readFileSync(resolve(repoRoot, salesMigration.path), 'utf8')
for (const [key, table] of [
  ['quotes', 'sales_quotes'], ['contracts', 'sales_contracts'], ['receivables', 'sales_receivable_schedule']
]) {
  const app = findSalesApp(key)
  const tableSql = sql.match(new RegExp(`CREATE TABLE public\\.${table} \\(([\\s\\S]*?)\\n\\);`))?.[1]
  assert.ok(tableSql, `${key}: table definition is missing`)
  for (const column of Object.keys(app.createPayload())) {
    assert.match(tableSql, new RegExp(`\\b${column}\\s+`), `${table}: frontend creates ${column}`)
  }
  for (const column of app.staticColumns.map(({ prop }) => prop)) {
    assert.match(['outstanding_amount', 'overdue_days', 'aging_status'].includes(column) ? sql : tableSql,
      new RegExp(`\\b${column}\\b`), `${key}: visible column ${column}`)
  }
}
assert.match(sql, /CREATE VIEW public\.v_sales_receivable_aging WITH \(security_invoker = true\)/)
assert.match(sql, /verify_status IN \('已核销', '部分核销'\)/)
assert.match(sql, /AFTER INSERT OR DELETE OR UPDATE OF schedule_id, amount, payment_date, verify_status, status/)
assert.match(sql, /OLD\.schedule_id IS DISTINCT FROM NEW\.schedule_id/)
assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON public\.%I TO eiscore_agent/)
assert.match(sql, /REVOKE ALL ON public\.%I FROM PUBLIC, web_anon, web_user, eiscore_agent, eiscore_flash_agent/)
assert.doesNotMatch(sql, /INSERT INTO public\.sales_/, 'migration must not import business records')
assert.doesNotMatch(sql, /GRANT [^;]+ TO web_anon/, 'new business relations must not grant anonymous access')
assert.doesNotMatch(sql, /AS \$function\$;/, 'function bodies must not start with an injected semicolon')
for (const name of ['refresh_sales_receivable_schedule(uuid)', 'sync_sales_payment_receivable_schedule()']) {
  assert.ok(sql.includes(`ALTER FUNCTION public.${name} OWNER TO eiscore_owner;`))
  assert.ok(sql.includes(`REVOKE ALL ON FUNCTION public.${name} FROM PUBLIC, web_anon, web_user, eiscore_agent, eiscore_flash_agent;`))
}
console.log('PASS: current sales quote/contract/receivable payloads, schema, payment trigger and isolated grants')
