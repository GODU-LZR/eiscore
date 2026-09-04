// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EnterpriseHandoffError,
  validateEnterpriseHandoff
} from './validate-enterprise-handoff.mjs'

const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/
const SHA256 = /^[0-9a-f]{64}$/

const issue = (code, path = '.', detail = '') => ({ code, path, detail })
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

export const computeEnterpriseConfirmationRequestSha256 = (request) => {
  const input = structuredClone(request)
  delete input.requestSha256
  return sha256(Buffer.from(JSON.stringify(stableValue(input)), 'utf8'))
}

const safeRepositoryPath = (value) => typeof value === 'string'
  && SAFE_PATH.test(value)
  && !value.includes('//')
  && value.split('/').every((segment) => segment && segment !== '.' && segment !== '..')

const resolveInside = (root, path) => {
  if (!safeRepositoryPath(path)) return null
  const absolute = resolve(root, ...path.split('/'))
  const fromRoot = relative(root, absolute)
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) return null
  return absolute
}

const fieldDecisionOptions = (readiness, mapping) => {
  if (mapping.fieldId === 'governance.productionApproval') return ['approve', 'reject']
  if (['implementation', 'product-engineering'].includes(mapping.confirmationOwner)) {
    return ['reject', 'review-and-confirm']
  }
  if (readiness.status === 'missing') {
    return mapping.requirement === 'conditional'
      ? ['confirm-not-applicable', 'provide-and-confirm', 'reject']
      : ['provide-and-confirm', 'reject']
  }
  return mapping.requirement === 'conditional'
    ? ['confirm', 'confirm-not-applicable', 'reject']
    : ['confirm', 'reject']
}

const assetDecisionOptions = ({ status }) => ({
  absent: ['confirm-not-applicable', 'provide-inventory', 'reject'],
  candidate: ['authorize', 'reject', 'replace'],
  incomplete: ['complete-inventory', 'reject', 'replace']
}[status] || [])

const relativeSnapshotPath = (repoRoot, snapshotPath) => relative(repoRoot, resolve(snapshotPath)).split(sep).join('/')

export const buildEnterpriseConfirmationRequest = ({
  snapshotPath = 'enterprise-handoffs/first-wave-readiness.json',
  snapshotReference,
  repoRoot = resolve(import.meta.dirname, '..'),
  schemaReference = '../config/enterprise-package-handoff.schema.json'
} = {}) => {
  const root = resolve(repoRoot)
  const absoluteSnapshot = resolve(snapshotPath)
  const validation = validateEnterpriseHandoff({ snapshotPath: absoluteSnapshot, repoRoot: root })
  if (!validation.ok) throw new EnterpriseHandoffError('Cannot build confirmation request from invalid readiness', validation.issues)

  const { snapshot, catalog } = validation
  const mappingById = new Map(catalog.fields.map((field) => [field.fieldId, field]))
  const snapshotRef = snapshotReference || relativeSnapshotPath(root, absoluteSnapshot)
  if (!safeRepositoryPath(snapshotRef)) {
    throw new EnterpriseHandoffError('Cannot build confirmation request with unsafe snapshot reference', [issue('unsafe-snapshot-path', '$.snapshot.path')])
  }

  const enterprises = snapshot.enterprises.map((enterprise) => ({
    trackingId: enterprise.trackingId,
    displayName: enterprise.displayName,
    packageStatus: enterprise.packageStatus,
    fieldRequests: enterprise.fieldReadiness
      .filter(({ status }) => ['missing', 'candidate'].includes(status))
      .map((readiness) => {
        const mapping = mappingById.get(readiness.fieldId)
        return {
          fieldId: readiness.fieldId,
          currentStatus: readiness.status,
          confirmationOwner: mapping.confirmationOwner,
          scope: mapping.scope,
          requirement: mapping.requirement,
          decisionOptions: fieldDecisionOptions(readiness, mapping),
          sourceIds: readiness.sourceIds,
          blockers: readiness.blockers,
          description: mapping.description
        }
      }),
    assetRequests: enterprise.assetSets
      .filter(({ status }) => ['absent', 'candidate', 'incomplete'].includes(status))
      .map((assetSet) => ({
        assetSetId: assetSet.assetSetId,
        currentStatus: assetSet.status,
        declaredFileCount: assetSet.declaredFileCount,
        presentFileCount: assetSet.presentFileCount,
        authorizationStatus: assetSet.authorizationStatus,
        commercialUse: assetSet.commercialUse,
        sourceIds: assetSet.sourceIds,
        decisionOptions: assetDecisionOptions(assetSet),
        notes: assetSet.notes
      })),
    approvalRequests: enterprise.approvals,
    blockingSummary: enterprise.blockers
  }))

  const request = {
    $schema: schemaReference,
    documentType: 'enterprise-package-confirmation-request',
    schemaVersion: 1,
    requestId: `${snapshot.snapshotId}-confirmation-request`,
    createdAt: snapshot.snapshotAt,
    snapshot: {
      path: snapshotRef,
      sha256: sha256(readFileSync(absoluteSnapshot))
    },
    mapping: { ...snapshot.mapping },
    responsePolicy: {
      responseMustReferenceRequest: true,
      secretsForbidden: true,
      candidateSourcesCannotConfirm: true,
      productionApprovalNotImplied: true
    },
    enterprises
  }
  request.requestSha256 = computeEnterpriseConfirmationRequestSha256(request)
  return request
}

export const validateEnterpriseConfirmationRequest = ({
  requestPath = 'enterprise-handoffs/first-wave-confirmation-request.json',
  repoRoot = resolve(import.meta.dirname, '..')
} = {}) => {
  const root = resolve(repoRoot)
  const absoluteRequest = resolve(requestPath)
  const issues = []
  let request
  try {
    request = JSON.parse(readFileSync(absoluteRequest, 'utf8'))
  } catch {
    return { ok: false, issues: [issue('invalid-json', requestPath)], request: null, expected: null }
  }

  if (request.documentType !== 'enterprise-package-confirmation-request') issues.push(issue('invalid-document-type', '$.documentType'))
  if (request.schemaVersion !== 1) issues.push(issue('unsupported-version', '$.schemaVersion'))
  if (typeof request.requestSha256 !== 'string' || !SHA256.test(request.requestSha256)) issues.push(issue('invalid-request-sha256', '$.requestSha256'))
  else if (request.requestSha256 !== computeEnterpriseConfirmationRequestSha256(request)) issues.push(issue('request-hash-drift', '$.requestSha256'))

  const snapshotPath = resolveInside(root, request.snapshot?.path)
  let expected = null
  if (!snapshotPath) issues.push(issue('unsafe-snapshot-path', '$.snapshot.path'))
  else if (!existsSync(snapshotPath)) issues.push(issue('snapshot-file-missing', '$.snapshot.path'))
  else {
    const actualSnapshotSha = sha256(readFileSync(snapshotPath))
    if (request.snapshot?.sha256 !== actualSnapshotSha) issues.push(issue('snapshot-hash-drift', '$.snapshot.sha256'))
    try {
      expected = buildEnterpriseConfirmationRequest({
        snapshotPath,
        snapshotReference: request.snapshot.path,
        repoRoot: root,
        schemaReference: request.$schema
      })
      if (JSON.stringify(stableValue(request)) !== JSON.stringify(stableValue(expected))) {
        issues.push(issue('confirmation-request-drift', '$'))
      }
    } catch (error) {
      if (error instanceof EnterpriseHandoffError) issues.push(...error.issues)
      else issues.push(issue('confirmation-request-build-failed', '$'))
    }
  }
  return { ok: issues.length === 0, issues, request, expected }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [operation = 'validate', first, second] = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
  try {
    if (operation === 'generate') {
      const snapshot = first || 'enterprise-handoffs/first-wave-readiness.json'
      const output = second
      const request = buildEnterpriseConfirmationRequest({
        snapshotPath: resolve(process.cwd(), snapshot),
        snapshotReference: snapshot.split('\\').join('/'),
        repoRoot: process.cwd()
      })
      const content = canonicalJson(request)
      if (output) {
        writeFileSync(resolve(process.cwd(), output), content, 'utf8')
        console.log(`[ok] generated ${output}: ${request.requestSha256}`)
      } else process.stdout.write(content)
    } else if (operation === 'validate') {
      const target = first || 'enterprise-handoffs/first-wave-confirmation-request.json'
      const result = validateEnterpriseConfirmationRequest({ requestPath: resolve(process.cwd(), target), repoRoot: process.cwd() })
      if (!result.ok) throw new EnterpriseHandoffError('Enterprise confirmation request validation failed', result.issues)
      const fieldCount = result.request.enterprises.reduce((sum, enterprise) => sum + enterprise.fieldRequests.length, 0)
      const assetCount = result.request.enterprises.reduce((sum, enterprise) => sum + enterprise.assetRequests.length, 0)
      console.log(`[ok] validated ${target}: ${fieldCount} field confirmations and ${assetCount} asset decisions across ${result.request.enterprises.length} enterprises (${result.request.requestSha256})`)
    } else throw new EnterpriseHandoffError('Unknown confirmation request operation', [issue('unknown-operation', operation)])
  } catch (error) {
    const issues = error instanceof EnterpriseHandoffError ? error.issues : [issue('unexpected-error')]
    console.error(`[fail] enterprise confirmation request ${operation} failed (${issues.length} issue(s))`)
    for (const entry of issues) console.error(`- ${entry.path} (${entry.code})`)
    process.exitCode = 1
  }
}
