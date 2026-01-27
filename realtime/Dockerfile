FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.js ./

EXPOSE 8078
CMD ["node", "index.js"]
