// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

const int64Minimum = -(2n ** 63n)
const int64Maximum = (2n ** 63n) - 1n

const boundedInteger = (label, value, minimum, maximum) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`)
  }
  return value
}

export const validateAdvisoryLockKey = (value) => {
  if (!/^-?[0-9]{1,20}$/.test(String(value || ''))) {
    throw new Error('database operation advisory lock key must be a signed 64-bit integer')
  }
  const key = BigInt(value)
  if (key < int64Minimum || key > int64Maximum) {
    throw new Error('database operation advisory lock key is outside the signed 64-bit range')
  }
  return key.toString()
}

const processDetail = (stderr, stdout) => String(stderr || stdout || '')
  .replaceAll(/\s+/g, ' ')
  .trim()
  .slice(-2000)

export const acquirePostgresAdvisoryLock = ({
  dbContainer,
  dbName,
  dbUser,
  key,
  waitTimeoutMs,
  holderExitTimeoutMs,
  operation,
  cwd,
  spawnProcess = spawn
}) => {
  const normalizedKey = validateAdvisoryLockKey(key)
  const lockWaitMs = boundedInteger('lockWaitTimeoutMs', waitTimeoutMs, 100, 300_000)
  const exitWaitMs = boundedInteger('holderExitTimeoutMs', holderExitTimeoutMs, 100, 30_000)
  const applicationName = `eiscore-${String(operation || 'database-operation').replace(/[^a-z0-9-]/gi, '-').slice(0, 40)}-lock`
  const marker = `EISCORE_LOCK_ACQUIRED_${randomBytes(12).toString('hex')}`
  const child = spawnProcess('docker', [
    'exec', '-i', '-e', `PGAPPNAME=${applicationName}`, dbContainer,
    'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At',
    '-U', dbUser, '-d', dbName
  ], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  })

  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const startupTimer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error(`database operation lock holder did not settle within ${lockWaitMs} ms`))
    }, lockWaitMs + 5_000)

    const fail = (error) => {
      if (settled) return
      settled = true
      clearTimeout(startupTimer)
      child.kill()
      reject(error)
    }

    child.once('error', (error) => fail(new Error(`database operation lock holder failed: ${error.message}`)))
    child.once('exit', (code, signal) => {
      if (settled) return
      const detail = processDetail(stderr, stdout)
      fail(new Error(
        `database operation lock was not acquired (exit ${code ?? signal ?? 'unknown'})${detail ? `: ${detail}` : ''}`
      ))
    })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
      if (settled || !stdout.includes(marker)) return
      settled = true
      clearTimeout(startupTimer)

      const guard = {
        key: normalizedKey,
        applicationName,
        assertHeld() {
          if (child.exitCode !== null || child.signalCode !== null || child.killed) {
            throw new Error('database operation advisory lock holder exited unexpectedly')
          }
        },
        release() {
          if (child.exitCode !== null || child.signalCode !== null || child.killed) return Promise.resolve()
          return new Promise((resolveRelease, rejectRelease) => {
            let releaseSettled = false
            const releaseTimer = setTimeout(() => {
              if (releaseSettled) return
              releaseSettled = true
              child.kill()
              rejectRelease(new Error('database operation advisory lock holder did not exit cleanly'))
            }, exitWaitMs)
            child.once('exit', (code, signal) => {
              if (releaseSettled) return
              releaseSettled = true
              clearTimeout(releaseTimer)
              if (code === 0) resolveRelease()
              else rejectRelease(new Error(`database operation advisory lock release failed (exit ${code ?? signal ?? 'unknown'})`))
            })
            child.stdin.end(`SELECT pg_advisory_unlock(${normalizedKey});\n\\q\n`)
          })
        }
      }
      resolve(guard)
    })

    child.stdin.write([
      `SET lock_timeout = '${lockWaitMs}ms';`,
      `SET statement_timeout = '${lockWaitMs + 1000}ms';`,
      `SELECT pg_advisory_lock(${normalizedKey});`,
      `SELECT '${marker}';`,
      ''
    ].join('\n'))
  })
}

export const withDatabaseOperationLock = async ({ adapter, policy, operation, task, log = () => {} }) => {
  const guard = await adapter.acquireOperationLock({ ...policy, operation })
  const timeoutMs = operation === 'recovery' ? policy.recoveryTimeoutMs : policy.releaseTimeoutMs
  adapter.operationLockGuard = guard
  adapter.beginOperationBudget?.({ operation, timeoutMs })
  log(`Database ${operation} lock acquired: ${guard.key}`)
  try {
    guard.assertHeld()
    return await task(guard)
  } finally {
    await guard.release()
    adapter.operationLockGuard = null
    log(`Database ${operation} lock released: ${guard.key}`)
  }
}
