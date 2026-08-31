// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const createFlashHttpHandlers = ({
  authorizeAgentHttpRequest,
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
  const handleToolsRegistryGet = async (req, res) => {
    const user = authorizeAgentHttpRequest(req, res);
    if (!user) return;
    sendJson(res, 200, getFlashToolRegistryPayload());
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
      const data = await writeFlashDraftSource(body?.content, body?.reason, user, body?.appId || body?.app_id);
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
