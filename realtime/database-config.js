// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

/**
 * Shared PostgreSQL connection configuration for the realtime workers.
 *
 * Runtime credentials are deployment inputs.  In particular, this module
 * intentionally has no password or privileged-user fallback.  Development
 * callers may still omit values when they only import a worker for a unit
 * test; the first real connection then fails with PostgreSQL's normal
 * authentication error instead of silently using a shared default secret.
 */

const envText = (value, fallback = '') => String(value ?? fallback).trim();

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function resolveDatabaseConfig({
  userEnv = 'EISCORE_DB_USER',
  passwordEnv = 'EISCORE_DB_PASSWORD',
  poolMaxEnv,
  fallbackMax
} = {}) {
  const config = {
    host: envText(process.env.EISCORE_DB_HOST, envText(process.env.PGHOST, '127.0.0.1')),
    port: positiveInteger(process.env.EISCORE_DB_PORT || process.env.PGPORT, 5432, { min: 1, max: 65535 }),
    user: envText(process.env[userEnv], envText(process.env.PGUSER, '')),
    password: envText(process.env[passwordEnv], envText(process.env.PGPASSWORD, '')),
    database: envText(process.env.EISCORE_DB_NAME, envText(process.env.PGDATABASE, 'eiscore'))
  };

  if (poolMaxEnv) {
    config.max = positiveInteger(
      process.env.EISCORE_DB_POOL_MAX || process.env[poolMaxEnv],
      fallbackMax,
      { min: 1, max: 50 }
    );
  }

  return config;
}

function createAgentDatabaseConfig(options = {}) {
  return resolveDatabaseConfig({
    userEnv: 'EISCORE_AGENT_DB_USER',
    passwordEnv: 'AGENT_DB_PASSWORD',
    ...options
  });
}

module.exports = {
  createAgentDatabaseConfig,
  resolveDatabaseConfig,
  positiveInteger
};
