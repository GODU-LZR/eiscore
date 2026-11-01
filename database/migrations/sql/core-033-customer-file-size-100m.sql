-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

ALTER TABLE public.files
  DROP CONSTRAINT IF EXISTS files_size_bytes_check;

ALTER TABLE public.files
  ADD CONSTRAINT files_size_bytes_check
  CHECK (size_bytes > 0 AND size_bytes <= 104857600);
