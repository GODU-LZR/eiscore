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
    harness_namespace: 'business',
    title: 'Harness chat',
    model: 'deepseek-harness'
  });
  assert.equal(JSON.stringify(calls).includes('glm-4.6v'), false);

  const knowledgeFileId = '22222222-2222-4222-8222-222222222222';
  const knowledge = createPersistence(async (request) => {
    calls.push(request);
    return { data: [{ id: knowledgeFileId, file_name: 'guide.txt', file_type: 'text/plain', file_size: 4 }] };
  }, 'alice', 'knowledge');
  const uploaded = await knowledge.uploadKnowledgeFile({
    fileName: 'guide.txt',
    fileType: 'text/plain',
    contentText: 'safe',
    fileSize: 4,
    tags: ['manual'],
    metadata: { folder: 'Operations' },
    employee_id: 'mallory',
    harness_namespace: 'business'
  });
  const uploadRequest = calls.at(-1);
  assert.equal(uploaded.id, knowledgeFileId);
  assert.equal(uploadRequest.body.employee_id, 'alice');
  assert.equal(uploadRequest.body.harness_namespace, 'knowledge');
  assert.equal(uploadRequest.body.metadata.folder, 'Operations');
  assert.equal(Object.hasOwn(uploadRequest.body, 'id'), false);

  await knowledge.listKnowledgeFiles(50);
  const listRequest = calls.at(-1);
  assert.equal(listRequest.query.employee_id, 'eq.alice');
  assert.equal(listRequest.query.harness_namespace, 'eq.knowledge');
  assert.match(listRequest.query.select, /metadata/);
  assert.doesNotMatch(listRequest.query.select, /content_(?:text|b64)/);

  await knowledge.getKnowledgeFile(knowledgeFileId);
  const detailRequest = calls.at(-1);
  assert.equal(detailRequest.query.id, `eq.${knowledgeFileId}`);
  assert.equal(detailRequest.query.employee_id, 'eq.alice');
  assert.equal(detailRequest.query.harness_namespace, 'eq.knowledge');
  assert.match(detailRequest.query.select, /content_text/);

  await knowledge.updateKnowledgeFile(knowledgeFileId, { file_name: 'renamed.txt' });
  const updateRequest = calls.at(-1);
  assert.equal(updateRequest.method, 'PATCH');
  assert.equal(updateRequest.query.employee_id, 'eq.alice');
  assert.equal(updateRequest.query.harness_namespace, 'eq.knowledge');
  assert.equal(updateRequest.body.file_name, 'renamed.txt');
  assert.equal(updateRequest.body.harness_namespace, undefined);
  assert.equal(updateRequest.body.employee_id, undefined);
  assert.ok(updateRequest.body.updated_at);

  const deleted = await knowledge.deleteKnowledgeFile(knowledgeFileId);
  const deleteRequest = calls.at(-1);
  assert.equal(deleted, true);
  assert.equal(deleteRequest.method, 'DELETE');
  assert.equal(deleteRequest.query.employee_id, 'eq.alice');
  assert.equal(deleteRequest.query.harness_namespace, 'eq.knowledge');

  const beforeInvalidUpload = calls.length;
  await assert.rejects(
    knowledge.uploadKnowledgeFile({ fileName: 'too-large.txt', contentText: 'x'.repeat(200001) }),
    { code: 'TWIN_KB_INVALID', httpStatus: 400 }
  );
  assert.equal(calls.length, beforeInvalidUpload, 'invalid uploads must not reach PostgREST');
  console.log('PASS: twin persistence scopes knowledge file CRUD by user and namespace and validates upload bounds');
})().catch((error) => { console.error(error); process.exitCode = 1; });
