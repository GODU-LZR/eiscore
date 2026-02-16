FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.js ./
COPY agent-core.js ./
COPY workflow-engine.js ./

EXPOSE 8078
CMD ["node", "index.js"]
