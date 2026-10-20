# ADR 0023: Preserve Static Field Access During Initial Catalog Discovery

## Status

Accepted

## Decision

Migration `core-033` changes only `ensure_field_acl`. For an active role with
no field ACL rows at all for a registered, active static application, its first
catalog batch is inserted as active. This preserves the Grid's existing access
when no field rule exists and prevents a read of the permission settings page
from masking every field. The initial status is determined once per role/module
before any field in the batch is inserted.

Every existing ACL row is preserved, including active denials, pending grants,
disabled rules and locked rules. Missing fields discovered after a role/module
has any ACL remain pending. Created roles, dynamic applications and unknown or
inactive static application catalogs also remain pending. The Grid continues to
enforce only active/locked rows; this does not make pending rules effective or
grant application/operation permissions.

## Upgrade and Rollback

The migration performs no ACL data update or deletion. Previously created rows
cannot be distinguished from deliberate pending grants and require explicit
operator review rather than automatic activation. Use the governed runner with
a pre-upgrade backup; rollback restores that backup, or applies a new corrective
migration restoring the previous function definition. Historical migrations
and customer business records remain unchanged.
