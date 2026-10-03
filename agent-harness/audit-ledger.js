'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const ensureSafeDirectory = async (directory) => {
  const root = path.parse(directory).root;
  let current = root;
  const parts = path.relative(root, directory).split(path.sep).filter(Boolean);
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await fs.mkdir(current, { mode: 0o700 });
      stat = await fs.lstat(current);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Harness audit ledger unavailable');
  }
};

const createJsonlAuditSink = ({ filePath = '', maxBytes = 10 * 1024 * 1024 } = {}) => {
  const target = String(filePath || '').trim();
  const capacity = Number.isFinite(Number(maxBytes)) && Number(maxBytes) > 0
    ? Number(maxBytes)
    : 10 * 1024 * 1024;
  let chain = Promise.resolve();
  if (!target || !path.isAbsolute(target)) {
    return async () => { throw new Error('Harness audit file must be an absolute path'); };
  }
  const append = async (event) => {
    const line = `${JSON.stringify(event)}\n`;
    const operation = chain.then(async () => {
      const stat = await fs.lstat(target).catch(() => null);
      if (stat?.isSymbolicLink?.() || (stat && !stat.isFile()) || (stat && stat.size + Buffer.byteLength(line) > capacity)) {
        throw new Error('Harness audit ledger unavailable');
      }
      await ensureSafeDirectory(path.dirname(target));
      await fs.appendFile(target, line, { encoding: 'utf8', mode: 0o600 });
      await fs.chmod(target, 0o600);
    });
    chain = operation.catch(() => {});
    return operation;
  };
  return append;
};

module.exports = { createJsonlAuditSink, ensureSafeDirectory };
