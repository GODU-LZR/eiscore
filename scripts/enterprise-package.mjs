// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EnterpriseConfigError,
  parseEnterpriseConfig
} from '../packages/eiscore-platform/src/enterprise-config.mjs'
import { scanTextLine } from './scan-secrets.mjs'

const MANIFEST_FILE = 'manifest.json'
const RUNTIME_CONFIG_PATH = 'runtime/eiscore-enterprise.json'
const COMPANY_SITE_SEED_PATH = 'data/company-site.json'
const MAX_FILE_BYTES = 512 * 1024 * 1024
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/
const ID = /^[a-z0-9][a-z0-9-]*$/
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/
const SHA256 = /^[0-9a-f]{64}$/
const FORBIDDEN_EXECUTABLE = /(?:^|\/)(?:[^/]+\.)?(?:sql|psql)$/i
const DATABASE_CODE = /(?:^|[;\r\n])\s*(?:(?:create(?:\s+or\s+replace)?|alter|drop)\s+(?:table|view|materialized\s+view|function|procedure|trigger|policy|role|schema|type|extension|index|sequence|database|domain|collation|publication|subscription)|truncate(?:\s+table)?\s+|(?:grant|revoke)\s+(?:all|select|insert|update|delete|truncate|references|trigger|usage|execute|create|connect|temporary|temp|set)\b|comment\s+on\s+|set\s+role\b|(?:select\s+.+\s+from|insert\s+into|update\s+.+\s+set|delete\s+from|merge\s+into|copy\s+))/i
const SECRET_KEY = /(?:^|_)(?:password|passwd|pwd|token|secret|api_key|private_key|client_secret|credential|authorization|access_key|connection_string|database_url)(?:$|_)/i
const CREDENTIAL_URL = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i
const LOCAL_PATH = /^(?:file:\/\/|[A-Za-z]:[\\/]|\\\\)/i
const DATA_URL = /^data:[^,]+,/i
const BASE64_VALUE = /^[A-Za-z0-9+/]+={0,2}$/
const MANIFEST_KEYS = new Set([
  '$schema', 'packageSchemaVersion', 'packageId', 'packageVersion', 'status',
  'enterprise', 'coreCompatibility', 'runtime', 'files', 'governance',
  'createdAt', 'packageSha256'
])
const SITE_ROOT_KEYS = new Set([
  '$schema', 'schemaVersion', 'seedType', 'enterpriseId', 'siteKey',
  'applyMode', 'initialStatus', 'site', 'content', 'governance'
])
const SITE_KEYS = new Set([
  'legalName', 'brandName', 'brandShortName', 'factoryName', 'domain',
  'templateKey', 'defaultLocale', 'enabledLocales', 'theme', 'contact',
  'socialLinks', 'trademark', 'settings', 'seo'
])
const CONTENT_KEYS = new Set([
  'pages', 'products', 'productLocales', 'solutions', 'cases', 'certificates',
  'downloads', 'evidence', 'knowledge', 'seo', 'keywords', 'externalProfiles'
])
const TRADEMARK_KEYS = new Set(['logoAssetPath', 'faviconAssetPath', 'name', 'registrationNumber'])
const GOVERNANCE_KEYS = new Set(['factStatus', 'notes'])
const PACKAGE_STATUSES = new Set(['template', 'draft', 'candidate', 'approved'])
const FACT_STATUSES = new Set(['example', 'pending', 'confirmed'])
const ASSET_STATUSES = new Set(['not-applicable', 'pending', 'authorized'])

const issue = (code, path = '.', detail = '') => ({ code, path, detail })
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

export const computeEnterprisePackageSha256 = (manifest) => {
  const input = structuredClone(manifest)
  delete input.packageSha256
  return sha256(Buffer.from(JSON.stringify(stableValue(input)), 'utf8'))
}

export class EnterprisePackageError extends Error {
  constructor(message, issues = []) {
    super(message)
    this.name = 'EnterprisePackageError'
    this.issues = issues
  }
}

export const formatEnterprisePackageIssue = ({ code, path }) => `${path} (${code})`

const unknownKeyIssues = (value, allowed, path) => isObject(value)
  ? Object.keys(value).filter((key) => !allowed.has(key)).map((key) => issue('unknown-key', `${path}.${key}`))
  : []

const requireObject = (issues, value, path) => {
  if (!isObject(value)) issues.push(issue('object-required', path))
  return isObject(value)
}

const requireText = (issues, value, path, { allowEmpty = false, max = 240, pattern } = {}) => {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    issues.push(issue('text-required', path))
    return
  }
  if (value.length > max) issues.push(issue('text-too-long', path))
  if (pattern && !pattern.test(value)) issues.push(issue('invalid-format', path))
}

const safePackagePath = (value) => {
  if (typeof value !== 'string' || !SAFE_PATH.test(value) || value.includes('//')) return false
  return value.split('/').every((segment) => segment && segment !== '.' && segment !== '..')
}

const safeResolve = (root, path) => {
  if (!safePackagePath(path)) return null
  const absolute = resolve(root, ...path.split('/'))
  const fromRoot = relative(root, absolute)
  if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..') return null
  return absolute
}

const listPayloadFiles = (root, directory = root, issues = []) => {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = resolve(directory, entry.name)
    const path = relative(root, absolute).split(sep).join('/')
    const stats = lstatSync(absolute)
    if (stats.isSymbolicLink()) {
      issues.push(issue('symlink-forbidden', path))
      continue
    }
    if (entry.isDirectory()) files.push(...listPayloadFiles(root, absolute, issues))
    else if (path !== MANIFEST_FILE) files.push(path)
  }
  return files.sort()
}

export const classifyEnterprisePackagePath = (path) => {
  if (!safePackagePath(path)) return null
  if (path === RUNTIME_CONFIG_PATH) return 'runtime-config'
  if (path === COMPANY_SITE_SEED_PATH) return 'seed'
  if (path.startsWith('assets/')) return 'asset'
  if (path.startsWith('evidence/')) return 'evidence'
  return null
}

const normalizedKey = (key) => key
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[-\s]+/g, '_')
  .toLowerCase()

const scanJsonValue = (value, path, issues, { rejectDdl = false } = {}) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanJsonValue(item, `${path}[${index}]`, issues, { rejectDdl }))
    return
  }
  if (!isObject(value)) {
    if (typeof value === 'string') {
      if (rejectDdl && DATABASE_CODE.test(value)) issues.push(issue('database-code-forbidden', path))
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
    scanJsonValue(item, itemPath, issues, { rejectDdl })
  }
}

const scanPayloadBuffer = (path, buffer, issues) => {
  if (buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0)) return
  const text = buffer.toString('utf8')
  text.split(/\r?\n/).forEach((line, index) => {
    for (const finding of scanTextLine({ path, line, lineNumber: index + 1 })) {
      issues.push(issue('secret-value-forbidden', `${path}:${finding.line}`))
    }
  })
}

const collectAssetReferences = (value, path = '$', output = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectAssetReferences(item, `${path}[${index}]`, output))
    return output
  }
  if (!isObject(value)) return output
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`
    if (/assetPath$/i.test(key) && typeof item === 'string' && item) output.push({ path: itemPath, value: item })
    if (/assetPaths$|imagePaths$/i.test(key) && Array.isArray(item)) {
      item.forEach((entry, index) => {
        if (typeof entry === 'string' && entry) output.push({ path: `${itemPath}[${index}]`, value: entry })
      })
    }
    collectAssetReferences(item, itemPath, output)
  }
  return output
}

const validateCompanySiteSeed = (input, { enterpriseId, packageStatus }) => {
  const issues = []
  if (!requireObject(issues, input, '$')) return { issues, assetReferences: [] }
  issues.push(...unknownKeyIssues(input, SITE_ROOT_KEYS, '$'))
  if (input.schemaVersion !== 1) issues.push(issue('unsupported-version', '$.schemaVersion'))
  if (input.seedType !== 'company-site') issues.push(issue('invalid-seed-type', '$.seedType'))
  if (input.enterpriseId !== enterpriseId) issues.push(issue('enterprise-id-mismatch', '$.enterpriseId'))
  if (input.siteKey !== 'primary') issues.push(issue('site-key-must-be-primary', '$.siteKey'))
  if (input.applyMode !== 'initialize-only') issues.push(issue('seed-must-be-initialize-only', '$.applyMode'))
  if (input.initialStatus !== 'draft') issues.push(issue('seed-must-start-as-draft', '$.initialStatus'))

  if (requireObject(issues, input.site, '$.site')) {
    issues.push(...unknownKeyIssues(input.site, SITE_KEYS, '$.site'))
    for (const key of ['legalName', 'brandName', 'brandShortName', 'factoryName', 'domain']) {
      requireText(issues, input.site[key], `$.site.${key}`, { allowEmpty: true, max: key === 'domain' ? 255 : 240 })
    }
    requireText(issues, input.site.templateKey, '$.site.templateKey', { max: 80 })
    requireText(issues, input.site.defaultLocale, '$.site.defaultLocale', { max: 32 })
    if (typeof input.site.domain === 'string' && /:\/\//.test(input.site.domain)) issues.push(issue('domain-must-not-include-scheme', '$.site.domain'))
    if (!Array.isArray(input.site.enabledLocales) || input.site.enabledLocales.length === 0) {
      issues.push(issue('locale-list-required', '$.site.enabledLocales'))
    } else if (new Set(input.site.enabledLocales).size !== input.site.enabledLocales.length) {
      issues.push(issue('duplicate-locale', '$.site.enabledLocales'))
    }
    for (const key of ['theme', 'contact', 'socialLinks', 'trademark', 'settings', 'seo']) {
      requireObject(issues, input.site[key], `$.site.${key}`)
    }
    if (isObject(input.site.trademark)) {
      issues.push(...unknownKeyIssues(input.site.trademark, TRADEMARK_KEYS, '$.site.trademark'))
      requireText(issues, input.site.trademark.logoAssetPath, '$.site.trademark.logoAssetPath', { allowEmpty: true, max: 300 })
      requireText(issues, input.site.trademark.faviconAssetPath, '$.site.trademark.faviconAssetPath', { allowEmpty: true, max: 300 })
    }
  }

  if (requireObject(issues, input.content, '$.content')) {
    issues.push(...unknownKeyIssues(input.content, CONTENT_KEYS, '$.content'))
    for (const [key, records] of Object.entries(input.content)) {
      if (!Array.isArray(records)) {
        issues.push(issue('array-required', `$.content.${key}`))
        continue
      }
      records.forEach((record, index) => {
        const recordPath = `$.content.${key}[${index}]`
        if (!isObject(record)) issues.push(issue('object-required', recordPath))
        else if (record.status !== undefined && record.status !== 'draft') issues.push(issue('seed-content-must-be-draft', `${recordPath}.status`))
      })
    }
  }

  if (requireObject(issues, input.governance, '$.governance')) {
    issues.push(...unknownKeyIssues(input.governance, GOVERNANCE_KEYS, '$.governance'))
    if (!FACT_STATUSES.has(input.governance.factStatus)) issues.push(issue('invalid-fact-status', '$.governance.factStatus'))
    requireText(issues, input.governance.notes, '$.governance.notes', { allowEmpty: true, max: 1000 })
    if (packageStatus === 'template' && input.governance.factStatus !== 'example') issues.push(issue('template-facts-must-be-example', '$.governance.factStatus'))
    if (packageStatus === 'approved' && input.governance.factStatus !== 'confirmed') issues.push(issue('approved-facts-must-be-confirmed', '$.governance.factStatus'))
  }

  scanJsonValue(input, '$', issues, { rejectDdl: true })
  return { issues, assetReferences: collectAssetReferences(input) }
}

const validateManifestMetadata = (manifest, { requireDigest = true } = {}) => {
  const issues = []
  if (!requireObject(issues, manifest, '$')) return issues
  issues.push(...unknownKeyIssues(manifest, MANIFEST_KEYS, '$'))
  if (manifest.packageSchemaVersion !== 1) issues.push(issue('unsupported-version', '$.packageSchemaVersion'))
  requireText(issues, manifest.packageId, '$.packageId', { max: 100, pattern: ID })
  requireText(issues, manifest.packageVersion, '$.packageVersion', { max: 80, pattern: SEMVER })
  if (!PACKAGE_STATUSES.has(manifest.status)) issues.push(issue('invalid-package-status', '$.status'))

  if (requireObject(issues, manifest.enterprise, '$.enterprise')) {
    issues.push(...unknownKeyIssues(manifest.enterprise, new Set(['id', 'displayName']), '$.enterprise'))
    requireText(issues, manifest.enterprise.id, '$.enterprise.id', { max: 64, pattern: ID })
    requireText(issues, manifest.enterprise.displayName, '$.enterprise.displayName', { max: 120 })
  }
  if (requireObject(issues, manifest.coreCompatibility, '$.coreCompatibility')) {
    issues.push(...unknownKeyIssues(manifest.coreCompatibility, new Set(['packageApiVersion', 'enterpriseConfigSchemaVersion']), '$.coreCompatibility'))
    if (manifest.coreCompatibility.packageApiVersion !== 1) issues.push(issue('unsupported-package-api', '$.coreCompatibility.packageApiVersion'))
    if (manifest.coreCompatibility.enterpriseConfigSchemaVersion !== 2) issues.push(issue('unsupported-enterprise-config', '$.coreCompatibility.enterpriseConfigSchemaVersion'))
  }
  if (requireObject(issues, manifest.runtime, '$.runtime')) {
    issues.push(...unknownKeyIssues(manifest.runtime, new Set(['configPath', 'mountPath']), '$.runtime'))
    if (manifest.runtime.configPath !== RUNTIME_CONFIG_PATH) issues.push(issue('invalid-runtime-config-path', '$.runtime.configPath'))
    if (manifest.runtime.mountPath !== '/config/eiscore-enterprise.json') issues.push(issue('invalid-runtime-mount-path', '$.runtime.mountPath'))
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) issues.push(issue('file-list-required', '$.files'))
  if (requireDigest) requireText(issues, manifest.packageSha256, '$.packageSha256', { max: 64, pattern: SHA256 })
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))) issues.push(issue('invalid-date-time', '$.createdAt'))

  if (requireObject(issues, manifest.governance, '$.governance')) {
    const allowed = new Set(['factStatus', 'assetStatus', 'productionApproved', 'confirmedBy', 'confirmedAt', 'notes'])
    issues.push(...unknownKeyIssues(manifest.governance, allowed, '$.governance'))
    if (!FACT_STATUSES.has(manifest.governance.factStatus)) issues.push(issue('invalid-fact-status', '$.governance.factStatus'))
    if (!ASSET_STATUSES.has(manifest.governance.assetStatus)) issues.push(issue('invalid-asset-status', '$.governance.assetStatus'))
    if (typeof manifest.governance.productionApproved !== 'boolean') issues.push(issue('boolean-required', '$.governance.productionApproved'))
    if (manifest.status === 'template' && manifest.governance.factStatus !== 'example') issues.push(issue('template-facts-must-be-example', '$.governance.factStatus'))
    if (manifest.status !== 'approved' && manifest.governance.productionApproved === true) issues.push(issue('non-approved-package-production-flag', '$.governance.productionApproved'))
    if (manifest.status === 'approved') {
      if (manifest.governance.factStatus !== 'confirmed') issues.push(issue('approved-facts-must-be-confirmed', '$.governance.factStatus'))
      if (manifest.governance.assetStatus === 'pending') issues.push(issue('approved-assets-cannot-be-pending', '$.governance.assetStatus'))
      if (manifest.governance.productionApproved !== true) issues.push(issue('production-approval-required', '$.governance.productionApproved'))
      requireText(issues, manifest.governance.confirmedBy, '$.governance.confirmedBy', { max: 120 })
      if (typeof manifest.governance.confirmedAt !== 'string' || Number.isNaN(Date.parse(manifest.governance.confirmedAt))) issues.push(issue('invalid-date-time', '$.governance.confirmedAt'))
    }
  }
  scanJsonValue(manifest, '$', issues)
  return issues
}

const readJson = (absolute, path, issues) => {
  try {
    return JSON.parse(readFileSync(absolute, 'utf8'))
  } catch {
    issues.push(issue('invalid-json', path))
    return null
  }
}

const inspectPayload = ({ packRoot, paths, manifest, production }) => {
  const issues = []
  const productionReady = production || manifest.status === 'approved'
  const references = []
  const buffers = new Map()
  for (const path of paths) {
    const absolute = safeResolve(packRoot, path)
    if (!absolute) {
      issues.push(issue('unsafe-path', path))
      continue
    }
    if (FORBIDDEN_EXECUTABLE.test(path)) issues.push(issue('database-code-file-forbidden', path))
    const kind = classifyEnterprisePackagePath(path)
    if (!kind) issues.push(issue('unknown-payload-file', path))
    const stats = statSync(absolute)
    if (stats.size > MAX_FILE_BYTES) {
      issues.push(issue('file-too-large', path))
      continue
    }
    const buffer = readFileSync(absolute)
    buffers.set(path, buffer)
    scanPayloadBuffer(path, buffer, issues)

    if (path === RUNTIME_CONFIG_PATH) {
      const input = readJson(absolute, path, issues)
      if (input) {
        scanJsonValue(input, '$', issues)
        try {
          const runtime = parseEnterpriseConfig(input, { source: path })
          if (runtime.schemaVersion !== 2) issues.push(issue('runtime-config-must-use-v2', path))
          if (runtime.enterprise.id !== manifest.enterprise?.id) issues.push(issue('enterprise-id-mismatch', `${path}:$.enterprise.id`))
          const logoUrl = runtime.branding.logoUrl
          if (typeof logoUrl === 'string' && logoUrl.startsWith('/config/assets/')) {
            references.push({ path: `${path}:$.branding.logoUrl`, value: logoUrl.slice('/config/'.length) })
          } else if (productionReady && typeof logoUrl === 'string' && /^https?:\/\//i.test(logoUrl)) {
            issues.push(issue('production-external-asset-forbidden', `${path}:$.branding.logoUrl`))
          }
        } catch (error) {
          if (error instanceof EnterpriseConfigError) {
            error.issues.forEach((entry) => issues.push(issue(`runtime-${entry.code}`, `${path}:${entry.path}`)))
          } else issues.push(issue('invalid-runtime-config', path))
        }
      }
    }

    if (path === COMPANY_SITE_SEED_PATH) {
      const input = readJson(absolute, path, issues)
      if (input) {
        const result = validateCompanySiteSeed(input, {
          enterpriseId: manifest.enterprise?.id,
          packageStatus: manifest.status
        })
        result.issues.forEach((entry) => issues.push(issue(entry.code, `${path}:${entry.path}`)))
        result.assetReferences.forEach((entry) => references.push({ path: `${path}:${entry.path}`, value: entry.value }))
      }
    }
  }

  const assetPaths = new Set(paths.filter((path) => classifyEnterprisePackagePath(path) === 'asset'))
  for (const reference of references) {
    if (!safePackagePath(reference.value) || !reference.value.startsWith('assets/')) issues.push(issue('invalid-asset-reference', reference.path))
    else if (!assetPaths.has(reference.value)) issues.push(issue('missing-asset', reference.path))
  }
  if (manifest.status === 'approved' && assetPaths.size > 0 && manifest.governance?.assetStatus !== 'authorized') {
    issues.push(issue('approved-assets-must-be-authorized', '$.governance.assetStatus'))
  }
  return { issues, buffers }
}

const fileRecord = (path, buffer) => ({
  path,
  kind: classifyEnterprisePackagePath(path),
  bytes: buffer.length,
  sha256: sha256(buffer)
})

export const generateEnterprisePackageManifest = ({ packRoot, write = true } = {}) => {
  const root = resolve(packRoot || '')
  const manifestPath = resolve(root, MANIFEST_FILE)
  const manifest = readJson(manifestPath, MANIFEST_FILE, [])
  if (!manifest) throw new EnterprisePackageError('Cannot generate enterprise package manifest', [issue('invalid-json', MANIFEST_FILE)])
  const issues = validateManifestMetadata(manifest, { requireDigest: false })
  const paths = listPayloadFiles(root, root, issues)
  const inspected = inspectPayload({ packRoot: root, paths, manifest, production: false })
  issues.push(...inspected.issues)
  if (issues.length) throw new EnterprisePackageError('Cannot generate enterprise package manifest', issues)
  const next = {
    ...manifest,
    files: paths.map((path) => fileRecord(path, inspected.buffers.get(path)))
  }
  delete next.packageSha256
  next.packageSha256 = computeEnterprisePackageSha256(next)
  if (write) writeFileSync(manifestPath, canonicalJson(next), 'utf8')
  return next
}

export const validateEnterprisePackage = ({ packRoot, production = false } = {}) => {
  const root = resolve(packRoot || '')
  const issues = []
  const manifestPath = resolve(root, MANIFEST_FILE)
  const manifest = readJson(manifestPath, MANIFEST_FILE, issues)
  if (!manifest) return { ok: false, issues, manifest: null, files: [] }
  issues.push(...validateManifestMetadata(manifest))
  const paths = listPayloadFiles(root, root, issues)
  const inspected = inspectPayload({ packRoot: root, paths, manifest, production })
  issues.push(...inspected.issues)

  const entries = Array.isArray(manifest.files) ? manifest.files : []
  const declaredPaths = entries.map((entry) => entry?.path)
  if (JSON.stringify(declaredPaths) !== JSON.stringify([...declaredPaths].sort())) {
    issues.push(issue('file-list-not-sorted', '$.files'))
  }
  const seen = new Set()
  for (const [index, entry] of entries.entries()) {
    const entryPath = `$.files[${index}]`
    if (!isObject(entry)) {
      issues.push(issue('object-required', entryPath))
      continue
    }
    issues.push(...unknownKeyIssues(entry, new Set(['path', 'kind', 'bytes', 'sha256']), entryPath))
    if (!safePackagePath(entry.path)) issues.push(issue('unsafe-path', `${entryPath}.path`))
    if (seen.has(entry.path)) issues.push(issue('duplicate-path', `${entryPath}.path`))
    seen.add(entry.path)
    const expectedKind = classifyEnterprisePackagePath(entry.path)
    if (!expectedKind) issues.push(issue('unknown-payload-file', `${entryPath}.path`))
    else if (entry.kind !== expectedKind) issues.push(issue('file-kind-mismatch', `${entryPath}.kind`))
    const buffer = inspected.buffers.get(entry.path)
    if (!buffer) issues.push(issue('manifest-file-missing', `${entryPath}.path`))
    else {
      if (entry.bytes !== buffer.length) issues.push(issue('file-byte-drift', `${entryPath}.bytes`))
      if (entry.sha256 !== sha256(buffer)) issues.push(issue('file-hash-drift', `${entryPath}.sha256`))
    }
  }
  paths.filter((path) => !seen.has(path)).forEach((path) => issues.push(issue('unlisted-payload-file', path)))
  if (entries.filter((entry) => entry?.kind === 'runtime-config').length !== 1) issues.push(issue('single-runtime-config-required', '$.files'))
  if (manifest.packageSha256 !== computeEnterprisePackageSha256(manifest)) issues.push(issue('package-hash-drift', '$.packageSha256'))
  if (production && manifest.status !== 'approved') issues.push(issue('production-package-must-be-approved', '$.status'))

  return { ok: issues.length === 0, issues, manifest, files: paths }
}

const printFailure = (operation, error) => {
  const issues = error instanceof EnterprisePackageError ? error.issues : []
  console.error(`[fail] enterprise package ${operation} failed (${issues.length || 1} issue(s))`)
  for (const entry of issues) console.error(`- ${formatEnterprisePackageIssue(entry)}`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [operation = 'validate', target = 'enterprise-packs/example'] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const packRoot = resolve(process.cwd(), target)
  const production = process.argv.includes('--production')
  try {
    if (operation === 'generate') {
      const manifest = generateEnterprisePackageManifest({ packRoot })
      console.log(`[ok] generated ${target}/${MANIFEST_FILE}: ${manifest.packageSha256}`)
    } else if (operation === 'validate') {
      const result = validateEnterprisePackage({ packRoot, production })
      if (!result.ok) throw new EnterprisePackageError('Enterprise package validation failed', result.issues)
      console.log(`[ok] validated ${target}: ${result.manifest.packageId}@${result.manifest.packageVersion} (${result.files.length} payload file(s), ${result.manifest.packageSha256})`)
    } else {
      throw new EnterprisePackageError('Unknown enterprise package operation', [issue('unknown-operation', operation)])
    }
  } catch (error) {
    printFailure(operation, error)
    process.exitCode = 1
  }
}
