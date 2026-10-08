'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createHarnessTwinChatHttpHandler = ({ authorize, readJsonBody, sendJson, gateway, createPersistence, setCorsHeaders, streamTextAsSse, managePersistence = false, enabled = true }) => async (req, res) => {
  const user = authorize(req, res);
  if (!user) return;
  if (!enabled) { sendJson(res, 503, { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' }); return; }
  let body;
  try { body = await readJsonBody(req); } catch (error) { sendJson(res, 400, { code: 'BAD_REQUEST', message: error?.message === 'Payload too large' ? 'Payload too large' : 'Invalid request body' }); return; }
  const message = String(body.message || body.content || '').trim();
  if (!message) { sendJson(res, 400, { code: 'MESSAGE_REQUIRED', message: 'message is required' }); return; }
  if (managePersistence) {
    const requestedSessionId = String(body.session_id || body.sessionId || '').trim();
    if (requestedSessionId && !UUID_RE.test(requestedSessionId)) { sendJson(res, 400, { code: 'SESSION_ID_INVALID', message: 'session_id must be a UUID' }); return; }
    let result;
    try {
      result = await gateway.execute({
        request_id: body.request_id || body.requestId,
        session_id: requestedSessionId || undefined,
        plugin_id: 'digital-twin',
        agent_id: 'digital_twin',
        capability_id: 'eiscore_twin_chat',
        user,
        signal: req.signal,
        payload: { message, ...(requestedSessionId ? { session_id: requestedSessionId } : {}), stream: body.stream !== false }
      });
    } catch {
      sendJson(res, 502, { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' });
      return;
    }
    if (!result.ok) { sendJson(res, result.status || 502, { code: result.code, message: result.message }); return; }
    const data = result.data || {};
    const sessionId = String(data.session_id || requestedSessionId || '');
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Eis-Agent': 'digital_twin', 'X-Eis-Session': sessionId, 'X-Eis-Ai-Backend': 'harness' });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    streamTextAsSse(res, data.text || data.output_text || data.choices?.[0]?.message?.content || '');
    return;
  }
  if (typeof createPersistence !== 'function') { sendJson(res, 503, { code: 'HARNESS_TWIN_PERSISTENCE_UNAVAILABLE', message: 'Digital twin persistence is unavailable' }); return; }
  const requestedSessionId = String(body.session_id || body.sessionId || '').trim();
  if (requestedSessionId && !UUID_RE.test(requestedSessionId)) { sendJson(res, 400, { code: 'SESSION_ID_INVALID', message: 'session_id must be a UUID' }); return; }
  let persistence;
  let sessionId = requestedSessionId || null;
  try {
    persistence = createPersistence(user);
    if (!persistence || typeof persistence.createSession !== 'function' || typeof persistence.saveMessage !== 'function' || typeof persistence.loadHistory !== 'function') throw new Error('Digital twin persistence is unavailable');
    if (sessionId) {
      if (typeof persistence.getSession !== 'function') throw new Error('Digital twin session ownership check is unavailable');
      const session = await persistence.getSession(sessionId);
      if (!session) { sendJson(res, 403, { code: 'SESSION_ACCESS_DENIED', message: 'Digital twin session is not available' }); return; }
    } else {
      sessionId = await persistence.createSession(message.slice(0, 30) + (message.length > 30 ? '...' : ''));
      if (!sessionId || !UUID_RE.test(String(sessionId))) throw new Error('Digital twin session could not be created');
    }
    const history = await persistence.loadHistory(sessionId, 12);
    await persistence.saveMessage(sessionId, 'user', message);
    const result = await gateway.execute({ request_id: body.request_id || body.requestId, session_id: sessionId, plugin_id: 'digital-twin', agent_id: 'digital_twin', capability_id: 'eiscore_twin_chat', user, signal: req.signal, payload: { message, session_id: sessionId, history: Array.isArray(history) ? history.slice(-12) : [], stream: body.stream !== false } });
    if (!result.ok) { sendJson(res, result.status || 502, { code: result.code, message: result.message }); return; }
    const data = result.data || {};
    const answer = String(data.text || data.output_text || data.choices?.[0]?.message?.content || '').trim();
    if (answer) await persistence.saveMessage(sessionId, 'assistant', answer);
    const responseData = { ...data, session_id: sessionId };
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Eis-Agent': 'digital_twin', 'X-Eis-Session': sessionId, 'X-Eis-Ai-Backend': 'harness' });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    streamTextAsSse(res, responseData.text || responseData.output_text || responseData.choices?.[0]?.message?.content || '');
  } catch (error) {
    if (!res.headersSent) sendJson(res, 503, { code: 'HARNESS_TWIN_PERSISTENCE_FAILED', message: 'Digital twin session persistence failed' });
  }
};

module.exports = { createHarnessTwinChatHttpHandler };
