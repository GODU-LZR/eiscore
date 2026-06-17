FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN apk add --no-cache bash
RUN npm install --omit=dev
COPY index.js ./
COPY document-intake.js ./
COPY document-parser.js ./
COPY document-planner.js ./
COPY document-entry.js ./
COPY document-fixed-entry.js ./
COPY agent-core.js ./
COPY workflow-engine.js ./
COPY flash-semantic-tool.js ./

EXPOSE 8078
CMD ["node", "index.js"]
