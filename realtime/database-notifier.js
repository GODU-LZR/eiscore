// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const WebSocket = require('ws');
const { Client } = require('pg');
const { WorkflowEngine } = require('./workflow-engine');

const normalizeStringList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractPayloadMeta = (rawPayload) => {
  if (!rawPayload) return { id: null, targets: [], roles: [], payload: null };
  try {
    const parsed = JSON.parse(rawPayload);
    const id = parsed?.id ?? parsed?.record_id ?? parsed?.primary_key ?? null;
    const targets = normalizeStringList(parsed?.targets || parsed?.user_ids || parsed?.users);
    const roles = normalizeStringList(parsed?.roles || parsed?.role || parsed?.app_role);
    return { id, targets, roles, payload: parsed };
  } catch {
    return { id: null, targets: [], roles: [], payload: null };
  }
};

const shouldSendToClient = (client, meta, channelName, openState = WebSocket.OPEN) => {
  if (client.readyState !== openState) return false;
  if (client.channels && !client.channels.has(channelName)) return false;
  if (meta.targets?.length) {
    return meta.targets.includes(String(client.user?.id || ''));
  }
  if (meta.roles?.length) {
    return meta.roles.includes(String(client.user?.role || ''));
  }
  return true;
};

const createDatabaseNotifier = ({
  wss,
  channel,
  workflowChannel = 'workflow_event',
  enableWorkflowAutoTransition = false,
  pgConfig,
  createClient = (config) => new Client(config),
  createWorkflowEngine = (config) => new WorkflowEngine(config),
  openState = WebSocket.OPEN,
  reconnectDelayMs = 1000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => new Date().toISOString(),
  log = console
}) => {
  let pgClient = null;
  let reconnectTimer = null;
  let workflowEngine = null;
  let shuttingDown = false;
  let connecting = null;

  const notifyClients = (signal, meta) => {
    const data = JSON.stringify(signal);
    wss.clients.forEach((client) => {
      if (shouldSendToClient(client, meta, signal.channel, openState)) {
        client.send(data);
      }
    });
  };

  const scheduleReconnect = () => {
    if (shuttingDown || reconnectTimer) return;
    reconnectTimer = setTimer(() => {
      reconnectTimer = null;
      void connect();
    }, reconnectDelayMs);
  };

  const closeCurrent = async () => {
    const currentClient = pgClient;
    const currentWorkflow = workflowEngine;
    pgClient = null;
    workflowEngine = null;
    if (currentClient?.removeAllListeners) {
      currentClient.removeAllListeners('error');
      currentClient.removeAllListeners('end');
      currentClient.removeAllListeners('notification');
    }
    await Promise.allSettled([
      currentClient ? currentClient.end() : Promise.resolve(),
      currentWorkflow ? currentWorkflow.shutdown() : Promise.resolve()
    ]);
  };

  const connectOnce = async () => {
    if (shuttingDown) return;
    await closeCurrent();
    if (shuttingDown) return;

    const client = createClient(pgConfig);
    pgClient = client;
    client.on('notification', (message) => {
      if (client !== pgClient || shuttingDown) return;
      if (enableWorkflowAutoTransition && message.channel === workflowChannel && workflowEngine) {
        workflowEngine.handleWorkflowEvent(message.payload).catch((error) => {
          log.error('❌ Workflow notify error:', error.message);
        });
        return;
      }
      const meta = extractPayloadMeta(message.payload);
      notifyClients({
        type: 'db_notify',
        channel: message.channel,
        id: meta.id,
        payload: meta.payload,
        ts: now()
      }, meta);
    });
    client.on('error', () => {
      if (client === pgClient) scheduleReconnect();
    });
    client.on('end', () => {
      if (client === pgClient) scheduleReconnect();
    });

    try {
      await client.connect();
      await client.query(`LISTEN ${channel}`);
      if (enableWorkflowAutoTransition) {
        await client.query(`LISTEN ${workflowChannel}`);
        const engine = createWorkflowEngine(pgConfig);
        workflowEngine = engine;
        await engine.initialize();
        log.log('✅ Workflow engine initialized (auto-transition enabled)');
      } else {
        workflowEngine = null;
        log.log('ℹ️ Workflow auto-transition is disabled');
      }
    } catch {
      scheduleReconnect();
    }
  };

  const connect = () => {
    if (shuttingDown) return Promise.resolve();
    if (connecting) return connecting;
    connecting = connectOnce().finally(() => {
      connecting = null;
    });
    return connecting;
  };

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (reconnectTimer) {
      clearTimer(reconnectTimer);
      reconnectTimer = null;
    }
    if (connecting) await connecting;
    await closeCurrent();
  };

  const query = (...args) => {
    if (!pgClient) throw new Error('Database client not ready');
    return pgClient.query(...args);
  };

  return Object.freeze({
    start: connect,
    shutdown,
    query
  });
};

module.exports = {
  createDatabaseNotifier,
  extractPayloadMeta,
  normalizeStringList,
  shouldSendToClient
};
