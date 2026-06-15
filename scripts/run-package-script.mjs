// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { packages, selectPackages } from './eiscore-packages.mjs'

const scriptName = process.argv[2]
const groupArg = process.argv.find((arg) => arg.startsWith('--group='))
const groupFlagIndex = process.argv.indexOf('--group')
const group = groupArg
  ? groupArg.split('=')[1]
  : groupFlagIndex >= 0
    ? process.argv[groupFlagIndex + 1]
    : 'all'

if (!scriptName) {
  console.error('Usage: node scripts/run-package-script.mjs <script> [--group=frontends|runtime|ci|all]')
  process.exit(2)
}

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const selected = selectPackages(group)

if (selected.length === 0) {
  console.error(`No packages matched group "${group}". Known groups: frontends, runtime, ci, all`)
  process.exit(2)
}

let ran = 0

for (const pkg of selected) {
  const packageJsonPath = join(pkg.path, 'package.json')
  if (!existsSync(packageJsonPath)) {
    console.warn(`[skip] ${pkg.name}: missing package.json`)
    continue
  }

  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  if (!manifest.scripts?.[scriptName]) {
    console.warn(`[skip] ${pkg.name}: no "${scriptName}" script`)
    continue
  }

  ran += 1
  console.log(`\n===== ${pkg.name}: npm run ${scriptName} =====`)
  const result = spawnSync(npmBin, ['--prefix', pkg.path, 'run', scriptName], {
    stdio: 'inherit',
    shell: false
  })

  if (result.status !== 0) {
    console.error(`\n[fail] ${pkg.name}: npm run ${scriptName}`)
    process.exit(result.status ?? 1)
  }
}

if (ran === 0) {
  const names = selected.map((pkg) => pkg.name).join(', ')
  console.error(`No packages in group "${group}" expose script "${scriptName}". Selected: ${names || '(none)'}`)
  process.exit(1)
}

console.log(`\n[ok] npm run ${scriptName} completed for ${ran} package(s).`)

// Keep an explicit reference so tree-shaking or future edits do not hide all package names in logs.
void packages
