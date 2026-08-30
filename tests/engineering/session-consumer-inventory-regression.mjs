// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const productRoots = readdirSync(repoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('eiscore-'))
  .map((entry) => resolve(repoRoot, entry.name, 'src'))
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

const inventory = productRoots.flatMap(collectSources).flatMap((file) => {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(directSessionPattern)].map(() => relative(repoRoot, file).replaceAll('\\', '/'))
})
const affectedFiles = new Set(inventory)

assert.ok(inventory.length > 0, 'remove this bounded inventory after all direct session consumers are migrated')
assert.ok(inventory.length <= 118, `direct session calls increased: ${inventory.length} > 118`)
assert.ok(affectedFiles.size <= 48, `direct session files increased: ${affectedFiles.size} > 48`)

console.log(`PASS: bounded direct session inventory (${inventory.length} calls in ${affectedFiles.size} files)`)
