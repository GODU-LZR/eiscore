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
NODE

export CI=true
export npm_config_audit=false
export npm_config_fund=false
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
for package in . packages/eiscore-platform eiscore-base eiscore-apps eiscore-company-site eiscore-hr eiscore-materials eiscore-sales eiscore-mobile; do
  npm --prefix "$package" ci --no-audit --no-fund
done

for test in platform-auth-session-regression enterprise-module-routing-regression enterprise-config-regression sales-follow-up-attention-regression sales-apps-load-resilience-regression; do
  node "tests/engineering/$test.mjs"
done
for package in eiscore-base eiscore-apps eiscore-company-site eiscore-hr eiscore-materials eiscore-sales eiscore-mobile; do
  npm --prefix "$package" run build
done

# The shared aggregator requires all twelve applications. This deployment has seven entries.
node --input-type=module <<'NODE'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const root = join(process.env.YAYU_RELEASES_ROOT, process.env.YAYU_RELEASE_VERSION)
mkdirSync(root, { recursive: false })
cpSync('eiscore-base/dist', root, { recursive: true })
const mounts = ['apps', 'company-site', 'hr', 'materials', 'sales', 'mobile']
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
cpSync('deploy/yayu/login.css', join(root, 'config/deployment-login.css'))
const indexPath = join(root, 'index.html')
const index = readFileSync(indexPath, 'utf8')
writeFileSync(indexPath, index.replace('</head>', '    <link rel="stylesheet" href="/config/deployment-login.css">\n  </head>'))
writeFileSync(join(root, 'config/frontend-dist-manifest.json'), JSON.stringify({
  enterpriseId: 'yayu', sourceRevision: process.env.EISCORE_SOURCE_REVISION,
  release: process.env.YAYU_RELEASE_VERSION, generatedAt: new Date().toISOString(),
  host: 'eiscore-base', mounts, count: mounts.length
}, null, 2) + '\n')
NODE
node scripts/generate-client-cache-manifest.mjs "$YAYU_RELEASES_ROOT/$version"
bash deploy/yayu/publish.sh "$version" --check-only
printf '%s\n' "$EISCORE_SOURCE_REVISION" > "$YAYU_RELEASES_ROOT/$version/.complete"
printf 'Candidate ready: %s (not published)\n' "$YAYU_RELEASES_ROOT/$version"
