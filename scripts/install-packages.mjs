// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { selectPackages } from './eiscore-packages.mjs'

const groupArg = process.argv.find((arg) => arg.startsWith('--group='))
const groupFlagIndex = process.argv.indexOf('--group')
const group = groupArg
  ? groupArg.split('=')[1]
  : groupFlagIndex >= 0
    ? process.argv[groupFlagIndex + 1]
    : 'ci'
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const selected = selectPackages(group)

if (selected.length === 0) {
  console.error(`No packages matched group "${group}".`)
  process.exit(2)
}

for (const pkg of selected) {
  const lockPath = join(pkg.path, 'package-lock.json')
  const packageJsonPath = join(pkg.path, 'package.json')
  if (!existsSync(packageJsonPath)) {
    console.warn(`[skip] ${pkg.name}: missing package.json`)
    continue
  }

  const command = existsSync(lockPath) ? 'ci' : 'install'
  console.log(`\n===== ${pkg.name}: npm ${command} =====`)
  const result = spawnSync(npmBin, ['--prefix', pkg.path, command], {
    stdio: 'inherit',
    shell: false
  })

  if (result.status !== 0) {
    console.error(`\n[fail] ${pkg.name}: npm ${command}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`\n[ok] dependencies installed for ${selected.length} package(s).`)
