// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const rows = (value) => (Array.isArray(value) ? value : [])

export const normalizeSalesCockpitData = ([customers, orders, opportunities, payments, followUps] = []) => ({
  customers: rows(customers),
  orders: rows(orders),
  opportunities: rows(opportunities),
  payments: rows(payments),
  followUps: rows(followUps)
})
