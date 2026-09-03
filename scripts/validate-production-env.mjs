// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLACEHOLDER_PATTERN = /change[_-]?me|replace[_-]?me|example\.com|postgres123|your-secret|my_super_secret/i
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/

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

  if (issues.length) throw new ProductionEnvValidationError(issues)
  return {
    publicBaseUrl: values.EISCORE_PUBLIC_BASE_URL,
    aiConfigured: Boolean(values.ANTHROPIC_API_KEY || values.CLINE_OPENAI_API_KEY)
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
    console.log(`[info] AI credentials configured: ${summary.aiConfigured ? 'yes' : 'no'}`)
  } catch (error) {
    console.error(`[fail] ${error.message}`)
    for (const issue of error.issues || []) console.error(`- ${issue}`)
    process.exit(1)
  }
}
