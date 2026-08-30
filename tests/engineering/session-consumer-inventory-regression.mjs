// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const productRoots = readdirSync(repoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('eiscore-'))
  .map((entry) => resolve(repoRoot, entry.name, 'src'))
const runtimeRoots = [...productRoots, resolve(repoRoot, 'shared')]
const sourceExtensions = new Set(['.js', '.vue'])
const directSessionPattern = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/g

function collectSources(root) {
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) files.push(path)
    }
  }
  visit(root)
  return files
}

const inventory = runtimeRoots.flatMap(collectSources).flatMap((file) => {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(directSessionPattern)].map(() => relative(repoRoot, file).replaceAll('\\', '/'))
})
assert.equal(inventory.length, 0, `direct session storage is forbidden:\n${inventory.join('\n')}`)

console.log('PASS: direct session consumer inventory is empty')
