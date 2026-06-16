// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const nodeBin = process.execPath

const args = new Map()
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--') && arg.includes('=')) {
    const [key, ...rest] = arg.slice(2).split('=')
    args.set(key, rest.join('='))
  } else if (arg.startsWith('--')) {
    args.set(arg.slice(2), true)
  }
}

const baseUrl = String(
  args.get('base-url') ||
  process.env.EISCORE_ENGINEERING_BASE_URL ||
  process.env.EISCORE_E2E_BASE_URL ||
  process.env.EISCORE_BASE_URL ||
  'https://nanpai.eissys.top'
).replace(/\/+$/, '')

const defaultAgentWsUrl = baseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:') + '/agent/ws'
const agentWsUrl = String(args.get('agent-ws-url') || process.env.EISCORE_ENGINEERING_AGENT_WS_URL || process.env.EISCORE_AGENT_WS_URL || defaultAgentWsUrl)
const artifactsDir = resolve(repoRoot, String(args.get('artifacts-dir') || process.env.EISCORE_ENGINEERING_ARTIFACTS_DIR || 'tests/.artifacts'))
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const summaryPath = join(artifactsDir, `nanpai-engineering-suite-${runId}.json`)
const markdownPath = join(artifactsDir, `nanpai-engineering-suite-${runId}.md`)
const only = String(args.get('only') || '').split(',').map((item) => item.trim()).filter(Boolean)
const skipE2e = args.has('skip-e2e')

mkdirSync(artifactsDir, { recursive: true })

const playwrightLibPath = resolve(repoRoot, 'tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu')
const baseEnv = { ...process.env }
if (existsSync(playwrightLibPath)) {
  baseEnv.LD_LIBRARY_PATH = baseEnv.LD_LIBRARY_PATH
    ? `${playwrightLibPath}:${baseEnv.LD_LIBRARY_PATH}`
    : playwrightLibPath
}

function shouldRun(name) {
  if (only.length > 0) return only.includes(name)
  if (name === 'e2e' && skipE2e) return false
  return true
}

function runStep({ name, label, command, commandArgs, env, artifact }) {
  if (!shouldRun(name)) {
    return Promise.resolve({
      name,
      label,
      status: 'skipped',
      exitCode: null,
      durationMs: 0,
      artifact
    })
  }

  const startedAt = Date.now()
  console.log(`\n===== ${label} =====`)
  const child = spawn(command, commandArgs, {
    cwd: repoRoot,
    env: { ...baseEnv, ...env },
    stdio: 'inherit',
    shell: false
  })

  return new Promise((resolveStep) => {
    child.on('close', (code) => {
      const durationMs = Date.now() - startedAt
      resolveStep({
        name,
        label,
        status: code === 0 ? 'pass' : 'fail',
        exitCode: code,
        durationMs,
        artifact
      })
    })
    child.on('error', (error) => {
      const durationMs = Date.now() - startedAt
      resolveStep({
        name,
        label,
        status: 'fail',
        exitCode: 1,
        durationMs,
        artifact,
        error: error.message
      })
    })
  })
}

const smokeArtifact = join(artifactsDir, `nanpai-engineering-suite-smoke-${runId}.json`)
const chainArtifact = join(artifactsDir, `nanpai-engineering-suite-business-chain-${runId}.json`)

const steps = [
  {
    name: 'smoke',
    label: 'Remote smoke',
    command: nodeBin,
    commandArgs: ['tests/smoke/business-smoke.mjs'],
    artifact: smokeArtifact,
    env: {
      EISCORE_BASE_URL: baseUrl,
      EISCORE_AGENT_WS_URL: agentWsUrl,
      EISCORE_SMOKE_RESULT: smokeArtifact
    }
  },
  {
    name: 'business',
    label: 'Remote business chain',
    command: nodeBin,
    commandArgs: ['tests/business/full-chain.mjs'],
    artifact: chainArtifact,
    env: {
      EISCORE_CHAIN_BASE_URL: baseUrl,
      EISCORE_CHAIN_RESULT: chainArtifact
    }
  },
  {
    name: 'e2e',
    label: 'Remote browser E2E',
    command: nodeBin,
    commandArgs: ['node_modules/@playwright/test/cli.js', 'test'],
    artifact: 'tests/.artifacts/playwright-result.json',
    env: {
      EISCORE_E2E_BASE_URL: baseUrl
    }
  }
]

const startedAt = Date.now()
const results = []
for (const step of steps) {
  results.push(await runStep(step))
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  agentWsUrl,
  runId,
  durationMs: Date.now() - startedAt,
  summary: {
    total: results.length,
    pass: results.filter((item) => item.status === 'pass').length,
    fail: results.filter((item) => item.status === 'fail').length,
    skipped: results.filter((item) => item.status === 'skipped').length
  },
  results
}

writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8')

const markdown = [
  '# Nanpai Remote Engineering Suite',
  '',
  `Generated: ${summary.generatedAt}`,
  `Base URL: ${baseUrl}`,
  `Agent WS URL: ${agentWsUrl}`,
  `Duration: ${Math.round(summary.durationMs / 1000)}s`,
  '',
  '| Step | Status | Duration | Artifact |',
  '|---|---:|---:|---|',
  ...results.map((item) => `| ${item.label} | ${item.status.toUpperCase()} | ${Math.round(item.durationMs / 1000)}s | ${item.artifact || ''} |`),
  '',
  `JSON summary: ${summaryPath}`,
  ''
].join('\n')

writeFileSync(markdownPath, markdown, 'utf8')

console.log(`\n[summary] ${summary.summary.pass}/${summary.summary.total - summary.summary.skipped} passed, ${summary.summary.skipped} skipped`)
console.log(`[artifact] ${summaryPath}`)
console.log(`[report] ${markdownPath}`)

if (summary.summary.fail > 0) {
  process.exit(1)
}
