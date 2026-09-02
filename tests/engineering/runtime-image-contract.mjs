// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const runtimeRoot = resolve(repoRoot, 'realtime')
const indexSource = readFileSync(resolve(runtimeRoot, 'index.js'), 'utf8')
const expectedBase = 'node:20.19.0-bookworm-slim@sha256:5cfa999422613d3b34f766cbb814d964cbfcb76aaf3607e805da21cccb352bac'

const localModules = [...indexSource.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)]
  .map((match) => match[1])

assert.ok(localModules.length >= 28, 'runtime composition-root module inventory unexpectedly shrank')
for (const moduleName of localModules) {
  assert.ok(existsSync(resolve(runtimeRoot, `${moduleName}.js`)), `missing runtime module: ${moduleName}.js`)
}

for (const dockerfileName of ['Dockerfile', 'Dockerfile.prod']) {
  const source = readFileSync(resolve(runtimeRoot, dockerfileName), 'utf8')
  assert.match(source, new RegExp(`^FROM ${expectedBase.replaceAll('.', '\\.')}$`, 'm'))
  assert.match(source, /npm ci\b/)
  assert.match(source, /^COPY \*\.js \.\/$/m)
  assert.match(source, /^HEALTHCHECK\b/m)
  assert.doesNotMatch(source, /^COPY index\.js/m)
}

console.log(`PASS: runtime image contract (${localModules.length} composition-root modules, 2 Dockerfiles)`)
