// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const createFlashHttpHandlers = ({
  authorizeAgentHttpRequest,
  authorizeFlashTool,
  getFlashToolRegistryPayload,
  readJsonBody,
  executeFlashToolCall,
  readFlashDraftSource,
  writeFlashDraftSource,
  uploadFlashAttachment,
  resolveFlashToolErrorStatus,
  flashAttachmentMaxBytes,
  sendJson
}) => {
  const authorizeDraft = async (user, res, toolId, appId) => {
    const targetAppId = String(appId || '').trim();
    if (!targetAppId) {
      sendJson(res, 400, { code: 'APP_ID_REQUIRED', message: 'appId is required for flash draft access' });
      return false;
    }
    if (typeof authorizeFlashTool !== 'function') {
      sendJson(res, 403, { code: 'PERMISSION_DENIED', message: 'Flash draft authorization is unavailable' });
      return false;
    }
    const authorization = await authorizeFlashTool(user, toolId, { appId: targetAppId }, { appId: targetAppId, source: 'flash-draft-http' });
    if (authorization?.allowed === true) return true;
    sendJson(res, 403, { code: 'PERMISSION_DENIED', message: 'Current user is not authorized for this flash app' });
    return false;
  };

  const handleToolsRegistryGet = async (req, res) => {
    const user = authorizeAgentHttpRequest(req, res);
    if (!user) return;
    try {
      sendJson(res, 200, await getFlashToolRegistryPayload(user));
    } catch {
      sendJson(res, 200, await getFlashToolRegistryPayload(null));
    }
  };

  const handleToolCall = async (req, res) => {
    const user = authorizeAgentHttpRequest(req, res);
    if (!user) return;
    let body = {};
    try {
      body = await readJsonBody(req, 4 * 1024 * 1024);
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
      return;
    }
    const result = await executeFlashToolCall(user, body, 'http');
    sendJson(res, result.status, result.payload);
  };

  const handleDraftGet = async (req, res) => {
    const user = authorizeAgentHttpRequest(req, res);
    if (!user) return;
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const appId = url.searchParams.get('appId') || url.searchParams.get('app_id') || '';
      if (!await authorizeDraft(user, res, 'flash.draft.read', appId)) return;
      const data = await readFlashDraftSource(appId);
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, {
        code: 'FLASH_DRAFT_READ_FAILED',
        message: error?.message || 'Read flash draft failed'
      });
    }
  };

  const handleDraftWrite = async (req, res) => {
    const user = authorizeAgentHttpRequest(req, res);
    if (!user) return;

    let body = {};
    try {
      body = await readJsonBody(req, 2 * 1024 * 1024);
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
      return;
    }

    try {
      const appId = body?.appId || body?.app_id;
      if (!await authorizeDraft(user, res, 'flash.draft.write', appId)) return;
      const data = await writeFlashDraftSource(body?.content, body?.reason, user, appId);
      sendJson(res, 200, { ok: true, ...data });
    } catch (error) {
      const status = resolveFlashToolErrorStatus(error);
      sendJson(res, status, {
        code: status === 400 ? 'BAD_REQUEST' : 'FLASH_DRAFT_WRITE_FAILED',
        message: error?.message || 'Write flash draft failed'
      });
    }
  };

  const handleAttachmentUpload = async (req, res) => {
    const user = authorizeAgentHttpRequest(req, res);
    if (!user) return;

    let body = {};
    try {
      body = await readJsonBody(req, Math.max(2 * 1024 * 1024, flashAttachmentMaxBytes * 2));
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
      return;
    }

    try {
      const file = await uploadFlashAttachment(body, user);
      sendJson(res, 200, { ok: true, file });
    } catch (error) {
      const status = resolveFlashToolErrorStatus(error);
      sendJson(res, status, {
        code: status === 400 ? 'BAD_REQUEST' : 'FLASH_ATTACHMENT_UPLOAD_FAILED',
        message: error?.message || 'Attachment upload failed'
      });
    }
  };

  return Object.freeze({
    handleDraftGet,
    handleDraftWrite,
    handleAttachmentUpload,
    handleToolsRegistryGet,
    handleToolCall
  });
};

module.exports = { createFlashHttpHandlers };
