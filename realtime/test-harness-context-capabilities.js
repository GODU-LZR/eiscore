'use strict';

const assert = require('node:assert/strict');
const { createHarnessContextCapabilities } = require('./harness-context-capabilities');

(async () => {
  const calls = [];
  const capabilities = createHarnessContextCapabilities({
    callPostgrestWithUser: async (user, request) => {
      calls.push({ user, request });
      return { data: [{ id: 'row-1' }] };
    }
  });
  const user = { id: 'u1', tenant_id: 'tenant-a', token: 'jwt-a' };

  const engineering = await capabilities.executeEngineering(user, { view: 'equipment' });
  assert.equal(engineering.context, 'engineering');
  assert.deepEqual(Object.keys(engineering.data), ['assets', 'checks', 'issues']);
  assert.equal(calls[0].user, user);
  assert.equal(calls[0].request.path, '/equipment_assets');
  assert.equal(calls[0].request.request, undefined);
  assert.match(calls[0].request.query.select, /^id,asset_no,/);

  const site = await capabilities.executeSiteSales(user, { view: 'catalog' });
  assert.deepEqual(Object.keys(site.data), ['products']);
  assert.equal(calls.at(-1).request.path, '/products');
  assert.equal(calls.at(-1).request.query.site_key, 'eq.primary');
  assert.equal(calls.at(-1).request.query.status, 'eq.published');
  const tenantBUser = { id: 'u2', tenant_id: 'tenant-b', token: 'jwt-b' };
  await capabilities.executeEngineering(tenantBUser, { view: 'equipment', tenant_id: 'tenant-a' }).catch((error) => {
    assert.match(error.message, /unsupported authorization/);
  });
  await capabilities.executeEngineering(tenantBUser, { view: 'equipment' });
  assert.equal(calls.at(-1).user.tenant_id, 'tenant-b', 'engineering context must retain the authenticated tenant');
  assert.equal(calls.at(-1).user.token, 'jwt-b', 'engineering context must retain the authenticated JWT');

  await assert.rejects(() => capabilities.executeEngineering(user, { view: 'equipment', sql: 'select * from users' }), /unsupported authorization/);
  await assert.rejects(() => capabilities.executeSiteSales(user, { view: 'unknown' }), /view is not available/);
  console.log('PASS: Harness engineering and independent-site sales context boundaries');
})().catch((error) => { console.error(error); process.exitCode = 1; });
