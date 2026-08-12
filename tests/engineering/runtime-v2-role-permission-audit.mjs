// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawnSync } from 'node:child_process'

const dbContainer = process.env.EISCORE_DB_CONTAINER || 'eiscore-db'
const dbName = process.env.EISCORE_DB_NAME || 'eiscore'
const dbUser = process.env.EISCORE_DB_USER || 'postgres'
const args = new Set(process.argv.slice(2))
const strict = args.has('--strict') || process.env.EISCORE_ROLE_AUDIT_STRICT === '1'
const verbose = args.has('--verbose') || process.env.EISCORE_ROLE_AUDIT_VERBOSE === '1'

const SUPER_ROLES = new Set(['admin', 'super_admin'])
const PERMISSION_COUNT_MEDIUM = Number(process.env.EISCORE_ROLE_AUDIT_PERMISSION_MEDIUM || 80)
const PERMISSION_COUNT_HIGH = Number(process.env.EISCORE_ROLE_AUDIT_PERMISSION_HIGH || 150)
const TOP_BREAKDOWN_LIMIT = Number(process.env.EISCORE_ROLE_AUDIT_TOP_LIMIT || 8)

const sql = `
select coalesce(jsonb_agg(to_jsonb(row_data) order by role_code, permission_code), '[]'::jsonb)::text
from (
  select
    r.code as role_code,
    coalesce(r.name, r.code) as role_name,
    p.code as permission_code
  from public.roles r
  left join public.role_permissions rp on rp.role_id = r.id
  left join public.permissions p on p.id = rp.permission_id
  where p.code is not null
) row_data;
`

function runPsql(input) {
  return spawnSync('docker', [
    'exec',
    '-i',
    dbContainer,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    dbUser,
    '-d',
    dbName,
    '-At'
  ], {
    input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  })
}

function fail(message, result) {
  console.error(message)
  if (result?.stdout) process.stdout.write(result.stdout)
  if (result?.stderr) process.stderr.write(result.stderr)
  process.exit(1)
}

function uniqSorted(values) {
  return [...new Set(values.filter(Boolean))].sort()
}

function countMatching(permissions, matcher) {
  return permissions.filter((permission) => matcher(permission)).length
}

function sampleMatching(permissions, matcher, limit = 20) {
  return permissions.filter((permission) => matcher(permission)).sort().slice(0, limit)
}

function hasDestructive(permission) {
  return /(^|[.:_])(delete|remove|drop|destroy|purge)([.:_*]|$)/i.test(permission)
}

function hasAdminManage(permission) {
  return /(admin|manage|member_manage|config|permission|role)/i.test(permission)
}

function hasWildcard(permission) {
  return permission.includes('*')
}

function hasOntology(permission) {
  return /(^|[.:_])(ontology|kg|knowledge[-_:.]?graph|reason|reasoning|semantic)([.:_*]|$)/i.test(permission)
}

function hasWorkflow(permission) {
  return /(workflow|status_transition)/i.test(permission)
}

function permissionFamily(permission) {
  if (/ontology|knowledge[_:.]?graph|reason|semantic/i.test(permission)) return 'ontology_kg_reasoning'
  if (/status_transition/i.test(permission)) return 'status_transition'
  if (/workflow/i.test(permission)) return 'workflow'

  const parts = permission.split(/[.:]/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  if (parts.length === 1) return parts[0]
  return 'unknown'
}

function operationFamily(permission) {
  if (hasWildcard(permission)) return 'wildcard'
  if (hasDestructive(permission)) return 'destructive'
  if (hasAdminManage(permission)) return 'admin_manage'
  if (hasOntology(permission)) return 'ontology'
  if (hasWorkflow(permission)) return 'workflow'

  const parts = permission.split(/[.:_]/).filter(Boolean)
  return parts.at(-1) || 'unknown'
}

function topCounts(values, limit = TOP_BREAKDOWN_LIMIT) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

function buildReviewCandidates(role, permissions, metrics) {
  if (role.isSuper) return []

  const candidates = []
  const addCandidate = (kind, count, sample, recommendation) => {
    if (count <= 0) return
    candidates.push({ kind, count, sample, recommendation })
  }

  addCandidate(
    'wildcard_permissions',
    metrics.wildcardCount,
    sampleMatching(permissions, hasWildcard, 10),
    'Replace broad grants with explicit actions after validating the covered workflow paths.'
  )
  addCandidate(
    'destructive_permissions',
    metrics.destructiveCount,
    sampleMatching(permissions, hasDestructive, 10),
    'Confirm each delete/remove/drop grant is tied to an owned business operation before narrowing.'
  )
  addCandidate(
    'admin_manage_permissions',
    metrics.adminManageCount,
    sampleMatching(permissions, hasAdminManage, 10),
    'Separate role/config/member management capabilities from ordinary business roles where possible.'
  )
  addCandidate(
    'ontology_permissions',
    metrics.ontologyCount,
    sampleMatching(permissions, hasOntology, 10),
    'Keep ontology/KG/reasoning access through scoped agent RPCs instead of raw ontology grants.'
  )
  addCandidate(
    'workflow_permissions',
    metrics.workflowCount,
    sampleMatching(permissions, hasWorkflow, 10),
    'Prefer role-specific status-transition grants over global workflow transition grants.'
  )

  if (permissions.length >= PERMISSION_COUNT_HIGH) {
    candidates.push({
      kind: 'permission_volume',
      count: permissions.length,
      sample: topCounts(permissions.map(permissionFamily), 6).map((item) => `${item.name}:${item.count}`),
      recommendation: `Split or narrow broad role grants; current count is above high threshold ${PERMISSION_COUNT_HIGH}.`
    })
  }

  return candidates
}

const dockerCheck = spawnSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' })
if (dockerCheck.error) fail(`Docker is not available: ${dockerCheck.error.message}`)
if (dockerCheck.status !== 0) fail('Unable to list running Docker containers.', dockerCheck)
if (!dockerCheck.stdout.split(/\r?\n/).includes(dbContainer)) {
  fail(`Required database container is not running: ${dbContainer}`)
}

const result = runPsql(sql)
if (result.error) fail(`Role permission audit query failed to start: ${result.error.message}`)
if (result.status !== 0) fail('Role permission audit query failed.', result)

const rows = JSON.parse(result.stdout.trim() || '[]')
const byRole = new Map()
for (const row of rows) {
  const roleCode = String(row.role_code || '').trim()
  if (!roleCode) continue
  if (!byRole.has(roleCode)) {
    byRole.set(roleCode, {
      roleCode,
      roleName: row.role_name || roleCode,
      permissions: []
    })
  }
  byRole.get(roleCode).permissions.push(String(row.permission_code || '').trim())
}

const roles = [...byRole.values()].map((role) => {
  const permissions = uniqSorted(role.permissions)
  const isSuper = SUPER_ROLES.has(role.roleCode)
  const metrics = {
    destructiveCount: countMatching(permissions, hasDestructive),
    adminManageCount: countMatching(permissions, hasAdminManage),
    wildcardCount: countMatching(permissions, hasWildcard),
    ontologyCount: countMatching(permissions, hasOntology),
    workflowCount: countMatching(permissions, hasWorkflow)
  }
  const highSignals = [
    !isSuper && permissions.length >= PERMISSION_COUNT_HIGH,
    !isSuper && metrics.destructiveCount > 0,
    !isSuper && metrics.wildcardCount > 0,
    !isSuper && metrics.ontologyCount > 0
  ]
  const mediumSignals = [
    !isSuper && permissions.length >= PERMISSION_COUNT_MEDIUM,
    !isSuper && metrics.adminManageCount > 0,
    !isSuper && metrics.workflowCount > 0
  ]
  const riskLevel = highSignals.some(Boolean)
    ? 'high'
    : mediumSignals.some(Boolean)
      ? 'medium'
      : 'ok'
  const roleSummary = {
    roleCode: role.roleCode,
    roleName: role.roleName,
    isSuper,
    riskLevel,
    permissionCount: permissions.length,
    ...metrics,
    topPermissionFamilies: topCounts(permissions.map(permissionFamily)),
    topOperationFamilies: topCounts(permissions.map(operationFamily))
  }

  return {
    ...roleSummary,
    reviewCandidates: buildReviewCandidates(roleSummary, permissions, metrics),
    permissionSample: permissions.slice(0, 16),
    riskyPermissionSample: uniqSorted([
      ...sampleMatching(permissions, hasDestructive, 8),
      ...sampleMatching(permissions, hasAdminManage, 8),
      ...sampleMatching(permissions, hasWildcard, 8),
      ...sampleMatching(permissions, hasOntology, 8),
      ...sampleMatching(permissions, hasWorkflow, 8)
    ]).slice(0, 24)
  }
}).sort((a, b) => {
  const riskOrder = { high: 0, medium: 1, ok: 2 }
  return riskOrder[a.riskLevel] - riskOrder[b.riskLevel] ||
    b.permissionCount - a.permissionCount ||
    a.roleCode.localeCompare(b.roleCode)
})

const findings = roles
  .filter((role) => role.riskLevel !== 'ok')
  .map((role) => ({
    roleCode: role.roleCode,
    riskLevel: role.riskLevel,
    permissionCount: role.permissionCount,
    reasons: [
      role.permissionCount >= PERMISSION_COUNT_HIGH ? `permission_count>=${PERMISSION_COUNT_HIGH}` : '',
      role.permissionCount >= PERMISSION_COUNT_MEDIUM && role.permissionCount < PERMISSION_COUNT_HIGH ? `permission_count>=${PERMISSION_COUNT_MEDIUM}` : '',
      role.destructiveCount > 0 ? 'destructive_permissions' : '',
      role.adminManageCount > 0 ? 'admin_manage_permissions' : '',
      role.wildcardCount > 0 ? 'wildcard_permissions' : '',
      role.ontologyCount > 0 ? 'ontology_permissions' : '',
      role.workflowCount > 0 ? 'workflow_permissions' : ''
    ].filter(Boolean),
    riskyPermissionSample: role.riskyPermissionSample
  }))

const roleSummaries = roles.map((role) => ({
  roleCode: role.roleCode,
  roleName: role.roleName,
  isSuper: role.isSuper,
  riskLevel: role.riskLevel,
  permissionCount: role.permissionCount,
  destructiveCount: role.destructiveCount,
  adminManageCount: role.adminManageCount,
  wildcardCount: role.wildcardCount,
  ontologyCount: role.ontologyCount,
  workflowCount: role.workflowCount,
  topPermissionFamilies: role.topPermissionFamilies,
  topOperationFamilies: role.topOperationFamilies,
  reviewCandidateKinds: role.reviewCandidates.map((candidate) => candidate.kind)
}))

const reviewBacklog = roles
  .filter((role) => !role.isSuper && role.reviewCandidates.length > 0)
  .map((role) => ({
    roleCode: role.roleCode,
    riskLevel: role.riskLevel,
    permissionCount: role.permissionCount,
    candidates: role.reviewCandidates.slice(0, 5)
  }))

const summary = {
  generatedAt: new Date().toISOString(),
  source: 'runtime_v2_role_permission_audit',
  database: `${dbContainer}/${dbName}`,
  thresholds: {
    permissionCountMedium: PERMISSION_COUNT_MEDIUM,
    permissionCountHigh: PERMISSION_COUNT_HIGH,
    strict,
    verbose
  },
  mode: verbose ? 'verbose' : 'summary',
  roleCount: roles.length,
  permissionGrantCount: rows.length,
  findingCount: findings.length,
  highFindingCount: findings.filter((finding) => finding.riskLevel === 'high').length,
  mediumFindingCount: findings.filter((finding) => finding.riskLevel === 'medium').length,
  reportOnly: true,
  safetyNote: 'This audit only reads role/permission metadata and does not modify business permissions.',
  findings,
  roleSummaries,
  reviewBacklog
}

if (verbose) {
  summary.roles = roles
}

console.log(JSON.stringify(summary, null, 2))

if (strict && findings.length > 0) {
  console.error(`Runtime V2 role permission audit found ${findings.length} risk finding(s).`)
  process.exit(1)
}

console.log('PASS: Runtime V2 role permission audit snapshot')