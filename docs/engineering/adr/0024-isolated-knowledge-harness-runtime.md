# ADR 0024: Isolated Enterprise Knowledge Harness Runtime

## Status

Accepted for implementation in the isolated Huizhong task branch. This ADR does
not authorize database migration, service restart, or remote deployment.

## Decision

Serve the enterprise knowledge Harness through its own Web, Agent, and provider
bridge processes. Give it an independent DSH home/workspace volume, provider
state volume, audit file, bridge/tool secrets, auth-cookie prefix, and iframe
URL namespace. Its Agent profile exposes only digital-twin capabilities and
fixes the signed PostgREST `harness_namespace` claim to `knowledge` on the
server. Business and Flash profiles do not expose knowledge routes.

Use the same authenticated EISCore identity handoff. The browser receives no
workspace ID, namespace claim, JWT, or session owner from the parent page.

## Consequences

Knowledge sessions and provider state cannot be selected by, or reused from,
the business or Flash Harness. Existing business twin rows stay in the
`business` namespace; the ordered database migration adds namespace-scoped RLS
for future knowledge rows. Deployment must create the three isolated services,
provide independent secrets, and apply the migration before enabling the new
knowledge routes.

Rollback disables the knowledge routes/services and restores the prior Web
configuration. Database rollback uses the governed pre-migration backup; no
runtime rollback deletes existing business or knowledge records.

## Known Limitation

Independent containers and volumes isolate Knowledge from business and Flash,
but do not by themselves isolate multiple EISCore accounts inside one Knowledge
Web process. The pinned DSH Web runner currently checks ownership on session
create and prompt only; the full native workspace/session read and mutation API
surface, including WebSocket streams, has not been given a verified server-side
per-user ACL. Do not claim account-to-account native DSH session isolation until
that boundary is enforced and tested. Database-backed digital-twin records
remain user- and namespace-scoped by the signed claim and RLS.
