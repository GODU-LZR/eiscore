# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /workspace

# The company-site Vite app resolves the shared theme and build helper from
# the repository root, so keep those two small source trees in the build
# context instead of duplicating them in the app.
COPY eiscore-company-site/package.json eiscore-company-site/package-lock.json ./eiscore-company-site/
RUN cd eiscore-company-site && npm ci --no-audit --no-fund

COPY eiscore-company-site ./eiscore-company-site
COPY shared ./shared
COPY scripts ./scripts

WORKDIR /workspace/eiscore-company-site
RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/jinwei/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/eiscore-company-site/dist /usr/share/nginx/html/company-site

EXPOSE 8080

