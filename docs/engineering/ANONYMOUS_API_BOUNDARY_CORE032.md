# Anonymous API permissions: core-032

Anonymous browser requests previously inherited explicit `web_anon` SELECT
grants on business tables and views. Some tables have permissive RLS policies;
others have no RLS. Checking a header at Nginx would leave the database boundary
open. This migration removes anonymous database capabilities at their source.

The only anonymous PostgREST entry points retained are `public.login(text,text)`
and `public.login(json)`. Published website content and enquiries use the Agent
BFF, whose grants and RLS policies are unchanged. Authenticated `web_user`,
`eiscore_agent` and `eiscore_flash_agent` grants are unchanged. This migration
does not alter business rows, ownership, JWT validation or RLS policies.

The affected schemas are `public`, `hr`, `scm`, `app_center`, `workflow`,
`app_data` and `company_site`. All table, column, sequence and non-login
function privileges are revoked from both `web_anon` and `PUBLIC`. Anonymous
schema usage is also removed except for `public`, which login requires.

Default grants are cleaned for the existing API object/default-ACL creators,
including the old `postgres` bootstrap owner and `eiscore_owner`. PostgreSQL's
global default PUBLIC function execution must be revoked globally: revoking it
only inside a schema does not cancel the global default. Existing functions
keep their authenticated explicit grants; new RPCs must grant the intended
runtime roles explicitly, consistent with core-002. No broad authenticated
function grant is introduced. The runtime check fails if `web_anon` can assume
another role rather than silently accepting an indirect bypass.

## Upgrade

Run through the governed migration runner with a protected backup and the
recorded SHA-256, as a single transaction. On an installation whose old
migrations were applied without ledger records, render **only core-032**;
do not replay historical entries or invent historical ledger records.

Before applying, as the database administrator:

```sh
umask 077
docker exec -i DATABASE_CONTAINER psql -X -At -U postgres -d DATABASE_NAME \
  -v ON_ERROR_STOP=1 < scripts/backup-anonymous-api-acl.sql > /protected/path/core032-restore-acl.sql
test -s /protected/path/core032-restore-acl.sql
```

The backup query is read only. It emits SQL restoring the affected grants on
schemas, tables, columns, sequences and functions, plus global/schema default
ACLs, including PostgreSQL's implicit global PUBLIC EXECUTE default. It contains
no business rows, passwords or tokens. Keep this backup private because it
describes the database structure. Take the normal protected database backup
as well; never restore business rows merely to roll back this ACL migration.

Record existing authenticated effective privileges before and after the
transaction; existing business table and RPC permissions must be identical.
The production preflight found zero current PUBLIC function EXECUTE grants,
and explicit `web_user` grants on summaries, card statistics, ACL initialisation
and inventory RPCs. A deployment with different grants must verify its own
authenticated compatibility before committing.

After applying, run `database/migrations/postchecks/core-032.sql`. This assertion
also runs as part of the complete core postcheck. Verify remotely without
credentials that business GETs/RPCs return permission errors and malformed JWTs
are rejected. Verify the website, public configuration and enquiry validation,
login, authenticated sales/HR/material tables, summaries and Agent reads.
Do not use actual stock movements or real customer enquiries as a health check.

## Rollback

Replay the generated `core032-restore-acl.sql` as the administrator. It restores
only the previously existing anonymous/PUBLIC grants and default ACLs. It does
not restore data or replace another role's grants. Run the governed ledger
rollback/recovery procedure for core-032 alongside that replay. Recheck current
authenticated functionality. This restores the former anonymous permissions,
including the reported exposure; use it only to recover an incompatible
release, then reapply a corrected security patch promptly.

## Verification

```sh
node scripts/test-anonymous-api-boundary.mjs
```

The test starts a temporary PostgreSQL container with no external network or
ports, creates synthetic data, and removes the container in `finally`. It
checks anonymous table/column/view/RPC denial, both login overloads, all
authenticated effective permissions, authenticated summaries/ACL/inventory
RPCs and inserts, future object defaults, idempotence and the generated ACL
rollback. `--wsl=Ubuntu` runs Docker through WSL on Windows;
`EISCORE_TEST_POSTGRES_IMAGE` can select an already cached PostgreSQL image.
