-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: allow web_user to update inventory_batches for editable grid.
-- Apply after inventory_schema.sql is loaded.

DROP POLICY IF EXISTS inventory_batches_update ON scm.inventory_batches;
CREATE POLICY inventory_batches_update ON scm.inventory_batches
  FOR UPDATE TO web_user
  USING (true)
  WITH CHECK (true);
