# syntax=docker/dockerfile:1

FROM nginx:1.27-alpine

COPY eiscore-nginx.conf /etc/nginx/conf.d/default.conf
COPY release/ /usr/share/nginx/html/

EXPOSE 8080 8081
