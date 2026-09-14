# ADR: Embed EISCore Workbench Features in DeepSeek Harness

## Status

Accepted

## Context

DeepSeek Harness needs access to EISCore's Digital Twin and Smart BI workflows while EISCore remains the owner of their Vue UI, authentication, API clients, SSE streams, sessions, knowledge base, and chart rendering. Copying those workflows into the Harness React client would create a second business implementation and split authentication state.

## Decision

EISCore exposes authenticated `/embed/digital-twin` and `/embed/smart-bi` routes. The routes reuse the existing feature components and use the existing login redirect flow. DeepSeek Harness contributes a browser UI plugin that opens these routes in an iframe from its `shell.overlay` slot and provides two `sidebar.footer.action` entries. The iframe URL is runtime-configurable through `globalThis.__DSH_EISCORE_URL__`, with a local development fallback.

The iframe does not receive authentication tokens in its URL. Authentication stays inside EISCore, and the embed page emits only a non-sensitive ready message to its parent.

## Consequences

- EISCore remains the single owner of Digital Twin and Smart BI behavior.
- Harness adds no business API or session coupling; it only owns panel state and navigation controls.
- Deployments must allow the Harness origin to frame EISCore and configure `__DSH_EISCORE_URL__` when the default local address is not appropriate.
- Closing the panel unmounts the iframe content from the Harness overlay; re-opening creates a fresh feature page.
