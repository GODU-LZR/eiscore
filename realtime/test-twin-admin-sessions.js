'use strict';

const assert = require('node:assert/strict');
const { createTwinResourceHttpHandlers } = require('./twin-resource-http');

const calls = [];
const responses = [];
const sendJson = (res, status, payload) => responses.push({ status, payload });
const makeReq = (url = '/twin/admin/sessions?limit=3') => ({ url, headers: {} });
const pgQuery = async (request) => {
  calls.push(request);
  return { data: [{ id: 's1', employee_id: 'alice', title: '测试', message_count: 2 }] };
};
const auditEvents = [];
const handlers = createTwinResourceHttpHandlers({
  authorizeTwinRequest: () => ({ id: 'u1', username: 'alice', role: 'employee', tenant_id: 't1', token: 'jwt' }),
  authorizeTwinAdminRequest: (_req, res) => {
    sendJson(res, 403, { code: 'FORBIDDEN' });
    return null;
  },
  bindPgQueryForUser: () => pgQuery,
  readJsonBody: async () => ({}),
  sendJson,
  port: 8078,
  audit: async (...event) => auditEvents.push(event)
});

(async () => {
  await handlers.handleAdminSessionsList(makeReq(), {});
  assert.deepEqual(responses.at(-1), { status: 403, payload: { code: 'FORBIDDEN' } });
  assert.equal(calls.length, 0, 'ordinary users must not reach the admin RPC');

  const allowed = createTwinResourceHttpHandlers({
    authorizeTwinRequest: () => ({ id: 'root', username: 'root', role: 'super_admin', tenant_id: 't1', token: 'jwt' }),
    authorizeTwinAdminRequest: () => ({ id: 'root', username: 'root', role: 'super_admin', tenant_id: 't1', token: 'jwt' }),
    bindPgQueryForUser: () => pgQuery,
    readJsonBody: async () => ({}),
    sendJson,
    port: 8078,
    audit: async (...event) => auditEvents.push(event)
  });
  await allowed.handleAdminSessionsList(makeReq('/twin/admin/sessions?limit=999'), {});
  assert.equal(calls.at(-1).path, '/rpc/admin_twin_sessions');
  assert.deepEqual(calls.at(-1).body, { p_limit: 200 }, 'admin listing must cap the page size');
  assert.deepEqual(responses.at(-1).payload.sessions, [{ id: 's1', employee_id: 'alice', title: '测试', message_count: 2 }]);
  assert.equal(auditEvents.at(-1)[0], 'twin.admin.sessions.list');
  console.log('PASS: super administrator digital-twin session listing is read-only and isolated');
})().catch((error) => { console.error(error); process.exitCode = 1; });
