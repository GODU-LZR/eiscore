# Release Notes - 2026-02-27

## Scope

1. Repository hygiene cleanup
2. Formatting validation gate
3. Release tagging baseline

## Changes

1. Added ignore rules for generated artifacts:
   - `backups/`
   - `**/.uploads/`
2. Removed already-tracked generated artifacts from Git index:
   - `backups/ontology/*`
   - `eiscore-apps/src/views/drafts/.uploads/*`
3. Verified whitespace check on pending release changes (excluding local WIP file):
   - `git diff --check -- . ':(exclude)eiscore-materials/src/views/InventoryStockIn.vue'`

## Runtime Check Snapshot

1. Docker services: all core containers `Up`
2. PM2 frontend processes: `online`
3. Key endpoints responded `200`:
   - `/`
   - `/apps/`
   - `/hr/`
   - `/materials/`
   - `/mobile/`
   - `/api/`
   - `/agent/health`

## Notes

1. Local WIP file intentionally excluded from this release:
   - `eiscore-materials/src/views/InventoryStockIn.vue`

