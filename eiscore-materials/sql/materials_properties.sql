-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Ensure raw_materials supports dynamic properties for the grid component
alter table public.raw_materials
  add column if not exists properties jsonb not null default '{}'::jsonb;
