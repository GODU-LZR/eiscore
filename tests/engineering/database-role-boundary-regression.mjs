// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const composePaths = ['docker-compose.yml', 'docker-compose.prod.yml']
const roleSql = read('database/migrations/sql/core-002-role-boundaries.sql')
const hrScopeSql = read('database/migrations/sql/core-005-hr-employee-identity-scope.sql')
const roleBootstrap = read('database/bootstrap/roles-v2.sql')
const secretBootstrap = read('scripts/configure-database-runtime-secrets-v2.sh')

assert.doesNotMatch(read('deploy/lundu/compose.yml'), /migrations\/sql\/.+?:\/docker-entrypoint-initdb\.d\//,
  'Lundu bootstrap must also execute governed migrations only through the runner')

for (const role of ['eiscore_owner', 'eiscore_migrator', 'eiscore_authenticator', 'eiscore_agent', 'web_anon', 'web_user']) {
  assert.ok(roleSql.includes(role), `core-002 lost role ${role}`)
  assert.ok(roleBootstrap.includes(role), `role bootstrap lost role ${role}`)
}
for (const marker of [
  'ALTER ROLE eiscore_owner NOLOGIN NOINHERIT NOBYPASSRLS',
  'ALTER ROLE eiscore_migrator NOLOGIN NOINHERIT NOBYPASSRLS',
  'ALTER ROLE eiscore_authenticator NOINHERIT NOBYPASSRLS',
  'ALTER ROLE eiscore_agent NOINHERIT NOBYPASSRLS',
  'GRANT web_anon TO eiscore_authenticator',
  'GRANT web_user TO eiscore_authenticator',
  'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC',
  'REVOKE CREATE ON SCHEMA public, app_center, app_data, company_site, hr, scm, workflow FROM PUBLIC',
  'GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO eiscore_agent'
]) assert.ok(roleSql.includes(marker), `core-002 lost boundary: ${marker}`)
assert.doesNotMatch(roleSql, /GRANT\s+(?:ALL|DELETE).*TABLES.*eiscore_agent/i)
assert.doesNotMatch(roleSql, /ALTER ROLE [^\n]+\s(?:SUPERUSER|BYPASSRLS)\b/i)

for (const marker of [
  'CREATE TABLE hr.user_employee_links',
  'REFERENCES public.users(id)',
  'REFERENCES hr.archives(id)',
  'CREATE OR REPLACE FUNCTION hr.current_employee_archive_id()',
  'CREATE OR REPLACE FUNCTION hr.can_access_employee(',
  "scope_row.scope_type = 'dept_tree'",
  "hr.can_access_employee(employee_id, 'hr_attendance')",
  "hr.can_access_employee(archive_id, 'hr_payroll')",
  'Temporary workers deliberately',
  'payroll permission'
]) assert.ok(hrScopeSql.includes(marker), `core-005 lost HR identity/scope boundary: ${marker}`)
assert.doesNotMatch(hrScopeSql, /employee_name\s*=|employee_no\s*=|department\s*=/i,
  'HR identity scope must not infer relationships from employee text fields')

for (const composePath of composePaths) {
  const compose = read(composePath)
  assert.doesNotMatch(compose, /migrations\/sql\/.+?:\/docker-entrypoint-initdb\.d\//,
    'governed migrations must not bypass the ledger during Compose bootstrap')
  assert.match(compose, /postgres:\/\/eiscore_authenticator:\$\{POSTGREST_DB_PASSWORD:\?POSTGREST_DB_PASSWORD is required\}@db:5432\/eiscore/)
  assert.match(compose, /EISCORE_AGENT_DB_USER:\s*eiscore_agent/)
  assert.match(compose, /AGENT_DB_PASSWORD:\s*"\$\{AGENT_DB_PASSWORD:\?AGENT_DB_PASSWORD is required\}"/)
  assert.doesNotMatch(compose, /PGRST_DB_URI:\s*["']?postgres:\/\/postgres:/i)
  assert.doesNotMatch(compose, /\bPGUSER:\s*["']?postgres["']?\s*$/im)
  for (const image of [...compose.matchAll(/^\s{4}image:\s*([^\s#]+)/gm)].map((match) => match[1])) {
    assert.match(image, /@sha256:[0-9a-f]{64}$/, `${composePath} has an unpinned runtime image: ${image}`)
  }
}

for (const marker of [
  ': "${POSTGREST_DB_PASSWORD:?POSTGREST_DB_PASSWORD is required}"',
  ': "${AGENT_DB_PASSWORD:?AGENT_DB_PASSWORD is required}"',
  '\\getenv postgrest_password POSTGREST_DB_PASSWORD',
  '\\getenv agent_password AGENT_DB_PASSWORD',
  "ALTER ROLE eiscore_authenticator LOGIN PASSWORD :'postgrest_password'",
  "ALTER ROLE eiscore_agent LOGIN PASSWORD :'agent_password'"
]) assert.ok(secretBootstrap.includes(marker), `secret bootstrap lost contract: ${marker}`)
assert.doesNotMatch(secretBootstrap, /PASSWORD\s+'[^']+'/i)

for (const path of [
  'realtime/index.js',
  'realtime/document-intake.js',
  'realtime/document-entry.js',
  'realtime/document-fixed-entry.js',
  'realtime/document-parser.js',
  'realtime/document-planner.js'
]) {
  const source = read(path)
  assert.doesNotMatch(source, /PGUSER\s*\|\|\s*['"]postgres|PGPASSWORD\s*\|\|\s*['"]postgres|PGDATABASE\s*\|\|\s*['"]postgres|PGHOST\s*\|\|\s*['"]localhost/)
}

console.log('PASS: DB2 role, runtime identity, secret injection and image pinning boundaries')
