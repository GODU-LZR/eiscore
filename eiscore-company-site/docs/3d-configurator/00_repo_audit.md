# 3D Configurator / BOM Repository Audit

Date: 2026-08-13  
Scope: `eiscore-company-site`, `enterprise-site`, `company-site-platform`, EISCore base and application-center runtime

## Executive finding

The project already has two related but separate surfaces:

1. `enterprise-site` + `company-site-platform` is the public, multilingual company site at `/company/`. It owns public content, SEO SSR, inquiries and the constrained sales Agent.
2. `eiscore-company-site` is an existing qiankun child at `/company-site/`, but its current implementation is an operations dashboard only. It is mounted by `eiscore-base` and follows the EISCore theme bridge.

The first Cue Builder prototype belongs in the existing `eiscore-company-site` child so it is part of the EISCore application system. The public site should link to a future public configurator route only after a BFF contract, asset approval and anonymous design-sharing policy are ready. The prototype therefore uses programmatic geometry and local browser persistence; it does not write production orders, inventory, BOM or PostgreSQL records.

## Current runtime map

| Area | Current location | Finding | Change boundary |
| --- | --- | --- | --- |
| Public storefront | `enterprise-site/` | Config-driven vanilla browser renderer; localized internal links and public forms already exist | Keep public content and SEO behavior intact |
| Public BFF | `company-site-platform/server.js`, `core.js` | Public config/content, leads, events, Agent sessions/messages and admin workflow exist | Add configurator APIs only after schema/authorization design |
| EISCore base | `/home/lzr/eiscore/eiscore-base/` | qiankun host registers `/company-site/index.html` and mounts `#subapp-viewport` | Registering a new child is not required; use existing company-site child |
| Company-site child | `/home/lzr/eiscore/eiscore-company-site/` | Vue 3 + Vite + qiankun + Element Plus; one operations route `/` | Add `/cue-builder` as a bounded feature route |
| App center | `/home/lzr/eiscore/eiscore-apps/` | Existing card-style app center for internal data/workflow applications | Do not place 3D rendering inside the app center |
| Theme bridge | `shared/eis-theme-sync.js` | Copies EISCore CSS variables and dark-mode state into child mount scopes | Cue Builder consumes EISCore variables; no separate theme system |
| Deployment | `scripts/ecosystem.config.js`, `scripts/deploy-pm2.sh` | `eiscore-company-site` builds to `/company-site/` and is served by the existing runtime | Build/deploy child with existing frontend pipeline |

## Existing public platform capabilities

- Public `site-config`, pages, products, solutions, cases, FAQ, sitemap, robots, events, downloads and leads.
- Admin content state flow: `draft -> review -> approved -> published` with audit and rollback support.
- Sales Agent session/message/lead flow; public knowledge search is limited to published knowledge.
- EISCore adapter is explicitly read-only and returns `not_configured` when inventory/BOM/capacity/progress credentials are not configured.
- There are no configurator endpoints such as `POST /configurations`, `validate`, `quote`, `bom`, `share` or `sync-eiscore` yet.

## Existing EISCore integration points

- qiankun child registration: `eiscore-base/src/micro/apps.js` (`eiscore-company-site`, entry `/company-site/index.html`).
- Child lifecycle: `eiscore-company-site/src/main.js` uses `renderWithQiankun` and `installEisThemeSync`.
- Child router: `eiscore-company-site/src/router/index.js` uses `/company-site` history base when mounted.
- Auth: child requests use `/agent` and the shared EISCore JWT from local storage.
- Theme: the child receives the host's Element Plus CSS variables and dark-mode class.
- Existing operations UI: `CompanySiteOps.vue` already exposes site, content, leads and SEO workflows.

## First implementation decision

Use Vue + Three.js in `eiscore-company-site` instead of introducing a second React runtime. This keeps the prototype within the existing qiankun/Vite/Element Plus toolchain and makes the route available from the same internal tab/card workflow. The 3D engine is isolated in `src/components/configurator/` and the configuration/rules layer is isolated in `src/configurator/`.

## Dependency and asset status before P2

- Three.js was not present in `eiscore-company-site`; it is added only for the Cue Builder route.
- No GLB/KTX2 production assets are currently present in the company-site child.
- Existing public-site photographs are not 3D assets and are not reused as 3D textures.
- The prototype's colors and materials are generated from code and marked as prototype-only in the asset manifest.
- No third-party model, texture, logo, competitor image or scraped product art is downloaded into the repository.

## Risks and rollback

| Risk | Control | Rollback |
| --- | --- | --- |
| 3D bundle affects existing operations route | Lazy-load the Cue Builder route and keep the operations page import path unchanged | Remove route/component and rebuild existing child |
| WebGL unavailable or slow | Show a canvas fallback message and retain configuration/BOM controls | Disable 3D mount without losing Design JSON |
| Prototype values mistaken for production facts | Label `PROTOTYPE`, use generated variants and no production API writes | Delete prototype catalog without touching company-site platform state |
| Invalid combination reaches production | Client validation is advisory only; future order flow must call backend `validate` | No production order endpoint exists in this phase |
| Asset license ambiguity | `licenses.csv` and `asset_manifest.json` block unverified assets | Keep asset out of `assets/web` and production build |

## Next gates

1. Review the prototype interaction and component-slot vocabulary with the factory/product owner.
2. Replace prototype variants with supplier-confirmed `component_variant` records and actual dimensions.
3. Define BFF persistence and authorization for `design_id`, revision and snapshot hash.
4. Add backend `validate -> quote -> bom` contract tests before any cart/order integration.
5. Only then introduce approved GLB/KTX2 assets and public sharing.
