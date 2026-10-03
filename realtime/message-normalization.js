// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const normalizeText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  if (typeof value === 'object') return String(value.text || '').trim();
  return String(value).trim();
};

module.exports = { normalizeText };
