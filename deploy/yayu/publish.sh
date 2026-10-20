#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail

version="${1:?Usage: publish.sh <release-version> [--check-only]}"
[[ "$version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || { echo 'Invalid release version' >&2; exit 2; }
[[ "${2:-}" == '' || "${2:-}" == '--check-only' ]] || { echo 'Unsupported argument' >&2; exit 2; }
export YAYU_RELEASES_ROOT="${YAYU_RELEASES_ROOT:-/opt/yayu-eiscore/releases}"
export YAYU_RELEASE_VERSION="$version"

# Check actual files, not just an HTML 200 returned by a SPA fallback.
node --input-type=module <<'NODE'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
const releases = realpathSync(process.env.YAYU_RELEASES_ROOT)
const root = realpathSync(resolve(releases, process.env.YAYU_RELEASE_VERSION))
assert.ok(root.startsWith(releases + sep), 'Candidate must stay inside isolated releases')
const mounts = ['', 'apps', 'hr', 'sales', 'mobile']
let checked = 0
for (const mount of mounts) {
  const relative = mount ? `${mount}/index.html` : 'index.html'
  const html = readFileSync(resolve(root, relative), 'utf8')
  assert.ok(/<script\b/i.test(html), `Missing scripts: ${relative}`)
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
    const raw = match[1]
    if (/^(?:[a-z]+:|\/\/|#)/i.test(raw)) continue
    const url = new URL(raw, `https://yayu.eiscore.top/${relative}`)
    const pathname = decodeURIComponent(url.pathname)
    if (!/\.(?:m?js|css|ico|svg|png|jpe?g|webp|woff2?)(?:$)/i.test(pathname)) continue
    const file = resolve(root, '.' + pathname)
    assert.ok(file.startsWith(root + sep) && existsSync(file) && statSync(file).isFile(), `Missing asset ${pathname}`)
    checked++
  }
}
const config = JSON.parse(readFileSync(resolve(root, 'config/eiscore-enterprise.json'), 'utf8'))
assert.equal(config.enterprise.id, 'yayu')
assert.equal(config.endpoints.publicBaseUrl, 'https://yayu.eiscore.top')
const proof = JSON.parse(readFileSync(resolve(root, 'config/frontend-dist-manifest.json'), 'utf8'))
assert.equal(proof.enterpriseId, 'yayu')
assert.equal(proof.release, process.env.YAYU_RELEASE_VERSION)
const manifest = JSON.parse(readFileSync(resolve(root, 'asset-manifest.json'), 'utf8'))
assert.ok(manifest.version && manifest.urls?.length > 0)
for (const url of manifest.urls) {
  const file = resolve(root, '.' + url)
  assert.ok(file.startsWith(root + sep) && existsSync(file), `Manifest asset missing: ${url}`)
}
console.log(`Validated ${mounts.length} entries, ${checked} entry assets, ${manifest.urls.length} manifest assets`)
NODE
[[ "${2:-}" != '--check-only' ]] || exit 0
[[ -s "$YAYU_RELEASES_ROOT/$version/.complete" ]] || { echo 'Candidate build is incomplete' >&2; exit 1; }

# Only this fixed container may be validated. No Compose up/down or other tenant writes.
docker exec yayu-eiscore-web nginx -t
cd "$YAYU_RELEASES_ROOT"
[[ ! -e current || -L current ]] || { echo 'current must be a symlink' >&2; exit 1; }
previous="$(readlink current || true)"
if [[ -n "$previous" ]]; then
  [[ "$previous" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || { echo 'Unexpected current target' >&2; exit 1; }
fi
next_link=".current-${version}-$$"
ln -s "$version" "$next_link"
mv -Tf "$next_link" current

# Nginx serves the parent releases bind mount, so the symlink switch is immediately visible.
if ! curl --fail --silent --show-error --max-time 20 "http://127.0.0.1:18396/config/frontend-dist-manifest.json?release=$version" | \
  EXPECTED_RELEASE="$version" node --input-type=module -e 'let text=""; for await (const chunk of process.stdin) text+=chunk; if(JSON.parse(text).release!==process.env.EXPECTED_RELEASE) process.exit(1)'; then
  if [[ -n "$previous" ]]; then
    ln -s "$previous" "$next_link"
    mv -Tf "$next_link" current
    echo "Smoke failed; restored $previous" >&2
  else
    echo 'Initial smoke failed; inspect the isolated Web before admitting public traffic' >&2
  fi
  exit 1
fi
if [[ -n "$previous" && "$previous" != "$version" ]]; then
  ln -s "$previous" ".previous-$$"
  mv -Tf ".previous-$$" previous
fi
printf 'Published %s; previous=%s\n' "$version" "${previous:-none}"
