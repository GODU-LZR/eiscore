// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const { TwinEngine: DefaultTwinEngine } = require('./twin-engine');
const {
  createTwinTools: defaultCreateTwinTools,
  buildTwinSystemPrompt: defaultBuildTwinSystemPrompt,
  createPersistence: defaultCreatePersistence
} = require('./twin-tools');

const createTwinChatHttpHandler = ({
  authorizeTwinRequest,
  readJsonBody,
  normalizeAiText,
  sendJson,
  getAiConfig,
  bindPgQueryForUser,
  fetchSemanticContext,
  callAiUpstreamWithRetry,
  setCorsHeaders,
  extractCompletionText,
  waitMs,
  writeSsePayload,
  iterateAiStreamChunks,
  extractStreamDeltaText,
  writeSseDone,
  aiUpstreamTimeoutMs,
  TwinEngine = DefaultTwinEngine,
  createTwinTools = defaultCreateTwinTools,
  buildTwinSystemPrompt = defaultBuildTwinSystemPrompt,
  createPersistence = defaultCreatePersistence
}) => async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const userMessage = normalizeAiText(body?.message || body?.content || '');
  if (!userMessage) {
    sendJson(res, 400, { code: 'MESSAGE_REQUIRED', message: 'message is required' });
    return;
  }

  try {
    const cfg = await getAiConfig();
    if (!cfg?.api_url || !cfg?.api_key) {
      sendJson(res, 503, { code: 'AI_CONFIG_MISSING', message: 'AI configuration not available' });
      return;
    }

    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);

    let sessionId = body.session_id || null;
    if (!sessionId) {
      try {
        sessionId = await persistence.createSession(
          userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '')
        );
      } catch (error) {
        console.warn('[twin-chat] create session failed:', error?.message);
      }
    }

    let history = [];
    if (sessionId) {
      try {
        history = await persistence.loadHistory(sessionId, 12);
      } catch (error) {
        console.warn('[twin-chat] load history failed:', error?.message);
      }
    }
    if (!history.length && Array.isArray(body.history)) {
      history = body.history
        .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && message.content)
        .slice(-12)
        .map((message) => ({ role: message.role, content: String(message.content).slice(0, 4000) }));
    }

    let semanticCtx = null;
    try {
      semanticCtx = await fetchSemanticContext(user);
    } catch (error) {
      console.warn('[twin-chat] semantic context failed:', error?.message);
    }

    const tools = createTwinTools(pgQuery, user);
    const systemPrompt = buildTwinSystemPrompt(user, semanticCtx);

    const aiCaller = async ({ model, messages }) => {
      const payload = {
        model: model || cfg.model || 'glm-4.6v',
        stream: false,
        thinking: { type: 'disabled' },
        messages
      };
      const result = await callAiUpstreamWithRetry(
        payload,
        { forceStream: false, cfg },
        { maxRetries: 3, baseDelayMs: 320 }
      );
      if (!result.ok) {
        throw new Error(result.payload?.message || 'AI upstream failed');
      }
      return result.data;
    };

    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Eis-Agent': 'digital_twin',
      'X-Eis-Session': sessionId || ''
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const sendSseEvent = (eventType, data) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`);
      }
    };

    let aborted = false;
    req.on('close', () => { aborted = true; });

    const streamingAiCaller = async ({ model, messages }) => {
      const payload = {
        model: model || cfg.model || 'glm-4.6v',
        stream: true,
        thinking: { type: 'disabled' },
        messages
      };
      const upstream = await callAiUpstreamWithRetry(
        payload,
        { forceStream: true, cfg },
        { maxRetries: 3, baseDelayMs: 320 }
      );
      if (!upstream.ok) {
        throw new Error(upstream.payload?.message || 'AI upstream failed');
      }

      if (!upstream.stream) {
        const text = extractCompletionText(upstream.data || {});
        const chunkSize = 20;
        for (let index = 0; index < text.length; index += chunkSize) {
          if (aborted) break;
          writeSsePayload(res, { choices: [{ delta: { content: text.slice(index, index + chunkSize) } }] });
          await waitMs(25);
        }
        return text;
      }

      const upstreamBody = upstream.response.body;
      if (!upstreamBody || (typeof upstreamBody.getReader !== 'function' && typeof upstreamBody[Symbol.asyncIterator] !== 'function')) {
        throw new Error('AI upstream stream is unavailable');
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let sseBuffer = '';
      const streamTimeout = setTimeout(() => {
        console.warn('[twin-stream] stream read timeout, cancelling');
        try { upstreamBody.destroy?.(); } catch { /* ignore */ }
        try { upstreamBody.cancel?.(); } catch { /* ignore */ }
      }, aiUpstreamTimeoutMs || 60000);

      try {
        for await (const value of iterateAiStreamChunks(upstreamBody)) {
          if (aborted) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = extractStreamDeltaText(parsed);
              if (delta) {
                fullText += delta;
                if (!res.writableEnded) {
                  writeSsePayload(res, { choices: [{ delta: { content: delta } }] });
                }
              }
            } catch { /* skip unparseable chunk */ }
          }
        }
      } finally {
        clearTimeout(streamTimeout);
      }

      return fullText;
    };

    const engine = new TwinEngine({
      aiCaller,
      streamingAiCaller,
      tools,
      systemPrompt,
      model: cfg.model || 'glm-4.6v',
      maxTurns: 6,
      turnDelayMs: 120,
      onEvent: (event) => {
        if (aborted) return;
        sendSseEvent(event.type, event);
      },
      persistence
    });

    console.log('[twin-chat]', JSON.stringify({
      user: user.username,
      session: sessionId,
      msgLen: userMessage.length,
      tools: Object.keys(tools).length
    }));

    const result = await engine.run(userMessage, history, { sessionId });

    if (!aborted && !res.writableEnded) {
      if (!result.streamed) {
        const answer = result.answer || '';
        const chunkSize = 20;
        for (let index = 0; index < answer.length; index += chunkSize) {
          if (aborted) break;
          writeSsePayload(res, { choices: [{ delta: { content: answer.slice(index, index + chunkSize) } }] });
          await waitMs(25);
        }
      }
      sendSseEvent('meta', {
        session_id: sessionId,
        turns: result.turns,
        tool_calls: result.toolLogs.length
      });
      writeSseDone(res);
    }
  } catch (error) {
    console.error('[twin-chat] error:', error?.message || error);
    if (!res.headersSent) {
      sendJson(res, 500, { code: 'TWIN_CHAT_FAILED', message: error?.message || 'Digital twin chat failed' });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error?.message || 'Internal error' })}\n\n`);
      res.end();
    }
  }
};

module.exports = { createTwinChatHttpHandler };
