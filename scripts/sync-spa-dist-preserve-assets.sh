#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  sync-spa-dist-preserve-assets.sh --dist <local-dist-dir> --dest <dest-dir> [--host <ssh-host>] [--owner <user:group>] [--dry-run]

Examples:
  ./scripts/sync-spa-dist-preserve-assets.sh \
    --dist eiscore-materials/dist \
    --dest /var/www/nanpai-eiscore/materials \
    --host nanpai-eiscore \
    --owner www-data:www-data

The script updates SPA root files with rsync --delete, but preserves old hashed
assets by syncing assets/ without --delete. This avoids dynamic import failures
for clients that still hold an older micro-frontend entry chunk.
USAGE
}

DIST_DIR=""
DEST_DIR=""
SSH_HOST=""
OWNER=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist)
      DIST_DIR="${2:-}"
      shift 2
      ;;
    --dest)
      DEST_DIR="${2:-}"
      shift 2
      ;;
    --host)
      SSH_HOST="${2:-}"
      shift 2
      ;;
    --owner)
      OWNER="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$DIST_DIR" || -z "$DEST_DIR" ]]; then
  usage >&2
  exit 2
fi

if [[ ! -d "$DIST_DIR" || ! -f "$DIST_DIR/index.html" ]]; then
  echo "dist directory must exist and contain index.html: $DIST_DIR" >&2
  exit 1
fi

if [[ ! -d "$DIST_DIR/assets" ]]; then
  echo "dist directory must contain assets/: $DIST_DIR" >&2
  exit 1
fi

RSYNC_FLAGS=(-az)
if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_FLAGS+=(--dry-run)
fi

run_remote() {
  local command="$1"
  if [[ -n "$SSH_HOST" ]]; then
    ssh "$SSH_HOST" "$command"
  else
    bash -lc "$command"
  fi
}

target() {
  local path="$1"
  if [[ -n "$SSH_HOST" ]]; then
    printf '%s:%s' "$SSH_HOST" "$path"
  else
    printf '%s' "$path"
  fi
}

timestamp="$(date +%Y%m%d_%H%M%S)"
backup_dir="${DEST_DIR}.bak.${timestamp}"

if [[ "$DRY_RUN" != "1" ]]; then
  run_remote "set -e; if [ -d '$DEST_DIR' ]; then cp -a '$DEST_DIR' '$backup_dir'; fi; mkdir -p '$DEST_DIR/assets'"
fi

rsync "${RSYNC_FLAGS[@]}" --delete --exclude='/assets/' "${DIST_DIR%/}/" "$(target "$DEST_DIR/")"
rsync "${RSYNC_FLAGS[@]}" "${DIST_DIR%/}/assets/" "$(target "$DEST_DIR/assets/")"

if [[ -n "$OWNER" && "$DRY_RUN" != "1" ]]; then
  run_remote "chown -R '$OWNER' '$DEST_DIR'"
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run complete."
else
  echo "Synced $DIST_DIR to ${SSH_HOST:+$SSH_HOST:}$DEST_DIR"
  echo "Backup: ${SSH_HOST:+$SSH_HOST:}$backup_dir"
fi
