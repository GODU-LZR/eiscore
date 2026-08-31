// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const axios = require('axios');

const defaultNormalizeText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return String(value.text || '').trim();
  return String(value).trim();
};

const defaultNormalizeToolsWhitelist = (value) => {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(list.map((item) => String(item).trim().toLowerCase()).filter(Boolean)));
};

const buildAxiosProxyConfig = (proxyUrl) => {
  const raw = String(proxyUrl || '').trim();
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    return {
      protocol: parsed.protocol.replace(':', '') || 'http',
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
      auth: parsed.username
        ? {
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password || '')
          }
        : undefined
    };
  } catch {
    return undefined;
  }
};

async function* iterateAiStreamChunks(body) {
  if (!body) return;
  if (typeof body.getReader === 'function') {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield value;
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    return;
  }
  if (typeof body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body) {
      if (chunk) yield chunk;
    }
  }
}

const createAiRuntimeService = ({
  queryConfig,
  configKey = 'ai_glm_config',
  visionConfigKey = 'ai_vision_config',
  configTtlMs = 30 * 1000,
  upstreamTimeoutMs = 120 * 1000,
  proxyUrl = '',
  axiosClient = axios,
  normalizeText = defaultNormalizeText,
  normalizeToolsWhitelist = defaultNormalizeToolsWhitelist,
  clock = () => Date.now(),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
  log = console
}) => {
  if (typeof queryConfig !== 'function') throw new Error('queryConfig is required');

  let configCache = null;
  let configLoadedAt = 0;
  let visionConfigCache = null;
  let visionConfigLoadedAt = 0;
  const axiosProxy = buildAxiosProxyConfig(proxyUrl);

  const loadConfig = async (key) => {
    const result = await queryConfig(
      'SELECT value FROM public.system_configs WHERE key = $1 LIMIT 1',
      [key]
    );
    const value = result?.rows?.[0]?.value;
    return (value && typeof value === 'object') ? value : null;
  };

  const getAiConfig = async () => {
    const now = clock();
    if (configCache && (now - configLoadedAt) < configTtlMs) return configCache;
    configCache = await loadConfig(configKey);
    configLoadedAt = now;
    return configCache;
  };

  const getAiVisionConfig = async () => {
    const now = clock();
    if (visionConfigCache && (now - visionConfigLoadedAt) < configTtlMs) return visionConfigCache;
    visionConfigCache = await loadConfig(visionConfigKey);
    visionConfigLoadedAt = now;
    return visionConfigCache;
  };

  const getToolName = (tool) => {
    if (!tool || typeof tool !== 'object') return '';
    const value = tool?.function?.name || tool?.name || tool?.id || tool?.type || '';
    return String(value).trim().toLowerCase();
  };

  const applyToolWhitelist = (payload, whitelist) => {
    if (!payload || !Array.isArray(payload.tools)) return;
    const normalized = normalizeToolsWhitelist(whitelist);
    if (normalized.length === 0) {
      delete payload.tools;
      return;
    }
    if (normalized.includes('*')) return;
    payload.tools = payload.tools.filter((tool) => normalized.includes(getToolName(tool)));
    if (payload.tools.length === 0) delete payload.tools;
  };

  const buildUpstreamPayload = (incoming, cfg, forceStream = false, agentRuntime = null) => {
    const payload = (incoming && typeof incoming === 'object') ? { ...incoming } : {};
    delete payload.api_key;
    delete payload.api_url;
    delete payload.assistant_mode;
    delete payload.assistantMode;
    delete payload.mode;
    delete payload.context;
    delete payload.agent;
    delete payload.agent_id;
    delete payload.agent_target;

    if (!payload.model) payload.model = agentRuntime?.model || cfg?.model || 'glm-4.6v';
    if (payload.temperature === undefined && Number.isFinite(agentRuntime?.temperature)) {
      payload.temperature = agentRuntime.temperature;
    }
    if (payload.top_p === undefined && Number.isFinite(agentRuntime?.top_p)) {
      payload.top_p = agentRuntime.top_p;
    }
    if (payload.max_tokens === undefined && Number.isFinite(agentRuntime?.max_tokens)) {
      payload.max_tokens = agentRuntime.max_tokens;
    }
    if (forceStream) payload.stream = true;
    if (payload.thinking === undefined && agentRuntime?.thinking) payload.thinking = agentRuntime.thinking;
    if (payload.thinking === undefined && cfg?.thinking) payload.thinking = cfg.thinking;
    applyToolWhitelist(payload, agentRuntime?.tools_whitelist);
    return payload;
  };

  const buildVisionPayload = (incoming, cfg) => {
    const payload = (incoming && typeof incoming === 'object') ? { ...incoming } : {};
    delete payload.api_key;
    delete payload.api_url;
    delete payload.provider;
    if (!payload.model) payload.model = cfg?.model;
    if (payload.stream === undefined) payload.stream = false;
    if (payload.temperature === undefined && cfg?.temperature !== undefined) {
      payload.temperature = cfg.temperature;
    }
    if (payload.max_tokens === undefined) payload.max_tokens = cfg?.max_tokens || 512;
    return payload;
  };

  const callJsonHttp = async (url, payload, { apiKey, timeoutMs = upstreamTimeoutMs } = {}) => {
    const response = await axiosClient.post(url, payload, {
      timeout: timeoutMs,
      responseType: 'text',
      decompress: true,
      proxy: axiosProxy,
      validateStatus: () => true,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      transitional: { forcedJSONParsing: false, silentJSONParsing: false }
    });
    const raw = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data || {});
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: raw
    };
  };

  const callStreamHttp = async (url, payload, { apiKey, timeoutMs = upstreamTimeoutMs } = {}) => {
    const response = await axiosClient.post(url, payload, {
      timeout: timeoutMs,
      responseType: 'stream',
      decompress: true,
      proxy: axiosProxy,
      validateStatus: () => true,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      stream: response.data
    };
  };

  const shouldRetryUpstream = (result) => {
    if (!result || result.ok) return false;
    const status = Number(result.status || 0);
    if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
    const message = normalizeText(result?.payload?.message).toLowerCase();
    return /timeout|upstream|network|failed/.test(message);
  };

  const callAiUpstream = async (incomingPayload, options = {}) => {
    const forceStream = options?.forceStream === true;
    const cfg = options?.cfg || await getAiConfig();
    const agentRuntime = options?.agentRuntime || null;
    if (!cfg?.api_url || !cfg?.api_key) {
      return {
        ok: false,
        status: 503,
        payload: { code: 'AI_CONFIG_MISSING', message: 'AI configuration is missing in system_configs.ai_glm_config' }
      };
    }

    const payload = buildUpstreamPayload(incomingPayload, cfg, forceStream, agentRuntime);
    const streamMode = !!payload.stream;
    try {
      if (streamMode) {
        const streamResult = await callStreamHttp(cfg.api_url, payload, { apiKey: cfg.api_key });
        if (!streamResult.ok) {
          let detail = '';
          try {
            for await (const chunk of streamResult.stream) {
              detail += Buffer.from(chunk).toString('utf8');
              if (detail.length >= 2000) break;
            }
          } catch {
            // Ignore stream read errors on failed upstream responses.
          }
          return {
            ok: false,
            status: streamResult.status || 502,
            payload: {
              code: 'AI_UPSTREAM_ERROR',
              message: 'AI upstream request failed',
              detail: detail.slice(0, 2000)
            }
          };
        }
        return { ok: true, stream: true, response: { body: streamResult.stream }, config: cfg, payload };
      }

      const jsonResult = await callJsonHttp(cfg.api_url, payload, { apiKey: cfg.api_key });
      if (!jsonResult.ok) {
        return {
          ok: false,
          status: jsonResult.status || 502,
          payload: {
            code: 'AI_UPSTREAM_ERROR',
            message: 'AI upstream request failed',
            detail: String(jsonResult.data || '').slice(0, 2000)
          }
        };
      }
      let data = {};
      if (jsonResult.data) {
        try {
          data = JSON.parse(jsonResult.data);
        } catch {
          data = { raw: jsonResult.data };
        }
      }
      return { ok: true, stream: false, data, config: cfg, payload };
    } catch (error) {
      const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''));
      const endpoint = normalizeText(cfg?.api_url || '').slice(0, 200);
      const errorCode = normalizeText(error?.cause?.code || error?.code || '').slice(0, 64);
      log.warn('[ai-upstream] fetch failed:', JSON.stringify({
        timeout: isTimeout,
        code: errorCode || 'N/A',
        message: normalizeText(error?.message || 'fetch failed').slice(0, 240),
        endpoint
      }));
      return {
        ok: false,
        status: 502,
        payload: {
          code: 'AI_UPSTREAM_ERROR',
          message: isTimeout
            ? `AI upstream timeout after ${upstreamTimeoutMs}ms`
            : ((errorCode ? `${errorCode}: ` : '') + (error?.message || 'AI upstream request failed')),
          detail: ''
        }
      };
    }
  };

  const callAiUpstreamWithRetry = async (incomingPayload, options = {}, retryConfig = {}) => {
    const maxRetries = Number(retryConfig.maxRetries);
    const retries = Number.isFinite(maxRetries) && maxRetries > 0 ? Math.floor(maxRetries) : 2;
    const baseDelayMs = Number(retryConfig.baseDelayMs);
    const delay = Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? Math.floor(baseDelayMs) : 320;

    let attempt = 0;
    let result = await callAiUpstream(incomingPayload, options);
    while (attempt < retries && shouldRetryUpstream(result)) {
      attempt += 1;
      const jitter = Math.floor(random() * 80);
      await wait(delay * attempt + jitter);
      result = await callAiUpstream(incomingPayload, options);
    }
    return result;
  };

  const callAiVisionUpstream = async (incomingPayload, options = {}) => {
    const cfg = options?.cfg || await getAiVisionConfig();
    if (!cfg?.api_url || !cfg?.api_key) {
      return {
        ok: false,
        status: 503,
        payload: { code: 'AI_VISION_CONFIG_MISSING', message: 'AI vision configuration is missing in system_configs.ai_vision_config' }
      };
    }

    const payload = buildVisionPayload(incomingPayload, cfg);
    try {
      const jsonResult = await callJsonHttp(cfg.api_url, payload, { apiKey: cfg.api_key });
      if (!jsonResult.ok) {
        return {
          ok: false,
          status: jsonResult.status || 502,
          payload: {
            code: 'AI_VISION_UPSTREAM_ERROR',
            message: 'AI vision upstream request failed',
            detail: String(jsonResult.data || '').slice(0, 2000)
          }
        };
      }

      let data = {};
      if (jsonResult.data) {
        try {
          data = JSON.parse(jsonResult.data);
        } catch {
          data = { raw: jsonResult.data };
        }
      }
      return { ok: true, stream: false, data, config: cfg, payload };
    } catch (error) {
      const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''));
      return {
        ok: false,
        status: 502,
        payload: {
          code: 'AI_VISION_UPSTREAM_ERROR',
          message: isTimeout
            ? `AI vision upstream timeout after ${upstreamTimeoutMs}ms`
            : (error?.message || 'AI vision upstream request failed')
        }
      };
    }
  };

  const callAiVisionUpstreamWithRetry = async (incomingPayload, options = {}, retryConfig = {}) => {
    const maxRetries = Number(retryConfig.maxRetries);
    const retries = Number.isFinite(maxRetries) && maxRetries > 0 ? Math.floor(maxRetries) : 1;
    const baseDelayMs = Number(retryConfig.baseDelayMs);
    const delay = Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? Math.floor(baseDelayMs) : 420;

    let attempt = 0;
    let result = await callAiVisionUpstream(incomingPayload, options);
    while (attempt < retries && shouldRetryUpstream(result)) {
      attempt += 1;
      const jitter = Math.floor(random() * 120);
      await wait(delay * attempt + jitter);
      result = await callAiVisionUpstream(incomingPayload, options);
    }
    return result;
  };

  return Object.freeze({
    getAiConfig,
    getAiVisionConfig,
    callAiUpstream,
    callAiUpstreamWithRetry,
    callAiVisionUpstream,
    callAiVisionUpstreamWithRetry,
    iterateAiStreamChunks,
    waitMs: wait
  });
};

module.exports = {
  buildAxiosProxyConfig,
  createAiRuntimeService,
  iterateAiStreamChunks
};
