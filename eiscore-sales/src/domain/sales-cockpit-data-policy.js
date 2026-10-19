// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const rows = (value) => (Array.isArray(value) ? value : [])

const hasSuccessfulRowsResult = (result) => (
  result?.status === 'fulfilled' && Array.isArray(result.value)
)

export const normalizeSalesCockpitData = ([customers, orders, opportunities, payments, followUps] = []) => ({
  customers: rows(customers),
  orders: rows(orders),
  opportunities: rows(opportunities),
  payments: rows(payments),
  followUps: rows(followUps)
})

export const mergeSalesCockpitData = (previousRows = [], settledResults = [], previousLoadedSources = []) => {
  const partitions = [0, 1, 2, 3, 4]
  const successCount = partitions.filter((index) => hasSuccessfulRowsResult(settledResults[index])).length
  const nextRows = partitions.map((index) => {
    const result = settledResults[index]
    return hasSuccessfulRowsResult(result) ? result.value : previousRows[index]
  })
  return {
    ...normalizeSalesCockpitData(nextRows),
    loadedSources: partitions.map((index) => previousLoadedSources[index] === true || hasSuccessfulRowsResult(settledResults[index])),
    updated: successCount > 0,
    state: successCount === partitions.length ? 'ready' : successCount ? 'partial' : 'error'
  }
}
