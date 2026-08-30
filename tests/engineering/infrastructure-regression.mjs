// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const shellFiles = execFileSync('git', ['ls-files', '-z', '*.sh'], {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true
}).split('\0').filter(Boolean)

assert.ok(shellFiles.length > 0, 'repository should expose tracked shell scripts')
for (const path of shellFiles) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8')
  assert.doesNotMatch(source, /\r\n/, `${path} must use LF line endings`)
  const result = spawnSync('bash', ['-n', path], { cwd: repoRoot, encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, `${path} failed bash syntax validation:\n${result.stderr || result.stdout}`)
}

const safeEnvironment = {
  ...process.env,
  POSTGRES_PASSWORD: 'Db9_Nx2pL7vQ4sK8mT5wY1cR6aH3',
  PGRST_JWT_SECRET: 'Jwt8_Zp3Lm7Qx2Vc9Bn5Ks1Hd6Rt4Wy0Fa',
  EISCORE_PUBLIC_BASE_URL: 'https://erp.acme.test'
}
const validCompose = spawnSync('docker', ['compose', '-f', 'docker-compose.prod.yml', 'config', '--quiet'], {
  cwd: repoRoot,
  env: safeEnvironment,
  encoding: 'utf8',
  windowsHide: true
})
assert.equal(validCompose.status, 0, `production Compose rejected the valid contract:\n${validCompose.stderr || validCompose.stdout}`)

for (const missingKey of ['POSTGRES_PASSWORD', 'PGRST_JWT_SECRET', 'EISCORE_PUBLIC_BASE_URL']) {
  const missingEnvironment = { ...safeEnvironment }
  delete missingEnvironment[missingKey]
  const invalidCompose = spawnSync('docker', ['compose', '-f', 'docker-compose.prod.yml', 'config', '--quiet'], {
    cwd: repoRoot,
    env: missingEnvironment,
    encoding: 'utf8',
    windowsHide: true
  })
  assert.notEqual(invalidCompose.status, 0, `production Compose should reject missing ${missingKey}`)
  assert.match(`${invalidCompose.stdout}\n${invalidCompose.stderr}`, new RegExp(`${missingKey} is required`))
}

console.log(`PASS: infrastructure regression (${shellFiles.length} shell scripts and production Compose)`)
