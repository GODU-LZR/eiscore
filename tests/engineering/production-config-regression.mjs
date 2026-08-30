// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ProductionEnvValidationError,
  parseEnvFile,
  validateProductionEnv
} from '../../scripts/validate-production-env.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const compose = read('docker-compose.prod.yml')
const template = read('env/.env.example')
const deployScripts = [read('scripts/deploy-simple.sh'), read('scripts/deploy-pm2.sh')]

assert.doesNotMatch(compose, /POSTGRES_PASSWORD:-/, 'production Compose must not provide a database password fallback')
assert.doesNotMatch(compose, /PGRST_JWT_SECRET:-/, 'production Compose must not provide a JWT secret fallback')
assert.doesNotMatch(compose, /nanpai\.eissys\.top/i, 'production Compose must not hardcode a customer domain')
assert.match(compose, /\$\{POSTGRES_PASSWORD:\?POSTGRES_PASSWORD is required\}/, 'production Compose should require the database password')
assert.match(compose, /\$\{PGRST_JWT_SECRET:\?PGRST_JWT_SECRET is required\}/, 'production Compose should require the JWT secret')
assert.match(compose, /\$\{EISCORE_PUBLIC_BASE_URL:\?EISCORE_PUBLIC_BASE_URL is required\}\/api/, 'production Compose should derive the API origin from enterprise configuration')
assert.equal((compose.match(/required: false/g) || []).length, 3, 'service env files should be optional when variables are supplied by the deployment environment')

assert.match(template, /^POSTGRES_PASSWORD=replace_me_/m, 'environment template should expose the database password contract')
assert.match(template, /^PGRST_JWT_SECRET=replace_me_/m, 'environment template should expose the JWT contract')
assert.match(template, /^EISCORE_PUBLIC_BASE_URL=https:\/\//m, 'environment template should expose the public origin contract')
assert.throws(
  () => validateProductionEnv(parseEnvFile(template)),
  ProductionEnvValidationError,
  'the example template must not be deployable without replacing placeholders'
)

for (const source of deployScripts) {
  assert.doesNotMatch(source, /postgres123|your-secret-jwt-key/i, 'deploy scripts must not inject known weak secrets')
  assert.match(source, /validate-production-env\.mjs --env-file/, 'deploy scripts should block invalid production configuration')
  assert.match(source, /docker compose --env-file|docker-compose --env-file/, 'deploy scripts should pass the validated env file to Compose')
}

const valid = {
  POSTGRES_PASSWORD: 'Db9_Nx2pL7vQ4sK8mT5wY1cR6aH3',
  PGRST_JWT_SECRET: 'Jwt8_Zp3Lm7Qx2Vc9Bn5Ks1Hd6Rt4Wy0Fa',
  EISCORE_PUBLIC_BASE_URL: 'https://erp.acme.test',
  ANTHROPIC_API_KEY: ''
}
assert.deepEqual(validateProductionEnv(valid), {
  publicBaseUrl: valid.EISCORE_PUBLIC_BASE_URL,
  aiConfigured: false
})

for (const [name, value] of [
  ['missing values', {}],
  ['known weak password', { ...valid, POSTGRES_PASSWORD: 'postgres123' }],
  ['short JWT secret', { ...valid, PGRST_JWT_SECRET: 'too-short' }],
  ['customer placeholder URL', { ...valid, EISCORE_PUBLIC_BASE_URL: 'https://erp.example.com' }],
  ['non-HTTPS URL', { ...valid, EISCORE_PUBLIC_BASE_URL: 'http://erp.acme.test' }],
  ['URL with path', { ...valid, EISCORE_PUBLIC_BASE_URL: 'https://erp.acme.test/eiscore' }]
]) {
  assert.throws(() => validateProductionEnv(value), ProductionEnvValidationError, `${name} should fail validation`)
}

assert.deepEqual(parseEnvFile('A=one\nexport B="two"\nC=\'three\'\n'), { A: 'one', B: 'two', C: 'three' })
assert.throws(() => parseEnvFile('A=one\nA=two\n'), ProductionEnvValidationError, 'duplicate variables should fail')

console.log('PASS: production configuration security regression')
