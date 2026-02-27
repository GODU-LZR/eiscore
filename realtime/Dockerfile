FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN apk add --no-cache bash
RUN npm install --omit=dev
COPY index.js ./
COPY agent-core.js ./
COPY workflow-engine.js ./
COPY flash-semantic-tool.js ./

EXPOSE 8078
CMD ["node", "index.js"]
