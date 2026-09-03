// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { formatFinding, scanRepository, scanTextLine } from '../../scripts/scan-secrets.mjs'

const scan = (line, path = 'database/example.sql') => scanTextLine({
  path,
  line,
  lineNumber: 7
})

const jwtValue = ['my', 'super', 'secret'].join('_')
const apiValue = `${'a'.repeat(32)}.${'b'.repeat(16)}`
const passwordValue = ['fixed', 'password'].join('-')

const jwtFindings = scan(`  _secret text := '${jwtValue}';`)
assert.ok(jwtFindings.some(({ label }) => label.includes('PL/pgSQL signing secret')))
assert.ok(jwtFindings.some(({ label }) => label.includes('known insecure JWT')))

const apiFindings = scan(`ai_config\t{"api_key":"${apiValue}"}`)
assert.ok(apiFindings.some(({ label }) => label.includes('api_key credential')))

const passwordFindings = scan(`coalesce(new.password, '${passwordValue}')`)
assert.ok(passwordFindings.some(({ label }) => label.includes('password fallback')))

const copyFindings = scan('COPY public.users (id, username, password) FROM stdin;')
assert.ok(copyFindings.some(({ label }) => label.includes('table-data dump')))

for (const safeLine of [
  "_secret text := nullif(current_setting('app.jwt_secret', true), '');",
  'api_key: "${AI_API_KEY:?AI_API_KEY is required}"',
  '"api_key": "YOUR_API_KEY"',
  "coalesce(new.password, encode(gen_random_bytes(32), 'hex'))",
  "CREATE FUNCTION public.sign(payload json, secret text) RETURNS text"
]) assert.deepEqual(scan(safeLine), [], safeLine)

const output = formatFinding(jwtFindings[0])
assert.match(output, /^- database\/example\.sql:7 — /)
assert.equal(output.includes(jwtValue), false)
assert.equal(output.includes(apiValue), false)
assert.equal(output.includes(passwordValue), false)

const repositoryResult = scanRepository()
assert.equal(repositoryResult.quarantinedFindings.length, 5)
assert.ok(repositoryResult.quarantinedFindings.every(({ path }) => [
  'eiscore-hr/sql/fix_login_role.sql',
  'eiscore-hr/sql/user_manage_view.sql',
  'sql/patch_login_short_jwt_permissions_body.sql'
].includes(path)))
assert.deepEqual(repositoryResult.findings, [])

console.log('PASS: SQL and dump secret scanning detects credentials without printing matched values')
