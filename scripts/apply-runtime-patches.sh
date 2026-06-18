#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

set -euo pipefail

MANIFEST_FILE="sql/runtime_v2_patch_manifest.txt"
POSTCHECK_FILE="sql/runtime_v2_postcheck.sql"
DB_CONTAINER="eiscore-db"
DB_NAME="eiscore"
DB_USER="postgres"
DRY_RUN="false"
SKIP_POSTCHECK="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--manifest)
      MANIFEST_FILE="$2"
      shift 2
      ;;
    --postcheck)
      POSTCHECK_FILE="$2"
      shift 2
      ;;
    -c|--db-container)
      DB_CONTAINER="$2"
      shift 2
      ;;
    -d|--db-name)
      DB_NAME="$2"
      shift 2
      ;;
    -u|--db-user)
      DB_USER="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift 1
      ;;
    --skip-postcheck)
      SKIP_POSTCHECK="true"
      shift 1
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST_PATH="${REPO_ROOT}/${MANIFEST_FILE}"
POSTCHECK_PATH="${REPO_ROOT}/${POSTCHECK_FILE}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found." >&2
  exit 1
fi

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "Manifest file not found: ${MANIFEST_PATH}" >&2
  exit 1
fi

if [[ "${SKIP_POSTCHECK}" != "true" && ! -f "${POSTCHECK_PATH}" ]]; then
  echo "Postcheck file not found: ${POSTCHECK_PATH}" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${DB_CONTAINER}"; then
  echo "DB container is not running: ${DB_CONTAINER}" >&2
  exit 1
fi

if ! docker exec "${DB_CONTAINER}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null; then
  echo "DB is not ready: ${DB_CONTAINER}/${DB_NAME}" >&2
  exit 1
fi

echo "Using manifest: ${MANIFEST_FILE}"
echo "Target database: ${DB_CONTAINER}/${DB_NAME} as ${DB_USER}"

patch_count=0
while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
  line="${raw_line%%#*}"
  patch_file="$(echo "${line}" | xargs)"
  if [[ -z "${patch_file}" ]]; then
    continue
  fi

  patch_path="${REPO_ROOT}/${patch_file}"
  if [[ ! -f "${patch_path}" ]]; then
    echo "Patch file not found: ${patch_file}" >&2
    exit 1
  fi

  patch_count=$((patch_count + 1))
  printf '\n[%02d] %s\n' "${patch_count}" "${patch_file}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    continue
  fi

  cat "${patch_path}" | docker exec -i "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"
done < "${MANIFEST_PATH}"

if [[ "${DRY_RUN}" == "true" ]]; then
  echo
  echo "Dry run passed: ${patch_count} patch file(s) are present."
else
  if [[ "${SKIP_POSTCHECK}" != "true" ]]; then
    printf '\n[postcheck] %s\n' "${POSTCHECK_FILE}"
    cat "${POSTCHECK_PATH}" | docker exec -i "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"
  fi

  echo
  echo "Runtime patch manifest applied: ${patch_count} patch file(s)."
fi
