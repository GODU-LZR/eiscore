// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 800, `Realtime composition root has ${lines.length} lines; exit gate is 800`)

const localDependencies = [...source.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(localDependencies, [
  './ai-context-service',
  './company-http',
  './company-sales-agent',
  './company-site',
  './database-config',
  './database-notifier',
  './document-entry',
  './document-fixed-entry',
  './document-intake',
  './document-parser',
  './document-planner',
  './flash-authorization',
  './flash-http',
  './flash-postgrest-adapter',
  './flash-semantic-executor',
  './flash-tool-registry',
  './flash-tool-service',
  './flash-workspace-config',
  './flash-workspace-service',
  './harness-runtime',
  './harness-sales-write',
  './harness-twin-context-capability',
  './http-router',
  './message-normalization',
  './twin-resource-http',
  './twin-tools',
  './websocket-server'
])

const helperDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
  .map((match) => match[1] || match[2])
  .sort()
assert.deepEqual(helperDefinitions, [
  'asUser',
  'authorizeAgentHttpRequest',
  'authorizeDocumentIntakeAdminRequest',
  'authorizeHttpRequest',
  'authorizeTwinRequest',
  'companyQuery',
  'envText',
  'executeDocumentPlan',
  'extractToken',
  'getBearerFromAuthHeader',
  'getRequestPath',
  'handleFlashHarnessResetWs',
  'handleFlashHarnessTaskWs',
  'handleFlashToolCallWs',
  'hasDocumentIntakeAdminAccess',
  'hasHarnessTenantContext',
  'logAgentEvent',
  'normalizeProjectPath',
  'normalizeRelativeAgentPath',
  'normalizeStringList',
  'parseJsonMaybe',
  'readJsonBody',
  'sanitizePathToken',
  'sanitizeQueryParams',
  'sendJson',
  'sendText',
  'sendWsJson',
  'setCorsHeaders',
  'shutdown',
  'streamTextAsSse',
  'verifyToken'
])

for (const forbidden of [
  "require('axios')",
  "require('pg')",
  "require('fs')",
  "require('crypto')",
  "require('child_process')",
  "require('chokidar')",
  'CREATE TABLE',
  'information_schema',
  '/rest/v1/',
  'inventory_stocks',
  'sales_orders',
  'purchase_orders',
  'production_orders',
  'quality_inspections',
  '.app-drafts',
  'spawn(',
  'execFile('
]) {
  assert.equal(source.includes(forbidden), false, `composition root reintroduced domain/infrastructure detail: ${forbidden}`)
}

assert.equal((source.match(/http\.createServer\(/g) || []).length, 1)
assert.equal((source.match(/new WebSocket\.Server\(/g) || []).length, 1)
assert.equal((source.match(/server\.listen\(/g) || []).length, 1)
assert.equal((source.match(/attachWebSocketServer\(\{/g) || []).length, 1)
assert.equal((source.match(/process\.on\('SIG(?:TERM|INT)'/g) || []).length, 2)
assert.match(source, /Promise\.allSettled\(\[/)
assert.doesNotMatch(source, /\bwait:\s*waitMs\b/, 'composition root must not pass an undefined waitMs dependency')

console.log(`PASS: Realtime composition-root exit gate (${lines.length} lines, ${localDependencies.length} modules, ${helperDefinitions.length} transport/config helpers)`)
