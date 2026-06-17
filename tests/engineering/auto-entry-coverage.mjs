// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoEntryTypes } from './auto-entry-types.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const toRepoPath = (value) => value.split(path.sep).join('/')
const abs = (repoPath) => path.join(repoRoot, repoPath)

function readText(repoPath) {
  return fs.readFileSync(abs(repoPath), 'utf8')
}

function fileExists(repoPath) {
  return fs.existsSync(abs(repoPath)) && fs.statSync(abs(repoPath)).isFile()
}

function findAutoEntryImplementations() {
  const realtimeDir = abs('realtime')
  return fs.readdirSync(realtimeDir)
    .filter((name) => /^document(?:-[a-z0-9]+)*-entry\.js$/i.test(name))
    .map((name) => toRepoPath(path.join('realtime', name)))
    .sort()
}

const packageJson = JSON.parse(readText('package.json'))
const packageScripts = packageJson.scripts || {}
const registeredImplementations = new Set()
const ids = new Set()

assert.ok(autoEntryTypes.length > 0, 'auto-entry registry must not be empty')

for (const entry of autoEntryTypes) {
  assert.ok(entry.id && /^[a-z0-9-]+$/.test(entry.id), `invalid auto-entry id: ${entry.id}`)
  assert.ok(!ids.has(entry.id), `duplicate auto-entry id: ${entry.id}`)
  ids.add(entry.id)

  assert.ok(entry.name, `${entry.id} must have a human-readable name`)
  assert.ok(Array.isArray(entry.implementationFiles) && entry.implementationFiles.length > 0, `${entry.id} must list implementation files`)
  for (const file of entry.implementationFiles) {
    assert.ok(fileExists(file), `${entry.id} implementation file is missing: ${file}`)
    registeredImplementations.add(file)
  }

  assert.ok(entry.offlineRegression?.script, `${entry.id} must declare an offline regression npm script`)
  assert.ok(packageScripts[entry.offlineRegression.script], `${entry.id} offline regression script is missing from package.json: ${entry.offlineRegression.script}`)
  assert.ok(entry.offlineRegression?.file, `${entry.id} must declare an offline regression file`)
  assert.ok(fileExists(entry.offlineRegression.file), `${entry.id} offline regression file is missing: ${entry.offlineRegression.file}`)

  assert.equal(entry.businessChain?.required, true, `${entry.id} must require a business-chain test`)
  assert.ok(entry.businessChain.suite, `${entry.id} must declare a business-chain suite`)
  assert.ok(fileExists(entry.businessChain.suite), `${entry.id} business-chain suite is missing: ${entry.businessChain.suite}`)
  assert.ok(entry.businessChain.marker, `${entry.id} must declare a business-chain marker`)
  const suiteText = readText(entry.businessChain.suite)
  assert.ok(
    suiteText.includes(entry.businessChain.marker),
    `${entry.id} business-chain marker is missing from ${entry.businessChain.suite}: ${entry.businessChain.marker}`
  )
}

const unregisteredImplementations = findAutoEntryImplementations()
  .filter((file) => !registeredImplementations.has(file))

assert.deepEqual(
  unregisteredImplementations,
  [],
  `auto-entry implementation files must be registered in tests/engineering/auto-entry-types.mjs: ${unregisteredImplementations.join(', ')}`
)

console.log(`PASS: auto-entry coverage contract (${autoEntryTypes.length} types)`)
