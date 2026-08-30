// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

function hasMethod(storage, method) {
  try {
    return typeof storage?.[method] === 'function'
  } catch {
    return false
  }
}

export function createSafeStorage(storage) {
  function getText(key) {
    try {
      if (!hasMethod(storage, 'getItem')) return null
      const value = storage.getItem(key)
      return value === null || value === undefined ? null : String(value)
    } catch {
      return null
    }
  }

  function setText(key, value) {
    try {
      if (!hasMethod(storage, 'setItem')) return false
      storage.setItem(key, String(value))
      return true
    } catch {
      return false
    }
  }

  function remove(key) {
    try {
      if (!hasMethod(storage, 'removeItem')) return false
      storage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  function getJson(key, fallback = null) {
    const value = getText(key)
    if (value === null) return fallback
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }

  function setJson(key, value) {
    try {
      return setText(key, JSON.stringify(value))
    } catch {
      return false
    }
  }

  return Object.freeze({ getText, setText, remove, getJson, setJson })
}
