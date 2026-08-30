// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getMobileHttpClient } from '@/platform/http-client'
import { createMobileApiRequest } from './request-core'

export function createMobileProfileRequest(profile) {
  const request = createMobileApiRequest({
    getHttpClient: getMobileHttpClient,
    defaultHeaders: {
      'Accept-Profile': profile,
      'Content-Profile': profile
    }
  })
  return Object.freeze({
    request,
    get: (path, options) => request('GET', path, options),
    post: (path, data, options = {}) => request('POST', path, { ...options, body: data }),
    patch: (path, data, options = {}) => request('PATCH', path, { ...options, body: data })
  })
}
