// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const route = (method, match, matcher, handler, authorize) => Object.freeze({
  method,
  match,
  ...(match === 'pattern' ? { pattern: matcher } : { path: matcher }),
  handler,
  ...(authorize ? { authorize } : {})
});

const exact = (method, path, handler, authorize) => route(method, 'exact', path, handler, authorize);
const pattern = (method, matcher, handler, authorize) => route(method, 'pattern', matcher, handler, authorize);
const prefix = (method, path, handler, authorize) => route(method, 'prefix', path, handler, authorize);

const DOCUMENT_INTAKE_ADMIN = 'documentIntakeAdmin';

const HTTP_ROUTE_MANIFEST = Object.freeze([
  exact('*', '/health', 'health'),
  exact('POST', '/document-intake/devices/bind', 'documentIntake.handleBindDevice'),
  exact('GET', '/document-intake/admin/overview', 'documentIntake.handleGetOverview', DOCUMENT_INTAKE_ADMIN),
  exact('GET', '/document-intake/admin/assets', 'documentIntake.handleListAssets', DOCUMENT_INTAKE_ADMIN),
  exact('GET', '/document-intake/admin/devices', 'documentIntake.handleListDevices', DOCUMENT_INTAKE_ADMIN),
  pattern('GET', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders$/, 'documentIntake.handleListDeviceWatchFolders', DOCUMENT_INTAKE_ADMIN),
  pattern('POST', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders$/, 'documentIntake.handleCreateWatchFolder', DOCUMENT_INTAKE_ADMIN),
  pattern('PATCH', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+$/, 'documentIntake.handleUpdateWatchFolder', DOCUMENT_INTAKE_ADMIN),
  pattern('DELETE', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+$/, 'documentIntake.handleDeleteWatchFolder', DOCUMENT_INTAKE_ADMIN),
  pattern('POST', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+\/status$/, 'documentIntake.handleUpdateWatchFolderStatus', DOCUMENT_INTAKE_ADMIN),
  pattern('POST', /^\/document-intake\/admin\/devices\/[^/]+\/status$/, 'documentIntake.handleUpdateDeviceStatus', DOCUMENT_INTAKE_ADMIN),
  pattern('POST', /^\/document-intake\/admin\/devices\/[^/]+\/reset-binding-code$/, 'documentIntake.handleResetDeviceBindingCode', DOCUMENT_INTAKE_ADMIN),
  exact('GET', '/document-intake/admin/logs', 'documentIntake.handleListLogs', DOCUMENT_INTAKE_ADMIN),
  exact('GET', '/document-intake/admin/entry-results', 'documentIntake.handleListEntryResults', DOCUMENT_INTAKE_ADMIN),
  prefix('GET', '/document-intake/admin/entry-results/', 'documentIntake.handleGetEntryResultDetail', DOCUMENT_INTAKE_ADMIN),
  exact('GET', '/document-intake/devices/config', 'documentIntake.handleGetDeviceConfig'),
  exact('POST', '/document-intake/devices/heartbeat', 'documentIntake.handleHeartbeat'),
  exact('POST', '/document-intake/assets/upload', 'documentIntake.handleUploadAsset'),
  exact('POST', '/document-intake/assets/chunks/init', 'documentIntake.handleInitChunkUpload'),
  exact('POST', '/document-intake/assets/chunks/upload', 'documentIntake.handleUploadChunk'),
  exact('POST', '/document-intake/assets/chunks/complete', 'documentIntake.handleCompleteChunkUpload'),
  exact('POST', '/document-intake/client-logs/batch', 'documentIntake.handleLogBatch'),
  exact('GET', '/ai/config', 'ai.handleConfig'),
  exact('GET', '/ai/agents', 'ai.handleAgents'),
  exact('GET', '/ai/business-snapshot', 'ai.handleBusinessSnapshot'),
  exact('POST', '/ai/chat/completions', 'ai.handleChat'),
  exact('POST', '/ai/translate', 'ai.handleTranslate'),
  exact('POST', '/ai/ocr', 'ai.handleOcr'),
  exact('POST', '/ai/map-locate', 'ai.handleMapLocate'),
  exact('GET', '/flash/draft', 'flash.handleDraftGet'),
  exact('POST', '/flash/draft', 'flash.handleDraftWrite'),
  exact('POST', '/flash/attachments', 'flash.handleAttachmentUpload'),
  exact('GET', '/flash/tools/registry', 'flash.handleToolsRegistryGet'),
  exact('POST', '/flash/tools/call', 'flash.handleToolCall'),
  exact('POST', '/twin/chat', 'twin.handleChat'),
  exact('GET', '/twin/sessions', 'twin.handleSessionsList'),
  exact('DELETE', '/twin/sessions', 'twin.handleSessionDelete'),
  exact('GET', '/twin/messages', 'twin.handleMessagesGet'),
  exact('GET', '/twin/knowledge', 'twin.handleKnowledgeList'),
  exact('POST', '/twin/knowledge/upload', 'twin.handleKnowledgeUpload'),
  exact('DELETE', '/twin/knowledge', 'twin.handleKnowledgeDelete')
]);

const matchesRoute = (entry, method, pathname) => {
  if (entry.method !== '*' && entry.method !== method) return false;
  if (entry.match === 'exact') return pathname === entry.path;
  if (entry.match === 'prefix') return pathname.startsWith(entry.path);
  if (entry.match === 'pattern') return entry.pattern.test(pathname);
  return false;
};

const resolveCallable = (registry, dottedPath, registryName) => {
  const segments = dottedPath.split('.');
  let owner = registry;
  for (let index = 0; index < segments.length - 1; index += 1) {
    owner = owner?.[segments[index]];
  }
  const callable = owner?.[segments.at(-1)];
  if (typeof callable !== 'function') {
    throw new TypeError(`Missing ${registryName}: ${dottedPath}`);
  }
  return { callable, owner };
};

const createHttpRequestHandler = ({
  routes = HTTP_ROUTE_MANIFEST,
  getRequestPath,
  setCorsHeaders,
  handlers,
  authorizers = {}
}) => {
  if (typeof getRequestPath !== 'function' || typeof setCorsHeaders !== 'function') {
    throw new TypeError('HTTP router requires getRequestPath and setCorsHeaders');
  }

  return async (req, res) => {
    const method = String(req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = getRequestPath(req);
    const matchedRoute = routes.find((entry) => matchesRoute(entry, method, pathname));
    if (!matchedRoute) {
      res.writeHead(404);
      res.end();
      return;
    }

    if (matchedRoute.authorize) {
      const { callable: authorize, owner } = resolveCallable(authorizers, matchedRoute.authorize, 'HTTP authorizer');
      if (!authorize.call(owner, req, res)) return;
    }

    const { callable: handler, owner } = resolveCallable(handlers, matchedRoute.handler, 'HTTP handler');
    await handler.call(owner, req, res);
  };
};

module.exports = {
  HTTP_ROUTE_MANIFEST,
  createHttpRequestHandler,
  matchesRoute
};
