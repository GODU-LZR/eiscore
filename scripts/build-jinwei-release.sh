#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="${1:-$ROOT_DIR/deploy/jinwei/release}"

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

build_app() {
  local name="$1"
  echo "===== building $name ====="
  npm --prefix "$ROOT_DIR/$name" run build
}

apps=(
  eiscore-base
  eiscore-hr
  eiscore-materials
  eiscore-apps
  eiscore-sales
  eiscore-purchase
  eiscore-production
  eiscore-quality
  eiscore-equipment
  eiscore-decision
  eiscore-mobile
  eiscore-company-site
)

for app in "${apps[@]}"; do
  build_app "$app"
done

# Each Vite app already emits the URL prefix expected by the host router.
# Copying the directories verbatim keeps hashed imports and qiankun entries
# stable while allowing one Nginx image to serve the complete release.
cp -a "$ROOT_DIR/eiscore-base/dist/." "$RELEASE_DIR/"
for app in "${apps[@]:1}"; do
  case "$app" in
    eiscore-hr) prefix=hr ;;
    eiscore-materials) prefix=materials ;;
    eiscore-apps) prefix=apps ;;
    eiscore-sales) prefix=sales ;;
    eiscore-purchase) prefix=purchase ;;
    eiscore-production) prefix=production ;;
    eiscore-quality) prefix=quality ;;
    eiscore-equipment) prefix=equipment ;;
    eiscore-decision) prefix=decision ;;
    eiscore-mobile) prefix=mobile ;;
    eiscore-company-site) prefix=company-site ;;
    *) echo "unknown app prefix: $app" >&2; exit 1 ;;
  esac
  mkdir -p "$RELEASE_DIR/$prefix"
  cp -a "$ROOT_DIR/$app/dist/." "$RELEASE_DIR/$prefix/"
done

# Public media is part of the company-site build and is referenced by the
# database seed with /company-site/assets/... URLs.
if [[ ! -d "$RELEASE_DIR/company-site/assets" ]]; then
  echo "company-site assets were not emitted" >&2
  exit 1
fi

node "$ROOT_DIR/scripts/generate-client-cache-manifest.mjs" "$RELEASE_DIR"

echo "Jinwei release ready: $RELEASE_DIR"
du -sh "$RELEASE_DIR"
