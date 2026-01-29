-- Fix JWT role claim to always use database role "web_user"
-- Keep app-level role in app_role for UI authorization.

create or replace function public.login(username text, password text)
returns json
language plpgsql
security definer
as $$
declare
  _app_role text;
  _permissions text[];
  _user_id integer;
  result json;
  _secret text := 'my_super_secret_key_for_eiscore_system_2025';
begin
  select u.id
    into _user_id
  from public.users u
  where lower(trim(u.username)) = lower(trim(login.username))
    and u.password = trim(login.password);

  if _user_id is null then
    raise invalid_password using message = '账号或密码错误';
  end if;

  select array_agg(distinct pcode order by pcode)
    into _permissions
  from (
    select unnest(v.permissions) as pcode
    from public.user_roles ur
    join public.v_role_permissions v on v.role_id = ur.role_id
    where ur.user_id = _user_id
  ) perms;

  if _permissions is null then
    select u.permissions
      into _permissions
    from public.users u
    where u.id = _user_id;
  end if;

  select v.role_code
    into _app_role
  from public.user_roles ur
  join public.v_role_permissions v on v.role_id = ur.role_id
  where ur.user_id = _user_id
  order by v.role_code asc
  limit 1;

  if _app_role is null or _app_role = '' then
    select u.role
      into _app_role
    from public.users u
    where u.id = _user_id;
  end if;

  result := json_build_object(
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'permissions', coalesce(_permissions, ARRAY[]::text[]),
    'exp', extract(epoch from now() + interval '2 hours')::integer
  );

  return json_build_object('token', public.sign(result, _secret));
end;
$$;

grant execute on function public.login(text, text) to web_anon;
