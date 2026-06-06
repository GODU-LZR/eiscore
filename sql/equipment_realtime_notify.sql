-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Realtime NOTIFY triggers for equipment module tables.

create or replace function public.notify_eis_events()
returns trigger
language plpgsql
as $$
declare
  payload json;
begin
  payload := json_build_object(
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'id', coalesce(NEW.id, OLD.id),
    'user', current_setting('request.jwt.claim.username', true),
    'ts', now()
  );
  perform pg_notify('eis_events', payload::text);
  return coalesce(NEW, OLD);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.equipment_assets',
    'public.equipment_checks',
    'public.equipment_issues',
    'public.equipment_work_orders',
    'public.equipment_maintenance_plans',
    'public.equipment_standards'
  ] loop
    if to_regclass(t) is not null then
      execute format('drop trigger if exists trg_eis_notify_%s on %s', replace(t, '.', '_'), t);
      execute format('create trigger trg_eis_notify_%s after insert or update or delete on %s for each row execute function public.notify_eis_events()', replace(t, '.', '_'), t);
    end if;
  end loop;
end$$;
