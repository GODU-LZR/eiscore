// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue'])
const routerCallPattern = /\brouter\.(?:push|replace)\s*\(/g
const directLocationMethodPattern = /\b(?:window\.)?location\.(?:assign|replace)\s*\(/
const childFullModuleRoutePattern = /\brouter\.(?:push|replace)\s*\(\s*(['"`])\/(?:apps|decision|equipment|hr|materials|mobile|production|purchase|quality|sales)\/[^'"`\r\n]*\1/

const walk = (directory, files = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) walk(path, files)
    else if (sourceExtensions.has(extname(entry.name))) files.push(path)
  }
  return files
}

const applicationRoots = readdirSync(repoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^eiscore-/.test(entry.name))
  .map((entry) => resolve(repoRoot, entry.name, 'src'))
const sourceFiles = applicationRoots.flatMap((root) => walk(root))
sourceFiles.push(...walk(resolve(repoRoot, 'shared')))

let routerCallCount = 0
const routerFiles = []
const directLocationMethods = []
const childFullModuleRoutes = []
for (const path of sourceFiles) {
  const source = readFileSync(path, 'utf8')
  const repoPath = relative(repoRoot, path).replaceAll('\\', '/')
  const calls = [...source.matchAll(routerCallPattern)].length
  if (calls) {
    routerFiles.push(repoPath)
    routerCallCount += calls
  }
  if (directLocationMethodPattern.test(source)) directLocationMethods.push(repoPath)
  if (!repoPath.startsWith('eiscore-base/') && childFullModuleRoutePattern.test(source)) {
    childFullModuleRoutes.push(repoPath)
  }
}

assert.equal(routerFiles.length, 61)
assert.equal(routerCallCount, 123)
assert.deepEqual(directLocationMethods, [])
assert.deepEqual(childFullModuleRoutes, [])

const runtimePath = resolve(repoRoot, 'eiscore-apps/src/views/AppRuntime.vue')
const runtimeSource = readFileSync(runtimePath, 'utf8')
assert.match(runtimeSource, /isEnterpriseHostRuntime,\s*\n\s*navigateEnterprisePath/)
assert.match(runtimeSource, /function navigateCrossMicroPath[\s\S]*navigateEnterprisePath\(href,/)
assert.match(runtimeSource, /function openInHostTab[\s\S]*navigateEnterprisePath\(href,/)
assert.doesNotMatch(runtimeSource, /window\.postMessage|new CustomEvent\(['"]eis:open-host-tab|window\.location\.assign/)
assert.match(runtimeSource, /result\.reason === ['"]module-disabled['"]/)

const baseRouterSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/router/index.js'), 'utf8')
assert.match(baseRouterSource, /resolveEnterpriseNavigation\(/)
assert.match(baseRouterSource, /enterpriseNavigation\.type === ['"]redirect['"]/)
assert.match(baseRouterSource, /module_unavailable:\s*enterpriseNavigation\.moduleId/)

console.log('PASS: dynamic router boundary audit (61 files/123 calls, no child full-module literals or direct location methods)')
