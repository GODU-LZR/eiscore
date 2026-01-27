-- Ensure raw_materials supports dynamic properties for the grid component
alter table public.raw_materials
  add column if not exists properties jsonb not null default '{}'::jsonb;
