#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail

# Run inside the isolated Node builder, with source at /workspace and releases at /releases.
cd "${YAYU_SOURCE_ROOT:-/workspace}"
version="${1:?Usage: build-frontends.sh <unique-release-version>}"
[[ "$version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || { echo 'Invalid release version' >&2; exit 2; }
export YAYU_RELEASES_ROOT="${YAYU_RELEASES_ROOT:-/releases}"
export YAYU_RELEASE_VERSION="$version"
export EISCORE_SOURCE_REVISION="${EISCORE_SOURCE_REVISION:-$(git rev-parse HEAD 2>/dev/null || true)}"
[[ "$EISCORE_SOURCE_REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo 'Set EISCORE_SOURCE_REVISION to the exported source commit' >&2; exit 2; }
[[ ! -e "$YAYU_RELEASES_ROOT/$version" ]] || { echo 'Release already exists; choose a new version' >&2; exit 2; }

node --input-type=module <<'NODE'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseEnterpriseConfig } from './packages/eiscore-platform/src/enterprise-config.mjs'
const [major, minor] = process.versions.node.split('.').map(Number)
assert.ok(major === 20 && minor >= 19, 'Use Node 20.19 or newer Node 20 builder')
const config = parseEnterpriseConfig(JSON.parse(readFileSync('eiscore-base/public/config/eiscore-enterprise.json', 'utf8')))
assert.equal(config.enterprise.id, 'yayu', 'Mount the Yayu runtime config over the base public config before building')
assert.equal(config.endpoints.publicBaseUrl, 'https://yayu.eiscore.top')
for (const id of ['hr', 'materials', 'apps', 'sales', 'purchase', 'mobile']) assert.equal(config.modules[id], true)
for (const id of ['company-site', 'production', 'quality', 'equipment', 'decision']) assert.equal(config.modules[id], false)
assert.equal(config.features.materialsVisible, false)
assert.equal(config.features.purchaseVisible, false)
assert.equal(config.features.appCenterVisible, false)
NODE

export CI=true
export npm_config_audit=false
export npm_config_fund=false
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export VITE_ENTERPRISE_SHARE_TITLE="$(node -p 'JSON.parse(require("fs").readFileSync("deploy/yayu/site-profile.json", "utf8")).site.seo.title')"
export VITE_ENTERPRISE_SHARE_IMAGE='/enterprise-assets/yayu/yayu-hero.webp'
export VITE_ENTERPRISE_SHARE_ORIGIN='https://yayu.eiscore.top'
export VITE_ENTERPRISE_FAVICON='/enterprise-assets/yayu/yayu-red-fangsong-favicon.png'
for package in . packages/eiscore-platform eiscore-base eiscore-apps eiscore-hr eiscore-sales eiscore-mobile; do
  npm --prefix "$package" ci --no-audit --no-fund
done

for test in platform-auth-session-regression enterprise-module-routing-regression enterprise-config-regression enterprise-industry-site-regression enterprise-surface-theme-regression sales-follow-up-attention-regression sales-apps-load-resilience-regression harness-auth-client-regression yayu-harness-artifact-regression yayu-harness-visual-renderer-regression yayu-harness-worker-draft-regression yayu-harness-panel-drop-regression eiscore-embed-route-regression sales-flow-navigation-regression yayu-sales-shipping-regression yayu-runtime-routing-regression app-center-standalone-entry-regression grid-property-write-regression; do
  node "tests/engineering/$test.mjs"
done
for package in eiscore-base eiscore-apps eiscore-hr eiscore-sales eiscore-mobile; do
  npm --prefix "$package" run build
done

# This tenant exposes only the workbench, sales, HR, and mobile entry points.
node --input-type=module <<'NODE'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const root = join(process.env.YAYU_RELEASES_ROOT, process.env.YAYU_RELEASE_VERSION)
mkdirSync(root, { recursive: false })
cpSync('eiscore-base/dist', root, { recursive: true })
const mounts = ['apps', 'hr', 'sales', 'mobile']
for (const mount of mounts) {
  const source = `eiscore-${mount}/dist`
  if (!existsSync(join(source, 'index.html'))) throw new Error(`Missing build: ${mount}`)
  cpSync(source, join(root, mount), { recursive: true })
}
for (const file of ['index.html', 'sw.js']) {
  const path = join(root, file)
  const text = readFileSync(path, 'utf8')
  if (!/const RELEASE_VERSION = '[^']*'/.test(text) && !/var RELEASE_VERSION = '[^']*'/.test(text)) throw new Error(`Missing cache version: ${file}`)
  writeFileSync(path, text.replace(/((?:const|var) RELEASE_VERSION = )'[^']*'/, `$1'${process.env.YAYU_RELEASE_VERSION}'`))
}
mkdirSync(join(root, 'config'), { recursive: true })
cpSync('deploy/yayu/site-profile.json', join(root, 'config/site-profile.json'))
cpSync('eiscore-base/public/config/eiscore-enterprise.json', join(root, 'config/eiscore-enterprise.json'))
writeFileSync(join(root, 'config/frontend-dist-manifest.json'), JSON.stringify({
  enterpriseId: 'yayu', sourceRevision: process.env.EISCORE_SOURCE_REVISION,
  release: process.env.YAYU_RELEASE_VERSION, generatedAt: new Date().toISOString(),
  host: 'eiscore-base', mounts, count: mounts.length
}, null, 2) + '\n')
NODE
node deploy/yayu/generate-cache-manifest.mjs "$YAYU_RELEASES_ROOT/$version"
bash deploy/yayu/publish.sh "$version" --check-only
printf '%s\n' "$EISCORE_SOURCE_REVISION" > "$YAYU_RELEASES_ROOT/$version/.complete"
printf 'Candidate ready: %s (not published)\n' "$YAYU_RELEASES_ROOT/$version"
