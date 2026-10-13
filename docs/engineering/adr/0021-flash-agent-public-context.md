# ADR 0021: Flash Agent Public Context Contract

## Status

Accepted

## Decision

Register `public.flash_agent_context()` as the sole public context projection
available to the Flash database role. It returns only Flash application
metadata, registered Flash data tables, field ACLs and active permissions. The
Flash role is denied the general ontology context and all HR, SCM, workflow,
company-site and business-table schemas.

This is an application-owned public function introduced by `core-026`, so it is
listed explicitly in the public Schema ratchet. The ADR records the contract;
it does not authorize applying `core-026` to an existing business database or
changing a frozen release manifest.

Accepted.
