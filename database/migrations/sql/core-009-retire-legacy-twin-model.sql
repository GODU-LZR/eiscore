-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Digital-twin sessions are Harness sessions.  Remove the frozen GLM
-- default, normalize existing rows, and prevent future provider markers from
-- reopening the retired model path.

UPDATE app_data.twin_sessions
SET model = 'deepseek-harness'
WHERE model IS DISTINCT FROM 'deepseek-harness';

ALTER TABLE app_data.twin_sessions
  ALTER COLUMN model SET DEFAULT 'deepseek-harness';

ALTER TABLE app_data.twin_sessions
  ALTER COLUMN model SET NOT NULL;

ALTER TABLE app_data.twin_sessions
  DROP CONSTRAINT IF EXISTS twin_sessions_harness_model_check;

ALTER TABLE app_data.twin_sessions
  ADD CONSTRAINT twin_sessions_harness_model_check
  CHECK (model = 'deepseek-harness');
