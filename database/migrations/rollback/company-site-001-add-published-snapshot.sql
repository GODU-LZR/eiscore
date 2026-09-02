-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

ALTER TABLE company_site.site_config
  DROP COLUMN IF EXISTS published_snapshot;
