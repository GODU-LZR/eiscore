'use strict';

const assert = require('node:assert/strict');
const { createHarnessQueryTools } = require('./harness-query-tools');
const { createHarnessGateway } = require('./harness-gateway');
const { createHarnessToolGateway } = require('./harness-tool-gateway');

(async () => {
  const calls = [];
  const tools = createHarnessQueryTools({
    fetchSemanticContext: async (user) => ({ accessPolicy: { roleScoped: true }, fieldAclAvailable: true, permissions: user.permissions.map((code) => ({ code })), fieldAcl: { mms_ledger: {} } }),
    callPostgrestWithUser: async (user, request) => { calls.push({ user, request }); return { data: [{ id: 1, name: 'steel' }] }; }
  });
  const user = { id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:materials'] };
  const roleHiddenTools = createHarnessQueryTools({
    fetchSemanticContext: async () => ({ accessPolicy: { roleScoped: true }, fieldAclAvailable: true, permissions: ['app:hr_user'], fieldAcl: { hr_user: { role_id: { canView: false } } } }),
    callPostgrestWithUser: async (_authenticated, request) => {
      assert.equal(request.query.select.includes('role_name'), false, 'hidden role_id must also hide its role_name label');
      return { data: [{ id: 'u1', role_name: 'private-role' }] };
    }
  });
  const noRoleResult = await roleHiddenTools.execute(user, { dataset: 'users' }, 'worker-grid');
  assert.deepEqual(noRoleResult.rows, [{ id: 'u1' }]);
  await assert.rejects(() => roleHiddenTools.execute(user, { dataset: 'users', filters: { role_name: 'private-role' } }, 'worker-grid'), /not visible/);
  let result = await tools.execute(user, { dataset: 'materials', select: ['id', 'name'], filters: { name: 'steel' }, limit: 10 }, 'worker-grid');
  assert.deepEqual(result.rows, [{ id: 1, name: 'steel' }]);
  const canonicalMmsUser = { ...user, permissions: ['module:mms'] };
  result = await tools.execute(canonicalMmsUser, { dataset: 'inventory', select: ['id'] }, 'worker-grid');
  assert.deepEqual(result.rows, [{ id: 1 }], 'canonical warehouse module permission must authorize inventory queries');
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
  const userCalls = [];
  const userTools = createHarnessQueryTools({
    fetchSemanticContext: async (authenticated) => ({
      accessPolicy: { roleScoped: true }, fieldAclAvailable: true, permissions: authenticated.permissions,
      fieldAcl: { hr_user: { full_name: { canView: false } } }
    }),
    callPostgrestWithUser: async (authenticated, request) => {
      userCalls.push({ authenticated, request });
      return { data: [{ id: 'u1', username: 'tester', full_name: 'hidden', status: 'active', role_name: '员工', password: 'must-not-leak', email: 'private', phone: 'private' }] };
    }
  });
  const userReader = { ...user, permissions: ['app:hr_user'] };
  const userResult = await userTools.execute(userReader, { dataset: 'users' }, 'worker-grid');
  assert.deepEqual(userResult.rows, [{ id: 'u1', username: 'tester', role_name: '员工', status: 'active' }]);
  assert.equal(userCalls[0].authenticated, userReader, 'users dataset must preserve the current authenticated JWT and tenant');
  assert.equal(userCalls[0].request.path, '/v_users_manage');
  assert.equal(userCalls[0].request.acceptProfile, 'public');
  assert.equal(userCalls[0].request.method, 'GET', 'users capability must remain read-only');
  assert.equal(userCalls[0].request.query.select, 'id,username,role_name,status');
  await assert.rejects(() => userTools.execute({ ...userReader, permissions: ['module:hr'] }, { dataset: 'users' }, 'worker-grid'), /dataset permission/);
  for (const field of ['password', 'email', 'phone', 'permissions']) {
    await assert.rejects(() => userTools.execute(userReader, { dataset: 'users', select: [field] }, 'worker-grid'), /outside the dataset contract/);
  }
  await assert.rejects(() => userTools.execute(userReader, { dataset: 'users', filters: { full_name: 'hidden' } }, 'worker-grid'), /not visible/);
  userReader.permissions = [];
  await assert.rejects(() => userTools.execute(userReader, { dataset: 'users' }, 'worker-grid'), /dataset permission/, 'each follow-up must recheck current permissions');
  assert.equal(userCalls.length, 1, 'denied calls must not reach the database');
  const toolGateway = createHarnessToolGateway({
    executeFlashToolCall: async () => { throw new Error('unrelated tool must not be used'); },
    executeConstrainedQuery: userTools.execute
  });
  const gateway = createHarnessGateway({
    audit: async () => {}, auditKey: 'offline-regression-audit-key-123456',
    dispatch: toolGateway.execute
  });
  const gatewayQuery = (permissions, dataset = 'users') => gateway.execute({
    user: { ...user, permissions }, plugin_id: 'worker-grid', capability_id: 'eiscore_grid_query',
    session_id: 'user-query-followup', payload: { dataset }
  });
  for (const permission of ['app:hr_user', 'op:hr_user.view']) {
    const allowed = await gatewayQuery([permission]);
    assert.equal(allowed.ok, true, `${permission} alone must pass the actual registry and Gateway`);
    assert.deepEqual(allowed.data.rows, [{ id: 'u1', username: 'tester', role_name: '员工', status: 'active' }]);
    for (const dataset of ['materials', 'inventory', 'production_orders', 'employees']) {
      const denied = await gatewayQuery([permission], dataset);
      assert.equal(denied.ok, false, 'user management access must not grant another business dataset');
      assert.equal(denied.code, 'HARNESS_PERMISSION_DENIED');
    }
  }
  const unauthorized = await gatewayQuery([]);
  assert.equal(unauthorized.ok, false);
  assert.equal(unauthorized.code, 'HARNESS_PERMISSION_DENIED');
  const broadHrOnly = await gatewayQuery(['module:hr']);
  assert.equal(broadHrOnly.ok, false, 'broad HR module access does not grant user management data');
  assert.equal(broadHrOnly.code, 'HARNESS_PERMISSION_DENIED');
  assert.equal(userCalls.length, 3, 'only the two authorized Gateway requests may reach the user view');
  console.log('PASS: Harness constrained query datasets, ACL and injection boundaries');
})().catch((error) => { console.error(error); process.exitCode = 1; });
