#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${1:-eiscore-ide}"
CLINE_VERSION="${CLINE_VERSION:-3.56.0}"
EXTENSIONS_DIR="${EXTENSIONS_DIR:-/config/extensions}"
USER_DATA_DIR="${USER_DATA_DIR:-/config/data}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[flash] docker not found"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "[flash] container not running: ${CONTAINER_NAME}"
  exit 1
fi

echo "[flash] preparing code-server config in ${CONTAINER_NAME} ..."

docker exec "${CONTAINER_NAME}" sh -lc "mkdir -p /config/.config/code-server /config/data/User /config/workspace/drafts ${EXTENSIONS_DIR}"

docker exec "${CONTAINER_NAME}" sh -lc "cat > /config/.config/code-server/config.yaml <<'EOF'
bind-addr: 0.0.0.0:8443
auth: none
cert: false
EOF"

docker exec "${CONTAINER_NAME}" sh -lc "cat > /config/data/User/settings.json <<'EOF'
{
  \"workbench.activityBar.visible\": false,
  \"workbench.statusBar.visible\": false,
  \"workbench.editor.showTabs\": \"none\",
  \"workbench.layoutControl.enabled\": false,
  \"window.commandCenter\": false,
  \"window.menuBarVisibility\": \"compact\",
  \"workbench.sideBar.location\": \"left\",
  \"workbench.startupEditor\": \"none\",
  \"window.titleBarStyle\": \"custom\",
  \"editor.minimap.enabled\": false,
  \"breadcrumbs.enabled\": false,
  \"security.workspace.trust.enabled\": false,
  \"workbench.tips.enabled\": false,
  \"update.mode\": \"none\",
  \"extensions.autoCheckUpdates\": false,
  \"extensions.autoUpdate\": false,
  \"telemetry.telemetryLevel\": \"off\",
  \"workbench.settings.enableNaturalLanguageSearch\": false,
  \"workbench.commandPalette.experimental.suggestCommands\": false
}
EOF"

echo "[flash] installing/updating Cline extension ..."
docker exec "${CONTAINER_NAME}" sh -lc "\
  /app/code-server/bin/code-server \
    --extensions-dir ${EXTENSIONS_DIR} \
    --user-data-dir ${USER_DATA_DIR} \
    --uninstall-extension saoudrizwan.claude-dev >/dev/null 2>&1 || true"
docker exec "${CONTAINER_NAME}" sh -lc "\
  rm -rf ${EXTENSIONS_DIR}/saoudrizwan.claude-dev-*"
docker exec "${CONTAINER_NAME}" sh -lc "\
  /app/code-server/bin/code-server \
    --extensions-dir ${EXTENSIONS_DIR} \
    --user-data-dir ${USER_DATA_DIR} \
    --install-extension saoudrizwan.claude-dev@${CLINE_VERSION} --force >/dev/null || \
  /app/code-server/bin/code-server \
    --extensions-dir ${EXTENSIONS_DIR} \
    --user-data-dir ${USER_DATA_DIR} \
    --install-extension saoudrizwan.claude-dev --force >/dev/null"

echo "[flash] installed extensions:"
docker exec "${CONTAINER_NAME}" sh -lc "\
  /app/code-server/bin/code-server \
    --extensions-dir ${EXTENSIONS_DIR} \
    --user-data-dir ${USER_DATA_DIR} \
    --list-extensions --show-versions | grep -i '^saoudrizwan.claude-dev@' || true"

echo "[flash] reminder: set CLINE_OPENAI_BASE_URL / CLINE_OPENAI_API_KEY in env/.env when using OpenAI-compatible provider"
echo "[flash] done"
