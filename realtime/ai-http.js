// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const createAiHttpHandlers = ({
  authorizeHttpRequest,
  getAiConfig,
  getAiVisionConfig,
  buildAgentCatalog,
  safeFetchBusinessSnapshot,
  sendJson
}) => {
  const handleConfig = async (req, res) => {
    const user = authorizeHttpRequest(req, res);
    if (!user) return;

    try {
      const cfg = await getAiConfig();
      const visionCfg = await getAiVisionConfig().catch(() => null);
      const agents = buildAgentCatalog(user, cfg);
      sendJson(res, 200, {
        enabled: !!(cfg?.api_url && cfg?.api_key),
        model: cfg?.model || 'glm-4.6v',
        provider: cfg?.provider || 'glm',
        stream: true,
        vision: {
          enabled: !!(visionCfg?.api_url && visionCfg?.api_key),
          model: visionCfg?.model || '',
          provider: visionCfg?.provider || ''
        },
        agents
      });
    } catch (error) {
      sendJson(res, 500, { code: 'AI_CONFIG_LOAD_FAILED', message: error.message || 'Failed to load AI config' });
    }
  };

  const handleAgents = async (req, res) => {
    const user = authorizeHttpRequest(req, res);
    if (!user) return;
    try {
      const cfg = await getAiConfig();
      const agents = buildAgentCatalog(user, cfg);
      sendJson(res, 200, { role: user.role || '', agents });
    } catch (error) {
      sendJson(res, 500, { code: 'AI_CONFIG_LOAD_FAILED', message: error.message || 'Failed to load AI config' });
    }
  };

  const handleBusinessSnapshot = async (req, res) => {
    const user = authorizeHttpRequest(req, res);
    if (!user) return;

    const snapshot = await safeFetchBusinessSnapshot(user, 'ai-business-snapshot');
    const fallbackMessage = snapshot?._meta?.fallback ? snapshot._meta.error : '';
    sendJson(res, 200, {
      ok: !fallbackMessage,
      snapshot,
      ...(fallbackMessage ? { warning: fallbackMessage } : {})
    });
  };

  return Object.freeze({ handleConfig, handleAgents, handleBusinessSnapshot });
};

module.exports = { createAiHttpHandlers };
