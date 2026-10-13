# ADR 0019: Super Administrator Digital-Twin Session Overview

## Status

Accepted

## Decision

Expose a read-only `public.admin_twin_sessions(integer)` RPC for the
authenticated `super_admin` role. It returns bounded digital-twin session
metadata only; message bodies remain behind the existing owner-scoped RLS
routes. The runtime records each successful overview access in the existing
`company_site.agent_audit_events` ledger.

## Security

The HTTP role check is defense in depth. The `SECURITY DEFINER` RPC independently
requires the JWT `app_role` claim to equal `super_admin`, clamps the requested
limit to 200, and grants execution only to `web_user`.

The `core-027` corrective migration uses `IS DISTINCT FROM` so missing or empty
role claims also fail closed. The core postcheck exercises absent, empty,
non-admin and super-admin claims; it restores the calling session's claims.
