// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installCommandFor } from '../../scripts/install-packages.mjs'
import { selectPackages } from '../../scripts/eiscore-packages.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const readText = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const readJson = (path) => JSON.parse(readText(path))
const policy = readJson('config/toolchain.json')
const rootPackage = readJson('package.json')
const workflow = readText('.github/workflows/ci.yml')

assert.match(policy.ci.node, /^\d+\.\d+\.\d+$/)
assert.match(policy.ci.npm, /^\d+\.\d+\.\d+$/)
assert.equal(readText('.nvmrc').trim(), policy.ci.node)
assert.equal(readText('.node-version').trim(), policy.ci.node)
assert.equal(rootPackage.packageManager, `npm@${policy.ci.npm}`)
assert.match(workflow, new RegExp(`node-version: ['\"]${policy.ci.node.replaceAll('.', '\\.')}['\"]`))
assert.match(workflow, /npm run toolchain:check -- --strict/)

const ciPackages = selectPackages('ci')
assert.equal(ciPackages.length, 15, 'CI package inventory should remain explicit')
for (const pkg of ciPackages) {
  const manifestPath = resolve(repoRoot, pkg.path, 'package.json')
  const lockPath = resolve(repoRoot, pkg.path, 'package-lock.json')
  assert.ok(existsSync(manifestPath), `${pkg.name} must provide package.json`)
  assert.ok(existsSync(lockPath), `${pkg.name} must provide package-lock.json`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  assert.equal(lock.lockfileVersion, policy.lockfileVersion, `${pkg.name} lockfile version drifted`)
  assert.equal(lock.name, manifest.name, `${pkg.name} lockfile identity drifted`)
}

assert.equal(installCommandFor('ci', true), 'ci')
assert.throws(() => installCommandFor('ci', false), /requires package-lock\.json/)
assert.equal(installCommandFor('local', false), 'install')

console.log(`PASS: toolchain contract (${ciPackages.length} locked CI packages)`)
