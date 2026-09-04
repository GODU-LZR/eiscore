// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { acquirePostgresAdvisoryLock } from './database-operation-lock.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const policy = JSON.parse(await import('node:fs').then(({ readFileSync }) => readFileSync(
  resolve(repoRoot, 'database/operations/policy.json'), 'utf8'
))).operationControl
const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`
const databaseContainer = `eiscore-db6-lock-${suffix}`
const postgresImage = 'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f'
const password = randomBytes(32).toString('base64url')

const docker = (args, { input, allowFailure = false, timeout = 60_000 } = {}) => {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result
}

const psql = (sql) => docker([
  'exec', '-i', databaseContainer,
  'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At',
  '-U', 'postgres', '-d', 'eiscore'
], { input: sql }).stdout.trim()

const acquire = (operation, waitTimeoutMs = policy.lockWaitTimeoutMs) => acquirePostgresAdvisoryLock({
  dbContainer: databaseContainer,
  dbName: 'eiscore',
  dbUser: 'postgres',
  key: policy.advisoryLockKey,
  waitTimeoutMs,
  holderExitTimeoutMs: policy.holderExitTimeoutMs,
  operation,
  cwd: repoRoot
})

try {
  docker(['version'])
  docker([
    'run', '-d', '--name', databaseContainer, '--read-only',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m',
    '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
    '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore',
    '-e', `POSTGRES_PASSWORD=${password}`,
    postgresImage
  ])
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = docker([
      'exec', databaseContainer, 'pg_isready', '-U', 'postgres', '-d', 'eiscore'
    ], { allowFailure: true })
    if (ready.status === 0) break
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
    if (attempt === 119) throw new Error('operation lock test database did not become ready')
  }

  const releaseLock = await acquire('release')
  releaseLock.assertHeld()
  assert.equal(psql(`
    SELECT count(*)
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND granted
      AND objsubid = 1;
  `), '1')

  await assert.rejects(acquire('recovery', 500), /lock|timeout|statement/i)
  releaseLock.assertHeld()
  await releaseLock.release()

  const recoveryLock = await acquire('recovery')
  recoveryLock.assertHeld()
  assert.equal(psql(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE application_name = '${recoveryLock.applicationName}';
  `), 't')
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (psql("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND granted;") === '0') break
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
    if (attempt === 39) throw new Error('PostgreSQL did not clean up the crashed lock holder')
  }

  const reacquired = await acquire('release')
  reacquired.assertHeld()
  await reacquired.release()

  console.log('PASS: release/recovery share a bounded PostgreSQL advisory lock and backend exit clears stale ownership')
} finally {
  docker(['rm', '-f', databaseContainer], { allowFailure: true })
}
