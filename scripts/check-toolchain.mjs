// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const policy = JSON.parse(readFileSync(resolve(repoRoot, 'config/toolchain.json'), 'utf8'))

function npmVersionFromEnvironment() {
  const userAgent = process.env.npm_config_user_agent || ''
  return userAgent.match(/(?:^|\s)npm\/([^\s]+)/)?.[1] || 'unknown'
}

const actual = {
  node: process.versions.node,
  npm: npmVersionFromEnvironment()
}
const expected = policy.ci
const mismatches = Object.entries(expected)
  .filter(([name, version]) => actual[name] !== version)
  .map(([name, version]) => `${name} expected ${version}, received ${actual[name]}`)
const strict = process.argv.includes('--strict')

if (mismatches.length) {
  const prefix = strict ? '[fail]' : '[warn]'
  const output = strict ? console.error : console.warn
  output(`${prefix} non-canonical toolchain: ${mismatches.join('; ')}`)
  output(`${prefix} use Node ${expected.node} with npm ${expected.npm} for reproducible install and release evidence`)
  if (strict) process.exit(1)
} else {
  console.log(`[ok] canonical toolchain Node ${actual.node} / npm ${actual.npm}`)
}
