// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { loadFlashClineConfig } = require('../../realtime/flash-cline-config')
const repoRoot = resolve(import.meta.dirname, '../..')

const defaults = loadFlashClineConfig({ environment: {}, port: 8078 })
assert.equal(Object.isFrozen(defaults), true)
assert.deepEqual(defaults, {
  enabled: true,
  command: '/app/node_modules/.bin/cline',
  projectPath: 'eiscore-apps/src/views/drafts',
  workdirConfigured: '/workspace/eiscore-apps/src/views/drafts',
  configRoot: '/tmp/flash-cline',
  taskTimeoutMs: 480000,
  authTimeoutMs: 30000,
  provider: 'openai',
  historyLimit: 10,
  buildValidateEnabled: true,
  buildWorkdirConfigured: '/workspace/eiscore-apps',
  buildTimeoutMs: 180000,
  installTimeoutMs: 120000,
  selfHealMaxRounds: 3,
  autoInstallDeps: true,
  draftFileName: 'FlashDraft.vue',
  attachmentDirName: '.uploads',
  attachmentMaxBytes: 8388608,
  attachmentPreviewMaxChars: 8000,
  semanticCliScript: '/app/flash-semantic-tool.js',
  agentBaseUrl: 'http://127.0.0.1:8078'
})

const configured = loadFlashClineConfig({
  port: 9000,
  environment: {
    FLASH_CLINE_ENABLED: ' FALSE ',
    FLASH_CLINE_COMMAND: ' custom-cline ',
    FLASH_CLINE_PROJECT_PATH: ' custom/drafts ',
    FLASH_CLINE_WORKDIR: ' /srv/drafts ',
    FLASH_CLINE_CONFIG_ROOT: ' /srv/config ',
    FLASH_CLINE_TASK_TIMEOUT_MS: '90000',
    FLASH_CLINE_AUTH_TIMEOUT_MS: '5000',
    FLASH_CLINE_PROVIDER: ' custom-provider ',
    FLASH_CLINE_HISTORY_LIMIT: '4',
    FLASH_CLINE_BUILD_VALIDATE: 'False',
    FLASH_CLINE_BUILD_WORKDIR: ' /srv/app ',
    FLASH_CLINE_BUILD_TIMEOUT_MS: '60000',
    FLASH_CLINE_INSTALL_TIMEOUT_MS: '45000',
    FLASH_CLINE_SELF_HEAL_ROUNDS: '-2',
    FLASH_CLINE_AUTO_INSTALL_DEPS: 'false',
    FLASH_DRAFT_FILE: ' Draft.vue ',
    FLASH_ATTACHMENT_DIR_NAME: '   ',
    FLASH_ATTACHMENT_MAX_BYTES: '1024',
    FLASH_ATTACHMENT_PREVIEW_MAX_CHARS: '100',
    FLASH_SEMANTIC_CLI_SCRIPT: ' /srv/tool.js ',
    FLASH_AGENT_BASE_URL: ' https://agent.example/// '
  }
})
assert.deepEqual(configured, {
  enabled: false,
  command: 'custom-cline',
  projectPath: 'custom/drafts',
  workdirConfigured: '/srv/drafts',
  configRoot: '/srv/config',
  taskTimeoutMs: 90000,
  authTimeoutMs: 5000,
  provider: 'custom-provider',
  historyLimit: 4,
  buildValidateEnabled: false,
  buildWorkdirConfigured: '/srv/app',
  buildTimeoutMs: 60000,
  installTimeoutMs: 45000,
  selfHealMaxRounds: 0,
  autoInstallDeps: false,
  draftFileName: 'Draft.vue',
  attachmentDirName: '.uploads',
  attachmentMaxBytes: 262144,
  attachmentPreviewMaxChars: 800,
  semanticCliScript: '/srv/tool.js',
  agentBaseUrl: 'https://agent.example'
})

const derived = loadFlashClineConfig({
  port: 9100,
  environment: { FLASH_CLINE_PROJECT_PATH: 'tenant/drafts' }
})
assert.equal(derived.workdirConfigured, '/workspace/tenant/drafts')
assert.equal(derived.agentBaseUrl, 'http://127.0.0.1:9100')

const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(indexSource, /loadFlashClineConfig\(\{ port \}\)/)
for (const envName of [
  'FLASH_CLINE_ENABLED',
  'FLASH_CLINE_COMMAND',
  'FLASH_CLINE_TASK_TIMEOUT_MS',
  'FLASH_CLINE_BUILD_VALIDATE',
  'FLASH_ATTACHMENT_MAX_BYTES',
  'FLASH_AGENT_BASE_URL'
]) {
  assert.equal(indexSource.includes(`process.env.${envName}`), false, `composition root reintroduced ${envName}`)
}

console.log('Flash Cline config regression passed')
