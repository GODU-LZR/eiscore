// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createCheckCache } from '@shared/eis-check-cache.mjs'

const checkCache = createCheckCache()

export const getCheckCache = checkCache.getCheckCache
export const setCheckCache = checkCache.setCheckCache
export const clearCheckCache = checkCache.clearCheckCache
export const getColdMode = checkCache.getColdMode
export const setColdMode = checkCache.setColdMode
export const getPendingChecks = checkCache.getPendingChecks
export const addPendingCheck = checkCache.addPendingCheck
export const removePendingChecks = checkCache.removePendingChecks
export const clearPendingChecks = checkCache.clearPendingChecks
