# syntax=docker/dockerfile:1

FROM node:22-alpine

WORKDIR /app
COPY deploy/jinwei/leads-server.mjs ./leads-server.mjs

RUN addgroup -S jinwei && adduser -S -G jinwei jinwei \
  && mkdir -p /var/lib/jinwei \
  && chown -R jinwei:jinwei /app /var/lib/jinwei

ENV NODE_ENV=production \
    PORT=8093 \
    DATA_FILE=/var/lib/jinwei/leads.json

VOLUME ["/var/lib/jinwei"]
USER jinwei
EXPOSE 8093

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8093) + '/healthz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "leads-server.mjs"]

