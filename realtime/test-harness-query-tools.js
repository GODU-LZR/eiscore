'use strict';

const assert = require('node:assert/strict');
const { createHarnessQueryTools } = require('./harness-query-tools');

(async () => {
  const calls = [];
  const tools = createHarnessQueryTools({
    fetchSemanticContext: async (user) => ({ accessPolicy: { roleScoped: true }, fieldAclAvailable: true, permissions: user.permissions.map((code) => ({ code })), fieldAcl: { mms_ledger: {} } }),
    callPostgrestWithUser: async (user, request) => { calls.push({ user, request }); return { data: [{ id: 1, name: 'steel' }] }; }
  });
  const user = { id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:materials'] };
  let result = await tools.execute(user, { dataset: 'materials', select: ['id', 'name'], filters: { name: 'steel' }, limit: 10 }, 'worker-grid');
  assert.deepEqual(result.rows, [{ id: 1, name: 'steel' }]);
  assert.equal(calls[0].user, user, 'PostgREST must receive the authenticated user context');
  assert.equal(calls[0].user.token, 'jwt', 'PostgREST must receive the authenticated JWT for RLS');
  assert.equal(calls[0].user.tenant_id, 't1', 'PostgREST must receive the authenticated tenant context');
  assert.equal(calls[0].request.path, '/raw_materials');
  assert.equal(calls[0].request.query.select, 'id,name');
  assert.equal(calls[0].request.query.name, 'eq.steel');
  const tenantBUser = { id: 'u2', tenant_id: 'tenant-b', token: 'jwt-b', permissions: ['module:materials'] };
  await tools.execute(tenantBUser, { dataset: 'materials', tenant_id: 'tenant-a', select: ['id'] }, 'worker-grid').catch((error) => {
    assert.match(error.message, /unsupported authorization/);
  });
  await tools.execute(tenantBUser, { dataset: 'materials', select: ['id'] }, 'worker-grid');
  assert.equal(calls.at(-1).user.tenant_id, 'tenant-b', 'tenant B query must retain the authenticated tenant');
  assert.equal(calls.at(-1).user.token, 'jwt-b', 'tenant B query must retain the authenticated JWT');
  await assert.rejects(() => tools.execute(user, { dataset: 'materials', table: 'public.users' }, 'worker-grid'), /unsupported authorization/);
  await assert.rejects(() => tools.execute(user, { dataset: 'sales_orders' }, 'worker-grid'), /dataset is not available/);
  await assert.rejects(() => tools.execute(user, { dataset: 'materials', select: ['tenant_id'] }, 'worker-grid'), /outside the dataset contract/);
  for (const value of ['steel,or(name.eq.secret)', 'steel)', 'steel{secret}', 'steel\nsecret']) {
    await assert.rejects(
      () => tools.execute(user, { dataset: 'materials', filters: { name: value } }, 'worker-grid'),
      /query filter value is invalid/
    );
  }
  await assert.rejects(() => tools.execute({ ...user, permissions: ['module:hr'] }, { dataset: 'materials' }, 'worker-grid'), /dataset permission/);
  console.log('PASS: Harness constrained query datasets, ACL and injection boundaries');
})().catch((error) => { console.error(error); process.exitCode = 1; });
