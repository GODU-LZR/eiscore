'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createJsonlAuditSink } = require('./audit-ledger');

(async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eiscore-harness-audit-'));
  try {
    const target = path.join(tempRoot, 'nested', 'audit.jsonl');
    const sink = createJsonlAuditSink({ filePath: target, maxBytes: 1000 });
    await sink({ decision: 'allowed' });
    assert.equal((await fs.readFile(target, 'utf8')).includes('allowed'), true);
    await assert.rejects(
      createJsonlAuditSink({ filePath: target, maxBytes: 1 })({ decision: 'completed' }),
      /Harness audit ledger unavailable/
    );

    const realDirectory = path.join(tempRoot, 'real');
    const linkedDirectory = path.join(tempRoot, 'linked');
    await fs.mkdir(realDirectory);
    await fs.symlink(realDirectory, linkedDirectory, 'junction');
    await assert.rejects(
      createJsonlAuditSink({ filePath: path.join(linkedDirectory, 'audit.jsonl') })({ decision: 'denied' }),
      /Harness audit ledger unavailable/
    );

    await assert.rejects(
      createJsonlAuditSink({ filePath: 'relative-audit.jsonl' })({ decision: 'denied' }),
      /absolute path/
    );

    const invalidCapacityTarget = path.join(tempRoot, 'invalid-capacity', 'audit.jsonl');
    const invalidCapacitySink = createJsonlAuditSink({ filePath: invalidCapacityTarget, maxBytes: Number.NaN });
    await invalidCapacitySink({ decision: 'allowed' });
    assert.equal((await fs.readFile(invalidCapacityTarget, 'utf8')).includes('allowed'), true);

    const recoveryTarget = path.join(tempRoot, 'recovery', 'audit.jsonl');
    await fs.mkdir(path.dirname(recoveryTarget), { recursive: true });
    await fs.mkdir(recoveryTarget);
    const recoverySink = createJsonlAuditSink({ filePath: recoveryTarget });
    await assert.rejects(recoverySink({ decision: 'transient-failure' }), /Harness audit ledger unavailable/);
    await fs.rm(recoveryTarget, { recursive: true, force: true });
    await recoverySink({ decision: 'recovered' });
    assert.equal((await fs.readFile(recoveryTarget, 'utf8')).includes('recovered'), true);
    console.log('PASS: Harness audit ledger path, capacity and symlink boundaries');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
