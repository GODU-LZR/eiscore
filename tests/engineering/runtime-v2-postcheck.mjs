// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..', '..')

const containerName = process.env.EISCORE_DB_CONTAINER || 'eiscore-db'
const databaseName = process.env.EISCORE_DB_NAME || 'eiscore'
const databaseUser = process.env.EISCORE_DB_USER || 'postgres'
const postcheckFile = process.env.EISCORE_RUNTIME_V2_POSTCHECK_FILE || path.join(repoRoot, 'sql', 'runtime_v2_postcheck.sql')

function runDocker(args, options = {}) {
  return spawnSync('docker', args, {
    input: options.input,
    encoding: 'buffer',
    maxBuffer: 20 * 1024 * 1024
  })
}

function writeBuffer(stream, buffer) {
  if (buffer?.length) stream.write(buffer)
}

function fail(message, result) {
  console.error(message)
  if (result) {
    writeBuffer(process.stdout, result.stdout)
    writeBuffer(process.stderr, result.stderr)
  }
  process.exit(1)
}

if (!fs.existsSync(postcheckFile)) {
  fail(`Runtime V2 postcheck SQL not found: ${postcheckFile}`)
}

const ps = runDocker(['ps', '--format', '{{.Names}}'])
if (ps.error) {
  fail(`Docker is not available: ${ps.error.message}`)
}
if (ps.status !== 0) {
  fail('Unable to list running Docker containers.', ps)
}

const runningContainers = ps.stdout.toString('utf8').split(/\r?\n/).filter(Boolean)
if (!runningContainers.includes(containerName)) {
  fail(`Required database container is not running: ${containerName}`)
}

const ready = runDocker(['exec', containerName, 'pg_isready', '-U', databaseUser, '-d', databaseName])
if (ready.status !== 0) {
  fail(`Database is not ready: ${containerName}/${databaseName}`, ready)
}

const sql = fs.readFileSync(postcheckFile)
console.log(`Running Runtime V2 postcheck against ${containerName}/${databaseName}...`)

const result = runDocker([
  'exec',
  '-i',
  containerName,
  'psql',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  databaseUser,
  '-d',
  databaseName
], { input: sql })

writeBuffer(process.stdout, result.stdout)
writeBuffer(process.stderr, result.stderr)

if (result.error) {
  fail(`Runtime V2 postcheck failed to start: ${result.error.message}`)
}
if (result.status !== 0) {
  fail('Runtime V2 postcheck failed.')
}

console.log('Runtime V2 postcheck passed.')
