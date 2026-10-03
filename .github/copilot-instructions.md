# Copilot / AI Agent Quick Reference for EISCore

Purpose: give AI coding agents the minimal, actionable context to be immediately productive in this repo.

1. Project layout & high-level architecture
   - qiankun micro-frontends: `eiscore-base` is the host; sub-apps live in `eiscore-hr`, `eiscore-materials`, `eiscore-apps`.
   - EISCore Runtime + Harness Gateway: `realtime/` (runtime port 8078). The DeepSeek SDK bridge is `agent-harness/dsh-http-bridge.mjs` (bridge port 3080); see the production Compose contracts.
   - DB & API: PostgreSQL (5432) + PostgREST API (3000). SQL schemas under `sql/` (notably `sql/app_center_schema.sql`).

2. Operational entrypoints (developer commands)
   - DB/runtime checks: use the scoped `npm run test:database:*` and Harness contracts; do not run an unscoped Compose start.
   - Env: production requires `EISCORE_HARNESS_ENABLED=true`, `EISCORE_HARNESS_URL`, an audit hash key, a tool-proxy secret, `DSH_PROVIDER`, and `DSH_MODEL`; direct model API keys are not read by EISCore Runtime.
   - Build/runtime checks: `npm run test:harness`, `npm run test:runtime-image`, `npm run test:production-config`.
   - Frontends (local dev):
     - `cd eiscore-base && npm install && npm run dev` (port 8080)
     - `cd eiscore-apps && npm install && npm run dev` (port 8083)
   - Tests: `cd realtime && npm test` and `cd eiscore-apps && npm run test`.

3. Harness constraints & capability contract (enforceable rules)
   - Harness-visible capabilities are registered in `agent-harness/plugin-contract.v1.json` and dispatched through `realtime/harness-gateway.js` and `realtime/harness-tool-gateway.js`.
   - Every request is bound to authenticated subject, tenant, permissions, session and audit context. Write capabilities require explicit confirmation and an idempotency key.
   - The SDK bridge may call only the authenticated `/internal/harness/tool` proxy with the shared `EISCORE_TOOL_PROXY_SECRET`; it must not receive user JWTs or direct database credentials.
   - Database access uses the PostgREST port and RLS-owned context. Do not add direct provider egress, legacy Agent orchestration, Cline execution or fallback paths.

4. Code style & conventions (for generated/modified code)
   - Frontend: Vue 3 + Vite + Composition API. Use `<script setup>` and Element Plus for UI.
   - Placement: follow existing project structure (create components in `components/`, pages in `views/`, shared helpers in `utils/`).
   - Microfrontend registration: respect `eiscore-base/src/micro/apps.js` (use dynamic host, do not hardcode `localhost`).
   - Server-side: put runtime logic under `realtime/`. Agent tasks should target `realtime` and frontends only; avoid touching infra files unless explicitly requested.

5. Harness I/O format (how to call capabilities)
   - User-facing chat uses canonical Runtime routes such as `POST /ai/chat/completions` and `POST /twin/chat`; fixed capabilities use `POST /ai/harness/execute`.
   - The official DSH SDK reaches EISCore tools only through the bridge proxy contract. Do not expose arbitrary shell, filesystem, subagent or model-provider tools.
   - Prefer small, incremental, well-scoped file changes with a short rationale message.

6. Useful files to consult before making changes
   - `agent-harness/plugin-contract.v1.json` and `agent-harness/MIGRATION_CATALOG.json` — capability and migration inventory.
   - `realtime/harness-runtime.js`, `realtime/harness-gateway.js`, `realtime/harness-tool-gateway.js` — Runtime dispatch and boundary enforcement.
   - `agent-harness/dsh-http-bridge.mjs` and `agent-harness/eiscore-tools.mjs` — official SDK bridge and restricted tool plugin.
   - `docs/engineering/DEEPSEEK_HARNESS_BACKEND_MIGRATION_STATUS.md` — current evidence, blockers and deployment constraints.
   - `docker-compose.yml` — service ports and volume mounts (how the agent sees the workspace).
   - `eiscore-base/src/micro/apps.js` — micro-frontend registration pattern (dynamic host).
   - `eiscore-apps/src/utils/agent-client-examples.js` — example client usage of the Agent WebSocket API.

7. Safe-change checklist (before executing writes)
   - Confirm target path is under `/workspace/<project>`.
   - Check `package.json` for dependency changes and prefer `npm install` via allowed commands.
   - If adding endpoints or DB-backed features, use PostgREST + migrations (`sql/` folder) and register schema changes as new SQL files.
   - Run the relevant Harness/database contracts and `npm run test:syntax`; do not claim external Provider, client-plugin, RLS or remote deployment validation without the corresponding environment evidence.

8. When to ask for human review
   - Any change to `docker-compose.yml`, CI, security settings, or DB migrations.
   - API contract changes (new PostgREST resources or schema migrations).
   - Large refactors affecting multiple sub-apps or shared runtime behavior.

---

If any part of this is unclear or you want more examples (code snippets or templates for common changes), tell me which area to expand and I'll iterate.  ✅
