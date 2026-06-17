// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const nodeBin = process.execPath
const scanDirs = ['scripts', 'tests']
const explicitFiles = ['playwright.config.mjs', 'realtime/index.js', 'realtime/document-intake.js', 'realtime/document-parser.js', 'realtime/document-planner.js', 'realtime/document-entry.js', 'realtime/document-fixed-entry.js']
const allowedExtensions = new Set(['.mjs', '.cjs'])

function extensionOf(filePath) {
  const index = filePath.lastIndexOf('.')
  return index >= 0 ? filePath.slice(index) : ''
}

function collectNodeScripts(dir) {
  const root = resolve(repoRoot, dir)
  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.artifacts') continue
        visit(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      if (allowedExtensions.has(extensionOf(entry.name))) files.push(fullPath)
    }
  }
  visit(root)
  return files
}

const files = [
  ...scanDirs.flatMap(collectNodeScripts),
  ...explicitFiles.map((file) => resolve(repoRoot, file)).filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile())
]

const uniqueFiles = Array.from(new Set(files)).sort((a, b) => relative(repoRoot, a).localeCompare(relative(repoRoot, b)))
const failures = []

for (const file of uniqueFiles) {
  const rel = relative(repoRoot, file)
  const result = spawnSync(nodeBin, ['--check', file], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false
  })
  if (result.status !== 0) {
    failures.push({
      file: rel,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    })
  }
}

if (failures.length) {
  console.error(`FAIL: ${failures.length}/${uniqueFiles.length} Node script syntax checks failed`)
  for (const failure of failures) {
    console.error(`\n--- ${failure.file} ---`)
    console.error(failure.output || '(no output)')
  }
  process.exit(1)
}

console.log(`PASS: Node script syntax checks (${uniqueFiles.length} files)`)
