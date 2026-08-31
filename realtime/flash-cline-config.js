// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const path = require('path');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

const loadFlashClineConfig = ({
  environment = process.env,
  port = 8078,
  pathApi = path
} = {}) => {
  const projectPath = envText(environment.FLASH_CLINE_PROJECT_PATH, 'eiscore-apps/src/views/drafts');
  return Object.freeze({
    enabled: envText(environment.FLASH_CLINE_ENABLED, 'true').toLowerCase() !== 'false',
    command: envText(environment.FLASH_CLINE_COMMAND, '/app/node_modules/.bin/cline'),
    projectPath,
    workdirConfigured: envText(
      environment.FLASH_CLINE_WORKDIR,
      pathApi.posix.join('/workspace', projectPath)
    ),
    configRoot: envText(environment.FLASH_CLINE_CONFIG_ROOT, '/tmp/flash-cline'),
    taskTimeoutMs: Number(environment.FLASH_CLINE_TASK_TIMEOUT_MS || 8 * 60 * 1000),
    authTimeoutMs: Number(environment.FLASH_CLINE_AUTH_TIMEOUT_MS || 30 * 1000),
    provider: envText(environment.FLASH_CLINE_PROVIDER, 'openai'),
    historyLimit: Number(environment.FLASH_CLINE_HISTORY_LIMIT || 10),
    buildValidateEnabled: envText(environment.FLASH_CLINE_BUILD_VALIDATE, 'true').toLowerCase() !== 'false',
    buildWorkdirConfigured: envText(environment.FLASH_CLINE_BUILD_WORKDIR, '/workspace/eiscore-apps'),
    buildTimeoutMs: Number(environment.FLASH_CLINE_BUILD_TIMEOUT_MS || 180 * 1000),
    installTimeoutMs: Number(environment.FLASH_CLINE_INSTALL_TIMEOUT_MS || 120 * 1000),
    selfHealMaxRounds: Math.max(0, Number(environment.FLASH_CLINE_SELF_HEAL_ROUNDS || 3)),
    autoInstallDeps: envText(environment.FLASH_CLINE_AUTO_INSTALL_DEPS, 'true').toLowerCase() !== 'false',
    draftFileName: envText(environment.FLASH_DRAFT_FILE, 'FlashDraft.vue'),
    attachmentDirName: envText(environment.FLASH_ATTACHMENT_DIR_NAME, '.uploads') || '.uploads',
    attachmentMaxBytes: Math.max(
      256 * 1024,
      Number(environment.FLASH_ATTACHMENT_MAX_BYTES || 8 * 1024 * 1024)
    ),
    attachmentPreviewMaxChars: Math.max(
      800,
      Number(environment.FLASH_ATTACHMENT_PREVIEW_MAX_CHARS || 8000)
    ),
    semanticCliScript: envText(environment.FLASH_SEMANTIC_CLI_SCRIPT, '/app/flash-semantic-tool.js'),
    agentBaseUrl: envText(
      environment.FLASH_AGENT_BASE_URL,
      `http://127.0.0.1:${port}`
    ).replace(/\/+$/, '')
  });
};

module.exports = {
  loadFlashClineConfig
};
