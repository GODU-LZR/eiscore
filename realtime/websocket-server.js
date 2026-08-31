// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const WEBSOCKET_MESSAGE_MANIFEST = Object.freeze([
  Object.freeze({ type: 'subscribe', handler: 'subscribe' }),
  Object.freeze({ type: 'unsubscribe', handler: 'unsubscribe' }),
  Object.freeze({ type: 'flash:tool_call', handler: 'flashToolCall' }),
  Object.freeze({ type: 'flash:cline_task', handler: 'flashClineTask' }),
  Object.freeze({ type: 'flash:cline_stop', handler: 'flashClineStop' }),
  Object.freeze({ type: 'flash:cline_reset', handler: 'flashClineReset' }),
  Object.freeze({ type: 'agent:task', handler: 'agentTask' }),
  Object.freeze({ type: 'agent:tool_use', handler: 'agentToolUse' }),
  Object.freeze({ type: 'agent:terminal', handler: 'agentTerminal' })
]);

const normalizeFlashSessionId = (value) =>
  String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';

const createWebSocketMessageHandler = ({
  normalizeStringList,
  handleFlashToolCallWs,
  runFlashClineTask,
  killFlashCliSessionProcess,
  sendWsJson,
  createFlashCliSession,
  agentTaskService,
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
    flashClineTask: runFlashClineTask,
    flashClineStop: async (ws, data) => {
      const sessionId = normalizeFlashSessionId(data?.sessionId);
      const session = ws.flashCliSessions?.get(sessionId);
      if (session) {
        killFlashCliSessionProcess(session);
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'stopped',
          message: '已停止当前 Cline 任务'
        });
      }
    },
    flashClineReset: async (ws, data) => {
      const sessionId = normalizeFlashSessionId(data?.sessionId);
      const session = ws.flashCliSessions?.get(sessionId);
      if (session) {
        killFlashCliSessionProcess(session);
        session.taskId = '';
      } else if (ws.flashCliSessions) {
        ws.flashCliSessions.set(sessionId, createFlashCliSession());
      }
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'reset',
        message: '会话已重置'
      });
    },
    agentTask: agentTaskService.runTask,
    agentToolUse: agentTaskService.runTool,
    agentTerminal: agentTaskService.runTerminal
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
  channel,
  killFlashCliSessionProcess,
  agentTaskService,
  ...messageDependencies
}) => {
  const handleMessage = createWebSocketMessageHandler({
    killFlashCliSessionProcess,
    agentTaskService,
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
    ws.channels = new Set([channel]);
    ws.agentConversation = null;
    ws.fileWatcher = null;
    ws.flashCliSessions = new Map();

    ws.on('message', (message) => handleMessage(ws, message));
    ws.on('close', () => {
      agentTaskService.cleanup(ws);
      if (ws.flashCliSessions) {
        ws.flashCliSessions.forEach((session) => killFlashCliSessionProcess(session));
        ws.flashCliSessions.clear();
      }
    });
  });
};

module.exports = {
  WEBSOCKET_MESSAGE_MANIFEST,
  attachWebSocketServer,
  createWebSocketMessageHandler,
  normalizeFlashSessionId
};
