// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const shellFiles = execFileSync('git', ['ls-files', '-z', '*.sh'], {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true
}).split('\0').filter((path) => path && existsSync(resolve(repoRoot, path)))

assert.equal(existsSync(resolve(repoRoot, 'scripts/setup_cline_code_server.sh')), false, 'retired Cline setup script must remain removed')

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
  POSTGREST_DB_PASSWORD: 'Api6_Qm9Xv4Rs2Lp8Nk5Wd7Hy3Tz1',
  AGENT_DB_PASSWORD: 'Agent4_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_PUBLIC_BASE_URL: 'https://erp.acme.test',
  EISCORE_HARNESS_ENABLED: 'true',
  EISCORE_HARNESS_URL: 'http://harness-bridge:3080',
  EISCORE_HARNESS_AUDIT_FILE: '/var/lib/eiscore/harness-audit.jsonl',
  EISCORE_HARNESS_AUDIT_HASH_KEY: 'HarnessAudit9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_HARNESS_BRIDGE_SECRET: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_TOOL_PROXY_SECRET: 'HarnessProxy9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  DSH_PROVIDER: 'deepseek-official',
  DSH_MODEL: 'deepseek-v4-flash',
  DEEPSEEK_API_KEY: 'isolated-compose-validation-placeholder'
}

const baselinePaths = [
  'database/baselines/eiscore-db-v1/schema.sql',
  'database/baselines/eiscore-db-v1/register.sql',
  'database/baselines/eiscore-db-v1/manifest.json'
]
for (const path of baselinePaths) {
  assert.ok(statSync(resolve(repoRoot, path)).isFile(), `database baseline input must be a regular file: ${path}`)
}
for (const composePath of ['docker-compose.yml', 'docker-compose.prod.yml']) {
  const composeSource = readFileSync(resolve(repoRoot, composePath), 'utf8')
  for (const marker of [
    './database/bootstrap/roles-v2.sql:/docker-entrypoint-initdb.d/00_roles.sql:ro',
    './database/baselines/eiscore-db-v1/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql:ro',
    './database/baselines/eiscore-db-v1/register.sql:/docker-entrypoint-initdb.d/02_register.sql:ro',
    './scripts/configure-database-runtime-secrets-v2.sh:/docker-entrypoint-initdb.d/04_runtime_secrets.sh:ro'
  ]) assert.ok(composeSource.includes(marker), `${composePath} lost baseline input: ${marker}`)
  assert.doesNotMatch(composeSource, /db_schema_and_data\.sql/, `${composePath} must not use the retired data dump`)
}

const runtimeSecretBootstrap = readFileSync(resolve(repoRoot, 'scripts/configure-database-runtime-secret.sh'), 'utf8')
assert.match(runtimeSecretBootstrap, /\\getenv jwt_secret PGRST_JWT_SECRET/)
assert.match(runtimeSecretBootstrap, /ALTER DATABASE %I SET app\.jwt_secret TO %L/)
assert.doesNotMatch(runtimeSecretBootstrap, /echo[^\n]*PGRST_JWT_SECRET/)

const runtimeSecretsV2Bootstrap = readFileSync(resolve(repoRoot, 'scripts/configure-database-runtime-secrets-v2.sh'), 'utf8')
assert.match(runtimeSecretsV2Bootstrap, /\\getenv postgrest_password POSTGREST_DB_PASSWORD/)
assert.match(runtimeSecretsV2Bootstrap, /\\getenv agent_password AGENT_DB_PASSWORD/)
assert.doesNotMatch(runtimeSecretsV2Bootstrap, /echo[^\n]*\$(?:POSTGREST_DB_PASSWORD|AGENT_DB_PASSWORD)/)

const validCompose = spawnSync('docker', ['compose', '-f', 'docker-compose.prod.yml', 'config', '--quiet'], {
  cwd: repoRoot,
  env: safeEnvironment,
  encoding: 'utf8',
  windowsHide: true
})
assert.equal(validCompose.status, 0, `production Compose rejected the valid contract:\n${validCompose.stderr || validCompose.stdout}`)

for (const missingKey of [
  'POSTGRES_PASSWORD',
  'PGRST_JWT_SECRET',
  'POSTGREST_DB_PASSWORD',
  'AGENT_DB_PASSWORD',
  'EISCORE_PUBLIC_BASE_URL',
  'EISCORE_HARNESS_BRIDGE_SECRET',
  'EISCORE_TOOL_PROXY_SECRET',
  'DEEPSEEK_API_KEY'
]) {
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
