# EISCore Test Automation

This directory contains the formal test automation entrypoints for EISCore.

## Commands

Run the offline runtime regression test:

```bash
npm run test:unit
```

Build all frontend applications:

```bash
npm run build:frontends
```

Run the CI bundle used by GitHub Actions:

```bash
npm run test:ci
```

Run the local business smoke test against a running EISCore stack:

```bash
npm run test:smoke
```

## Smoke Test Environment

`tests/smoke/business-smoke.mjs` requires the host app, PostgREST API, agent runtime,
and WebSocket endpoint to be available.

Defaults:

| Variable | Default |
|---|---|
| `EISCORE_BASE_URL` | `http://localhost:8080` |
| `EISCORE_AGENT_WS_URL` | `ws://localhost:8078/ws` |
| `EISCORE_SMOKE_USERNAME` | `admin` |
| `EISCORE_SMOKE_PASSWORD` | `123456` |
| `EISCORE_SMOKE_RESULT` | unset |
| `EISCORE_SMOKE_SKIP_AI` | unset |
| `EISCORE_SMOKE_SKIP_WS` | unset |
| `EISCORE_SMOKE_AI_MODEL` | model returned by `/agent/ai/config` |
| `EISCORE_SMOKE_AI_TIMEOUT_MS` | `60000` |

Example:

```bash
EISCORE_SMOKE_RESULT=tests/.artifacts/business-smoke-result.json npm run test:smoke
```

Remote Nanpai environment:

```bash
EISCORE_BASE_URL=https://nanpai.eissys.top \
EISCORE_AGENT_WS_URL=wss://nanpai.eissys.top/agent/ws \
EISCORE_SMOKE_RESULT=tests/.artifacts/nanpai-smoke-result.json \
npm run test:smoke
```

Use `EISCORE_SMOKE_SKIP_AI=1` or `EISCORE_SMOKE_SKIP_WS=1` when validating a partial
local stack.

## Current Scope

- `test:unit` is service-free and deterministic.
- `build:frontends` verifies all Vue/Vite micro-frontends compile.
- `test:smoke` verifies login, deep-link routing, PostgREST profiles, agent health,
  AI chat, SSE, and realtime WebSocket connectivity against a running environment.

The next layer should add component/unit tests for shared grid utilities and a
Playwright E2E suite for login plus qiankun sub-application loading.
