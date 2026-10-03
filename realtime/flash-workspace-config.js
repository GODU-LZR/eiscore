'use strict';

const text = (value, fallback = '') => String(value ?? fallback).trim();

const loadFlashWorkspaceConfig = ({ environment = process.env, pathApi } = {}) => {
  const projectPath = text(environment.FLASH_PROJECT_PATH, 'eiscore-apps/src/views/drafts');
  return Object.freeze({
    projectPath,
    workdirConfigured: text(environment.FLASH_WORKDIR, pathApi?.posix?.join('/workspace', projectPath) || `/workspace/${projectPath}`),
    draftFileName: text(environment.FLASH_DRAFT_FILE, 'FlashDraft.vue'),
    attachmentDirName: text(environment.FLASH_ATTACHMENT_DIR_NAME, '.uploads') || '.uploads',
    attachmentMaxBytes: Math.max(256 * 1024, Number(environment.FLASH_ATTACHMENT_MAX_BYTES || 8 * 1024 * 1024)),
    attachmentPreviewMaxChars: Math.max(800, Number(environment.FLASH_ATTACHMENT_PREVIEW_MAX_CHARS || 8000))
  });
};

module.exports = { loadFlashWorkspaceConfig };
