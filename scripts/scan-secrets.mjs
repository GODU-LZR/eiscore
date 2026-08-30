// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
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

const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true
})
const files = [...new Set(output.split('\0').filter(Boolean))].sort()
const findings = []
let scanned = 0

for (const path of files) {
  let buffer
  try {
    buffer = readFileSync(resolve(repoRoot, path))
  } catch {
    continue
  }
  if (buffer.subarray(0, 8192).includes(0)) continue
  scanned += 1
  const lines = buffer.toString('utf8').split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    for (const [label, pattern] of patterns) {
      if (pattern.test(line)) findings.push({ path, line: index + 1, label })
    }
    if (productionSurfaces.has(path) && forbiddenProductionValues.test(line)) {
      findings.push({ path, line: index + 1, label: 'forbidden production default or customer binding' })
    }
  }
}

if (findings.length) {
  console.error(`[fail] secret scan found ${findings.length} potential issue(s); matched values are intentionally redacted`)
  for (const finding of findings) console.error(`- ${finding.path}:${finding.line} — ${finding.label}`)
  process.exit(1)
}
console.log(`[ok] secret scan passed (${scanned} text files)`)
