-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'company_site'
       AND table_name = 'site_config'
       AND column_name = 'published_snapshot'
       AND data_type = 'jsonb'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'company_site.site_config.published_snapshot is missing or invalid';
  END IF;
END
$$;
