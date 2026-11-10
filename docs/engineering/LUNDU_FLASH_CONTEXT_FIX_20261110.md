# Lundu Flash Harness Context Fix (2026-11-10)

Remote target: `/opt/lundu-eiscore`; public origin `https://lundu.eiscore.top`.
Work branch: `codex/lundu-flash-20261110`.

## Fixes

- `core-028` renames the PL/pgSQL actor variable in `public.flash_agent_context()` to `actor_username`, avoiding ambiguity with `public.users.username`.
- `core-029` grants `eiscore_owner` read-only metadata access required by the SECURITY DEFINER function. Registered Flash `app_data` tables receive SELECT for column introspection. It does not grant those tables to `eiscore_flash_agent`.
- `core-030` reads `public.users.permissions` as `text[]` values instead of applying a jsonb operator.
- `core-031` qualifies the permission aggregate as `permissions.code`.
- `core-032` adds read-only access to `public.role_permissions` for the function owner.
- `/flash-agent/` now proxies Flash Builder's isolated runtime route. The live Nginx config was patched under the shared Lundu web lock and backed up at `/opt/lundu-eiscore/backups/nginx-flash-agent-route-before-20261110T1320Z.conf`.

Frozen `core-026` was not modified. Migrations are recorded in `eiscore_meta.schema_migrations` with source commits `9c88259a`, `c2281f1c`, `868cd568`, `3bcff603`, and `9eae0cce`; each has a verified pre-migration database dump under `/opt/lundu-eiscore/backups/flash-context-before-coreNNN-*`.

## Verification

- Migration governance and focused Flash authorization, migration-runner, release-contract, and Harness routing regressions passed on the dedicated work branch.
- Remote PostgREST RPC returned `200`, `source=flash_agent_context_v1`, user `admin`, effective role `super_admin`, and one visible Flash app.
- Remote Flash Web auth start, handoff, and auth status returned `200`/`201`; protected Flash Harness iframe HTML returned `200` with the correct base path.
- The official DSH `session/create` route returned `200`; the session was registered through `/internal/harness/session`, then Flash context binding returned `200`. Flash draft read and Flash Runtime health both returned `200`.
- Nginx `-t` passed. Only Nginx was reloaded inside the existing web container; its container ID and start time did not change. No database, API, business Agent, Flash Runtime, or Harness Web container was restarted.

## Existing Blocker

The full core postcheck continues to fail at its existing application-object ownership assertion because numerous legacy public/app-center objects are still owned by PostgreSQL's `postgres` role. This migration series intentionally does not reassign those unrelated objects. The Flash-specific RPC and session checks above passed. The local isolated Docker database test could not run because Docker Desktop was unavailable on the Windows host.

GitHub push attempts failed because the host could not connect to GitHub over port 443. The dedicated branch currently contains the source fix and verification document; live runtime changes are applied and evidenced above.
