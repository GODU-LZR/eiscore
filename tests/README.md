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

Run the full business chain close-loop test against a running EISCore stack:

```bash
npm run test:business-chain
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

Run only the daily UI click tour:

```bash
npm run test:e2e:clicks
```

Run only the daily UI click tour against the Nanpai remote environment:

```bash
npm run test:e2e:clicks:remote
```

Run the UI full business chain close-loop test:

```bash
npm run test:e2e:business-chain
```

Run the UI full business chain close-loop test against the Nanpai remote environment:

```bash
npm run test:e2e:business-chain:remote
```

Run the full 67 function point UI acceptance suite:

```bash
npm run test:e2e:functions67
```

Run the full 67 function point UI acceptance suite against the Nanpai remote environment:

```bash
npm run test:e2e:functions67:remote
```

Run the full business chain close-loop test against the Nanpai remote environment:

```bash
npm run test:business-chain:remote
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

## Full Business Chain Environment

`tests/business/full-chain.mjs` verifies authenticated write/read/update/delete
loops across app center, dynamic data apps, workflow runtime state writeback,
workflow V2 strict transition rules, HR, and SCM warehouse management.

Defaults:

| Variable | Default |
|---|---|
| `EISCORE_CHAIN_BASE_URL` | `EISCORE_BASE_URL` or `http://localhost:8080` |
| `EISCORE_CHAIN_USERNAME` | `EISCORE_SMOKE_USERNAME` or `admin` |
| `EISCORE_CHAIN_PASSWORD` | `EISCORE_SMOKE_PASSWORD` or `123456` |
| `EISCORE_CHAIN_RESULT` | unset |
| `EISCORE_CHAIN_TABLE` | `eiscore_chain_test_records` |
| `EISCORE_CHAIN_KEEP_DATA` | unset |
| `EISCORE_CHAIN_TIMEOUT_MS` | `15000` |

Example:

```bash
EISCORE_CHAIN_BASE_URL=http://localhost \
EISCORE_CHAIN_RESULT=tests/.artifacts/full-chain-result.json \
npm run test:business-chain
```

Remote Nanpai environment:

```bash
EISCORE_CHAIN_BASE_URL=https://nanpai.eissys.top \
EISCORE_CHAIN_RESULT=tests/.artifacts/nanpai-full-chain-result.json \
npm run test:business-chain
```

The test creates a reusable dynamic table named `app_data.eiscore_chain_test_records`
when it does not already exist. Per-run records, generated apps, workflow
definitions, workflow instances, V2 workflow policies/rules, HR archives, and SCM
warehouses are cleaned up automatically unless `EISCORE_CHAIN_KEEP_DATA=1` is set
for debugging.

## Browser E2E Environment

`tests/e2e/nanpai-shell.spec.mjs` uses Playwright to verify the public login page,
the authenticated host shell, and key qiankun sub-application deep links.
`tests/e2e/ui-clicks.spec.mjs` simulates ordinary user clicking across the login
form, shell header, side navigation, app cards, grid search/config/export controls,
and app center dialogs.
`tests/e2e/ui-business-chain.spec.mjs` combines isolated API setup/cleanup with
real UI navigation, search, refresh, and tree clicks to verify the app center,
dynamic data app, workflow status writeback, HR archive, and SCM warehouse loops
from a user's browser.
`tests/e2e/function-points-67.spec.mjs` verifies the complete 67 function point
matrix from the legacy full UI report, including desktop modules, dashboards,
special workbenches, stock forms, app center pages, and the mobile entrance.

Defaults:

| Variable | Default |
|---|---|
| `EISCORE_E2E_BASE_URL` | `EISCORE_BASE_URL` or `http://localhost:8080` |
| `EISCORE_E2E_USERNAME` | `EISCORE_SMOKE_USERNAME` or `admin` |
| `EISCORE_E2E_PASSWORD` | `EISCORE_SMOKE_PASSWORD` or `123456` |
| `EISCORE_E2E_CHAIN_TABLE` | `EISCORE_CHAIN_TABLE` or `eiscore_chain_test_records` |
| `EISCORE_E2E_CHAIN_KEEP_DATA` | unset |
| `EISCORE_E2E_RETRIES` | remote targets: `1`; local targets: `0` |
| `EISCORE_E2E_WORKERS` | remote targets: `1`; local targets: Playwright default |
| `EISCORE_E2E_LOGIN_ATTEMPTS` | remote targets: `5`; local targets: `3` |
| `EISCORE_E2E_GOTO_ATTEMPTS` | remote targets: `3`; local targets: `2` |
| `EISCORE_E2E_API_TIMEOUT_MS` | `45000` |

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
- `test:business-chain` verifies create/read/update/delete loops and workflow
  status writeback against writable business APIs.
- `test:e2e` verifies that the app actually renders in Chromium, catches blank
  screens in the login page, host shell, and selected micro-frontend deep links,
  and exercises daily UI clicks plus the UI business chain close-loop that
  ordinary users rely on.
- `test:e2e:clicks` runs only the daily UI click tour when fast interaction
  validation is needed.
- `test:e2e:business-chain` runs only the browser-level full business chain:
  generated app center data app, workflow state writeback, HR archive CRUD, and
  SCM warehouse CRUD, with per-run artifacts cleaned up automatically unless
  `EISCORE_E2E_CHAIN_KEEP_DATA=1` is set.
- `test:e2e:functions67` runs the full 67 function point UI acceptance matrix
  with one worker to keep remote micro-frontend loading stable and reports any
  blank page, key text mismatch, missing interaction surface, browser error, or
  HTTP 4xx/5xx as a failure.
- Remote browser runs default to one worker, one retry, and longer login/goto/API
  waits so the full suite can distinguish business regressions from transient
  network or DNS jitter.

The next layer should add component/unit tests for shared grid utilities and an
agent semantic regression runner for the Chinese query test set.
