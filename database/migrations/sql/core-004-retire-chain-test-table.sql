-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- The reusable full-chain table is a test fixture, not a product domain
-- object.  Keep dynamic data-app creation available, but do not carry this
-- named test table in every production baseline.  A release backup is
-- mandatory because an operator may have intentionally retained test rows.

DROP TABLE IF EXISTS app_data.eiscore_chain_test_records;
