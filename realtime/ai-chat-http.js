// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const createAiChatHttpHandler = ({
  authorizeHttpRequest,
  readJsonBody,
  sendJson,
  getAiConfig,
  sanitizeConversationMessages,
  enrichMessagesWithOcr,
  resolveAgentRoute,
  fetchSemanticContext,
  safeFetchBusinessSnapshot,
  resolveAgentRuntimeConfig,
  shouldApplyEnterpriseOutputGuard,
  composeAgentMessages,
  callAiUpstreamWithRetry,
  applyEnterpriseOutputGuard,
  setCorsHeaders,
  streamTextAsSse,
  extractCompletionText
}) => async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  try {
    const cfg = await getAiConfig();
    const rawMessages = sanitizeConversationMessages(body?.messages);
    const ocrResult = await enrichMessagesWithOcr(rawMessages);
    const sanitizedMessages = ocrResult.messages;
    const route = resolveAgentRoute({ user, body, messages: sanitizedMessages });

    try {
      const semanticCtx = await fetchSemanticContext(user);
      if (semanticCtx) {
        if (!route.context) route.context = {};
        route.context.semanticContext = semanticCtx;
      }
    } catch (error) {
      console.warn('[ai-chat] semantic context fetch failed:', error?.message || error);
    }

    if (route.agentId === 'enterprise_analyst') {
      const snapshot = await safeFetchBusinessSnapshot(user, 'ai-chat');
      if (!route.context) route.context = {};
      route.context.businessSnapshot = snapshot;
    }

    const agentRuntime = resolveAgentRuntimeConfig(cfg, route.agentId);
    const useStream = body?.stream === true;
    const requiresGuard = shouldApplyEnterpriseOutputGuard(route);
    const upstreamPayload = {
      ...body,
      messages: composeAgentMessages({ route, user, messages: sanitizedMessages })
    };
    console.log('[ai-route]', JSON.stringify({
      role: user.role || '',
      mode: route.requestedMode,
      intent: route.intent,
      agent: route.agentId,
      model: agentRuntime.model,
      guard: requiresGuard,
      ocrImages: ocrResult.ocr.length,
      sample: route.latestUserText.slice(0, 120)
    }));

    const upstream = await callAiUpstreamWithRetry(upstreamPayload, {
      forceStream: useStream && !requiresGuard,
      cfg,
      agentRuntime
    }, {
      maxRetries: 2,
      baseDelayMs: 320
    });
    if (!upstream.ok) {
      sendJson(res, upstream.status, upstream.payload);
      return;
    }

    if (!upstream.stream) {
      const guarded = await applyEnterpriseOutputGuard({
        data: upstream.data || {},
        route,
        cfg,
        agentRuntime
      });
      const headers = {
        'X-Eis-Ai-Agent': route.agentId,
        'X-Eis-Ai-Intent': route.intent,
        'X-Eis-Ai-Guard': guarded.guardApplied ? 'rewrite' : 'pass'
      };

      if (!useStream) {
        sendJson(res, 200, guarded.guardedData || {}, headers);
        return;
      }

      setCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...headers
      });
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      streamTextAsSse(res, extractCompletionText(guarded.guardedData || {}));
      return;
    }

    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Eis-Ai-Agent': route.agentId,
      'X-Eis-Ai-Intent': route.intent,
      'X-Eis-Ai-Guard': 'stream-pass'
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const stream = upstream.response.body;
    if (!stream) {
      sendJson(res, 502, { code: 'AI_STREAM_FAILED', message: 'AI upstream stream is unavailable' });
      return;
    }

    if (typeof stream.on === 'function') {
      const abortStream = () => {
        if (typeof stream.destroy === 'function') stream.destroy();
      };
      req.on('close', abortStream);
      stream.on('data', (chunk) => {
        if (!res.writableEnded) res.write(chunk);
      });
      stream.on('end', () => {
        if (!res.writableEnded) res.end();
      });
      stream.on('error', () => {
        if (!res.writableEnded) {
          res.write('data: {"error":"stream_failed"}\n\n');
          res.end();
        }
      });
      stream.on('close', () => {
        req.off('close', abortStream);
      });
      return;
    }

    if (typeof stream.getReader !== 'function') {
      sendJson(res, 502, { code: 'AI_STREAM_FAILED', message: 'AI upstream stream is unavailable' });
      return;
    }

    const reader = stream.getReader();
    const abortStream = () => {
      reader.cancel().catch(() => {});
    };
    req.on('close', abortStream);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && !res.writableEnded) {
          res.write(Buffer.from(value));
        }
      }
      if (!res.writableEnded) res.end();
    } catch {
      if (!res.writableEnded) {
        res.write('data: {"error":"stream_failed"}\n\n');
        res.end();
      }
    } finally {
      req.off('close', abortStream);
      try {
        reader.releaseLock();
      } catch { /* ignore */ }
    }
  } catch (error) {
    sendJson(res, 500, { code: 'AI_CHAT_FAILED', message: error.message || 'AI chat failed' });
  }
};

module.exports = { createAiChatHttpHandler };
