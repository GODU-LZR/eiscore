// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const autoEntryTypes = [
  {
    id: 'generic-app-data-document-entry',
    name: 'AI document generic app-data entry',
    implementationFiles: ['realtime/document-entry.js'],
    offlineRegression: {
      script: 'test:document-entry',
      file: 'tests/engineering/document-entry-regression.mjs'
    },
    businessChain: {
      required: true,
      suite: 'tests/business/full-chain.mjs',
      marker: 'AUTO_ENTRY_CHAIN:generic-app-data-document-entry',
      scope: 'Creates, patches, workflows, verifies, and cleans up app_data records that the generic document-entry worker writes.'
    }
  },
  {
    id: 'fixed-stock-in-document-entry',
    name: 'AI document fixed stock-in entry',
    implementationFiles: ['realtime/document-fixed-entry.js'],
    offlineRegression: {
      script: 'test:document-fixed-entry',
      file: 'tests/engineering/document-fixed-entry-regression.mjs'
    },
    businessChain: {
      required: true,
      suite: 'tests/business/full-chain.mjs',
      marker: 'AUTO_ENTRY_CHAIN:fixed-stock-in-document-entry',
      scope: 'Calls scm.stock_in with a generated batch/transaction, verifies scm.v_inventory_transactions, and cleans up the generated inventory artifacts.'
    }
  }
]
