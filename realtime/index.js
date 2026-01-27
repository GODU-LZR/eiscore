const http = require('http');
const WebSocket = require('ws');
const { Client } = require('pg');

const port = Number(process.env.PORT || 8078);
const wsPath = process.env.WS_PATH || '/ws';
const rawChannel = (process.env.CHANNEL || 'eis_events').trim();
const channel = /^[a-zA-Z0-9_]+$/.test(rawChannel) ? rawChannel : 'eis_events';

let pgClient = null;
let reconnectTimer = null;
let shuttingDown = false;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, channel }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server, path: wsPath });

function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

async function connectPg() {
  if (shuttingDown) return;
  if (pgClient) {
    try {
      await pgClient.end();
    } catch (err) {
      // ignore
    }
    pgClient = null;
  }

  pgClient = new Client({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres'
  });

  pgClient.on('notification', (msg) => {
    broadcast({
      channel: msg.channel,
      payload: msg.payload,
      pid: msg.processId,
      ts: new Date().toISOString()
    });
  });

  pgClient.on('error', () => scheduleReconnect());
  pgClient.on('end', () => scheduleReconnect());

  try {
    await pgClient.connect();
    await pgClient.query(`LISTEN ${channel}`);
  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (shuttingDown) return;
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectPg();
  }, 1000);
}

function shutdown() {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  wss.clients.forEach((client) => client.close());
  server.close(() => process.exit(0));
  if (pgClient) {
    pgClient.end().catch(() => process.exit(0));
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, () => {
  connectPg();
});
