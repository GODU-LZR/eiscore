FROM node:20-alpine

WORKDIR /opt/bridge

COPY agent-harness/package.json agent-harness/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && node --input-type=module -e "import('@deepseek-ai/dsh/package.json', { with: { type: 'json' } }).then(({ default: pkg }) => { if (pkg.version !== '0.1.2-rc.1') throw new Error('unexpected DSH version') })"

COPY agent-harness/dsh-http-bridge.mjs /opt/eiscore-harness/dsh-http-bridge.mjs
COPY agent-harness/http-bridge.js /opt/eiscore-harness/http-bridge.js
COPY agent-harness/plugin-registry.js /opt/eiscore-harness/plugin-registry.js
COPY agent-harness/plugin-contract.v1.json /opt/eiscore-harness/plugin-contract.v1.json
COPY agent-harness/plugin-registry.js /opt/plugin-registry.js
COPY agent-harness/plugin-contract.v1.json /opt/plugin-contract.v1.json

RUN mkdir -p /var/lib/dsh /opt/eiscore-harness \
  && chown -R 10001:10001 /var/lib/dsh /opt/eiscore-harness \
  && node -e "if (process.versions.node.split('.')[0] < 20) process.exit(1)" \
  && test -x /opt/bridge/node_modules/.bin/dsh

USER 10001:10001
ENTRYPOINT ["node"]
