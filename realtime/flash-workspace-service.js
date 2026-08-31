// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const createFlashWorkspaceService = ({
  projectPath,
  workdirConfigured,
  draftFileName,
  attachmentDirName,
  attachmentMaxBytes,
  attachmentPreviewMaxChars,
  moduleRoot,
  normalizeText,
  normalizeProjectPath,
  sanitizePathToken,
  FlashToolError,
  logAgentEvent,
  fsApi = fs,
  pathApi = path,
  cryptoApi = crypto,
  BufferApi = Buffer,
  getCwd = () => process.cwd(),
  now = () => Date.now(),
  random = () => Math.random()
}) => {
  let activeDraftAppId = '';

  const envText = (value, fallback = '') => String(value ?? fallback).trim();
  const normalizeAppId = (value) => sanitizePathToken(value, '');

  const ensureDir = async (dirPath) => {
    await fsApi.promises.mkdir(dirPath, { recursive: true });
  };

  const resolveWorkdir = () => {
    const cwd = getCwd();
    const candidates = [
      workdirConfigured,
      pathApi.resolve(cwd, '..', projectPath),
      pathApi.resolve(moduleRoot, '..', projectPath),
      pathApi.resolve(cwd, projectPath)
    ]
      .map((item) => envText(item, ''))
      .filter(Boolean);

    for (const candidate of candidates) {
      try {
        if (fsApi.existsSync(candidate)) return candidate;
      } catch {
        // Ignore inaccessible candidates and preserve configured fallback order.
      }
    }
    return candidates[0] || workdirConfigured;
  };

  const resolveDraftFilePath = () => {
    const workdir = resolveWorkdir();
    const file = draftFileName || 'FlashDraft.vue';
    const resolved = pathApi.resolve(workdir, file);
    const normalizedWorkdir = pathApi.resolve(workdir);
    if (!resolved.startsWith(normalizedWorkdir + pathApi.sep)) {
      throw new Error('Flash draft path escapes workdir');
    }
    return resolved;
  };

  const resolveScopedDraftFilePath = (appId) => {
    const normalizedAppId = normalizeAppId(appId);
    if (!normalizedAppId) return '';
    const workdir = resolveWorkdir();
    const baseDir = pathApi.resolve(workdir, '.app-drafts');
    const resolved = pathApi.resolve(baseDir, `${normalizedAppId}.vue`);
    if (!resolved.startsWith(baseDir + pathApi.sep)) {
      throw new Error('Flash scoped draft path escapes workdir');
    }
    return resolved;
  };

  const syncScopedDraftToPreview = async (appId) => {
    const scopedPath = resolveScopedDraftFilePath(appId);
    if (!scopedPath || !fsApi.existsSync(scopedPath)) return false;
    const previewPath = resolveDraftFilePath();
    await ensureDir(pathApi.dirname(previewPath));
    await fsApi.promises.copyFile(scopedPath, previewPath);
    activeDraftAppId = normalizeAppId(appId);
    return true;
  };

  const readFileFingerprintSafe = async (target, appId = '') => {
    try {
      if (!target) return null;
      const stat = await fsApi.promises.stat(target);
      if (!stat?.isFile?.()) return null;
      const buffer = await fsApi.promises.readFile(target);
      return {
        appId: normalizeAppId(appId),
        path: target,
        bytes: Number(stat.size || 0),
        mtimeMs: Number(stat.mtimeMs || 0),
        sha1: cryptoApi.createHash('sha1').update(buffer).digest('hex')
      };
    } catch {
      return null;
    }
  };

  const readDraftFingerprintSafe = async (appId = '') => {
    const normalizedAppId = normalizeAppId(appId);
    const scopedTarget = normalizedAppId ? resolveScopedDraftFilePath(normalizedAppId) : '';
    const target = scopedTarget && fsApi.existsSync(scopedTarget) ? scopedTarget : resolveDraftFilePath();
    return readFileFingerprintSafe(target, normalizedAppId);
  };

  const readDraftFingerprintsSafe = async (appId = '') => {
    const normalizedAppId = normalizeAppId(appId);
    const previewPath = resolveDraftFilePath();
    const scopedPath = normalizedAppId ? resolveScopedDraftFilePath(normalizedAppId) : '';
    const [preview, scoped] = await Promise.all([
      readFileFingerprintSafe(previewPath, normalizedAppId),
      scopedPath ? readFileFingerprintSafe(scopedPath, normalizedAppId) : Promise.resolve(null)
    ]);
    return { preview, scoped };
  };

  const hasFingerprintChanged = (before, after) => !!(
    after
    && (
      !before
      || before.sha1 !== after.sha1
      || before.bytes !== after.bytes
      || before.mtimeMs !== after.mtimeMs
    )
  );

  const syncPreviewDraftToScoped = async (appId) => {
    const normalizedAppId = normalizeAppId(appId);
    if (!normalizedAppId) return false;
    const previewPath = resolveDraftFilePath();
    const scopedPath = resolveScopedDraftFilePath(normalizedAppId);
    if (!fsApi.existsSync(previewPath)) return false;
    await ensureDir(pathApi.dirname(scopedPath));
    await fsApi.promises.copyFile(previewPath, scopedPath);
    activeDraftAppId = normalizedAppId;
    return true;
  };

  const requireNonEmptyText = (value, fieldName) => {
    const text = String(value || '').trim();
    if (!text) {
      throw new FlashToolError('VALIDATION_FAILED', `${fieldName} is required`, { httpStatus: 400 });
    }
    return text;
  };

  const readDraftSource = async (appId = '') => {
    const normalizedAppId = normalizeAppId(appId);
    if (normalizedAppId) {
      await syncScopedDraftToPreview(normalizedAppId);
    }
    const scopedTarget = normalizedAppId ? resolveScopedDraftFilePath(normalizedAppId) : '';
    const target = scopedTarget && fsApi.existsSync(scopedTarget) ? scopedTarget : resolveDraftFilePath();
    const content = await fsApi.promises.readFile(target, 'utf8');
    return {
      appId: normalizedAppId,
      activeAppId: activeDraftAppId,
      path: scopedTarget && target === scopedTarget
        ? normalizeProjectPath(`${projectPath}/.app-drafts/${normalizedAppId}.vue`)
        : normalizeProjectPath(`${projectPath}/${draftFileName}`),
      content,
      bytes: BufferApi.byteLength(content, 'utf8')
    };
  };

  const writeDraftSource = async (content, reason = '', user = null, appId = '') => {
    const text = String(content || '');
    if (!text.trim()) {
      throw new FlashToolError('VALIDATION_FAILED', 'content is required', { httpStatus: 400 });
    }
    const bytes = BufferApi.byteLength(text, 'utf8');
    if (bytes > 1024 * 1024) {
      throw new FlashToolError('VALIDATION_FAILED', 'content exceeds 1MB limit', { httpStatus: 400 });
    }

    const normalizedAppId = normalizeAppId(appId);
    const previewTarget = resolveDraftFilePath();
    const scopedTarget = normalizedAppId ? resolveScopedDraftFilePath(normalizedAppId) : '';
    if (scopedTarget) {
      await ensureDir(pathApi.dirname(scopedTarget));
      await fsApi.promises.writeFile(scopedTarget, text, 'utf8');
    }
    await ensureDir(pathApi.dirname(previewTarget));
    await fsApi.promises.writeFile(previewTarget, text, 'utf8');
    if (normalizedAppId) activeDraftAppId = normalizedAppId;
    if (user) {
      logAgentEvent('flash:draft_write', user, {
        bytes,
        appId: normalizedAppId,
        reason: normalizeText(reason).slice(0, 80)
      });
    }
    return {
      appId: normalizedAppId,
      activeAppId: activeDraftAppId,
      path: normalizeProjectPath(`${projectPath}/${draftFileName}`),
      scopedPath: scopedTarget ? normalizeProjectPath(`${projectPath}/.app-drafts/${normalizedAppId}.vue`) : '',
      bytes
    };
  };

  const sanitizeUploadFileName = (value) => {
    const base = pathApi.posix.basename(String(value || '').trim());
    const safe = base
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^_+/, '')
      .slice(0, 96);
    if (!safe) return `upload-${now()}.bin`;
    return safe;
  };

  const decodeBase64Payload = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return BufferApi.alloc(0);
    const payload = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    return BufferApi.from(payload, 'base64');
  };

  const isTextLikeAttachment = (fileName, mimeType) => {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.startsWith('text/')) return true;
    if (mime.includes('json') || mime.includes('xml') || mime.includes('yaml') || mime.includes('csv')) return true;
    const ext = pathApi.extname(String(fileName || '').toLowerCase());
    const textExt = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm', '.sql', '.js', '.ts', '.vue', '.py']);
    return textExt.has(ext);
  };

  const buildSafeUploadPath = (taskWorkdir, appId, conversationId, fileName) => {
    const appPart = sanitizePathToken(appId, 'app');
    const convPart = sanitizePathToken(conversationId, 'default');
    const safeName = sanitizeUploadFileName(fileName);
    const baseDir = pathApi.resolve(taskWorkdir, attachmentDirName, appPart, convPart);
    const candidate = pathApi.resolve(baseDir, safeName);
    const workdirResolved = pathApi.resolve(taskWorkdir);
    if (candidate !== workdirResolved && !candidate.startsWith(`${workdirResolved}${pathApi.sep}`)) {
      throw new Error('Attachment target escapes task workdir');
    }
    return { baseDir, candidate, safeName };
  };

  const uploadAttachment = async (body = {}, user = null) => {
    const appId = sanitizePathToken(body?.appId, 'app');
    const conversationId = sanitizePathToken(body?.conversationId, 'default');
    const fileName = sanitizeUploadFileName(body?.fileName);
    const mimeType = normalizeText(body?.mimeType || body?.contentType).slice(0, 120) || 'application/octet-stream';
    const binary = decodeBase64Payload(body?.contentBase64 || body?.base64);

    if (!binary.length) {
      throw new FlashToolError('VALIDATION_FAILED', 'contentBase64 is required', { httpStatus: 400 });
    }
    if (binary.length > attachmentMaxBytes) {
      throw new FlashToolError('VALIDATION_FAILED', `attachment exceeds ${attachmentMaxBytes} bytes`, { httpStatus: 400 });
    }

    const taskWorkdir = resolveWorkdir();
    const targetInfo = buildSafeUploadPath(taskWorkdir, appId, conversationId, fileName);
    await ensureDir(targetInfo.baseDir);

    let finalName = targetInfo.safeName;
    let targetPath = targetInfo.candidate;
    let suffix = 1;
    while (fsApi.existsSync(targetPath)) {
      const ext = pathApi.extname(targetInfo.safeName);
      const stem = targetInfo.safeName.slice(0, Math.max(1, targetInfo.safeName.length - ext.length));
      finalName = `${stem}-${suffix}${ext}`;
      targetPath = pathApi.resolve(targetInfo.baseDir, finalName);
      suffix += 1;
    }

    await fsApi.promises.writeFile(targetPath, binary);
    const relativePath = pathApi.relative(pathApi.resolve(taskWorkdir), targetPath).replace(/\\/g, '/');
    const uploadedAt = new Date(now()).toISOString();

    let textPreview = '';
    if (isTextLikeAttachment(finalName, mimeType)) {
      try {
        const utf8 = binary.toString('utf8');
        textPreview = normalizeText(utf8).slice(0, attachmentPreviewMaxChars);
      } catch {
        textPreview = '';
      }
    }

    if (user) {
      logAgentEvent('flash:attachment_upload', user, {
        appId,
        conversationId,
        name: finalName,
        mimeType,
        size: binary.length
      });
    }

    return {
      id: `att-${now()}-${random().toString(16).slice(2, 8)}`,
      appId,
      conversationId,
      name: finalName,
      mimeType,
      size: binary.length,
      relativePath,
      textPreview,
      uploadedAt
    };
  };

  return Object.freeze({
    buildSafeUploadPath,
    ensureDir,
    hasFingerprintChanged,
    normalizeAppId,
    readDraftFingerprintSafe,
    readDraftFingerprintsSafe,
    readDraftSource,
    requireNonEmptyText,
    resolveDraftFilePath,
    resolveScopedDraftFilePath,
    resolveWorkdir,
    sanitizeUploadFileName,
    syncPreviewDraftToScoped,
    syncScopedDraftToPreview,
    uploadAttachment,
    writeDraftSource
  });
};

module.exports = {
  createFlashWorkspaceService
};
