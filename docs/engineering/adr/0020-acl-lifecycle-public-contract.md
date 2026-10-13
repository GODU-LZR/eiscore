# ADR 0020: ACL Lifecycle Public Contract

## Status

Accepted

## Decision

Register the public ACL lifecycle contract introduced by `core-013`. The
migration adds guarded lifecycle functions, role/permission matrix views and
triggers that keep created, active, locked and disabled authorization state
consistent across role children and user assignments. These objects are
application-owned public API and are therefore listed explicitly in the public
Schema ratchet rather than absorbed into the historical baseline.

The functions remain owner-controlled and the matrix write paths continue to
enforce the existing administrator and permission checks. This ADR authorizes
catalog registration only; it does not authorize applying the migration to an
existing business database.

## Consequences

Fresh and upgrade release candidates must expose the exact approved objects and
must fail closed if any additional public object appears. The frozen baseline,
release manifests and existing database volumes remain unchanged until a
separate release approval.

Accepted.
