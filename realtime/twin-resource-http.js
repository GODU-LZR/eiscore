// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const { createPersistence: defaultCreatePersistence } = require('./twin-tools');

const createTwinResourceHttpHandlers = ({
  authorizeTwinRequest,
  bindPgQueryForUser,
  readJsonBody,
  sendJson,
  port,
  createPersistence = defaultCreatePersistence
}) => {
  const handleSessionsList = async (req, res) => {
    const user = authorizeTwinRequest(req, res);
    if (!user) return;
    try {
      const pgQuery = bindPgQueryForUser(user);
      const persistence = createPersistence(pgQuery, user.username);
      const sessions = await persistence.listSessions(30);
      sendJson(res, 200, { sessions });
    } catch (error) {
      sendJson(res, 500, { code: 'TWIN_SESSIONS_FAILED', message: error?.message || 'Failed to list sessions' });
    }
  };

  const handleSessionDelete = async (req, res) => {
    const user = authorizeTwinRequest(req, res);
    if (!user) return;
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      const sessionId = url.searchParams.get('id') || '';
      if (!sessionId) {
        sendJson(res, 400, { code: 'ID_REQUIRED', message: 'session id is required' });
        return;
      }
      const pgQuery = bindPgQueryForUser(user);
      const persistence = createPersistence(pgQuery, user.username);
      await persistence.deleteSession(sessionId);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error('[twin-session-delete] error:', error);
      sendJson(res, 500, { code: 'TWIN_DELETE_FAILED', message: error?.message || 'Failed to delete session' });
    }
  };

  const handleMessagesGet = async (req, res) => {
    const user = authorizeTwinRequest(req, res);
    if (!user) return;
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      const sessionId = url.searchParams.get('session_id') || '';
      if (!sessionId) {
        sendJson(res, 400, { code: 'SESSION_ID_REQUIRED', message: 'session_id is required' });
        return;
      }
      const pgQuery = bindPgQueryForUser(user);
      const persistence = createPersistence(pgQuery, user.username);
      const messages = await persistence.loadHistory(sessionId, 50);
      sendJson(res, 200, { messages });
    } catch (error) {
      sendJson(res, 500, { code: 'TWIN_MESSAGES_FAILED', message: error?.message || 'Failed to load messages' });
    }
  };

  const handleKnowledgeUpload = async (req, res) => {
    const user = authorizeTwinRequest(req, res);
    if (!user) return;
    let body = {};
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
      return;
    }
    try {
      const pgQuery = bindPgQueryForUser(user);
      const persistence = createPersistence(pgQuery, user.username);
      const file = await persistence.uploadKnowledgeFile(body);
      sendJson(res, 200, { ok: true, file });
    } catch (error) {
      sendJson(res, 500, { code: 'TWIN_UPLOAD_FAILED', message: error?.message || 'Failed to upload file' });
    }
  };

  const handleKnowledgeList = async (req, res) => {
    const user = authorizeTwinRequest(req, res);
    if (!user) return;
    try {
      const pgQuery = bindPgQueryForUser(user);
      const persistence = createPersistence(pgQuery, user.username);
      const files = await persistence.listKnowledgeFiles(50);
      sendJson(res, 200, { files });
    } catch (error) {
      sendJson(res, 500, { code: 'TWIN_KB_LIST_FAILED', message: error?.message || 'Failed to list knowledge files' });
    }
  };

  const handleKnowledgeDelete = async (req, res) => {
    const user = authorizeTwinRequest(req, res);
    if (!user) return;
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      const fileId = url.searchParams.get('id') || '';
      if (!fileId) {
        sendJson(res, 400, { code: 'ID_REQUIRED', message: 'file id is required' });
        return;
      }
      const pgQuery = bindPgQueryForUser(user);
      const persistence = createPersistence(pgQuery, user.username);
      await persistence.deleteKnowledgeFile(fileId);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { code: 'TWIN_KB_DELETE_FAILED', message: error?.message || 'Failed to delete knowledge file' });
    }
  };

  return Object.freeze({
    handleSessionsList,
    handleSessionDelete,
    handleMessagesGet,
    handleKnowledgeUpload,
    handleKnowledgeList,
    handleKnowledgeDelete
  });
};

module.exports = { createTwinResourceHttpHandlers };
