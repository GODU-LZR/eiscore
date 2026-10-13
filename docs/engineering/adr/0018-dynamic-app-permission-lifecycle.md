# ADR 0018: Dynamic App Permission Lifecycle

## Status

Accepted

## Context

Dynamic applications are created and deleted through both App Center UI and
the Harness/Flash tool path. Permission definitions live in `public.permissions`
and role grants live in `public.role_permissions`; previously neither table
recorded which App Center app owned a dynamic permission. Frontend-only
best-effort cleanup could therefore leave permission rows after app deletion.

## Decision

Use `app_center.apps` as the lifecycle source of truth. A database trigger
reconciles the app's `app:<aclModule>` and operation permissions in the same
transaction as create/update/delete, including status archival and ACL module
changes. Dynamic permission rows carry `source_app_id` with an `ON DELETE
CASCADE` foreign key. Removing a permission row cascades its role assignments;
app cleanup also removes matching field ACL rows. Static application catalog
permissions remain unowned and are not changed by this lifecycle.

## Consequences

- All current app writers, including Harness, use the same transactional
  permission lifecycle without a separate API call.
- App creation/update fails atomically if permission synchronization fails.
- Deleting an app removes its generated permissions and role grants.
- Archiving an app retires its generated permission definitions in place,
  while unarchiving restores the definitions and preserves role assignments.
- Explicitly disabled permission definitions remain disabled when unrelated app
  metadata changes; app deletion still removes definitions and grants.
- ACL module renames move permission and field ACL keys in place, preserving
  role grants and field settings, including while the app is archived.
- Dynamic field ACL rows carry the same app ownership and are moved in place
  on module rename; static or other app field ACL rows are never removed by
  this lifecycle.
- Existing database rows are reconciled by migration `core-017`.
- The public-schema ratchet explicitly approves the required new functions and
  app trigger.

## Rollback

Restore the pre-migration database backup required by the governed migration
runner. The migration runner rejects reusing this migration ID with a different
checksum; a forward corrective migration is required after release.
