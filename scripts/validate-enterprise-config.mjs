// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EnterpriseConfigError, parseEnterpriseConfig } from '../packages/eiscore-platform/src/enterprise-config.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const paths = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const targets = paths.length ? paths : ['config/enterprise.example.json']
let failed = false

for (const path of targets) {
  const absolutePath = resolve(repoRoot, path)
  try {
    const input = JSON.parse(readFileSync(absolutePath, 'utf8'))
    const config = parseEnterpriseConfig(input, { source: path })
    const enabledModules = Object.values(config.modules).filter(Boolean).length
    console.log(`[ok] ${path}: ${config.enterprise.id}, ${enabledModules} module(s) enabled`)
  } catch (error) {
    failed = true
    if (error instanceof EnterpriseConfigError) {
      console.error(`[fail] ${path}: ${error.issues.map((issue) => `${issue.path} (${issue.code})`).join('; ')}`)
    } else {
      console.error(`[fail] ${path}: unreadable or invalid JSON`)
    }
  }
}

if (failed) process.exit(1)
