const http = require('http');
const WebSocket = require('ws');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const { AgentConversation, FileWatcher } = require('./agent-core');
const { WorkflowEngine } = require('./workflow-engine');

const port = Number(process.env.PORT || 8078);
const wsPath = process.env.WS_PATH || '/ws';
const rawChannel = (process.env.CHANNEL || 'eis_events').trim();
const channel = /^[a-zA-Z0-9_]+$/.test(rawChannel) ? rawChannel : 'eis_events';
const workflowChannel = 'workflow_event';
const jwtSecret = process.env.PGRST_JWT_SECRET || process.env.JWT_SECRET || '';

let pgClient = null;
let reconnectTimer = null;
let shuttingDown = false;
let workflowEngine = null;

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

function extractToken(req) {
  const header = req.headers['sec-websocket-protocol'];
  if (!header) return '';
  const items = String(header)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (items.length === 0) return '';
  const bearer = items.find((v) => v.toLowerCase().startsWith('bearer '));
  if (bearer) return bearer.slice(7).trim();
  return items[items.length - 1] || '';
}

function verifyToken(token) {
  if (!token || !jwtSecret) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch (e) {
    return null;
  }
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

const agentAllowedRoles = normalizeStringList(process.env.AGENT_ALLOWED_ROLES || 'super_admin')
  .map((role) => String(role).toLowerCase());
const agentAllowedProjects = normalizeStringList(
  process.env.AGENT_ALLOWED_PROJECTS ||
    'eiscore-apps,eiscore-base,eiscore-hr,eiscore-materials,realtime,scripts,sql,env,nginx,docs'
);
const agentAllowAll = String(process.env.AGENT_ALLOW_ALL || '').toLowerCase() === 'true';

function canUseAgent(user) {
  if (agentAllowAll) return true;
  const role = String(user?.role || '').toLowerCase();
  return agentAllowedRoles.includes(role);
}

function isAllowedProject(projectPath) {
  if (!projectPath) return false;
  return agentAllowedProjects.includes(projectPath);
}

function logAgentEvent(type, user, details) {
  const payload = {
    ts: new Date().toISOString(),
    type,
    user: { id: user?.id || '', role: user?.role || '' },
    details: details || {}
  };
  console.log('[agent]', JSON.stringify(payload));
}

function extractPayloadMeta(rawPayload) {
  if (!rawPayload) return { id: null, targets: [], roles: [] };
  try {
    const parsed = JSON.parse(rawPayload);
    const id = parsed?.id ?? parsed?.record_id ?? parsed?.primary_key ?? null;
    const targets = normalizeStringList(parsed?.targets || parsed?.user_ids || parsed?.users);
    const roles = normalizeStringList(parsed?.roles || parsed?.role || parsed?.app_role);
    return { id, targets, roles };
  } catch {
    return { id: null, targets: [], roles: [] };
  }
}

function shouldSendToClient(client, meta, channelName) {
  if (client.readyState !== WebSocket.OPEN) return false;
  if (client.channels && !client.channels.has(channelName)) return false;
  if (meta.targets?.length) {
    return meta.targets.includes(String(client.user?.id || ''));
  }
  if (meta.roles?.length) {
    return meta.roles.includes(String(client.user?.role || ''));
  }
  return true;
}

function notifyClients(signal, meta) {
  const data = JSON.stringify(signal);
  wss.clients.forEach((client) => {
    if (shouldSendToClient(client, meta, signal.channel)) {
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
    if (msg.channel === workflowChannel && workflowEngine) {
      workflowEngine.handleWorkflowEvent(msg.payload).catch((error) => {
        console.error('❌ Workflow notify error:', error.message);
      });
      return;
    }
    const meta = extractPayloadMeta(msg.payload);
    notifyClients(
      {
        type: 'db_notify',
        channel: msg.channel,
        id: meta.id,
        ts: new Date().toISOString()
      },
      meta
    );
  });

  pgClient.on('error', () => scheduleReconnect());
  pgClient.on('end', () => scheduleReconnect());

  try {
    await pgClient.connect();
    await pgClient.query(`LISTEN ${channel}`);
    await pgClient.query(`LISTEN ${workflowChannel}`);
    
    // Initialize workflow engine
    workflowEngine = new WorkflowEngine({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'postgres'
    });
    await workflowEngine.initialize();
    console.log('✅ Workflow engine initialized');
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
  if (workflowEngine) {
    workflowEngine.shutdown().catch(() => process.exit(0));
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, () => {
  connectPg();
});

wss.on('connection', (ws, req) => {
  const token = extractToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    ws.close(1008, 'unauthorized');
    return;
  }
  ws.user = {
    id: payload.user_id || payload.sub || payload.username || payload.email || '',
    role: payload.app_role || payload.role || ''
  };
  ws.channels = new Set([channel]);
  ws.agentConversation = null; // Will be initialized on agent:task
  ws.fileWatcher = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(String(message));
      if (!data || typeof data !== 'object') return;

      // Database notification subscriptions
      if (data.type === 'subscribe') {
        const list = normalizeStringList(data.channels);
        if (list.length) ws.channels = new Set(list);
        return;
      }
      if (data.type === 'unsubscribe') {
        const list = normalizeStringList(data.channels);
        list.forEach((ch) => ws.channels.delete(ch));
        return;
      }

      // Agent: Start new task
      if (data.type === 'agent:task') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath: data.projectPath || '' });
          return;
        }
        const projectPath = data.projectPath || 'eiscore-apps';
        if (!isAllowedProject(projectPath)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: project path not allowed'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath });
          return;
        }
        logAgentEvent('agent:task_start', ws.user, { projectPath });
        ws.agentConversation = new AgentConversation(projectPath);
        
        // Setup file watcher for HMR feedback
        if (ws.fileWatcher) ws.fileWatcher.stop();
        ws.fileWatcher = new FileWatcher(projectPath, (changeEvent) => {
          ws.send(JSON.stringify({
            type: 'agent:file_change',
            data: changeEvent
          }));
        });
        ws.fileWatcher.start();

        ws.send(JSON.stringify({
          type: 'agent:status',
          status: 'thinking',
          message: 'Processing your request...'
        }));

        // Execute task asynchronously
        const result = await ws.agentConversation.executeTask(data.prompt);
        
        ws.send(JSON.stringify({
          type: 'agent:result',
          success: result.success,
          executionLog: result.executionLog,
          totalTurns: result.totalTurns
        }));
        logAgentEvent('agent:task_result', ws.user, {
          projectPath,
          success: result.success,
          totalTurns: result.totalTurns
        });
        return;
      }

      // Agent: Execute specific tool
      if (data.type === 'agent:tool_use') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:tool_denied', ws.user, { tool: data.toolCall?.tool });
          return;
        }
        if (!ws.agentConversation) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'No active conversation. Send agent:task first.'
          }));
          return;
        }

        const result = await ws.agentConversation.executeToolCall(data.toolCall);
        ws.send(JSON.stringify({
          type: 'agent:tool_result',
          result
        }));
        logAgentEvent('agent:tool_result', ws.user, {
          tool: data.toolCall?.tool,
          success: result?.success !== false
        });
        return;
      }

      // Agent: Execute terminal command (limited)
      if (data.type === 'agent:terminal') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:terminal_denied', ws.user, { command: data.command || '' });
          return;
        }
        if (!ws.agentConversation) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'No active conversation.'
          }));
          return;
        }

        const result = await ws.agentConversation.tools.executeCommand(data.command);
        ws.send(JSON.stringify({
          type: 'agent:terminal_result',
          result
        }));
        logAgentEvent('agent:terminal_result', ws.user, {
          success: result?.success !== false
        });
        return;
      }

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    if (ws.fileWatcher) {
      ws.fileWatcher.stop();
    }
  });
});
