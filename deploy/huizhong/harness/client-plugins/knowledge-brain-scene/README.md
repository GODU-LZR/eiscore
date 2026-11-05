# Knowledge conversation brain

Only the knowledge profile loads this client module. The enterprise-tree plugin mounts it inside Harness's `shell.overlay`; the native composer and conversation remain the source of truth. Empty conversations show the brain, the native stop button selects generation pulses, and completion/stop/error runs a bounded 680 ms shrink before idle. The pulse pattern is a visual activity indicator, not model reasoning or a live ontology data mapping.

The scene reuses `eiscore-apps/src/visualization/ontology-brain-scene.js` voxel anatomy and full XYZ grid. Three.js r180 and OrbitControls are vendored from the supplied cognitive-memory reference with their MIT license. No CDN or extra HTTP route is required. `lib/client.js` is the deployment entry, following the existing checked-in DSH client bundle convention.

Build with `npm ci && npm run build:client` in this directory. The pinned esbuild API produces a lazy ModuleLoader factory, so Three.js initialization happens only when the module is materialized. The helper must precede enterprise-tree in `dsh-knowledge-web.patch.yml`; enterprise-tree declares it as an external module dependency.

Rendering is capped at 24 fps and device pixel ratio 1.25. Hidden conversations and hidden browser tabs suspend animation. Reduced-motion requests use a static scene. All GPU resources, timers and observers are released on unmount. Unsupported WebGL preserves the native conversation.

This adapter targets DSH 0.1.2-rc.1 layout and stop-button selectors. Recheck its selectors after upgrading DSH. Test the empty/history/generating/completed/stopped states, sidebar resizing, keyboard input and embedding viewport bounds before publishing. A knowledge-web restart is necessary to rebuild the DSH module graph. Roll back the complete saved knowledge-harness directory and recreate knowledge-web using the existing Compose files; never restore business databases for this UI rollback.
