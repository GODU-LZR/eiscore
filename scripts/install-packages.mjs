// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { selectPackages } from './eiscore-packages.mjs'

export function installCommandFor(group, hasLock) {
  if (hasLock) return 'ci'
  if (group === 'ci') throw new Error('CI installation requires package-lock.json')
  return 'install'
}

function main() {
  const groupArg = process.argv.find((arg) => arg.startsWith('--group='))
  const groupFlagIndex = process.argv.indexOf('--group')
  const group = groupArg
    ? groupArg.split('=')[1]
    : groupFlagIndex >= 0
      ? process.argv[groupFlagIndex + 1]
      : 'ci'
  const npmExecPath = process.env.npm_execpath
  const npmBin = npmExecPath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
  const npmArgsPrefix = npmExecPath ? [npmExecPath] : []
  const selected = selectPackages(group)

  if (selected.length === 0) {
    console.error(`No packages matched group "${group}".`)
    process.exit(2)
  }

  for (const pkg of selected) {
    const lockPath = join(pkg.path, 'package-lock.json')
    const packageJsonPath = join(pkg.path, 'package.json')
    if (!existsSync(packageJsonPath)) {
      if (group === 'ci') {
        console.error(`[fail] ${pkg.name}: CI installation requires package.json`)
        process.exit(1)
      }
      console.warn(`[skip] ${pkg.name}: missing package.json`)
      continue
    }

    let command
    try {
      command = installCommandFor(group, existsSync(lockPath))
    } catch (error) {
      console.error(`[fail] ${pkg.name}: ${error.message}`)
      process.exit(1)
    }

    console.log(`\n===== ${pkg.name}: npm ${command} =====`)
    const result = spawnSync(npmBin, [...npmArgsPrefix, '--prefix', pkg.path, command], {
      stdio: 'inherit',
      shell: process.platform === 'win32' && !npmExecPath
    })

    if (result.status !== 0) {
      if (result.error) {
        console.error(`[error] ${result.error.message}`)
      }
      console.error(`\n[fail] ${pkg.name}: npm ${command}`)
      process.exit(result.status ?? 1)
    }
  }

  console.log(`\n[ok] dependencies installed for ${selected.length} package(s).`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
