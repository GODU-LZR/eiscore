// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const DEFAULT_PERMISSION_MODE = 'compat'
export const DEFAULT_SEMANTICS_MODE = 'ai_defined'
export const NONE_SEMANTICS_MODE = 'none'

export function ensureSemanticConfig(rawConfig, options = {}) {
  const config = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {}
  const forceNone = options.forceNone === true

  if (!config.permission_mode) {
    config.permission_mode = DEFAULT_PERMISSION_MODE
  }

  if (!config.semantics_mode) {
    config.semantics_mode = forceNone ? NONE_SEMANTICS_MODE : DEFAULT_SEMANTICS_MODE
  }

  return config
}

