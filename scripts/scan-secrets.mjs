// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(import.meta.dirname, '..')
const defaultQuarantinePath = 'database/legacy-secret-quarantine.json'
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['OpenAI/Anthropic-style API key', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe live secret', /\bsk_live_[0-9A-Za-z]{20,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/]
]
const productionSurfaces = new Set([
  'docker-compose.prod.yml',
  'scripts/deploy-simple.sh',
  'scripts/deploy-pm2.sh'
])
const forbiddenProductionValues = /POSTGRES_PASSWORD:-|PGRST_JWT_SECRET:-|postgres123|your-secret-jwt-key|my_super_secret|nanpai\.eissys\.top/i

const credentialAssignmentPattern = /["']?(api[_-]?key|access[_-]?token|jwt[_-]?secret|client[_-]?secret)["']?\s*(?::=|=>|=|:)\s*(?:"([^"\r\n]*)"|'((?:''|[^'])*)'|([^\s,;}]+))/gi
const plpgsqlSecretPattern = /\b_secret\s+text\s*:=\s*'((?:''|[^'])+)'/gi
const passwordFallbackPattern = /\bcoalesce\s*\(\s*[^,)]*\bpassword\b[^,)]*,\s*'((?:''|[^'])+)'/gi
const passwordCopyPattern = /^\s*COPY\s+[^\r\n]*\([^\r\n)]*\bpassword\b[^\r\n)]*\)\s+FROM\s+stdin\s*;/i
const knownInsecureValues = [
  ['known insecure JWT signing value', ['my', 'super', 'secret'].join('_')]
]
const isDatabaseText = (path) => /(?:\.sql|\.psql|\.dump\.txt)$/i.test(path)

const isPlaceholder = (rawValue) => {
  const value = String(rawValue || '').trim().replace(/::[a-z_][a-z0-9_ ]*$/i, '')
  if (!value) return true
  if (/^(?:null|none|redacted|example|test|changeme|change-me|not-set)$/i.test(value)) return true
  if (/^(?:your|replace|example|test|dummy|placeholder)[_-]/i.test(value)) return true
  if (/^(?:\$\{[^}]+\}|\{\{[^}]+\}\}|<[^>]+>|__[^_]+__)$/i.test(value)) return true
  return false
}

const finding = (path, line, label) => ({ path, line, label })

export const scanTextLine = ({ path, line, lineNumber }) => {
  const findings = []
  const inspectDatabaseCredentialContext = isDatabaseText(path) || productionSurfaces.has(path)

  for (const [label, pattern] of patterns) {
    if (pattern.test(line)) findings.push(finding(path, lineNumber, label))
  }

  for (const match of inspectDatabaseCredentialContext ? line.matchAll(credentialAssignmentPattern) : []) {
    const quotedValue = match[2] ?? match[3]
    const unquotedValue = match[4] ?? ''
    const value = quotedValue ?? unquotedValue
    const literalValue = quotedValue !== undefined || /^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}$/.test(unquotedValue)
    if (literalValue && !isPlaceholder(value)) {
      findings.push(finding(path, lineNumber, `hard-coded ${match[1].toLowerCase()} credential`))
    }
  }

  for (const match of inspectDatabaseCredentialContext ? line.matchAll(plpgsqlSecretPattern) : []) {
    if (!isPlaceholder(match[1])) {
      findings.push(finding(path, lineNumber, 'hard-coded PL/pgSQL signing secret'))
    }
  }

  for (const match of inspectDatabaseCredentialContext ? line.matchAll(passwordFallbackPattern) : []) {
    if (!isPlaceholder(match[1])) {
      findings.push(finding(path, lineNumber, 'hard-coded SQL password fallback'))
    }
  }

  if (isDatabaseText(path) && passwordCopyPattern.test(line)) {
    findings.push(finding(path, lineNumber, 'password-bearing SQL table-data dump'))
  }

  for (const [label, value] of inspectDatabaseCredentialContext ? knownInsecureValues : []) {
    if (line.includes(value)) findings.push(finding(path, lineNumber, label))
  }

  if (productionSurfaces.has(path) && forbiddenProductionValues.test(line)) {
    findings.push(finding(path, lineNumber, 'forbidden production default or customer binding'))
  }

  return findings
}

export const formatFinding = ({ path, line, label }) => `- ${path}:${line} — ${label}`

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const loadQuarantine = (root, quarantinePath) => {
  const data = JSON.parse(readFileSync(resolve(root, quarantinePath), 'utf8'))
  if (data?.schemaVersion !== 1 || !Array.isArray(data.entries)) {
    throw new Error('legacy secret quarantine must use schemaVersion 1 and contain entries')
  }
  const entries = new Map()
  for (const entry of data.entries) {
    const path = String(entry?.path || '').replaceAll('\\', '/')
    const checksum = String(entry?.sha256 || '').toLowerCase()
    const labels = Array.isArray(entry?.findings) ? entry.findings.map(String) : []
    if (!path || !/^[0-9a-f]{64}$/.test(checksum) || labels.length === 0) {
      throw new Error(`invalid legacy secret quarantine entry: ${path || '<missing path>'}`)
    }
    if (entries.has(path)) throw new Error(`duplicate legacy secret quarantine path: ${path}`)
    entries.set(path, { ...entry, path, sha256: checksum, findings: labels })
  }
  return entries
}

export const scanRepository = ({
  root = repoRoot,
  quarantinePath = defaultQuarantinePath
} = {}) => {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  })
  const files = [...new Set(output.split('\0').filter(Boolean))].sort()
  const findings = []
  const hashes = new Map()
  let scanned = 0

  for (const path of files) {
    let buffer
    try {
      buffer = readFileSync(resolve(root, path))
    } catch {
      continue
    }
    if (buffer.subarray(0, 8192).includes(0)) continue
    hashes.set(path, sha256(buffer))
    scanned += 1
    const lines = buffer.toString('utf8').split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      findings.push(...scanTextLine({ path, line, lineNumber: index + 1 }))
    }
  }

  const quarantine = loadQuarantine(root, quarantinePath)
  const quarantinedFindings = []
  const activeFindings = []
  for (const item of findings) {
    const entry = quarantine.get(item.path)
    if (entry && hashes.get(item.path) === entry.sha256 && entry.findings.includes(item.label)) {
      quarantinedFindings.push(item)
    } else {
      activeFindings.push(item)
    }
  }

  for (const entry of quarantine.values()) {
    if (!hashes.has(entry.path)) {
      activeFindings.push(finding(entry.path, 1, 'legacy secret quarantine file is missing'))
      continue
    }
    if (hashes.get(entry.path) !== entry.sha256) {
      activeFindings.push(finding(entry.path, 1, 'legacy secret quarantine checksum drift'))
      continue
    }
    for (const label of entry.findings) {
      if (!quarantinedFindings.some((item) => item.path === entry.path && item.label === label)) {
        activeFindings.push(finding(entry.path, 1, `stale legacy secret quarantine declaration: ${label}`))
      }
    }
  }

  return { files, findings: activeFindings, quarantinedFindings, scanned }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const { findings, quarantinedFindings, scanned } = scanRepository()
  if (findings.length) {
    console.error(`[fail] secret scan found ${findings.length} potential issue(s); matched values are intentionally redacted`)
    for (const item of findings) console.error(formatFinding(item))
    process.exitCode = 1
  } else {
    console.log(`[ok] secret scan passed (${scanned} text files)`)
    if (quarantinedFindings.length) {
      console.log(`[warn] ${quarantinedFindings.length} finding(s) remain in checksum-locked legacy SQL quarantine`)
    }
  }
}
