// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLACEHOLDER_PATTERN = /change[_-]?me|replace[_-]?me|example\.com|postgres123|your-secret|my_super_secret/i
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/

// These variables belong to the retired direct-model/Cline/fallback path.
// Reject non-empty values before Compose can inject them through env_file.
const RETIRED_RUNTIME_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'AI_HTTP_PROXY_URL',
  'CLINE_OPENAI_BASE_URL',
  'CLINE_OPENAI_API_KEY',
  'CLINE_OPENAI_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'DEEPSEEK_API_KEY',
  'AI_API_KEY',
  'AI_BASE_URL',
  'EISCORE_HARNESS_FALLBACK',
  'EISCORE_HARNESS_SHADOW',
  'EISCORE_HARNESS_TWIN_SHADOW',
  'EISCORE_HARNESS_SITE_SALES_SHADOW'
]

export class ProductionEnvValidationError extends Error {
  constructor(issues) {
    super(`Production environment validation failed with ${issues.length} issue(s).`)
    this.name = 'ProductionEnvValidationError'
    this.issues = issues
  }
}

export function parseEnvFile(source) {
  const values = {}
  const seen = new Set()
  const issues = []

  for (const [index, rawLine] of String(source).replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) {
      issues.push(`line ${index + 1}: expected KEY=VALUE`)
      continue
    }

    const [, key, rawValue] = match
    if (seen.has(key)) {
      issues.push(`line ${index + 1}: duplicate variable ${key}`)
      continue
    }
    seen.add(key)

    let value = rawValue.trim()
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }

  if (issues.length) throw new ProductionEnvValidationError(issues)
  return values
}

export function readProductionEnvFile(filePath) {
  return parseEnvFile(readFileSync(resolve(filePath), 'utf8'))
}

export function validateProductionEnv(values) {
  const issues = []
  for (const key of RETIRED_RUNTIME_ENV_KEYS) {
    if (String(values?.[key] ?? '').trim()) issues.push(`legacy model configuration is not allowed: ${key}`)
  }
  validateSecret(values, 'POSTGRES_PASSWORD', 24, issues)
  validateSecret(values, 'PGRST_JWT_SECRET', 32, issues)
  validateSecret(values, 'POSTGREST_DB_PASSWORD', 24, issues)
  validateSecret(values, 'AGENT_DB_PASSWORD', 24, issues)
  const databaseSecrets = ['POSTGRES_PASSWORD', 'POSTGREST_DB_PASSWORD', 'AGENT_DB_PASSWORD']
  const configuredDatabaseSecrets = databaseSecrets.map((key) => String(values?.[key] || '')).filter(Boolean)
  if (configuredDatabaseSecrets.length === databaseSecrets.length && new Set(configuredDatabaseSecrets).size !== configuredDatabaseSecrets.length) {
    issues.push('database role passwords must be independent')
  }
  validatePublicBaseUrl(values.EISCORE_PUBLIC_BASE_URL, issues)
  if (String(values.EISCORE_HARNESS_ENABLED || '').toLowerCase() !== 'true') {
    issues.push('EISCORE_HARNESS_ENABLED: must be true for production')
  }
  validateHarnessUrl(values.EISCORE_HARNESS_URL, issues)
  const auditFile = String(values.EISCORE_HARNESS_AUDIT_FILE || '')
  if (!auditFile || !auditFile.startsWith('/')) issues.push('EISCORE_HARNESS_AUDIT_FILE: absolute path is required')
  validateSecret(values, 'EISCORE_HARNESS_AUDIT_HASH_KEY', 32, issues)
  validateSecret(values, 'EISCORE_HARNESS_BRIDGE_SECRET', 32, issues)
  validateSecret(values, 'EISCORE_TOOL_PROXY_SECRET', 32, issues)
  const bridgeSecret = String(values?.EISCORE_HARNESS_BRIDGE_SECRET || '')
  const toolProxySecret = String(values?.EISCORE_TOOL_PROXY_SECRET || '')
  if (bridgeSecret && toolProxySecret && bridgeSecret === toolProxySecret) {
    issues.push('Harness bridge and tool proxy secrets must be independent')
  }
  for (const key of ['BRIDGE_PROMPT_TIMEOUT_MS', 'BRIDGE_SESSION_DRAIN_TIMEOUT_MS', 'BRIDGE_RPC_TIMEOUT_MS', 'BRIDGE_SHUTDOWN_TIMEOUT_MS']) {
    validatePositiveInteger(values, key, issues)
  }
  validateDshIdentifier(values, 'DSH_PROVIDER', issues)
  validateDshIdentifier(values, 'DSH_MODEL', issues)

  if (issues.length) throw new ProductionEnvValidationError(issues)
  return {
    publicBaseUrl: values.EISCORE_PUBLIC_BASE_URL,
    harnessConfigured: true
  }
}

function validateDshIdentifier(values, key, issues) {
  const value = String(values?.[key] || '')
  if (!value) {
    issues.push(`${key}: required`)
    return
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(value)) issues.push(`${key}: invalid identifier`)
}

function validatePositiveInteger(values, key, issues) {
  const value = String(values?.[key] ?? '')
  if (!value) return
  if (!/^[1-9][0-9]*$/.test(value) || Number(value) > 2_147_483_647) {
    issues.push(`${key}: must be a positive integer no greater than 2147483647 when provided`)
  }
}

function validateSecret(values, key, minimumLength, issues) {
  const value = String(values?.[key] || '')
  if (!value) {
    issues.push(`${key}: required`)
    return
  }
  if (PLACEHOLDER_PATTERN.test(value)) issues.push(`${key}: placeholder or known weak value is not allowed`)
  if (value.length < minimumLength) issues.push(`${key}: must contain at least ${minimumLength} characters`)
  if (!BASE64URL_PATTERN.test(value)) issues.push(`${key}: use Base64URL characters only (A-Z, a-z, 0-9, _ and -)`)
  if (new Set(value).size < 10) issues.push(`${key}: does not contain enough character variety`)
}

function validatePublicBaseUrl(rawValue, issues) {
  const value = String(rawValue || '')
  if (!value) {
    issues.push('EISCORE_PUBLIC_BASE_URL: required')
    return
  }
  if (PLACEHOLDER_PATTERN.test(value)) issues.push('EISCORE_PUBLIC_BASE_URL: placeholder host is not allowed')
  if (value.endsWith('/')) issues.push('EISCORE_PUBLIC_BASE_URL: trailing slash is not allowed')

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') issues.push('EISCORE_PUBLIC_BASE_URL: HTTPS is required')
    if (url.username || url.password) issues.push('EISCORE_PUBLIC_BASE_URL: credentials are not allowed')
    if (url.pathname !== '/' || url.search || url.hash) issues.push('EISCORE_PUBLIC_BASE_URL: use an origin without path, query, or fragment')
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) issues.push('EISCORE_PUBLIC_BASE_URL: localhost is not a production origin')
  } catch {
    issues.push('EISCORE_PUBLIC_BASE_URL: invalid URL')
  }
}

function validateHarnessUrl(rawValue, issues) {
  const value = String(rawValue || '')
  if (!value) {
    issues.push('EISCORE_HARNESS_URL: required')
    return
  }
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) issues.push('EISCORE_HARNESS_URL: HTTP(S) is required')
    if (url.username || url.password) issues.push('EISCORE_HARNESS_URL: credentials are not allowed')
    if (url.pathname !== '/' || url.search || url.hash) issues.push('EISCORE_HARNESS_URL: use an origin without path, query, or fragment')
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) issues.push('EISCORE_HARNESS_URL: loopback is not a production bridge origin')
    if (url.hostname.toLowerCase() === 'deepseek-web') {
      issues.push('EISCORE_HARNESS_URL: deepseek-web is the Harness Web UI, not the HTTP-to-SDK bridge')
    }
  } catch {
    issues.push('EISCORE_HARNESS_URL: invalid URL')
  }
}

function parseArgs(args) {
  const inline = args.find((arg) => arg.startsWith('--env-file='))
  if (inline) return inline.slice('--env-file='.length)
  const index = args.indexOf('--env-file')
  return index >= 0 ? args[index + 1] : 'env/.env'
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const envFile = parseArgs(process.argv.slice(2))
  if (!envFile) {
    console.error('[fail] --env-file requires a path')
    process.exit(2)
  }

  try {
    const summary = validateProductionEnv(readProductionEnvFile(envFile))
    console.log(`[ok] production environment is valid for ${summary.publicBaseUrl}`)
    console.log(`[info] DeepSeek Harness configured: ${summary.harnessConfigured ? 'yes' : 'no'}`)
  } catch (error) {
    console.error(`[fail] ${error.message}`)
    for (const issue of error.issues || []) console.error(`- ${issue}`)
    process.exit(1)
  }
}
