// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const {
  AgentConversation: DefaultAgentConversation,
  FileWatcher: DefaultFileWatcher
} = require('./agent-core');

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
  canUseAgent,
  logAgentEvent,
  normalizeProjectPath,
  isAllowedProject,
  getAiConfig,
  sanitizeWritePolicy,
  resolveDefaultWritePolicy,
  createAgentTaskAiInvoker,
  normalizeAgentTaskErrorMessage,
  AgentConversation = DefaultAgentConversation,
  FileWatcher = DefaultFileWatcher,
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
    agentTask: async (ws, data) => {
      if (!canUseAgent(ws.user)) {
        ws.send(JSON.stringify({
          type: 'agent:error',
          error: 'Forbidden: agent access denied'
        }));
        logAgentEvent('agent:task_denied', ws.user, { projectPath: data.projectPath || '' });
        return;
      }
      const projectPath = normalizeProjectPath(data.projectPath) || 'eiscore-apps';
      if (!isAllowedProject(projectPath)) {
        ws.send(JSON.stringify({
          type: 'agent:error',
          error: 'Forbidden: project path not allowed'
        }));
        logAgentEvent('agent:task_denied', ws.user, { projectPath });
        return;
      }
      const cfg = await getAiConfig();
      if (!cfg?.api_url || !cfg?.api_key) {
        ws.send(JSON.stringify({
          type: 'agent:error',
          error: 'AI configuration is missing in system_configs.ai_glm_config'
        }));
        logAgentEvent('agent:task_denied', ws.user, { projectPath, reason: 'ai_config_missing' });
        return;
      }
      const requestedPolicy = sanitizeWritePolicy(data.writePolicy);
      const defaultPolicy = resolveDefaultWritePolicy(projectPath);
      const hasRequestedRules = requestedPolicy.allowedFiles.length > 0 || requestedPolicy.allowedDirs.length > 0;
      const writePolicy = hasRequestedRules ? requestedPolicy : defaultPolicy;

      logAgentEvent('agent:task_start', ws.user, { projectPath, writePolicy });
      ws.agentConversation = new AgentConversation(projectPath, {
        writePolicy,
        model: cfg?.model || 'glm-4.6v',
        aiInvoker: createAgentTaskAiInvoker(cfg)
      });

      if (ws.fileWatcher) ws.fileWatcher.stop();
      ws.fileWatcher = new FileWatcher(projectPath, (changeEvent) => {
        ws.send(JSON.stringify({ type: 'agent:file_change', data: changeEvent }));
      });
      ws.fileWatcher.start();

      ws.send(JSON.stringify({
        type: 'agent:status',
        status: 'thinking',
        message: 'Processing your request...'
      }));

      try {
        const result = await ws.agentConversation.executeTask(data.prompt);
        ws.send(JSON.stringify({
          type: 'agent:result',
          success: result.success,
          executionLog: result.executionLog,
          totalTurns: result.totalTurns
        }));
        logAgentEvent('agent:task_result', ws.user, {
          projectPath,
          success: result.success,
          totalTurns: result.totalTurns
        });
      } catch (error) {
        const safeError = normalizeAgentTaskErrorMessage(error);
        ws.send(JSON.stringify({ type: 'agent:error', error: safeError, code: 'AGENT_TASK_FAILED' }));
        logAgentEvent('agent:task_failed', ws.user, { projectPath, error: safeError });
      }
    },
    agentToolUse: async (ws, data) => {
      if (!canUseAgent(ws.user)) {
        ws.send(JSON.stringify({ type: 'agent:error', error: 'Forbidden: agent access denied' }));
        logAgentEvent('agent:tool_denied', ws.user, { tool: data.toolCall?.tool });
        return;
      }
      if (!ws.agentConversation) {
        ws.send(JSON.stringify({ type: 'agent:error', error: 'No active conversation. Send agent:task first.' }));
        return;
      }
      const result = await ws.agentConversation.executeToolCall(data.toolCall);
      ws.send(JSON.stringify({ type: 'agent:tool_result', result }));
      logAgentEvent('agent:tool_result', ws.user, {
        tool: data.toolCall?.tool,
        success: result?.success !== false
      });
    },
    agentTerminal: async (ws, data) => {
      if (!canUseAgent(ws.user)) {
        ws.send(JSON.stringify({ type: 'agent:error', error: 'Forbidden: agent access denied' }));
        logAgentEvent('agent:terminal_denied', ws.user, { command: data.command || '' });
        return;
      }
      if (!ws.agentConversation) {
        ws.send(JSON.stringify({ type: 'agent:error', error: 'No active conversation.' }));
        return;
      }
      const result = await ws.agentConversation.tools.executeCommand(data.command);
      ws.send(JSON.stringify({ type: 'agent:terminal_result', result }));
      logAgentEvent('agent:terminal_result', ws.user, { success: result?.success !== false });
    }
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
  ...messageDependencies
}) => {
  const handleMessage = createWebSocketMessageHandler({
    killFlashCliSessionProcess,
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
      if (ws.fileWatcher) ws.fileWatcher.stop();
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
