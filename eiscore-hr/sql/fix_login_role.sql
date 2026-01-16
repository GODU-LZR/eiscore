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
  result json;
  _secret text := 'my_super_secret_key_for_eiscore_system_2025';
begin
  select users.role, users.permissions
    into _app_role, _permissions
  from public.users
  where users.username = login.username
    and users.password = login.password;

  if _app_role is null then
    raise invalid_password using message = '账号或密码错误';
  end if;

  result := json_build_object(
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'permissions', _permissions,
    'exp', extract(epoch from now() + interval '2 hours')::integer
  );

  return json_build_object('token', public.sign(result, _secret));
end;
$$;
