// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const normalizeStringList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
};

const createAgentAccessService = ({
  environment = process.env,
  normalizeProjectPath,
  normalizeRelativeAgentPath,
  normalizeText,
  cleanModelText,
  extractCompletionText,
  callAiUpstreamWithRetry,
  writeLog = (...args) => console.log(...args),
  nowIso = () => new Date().toISOString()
}) => {
  const allowedRoles = normalizeStringList(environment.AGENT_ALLOWED_ROLES || 'super_admin')
    .map((role) => String(role).toLowerCase());
  const allowedProjects = normalizeStringList(
    environment.AGENT_ALLOWED_PROJECTS ||
      'eiscore-apps/src/views/drafts,eiscore-apps,eiscore-base,eiscore-hr,eiscore-materials,realtime,scripts,sql,env,nginx,docs'
  )
    .map((item) => normalizeProjectPath(item))
    .filter(Boolean);
  const allowAll = String(environment.AGENT_ALLOW_ALL || '').toLowerCase() === 'true';

  const sanitizeWritePolicy = (rawPolicy) => {
    const policy = (rawPolicy && typeof rawPolicy === 'object') ? rawPolicy : {};
    const allowedFiles = Array.isArray(policy.allowedFiles)
      ? policy.allowedFiles.map(normalizeRelativeAgentPath).filter(Boolean)
      : [];
    const allowedDirs = Array.isArray(policy.allowedDirs)
      ? policy.allowedDirs
        .map(normalizeRelativeAgentPath)
        .map((item) => item.replace(/\/+$/, ''))
        .filter(Boolean)
      : [];
    return { allowedFiles, allowedDirs };
  };

  const resolveDefaultWritePolicy = (projectPath) => {
    const normalizedProject = normalizeProjectPath(projectPath);
    if (normalizedProject === 'eiscore-apps/src/views/drafts') {
      return { allowedFiles: ['FlashDraft.vue'], allowedDirs: [] };
    }
    if (normalizedProject === 'eiscore-apps') {
      return { allowedFiles: ['src/views/drafts/FlashDraft.vue'], allowedDirs: [] };
    }
    return { allowedFiles: [], allowedDirs: [] };
  };

  const canUseAgent = (user) => {
    if (allowAll) return true;
    const role = String(user?.role || '').toLowerCase();
    return allowedRoles.includes(role);
  };

  const isAllowedProject = (projectPath) => {
    const normalized = normalizeProjectPath(projectPath);
    if (!normalized) return false;
    return allowedProjects.some((allowed) => (
      normalized === allowed || normalized.startsWith(`${allowed}/`)
    ));
  };

  const logAgentEvent = (type, user, details) => {
    const payload = {
      ts: nowIso(),
      type,
      user: { id: user?.id || '', role: user?.role || '' },
      details: details || {}
    };
    writeLog('[agent]', JSON.stringify(payload));
  };

  const normalizeAgentTaskErrorMessage = (error) => {
    const text = String(error?.message || '').trim();
    if (!text) return 'Agent task execution failed';
    const lower = text.toLowerCase();
    if (lower.includes('connection error') || lower.includes('network error') || lower.includes('socket hang up')) {
      return 'AI upstream connection error';
    }
    if (lower.includes('timeout')) return 'AI upstream timeout';
    return text.slice(0, 300);
  };

  const createAgentTaskAiInvoker = (cfg) => {
    return async ({ model, maxTokens, systemPrompt, messages }) => {
      const payload = {
        model: String(model || cfg?.model || 'glm-4.6v').trim() || 'glm-4.6v',
        max_tokens: Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : 8192,
        stream: false,
        messages: [
          { role: 'system', content: normalizeText(systemPrompt) || '' },
          ...(Array.isArray(messages) ? messages : [])
            .map((item) => {
              const role = String(item?.role || '').trim();
              const content = normalizeText(item?.content);
              if (!role || !content) return null;
              return { role, content };
            })
            .filter(Boolean)
        ]
      };

      const upstream = await callAiUpstreamWithRetry(payload, {
        forceStream: false,
        cfg
      }, {
        maxRetries: 2,
        baseDelayMs: 320
      });

      if (!upstream.ok) {
        const detailText = normalizeText(upstream?.payload?.detail);
        const message = normalizeText(upstream?.payload?.message) || 'AI upstream request failed';
        const error = new Error(detailText ? `${message}: ${detailText}` : message);
        error.code = upstream?.payload?.code || 'AI_UPSTREAM_ERROR';
        error.status = Number(upstream?.status || 502);
        throw error;
      }

      const text = cleanModelText(extractCompletionText(upstream.data));
      if (!text) throw new Error('AI upstream returned empty content');
      return text;
    };
  };

  return Object.freeze({
    canUseAgent,
    createAgentTaskAiInvoker,
    isAllowedProject,
    logAgentEvent,
    normalizeAgentTaskErrorMessage,
    resolveDefaultWritePolicy,
    sanitizeWritePolicy
  });
};

module.exports = {
  createAgentAccessService
};
