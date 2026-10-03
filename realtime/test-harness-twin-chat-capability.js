'use strict';

const assert = require('node:assert/strict');
const { createHarnessTwinChatExecutor } = require('./harness-twin-chat-capability');

(async () => {
  const events = [];
  const persistenceOwners = [];
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const user = { id: 'u1', tenant_id: 'tenant-a', token: 'jwt-a' };
  const persistence = {
    async createSession(title) { events.push(['create', title]); return sessionId; },
    async getSession(id) { events.push(['get', id]); return id === sessionId ? { id } : null; },
    async loadHistory(id, limit) { events.push(['history', id, limit]); return [{ role: 'assistant', content: 'stored' }]; },
    async saveMessage(id, role, content) { events.push(['save', id, role, content]); }
  };
  const executor = createHarnessTwinChatExecutor({
    createPersistence: (owner) => { persistenceOwners.push(owner); return persistence; },
    dispatch: async (request) => { events.push(['dispatch', request]); return { ok: true, data: { text: 'answer' } }; }
  });
  const result = await executor(user, { message: 'hello', history: [{ role: 'user', content: 'forged' }] }, { request_id: 'req-1' });
  assert.equal(result.session_id, sessionId);
  assert.deepEqual(events, [
    ['create', 'hello'], ['history', sessionId, 12], ['save', sessionId, 'user', 'hello'],
    ['dispatch', {
      kind: 'chat',
      request_id: 'req-1',
      session_id: sessionId,
      plugin_id: 'digital-twin',
      agent_id: 'digital_twin',
      capability_id: 'eiscore_twin_chat',
      user,
      signal: undefined,
      payload: {
        messages: [{ role: 'assistant', content: 'stored' }, { role: 'user', content: 'hello' }],
        stream: true,
        context: { session_id: sessionId }
      }
    }], ['save', sessionId, 'assistant', 'answer']
  ]);
  assert.equal(JSON.stringify(events).includes('forged'), false, 'client history must never reach the provider');
  const { requestContentBlocks } = await import('../agent-harness/dsh-http-bridge.mjs');
  assert.deepEqual(requestContentBlocks(events[3][1].payload, 'digital-twin'), [
    { type: 'text', text: '[EISCORE_PLUGIN:digital-twin]' },
    { type: 'text', text: '[assistant]' },
    { type: 'text', text: 'stored' },
    { type: 'text', text: '[user]' },
    { type: 'text', text: 'hello' }
  ]);
  assert.equal(persistenceOwners[0], user, 'digital twin persistence must bind to the authenticated user');
  await assert.rejects(() => executor(user, { message: 'foreign', session_id: '22222222-2222-4222-8222-222222222222' }), (error) => error.code === 'SESSION_ACCESS_DENIED' && error.httpStatus === 403);
  console.log('PASS: Digital twin chat is a local Tool Gateway capability with RLS-owned persistence');
})().catch((error) => { console.error(error); process.exitCode = 1; });
