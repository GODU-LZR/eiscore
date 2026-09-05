// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  computeCoreArtifactSha256,
  validateEnterpriseArtifactSet
} from '../../scripts/enterprise-artifact-set.mjs'
import { computeEnterprisePackageSha256, generateEnterprisePackageManifest } from '../../scripts/enterprise-package.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'eiscore-artifact-set-'))
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const copyPackage = (name, packageId, enterpriseId) => {
  const target = resolve(fixtureRoot, name)
  cpSync(resolve(repoRoot, 'enterprise-packs/example'), target, { recursive: true })
  const manifestPath = resolve(target, 'manifest.json')
  const manifest = readJson(manifestPath)
  manifest.packageId = packageId
  manifest.enterprise.id = enterpriseId
  manifest.enterprise.displayName = `${enterpriseId} fixture`
  manifest.packageSha256 = computeEnterprisePackageSha256(manifest)
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  const runtimePath = resolve(target, 'runtime/eiscore-enterprise.json')
  const runtime = readJson(runtimePath)
  runtime.enterprise.id = enterpriseId
  runtime.enterprise.displayName = `${enterpriseId} fixture`
  writeFileSync(runtimePath, `${JSON.stringify(runtime, null, 2)}\n`, 'utf8')
  const seedPath = resolve(target, 'data/company-site.json')
  const seed = readJson(seedPath)
  seed.enterpriseId = enterpriseId
  writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8')
  generateEnterprisePackageManifest({ packRoot: target, write: true })
  return target
}

try {
  mkdirSync(resolve(fixtureRoot, 'artifact'), { recursive: true })
  writeFileSync(resolve(fixtureRoot, 'artifact/core.js'), 'export const version = 1\n', 'utf8')
  writeFileSync(resolve(fixtureRoot, 'artifact/core.css'), '.core { display: block; }\n', 'utf8')
  const first = copyPackage('pack-a', 'fixture-a', 'fixture-a')
  const second = copyPackage('pack-b', 'fixture-b', 'fixture-b')
  const artifact = {
    artifactId: 'eiscore-core-fixture',
    sourceCommit: 'a'.repeat(40),
    files: [
      { path: 'artifact/core.css', bytes: readFileSync(resolve(fixtureRoot, 'artifact/core.css')).length, sha256: '' },
      { path: 'artifact/core.js', bytes: readFileSync(resolve(fixtureRoot, 'artifact/core.js')).length, sha256: '' }
    ]
  }
  for (const entry of artifact.files) {
    const content = readFileSync(resolve(fixtureRoot, entry.path))
    const { createHash } = await import('node:crypto')
    entry.sha256 = createHash('sha256').update(content).digest('hex')
  }
  artifact.sha256 = computeCoreArtifactSha256(artifact)
  const makeInput = () => ({
    schemaVersion: 1,
    releaseId: 'fixture-release-1',
    coreArtifact: structuredClone(artifact),
    enterprisePackages: [
      { packageId: 'fixture-a', packagePath: 'pack-a', enterpriseId: 'fixture-a', packageSha256: readJson(resolve(first, 'manifest.json')).packageSha256 },
      { packageId: 'fixture-b', packagePath: 'pack-b', enterpriseId: 'fixture-b', packageSha256: readJson(resolve(second, 'manifest.json')).packageSha256 }
    ]
  })
  assert.equal(validateEnterpriseArtifactSet({ root: fixtureRoot, input: makeInput() }).ok, true)

  const changed = makeInput()
  writeFileSync(resolve(fixtureRoot, 'artifact/core.js'), 'export const version = 2\n', 'utf8')
  assert.ok(validateEnterpriseArtifactSet({ root: fixtureRoot, input: changed }).issues.some((entry) => entry.code === 'artifact-hash-drift'))

  const unsorted = makeInput()
  unsorted.coreArtifact.files.reverse()
  assert.ok(validateEnterpriseArtifactSet({ root: fixtureRoot, input: unsorted }).issues.some((entry) => entry.code === 'artifact-files-not-sorted'))

  const duplicate = makeInput()
  duplicate.enterprisePackages[1].enterpriseId = duplicate.enterprisePackages[0].enterpriseId
  assert.ok(validateEnterpriseArtifactSet({ root: fixtureRoot, input: duplicate }).issues.some((entry) => entry.code === 'duplicate-enterprise-id'))

  const unknown = makeInput()
  unknown.coreArtifact.unapproved = true
  assert.ok(validateEnterpriseArtifactSet({ root: fixtureRoot, input: unknown }).issues.some((entry) => entry.code === 'unknown-key'))

  const packageDrift = makeInput()
  packageDrift.enterprisePackages[0].packageSha256 = '0'.repeat(64)
  assert.ok(validateEnterpriseArtifactSet({ root: fixtureRoot, input: packageDrift }).issues.some((entry) => entry.code === 'package-hash-mismatch'))

  const production = makeInput()
  assert.ok(validateEnterpriseArtifactSet({ root: fixtureRoot, input: production, production: true }).issues.some((entry) => entry.code === 'production-enterprise-packages-minimum'))
  console.log('PASS: enterprise artifact set locks one core artifact to isolated package manifests')
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true })
}
