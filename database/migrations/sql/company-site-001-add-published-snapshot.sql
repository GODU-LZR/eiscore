-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

ALTER TABLE company_site.site_config
  ADD COLUMN IF NOT EXISTS published_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE company_site.site_config AS c
   SET published_snapshot = to_jsonb(c) - 'published_snapshot'
 WHERE c.status = 'published'
   AND c.published_snapshot = '{}'::jsonb;
