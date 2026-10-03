// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const runtimeRoot = resolve(repoRoot, 'realtime')
const indexSource = readFileSync(resolve(runtimeRoot, 'index.js'), 'utf8')
const expectedBase = 'node:20.19.0-bookworm-slim@sha256:5cfa999422613d3b34f766cbb814d964cbfcb76aaf3607e805da21cccb352bac'
const rootDockerignore = readFileSync(resolve(repoRoot, '.dockerignore'), 'utf8')

assert.match(rootDockerignore, /^\*\*\/node_modules$/m, 'root .dockerignore must exclude dependency trees')
assert.match(rootDockerignore, /^\*\*\/dist$/m, 'root .dockerignore must exclude frontend build output')
for (const requiredInput of ['!realtime/', '!realtime/*.js', '!realtime/package.json', '!realtime/package-lock.json', '!agent-harness/', '!agent-harness/plugin-registry.js', '!agent-harness/audit-ledger.js', '!agent-harness/plugin-contract.v1.json', '!agent-harness/dsh-http-bridge.mjs', '!agent-harness/http-bridge.js']) {
  assert.match(rootDockerignore, new RegExp(`^${requiredInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `root .dockerignore must include ${requiredInput}`)
}

const localModules = [...indexSource.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)]
  .map((match) => match[1])

assert.ok(localModules.length >= 26, 'runtime composition-root module inventory unexpectedly shrank')
for (const requiredModule of ['harness-runtime']) {
  assert.ok(localModules.includes(requiredModule), `runtime composition root must include ${requiredModule}`)
}
for (const requiredModule of ['harness-gateway', 'harness-capability-http']) {
  assert.ok(existsSync(resolve(runtimeRoot, `${requiredModule}.js`)), `missing Harness runtime module: ${requiredModule}.js`)
}
for (const moduleName of localModules) {
  assert.ok(existsSync(resolve(runtimeRoot, `${moduleName}.js`)), `missing runtime module: ${moduleName}.js`)
}

for (const dockerfileName of ['Dockerfile', 'Dockerfile.prod']) {
  const source = readFileSync(resolve(runtimeRoot, dockerfileName), 'utf8')
  assert.match(source, new RegExp(`^FROM ${expectedBase.replaceAll('.', '\\.')}$`, 'm'))
  assert.match(source, /npm ci\b/)
  assert.match(source, /^COPY realtime\/\*\.js \.\/$/m)
  for (const dependency of ['plugin-registry.js', 'audit-ledger.js', 'plugin-contract.v1.json']) {
    assert.match(source, new RegExp('^COPY agent-harness/' + dependency.replace('.', '\\.'), 'm'), dockerfileName + ' must package ' + dependency)
  }
  assert.match(source, /^HEALTHCHECK\b/m)
  assert.doesNotMatch(source, /^COPY index\.js/m)
}

for (const [composePath, expected] of [
  ['docker-compose.yml', /context:\s*\.\s*\n\s*dockerfile:\s*realtime\/Dockerfile/],
  ['docker-compose.prod.yml', /context:\s*\.\s*\n\s*dockerfile:\s*realtime\/Dockerfile\.prod/],
  ['deploy/lundu/compose.yml', /build:\s*\{context:\s*\.\/source,\s*dockerfile:\s*realtime\/Dockerfile\.prod\}/]
]) {
  const composeSource = readFileSync(resolve(repoRoot, composePath), 'utf8')
  assert.match(composeSource, expected, composePath + ' must build from a context containing agent-harness')
}

for (const dockerignore of ['Dockerfile.dockerignore', 'Dockerfile.prod.dockerignore']) {
  const ignorePath = resolve(runtimeRoot, dockerignore)
  assert.ok(existsSync(ignorePath), dockerignore + ' must constrain the repository-root build context')
  const ignoreSource = readFileSync(ignorePath, 'utf8')
  assert.match(ignoreSource, /^realtime\/\*$/m, dockerignore + ' must exclude non-runtime realtime descendants')
  assert.match(ignoreSource, /^agent-harness\/\*$/m, dockerignore + ' must exclude non-runtime Harness descendants')
  assert.match(ignoreSource, /!agent-harness\/plugin-registry\.js/)
  assert.match(ignoreSource, /!realtime\/\*\.js/)
}
const harnessDockerfile = readFileSync(resolve(repoRoot, 'agent-harness/Dockerfile'), 'utf8')
for (const runtimeDependency of ['plugin-registry.js', 'plugin-contract.v1.json']) {
  assert.match(harnessDockerfile, new RegExp(`^COPY agent-harness/${runtimeDependency.replace('.', '\\.')} /opt/eiscore-harness/${runtimeDependency.replace('.', '\\.')}$`, 'm'), `Harness image must package ${runtimeDependency} beside its embedded Bridge entrypoint`)
  assert.match(harnessDockerfile, new RegExp(`^COPY agent-harness/${runtimeDependency.replace('.', '\\.')} /opt/${runtimeDependency.replace('.', '\\.')}$`, 'm'), `Harness image must package ${runtimeDependency} beside the Bridge entrypoint`)
}
const harnessCompose = readFileSync(resolve(repoRoot, 'deploy/lundu/compose.yml'), 'utf8')
for (const runtimeDependency of ['plugin-registry.js', 'plugin-contract.v1.json']) {
  assert.ok(harnessCompose.includes(`./source/agent-harness/${runtimeDependency}:/opt/${runtimeDependency}:ro`), `Lundu Compose must mount ${runtimeDependency} beside the Bridge entrypoint`)
}
const harnessDockerignore = readFileSync(resolve(repoRoot, 'agent-harness/Dockerfile.dockerignore'), 'utf8')
for (const requiredInput of ['!agent-harness/Dockerfile', '!agent-harness/package.json', '!agent-harness/package-lock.json', '!agent-harness/dsh-http-bridge.mjs', '!agent-harness/http-bridge.js', '!agent-harness/plugin-registry.js', '!agent-harness/plugin-contract.v1.json']) {
  assert.match(harnessDockerignore, new RegExp(`^${requiredInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `Harness image context must include ${requiredInput}`)
}

console.log(`PASS: runtime image contract (${localModules.length} composition-root modules, 2 Dockerfiles)`)
