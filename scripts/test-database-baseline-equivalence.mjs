// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256File } from './database-baseline-contract.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'database/baselines/eiscore-db-v1/manifest.json'), 'utf8'))
const sourceDump = resolve(repoRoot, 'tests/.artifacts/eiscore-g35-baseline.dump')
const artifactDir = mkdtempSync(resolve(repoRoot, 'tests/.artifacts/db1-equivalence-'))
const maxOutput = 64 * 1024 * 1024

const run = (command, args, label, { quiet = true } = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: maxOutput,
    windowsHide: true
  })
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim()
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`)
  }
  if (!quiet && result.stdout) process.stdout.write(result.stdout)
  return String(result.stdout || '').trim()
}

const docker = (args, label) => run('docker', args, label)

const waitForPostgres = (name) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'postgres'], {
      encoding: 'utf8',
      windowsHide: true
    })
    if (result.status === 0) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  }
  throw new Error(`${name} did not become ready within 30 seconds`)
}

const withDatabase = (label, callback, { withSourceDump = false } = {}) => {
  const name = `eiscore-db1-${label}-${process.pid}-${randomBytes(4).toString('hex')}`
  const mounts = [
    '--mount', `type=bind,source=${repoRoot},target=/repo,readonly`,
    '--mount', `type=bind,source=${artifactDir},target=/output`
  ]
  if (withSourceDump) mounts.push(
    '--mount', `type=bind,source=${sourceDump},target=/input/eiscore.dump,readonly`
  )
  let created = false
  try {
    docker([
      'run', '-d', '--name', name,
      '--network', 'none', '--read-only',
      '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=2g',
      '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
      '--shm-size', '256m',
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
      ...mounts,
      manifest.postgres.image
    ], `${label} container start`)
    created = true
    waitForPostgres(name)
    return callback(name)
  } finally {
    if (created) docker(['rm', '-f', '-v', name], `${label} container cleanup`)
  }
}

const psqlFile = (name, path, label) => docker([
  'exec', name, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-f', path
], label)

const query = (name, sql, label) => docker([
  'exec', name, 'psql', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres', '-d', 'postgres', '-c', sql
], label)

const assertCount = (name, relation, expected) => {
  const value = query(name, `SELECT count(*) FROM ${relation};`, `${relation} count`)
  if (value !== String(expected)) throw new Error(`${relation} count expected ${expected}, received ${value}`)
}

const assertNoBusinessRows = (name) => query(name, `DO $$
DECLARE
  item record;
  row_count bigint;
BEGIN
  FOR item IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'eiscore_meta')
      AND n.nspname !~ '^pg_toast'
    ORDER BY n.nspname, c.relname
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', item.schema_name, item.table_name) INTO row_count;
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'fresh baseline contains business rows in %.%', item.schema_name, item.table_name;
    END IF;
  END LOOP;
END
$$;`, 'fresh baseline business-row check')

const configureRuntimeSecret = (name) => {
  docker([
    'exec', '-e', 'PGRST_JWT_SECRET=Jwt8_Zp3Lm7Qx2Vc9Bn5Ks1Hd6Rt4Wy0Fa',
    '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=postgres',
    name, 'bash', '/repo/scripts/configure-database-runtime-secret.sh'
  ], 'runtime secret bootstrap')
  const setting = query(name, `SELECT setconfig::text
    FROM pg_db_role_setting
   WHERE setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
     AND setrole = 0
     AND setconfig::text LIKE '%app.jwt_secret=%';`, 'runtime secret setting check')
  if (!setting.includes('app.jwt_secret=Jwt8_')) throw new Error('runtime secret setting was not persisted')
}

const runManifest = (name, manifestPath, label) => run(process.execPath, [
  'scripts/apply-runtime-migrations.mjs',
  '--manifest', manifestPath,
  '--db-container', name,
  '--db-name', 'postgres',
  '--db-user', 'postgres',
  '--backup-evidence', `isolated://db1-${label}`,
  '--release-revision', 'db1-equivalence-v1',
  '--operator', 'db1-equivalence-test'
], `${label} migration runner`)

const dumpAndVerify = (name, outputName, label) => {
  docker([
    'exec', name, 'pg_dump', '--schema-only', '--no-owner',
    `--restrict-key=${manifest.postgres.restrictKey}`,
    '--username=postgres', '--dbname=postgres', `--file=/output/${outputName}`
  ], `${label} schema dump`)
  const actualSha = sha256File(resolve(artifactDir, outputName))
  if (actualSha !== manifest.schema.sha256) {
    throw new Error(`${label} schema checksum differs: ${actualSha}`)
  }
}

const manifests = [
  'database/migrations/runtime-v2.json',
  'database/migrations/company-site.json',
  'database/baselines/eiscore-db-v1/core-through-001.json'
]

withDatabase('fresh', (name) => {
  psqlFile(name, '/repo/env/init_roles.sql', 'fresh role bootstrap')
  psqlFile(name, '/repo/database/baselines/eiscore-db-v1/schema.sql', 'fresh schema install')
  psqlFile(name, '/repo/database/baselines/eiscore-db-v1/register.sql', 'fresh baseline registration')
  assertCount(name, 'eiscore_meta.database_baselines', 1)
  assertCount(name, 'eiscore_meta.baseline_migration_coverage', manifest.coveredMigrations.length)
  assertCount(name, 'eiscore_meta.schema_migrations', 0)
  assertNoBusinessRows(name)
  configureRuntimeSecret(name)
  for (const manifestPath of manifests) runManifest(name, manifestPath, 'fresh-baseline-coverage')
  assertCount(name, 'eiscore_meta.schema_migrations', 0)
  dumpAndVerify(name, 'fresh.sql', 'fresh install')
})

withDatabase('upgrade', (name) => {
  psqlFile(name, '/repo/env/init_roles.sql', 'upgrade role bootstrap')
  docker([
    'exec', name, 'pg_restore', '--exit-on-error', '--no-owner',
    '-U', 'postgres', '-d', 'postgres', '/input/eiscore.dump'
  ], 'upgrade predecessor restore')
  psqlFile(name, '/repo/sql/runtime_v2_postcheck.sql', 'upgrade predecessor postcheck')
  psqlFile(name, '/repo/sql/company_site_platform_v1.sql', 'upgrade company-site schema adoption')
  runManifest(name, 'database/migrations/company-site.json', 'upgrade-company-site')
  runManifest(name, 'database/baselines/eiscore-db-v1/core-through-001.json', 'upgrade-core')
  psqlFile(name, '/repo/database/baselines/eiscore-db-v1/register.sql', 'upgrade baseline registration')
  assertCount(name, 'eiscore_meta.database_baselines', 1)
  assertCount(name, 'eiscore_meta.baseline_migration_coverage', manifest.coveredMigrations.length)
  assertCount(name, 'eiscore_meta.schema_migrations', 2)
  for (const manifestPath of manifests) runManifest(name, manifestPath, 'upgrade-repeat')
  assertCount(name, 'eiscore_meta.schema_migrations', 2)
  dumpAndVerify(name, 'upgrade.sql', 'predecessor upgrade')
}, { withSourceDump: true })

console.log(`PASS: DB1 fresh install and predecessor upgrade are schema-equivalent (${manifest.schema.sha256}); evidence ${artifactDir}`)
