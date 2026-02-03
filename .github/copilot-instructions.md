# Copilot / AI Agent Quick Reference for EISCore

Purpose: give AI coding agents the minimal, actionable context to be immediately productive in this repo.

1. Project layout & high-level architecture
   - qiankun micro-frontends: `eiscore-base` is the host; sub-apps live in `eiscore-hr`, `eiscore-materials`, `eiscore-apps`.
   - Agent Runtime (headless AI agent + WebSocket): `realtime/` (ports: runtime 8078). See Docker entry in `docker-compose.yml`.
   - DB & API: PostgreSQL (5432) + PostgREST API (3000). SQL schemas under `sql/` (notably `sql/app_center_schema.sql`).

2. Operational entrypoints (developer commands)
   - DB: `docker-compose up -d db` then import schemas (docker-compose mounts `env/*.sql` and `sql/*.sql`).
   - Env: copy `.env.example` → `.env` and set `ANTHROPIC_API_KEY`, `POSTGRES_PASSWORD`, `PGRST_JWT_SECRET`.
   - Build & run: `docker-compose build agent-runtime` then `docker-compose up -d` to run all services.
   - Frontends (local dev):
     - `cd eiscore-base && npm install && npm run dev` (port 8080)
     - `cd eiscore-apps && npm install && npm run dev` (port 8083)
   - Tests: `cd realtime && npm test` and `cd eiscore-apps && npm run test`.

3. Agent constraints & tool contract (enforceable rules)
   - Workspace root used by agent containers: `/workspace` (volumes in `docker-compose.yml`). Only modify files under mounted project dirs.
   - Command whitelist (currently enforced in `realtime/agent-core.js`): only allow safe commands e.g. `npm install`, `npm list`.
   - Database access: use PostgREST API (http://api:3000) instead of direct SQL writes. Read schema via `/` OpenAPI endpoint.
   - Security: WebSocket clients must pass JWT via `sec-websocket-protocol`.

4. Code style & conventions (for generated/modified code)
   - Frontend: Vue 3 + Vite + Composition API. Use `<script setup>` and Element Plus for UI.
   - Placement: follow existing project structure (create components in `components/`, pages in `views/`, shared helpers in `utils/`).
   - Microfrontend registration: respect `eiscore-base/src/micro/apps.js` (use dynamic host, do not hardcode `localhost`).
   - Server-side: put runtime logic under `realtime/`. Agent tasks should target `realtime` and frontends only; avoid touching infra files unless explicitly requested.

5. Agent I/O format (how to call tools)
   - The runtime expects JSON tool calls embedded in assistant messages; example format (from `realtime/agent-core.js`):
     ```json
     {
       "tool": "write_file",
       "parameters": {
         "path": "relative/path/to/file.vue",
         "content": "file content here"
       }
     }
     ```
   - Available tools exposed by runtime: `write_file`, `read_file`, `list_directory`, `execute_command`, `get_db_schema`, `get_package_json`, `complete`.
   - Prefer small, incremental, well-scoped file changes with a short rationale message.

6. Useful files to consult before making changes
   - `realtime/agent-core.js` — system prompt, tool whitelist, workspace root, DB schema fetch.
   - `eiscore-apps/README.md` — architecture, ports, agent WebSocket API examples, and common workflows.
   - `docker-compose.yml` — service ports and volume mounts (how the agent sees the workspace).
   - `eiscore-base/src/micro/apps.js` — micro-frontend registration pattern (dynamic host).
   - `eiscore-apps/src/utils/agent-client-examples.js` — example client usage of the Agent WebSocket API.

7. Safe-change checklist (before executing writes)
   - Confirm target path is under `/workspace/<project>`.
   - Check `package.json` for dependency changes and prefer `npm install` via allowed commands.
   - If adding endpoints or DB-backed features, use PostgREST + migrations (`sql/` folder) and register schema changes as new SQL files.
   - Run unit tests in `realtime` and `eiscore-apps` locally when relevant.

8. When to ask for human review
   - Any change to `docker-compose.yml`, CI, security settings, or DB migrations.
   - API contract changes (new PostgREST resources or schema migrations).
   - Large refactors affecting multiple sub-apps or shared runtime behavior.

---

If any part of this is unclear or you want more examples (code snippets or templates for common changes), tell me which area to expand and I'll iterate.  ✅
