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
import { validateEnterpriseConfirmationRequest } from './enterprise-confirmation-request.mjs'

const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/
const IDENTIFIER = /^[a-z0-9][A-Za-z0-9.-]*$/
const SHA256 = /^[0-9a-f]{64}$/
const SECRET_KEY = /(?:^|_)(?:password|passwd|pwd|token|secret|api_key|private_key|client_secret|credential|access_key|connection_string|database_url)(?:$|_)/i
const CREDENTIAL_URL = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i
const LOCAL_PATH = /^(?:file:\/\/|[A-Za-z]:[\\/]|\\\\)/i
const DATA_URL = /^data:[^,]+,/i
const BASE64_VALUE = /^[A-Za-z0-9+/]+={0,2}$/

const OWNER_SOURCE = new Map([
  ['enterprise', ['enterprise-confirmation', 'enterprise-confirmed']],
  ['deployment', ['deployment-confirmation', 'deployment-confirmed']],
  ['implementation', ['implementation-confirmation', 'implementation-confirmed']],
  ['product-engineering', ['product-engineering-confirmation', 'product-engineering-confirmed']]
])
const SOURCE_AUTHORITY = new Map([
  ['enterprise-confirmation', 'enterprise-confirmed'],
  ['deployment-confirmation', 'deployment-confirmed'],
  ['implementation-confirmation', 'implementation-confirmed'],
  ['product-engineering-confirmation', 'product-engineering-confirmed'],
  ['asset-authorization', 'rights-holder']
])
const FIELD_DECISIONS = new Set([
  'approve',
  'confirm',
  'confirm-not-applicable',
  'provide-and-confirm',
  'reject',
  'review-and-confirm'
])
const ASSET_DECISIONS = new Set([
  'authorize',
  'complete-inventory',
  'confirm-not-applicable',
  'provide-inventory',
  'reject',
  'replace'
])

const issue = (code, path = '.', detail = '') => ({ code, path, detail })
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const normalizedKey = (key) => key
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[-\s]+/g, '_')
  .toLowerCase()

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

export const computeEnterpriseConfirmationResponseSha256 = (response) => {
  const input = structuredClone(response)
  delete input.responseSha256
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

const checkObject = (issues, value, path, { allowed = [], required = [] } = {}) => {
  if (!isObject(value)) {
    issues.push(issue('object-required', path))
    return false
  }
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) issues.push(issue('unknown-key', `${path}.${key}`))
  }
  for (const key of required) {
    if (!(key in value)) issues.push(issue('required-key-missing', `${path}.${key}`))
  }
  return true
}

const checkText = (issues, value, path, { max = 1000, pattern } = {}) => {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(issue('text-required', path))
    return false
  }
  if (value.length > max) issues.push(issue('text-too-long', path))
  if (pattern && !pattern.test(value)) issues.push(issue('invalid-format', path))
  return true
}

const checkDateTime = (issues, value, path) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    issues.push(issue('invalid-date-time', path))
    return false
  }
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

const validateSource = (source, path, issues, { requestCreatedAt, respondedAt, existingSourceIds }) => {
  if (!checkObject(issues, source, path, {
    allowed: ['sourceId', 'type', 'authority', 'externalReference', 'assessedAt', 'factUse', 'containsSensitiveData', 'status', 'notes'],
    required: ['sourceId', 'type', 'authority', 'externalReference', 'assessedAt', 'factUse', 'containsSensitiveData', 'status', 'notes']
  })) return
  checkText(issues, source.sourceId, `${path}.sourceId`, { max: 120, pattern: IDENTIFIER })
  checkText(issues, source.externalReference, `${path}.externalReference`, { max: 120, pattern: IDENTIFIER })
  checkText(issues, source.notes, `${path}.notes`, { max: 1000 })
  const expectedAuthority = SOURCE_AUTHORITY.get(source.type)
  if (!expectedAuthority) issues.push(issue('invalid-source-type', `${path}.type`))
  else if (source.authority !== expectedAuthority) issues.push(issue('source-authority-mismatch', `${path}.authority`))
  if (source.factUse !== 'confirmation') issues.push(issue('confirmation-source-use-required', `${path}.factUse`))
  if (source.containsSensitiveData !== false) issues.push(issue('response-source-must-be-non-sensitive', `${path}.containsSensitiveData`))
  if (source.status !== 'available') issues.push(issue('response-source-must-be-available', `${path}.status`))
  if (existingSourceIds.has(source.sourceId)) issues.push(issue('source-id-collision', `${path}.sourceId`))
  if (checkDateTime(issues, source.assessedAt, `${path}.assessedAt`)) {
    if (Date.parse(source.assessedAt) < Date.parse(requestCreatedAt)) issues.push(issue('source-predates-request', `${path}.assessedAt`))
    if (Date.parse(source.assessedAt) > Date.parse(respondedAt)) issues.push(issue('source-postdates-response', `${path}.assessedAt`))
  }
}

const validateAssetSource = (decision, source, path, issues) => {
  const allowedTypes = {
    authorize: ['asset-authorization'],
    'complete-inventory': ['implementation-confirmation'],
    'confirm-not-applicable': ['enterprise-confirmation'],
    'provide-inventory': ['enterprise-confirmation'],
    reject: ['asset-authorization', 'enterprise-confirmation', 'implementation-confirmation'],
    replace: ['asset-authorization', 'enterprise-confirmation', 'implementation-confirmation']
  }[decision] || []
  if (source && !allowedTypes.includes(source.type)) issues.push(issue('asset-source-owner-mismatch', path))
}

export const validateEnterpriseConfirmationResponse = ({
  responsePath = 'enterprise-handoffs/confirmation-response.json',
  repoRoot = resolve(import.meta.dirname, '..')
} = {}) => {
  const root = resolve(repoRoot)
  const absoluteResponse = resolve(responsePath)
  const issues = []
  let response
  try {
    response = JSON.parse(readFileSync(absoluteResponse, 'utf8'))
  } catch {
    return { ok: false, issues: [issue('invalid-json', responsePath)], response: null, request: null, snapshot: null, catalog: null }
  }

  if (!checkObject(issues, response, '$', {
    allowed: ['$schema', 'documentType', 'schemaVersion', 'responseId', 'respondedAt', 'request', 'responsePolicy', 'sources', 'enterprises', 'responseSha256'],
    required: ['$schema', 'documentType', 'schemaVersion', 'responseId', 'respondedAt', 'request', 'responsePolicy', 'sources', 'enterprises', 'responseSha256']
  })) return { ok: false, issues, response, request: null, snapshot: null, catalog: null }

  checkText(issues, response.$schema, '$.$schema', { max: 300 })
  if (response.documentType !== 'enterprise-package-confirmation-response') issues.push(issue('invalid-document-type', '$.documentType'))
  if (response.schemaVersion !== 1) issues.push(issue('unsupported-version', '$.schemaVersion'))
  checkText(issues, response.responseId, '$.responseId', { max: 120, pattern: IDENTIFIER })
  checkDateTime(issues, response.respondedAt, '$.respondedAt')
  if (typeof response.responseSha256 !== 'string' || !SHA256.test(response.responseSha256)) {
    issues.push(issue('invalid-response-sha256', '$.responseSha256'))
  } else if (response.responseSha256 !== computeEnterpriseConfirmationResponseSha256(response)) {
    issues.push(issue('response-hash-drift', '$.responseSha256'))
  }

  let request = null
  let snapshot = null
  let catalog = null
  if (checkObject(issues, response.request, '$.request', {
    allowed: ['path', 'requestId', 'requestSha256'],
    required: ['path', 'requestId', 'requestSha256']
  })) {
    checkText(issues, response.request.requestId, '$.request.requestId', { max: 120, pattern: IDENTIFIER })
    checkText(issues, response.request.requestSha256, '$.request.requestSha256', { max: 64, pattern: SHA256 })
    const requestPath = resolveInside(root, response.request.path)
    if (!requestPath) issues.push(issue('unsafe-request-path', '$.request.path'))
    else if (!existsSync(requestPath)) issues.push(issue('request-file-missing', '$.request.path'))
    else {
      const requestValidation = validateEnterpriseConfirmationRequest({ requestPath, repoRoot: root })
      if (!requestValidation.ok) {
        issues.push(...requestValidation.issues.map((entry) => issue(`bound-request-${entry.code}`, `request:${entry.path}`)))
      } else {
        request = requestValidation.request
        if (response.$schema !== request.$schema) issues.push(issue('schema-reference-mismatch', '$.$schema'))
        if (response.request.requestId !== request.requestId) issues.push(issue('request-id-mismatch', '$.request.requestId'))
        if (response.request.requestSha256 !== request.requestSha256) issues.push(issue('request-hash-mismatch', '$.request.requestSha256'))
        if (Date.parse(response.respondedAt) < Date.parse(request.createdAt)) issues.push(issue('response-predates-request', '$.respondedAt'))
        const snapshotPath = resolveInside(root, request.snapshot.path)
        const snapshotValidation = snapshotPath
          ? validateEnterpriseHandoff({ snapshotPath, repoRoot: root })
          : { ok: false, issues: [issue('unsafe-snapshot-path', '$.snapshot.path')] }
        if (!snapshotValidation.ok) {
          issues.push(...snapshotValidation.issues.map((entry) => issue(`bound-snapshot-${entry.code}`, `snapshot:${entry.path}`)))
        } else {
          snapshot = snapshotValidation.snapshot
          catalog = snapshotValidation.catalog
        }
      }
    }
  }

  if (checkObject(issues, response.responsePolicy, '$.responsePolicy', {
    allowed: ['containsFieldValues', 'secretsForbidden', 'applyMode', 'productionApprovalNotImplied'],
    required: ['containsFieldValues', 'secretsForbidden', 'applyMode', 'productionApprovalNotImplied']
  })) {
    if (response.responsePolicy.containsFieldValues !== false) issues.push(issue('field-values-forbidden', '$.responsePolicy.containsFieldValues'))
    if (response.responsePolicy.secretsForbidden !== true) issues.push(issue('secrets-policy-required', '$.responsePolicy.secretsForbidden'))
    if (response.responsePolicy.applyMode !== 'new-snapshot-only') issues.push(issue('apply-mode-must-create-new-snapshot', '$.responsePolicy.applyMode'))
    if (response.responsePolicy.productionApprovalNotImplied !== true) issues.push(issue('production-approval-boundary-required', '$.responsePolicy.productionApprovalNotImplied'))
  }

  checkSortedObjects(issues, response.sources, '$.sources', 'sourceId')
  const sourceMap = new Map()
  const externalReferences = new Set()
  const existingSourceIds = new Set((snapshot?.sources || []).map(({ sourceId }) => sourceId))
  for (const [index, source] of (Array.isArray(response.sources) ? response.sources : []).entries()) {
    validateSource(source, `$.sources[${index}]`, issues, {
      requestCreatedAt: request?.createdAt,
      respondedAt: response.respondedAt,
      existingSourceIds
    })
    if (externalReferences.has(source?.externalReference)) issues.push(issue('duplicate-external-reference', `$.sources[${index}].externalReference`))
    if (source?.externalReference) externalReferences.add(source.externalReference)
    if (source?.sourceId) sourceMap.set(source.sourceId, source)
  }

  if ((snapshot?.appliedResponses || []).some(({ responseId }) => responseId === response.responseId)) {
    issues.push(issue('response-id-collision', '$.responseId'))
  }

  checkSortedObjects(issues, response.enterprises, '$.enterprises', 'trackingId')
  const requestEnterprises = new Map((request?.enterprises || []).map((enterprise) => [enterprise.trackingId, enterprise]))
  const usedSourceIds = new Set()
  let decisionCount = 0
  for (const [enterpriseIndex, enterprise] of (Array.isArray(response.enterprises) ? response.enterprises : []).entries()) {
    const enterprisePath = `$.enterprises[${enterpriseIndex}]`
    if (!checkObject(issues, enterprise, enterprisePath, {
      allowed: ['trackingId', 'fieldDecisions', 'assetDecisions'],
      required: ['trackingId', 'fieldDecisions', 'assetDecisions']
    })) continue
    checkText(issues, enterprise.trackingId, `${enterprisePath}.trackingId`, { max: 120, pattern: IDENTIFIER })
    const requested = requestEnterprises.get(enterprise.trackingId)
    if (!requested) issues.push(issue('enterprise-not-requested', `${enterprisePath}.trackingId`))
    checkSortedObjects(issues, enterprise.fieldDecisions, `${enterprisePath}.fieldDecisions`, 'fieldId')
    checkSortedObjects(issues, enterprise.assetDecisions, `${enterprisePath}.assetDecisions`, 'assetSetId')
    if ((enterprise.fieldDecisions?.length || 0) + (enterprise.assetDecisions?.length || 0) === 0) {
      issues.push(issue('enterprise-response-empty', enterprisePath))
    }

    const requestedFields = new Map((requested?.fieldRequests || []).map((entry) => [entry.fieldId, entry]))
    for (const [index, decision] of (Array.isArray(enterprise.fieldDecisions) ? enterprise.fieldDecisions : []).entries()) {
      decisionCount += 1
      const path = `${enterprisePath}.fieldDecisions[${index}]`
      if (!checkObject(issues, decision, path, {
        allowed: ['fieldId', 'decision', 'sourceId', 'notes'],
        required: ['fieldId', 'decision', 'sourceId', 'notes']
      })) continue
      checkText(issues, decision.fieldId, `${path}.fieldId`, { max: 120, pattern: IDENTIFIER })
      checkText(issues, decision.sourceId, `${path}.sourceId`, { max: 120, pattern: IDENTIFIER })
      checkText(issues, decision.notes, `${path}.notes`, { max: 500 })
      if (!FIELD_DECISIONS.has(decision.decision)) issues.push(issue('invalid-field-decision', `${path}.decision`))
      const fieldRequest = requestedFields.get(decision.fieldId)
      if (!fieldRequest) issues.push(issue('field-not-requested', `${path}.fieldId`))
      else if (!fieldRequest.decisionOptions.includes(decision.decision)) issues.push(issue('decision-not-requested', `${path}.decision`))
      const source = sourceMap.get(decision.sourceId)
      if (!source) issues.push(issue('unknown-response-source', `${path}.sourceId`))
      else {
        usedSourceIds.add(source.sourceId)
        const expected = OWNER_SOURCE.get(fieldRequest?.confirmationOwner)
        if (expected && (source.type !== expected[0] || source.authority !== expected[1])) {
          issues.push(issue('field-source-owner-mismatch', `${path}.sourceId`))
        }
      }
    }

    const requestedAssets = new Map((requested?.assetRequests || []).map((entry) => [entry.assetSetId, entry]))
    for (const [index, decision] of (Array.isArray(enterprise.assetDecisions) ? enterprise.assetDecisions : []).entries()) {
      decisionCount += 1
      const path = `${enterprisePath}.assetDecisions[${index}]`
      if (!checkObject(issues, decision, path, {
        allowed: ['assetSetId', 'decision', 'sourceId', 'notes'],
        required: ['assetSetId', 'decision', 'sourceId', 'notes']
      })) continue
      checkText(issues, decision.assetSetId, `${path}.assetSetId`, { max: 120, pattern: IDENTIFIER })
      checkText(issues, decision.sourceId, `${path}.sourceId`, { max: 120, pattern: IDENTIFIER })
      checkText(issues, decision.notes, `${path}.notes`, { max: 500 })
      if (!ASSET_DECISIONS.has(decision.decision)) issues.push(issue('invalid-asset-decision', `${path}.decision`))
      const assetRequest = requestedAssets.get(decision.assetSetId)
      if (!assetRequest) issues.push(issue('asset-set-not-requested', `${path}.assetSetId`))
      else if (!assetRequest.decisionOptions.includes(decision.decision)) issues.push(issue('decision-not-requested', `${path}.decision`))
      const source = sourceMap.get(decision.sourceId)
      if (!source) issues.push(issue('unknown-response-source', `${path}.sourceId`))
      else {
        usedSourceIds.add(source.sourceId)
        validateAssetSource(decision.decision, source, `${path}.sourceId`, issues)
      }
    }
  }
  if (decisionCount === 0) issues.push(issue('response-must-contain-decisions', '$.enterprises'))
  for (const sourceId of sourceMap.keys()) {
    if (!usedSourceIds.has(sourceId)) issues.push(issue('unused-response-source', '$.sources', sourceId))
  }

  scanUnsafeValue(response, '$', issues)
  return { ok: issues.length === 0, issues, response, request, snapshot, catalog }
}

const readyForProductionRule = (readiness, mapping) => readiness.status === 'confirmed'
  || (mapping?.productionRule === 'confirmed-or-not-applicable' && readiness.status === 'not-applicable')

const addSource = (entry, sourceId) => {
  entry.sourceIds = [...new Set([...entry.sourceIds, sourceId])].sort()
}

export const applyEnterpriseConfirmationResponse = ({
  responsePath = 'enterprise-handoffs/confirmation-response.json',
  repoRoot = resolve(import.meta.dirname, '..')
} = {}) => {
  const validation = validateEnterpriseConfirmationResponse({ responsePath, repoRoot })
  if (!validation.ok) return { ...validation, changes: [] }
  const { response, request, catalog } = validation
  const snapshot = structuredClone(validation.snapshot)
  const issues = []
  const changes = []
  const mappings = new Map(catalog.fields.map((field) => [field.fieldId, field]))
  const enterprises = new Map(snapshot.enterprises.map((enterprise) => [enterprise.trackingId, enterprise]))

  snapshot.sources.push(...structuredClone(response.sources))
  snapshot.sources.sort((left, right) => left.sourceId.localeCompare(right.sourceId))

  const ordinary = []
  const governance = []
  for (const enterpriseResponse of response.enterprises) {
    const enterprise = enterprises.get(enterpriseResponse.trackingId)
    for (const decision of enterpriseResponse.fieldDecisions) {
      const item = { enterprise, trackingId: enterpriseResponse.trackingId, decision }
      if (decision.fieldId.startsWith('governance.')) governance.push(item)
      else ordinary.push(item)
    }
  }

  for (const { enterprise, trackingId, decision } of ordinary) {
    const readiness = enterprise.fieldReadiness.find(({ fieldId }) => fieldId === decision.fieldId)
    if (decision.decision === 'reject') {
      changes.push({ trackingId, target: decision.fieldId, action: 'record-rejection' })
      continue
    }
    readiness.status = decision.decision === 'confirm-not-applicable' ? 'not-applicable' : 'confirmed'
    readiness.blockers = []
    addSource(readiness, decision.sourceId)
    changes.push({ trackingId, target: decision.fieldId, action: readiness.status })
  }

  for (const enterpriseResponse of response.enterprises) {
    const enterprise = enterprises.get(enterpriseResponse.trackingId)
    for (const decision of enterpriseResponse.assetDecisions) {
      const asset = enterprise.assetSets.find(({ assetSetId }) => assetSetId === decision.assetSetId)
      if (decision.decision === 'authorize') {
        asset.status = 'authorized'
        asset.authorizationStatus = 'confirmed'
        asset.commercialUse = true
        addSource(asset, decision.sourceId)
        changes.push({ trackingId: enterpriseResponse.trackingId, target: decision.assetSetId, action: 'authorized' })
      } else if (decision.decision === 'confirm-not-applicable') {
        asset.status = 'not-applicable'
        asset.authorizationStatus = 'not-required'
        asset.commercialUse = false
        asset.declaredFileCount = 0
        asset.presentFileCount = 0
        delete asset.inventoryPath
        addSource(asset, decision.sourceId)
        changes.push({ trackingId: enterpriseResponse.trackingId, target: decision.assetSetId, action: 'not-applicable' })
      } else {
        changes.push({ trackingId: enterpriseResponse.trackingId, target: decision.assetSetId, action: 'record-only-refresh-required' })
      }
    }
  }

  const governanceOrder = ['governance.factStatus', 'governance.assetStatus', 'governance.productionApproval']
  governance.sort((left, right) => governanceOrder.indexOf(left.decision.fieldId) - governanceOrder.indexOf(right.decision.fieldId))
  for (const { enterprise, trackingId, decision } of governance) {
    const readiness = enterprise.fieldReadiness.find(({ fieldId }) => fieldId === decision.fieldId)
    const approvalKey = {
      'governance.factStatus': 'facts',
      'governance.assetStatus': 'assets',
      'governance.productionApproval': 'package'
    }[decision.fieldId]
    if (decision.decision === 'reject') {
      enterprise.approvals[approvalKey] = 'rejected'
      changes.push({ trackingId, target: decision.fieldId, action: 'rejected' })
      continue
    }

    if (decision.fieldId === 'governance.factStatus') {
      const pending = enterprise.fieldReadiness.filter((entry) => !entry.fieldId.startsWith('governance.')
        && !readyForProductionRule(entry, mappings.get(entry.fieldId)))
      if (pending.length) {
        issues.push(issue('fact-readiness-incomplete', `${trackingId}.${decision.fieldId}`, pending.map(({ fieldId }) => fieldId).join(',')))
        continue
      }
    }
    if (decision.fieldId === 'governance.assetStatus') {
      const pending = enterprise.assetSets.filter(({ status }) => !['authorized', 'not-applicable'].includes(status))
      if (pending.length) {
        issues.push(issue('asset-readiness-incomplete', `${trackingId}.${decision.fieldId}`, pending.map(({ assetSetId }) => assetSetId).join(',')))
        continue
      }
    }
    if (decision.fieldId === 'governance.productionApproval') {
      if (enterprise.packageStatus === 'not-created') issues.push(issue('package-not-created', `${trackingId}.packageStatus`))
      const pendingFields = enterprise.fieldReadiness.filter((entry) => entry.fieldId !== decision.fieldId
        && !readyForProductionRule(entry, mappings.get(entry.fieldId)))
      if (pendingFields.length) issues.push(issue('production-fields-incomplete', `${trackingId}.${decision.fieldId}`))
      if (enterprise.assetSets.some(({ status }) => !['authorized', 'not-applicable'].includes(status))) {
        issues.push(issue('production-assets-incomplete', `${trackingId}.${decision.fieldId}`))
      }
      if (enterprise.approvals.facts !== 'approved' || enterprise.approvals.assets !== 'approved') {
        issues.push(issue('production-prerequisite-approval-missing', `${trackingId}.${decision.fieldId}`))
      }
      if (enterprise.blockers.length) issues.push(issue('production-blockers-remain', `${trackingId}.blockers`))
      if (issues.length) continue
    }

    readiness.status = 'confirmed'
    readiness.blockers = []
    addSource(readiness, decision.sourceId)
    enterprise.approvals[approvalKey] = 'approved'
    changes.push({ trackingId, target: decision.fieldId, action: 'approved' })
  }

  if (issues.length) return { ok: false, issues, response, request, snapshot: null, catalog, changes }
  snapshot.snapshotId = `readiness-${response.responseSha256.slice(0, 20)}`
  snapshot.snapshotAt = response.respondedAt
  snapshot.appliedResponses = [...(snapshot.appliedResponses || []), {
    responseId: response.responseId,
    responseSha256: response.responseSha256,
    requestId: request.requestId,
    requestSha256: request.requestSha256,
    appliedAt: response.respondedAt
  }].sort((left, right) => left.responseId.localeCompare(right.responseId))

  const outputValidation = validateEnterpriseHandoff({ snapshotInput: snapshot, repoRoot })
  if (!outputValidation.ok) {
    return {
      ok: false,
      issues: outputValidation.issues.map((entry) => issue(`output-${entry.code}`, entry.path, entry.detail)),
      response,
      request,
      snapshot: null,
      catalog,
      changes
    }
  }
  return { ok: true, issues: [], response, request, snapshot, catalog, changes }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [operation = 'validate', first, second] = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
  try {
    const target = first || 'enterprise-handoffs/confirmation-response.json'
    if (operation === 'validate') {
      const result = validateEnterpriseConfirmationResponse({ responsePath: resolve(process.cwd(), target), repoRoot: process.cwd() })
      if (!result.ok) throw new EnterpriseHandoffError('Enterprise confirmation response validation failed', result.issues)
      const decisionCount = result.response.enterprises.reduce((sum, enterprise) => sum + enterprise.fieldDecisions.length + enterprise.assetDecisions.length, 0)
      console.log(`[ok] validated ${target}: ${decisionCount} decision(s), ${result.response.sources.length} confirmation source(s) (${result.response.responseSha256})`)
    } else if (operation === 'plan' || operation === 'apply') {
      const result = applyEnterpriseConfirmationResponse({ responsePath: resolve(process.cwd(), target), repoRoot: process.cwd() })
      if (!result.ok) throw new EnterpriseHandoffError('Enterprise confirmation response apply failed', result.issues)
      if (operation === 'plan') {
        process.stdout.write(canonicalJson({ snapshotId: result.snapshot.snapshotId, changes: result.changes }))
      } else {
        if (!second) throw new EnterpriseHandoffError('Output path is required', [issue('output-path-required', '.')])
        const outputPath = resolveInside(process.cwd(), second.split('\\').join('/'))
        if (!outputPath) throw new EnterpriseHandoffError('Output path must stay inside repository', [issue('unsafe-output-path', second)])
        if (existsSync(outputPath)) throw new EnterpriseHandoffError('Output path already exists', [issue('output-exists', second)])
        writeFileSync(outputPath, canonicalJson(result.snapshot), 'utf8')
        console.log(`[ok] wrote new readiness snapshot ${second}: ${result.changes.length} controlled change(s); source snapshot was not modified`)
      }
    } else throw new EnterpriseHandoffError('Unknown confirmation response operation', [issue('unknown-operation', operation)])
  } catch (error) {
    const issues = error instanceof EnterpriseHandoffError ? error.issues : [issue('unexpected-error')]
    console.error(`[fail] enterprise confirmation response ${operation} failed (${issues.length} issue(s))`)
    for (const entry of issues) console.error(`- ${entry.path} (${entry.code})`)
    process.exitCode = 1
  }
}
