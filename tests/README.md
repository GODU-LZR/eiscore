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

Install the Chromium browser used by Playwright:

```bash
npm run e2e:install
```

Install Chromium plus Linux system dependencies when the environment allows apt/sudo:

```bash
npm run e2e:install:with-deps
```

Run the browser E2E suite:

```bash
npm run test:e2e
```

Run the browser E2E suite against the Nanpai remote environment:

```bash
npm run test:e2e:remote
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

## Browser E2E Environment

`tests/e2e/nanpai-shell.spec.mjs` uses Playwright to verify the public login page,
the authenticated host shell, and key qiankun sub-application deep links.

Defaults:

| Variable | Default |
|---|---|
| `EISCORE_E2E_BASE_URL` | `EISCORE_BASE_URL` or `http://localhost:8080` |
| `EISCORE_E2E_USERNAME` | `EISCORE_SMOKE_USERNAME` or `admin` |
| `EISCORE_E2E_PASSWORD` | `EISCORE_SMOKE_PASSWORD` or `123456` |

Artifacts:

| Output | Path |
|---|---|
| JSON result | `tests/.artifacts/playwright-result.json` |
| HTML report | `tests/.artifacts/playwright-report/` |
| Traces/screenshots/videos | `tests/.artifacts/playwright-results/` |

If Chromium fails to launch with missing shared libraries such as `libnspr4.so`,
install the browser dependencies with `npm run e2e:install:with-deps` or install
the equivalent system packages (`libnspr4`, `libnss3`, `libasound2t64` on current
Ubuntu releases).

## Current Scope

- `test:unit` is service-free and deterministic.
- `build:frontends` verifies all Vue/Vite micro-frontends compile.
- `test:smoke` verifies login, deep-link routing, PostgREST profiles, agent health,
  AI chat, SSE, and realtime WebSocket connectivity against a running environment.
- `test:e2e` verifies that the app actually renders in Chromium and catches blank
  screens in the login page, host shell, and selected micro-frontend deep links.

The next layer should add component/unit tests for shared grid utilities and an
agent semantic regression runner for the Chinese query test set.
