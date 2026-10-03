// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const WEBSOCKET_MESSAGE_MANIFEST = Object.freeze([
  Object.freeze({ type: 'subscribe', handler: 'subscribe' }),
  Object.freeze({ type: 'unsubscribe', handler: 'unsubscribe' }),
  Object.freeze({ type: 'flash:tool_call', handler: 'flashToolCall' }),
  Object.freeze({ type: 'flash:harness_task', handler: 'flashHarnessTask' }),
  Object.freeze({ type: 'flash:harness_reset', handler: 'flashHarnessReset' }),
]);

const normalizeFlashSessionId = (value) =>
  String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';

const createWebSocketMessageHandler = ({
  normalizeStringList,
  handleFlashToolCallWs,
  handleFlashHarnessTaskWs,
  handleFlashHarnessResetWs,
  sendWsJson,
  manifest = WEBSOCKET_MESSAGE_MANIFEST
}) => {
  const handlers = {
    subscribe: async (ws, data) => {
      const list = normalizeStringList(data.channels);
      if (list.length) ws.channels = new Set(list);
    },
    unsubscribe: async (ws, data) => {
      const list = normalizeStringList(data.channels);
      list.forEach((channel) => ws.channels.delete(channel));
    },
    flashToolCall: handleFlashToolCallWs,
    flashHarnessTask: handleFlashHarnessTaskWs,
    flashHarnessReset: handleFlashHarnessResetWs
  };

  const routeByType = new Map(manifest.map((entry) => [entry.type, entry.handler]));
  return async (ws, message) => {
    try {
      const data = JSON.parse(String(message));
      if (!data || typeof data !== 'object') return;
      const handlerName = routeByType.get(data.type);
      if (!handlerName) return;
      await handlers[handlerName](ws, data);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  };
};

const attachWebSocketServer = ({
  wss,
  extractToken,
  verifyToken,
  asUser,
  hasHarnessTenantContext,
  channel,
  ...messageDependencies
}) => {
  const handleMessage = createWebSocketMessageHandler({
    ...messageDependencies
  });

  wss.on('connection', (ws, req) => {
    const token = extractToken(req);
    const payload = verifyToken(token);
    if (!payload) {
      ws.close(1008, 'unauthorized');
      return;
    }
    ws.user = { ...asUser(payload), token };
    if (typeof hasHarnessTenantContext !== 'function' || !hasHarnessTenantContext(ws.user)) {
      ws.close(1008, 'tenant_context_required');
      return;
    }
    ws.channels = new Set([channel]);

    ws.on('message', (message) => handleMessage(ws, message));
    ws.on('close', () => {
      ws.channels?.clear();
    });
  });
};

module.exports = {
  WEBSOCKET_MESSAGE_MANIFEST,
  attachWebSocketServer,
  createWebSocketMessageHandler,
  normalizeFlashSessionId
};
