'use strict';

const assert = require('node:assert/strict');
const { createHarnessTwinChatHttpHandler } = require('./harness-twin-chat-http');

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const user = { id: 'u1', username: 'operator', tenant_id: 't1', token: 'jwt' };
const events = [];
let body = {};
let response;
let gatewaySignal;

const createResponse = () => ({
  headersSent: false,
  writableEnded: false,
  writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
  flushHeaders() { this.flushed = true; },
  write(value) { (this.writes ||= []).push(value); },
  end() { this.writableEnded = true; }
});

const persistence = {
  async createSession(title) { events.push(['createSession', title]); return SESSION_ID; },
  async getSession(id) { events.push(['getSession', id]); return id === SESSION_ID ? { id } : null; },
  async loadHistory(id, limit) { events.push(['loadHistory', id, limit]); return [{ role: 'assistant', content: 'stored' }]; },
  async saveMessage(id, role, content) { events.push(['saveMessage', id, role, content]); }
};

const handler = createHarnessTwinChatHttpHandler({
  authorize: () => user,
  readJsonBody: async () => body,
  sendJson: (_res, status, payload) => { response = { status, payload }; },
  createPersistence: () => persistence,
  gateway: {
    async execute(request) {
      gatewaySignal = request.signal;
      events.push(['gateway', request.session_id, request.payload.history]);
      return { ok: true, status: 200, data: { text: 'answer' } };
    }
  },
  setCorsHeaders: (res) => { res.cors = true; },
  streamTextAsSse: (res, text) => { res.write(`data: ${JSON.stringify({ text })}\n\n`); res.end(); }
});

(async () => {
  body = { message: 'hello', history: [{ role: 'user', content: 'untrusted' }] };
  response = null;
  const createdResponse = createResponse();
  const incomingSignal = new AbortController().signal;
  await handler({ signal: incomingSignal }, createdResponse);
  assert.equal(createdResponse.status, 200);
  assert.equal(createdResponse.headers['X-Eis-Session'], SESSION_ID);
  assert.equal(gatewaySignal, incomingSignal, 'digital twin must forward the HTTP disconnect signal to the gateway');
  assert.deepEqual(events, [
    ['createSession', 'hello'],
    ['loadHistory', SESSION_ID, 12],
    ['saveMessage', SESSION_ID, 'user', 'hello'],
    ['gateway', SESSION_ID, [{ role: 'assistant', content: 'stored' }]],
    ['saveMessage', SESSION_ID, 'assistant', 'answer']
  ]);

  events.length = 0;
  body = { message: 'next', session_id: SESSION_ID, history: [{ role: 'user', content: 'forged' }] };
  const existingResponse = createResponse();
  await handler({}, existingResponse);
  assert.equal(existingResponse.status, 200);
  assert.deepEqual(events, [
    ['getSession', SESSION_ID],
    ['loadHistory', SESSION_ID, 12],
    ['saveMessage', SESSION_ID, 'user', 'next'],
    ['gateway', SESSION_ID, [{ role: 'assistant', content: 'stored' }]],
    ['saveMessage', SESSION_ID, 'assistant', 'answer']
  ]);

  body = { message: 'bad', session_id: 'not-a-uuid' };
  response = null;
  await handler({}, createResponse());
  assert.deepEqual(response, { status: 400, payload: { code: 'SESSION_ID_INVALID', message: 'session_id must be a UUID' } });

  body = { message: 'foreign', session_id: '22222222-2222-4222-8222-222222222222' };
  response = null;
  await handler({}, createResponse());
  assert.deepEqual(response, { status: 403, payload: { code: 'SESSION_ACCESS_DENIED', message: 'Digital twin session is not available' } });

  let routedRequest;
  const toolGatewayHandler = createHarnessTwinChatHttpHandler({
    authorize: () => user,
    readJsonBody: async () => ({ message: 'through gateway', history: [{ role: 'user', content: 'forged' }] }),
    sendJson: (_res, status, payload) => { response = { status, payload }; },
    gateway: { async execute(request) { routedRequest = request; return { ok: true, data: { text: 'gateway answer', session_id: SESSION_ID } }; } },
    managePersistence: true,
    setCorsHeaders: () => {},
    streamTextAsSse: (res, text) => { res.write(text); res.end(); }
  });
  const gatewayResponse = createResponse();
  await toolGatewayHandler({}, gatewayResponse);
  assert.equal(routedRequest.capability_id, 'eiscore_twin_chat');
  assert.equal(routedRequest.payload.history, undefined);
  assert.equal(gatewayResponse.headers['X-Eis-Session'], SESSION_ID);

  let throwingTwinResponse;
  const throwingTwinHandler = createHarnessTwinChatHttpHandler({
    authorize: () => user,
    readJsonBody: async () => ({ message: 'through gateway' }),
    sendJson: (_res, status, payload) => { throwingTwinResponse = { status, payload }; },
    gateway: { async execute() { throw new Error('database password at /etc/secrets'); } },
    managePersistence: true,
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await throwingTwinHandler({}, createResponse());
  assert.deepEqual(throwingTwinResponse, { status: 502, payload: { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' } });

  const disabledResponses = [];
  const disabledHandler = createHarnessTwinChatHttpHandler({
    authorize: () => user,
    readJsonBody: async () => ({ message: 'must not run' }),
    sendJson: (_res, status, payload) => disabledResponses.push({ status, payload }),
    gateway: { async execute() { throw new Error('disabled Harness must not dispatch'); } },
    enabled: false,
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await disabledHandler({}, createResponse());
  assert.deepEqual(disabledResponses[0], { status: 503, payload: { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' } });

  console.log('PASS: Harness digital twin chat uses RLS-owned sessions and persists messages');
})().catch((error) => { console.error(error); process.exitCode = 1; });
