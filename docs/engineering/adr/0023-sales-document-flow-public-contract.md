# ADR 0023: Sales Document Flow Public Contract

## Status

Accepted

## Decision

Register the existing sales quotation, contract and receivable frontend's missing
database structures through `core-029`. The approved public additions are five
tables, one invoker view, two internal synchronization functions and six
triggers. Their exact identities are listed in
`database/public-schema-ratchet.json`; the frozen baseline remains unchanged.

The five tables are `sales_quotes`, `sales_quote_items`, `sales_contracts`,
`sales_contract_payment_nodes` and `sales_receivable_schedule`. Existing orders
and payments gain document references. Field definitions, constraints, indexes
and payment synchronization were inspected from the existing deployment without
copying any business rows. Invalid historical unit/status text is aligned to the
current frontend catalog. No default credentials or enterprise data are added.

All new objects belong to `eiscore_owner`. Authenticated users retain the
existing single-enterprise sales DML boundary; the Agent receives select,
insert and update only. Anonymous and Flash roles receive no access. The aging
view uses `security_invoker`; synchronization functions pin `search_path` and
cannot be invoked through authenticated or anonymous RPC.

## Validation and rollback

Migration checksums, frontend payload contracts, public object registration and
the core postcheck protect the structure. `deploy/yayu/verify-sales.sql` verifies
payment insert/update/reassignment/delete and aging using generated synthetic
records under `web_user`, then rolls back the transaction. It is restricted to
the explicitly identified independent test deployment and is not an importer.

The user authorized the independent test environment, and its deployment owner
approved this structural repair. This decision does not authorize applying it
to another enterprise. The migration uses the governed backup/restore rollback
strategy; restoring an empty installation backup is appropriate before any real
business data exists. Frozen release descriptors and baseline checksums are not
rewritten or represented as newly approved releases.
