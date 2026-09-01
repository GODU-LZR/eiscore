// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const salesCockpitQueryRequests = [
  { url: '/sales_customers?select=*&status=neq.deleted&order=created_at.desc&limit=500', method: 'get' },
  { url: '/sales_orders?select=*&status=neq.deleted&order_status=neq.%E5%B7%B2%E5%8F%96%E6%B6%88&order=order_date.desc&limit=500', method: 'get' },
  { url: '/sales_opportunities?select=*&status=neq.deleted&order=expected_close_date.asc&limit=500', method: 'get' },
  { url: '/sales_payments?select=*&status=neq.deleted&order=payment_date.desc&limit=500', method: 'get' },
  { url: '/sales_follow_ups?select=*&status=neq.deleted&order=follow_date.desc&limit=500', method: 'get' }
]

export const buildSalesCockpitQueryRequests = () => salesCockpitQueryRequests.map((config) => ({ ...config }))
