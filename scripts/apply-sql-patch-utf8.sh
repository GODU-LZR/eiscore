#!/usr/bin/env bash

set -euo pipefail

PATCH_FILE="sql/patch_fix_ontology_semantic_chinese.sql"
DB_CONTAINER="eiscore-db"
DB_NAME="eiscore"
DB_USER="postgres"
DO_BACKUP="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--patch-file)
      PATCH_FILE="$2"
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
    --skip-backup)
      DO_BACKUP="false"
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
PATCH_PATH="${REPO_ROOT}/${PATCH_FILE}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found." >&2
  exit 1
fi

if [[ ! -f "${PATCH_PATH}" ]]; then
  echo "Patch file not found: ${PATCH_PATH}" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${DB_CONTAINER}"; then
  echo "DB container is not running: ${DB_CONTAINER}" >&2
  exit 1
fi

if [[ "${DO_BACKUP}" == "true" ]]; then
  echo "Creating backup before patch..."
  "${REPO_ROOT}/scripts/backup-ontology-semantics.sh" \
    --db-container "${DB_CONTAINER}" \
    --db-name "${DB_NAME}" \
    --db-user "${DB_USER}"
fi

echo "Applying patch with UTF-8 input..."
cat "${PATCH_PATH}" | docker exec -i "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"

echo "Running UTF-8 / semantic checks..."
client_encoding="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc "show client_encoding;" | tr -d '\r')"
garbled_semantics="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc "select count(*) from public.ontology_table_semantics where semantic_name like '%?%' or semantic_description like '%?%';" | tr -d '\r')"
garbled_relations="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc "select count(*) from app_data.ontology_table_relations where relation_type='ontology' and (coalesce(subject_semantic_name,'') like '%?%' or coalesce(object_semantic_name,'') like '%?%');" | tr -d '\r')"

echo "client_encoding=${client_encoding}"
echo "garbled_semantics=${garbled_semantics}"
echo "garbled_ontology_relations=${garbled_relations}"

if [[ "${client_encoding}" != "UTF8" ]]; then
  echo "client_encoding is not UTF8." >&2
  exit 1
fi

if [[ "${garbled_semantics}" != "0" || "${garbled_relations}" != "0" ]]; then
  echo "Validation failed: garbled semantic text still exists." >&2
  exit 1
fi

echo "Done: patch applied and UTF-8 validation passed."
