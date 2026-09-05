// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateEnterprisePackage } from './enterprise-package.mjs'

const SHA256 = /^[0-9a-f]{64}$/
const COMMIT = /^[0-9a-f]{40,64}$/
const ID = /^[a-z0-9][a-z0-9.-]*$/
const ENTERPRISE_ID = /^[a-z0-9][a-z0-9-]*$/

const issue = (code, path = '.', detail = '') => ({ code, path, detail })
const unknownKeys = (value, allowed, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.keys(value).filter((key) => !allowed.has(key)).map((key) => issue('unknown-key', `${path}.${key}`))
}
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const canonical = (value) => JSON.stringify(value, null, 2) + '\n'
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

const safeRelativePath = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.startsWith('/') || value.includes('\\')) return false
  const parts = value.split('/')
  return parts.every((part) => part && part !== '.' && part !== '..')
}

const resolveSafe = (root, path) => {
  if (!safeRelativePath(path)) return null
  const absolute = resolve(root, ...path.split('/'))
  const fromRoot = relative(root, absolute)
  return fromRoot && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) ? absolute : null
}

const fileDigest = (root, entry, path) => {
  const absolute = resolveSafe(root, entry.path)
  if (!absolute) return { issues: [issue('unsafe-artifact-path', path)], buffer: null }
  let stats
  try {
    const lstat = lstatSync(absolute)
    if (lstat.isSymbolicLink()) return { issues: [issue('artifact-symlink-forbidden', path)], buffer: null }
    stats = lstat
  } catch {
    return { issues: [issue('artifact-file-missing', path)], buffer: null }
  }
  if (!stats.isFile()) return { issues: [issue('artifact-file-required', path)], buffer: null }
  const buffer = readFileSync(absolute)
  const issues = []
  if (entry.bytes !== buffer.length) issues.push(issue('artifact-byte-drift', `${path}.bytes`))
  if (entry.sha256 !== sha256(buffer)) issues.push(issue('artifact-hash-drift', `${path}.sha256`))
  return { issues, buffer }
}

export const computeCoreArtifactSha256 = (artifact) => {
  const input = structuredClone(artifact)
  delete input.sha256
  return sha256(Buffer.from(JSON.stringify(stable(input)), 'utf8'))
}

export const validateEnterpriseArtifactSet = ({ root, input, production = false } = {}) => {
  const repoRoot = resolve(root || process.cwd())
  const issues = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: [issue('object-required')] }
  if (input.schemaVersion !== 1) issues.push(issue('unsupported-version', '$.schemaVersion'))
  if (typeof input.releaseId !== 'string' || !ID.test(input.releaseId)) issues.push(issue('invalid-release-id', '$.releaseId'))

  const artifact = input.coreArtifact
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    issues.push(issue('object-required', '$.coreArtifact'))
  } else {
    issues.push(...unknownKeys(artifact, new Set(['artifactId', 'sourceCommit', 'files', 'sha256']), '$.coreArtifact'))
    if (typeof artifact.artifactId !== 'string' || !ID.test(artifact.artifactId)) issues.push(issue('invalid-artifact-id', '$.coreArtifact.artifactId'))
    if (typeof artifact.sourceCommit !== 'string' || !COMMIT.test(artifact.sourceCommit)) issues.push(issue('invalid-source-commit', '$.coreArtifact.sourceCommit'))
    if (!Array.isArray(artifact.files) || artifact.files.length === 0) issues.push(issue('artifact-files-required', '$.coreArtifact.files'))
    const files = Array.isArray(artifact.files) ? artifact.files : []
    const paths = files.map((entry) => entry?.path)
    if (JSON.stringify(paths) !== JSON.stringify([...paths].sort())) issues.push(issue('artifact-files-not-sorted', '$.coreArtifact.files'))
    const seen = new Set()
    for (const [index, entry] of files.entries()) {
      const path = `$.coreArtifact.files[${index}]`
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        issues.push(issue('object-required', path))
        continue
      }
      issues.push(...unknownKeys(entry, new Set(['path', 'bytes', 'sha256']), path))
      if (!safeRelativePath(entry.path)) issues.push(issue('unsafe-artifact-path', `${path}.path`))
      if (seen.has(entry.path)) issues.push(issue('duplicate-artifact-path', `${path}.path`))
      seen.add(entry.path)
      if (!Number.isInteger(entry.bytes) || entry.bytes < 0) issues.push(issue('invalid-artifact-bytes', `${path}.bytes`))
      if (typeof entry.sha256 !== 'string' || !SHA256.test(entry.sha256)) issues.push(issue('invalid-artifact-hash', `${path}.sha256`))
      if (safeRelativePath(entry.path)) issues.push(...fileDigest(repoRoot, entry, path).issues)
    }
    if (typeof artifact.sha256 !== 'string' || !SHA256.test(artifact.sha256)) issues.push(issue('invalid-core-artifact-hash', '$.coreArtifact.sha256'))
    else if (artifact.sha256 !== computeCoreArtifactSha256(artifact)) issues.push(issue('core-artifact-hash-drift', '$.coreArtifact.sha256'))
  }

  const packages = Array.isArray(input.enterprisePackages) ? input.enterprisePackages : []
  if (packages.length < 2) issues.push(issue('enterprise-packages-minimum', '$.enterprisePackages'))
  const packageIds = packages.map((entry) => entry?.packageId)
  if (JSON.stringify(packageIds) !== JSON.stringify([...packageIds].sort())) issues.push(issue('enterprise-packages-not-sorted', '$.enterprisePackages'))
  const seenPackages = new Set()
  const seenEnterprises = new Set()
  for (const [index, entry] of packages.entries()) {
    const path = `$.enterprisePackages[${index}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push(issue('object-required', path))
      continue
    }
    issues.push(...unknownKeys(entry, new Set(['packageId', 'packagePath', 'enterpriseId', 'packageSha256']), path))
    if (typeof entry.packageId !== 'string' || !ID.test(entry.packageId)) issues.push(issue('invalid-package-id', `${path}.packageId`))
    if (typeof entry.enterpriseId !== 'string' || !ENTERPRISE_ID.test(entry.enterpriseId)) issues.push(issue('invalid-enterprise-id', `${path}.enterpriseId`))
    if (seenPackages.has(entry.packageId)) issues.push(issue('duplicate-package-id', `${path}.packageId`))
    if (seenEnterprises.has(entry.enterpriseId)) issues.push(issue('duplicate-enterprise-id', `${path}.enterpriseId`))
    if (typeof entry.packageSha256 !== 'string' || !SHA256.test(entry.packageSha256)) issues.push(issue('invalid-package-hash', `${path}.packageSha256`))
    seenPackages.add(entry.packageId)
    seenEnterprises.add(entry.enterpriseId)
    const packageRoot = resolveSafe(repoRoot, entry.packagePath)
    if (!packageRoot) {
      issues.push(issue('unsafe-package-path', `${path}.packagePath`))
      continue
    }
    const result = validateEnterprisePackage({ packRoot: packageRoot, production })
    if (!result.ok) issues.push(issue('enterprise-package-invalid', `${path}.packagePath`, result.issues.map((item) => item.code).join(',')))
    if (result.manifest?.packageId !== entry.packageId) issues.push(issue('package-id-mismatch', `${path}.packageId`))
    if (result.manifest?.enterprise?.id !== entry.enterpriseId) issues.push(issue('enterprise-id-mismatch', `${path}.enterpriseId`))
    if (result.manifest?.packageSha256 !== entry.packageSha256) issues.push(issue('package-hash-mismatch', `${path}.packageSha256`))
  }
  if (production && packages.length < 3) issues.push(issue('production-enterprise-packages-minimum', '$.enterprisePackages'))
  return { ok: issues.length === 0, issues, input }
}

export const generateEnterpriseArtifactSet = ({ root, input, writePath } = {}) => {
  const repoRoot = resolve(root || process.cwd())
  const next = structuredClone(input)
  next.coreArtifact = { ...next.coreArtifact, sha256: computeCoreArtifactSha256(next.coreArtifact) }
  if (writePath) {
    const output = resolve(repoRoot, writePath)
    const fromRoot = relative(repoRoot, output)
    if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..') throw new Error('artifact set output must stay inside repository root')
    writeFileSync(output, canonical(next), 'utf8')
  }
  return next
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [operation = 'validate', target = 'enterprise-handoffs/artifact-set.json'] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const production = process.argv.includes('--production')
  try {
    const root = process.cwd()
    const input = JSON.parse(readFileSync(resolve(root, target), 'utf8'))
    const result = validateEnterpriseArtifactSet({ root, input, production })
    if (!result.ok) {
      console.error(`[fail] enterprise artifact set ${operation} failed (${result.issues.length} issue(s))`)
      result.issues.forEach((entry) => console.error(`- ${entry.path} (${entry.code})`))
      process.exitCode = 1
    } else console.log(`[ok] validated ${target}: ${input.coreArtifact.sha256} with ${input.enterprisePackages.length} enterprise package(s)`)
  } catch (error) {
    console.error(`[fail] enterprise artifact set ${operation} failed: ${error.message}`)
    process.exitCode = 1
  }
}
