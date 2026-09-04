// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIELD_CATALOG_TYPE = 'enterprise-package-handoff-field-catalog'
const READINESS_SNAPSHOT_TYPE = 'enterprise-package-readiness-snapshot'
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/
const IDENTIFIER = /^[a-z0-9][A-Za-z0-9.-]*$/
const OPERATOR_PATH = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)*$/
const SHA256 = /^[0-9a-f]{64}$/
const SECRET_KEY = /(?:^|_)(?:password|passwd|pwd|token|secret|api_key|private_key|client_secret|credential|access_key|connection_string|database_url)(?:$|_)/i
const CREDENTIAL_URL = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i
const LOCAL_PATH = /^(?:file:\/\/|[A-Za-z]:[\\/]|\\\\)/i
const DATA_URL = /^data:[^,]+,/i
const BASE64_VALUE = /^[A-Za-z0-9+/]+={0,2}$/

const TARGET_FILES = new Set([
  'runtime/eiscore-enterprise.json',
  'data/company-site.json',
  'manifest.json',
  'evidence/handoff.json'
])
const SCOPES = new Set(['internal', 'public', 'delivery-governance'])
const REQUIREMENTS = new Set(['required', 'conditional'])
const PRODUCTION_RULES = new Set(['confirmed', 'confirmed-or-not-applicable', 'authorized', 'explicit-approval'])
const CONFIRMATION_OWNERS = new Set(['enterprise', 'deployment', 'implementation', 'product-engineering'])
const SOURCE_TYPES = new Set([
  'controlled-external-workbook',
  'repository-seed',
  'repository-asset-register',
  'repository-research',
  'repository-audit',
  'enterprise-confirmation',
  'deployment-confirmation',
  'implementation-confirmation',
  'product-engineering-confirmation',
  'asset-authorization'
])
const SOURCE_AUTHORITIES = new Set([
  'enterprise-provided',
  'enterprise-confirmed',
  'deployment-confirmed',
  'implementation-confirmed',
  'product-engineering-confirmed',
  'repository-legacy',
  'implementation-audit',
  'public-research',
  'supplier-candidate',
  'rights-holder'
])
const FACT_USES = new Set(['candidate-only', 'confirmation', 'governance-only'])
const SOURCE_STATUSES = new Set(['available', 'partial', 'superseded'])
const FIELD_STATUSES = new Set(['missing', 'candidate', 'confirmed', 'not-applicable'])
const COLLECTION_STATUSES = new Set(['not-started', 'collecting', 'candidate-inputs', 'ready'])
const PACKAGE_STATUSES = new Set(['not-created', 'draft', 'candidate', 'approved'])
const ASSET_STATUSES = new Set(['absent', 'candidate', 'incomplete', 'authorized', 'not-applicable'])
const AUTHORIZATION_STATUSES = new Set(['not-requested', 'pending', 'confirmed', 'not-required'])
const APPROVAL_STATUSES = new Set(['not-requested', 'pending', 'approved', 'rejected'])
const CONFIRMATION_SOURCE_TYPES = new Set([
  'enterprise-confirmation',
  'deployment-confirmation',
  'implementation-confirmation',
  'product-engineering-confirmation',
  'asset-authorization'
])
const CONFIRMATION_SOURCE_AUTHORITIES = new Map([
  ['enterprise-confirmation', 'enterprise-confirmed'],
  ['deployment-confirmation', 'deployment-confirmed'],
  ['implementation-confirmation', 'implementation-confirmed'],
  ['product-engineering-confirmation', 'product-engineering-confirmed'],
  ['asset-authorization', 'rights-holder']
])

const issue = (code, path = '.', detail = '') => ({ code, path, detail })
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const normalizedKey = (key) => key
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[-\s]+/g, '_')
  .toLowerCase()
const sha256 = (content) => createHash('sha256').update(content).digest('hex')

export class EnterpriseHandoffError extends Error {
  constructor(message, issues = []) {
    super(message)
    this.name = 'EnterpriseHandoffError'
    this.issues = issues
  }
}

export const formatEnterpriseHandoffIssue = ({ code, path }) => `${path} (${code})`

const checkObject = (issues, value, path, { allowed = [], required = [] } = {}) => {
  if (!isObject(value)) {
    issues.push(issue('object-required', path))
    return false
  }
  const allowedSet = new Set(allowed)
  Object.keys(value).filter((key) => !allowedSet.has(key)).forEach((key) => {
    issues.push(issue('unknown-key', `${path}.${key}`))
  })
  required.filter((key) => !(key in value)).forEach((key) => {
    issues.push(issue('required-key-missing', `${path}.${key}`))
  })
  return true
}

const checkText = (issues, value, path, { max = 1000, pattern, allowEmpty = false } = {}) => {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    issues.push(issue('text-required', path))
    return false
  }
  if (value.length > max) issues.push(issue('text-too-long', path))
  if (pattern && !pattern.test(value)) issues.push(issue('invalid-format', path))
  return true
}

const checkEnum = (issues, value, allowed, path) => {
  if (!allowed.has(value)) issues.push(issue('invalid-enum', path))
}

const checkDateTime = (issues, value, path) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) issues.push(issue('invalid-date-time', path))
}

const checkStringList = (issues, value, path, { identifier = false } = {}) => {
  if (!Array.isArray(value)) {
    issues.push(issue('array-required', path))
    return false
  }
  value.forEach((item, index) => checkText(issues, item, `${path}[${index}]`, {
    max: 300,
    pattern: identifier ? IDENTIFIER : undefined
  }))
  if (new Set(value).size !== value.length) issues.push(issue('duplicate-list-item', path))
  if (JSON.stringify(value) !== JSON.stringify([...value].sort())) issues.push(issue('list-not-sorted', path))
  return true
}

const checkSortedObjects = (issues, value, path, key) => {
  if (!Array.isArray(value)) {
    issues.push(issue('array-required', path))
    return false
  }
  const values = value.map((entry) => entry?.[key])
  if (new Set(values).size !== values.length) issues.push(issue('duplicate-id', path))
  if (JSON.stringify(values) !== JSON.stringify([...values].sort())) issues.push(issue('list-not-sorted', path))
  return true
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

const scanUnsafeValue = (value, path, issues) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafeValue(item, `${path}[${index}]`, issues))
    return
  }
  if (!isObject(value)) {
    if (typeof value === 'string') {
      if (CREDENTIAL_URL.test(value)) issues.push(issue('credential-url-forbidden', path))
      if (LOCAL_PATH.test(value)) issues.push(issue('local-path-forbidden', path))
      if (DATA_URL.test(value)) issues.push(issue('data-url-forbidden', path))
      if (value.length >= 512 && BASE64_VALUE.test(value)) issues.push(issue('embedded-base64-forbidden', path))
    }
    return
  }
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`
    if (SECRET_KEY.test(normalizedKey(key))) issues.push(issue('secret-key-forbidden', itemPath))
    scanUnsafeValue(item, itemPath, issues)
  }
}

const readJson = (absolute, path, issues) => {
  try {
    return JSON.parse(readFileSync(absolute, 'utf8'))
  } catch {
    issues.push(issue('invalid-json', path))
    return null
  }
}

const validateFieldCatalog = (catalog) => {
  const issues = []
  if (!checkObject(issues, catalog, '$', {
    allowed: ['$schema', 'documentType', 'schemaVersion', 'mappingVersion', 'fields'],
    required: ['$schema', 'documentType', 'schemaVersion', 'mappingVersion', 'fields']
  })) return issues
  if (catalog.documentType !== FIELD_CATALOG_TYPE) issues.push(issue('invalid-document-type', '$.documentType'))
  if (catalog.schemaVersion !== 1) issues.push(issue('unsupported-version', '$.schemaVersion'))
  if (catalog.mappingVersion !== 1) issues.push(issue('unsupported-mapping-version', '$.mappingVersion'))
  checkSortedObjects(issues, catalog.fields, '$.fields', 'fieldId')

  const targetClaims = new Set()
  for (const [index, field] of (Array.isArray(catalog.fields) ? catalog.fields : []).entries()) {
    const path = `$.fields[${index}]`
    if (!checkObject(issues, field, path, {
      allowed: ['fieldId', 'operatorPath', 'targetFile', 'targetPaths', 'scope', 'requirement', 'productionRule', 'confirmationOwner', 'description'],
      required: ['fieldId', 'operatorPath', 'targetFile', 'targetPaths', 'scope', 'requirement', 'productionRule', 'confirmationOwner', 'description']
    })) continue
    checkText(issues, field.fieldId, `${path}.fieldId`, { max: 120, pattern: IDENTIFIER })
    checkText(issues, field.operatorPath, `${path}.operatorPath`, { max: 200, pattern: OPERATOR_PATH })
    checkEnum(issues, field.targetFile, TARGET_FILES, `${path}.targetFile`)
    checkStringList(issues, field.targetPaths, `${path}.targetPaths`)
    for (const [targetIndex, targetPath] of (Array.isArray(field.targetPaths) ? field.targetPaths : []).entries()) {
      if (!targetPath.startsWith('$.')) issues.push(issue('invalid-target-path', `${path}.targetPaths[${targetIndex}]`))
      const claim = `${field.targetFile}:${targetPath}`
      if (targetClaims.has(claim)) issues.push(issue('duplicate-target-path', `${path}.targetPaths[${targetIndex}]`))
      targetClaims.add(claim)
    }
    checkEnum(issues, field.scope, SCOPES, `${path}.scope`)
    checkEnum(issues, field.requirement, REQUIREMENTS, `${path}.requirement`)
    checkEnum(issues, field.productionRule, PRODUCTION_RULES, `${path}.productionRule`)
    checkEnum(issues, field.confirmationOwner, CONFIRMATION_OWNERS, `${path}.confirmationOwner`)
    checkText(issues, field.description, `${path}.description`, { max: 500 })
  }
  scanUnsafeValue(catalog, '$', issues)
  return issues
}

const validateSource = (source, path, issues, repoRoot) => {
  if (!checkObject(issues, source, path, {
    allowed: ['sourceId', 'type', 'authority', 'repositoryPath', 'externalReference', 'assessedAt', 'factUse', 'containsSensitiveData', 'status', 'notes'],
    required: ['sourceId', 'type', 'authority', 'assessedAt', 'factUse', 'containsSensitiveData', 'status', 'notes']
  })) return
  checkText(issues, source.sourceId, `${path}.sourceId`, { max: 120, pattern: IDENTIFIER })
  checkEnum(issues, source.type, SOURCE_TYPES, `${path}.type`)
  checkEnum(issues, source.authority, SOURCE_AUTHORITIES, `${path}.authority`)
  checkDateTime(issues, source.assessedAt, `${path}.assessedAt`)
  checkEnum(issues, source.factUse, FACT_USES, `${path}.factUse`)
  if (typeof source.containsSensitiveData !== 'boolean') issues.push(issue('boolean-required', `${path}.containsSensitiveData`))
  checkEnum(issues, source.status, SOURCE_STATUSES, `${path}.status`)
  checkText(issues, source.notes, `${path}.notes`, { max: 1000 })

  if (source.repositoryPath !== undefined) {
    checkText(issues, source.repositoryPath, `${path}.repositoryPath`, { max: 300 })
    const absolute = resolveInside(repoRoot, source.repositoryPath)
    if (!absolute) issues.push(issue('unsafe-repository-path', `${path}.repositoryPath`))
    else if (!existsSync(absolute)) issues.push(issue('repository-source-missing', `${path}.repositoryPath`))
    if (source.containsSensitiveData) issues.push(issue('sensitive-source-cannot-be-repository-bound', `${path}.repositoryPath`))
  } else if (source.type !== 'controlled-external-workbook' && !CONFIRMATION_SOURCE_TYPES.has(source.type)) {
    issues.push(issue('repository-path-required', `${path}.repositoryPath`))
  }
  if (source.externalReference !== undefined) {
    checkText(issues, source.externalReference, `${path}.externalReference`, { max: 120, pattern: IDENTIFIER })
    if (!CONFIRMATION_SOURCE_TYPES.has(source.type)) issues.push(issue('external-reference-confirmation-only', `${path}.externalReference`))
  } else if (CONFIRMATION_SOURCE_TYPES.has(source.type)) {
    issues.push(issue('confirmation-external-reference-required', `${path}.externalReference`))
  }
  if (source.factUse === 'confirmation' && !CONFIRMATION_SOURCE_TYPES.has(source.type)) {
    issues.push(issue('invalid-confirmation-source', `${path}.factUse`))
  }
  if (CONFIRMATION_SOURCE_TYPES.has(source.type) && source.factUse !== 'confirmation') {
    issues.push(issue('confirmation-source-use-required', `${path}.factUse`))
  }
  if (CONFIRMATION_SOURCE_TYPES.has(source.type) && source.authority !== CONFIRMATION_SOURCE_AUTHORITIES.get(source.type)) {
    issues.push(issue('confirmation-source-authority-mismatch', `${path}.authority`))
  }
  if (source.containsSensitiveData && source.factUse !== 'candidate-only') {
    issues.push(issue('sensitive-source-candidate-only', `${path}.factUse`))
  }
}

const countInventoryFiles = (directory, issues, path) => {
  let count = 0
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = resolve(directory, entry.name)
    if (lstatSync(absolute).isSymbolicLink()) {
      issues.push(issue('inventory-symlink-forbidden', path))
      continue
    }
    if (entry.isDirectory()) count += countInventoryFiles(absolute, issues, path)
    else count += 1
  }
  return count
}

const validateAssetSet = (assetSet, path, issues, { repoRoot, sources }) => {
  if (!checkObject(issues, assetSet, path, {
    allowed: ['assetSetId', 'status', 'sourceIds', 'inventoryPath', 'declaredFileCount', 'presentFileCount', 'authorizationStatus', 'commercialUse', 'notes'],
    required: ['assetSetId', 'status', 'sourceIds', 'declaredFileCount', 'presentFileCount', 'authorizationStatus', 'commercialUse', 'notes']
  })) return
  checkText(issues, assetSet.assetSetId, `${path}.assetSetId`, { max: 120, pattern: IDENTIFIER })
  checkEnum(issues, assetSet.status, ASSET_STATUSES, `${path}.status`)
  checkStringList(issues, assetSet.sourceIds, `${path}.sourceIds`, { identifier: true })
  for (const sourceId of (Array.isArray(assetSet.sourceIds) ? assetSet.sourceIds : [])) {
    if (!sources.has(sourceId)) issues.push(issue('unknown-source', `${path}.sourceIds`))
  }
  for (const key of ['declaredFileCount', 'presentFileCount']) {
    if (!Number.isInteger(assetSet[key]) || assetSet[key] < 0) issues.push(issue('non-negative-integer-required', `${path}.${key}`))
  }
  checkEnum(issues, assetSet.authorizationStatus, AUTHORIZATION_STATUSES, `${path}.authorizationStatus`)
  if (typeof assetSet.commercialUse !== 'boolean') issues.push(issue('boolean-required', `${path}.commercialUse`))
  checkText(issues, assetSet.notes, `${path}.notes`, { max: 1000 })

  if (assetSet.inventoryPath !== undefined) {
    const absolute = resolveInside(repoRoot, assetSet.inventoryPath)
    if (!absolute) issues.push(issue('unsafe-repository-path', `${path}.inventoryPath`))
    else if (!existsSync(absolute) || !lstatSync(absolute).isDirectory()) issues.push(issue('inventory-directory-missing', `${path}.inventoryPath`))
    else {
      const actual = countInventoryFiles(absolute, issues, `${path}.inventoryPath`)
      if (actual !== assetSet.presentFileCount) issues.push(issue('inventory-file-count-drift', `${path}.presentFileCount`, `${actual}`))
    }
  }

  if (assetSet.status === 'absent') {
    if (assetSet.declaredFileCount !== 0 || assetSet.presentFileCount !== 0) issues.push(issue('absent-assets-must-be-empty', path))
    if (assetSet.inventoryPath !== undefined) issues.push(issue('absent-assets-cannot-have-inventory', `${path}.inventoryPath`))
    if (assetSet.sourceIds?.length) issues.push(issue('absent-assets-cannot-have-sources', `${path}.sourceIds`))
    if (assetSet.authorizationStatus !== 'not-requested') issues.push(issue('absent-assets-authorization-not-requested', `${path}.authorizationStatus`))
  }
  if (assetSet.status === 'candidate') {
    if (!(assetSet.declaredFileCount > 0 && assetSet.declaredFileCount === assetSet.presentFileCount)) issues.push(issue('candidate-asset-count-invalid', path))
    if (assetSet.authorizationStatus !== 'pending' || assetSet.commercialUse !== false) issues.push(issue('candidate-assets-not-authorized', path))
  }
  if (assetSet.status === 'incomplete') {
    if (!(assetSet.declaredFileCount > assetSet.presentFileCount)) issues.push(issue('incomplete-asset-count-invalid', path))
    if (assetSet.authorizationStatus === 'confirmed' || assetSet.commercialUse !== false) issues.push(issue('incomplete-assets-not-authorized', path))
  }
  if (assetSet.status === 'authorized') {
    if (!(assetSet.declaredFileCount > 0 && assetSet.declaredFileCount === assetSet.presentFileCount)) issues.push(issue('authorized-asset-count-invalid', path))
    if (assetSet.authorizationStatus !== 'confirmed' || assetSet.commercialUse !== true) issues.push(issue('authorized-assets-require-commercial-rights', path))
    if (!(assetSet.sourceIds || []).some((sourceId) => sources.get(sourceId)?.type === 'asset-authorization')) {
      issues.push(issue('asset-authorization-source-required', `${path}.sourceIds`))
    }
  }
  if (assetSet.status === 'not-applicable') {
    if (assetSet.declaredFileCount !== 0 || assetSet.presentFileCount !== 0) issues.push(issue('not-applicable-assets-must-be-empty', path))
    if (assetSet.authorizationStatus !== 'not-required' || assetSet.commercialUse !== false) issues.push(issue('not-applicable-assets-invalid', path))
  }
}

const validateEnterprise = (enterprise, path, issues, { fields, sources, repoRoot }) => {
  if (!checkObject(issues, enterprise, path, {
    allowed: ['trackingId', 'displayName', 'collectionStatus', 'packageStatus', 'productionEligible', 'fieldReadiness', 'assetSets', 'approvals', 'blockers'],
    required: ['trackingId', 'displayName', 'collectionStatus', 'packageStatus', 'productionEligible', 'fieldReadiness', 'assetSets', 'approvals', 'blockers']
  })) return
  checkText(issues, enterprise.trackingId, `${path}.trackingId`, { max: 120, pattern: IDENTIFIER })
  checkText(issues, enterprise.displayName, `${path}.displayName`, { max: 120 })
  checkEnum(issues, enterprise.collectionStatus, COLLECTION_STATUSES, `${path}.collectionStatus`)
  checkEnum(issues, enterprise.packageStatus, PACKAGE_STATUSES, `${path}.packageStatus`)
  if (typeof enterprise.productionEligible !== 'boolean') issues.push(issue('boolean-required', `${path}.productionEligible`))
  checkStringList(issues, enterprise.blockers, `${path}.blockers`)

  checkSortedObjects(issues, enterprise.fieldReadiness, `${path}.fieldReadiness`, 'fieldId')
  const expectedFieldIds = [...fields.keys()]
  const actualFieldIds = Array.isArray(enterprise.fieldReadiness) ? enterprise.fieldReadiness.map(({ fieldId }) => fieldId) : []
  if (JSON.stringify(expectedFieldIds) !== JSON.stringify(actualFieldIds)) {
    issues.push(issue('field-coverage-mismatch', `${path}.fieldReadiness`))
  }
  for (const [index, readiness] of (Array.isArray(enterprise.fieldReadiness) ? enterprise.fieldReadiness : []).entries()) {
    const readinessPath = `${path}.fieldReadiness[${index}]`
    if (!checkObject(issues, readiness, readinessPath, {
      allowed: ['fieldId', 'status', 'sourceIds', 'blockers', 'notes'],
      required: ['fieldId', 'status', 'sourceIds', 'blockers']
    })) continue
    checkText(issues, readiness.fieldId, `${readinessPath}.fieldId`, { max: 120, pattern: IDENTIFIER })
    checkEnum(issues, readiness.status, FIELD_STATUSES, `${readinessPath}.status`)
    checkStringList(issues, readiness.sourceIds, `${readinessPath}.sourceIds`, { identifier: true })
    checkStringList(issues, readiness.blockers, `${readinessPath}.blockers`)
    if (readiness.notes !== undefined) checkText(issues, readiness.notes, `${readinessPath}.notes`, { max: 500 })
    if (!fields.has(readiness.fieldId)) issues.push(issue('unknown-field', `${readinessPath}.fieldId`))

    const referencedSources = (Array.isArray(readiness.sourceIds) ? readiness.sourceIds : []).map((sourceId) => {
      if (!sources.has(sourceId)) issues.push(issue('unknown-source', `${readinessPath}.sourceIds`))
      return sources.get(sourceId)
    }).filter(Boolean)
    if (readiness.status === 'missing' && readiness.sourceIds?.length) issues.push(issue('missing-field-cannot-have-sources', `${readinessPath}.sourceIds`))
    if (readiness.status === 'candidate' && !readiness.sourceIds?.length) issues.push(issue('candidate-source-required', `${readinessPath}.sourceIds`))
    if (['missing', 'candidate'].includes(readiness.status) && !readiness.blockers?.length) issues.push(issue('unready-field-blocker-required', `${readinessPath}.blockers`))
    if (['confirmed', 'not-applicable'].includes(readiness.status)) {
      if (readiness.blockers?.length) issues.push(issue('ready-field-cannot-have-blockers', `${readinessPath}.blockers`))
      if (!referencedSources.some((source) => source.factUse === 'confirmation')) {
        issues.push(issue('confirmation-source-required', `${readinessPath}.sourceIds`))
      }
    }
    if (readiness.status === 'candidate' && referencedSources.every((source) => source.factUse === 'governance-only')) {
      issues.push(issue('candidate-fact-source-required', `${readinessPath}.sourceIds`))
    }
  }

  checkSortedObjects(issues, enterprise.assetSets, `${path}.assetSets`, 'assetSetId')
  for (const [index, assetSet] of (Array.isArray(enterprise.assetSets) ? enterprise.assetSets : []).entries()) {
    validateAssetSet(assetSet, `${path}.assetSets[${index}]`, issues, { repoRoot, sources })
  }

  if (checkObject(issues, enterprise.approvals, `${path}.approvals`, {
    allowed: ['facts', 'assets', 'package'],
    required: ['facts', 'assets', 'package']
  })) {
    for (const key of ['facts', 'assets', 'package']) checkEnum(issues, enterprise.approvals[key], APPROVAL_STATUSES, `${path}.approvals.${key}`)
  }
  if (enterprise.packageStatus === 'not-created' && enterprise.approvals?.package === 'approved') {
    issues.push(issue('uncreated-package-cannot-be-approved', `${path}.approvals.package`))
  }
  if (enterprise.packageStatus === 'approved' && enterprise.productionEligible !== true) {
    issues.push(issue('approved-package-must-be-production-eligible', `${path}.productionEligible`))
  }

  if (enterprise.productionEligible === true) {
    if (enterprise.collectionStatus !== 'ready') issues.push(issue('production-collection-not-ready', `${path}.collectionStatus`))
    if (enterprise.packageStatus !== 'approved') issues.push(issue('production-package-not-approved', `${path}.packageStatus`))
    if (enterprise.blockers?.length) issues.push(issue('production-blockers-remain', `${path}.blockers`))
    for (const key of ['facts', 'assets', 'package']) {
      if (enterprise.approvals?.[key] !== 'approved') issues.push(issue('production-approval-missing', `${path}.approvals.${key}`))
    }
    for (const [index, readiness] of enterprise.fieldReadiness.entries()) {
      const mapping = fields.get(readiness.fieldId)
      const allowed = mapping?.productionRule === 'confirmed-or-not-applicable'
        ? ['confirmed', 'not-applicable']
        : ['confirmed']
      if (!allowed.includes(readiness.status)) issues.push(issue('production-field-not-ready', `${path}.fieldReadiness[${index}].status`))
    }
    for (const [index, assetSet] of enterprise.assetSets.entries()) {
      if (!['authorized', 'not-applicable'].includes(assetSet.status)) issues.push(issue('production-assets-not-ready', `${path}.assetSets[${index}].status`))
    }
  }
}

export const validateEnterpriseHandoff = ({
  snapshotPath = 'enterprise-handoffs/first-wave-readiness.json',
  snapshotInput,
  repoRoot = resolve(import.meta.dirname, '..')
} = {}) => {
  const root = resolve(repoRoot)
  const issues = []
  const absoluteSnapshot = resolve(snapshotPath)
  const snapshot = snapshotInput === undefined
    ? readJson(absoluteSnapshot, snapshotPath, issues)
    : structuredClone(snapshotInput)
  if (!snapshot) return { ok: false, issues, snapshot: null, catalog: null }

  if (!checkObject(issues, snapshot, '$', {
    allowed: ['$schema', 'documentType', 'schemaVersion', 'snapshotId', 'snapshotAt', 'mapping', 'handoffPolicy', 'sources', 'enterprises', 'appliedResponses'],
    required: ['$schema', 'documentType', 'schemaVersion', 'snapshotId', 'snapshotAt', 'mapping', 'handoffPolicy', 'sources', 'enterprises']
  })) return { ok: false, issues, snapshot, catalog: null }
  if (snapshot.documentType !== READINESS_SNAPSHOT_TYPE) issues.push(issue('invalid-document-type', '$.documentType'))
  if (snapshot.schemaVersion !== 1) issues.push(issue('unsupported-version', '$.schemaVersion'))
  checkText(issues, snapshot.snapshotId, '$.snapshotId', { max: 120, pattern: IDENTIFIER })
  checkDateTime(issues, snapshot.snapshotAt, '$.snapshotAt')

  let catalog = null
  if (checkObject(issues, snapshot.mapping, '$.mapping', {
    allowed: ['path', 'mappingVersion', 'sha256'],
    required: ['path', 'mappingVersion', 'sha256']
  })) {
    if (snapshot.mapping.mappingVersion !== 1) issues.push(issue('unsupported-mapping-version', '$.mapping.mappingVersion'))
    checkText(issues, snapshot.mapping.sha256, '$.mapping.sha256', { max: 64, pattern: SHA256 })
    const catalogPath = resolveInside(root, snapshot.mapping.path)
    if (!catalogPath) issues.push(issue('unsafe-mapping-path', '$.mapping.path'))
    else if (!existsSync(catalogPath)) issues.push(issue('mapping-file-missing', '$.mapping.path'))
    else {
      const content = readFileSync(catalogPath)
      if (sha256(content) !== snapshot.mapping.sha256) issues.push(issue('mapping-hash-drift', '$.mapping.sha256'))
      catalog = readJson(catalogPath, snapshot.mapping.path, issues)
      if (catalog) {
        issues.push(...validateFieldCatalog(catalog).map((entry) => issue(entry.code, `mapping:${entry.path}`, entry.detail)))
        if (catalog.mappingVersion !== snapshot.mapping.mappingVersion) issues.push(issue('mapping-version-mismatch', '$.mapping.mappingVersion'))
      }
    }
  }

  if (checkObject(issues, snapshot.handoffPolicy, '$.handoffPolicy', {
    allowed: ['controller', 'runtimeConsumer', 'siteKey', 'applyMode', 'initialStatus', 'productionRequiresExplicitApproval'],
    required: ['controller', 'runtimeConsumer', 'siteKey', 'applyMode', 'initialStatus', 'productionRequiresExplicitApproval']
  })) {
    if (snapshot.handoffPolicy.controller !== 'implementation-operations-console') issues.push(issue('invalid-controller', '$.handoffPolicy.controller'))
    if (snapshot.handoffPolicy.runtimeConsumer !== 'eiscore') issues.push(issue('invalid-runtime-consumer', '$.handoffPolicy.runtimeConsumer'))
    if (snapshot.handoffPolicy.siteKey !== 'primary') issues.push(issue('site-key-must-be-primary', '$.handoffPolicy.siteKey'))
    if (snapshot.handoffPolicy.applyMode !== 'initialize-only') issues.push(issue('handoff-must-be-initialize-only', '$.handoffPolicy.applyMode'))
    if (snapshot.handoffPolicy.initialStatus !== 'draft') issues.push(issue('handoff-must-start-as-draft', '$.handoffPolicy.initialStatus'))
    if (snapshot.handoffPolicy.productionRequiresExplicitApproval !== true) issues.push(issue('explicit-production-approval-required', '$.handoffPolicy.productionRequiresExplicitApproval'))
  }

  checkSortedObjects(issues, snapshot.sources, '$.sources', 'sourceId')
  const sources = new Map()
  for (const [index, source] of (Array.isArray(snapshot.sources) ? snapshot.sources : []).entries()) {
    validateSource(source, `$.sources[${index}]`, issues, root)
    if (source?.sourceId) sources.set(source.sourceId, source)
  }

  checkSortedObjects(issues, snapshot.enterprises, '$.enterprises', 'trackingId')
  const fields = new Map((catalog?.fields || []).map((field) => [field.fieldId, field]))
  for (const [index, enterprise] of (Array.isArray(snapshot.enterprises) ? snapshot.enterprises : []).entries()) {
    validateEnterprise(enterprise, `$.enterprises[${index}]`, issues, { fields, sources, repoRoot: root })
  }

  if (snapshot.appliedResponses !== undefined) {
    checkSortedObjects(issues, snapshot.appliedResponses, '$.appliedResponses', 'responseId')
    for (const [index, response] of (Array.isArray(snapshot.appliedResponses) ? snapshot.appliedResponses : []).entries()) {
      const path = `$.appliedResponses[${index}]`
      if (!checkObject(issues, response, path, {
        allowed: ['responseId', 'responseSha256', 'requestId', 'requestSha256', 'appliedAt'],
        required: ['responseId', 'responseSha256', 'requestId', 'requestSha256', 'appliedAt']
      })) continue
      checkText(issues, response.responseId, `${path}.responseId`, { max: 120, pattern: IDENTIFIER })
      checkText(issues, response.responseSha256, `${path}.responseSha256`, { max: 64, pattern: SHA256 })
      checkText(issues, response.requestId, `${path}.requestId`, { max: 120, pattern: IDENTIFIER })
      checkText(issues, response.requestSha256, `${path}.requestSha256`, { max: 64, pattern: SHA256 })
      checkDateTime(issues, response.appliedAt, `${path}.appliedAt`)
    }
  }

  scanUnsafeValue(snapshot, '$', issues)
  return { ok: issues.length === 0, issues, snapshot, catalog }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const target = process.argv.slice(2).find((argument) => !argument.startsWith('--')) || 'enterprise-handoffs/first-wave-readiness.json'
  const snapshotPath = resolve(process.cwd(), target)
  const result = validateEnterpriseHandoff({ snapshotPath, repoRoot: process.cwd() })
  if (!result.ok) {
    console.error(`[fail] enterprise handoff validation failed (${result.issues.length} issue(s))`)
    for (const entry of result.issues) console.error(`- ${formatEnterpriseHandoffIssue(entry)}`)
    process.exitCode = 1
  } else {
    console.log(`[ok] validated ${target}: ${result.catalog.fields.length} mapped field groups, ${result.snapshot.sources.length} sources, ${result.snapshot.enterprises.length} enterprise readiness records`)
  }
}
