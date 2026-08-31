// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const {
  AgentConversation: DefaultAgentConversation,
  FileWatcher: DefaultFileWatcher
} = require('./agent-core');

const createAgentTaskService = ({
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
  FileWatcher = DefaultFileWatcher
}) => {
  const send = (ws, payload) => ws.send(JSON.stringify(payload));

  const runTask = async (ws, data) => {
    if (!canUseAgent(ws.user)) {
      send(ws, { type: 'agent:error', error: 'Forbidden: agent access denied' });
      logAgentEvent('agent:task_denied', ws.user, { projectPath: data.projectPath || '' });
      return;
    }
    const projectPath = normalizeProjectPath(data.projectPath) || 'eiscore-apps';
    if (!isAllowedProject(projectPath)) {
      send(ws, { type: 'agent:error', error: 'Forbidden: project path not allowed' });
      logAgentEvent('agent:task_denied', ws.user, { projectPath });
      return;
    }
    const cfg = await getAiConfig();
    if (!cfg?.api_url || !cfg?.api_key) {
      send(ws, {
        type: 'agent:error',
        error: 'AI configuration is missing in system_configs.ai_glm_config'
      });
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
      send(ws, { type: 'agent:file_change', data: changeEvent });
    });
    ws.fileWatcher.start();

    send(ws, {
      type: 'agent:status',
      status: 'thinking',
      message: 'Processing your request...'
    });

    try {
      const result = await ws.agentConversation.executeTask(data.prompt);
      send(ws, {
        type: 'agent:result',
        success: result.success,
        executionLog: result.executionLog,
        totalTurns: result.totalTurns
      });
      logAgentEvent('agent:task_result', ws.user, {
        projectPath,
        success: result.success,
        totalTurns: result.totalTurns
      });
    } catch (error) {
      const safeError = normalizeAgentTaskErrorMessage(error);
      send(ws, { type: 'agent:error', error: safeError, code: 'AGENT_TASK_FAILED' });
      logAgentEvent('agent:task_failed', ws.user, { projectPath, error: safeError });
    }
  };

  const runTool = async (ws, data) => {
    if (!canUseAgent(ws.user)) {
      send(ws, { type: 'agent:error', error: 'Forbidden: agent access denied' });
      logAgentEvent('agent:tool_denied', ws.user, { tool: data.toolCall?.tool });
      return;
    }
    if (!ws.agentConversation) {
      send(ws, { type: 'agent:error', error: 'No active conversation. Send agent:task first.' });
      return;
    }
    const result = await ws.agentConversation.executeToolCall(data.toolCall);
    send(ws, { type: 'agent:tool_result', result });
    logAgentEvent('agent:tool_result', ws.user, {
      tool: data.toolCall?.tool,
      success: result?.success !== false
    });
  };

  const runTerminal = async (ws, data) => {
    if (!canUseAgent(ws.user)) {
      send(ws, { type: 'agent:error', error: 'Forbidden: agent access denied' });
      logAgentEvent('agent:terminal_denied', ws.user, { command: data.command || '' });
      return;
    }
    if (!ws.agentConversation) {
      send(ws, { type: 'agent:error', error: 'No active conversation.' });
      return;
    }
    const result = await ws.agentConversation.tools.executeCommand(data.command);
    send(ws, { type: 'agent:terminal_result', result });
    logAgentEvent('agent:terminal_result', ws.user, { success: result?.success !== false });
  };

  const cleanup = (ws) => {
    if (ws.fileWatcher) ws.fileWatcher.stop();
  };

  return Object.freeze({ cleanup, runTask, runTerminal, runTool });
};

module.exports = {
  createAgentTaskService
};
