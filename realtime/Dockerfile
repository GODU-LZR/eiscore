FROM node:20.19.0-bookworm-slim@sha256:5cfa999422613d3b34f766cbb814d964cbfcb76aaf3607e805da21cccb352bac

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG http_proxy
ARG https_proxy
ARG NPM_REGISTRY=https://registry.npmjs.org

WORKDIR /app

COPY realtime/package.json realtime/package-lock.json ./
RUN npm_config_proxy="$HTTP_PROXY" npm_config_https_proxy="$HTTPS_PROXY" \
  npm ci --omit=dev --no-audit --no-fund \
    --registry="$NPM_REGISTRY" --replace-registry-host=always \
    --maxsockets=2 --fetch-retries=5 \
    --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=15000

# The runtime is a modular monolith. Copy every top-level module instead of
# maintaining a stale hand-written list whenever the composition root changes.
COPY realtime/*.js ./
COPY agent-harness/plugin-registry.js /agent-harness/plugin-registry.js
COPY agent-harness/audit-ledger.js /agent-harness/audit-ledger.js
COPY agent-harness/plugin-contract.v1.json /agent-harness/plugin-contract.v1.json

EXPOSE 8078
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:8078/health', (response) => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
CMD ["node", "index.js"]
