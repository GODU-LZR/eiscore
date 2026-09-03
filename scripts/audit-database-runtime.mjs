// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseReleaseDockerAdapter } from './deploy-database-release.mjs'
import { loadAndValidateDatabaseRelease } from './database-release-contract.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const optionsMap = new Map([
  ['--db-container', 'dbContainer'], ['--db-name', 'dbName'], ['--db-user', 'dbUser'],
  ['--api-container', 'apiContainer'], ['--api-url', 'apiUrl'], ['--output', 'output']
])

export const parseDatabaseRuntimeAuditArgs = (argv) => {
  const options = {
    dbContainer: 'eiscore-db', dbName: 'eiscore', dbUser: 'postgres',
    apiContainer: 'eiscore-api', apiUrl: '', output: ''
  }
  for (let index = 0; index < argv.length; index += 1) {
    const name = optionsMap.get(argv[index])
    if (!name) throw new Error(`unknown argument: ${argv[index]}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`missing value for ${argv[index]}`)
    options[name] = value
    index += 1
  }
  if (!options.apiUrl) throw new Error('--api-url is required')
  options.apiUrl = options.apiUrl.replace(/\/+$/, '')
  return options
}

const jsonQuery = (adapter, sql) => JSON.parse(adapter.query(`SELECT to_jsonb(report)::text FROM (${sql}) report;`))
const listQuery = (adapter, sql) => adapter.query(sql).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))

export const auditDatabaseRuntime = async ({ options, adapter }) => {
  const policy = JSON.parse(readFileSync(resolve(repoRoot, 'database/operations/policy.json'), 'utf8'))
  const release = loadAndValidateDatabaseRelease({ repoRoot })
  if (release.errors.length) throw new Error(`database release validation failed: ${release.errors.join('; ')}`)
  adapter.preflight(release.manifest)
  if (adapter.containerImage(options.apiContainer) !== release.manifest.images.postgrest) {
    throw new Error('runtime PostgREST image does not match the release manifest')
  }
  if (adapter.inspectState(options.apiContainer) !== 'running') throw new Error('runtime PostgREST container is not running')

  const thresholds = policy.health
  const database = jsonQuery(adapter, `
    SELECT d.numbackends AS "connections",
           current_setting('max_connections')::integer AS "maxConnections",
           CASE WHEN current_setting('max_connections')::numeric = 0 THEN 0
             ELSE d.numbackends / current_setting('max_connections')::numeric END AS "connectionUtilization",
           d.xact_commit AS "transactionsCommitted",
           d.xact_rollback AS "transactionsRolledBack",
           d.deadlocks,
           d.temp_bytes AS "tempBytes",
           CASE WHEN d.blks_hit + d.blks_read = 0 THEN 1
             ELSE d.blks_hit::numeric / (d.blks_hit + d.blks_read) END AS "cacheHitRatio",
           pg_database_size(current_database()) AS "databaseBytes",
           d.stats_reset AS "statsReset"
    FROM pg_stat_database d WHERE d.datname = current_database()
  `)
  const activity = jsonQuery(adapter, `
    SELECT
      count(*) FILTER (WHERE cardinality(pg_blocking_pids(a.pid)) > 0)::integer AS "blockedQueries",
      count(*) FILTER (WHERE a.state = 'active' AND a.pid <> pg_backend_pid()
        AND clock_timestamp() - a.query_start > make_interval(secs => ${Number(thresholds.activeQueryFailureSeconds)}))::integer AS "longActiveQueries",
      count(*) FILTER (WHERE a.state = 'idle in transaction'
        AND clock_timestamp() - a.xact_start > make_interval(secs => ${Number(thresholds.idleTransactionFailureSeconds)}))::integer AS "staleIdleTransactions",
      count(*) FILTER (WHERE r.rolsuper AND a.pid <> pg_backend_pid())::integer AS "runtimeSuperuserConnections"
    FROM pg_stat_activity a JOIN pg_roles r ON r.rolname = a.usename
    WHERE a.backend_type = 'client backend'
  `)
  const roleBoundaryViolations = Number(adapter.query(`
    SELECT count(*) FROM pg_roles
    WHERE rolname IN ('eiscore_owner','eiscore_migrator','eiscore_authenticator','eiscore_agent','web_anon','web_user')
      AND (rolsuper OR rolbypassrls);
  `))
  const slowActivity = listQuery(adapter, `
    SELECT jsonb_build_object(
      'pid', pid,
      'user', usename,
      'state', state,
      'seconds', floor(extract(epoch FROM (clock_timestamp() - query_start)))::integer,
      'waitEventType', wait_event_type,
      'waitEvent', wait_event,
      'queryTextCaptured', false
    )::text
    FROM pg_stat_activity
    WHERE state = 'active' AND pid <> pg_backend_pid()
      AND clock_timestamp() - query_start > make_interval(secs => ${Number(policy.slowQuery.activeQueryWarningSeconds)})
    ORDER BY query_start;
  `)
  const pgStatStatementsInstalled = adapter.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements');") === 't'
  const releaseRecord = jsonQuery(adapter, `
    SELECT release_id AS "releaseId", manifest_sha256 AS "manifestSha256",
           source_revision AS "sourceRevision", applied_at AS "appliedAt"
    FROM eiscore_meta.database_releases ORDER BY applied_at DESC LIMIT 1
  `)

  const apiProfiles = []
  for (const schema of release.manifest ? ['app_center', 'app_data', 'company_site', 'hr', 'public', 'scm', 'workflow'] : []) {
    const response = await fetch(`${options.apiUrl}/`, {
      headers: { accept: 'application/openapi+json', 'accept-profile': schema }
    })
    apiProfiles.push({ schema, status: response.status, healthy: response.status === 200 })
  }
  const errors = []
  const warnings = []
  if (Number(database.connectionUtilization) > thresholds.maximumConnectionUtilization) errors.push('connection utilization exceeds policy')
  if (activity.blockedQueries > thresholds.maximumBlockedQueries) errors.push('blocked query count exceeds policy')
  if (activity.longActiveQueries > 0) errors.push('active query duration exceeds failure threshold')
  if (activity.staleIdleTransactions > 0) errors.push('idle transaction duration exceeds failure threshold')
  if (activity.runtimeSuperuserConnections > thresholds.maximumRuntimeSuperuserConnections) errors.push('runtime superuser connection detected')
  if (roleBoundaryViolations > thresholds.maximumRoleBoundaryViolations) errors.push('database role boundary violation detected')
  if (apiProfiles.some(({ healthy }) => !healthy)) errors.push('one or more PostgREST schema profiles are unhealthy')
  if (releaseRecord.releaseId !== release.manifest.releaseId || releaseRecord.manifestSha256 !== release.manifestSha256) {
    errors.push('runtime database release identity mismatch')
  }
  if (Number(database.cacheHitRatio) < thresholds.cacheHitRatioWarningBelow) warnings.push('cache hit ratio is below the warning threshold')
  if (!pgStatStatementsInstalled) warnings.push('pg_stat_statements is not installed; slow-query evidence is limited to live pg_stat_activity')
  return {
    schemaVersion: 1,
    policyId: policy.policyId,
    checkedAt: new Date().toISOString(),
    status: errors.length ? 'failed' : 'healthy',
    release: releaseRecord,
    database,
    activity,
    slowQuery: { pgStatStatementsInstalled, active: slowActivity, queryTextCaptured: false },
    roleBoundaryViolations,
    postgrest: { image: release.manifest.images.postgrest, profiles: apiProfiles },
    errors,
    warnings
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const options = parseDatabaseRuntimeAuditArgs(process.argv.slice(2))
    const adapter = new DatabaseReleaseDockerAdapter({
      dbContainer: options.dbContainer, dbName: options.dbName, dbUser: options.dbUser
    })
    const report = await auditDatabaseRuntime({ options, adapter })
    const output = `${JSON.stringify(report, null, 2)}\n`
    if (options.output) writeFileSync(resolve(options.output), output, 'utf8')
    process.stdout.write(output)
    if (report.errors.length) process.exitCode = 1
  } catch (error) {
    console.error(`[error] ${error.message}`)
    process.exitCode = 1
  }
}
