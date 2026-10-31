// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ensureHarnessAuth } from '@eiscore/platform/harness-auth'

// Cookie handoffs must remain serial even across unmount, logout and relogin.
let flight = Promise.resolve()

export function prepareBusinessHarnessAuth(options, isCurrent = () => true) {
  flight = flight.catch(() => false).then(() => ensureHarnessAuth(options, isCurrent))
  return flight
}
