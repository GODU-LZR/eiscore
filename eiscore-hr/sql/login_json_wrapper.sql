-- login(json) wrapper to accept single-object payloads
-- 执行方式（UTF-8）：cat login_json_wrapper.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace function public.login(payload json)
returns json
language plpgsql
security definer
as $$
begin
  return public.login(payload->>'username', payload->>'password');
end;
$$;

grant execute on function public.login(json) to web_anon;
