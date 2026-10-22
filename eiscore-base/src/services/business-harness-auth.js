// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { prepareHarnessAuth } from './harness-auth-client'

// Cookie handoffs must remain serial even across unmount, logout and relogin.
let flight = Promise.resolve()

export function prepareBusinessHarnessAuth(options, isCurrent = () => true) {
  flight = flight.catch(() => false).then(() => isCurrent() ? prepareHarnessAuth(options) : false)
  return flight
}
