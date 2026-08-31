// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const createAiHttpHandlers = ({
  authorizeHttpRequest,
  getAiConfig,
  getAiVisionConfig,
  buildAgentCatalog,
  safeFetchBusinessSnapshot,
  readJsonBody,
  normalizeAiText,
  callAiUpstreamWithRetry,
  callAiVisionUpstreamWithRetry,
  runImageOcr,
  cleanModelText,
  extractCompletionText,
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

  const handleTranslate = async (req, res) => {
    const user = authorizeHttpRequest(req, res);
    if (!user) return;

    let body = {};
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
      return;
    }

    const text = normalizeAiText(body?.text);
    if (!text) {
      sendJson(res, 400, { code: 'TEXT_REQUIRED', message: 'text is required' });
      return;
    }

    const systemPrompt = normalizeAiText(body?.prompt) ||
      '你是翻译助手。把用户输入翻译成简洁、自然的中文地址，只输出翻译结果，不要添加任何解释。若输入已是中文，原样输出。';

    try {
      const upstream = await callAiUpstreamWithRetry({
        model: body?.model,
        stream: false,
        thinking: body?.thinking || { type: 'disabled' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      }, { forceStream: false }, { maxRetries: 1, baseDelayMs: 260 });

      if (!upstream.ok) {
        sendJson(res, upstream.status, upstream.payload);
        return;
      }

      const translated = cleanModelText(extractCompletionText(upstream.data));
      sendJson(res, 200, { text: translated || text });
    } catch (error) {
      sendJson(res, 500, { code: 'AI_TRANSLATE_FAILED', message: error.message || 'Translate failed' });
    }
  };

  const handleOcr = async (req, res) => {
    const user = authorizeHttpRequest(req, res);
    if (!user) return;

    let body = {};
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
      return;
    }

    const imageUrl = normalizeAiText(body?.imageUrl || body?.image_url);
    if (!imageUrl) {
      sendJson(res, 400, { code: 'IMAGE_REQUIRED', message: 'imageUrl is required' });
      return;
    }

    try {
      const result = await runImageOcr(imageUrl, body?.prompt);
      if (!result.ok) {
        sendJson(res, result.status || 502, {
          code: 'AI_OCR_FAILED',
          message: result.error || 'OCR failed'
        });
        return;
      }
      sendJson(res, 200, { text: result.text, model: result.model });
    } catch (error) {
      sendJson(res, 500, { code: 'AI_OCR_FAILED', message: error.message || 'OCR failed' });
    }
  };

  const handleMapLocate = async (req, res) => {
    const user = authorizeHttpRequest(req, res);
    if (!user) return;

    let body = {};
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
      return;
    }

    const imageUrl = normalizeAiText(body?.imageUrl || body?.image_url);
    const lat = body?.lat;
    const lng = body?.lng;
    if (!imageUrl) {
      sendJson(res, 400, { code: 'IMAGE_REQUIRED', message: 'imageUrl is required' });
      return;
    }

    const prompt = normalizeAiText(body?.prompt) ||
      `请根据地图截图上的中文地名，且以蓝色圆点为用户当前位置，找出离蓝点最近的街道级位置。输出严格格式的中文位置：“省-市-区/县/县级市-街道/乡镇”。必须包含街道级；如果无法确定街道，请用“某街道”或“附近街道”占位，但仍要输出四段。只输出位置，不要解释，不要多余的话。坐标：${lng},${lat}`;

    try {
      const cfg = await getAiVisionConfig();
      const upstream = await callAiVisionUpstreamWithRetry({
        model: body?.model,
        stream: false,
        temperature: cfg?.temperature ?? 0,
        max_tokens: cfg?.max_tokens || 512,
        messages: [
          { role: 'system', content: '你是位置识别助手，只输出中文位置名称。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      }, { cfg }, { maxRetries: 1, baseDelayMs: 360 });

      if (!upstream.ok) {
        sendJson(res, upstream.status, upstream.payload);
        return;
      }

      const address = cleanModelText(extractCompletionText(upstream.data));
      sendJson(res, 200, { address });
    } catch (error) {
      sendJson(res, 500, { code: 'AI_MAP_LOCATE_FAILED', message: error.message || 'Map locate failed' });
    }
  };

  return Object.freeze({
    handleConfig,
    handleAgents,
    handleBusinessSnapshot,
    handleTranslate,
    handleOcr,
    handleMapLocate
  });
};

module.exports = { createAiHttpHandlers };
