'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max = 50000) => String(value ?? '').trim().slice(0, max);
const serverMessages = (history) => (Array.isArray(history) ? history : [])
  .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
  .map((message) => ({ role: message.role, content: text(message.content, 10000) }))
  .filter((message) => message.content)
  .slice(-12);

const fail = (message, code, httpStatus) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  return error;
};

const createHarnessTwinChatExecutor = ({ createPersistence, dispatch } = {}) => {
  if (typeof createPersistence !== 'function') throw new TypeError('Digital twin persistence factory is required');
  if (typeof dispatch !== 'function') throw new TypeError('Digital twin Harness dispatch is required');

  return async (user, payload = {}, request = {}) => {
    const message = text(payload.message || payload.content, 10000);
    if (!message) throw fail('message is required', 'MESSAGE_REQUIRED', 400);
    const requestedSessionId = text(payload.session_id || payload.sessionId, 128);
    if (requestedSessionId && !UUID_RE.test(requestedSessionId)) throw fail('session_id must be a UUID', 'SESSION_ID_INVALID', 400);
    const persistence = createPersistence(user);
    if (!persistence || typeof persistence.createSession !== 'function' || typeof persistence.saveMessage !== 'function' || typeof persistence.loadHistory !== 'function' || typeof persistence.getSession !== 'function') {
      throw fail('Digital twin persistence is unavailable', 'HARNESS_TWIN_PERSISTENCE_UNAVAILABLE', 503);
    }
    let sessionId = requestedSessionId || null;
    if (sessionId) {
      if (!await persistence.getSession(sessionId)) throw fail('Digital twin session is not available', 'SESSION_ACCESS_DENIED', 403);
    } else {
      sessionId = await persistence.createSession(message.slice(0, 30) + (message.length > 30 ? '...' : ''));
      if (!UUID_RE.test(String(sessionId || ''))) throw fail('Digital twin session could not be created', 'HARNESS_TWIN_PERSISTENCE_FAILED', 503);
    }
    const history = serverMessages(await persistence.loadHistory(sessionId, 12));
    await persistence.saveMessage(sessionId, 'user', message);
    const result = await dispatch({
      kind: 'chat',
      request_id: request.request_id || request.requestId,
      session_id: sessionId,
      plugin_id: 'digital-twin',
      agent_id: 'digital_twin',
      capability_id: 'eiscore_twin_chat',
      user,
      signal: request.signal,
      payload: {
        messages: [...history, { role: 'user', content: message }],
        stream: payload.stream !== false,
        context: { session_id: sessionId }
      }
    });
    if (!result?.ok) throw fail(result?.message || 'DeepSeek Harness is unavailable', result?.code || 'HARNESS_UPSTREAM_UNAVAILABLE', Number(result?.status || 502));
    const data = result.data || {};
    const answer = text(data.text || data.output_text || data.choices?.[0]?.message?.content);
    if (answer) await persistence.saveMessage(sessionId, 'assistant', answer);
    return { ...data, session_id: sessionId };
  };
};

module.exports = { UUID_RE, createHarnessTwinChatExecutor, serverMessages };
