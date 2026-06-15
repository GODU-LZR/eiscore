-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

create or replace function public.eis_app_card_stats(payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, hr, pg_temp
as $$
declare
  stat_key text := coalesce(payload->>'stat_key', '');
  result jsonb := '{}'::jsonb;
begin
  if stat_key = 'hr_overview' then
    select jsonb_build_object(
      'missingDept', (
        select count(*)
        from hr.archives
        where nullif(btrim(coalesce(department, '')), '') is null
      ),
      'positionCount', (
        select count(distinct nullif(btrim(coalesce(position, '')), ''))
        from hr.archives
        where nullif(btrim(coalesce(position, '')), '') is not null
      ),
      'usersWithoutRole', (
        select count(*)
        from public.users u
        where not exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = u.id
        )
      )
    ) into result;
  else
    result := '{}'::jsonb;
  end if;

  return result;
end;
$$;

grant execute on function public.eis_app_card_stats(jsonb) to web_user;
