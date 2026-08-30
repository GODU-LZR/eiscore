// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ESLint } from 'eslint'

const repoRoot = resolve(import.meta.dirname, '..')
const supportedExtensions = new Set(['.js', '.mjs', '.cjs', '.vue'])

function git(args, { optional = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', optional ? 'ignore' : 'pipe']
    })
  } catch (error) {
    if (optional) return ''
    throw error
  }
}

function nulPaths(output) {
  return String(output).split('\0').filter(Boolean)
}

function readBaseArg(args) {
  const inline = args.find((arg) => arg.startsWith('--base='))
  if (inline) return inline.slice('--base='.length)
  const index = args.indexOf('--base')
  if (index >= 0) return args[index + 1]
  return process.env.EISCORE_QUALITY_BASE || ''
}

function resolveBase(args) {
  const requested = readBaseArg(args).trim()
  if (requested && !/^0+$/.test(requested)) {
    if (!git(['cat-file', '-e', `${requested}^{commit}`], { optional: true }) && !hasCommit(requested)) {
      throw new Error(`Quality base commit is not available: ${requested}. Use a full Git checkout in CI.`)
    }
    return requested
  }
  return hasCommit('HEAD^') ? 'HEAD^' : ''
}

function hasCommit(ref) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}^{commit}`], {
      cwd: repoRoot,
      stdio: 'ignore',
      windowsHide: true
    })
    return true
  } catch {
    return false
  }
}

function collectChangedFiles(base) {
  const paths = new Set()
  if (base) {
    for (const path of nulPaths(git(['diff', '--name-only', '--diff-filter=ACMR', '-z', `${base}...HEAD`]))) paths.add(path)
  }
  for (const path of nulPaths(git(['diff', '--name-only', '--diff-filter=ACMR', '-z']))) paths.add(path)
  for (const path of nulPaths(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']))) paths.add(path)
  for (const path of nulPaths(git(['ls-files', '--others', '--exclude-standard', '-z']))) paths.add(path)

  return [...paths]
    .filter((path) => supportedExtensions.has(path.slice(path.lastIndexOf('.'))))
    .filter((path) => existsSync(resolve(repoRoot, path)))
    .sort()
}

const base = resolveBase(process.argv.slice(2))
const files = collectChangedFiles(base)

if (!files.length) {
  console.log(`[ok] no changed JavaScript or Vue files to lint${base ? ` since ${base}` : ''}`)
  process.exit(0)
}

console.log(`[info] linting ${files.length} changed JavaScript/Vue file(s)${base ? ` since ${base}` : ''}`)
const eslint = new ESLint({ cwd: repoRoot })
const results = await eslint.lintFiles(files)
const formatter = await eslint.loadFormatter('stylish')
const report = await formatter.format(results)
if (report.trim()) console.log(report.trimEnd())

const errors = results.reduce((total, result) => total + result.errorCount + result.fatalErrorCount, 0)
if (errors) {
  console.error(`[fail] changed-code lint found ${errors} error(s)`)
  process.exit(1)
}
console.log(`[ok] changed-code lint passed (${files.length} files)`)
