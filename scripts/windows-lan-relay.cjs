#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const http = require('http');
const net = require('net');

const args = process.argv.slice(2);

const argValue = (name, fallback = '') => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((item) => item.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
};

const listenHost = argValue('--host', process.env.RELAY_HOST || '0.0.0.0');
const listenPort = Number(argValue('--port', process.env.RELAY_PORT || '18080'));
const target = new URL(argValue('--target', process.env.RELAY_TARGET || 'http://127.0.0.1:8080'));

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: target.host };
  const upstream = http.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || 80,
    method: req.method,
    path: req.url || '/',
    headers
  }, (upstreamRes) => {
    Object.entries(upstreamRes.headers).forEach(([key, value]) => {
      if (value !== undefined) res.setHeader(key, value);
    });
    res.writeHead(upstreamRes.statusCode || 502);
    upstreamRes.pipe(res);
  });

  upstream.on('error', (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end(`Relay upstream error: ${error.message}`);
  });

  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(Number(target.port || 80), target.hostname, () => {
    upstream.write([
      `${req.method} ${req.url || '/'} HTTP/${req.httpVersion}`,
      ...Object.entries({ ...req.headers, host: target.host }).map(([key, value]) => `${key}: ${value}`),
      '',
      ''
    ].join('\r\n'));
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on('error', () => {
    try { socket.destroy(); } catch { /* ignore */ }
  });
});

server.listen(listenPort, listenHost, () => {
  console.log(`EISCore LAN relay listening on http://${listenHost}:${listenPort}/ -> ${target.href}`);
});
