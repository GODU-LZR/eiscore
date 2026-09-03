// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createAgentDatabaseConfig, resolveDatabaseConfig } = require('../../realtime/database-config')

const trackedKeys = [
  'EISCORE_DB_HOST', 'EISCORE_DB_PORT', 'EISCORE_DB_NAME', 'EISCORE_DB_USER', 'EISCORE_DB_PASSWORD',
  'EISCORE_AGENT_DB_USER', 'AGENT_DB_PASSWORD', 'EISCORE_DB_POOL_MAX', 'PGHOST', 'PGPORT', 'PGDATABASE',
  'PGUSER', 'PGPASSWORD', 'DOCUMENT_PARSE_PG_POOL_MAX'
]
const previous = Object.fromEntries(trackedKeys.map((key) => [key, process.env[key]]))

try {
  for (const key of trackedKeys) delete process.env[key]

  assert.deepEqual(createAgentDatabaseConfig(), {
    host: '127.0.0.1',
    port: 5432,
    user: '',
    password: '',
    database: 'eiscore'
  })

  Object.assign(process.env, {
    EISCORE_DB_HOST: 'db.internal',
    EISCORE_DB_PORT: '6543',
    EISCORE_DB_NAME: 'eiscore_test',
    EISCORE_AGENT_DB_USER: 'eiscore_agent',
    AGENT_DB_PASSWORD: 'runtime-secret',
    DOCUMENT_PARSE_PG_POOL_MAX: '7'
  })
  assert.deepEqual(createAgentDatabaseConfig({ poolMaxEnv: 'DOCUMENT_PARSE_PG_POOL_MAX', fallbackMax: 3 }), {
    host: 'db.internal',
    port: 6543,
    user: 'eiscore_agent',
    password: 'runtime-secret',
    database: 'eiscore_test',
    max: 7
  })

  process.env.EISCORE_DB_PORT = 'invalid'
  process.env.EISCORE_DB_POOL_MAX = '999'
  assert.equal(createAgentDatabaseConfig({ poolMaxEnv: 'DOCUMENT_PARSE_PG_POOL_MAX', fallbackMax: 3 }).port, 5432)
  assert.equal(createAgentDatabaseConfig({ poolMaxEnv: 'DOCUMENT_PARSE_PG_POOL_MAX', fallbackMax: 3 }).max, 50)

  process.env.EISCORE_DB_USER = 'generic_service'
  process.env.EISCORE_DB_PASSWORD = 'generic-secret'
  assert.equal(resolveDatabaseConfig().user, 'generic_service')
  assert.equal(resolveDatabaseConfig().password, 'generic-secret')
} finally {
  for (const key of trackedKeys) {
    if (previous[key] === undefined) delete process.env[key]
    else process.env[key] = previous[key]
  }
}

console.log('PASS: shared database configuration has explicit service credentials and no privileged defaults')
