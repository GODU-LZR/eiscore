// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

function proxyOrigin(env, key, fallback) {
  const raw = String(env[key] || fallback).trim()
  const parsed = new URL(raw)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${key} must be an HTTP(S) origin without credentials`)
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`${key} must not include a path, query, or fragment`)
  }
  return parsed.origin
}

export function loadViteDevProxyTargets(env = process.env) {
  return Object.freeze({
    api: proxyOrigin(env, 'VITE_DEV_API_PROXY_TARGET', 'http://localhost:3000'),
    agent: proxyOrigin(env, 'VITE_DEV_AGENT_PROXY_TARGET', 'http://localhost:8078'),
    ide: proxyOrigin(env, 'VITE_FLASH_IDE_PROXY_TARGET', 'http://localhost:8443')
  })
}
