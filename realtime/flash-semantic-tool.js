#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

const fallbackPort = envText(process.env.PORT, '8080');
const baseUrl = envText(process.env.FLASH_AGENT_BASE_URL, `http://127.0.0.1:${fallbackPort}`).replace(/\/+$/, '');
const token = envText(process.env.FLASH_AGENT_TOKEN, '');
const defaultTimeoutMs = Number(process.env.FLASH_AGENT_TOOL_TIMEOUT_MS || 30000);

const printJson = (payload, toStdErr = false) => {
  const text = JSON.stringify(payload, null, 2);
  if (toStdErr) {
    process.stderr.write(`${text}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
};

const usage = () => {
  process.stdout.write(
    [
      'Usage:',
      '  node /app/flash-semantic-tool.js --registry',
      '  node /app/flash-semantic-tool.js <tool_id> --args \'<json>\' [--confirm] [--idempotency <key>] [--trace <id>] [--timeout <ms>]',
      '  node /app/flash-semantic-tool.js <tool_id> --args64 <base64-json> [--confirm]',
      '',
      'Examples:',
      '  node /app/flash-semantic-tool.js flash.app.detail --args \'{"appId":"xxx"}\'',
      '  node /app/flash-semantic-tool.js flash.audit.write --args \'{"payload":{"event_type":"test"}}\' --confirm'
    ].join('\n') + '\n'
  );
};

const parseArgs = (argv) => {
  const parsed = {
    registry: false,
    help: false,
    toolId: '',
    argsJson: '{}',
    argsBase64: '',
    confirmed: false,
    idempotencyKey: '',
    traceId: '',
    timeoutMs: Number.isFinite(defaultTimeoutMs) && defaultTimeoutMs > 0 ? defaultTimeoutMs : 30000
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = String(argv[idx] || '');
    if (!arg) continue;

    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
      continue;
    }
    if (arg === '--registry' || arg === 'registry') {
      parsed.registry = true;
      continue;
    }
    if (arg === '--confirm') {
      parsed.confirmed = true;
      continue;
    }
    if (arg === '--args' || arg === '--json') {
      idx += 1;
      parsed.argsJson = String(argv[idx] || '{}');
      continue;
    }
    if (arg === '--args64') {
      idx += 1;
      parsed.argsBase64 = String(argv[idx] || '').trim();
      continue;
    }
    if (arg === '--idempotency') {
      idx += 1;
      parsed.idempotencyKey = String(argv[idx] || '').trim();
      continue;
    }
    if (arg === '--trace') {
      idx += 1;
      parsed.traceId = String(argv[idx] || '').trim();
      continue;
    }
    if (arg === '--timeout') {
      idx += 1;
      const timeout = Number(argv[idx]);
      if (Number.isFinite(timeout) && timeout > 0) parsed.timeoutMs = Math.floor(timeout);
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!parsed.toolId) {
      parsed.toolId = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return parsed;
};

const parseJson = (raw, fieldName) => {
  try {
    const value = JSON.parse(String(raw || '{}'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('must be a JSON object');
    }
    return value;
  } catch (error) {
    throw new Error(`${fieldName} is invalid JSON object: ${error.message || error}`);
  }
};

const fetchJson = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
};

const buildIdempotencyKey = () => `idem-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help || (!parsed.registry && !parsed.toolId)) {
    usage();
    process.exit(parsed.help ? 0 : 1);
    return;
  }

  if (!token) {
    printJson({
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'FLASH_AGENT_TOKEN is empty; this command must run inside flash Cline runtime.'
    }, true);
    process.exit(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`
  };

  if (parsed.registry) {
    const registryResult = await fetchJson(
      `${baseUrl}/agent/flash/tools/registry`,
      {
        method: 'GET',
        headers
      },
      parsed.timeoutMs
    );
    printJson(registryResult.payload, !registryResult.ok);
    process.exit(registryResult.ok ? 0 : 1);
    return;
  }

  let argsRaw = parsed.argsJson;
  if (parsed.argsBase64) {
    try {
      argsRaw = Buffer.from(parsed.argsBase64, 'base64').toString('utf8');
    } catch (error) {
      throw new Error(`--args64 is invalid base64: ${error.message || error}`);
    }
  }
  const args = parseJson(argsRaw, parsed.argsBase64 ? '--args64' : '--args');
  const registryResult = await fetchJson(
    `${baseUrl}/agent/flash/tools/registry`,
    {
      method: 'GET',
      headers
    },
    parsed.timeoutMs
  );
  const registry = registryResult.ok ? registryResult.payload : {};
  const tools = Array.isArray(registry?.tools) ? registry.tools : [];
  const toolMeta = tools.find((item) => String(item?.tool_id || '') === parsed.toolId);
  const isWriteTool = !!(toolMeta && (toolMeta.confirm_required || String(toolMeta.risk_level || '').toLowerCase() !== 'low'));

  if (isWriteTool && !parsed.confirmed) {
    printJson({
      ok: false,
      code: 'CONFIRM_REQUIRED',
      message: `Tool ${parsed.toolId} is write/high-risk, please add --confirm`,
      tool_id: parsed.toolId
    }, true);
    process.exit(1);
    return;
  }

  const payload = {
    tool_id: parsed.toolId,
    arguments: args,
    trace_id: parsed.traceId || `tr-${Date.now()}`
  };
  if (parsed.confirmed) payload.confirmed = true;
  if (isWriteTool) {
    payload.idempotency_key = parsed.idempotencyKey || buildIdempotencyKey();
  } else if (parsed.idempotencyKey) {
    payload.idempotency_key = parsed.idempotencyKey;
  }

  const callResult = await fetchJson(
    `${baseUrl}/agent/flash/tools/call`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    },
    parsed.timeoutMs
  );

  printJson(callResult.payload, !callResult.ok);
  process.exit(callResult.ok ? 0 : 1);
};

main().catch((error) => {
  printJson({
    ok: false,
    code: 'CLI_ERROR',
    message: String(error?.message || error || 'Unknown error')
  }, true);
  process.exit(1);
});
