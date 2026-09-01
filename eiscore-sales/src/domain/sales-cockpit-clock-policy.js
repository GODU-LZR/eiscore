// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const formatSalesCockpitClock = (value) => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return ''
  return value.toLocaleString('zh-CN', { hour12: false })
}

export const decrementSalesCockpitRefreshCountdown = (value) => (
  Math.max(Number(value) - 1, 0)
)
