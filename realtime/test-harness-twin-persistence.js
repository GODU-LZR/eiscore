'use strict';

const assert = require('node:assert/strict');
const { createPersistence } = require('./twin-tools');

(async () => {
  const calls = [];
  const persistence = createPersistence(async (request) => {
    calls.push(request);
    return { data: [{ id: '11111111-1111-4111-8111-111111111111' }] };
  }, 'operator');
  const sessionId = await persistence.createSession('Harness chat');
  assert.equal(sessionId, '11111111-1111-4111-8111-111111111111');
  assert.deepEqual(calls[0].body, {
    employee_id: 'operator',
    title: 'Harness chat',
    model: 'deepseek-harness'
  });
  assert.equal(JSON.stringify(calls).includes('glm-4.6v'), false);
  console.log('PASS: new digital twin sessions are explicitly marked as DeepSeek Harness sessions');
})().catch((error) => { console.error(error); process.exitCode = 1; });
