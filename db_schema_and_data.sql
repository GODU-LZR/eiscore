--
-- PostgreSQL database dump
--

\restrict j4vYuiLASwWtKbK74NkdlfsWG22TbwVh9twlTGMqloWmuW1WKXx8LT3BVEaac6K

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: basic_auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA basic_auth;


ALTER SCHEMA basic_auth OWNER TO postgres;

--
-- Name: hr; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA hr;


ALTER SCHEMA hr OWNER TO postgres;

--
-- Name: scm; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA scm;


ALTER SCHEMA scm OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: jwt_token; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.jwt_token AS (
	role text,
	exp integer,
	username text
);


ALTER TYPE public.jwt_token OWNER TO postgres;

--
-- Name: init_attendance_records(date, text); Type: FUNCTION; Schema: hr; Owner: postgres
--

CREATE FUNCTION hr.init_attendance_records(p_date date, p_dept_name text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
  inserted_count integer;
begin
  insert into hr.attendance_records (
    att_date,
    person_type,
    employee_id,
    employee_name,
    employee_no,
    dept_name
  )
  select
    p_date,
    'employee',
    e.id,
    e.name,
    e.employee_no,
    coalesce(e.department, '???')
  from hr.archives e
  where (p_dept_name is null or e.department = p_dept_name)
    and not exists (
      select 1
      from hr.attendance_records r
      where r.att_date = p_date
        and r.person_type = 'employee'
        and r.employee_id = e.id
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;


ALTER FUNCTION hr.init_attendance_records(p_date date, p_dept_name text) OWNER TO postgres;

--
-- Name: apply_role_permission_templates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_role_permission_templates() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
declare
  _count integer := 0;
begin
  with
  s1 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p on true
    where r.code = 'super_admin'
    on conflict do nothing
    returning 1
  ),
  s2 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code like 'app:hr_%'
      or p.code like 'op:hr_%'
    where r.code = 'hr_admin'
    on conflict do nothing
    returning 1
  ),
  s3 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code like 'app:hr_%'
      or p.code ~ '^op:hr_.*\\.(create|edit)$'
    where r.code = 'hr_clerk'
    on conflict do nothing
    returning 1
  ),
  s4 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code in ('app:hr_employee', 'app:hr_org', 'app:hr_attendance', 'app:hr_change')
      or p.code ~ '^op:hr_.*\\.(view|create|edit)$'
    where r.code = 'dept_manager'
    on conflict do nothing
    returning 1
  ),
  s5 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code in ('app:hr_employee', 'app:hr_attendance')
      or p.code ~ '^op:hr_.*\\.view$'
    where r.code = 'employee'
    on conflict do nothing
    returning 1
  ),
  s6 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code in ('module:home', 'module:hr')
      or p.code in ('app:hr_employee', 'app:hr_attendance')
      or p.code ~ '^op:hr_.*\\.view$'
    where r.code = 'hr_viewer'
    on conflict do nothing
    returning 1
  )
  select
    coalesce((select count(*) from s1), 0) +
    coalesce((select count(*) from s2), 0) +
    coalesce((select count(*) from s3), 0) +
    coalesce((select count(*) from s4), 0) +
    coalesce((select count(*) from s5), 0) +
    coalesce((select count(*) from s6), 0)
  into _count;

  return _count;
end;
$_$;


ALTER FUNCTION public.apply_role_permission_templates() OWNER TO postgres;

--
-- Name: cascade_grant_permissions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cascade_grant_permissions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  pcode text;
  scope text;
  key text;
begin
  select code into pcode from public.permissions where id = new.permission_id;
  if pcode is null then
    return new;
  end if;

  scope := split_part(pcode, ':', 1);
  key := split_part(pcode, ':', 2);

  if scope = 'module' then
    -- grant related app/op permissions under this module
    insert into public.role_permissions (role_id, permission_id)
    select new.role_id, p.id
    from public.permissions p
    where p.code like 'app:' || key || '_%'
       or p.code like 'op:' || key || '_%'
    on conflict do nothing;

    -- set field ACL to true for module apps
    update public.sys_field_acl
      set can_view = true, can_edit = true
    where role_id = new.role_id
      and module like key || '_%';

  elsif scope = 'app' then
    -- grant related op permissions under this app
    insert into public.role_permissions (role_id, permission_id)
    select new.role_id, p.id
    from public.permissions p
    where p.code like 'op:' || key || '.%'
    on conflict do nothing;

    -- set field ACL to true for this app
    update public.sys_field_acl
      set can_view = true, can_edit = true
    where role_id = new.role_id
      and module = key;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.cascade_grant_permissions() OWNER TO postgres;

--
-- Name: cascade_revoke_permissions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cascade_revoke_permissions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  pcode text;
  scope text;
  key text;
begin
  select code into pcode from public.permissions where id = old.permission_id;
  if pcode is null then
    return old;
  end if;

  scope := split_part(pcode, ':', 1);
  key := split_part(pcode, ':', 2);

  if scope = 'module' then
    -- revoke related app/op permissions under this module
    delete from public.role_permissions rp
    using public.permissions p
    where rp.role_id = old.role_id
      and rp.permission_id = p.id
      and (p.code like 'app:' || key || '_%' or p.code like 'op:' || key || '_%');

    -- set field ACL to false for module apps
    update public.sys_field_acl
      set can_view = false, can_edit = false
    where role_id = old.role_id
      and module like key || '_%';

  elsif scope = 'app' then
    -- revoke related op permissions under this app
    delete from public.role_permissions rp
    using public.permissions p
    where rp.role_id = old.role_id
      and rp.permission_id = p.id
      and p.code like 'op:' || key || '.%';

    -- set field ACL to false for this app
    update public.sys_field_acl
      set can_view = false, can_edit = false
    where role_id = old.role_id
      and module = key;
  end if;

  return old;
end;
$$;


ALTER FUNCTION public.cascade_revoke_permissions() OWNER TO postgres;

--
-- Name: current_app_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_app_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'app_role'
$$;


ALTER FUNCTION public.current_app_role() OWNER TO postgres;

--
-- Name: current_scope(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_scope(module_name text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select scope_type
  from public.role_data_scopes rds
  join public.roles r on r.id = rds.role_id
  where r.code = public.current_app_role()
    and rds.module = module_name
  limit 1
$$;


ALTER FUNCTION public.current_scope(module_name text) OWNER TO postgres;

--
-- Name: current_user_dept_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_user_dept_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select dept_id from public.users where username = public.current_username() limit 1
$$;


ALTER FUNCTION public.current_user_dept_id() OWNER TO postgres;

--
-- Name: current_username(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_username() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'username'
$$;


ALTER FUNCTION public.current_username() OWNER TO postgres;

--
-- Name: dept_tree_ids(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.dept_tree_ids(root_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE
    AS $$
  with recursive t as (
    select id from public.departments where id = root_id
    union all
    select d.id from public.departments d
    join t on d.parent_id = t.id
  )
  select id from t
$$;


ALTER FUNCTION public.dept_tree_ids(root_id uuid) OWNER TO postgres;

--
-- Name: ensure_field_acl(text, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_field_acl(module_name text, field_codes text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  _count integer := 0;
begin
  if module_name is null or module_name = '' then
    return 0;
  end if;
  if field_codes is null or array_length(field_codes, 1) is null then
    return 0;
  end if;

  with targets as (
    select r.id as role_id, module_name as module, fc as field_code
    from public.roles r
    cross join unnest(field_codes) as fc
  ),
  upserted as (
    insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
    select t.role_id, t.module, t.field_code, true, true
    from targets t
    on conflict (role_id, module, field_code) do nothing
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;


ALTER FUNCTION public.ensure_field_acl(module_name text, field_codes text[]) OWNER TO postgres;

--
-- Name: login(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.login(payload json) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  return public.login(payload->>'username', payload->>'password');
end;
$$;


ALTER FUNCTION public.login(payload json) OWNER TO postgres;

--
-- Name: login(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.login(username text, password text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
    raise invalid_password using message = '???????';
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


ALTER FUNCTION public.login(username text, password text) OWNER TO postgres;

--
-- Name: notify_eis_events(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_eis_events() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


ALTER FUNCTION public.notify_eis_events() OWNER TO postgres;

--
-- Name: raw_materials_set_dept_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.raw_materials_set_dept_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.dept_id is null then
    new.dept_id := public.current_user_dept_id();
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.raw_materials_set_dept_id() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: sign(json, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sign(payload json, secret text, algorithm text DEFAULT 'HS256'::text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
WITH
  header AS (
    SELECT url_encode(convert_to('{"alg":"' || algorithm || '","typ":"JWT"}', 'utf8')) AS data
  ),
  payload AS (
    SELECT url_encode(convert_to(payload::text, 'utf8')) AS data
  ),
  sign_data AS (
    SELECT header.data || '.' || payload.data AS data FROM header, payload
  )
SELECT
  header.data || '.' || payload.data || '.' ||
  url_encode(hmac(sign_data.data, secret, 'sha256'))
FROM header, payload, sign_data;
$$;


ALTER FUNCTION public.sign(payload json, secret text, algorithm text) OWNER TO postgres;

--
-- Name: sync_field_acl_from_config(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_field_acl_from_config() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  module_name text;
  dynamic_codes text[];
  static_codes text[];
  field_codes text[];
begin
  if TG_OP not in ('INSERT', 'UPDATE') then
    return NEW;
  end if;

  if NEW.key is null or NEW.key = '' then
    return NEW;
  end if;

  module_name := case NEW.key
    when 'hr_table_cols' then 'hr_employee'
    when 'hr_transfer_cols' then 'hr_change'
    when 'hr_attendance_cols' then 'hr_attendance'
    when 'materials_table_cols' then 'mms_ledger'
    else null
  end;

  if module_name is null then
    return NEW;
  end if;

  if jsonb_typeof(NEW.value) = 'array' then
    select array_agg(distinct (elem->>'prop'))
      into dynamic_codes
    from jsonb_array_elements(NEW.value) as elem
    where (elem ? 'prop') and (elem->>'prop') <> '';
  end if;

  if module_name in ('hr_employee', 'hr_change') then
    select array_agg(c.column_name order by c.ordinal_position)
      into static_codes
    from information_schema.columns c
    where c.table_schema = 'hr'
      and c.table_name = 'archives'
      and c.column_name not in ('properties','version','updated_at');
  elsif module_name = 'hr_attendance' then
    select array_agg(col order by ord) into static_codes
    from (
      select distinct on (c.column_name)
        c.column_name as col,
        min(c.ordinal_position) over (partition by c.column_name) as ord
      from information_schema.columns c
      where c.table_schema = 'hr'
        and c.table_name in ('attendance_records','attendance_month_overrides')
    ) t
    where t.col is not null;
  elsif module_name = 'mms_ledger' then
    select array_agg(c.column_name order by c.ordinal_position)
      into static_codes
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'raw_materials';
  else
    static_codes := ARRAY[]::text[];
  end if;

  field_codes := array_cat(coalesce(static_codes, ARRAY[]::text[]), coalesce(dynamic_codes, ARRAY[]::text[]));
  if array_length(field_codes, 1) is null then
    return NEW;
  end if;

  perform public.ensure_field_acl(module_name, field_codes);
  return NEW;
end;
$$;


ALTER FUNCTION public.sync_field_acl_from_config() OWNER TO postgres;

--
-- Name: tg_v_role_data_scopes_matrix_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_role_data_scopes_matrix_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.role_data_scopes (role_id, module, scope_type, dept_id)
  values (new.role_id, new.module, coalesce(new.scope_type, 'self'), new.dept_id)
  on conflict (role_id, module) do update
    set scope_type = excluded.scope_type,
        dept_id = excluded.dept_id,
        updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.tg_v_role_data_scopes_matrix_update() OWNER TO postgres;

--
-- Name: tg_v_role_permissions_matrix_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_role_permissions_matrix_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.granted is distinct from old.granted then
    if new.granted then
      insert into public.role_permissions (role_id, permission_id)
      values (old.role_id, old.permission_id)
      on conflict do nothing;
    else
      delete from public.role_permissions
      where role_id = old.role_id and permission_id = old.permission_id;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.tg_v_role_permissions_matrix_update() OWNER TO postgres;

--
-- Name: tg_v_roles_manage_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_roles_manage_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  delete from public.roles where id = old.id;
  return old;
end;
$$;


ALTER FUNCTION public.tg_v_roles_manage_delete() OWNER TO postgres;

--
-- Name: tg_v_roles_manage_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_roles_manage_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.roles (code, name, description, sort)
  values (new.code, new.name, new.description, new.sort);
  return new;
end;
$$;


ALTER FUNCTION public.tg_v_roles_manage_insert() OWNER TO postgres;

--
-- Name: tg_v_roles_manage_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_roles_manage_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.roles
  set code = new.code,
      name = new.name,
      description = new.description,
      sort = new.sort
  where id = old.id;
  return new;
end;
$$;


ALTER FUNCTION public.tg_v_roles_manage_update() OWNER TO postgres;

--
-- Name: tg_v_users_manage_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_users_manage_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  delete from public.user_roles where user_id = old.id;
  delete from public.users where id = old.id;
  return old;
end;
$$;


ALTER FUNCTION public.tg_v_users_manage_delete() OWNER TO postgres;

--
-- Name: tg_v_users_manage_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_users_manage_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  _user_id integer;
begin
  insert into public.users (username, password, full_name, phone, email, status, dept_id)
  values (
    coalesce(new.username, 'user_' || to_char(now(), 'HH24MISS')),
    coalesce(new.password, '123456'),
    new.full_name,
    new.phone,
    new.email,
    coalesce(new.status, 'active'),
    new.dept_id
  )
  returning id into _user_id;

  if new.avatar is not null then
    update public.users set avatar = new.avatar where id = _user_id;
  end if;

  if new.role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (_user_id, new.role_id)
    on conflict do nothing;
  end if;

  new.id := _user_id;
  return new;
end;
$$;


ALTER FUNCTION public.tg_v_users_manage_insert() OWNER TO postgres;

--
-- Name: tg_v_users_manage_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tg_v_users_manage_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.users
  set username = coalesce(new.username, old.username),
      full_name = new.full_name,
      phone = new.phone,
      email = new.email,
      dept_id = new.dept_id,
      status = coalesce(new.status, old.status),
      avatar = new.avatar,
      updated_at = now()
  where id = old.id;

  if new.password is not null and new.password <> '' then
    update public.users set password = new.password where id = old.id;
  end if;

  if new.role_id is distinct from old.role_id then
    delete from public.user_roles where user_id = old.id;
    if new.role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (old.id, new.role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.tg_v_users_manage_update() OWNER TO postgres;

--
-- Name: touch_field_label_overrides(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_field_label_overrides() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.touch_field_label_overrides() OWNER TO postgres;

--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION public.touch_updated_at() OWNER TO postgres;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

--
-- Name: upsert_field_acl(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.upsert_field_acl(payload jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  _count integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return 0;
  end if;

  with items as (
    select
      (value->>'role_code')::text as role_code,
      (value->>'module')::text as module,
      (value->>'field_code')::text as field_code,
      coalesce((value->>'can_view')::boolean, true) as can_view,
      coalesce((value->>'can_edit')::boolean, true) as can_edit
    from jsonb_array_elements(payload)
  ),
  upserted as (
    insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
    select r.id, i.module, i.field_code, i.can_view, i.can_edit
    from items i
    join public.roles r on r.code = i.role_code
    on conflict (role_id, module, field_code)
    do update set
      can_view = excluded.can_view,
      can_edit = excluded.can_edit
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;


ALTER FUNCTION public.upsert_field_acl(payload jsonb) OWNER TO postgres;

--
-- Name: upsert_permissions(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.upsert_permissions(payload jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  _count integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return 0;
  end if;

  with items as (
    select
      (value->>'code')::text as code,
      (value->>'name')::text as name,
      (value->>'module')::text as module,
      (value->>'action')::text as action,
      value->'roles' as roles
    from jsonb_array_elements(payload)
  ),
  upserted as (
    insert into public.permissions (code, name, module, action)
    select code, coalesce(name, code), module, action
    from items
    where code is not null and code <> ''
    on conflict (code) do update set
      name = excluded.name,
      module = excluded.module,
      action = excluded.action
    returning id, code
  ),
  role_bind as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from items i
    join public.permissions p on p.code = i.code
    join public.roles r on i.roles is not null and r.code = any (select jsonb_array_elements_text(i.roles))
    on conflict do nothing
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;


ALTER FUNCTION public.upsert_permissions(payload jsonb) OWNER TO postgres;

--
-- Name: url_encode(bytea); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.url_encode(data bytea) RETURNS text
    LANGUAGE sql
    AS $$
    -- replace(..., E'\n', '') 用来删除换行符
    SELECT translate(replace(encode(data, 'base64'), E'\n', ''), '+/=', '-_')
$$;


ALTER FUNCTION public.url_encode(data bytea) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: basic_auth; Owner: postgres
--

CREATE TABLE basic_auth.users (
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'web_user'::text NOT NULL,
    full_name text
);


ALTER TABLE basic_auth.users OWNER TO postgres;

--
-- Name: archives; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.archives (
    id integer NOT NULL,
    name text NOT NULL,
    employee_no text,
    department text,
    "position" text,
    phone text,
    status text DEFAULT '在职'::text,
    base_salary numeric(10,2) DEFAULT 0,
    entry_date date DEFAULT CURRENT_DATE,
    properties jsonb DEFAULT '{}'::jsonb,
    version integer DEFAULT 1,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE hr.archives OWNER TO postgres;

--
-- Name: COLUMN archives.id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.id IS '编号';


--
-- Name: COLUMN archives.name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.name IS '姓名';


--
-- Name: COLUMN archives.employee_no; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.employee_no IS '工号';


--
-- Name: COLUMN archives.department; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.department IS '部门';


--
-- Name: COLUMN archives."position"; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives."position" IS '岗位';


--
-- Name: COLUMN archives.phone; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.phone IS '手机号';


--
-- Name: COLUMN archives.status; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.status IS '状态';


--
-- Name: COLUMN archives.base_salary; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.base_salary IS '基础工资';


--
-- Name: COLUMN archives.entry_date; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.entry_date IS '入职日期';


--
-- Name: COLUMN archives.updated_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.archives.updated_at IS '更新时间';


--
-- Name: archives_id_seq; Type: SEQUENCE; Schema: hr; Owner: postgres
--

CREATE SEQUENCE hr.archives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE hr.archives_id_seq OWNER TO postgres;

--
-- Name: archives_id_seq; Type: SEQUENCE OWNED BY; Schema: hr; Owner: postgres
--

ALTER SEQUENCE hr.archives_id_seq OWNED BY hr.archives.id;


--
-- Name: attendance_month_overrides; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.attendance_month_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    att_month date NOT NULL,
    person_type text DEFAULT 'employee'::text NOT NULL,
    employee_id bigint,
    employee_name text,
    employee_no text,
    temp_name text,
    temp_phone text,
    dept_name text NOT NULL,
    person_key text GENERATED ALWAYS AS (
CASE
    WHEN (person_type = 'employee'::text) THEN ('emp:'::text || (employee_id)::text)
    ELSE ('temp:'::text || COALESCE(temp_phone, temp_name, ''::text))
END) STORED,
    total_days integer DEFAULT 0 NOT NULL,
    late_days integer DEFAULT 0 NOT NULL,
    early_days integer DEFAULT 0 NOT NULL,
    leave_days integer DEFAULT 0 NOT NULL,
    absent_days integer DEFAULT 0 NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_month_person_required CHECK ((((person_type = 'employee'::text) AND (employee_id IS NOT NULL)) OR ((person_type = 'temp'::text) AND (temp_name IS NOT NULL)))),
    CONSTRAINT attendance_month_person_type_check CHECK ((person_type = ANY (ARRAY['employee'::text, 'temp'::text])))
);


ALTER TABLE hr.attendance_month_overrides OWNER TO postgres;

--
-- Name: COLUMN attendance_month_overrides.id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.id IS '编号';


--
-- Name: COLUMN attendance_month_overrides.att_month; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.att_month IS '月份';


--
-- Name: COLUMN attendance_month_overrides.person_type; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.person_type IS '人员类型';


--
-- Name: COLUMN attendance_month_overrides.employee_id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.employee_id IS '员工ID';


--
-- Name: COLUMN attendance_month_overrides.employee_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.employee_name IS '员工姓名';


--
-- Name: COLUMN attendance_month_overrides.employee_no; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.employee_no IS '工号';


--
-- Name: COLUMN attendance_month_overrides.temp_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.temp_name IS '临时工姓名';


--
-- Name: COLUMN attendance_month_overrides.temp_phone; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.temp_phone IS '临时工电话';


--
-- Name: COLUMN attendance_month_overrides.dept_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.dept_name IS '部门';


--
-- Name: COLUMN attendance_month_overrides.person_key; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.person_key IS '人员标识';


--
-- Name: COLUMN attendance_month_overrides.total_days; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.total_days IS '总天数';


--
-- Name: COLUMN attendance_month_overrides.late_days; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.late_days IS '迟到天数';


--
-- Name: COLUMN attendance_month_overrides.early_days; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.early_days IS '早退天数';


--
-- Name: COLUMN attendance_month_overrides.leave_days; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.leave_days IS '请假天数';


--
-- Name: COLUMN attendance_month_overrides.absent_days; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.absent_days IS '缺勤天数';


--
-- Name: COLUMN attendance_month_overrides.overtime_minutes; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.overtime_minutes IS '加班分钟';


--
-- Name: COLUMN attendance_month_overrides.remark; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.remark IS '备注';


--
-- Name: COLUMN attendance_month_overrides.created_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.created_at IS '创建时间';


--
-- Name: COLUMN attendance_month_overrides.updated_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_month_overrides.updated_at IS '更新时间';


--
-- Name: attendance_records; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    att_date date NOT NULL,
    person_type text DEFAULT 'employee'::text NOT NULL,
    employee_id bigint,
    employee_name text,
    employee_no text,
    temp_name text,
    temp_phone text,
    dept_id bigint,
    dept_name text NOT NULL,
    shift_id uuid,
    shift_name text,
    shift_start_time time without time zone,
    shift_end_time time without time zone,
    shift_cross_day boolean,
    late_grace_min integer,
    early_grace_min integer,
    ot_break_min integer,
    punch_times text[] DEFAULT '{}'::text[] NOT NULL,
    late_flag boolean DEFAULT false NOT NULL,
    early_flag boolean DEFAULT false NOT NULL,
    leave_flag boolean DEFAULT false NOT NULL,
    absent_flag boolean DEFAULT false NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_person_required CHECK ((((person_type = 'employee'::text) AND (employee_id IS NOT NULL)) OR ((person_type = 'temp'::text) AND (temp_name IS NOT NULL)))),
    CONSTRAINT attendance_person_type_check CHECK ((person_type = ANY (ARRAY['employee'::text, 'temp'::text])))
);


ALTER TABLE hr.attendance_records OWNER TO postgres;

--
-- Name: COLUMN attendance_records.id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.id IS '编号';


--
-- Name: COLUMN attendance_records.att_date; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.att_date IS '日期';


--
-- Name: COLUMN attendance_records.person_type; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.person_type IS '人员类型';


--
-- Name: COLUMN attendance_records.employee_id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.employee_id IS '员工ID';


--
-- Name: COLUMN attendance_records.employee_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.employee_name IS '员工姓名';


--
-- Name: COLUMN attendance_records.employee_no; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.employee_no IS '工号';


--
-- Name: COLUMN attendance_records.temp_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.temp_name IS '临时工姓名';


--
-- Name: COLUMN attendance_records.temp_phone; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.temp_phone IS '临时工电话';


--
-- Name: COLUMN attendance_records.dept_id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.dept_id IS '部门ID';


--
-- Name: COLUMN attendance_records.dept_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.dept_name IS '部门';


--
-- Name: COLUMN attendance_records.shift_id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.shift_id IS '班次ID';


--
-- Name: COLUMN attendance_records.shift_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.shift_name IS '班次';


--
-- Name: COLUMN attendance_records.shift_start_time; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.shift_start_time IS '上班时间';


--
-- Name: COLUMN attendance_records.shift_end_time; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.shift_end_time IS '下班时间';


--
-- Name: COLUMN attendance_records.shift_cross_day; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.shift_cross_day IS '跨天班次';


--
-- Name: COLUMN attendance_records.late_grace_min; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.late_grace_min IS '迟到容忍(分)';


--
-- Name: COLUMN attendance_records.early_grace_min; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.early_grace_min IS '早退容忍(分)';


--
-- Name: COLUMN attendance_records.ot_break_min; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.ot_break_min IS '加班扣除(分)';


--
-- Name: COLUMN attendance_records.punch_times; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.punch_times IS '打卡记录';


--
-- Name: COLUMN attendance_records.late_flag; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.late_flag IS '迟到';


--
-- Name: COLUMN attendance_records.early_flag; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.early_flag IS '早退';


--
-- Name: COLUMN attendance_records.leave_flag; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.leave_flag IS '请假';


--
-- Name: COLUMN attendance_records.absent_flag; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.absent_flag IS '缺勤';


--
-- Name: COLUMN attendance_records.overtime_minutes; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.overtime_minutes IS '加班分钟';


--
-- Name: COLUMN attendance_records.remark; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.remark IS '备注';


--
-- Name: COLUMN attendance_records.created_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.created_at IS '创建时间';


--
-- Name: COLUMN attendance_records.updated_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_records.updated_at IS '更新时间';


--
-- Name: attendance_shifts; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.attendance_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    cross_day boolean DEFAULT false NOT NULL,
    late_grace_min integer DEFAULT 0 NOT NULL,
    early_grace_min integer DEFAULT 0 NOT NULL,
    ot_break_min integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE hr.attendance_shifts OWNER TO postgres;

--
-- Name: COLUMN attendance_shifts.id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_shifts.id IS '编号';


--
-- Name: COLUMN attendance_shifts.name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_shifts.name IS '名称';


--
-- Name: COLUMN attendance_shifts.sort; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_shifts.sort IS '排序';


--
-- Name: COLUMN attendance_shifts.created_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_shifts.created_at IS '创建时间';


--
-- Name: COLUMN attendance_shifts.updated_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.attendance_shifts.updated_at IS '更新时间';


--
-- Name: employee_profiles; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.employee_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_id integer NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE hr.employee_profiles OWNER TO postgres;

--
-- Name: COLUMN employee_profiles.id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.employee_profiles.id IS '编号';


--
-- Name: COLUMN employee_profiles.created_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.employee_profiles.created_at IS '创建时间';


--
-- Name: COLUMN employee_profiles.updated_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.employee_profiles.updated_at IS '更新时间';


--
-- Name: payroll; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.payroll (
    id integer NOT NULL,
    archive_id integer,
    month character varying(7),
    total_amount numeric(10,2),
    status text DEFAULT '草稿'::text
);


ALTER TABLE hr.payroll OWNER TO postgres;

--
-- Name: COLUMN payroll.id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.payroll.id IS '编号';


--
-- Name: COLUMN payroll.status; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.payroll.status IS '状态';


--
-- Name: payroll_id_seq; Type: SEQUENCE; Schema: hr; Owner: postgres
--

CREATE SEQUENCE hr.payroll_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE hr.payroll_id_seq OWNER TO postgres;

--
-- Name: payroll_id_seq; Type: SEQUENCE OWNED BY; Schema: hr; Owner: postgres
--

ALTER SEQUENCE hr.payroll_id_seq OWNED BY hr.payroll.id;


--
-- Name: v_attendance_daily; Type: VIEW; Schema: hr; Owner: postgres
--

CREATE VIEW hr.v_attendance_daily AS
 SELECT id,
    att_date,
    person_type,
    employee_id,
    employee_name,
    employee_no,
    temp_name,
    temp_phone,
    dept_id,
    dept_name,
    shift_id,
    shift_name,
    shift_start_time,
    shift_end_time,
    shift_cross_day,
    late_grace_min,
    early_grace_min,
    ot_break_min,
    punch_times,
    late_flag,
    early_flag,
    leave_flag,
    absent_flag,
    overtime_minutes,
    remark,
    created_at,
    updated_at,
    array_to_string(punch_times, '  '::text) AS punch_text,
    COALESCE(array_length(punch_times, 1), 0) AS punch_count,
    ( SELECT min(t.t) AS min
           FROM unnest(r.punch_times) t(t)) AS first_punch,
    ( SELECT max(t.t) AS max
           FROM unnest(r.punch_times) t(t)) AS last_punch
   FROM hr.attendance_records r;


ALTER VIEW hr.v_attendance_daily OWNER TO postgres;

--
-- Name: COLUMN v_attendance_daily.id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.id IS '编号';


--
-- Name: COLUMN v_attendance_daily.employee_id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.employee_id IS '员工ID';


--
-- Name: COLUMN v_attendance_daily.employee_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.employee_name IS '员工姓名';


--
-- Name: COLUMN v_attendance_daily.employee_no; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.employee_no IS '工号';


--
-- Name: COLUMN v_attendance_daily.dept_id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.dept_id IS '部门ID';


--
-- Name: COLUMN v_attendance_daily.dept_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.dept_name IS '部门';


--
-- Name: COLUMN v_attendance_daily.remark; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.remark IS '备注';


--
-- Name: COLUMN v_attendance_daily.created_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.created_at IS '创建时间';


--
-- Name: COLUMN v_attendance_daily.updated_at; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_daily.updated_at IS '更新时间';


--
-- Name: v_attendance_monthly; Type: VIEW; Schema: hr; Owner: postgres
--

CREATE VIEW hr.v_attendance_monthly AS
 WITH base AS (
         SELECT (date_trunc('month'::text, (r.att_date)::timestamp with time zone))::date AS att_month,
            r.dept_name,
            r.person_type,
            r.employee_id,
            r.employee_name,
            r.employee_no,
            r.temp_name,
            r.temp_phone,
            count(*) AS total_days,
            sum((r.late_flag)::integer) AS late_days,
            sum((r.early_flag)::integer) AS early_days,
            sum((r.leave_flag)::integer) AS leave_days,
            sum((r.absent_flag)::integer) AS absent_days,
            sum(r.overtime_minutes) AS overtime_minutes
           FROM hr.attendance_records r
          GROUP BY ((date_trunc('month'::text, (r.att_date)::timestamp with time zone))::date), r.dept_name, r.person_type, r.employee_id, r.employee_name, r.employee_no, r.temp_name, r.temp_phone
        )
 SELECT base.att_month,
    base.dept_name,
    base.person_type,
    base.employee_id,
    base.employee_name,
    base.employee_no,
    base.temp_name,
    base.temp_phone,
    COALESCE((ovr.total_days)::bigint, base.total_days) AS total_days,
    COALESCE((ovr.late_days)::bigint, base.late_days) AS late_days,
    COALESCE((ovr.early_days)::bigint, base.early_days) AS early_days,
    COALESCE((ovr.leave_days)::bigint, base.leave_days) AS leave_days,
    COALESCE((ovr.absent_days)::bigint, base.absent_days) AS absent_days,
    COALESCE((ovr.overtime_minutes)::bigint, base.overtime_minutes) AS overtime_minutes,
    ovr.remark
   FROM (base
     LEFT JOIN hr.attendance_month_overrides ovr ON (((ovr.att_month = base.att_month) AND (ovr.person_key =
        CASE
            WHEN (base.person_type = 'employee'::text) THEN ('emp:'::text || (base.employee_id)::text)
            ELSE ('temp:'::text || COALESCE(base.temp_phone, base.temp_name, ''::text))
        END))));


ALTER VIEW hr.v_attendance_monthly OWNER TO postgres;

--
-- Name: COLUMN v_attendance_monthly.dept_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_monthly.dept_name IS '部门';


--
-- Name: COLUMN v_attendance_monthly.employee_id; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_monthly.employee_id IS '员工ID';


--
-- Name: COLUMN v_attendance_monthly.employee_name; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_monthly.employee_name IS '员工姓名';


--
-- Name: COLUMN v_attendance_monthly.employee_no; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_monthly.employee_no IS '工号';


--
-- Name: COLUMN v_attendance_monthly.remark; Type: COMMENT; Schema: hr; Owner: postgres
--

COMMENT ON COLUMN hr.v_attendance_monthly.remark IS '备注';


--
-- Name: debug_me; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.debug_me AS
 SELECT current_setting('request.jwt.claims'::text, true) AS full_json_data,
    ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text) AS extracted_name,
    CURRENT_USER AS db_role;


ALTER VIEW public.debug_me OWNER TO postgres;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    leader_id integer,
    sort integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: COLUMN departments.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.departments.id IS '编号';


--
-- Name: COLUMN departments.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.departments.name IS '名称';


--
-- Name: COLUMN departments.sort; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.departments.sort IS '排序';


--
-- Name: COLUMN departments.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.departments.status IS '状态';


--
-- Name: COLUMN departments.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.departments.created_at IS '创建时间';


--
-- Name: COLUMN departments.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.departments.updated_at IS '更新时间';


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    name text NOT NULL,
    "position" text,
    department text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: COLUMN employees.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.employees.id IS '编号';


--
-- Name: COLUMN employees.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.employees.name IS '名称';


--
-- Name: COLUMN employees."position"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.employees."position" IS '岗位';


--
-- Name: COLUMN employees.department; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.employees.department IS '部门';


--
-- Name: COLUMN employees.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.employees.created_at IS '创建时间';


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: field_label_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.field_label_overrides (
    module text NOT NULL,
    field_code text NOT NULL,
    field_label text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.field_label_overrides OWNER TO postgres;

--
-- Name: COLUMN field_label_overrides.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.field_label_overrides.updated_at IS '更新时间';


--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    content_base64 text NOT NULL,
    sha256 text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT files_check CHECK ((octet_length(decode(content_base64, 'base64'::text)) = size_bytes)),
    CONSTRAINT files_size_bytes_check CHECK (((size_bytes > 0) AND (size_bytes <= 20971520)))
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: COLUMN files.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.files.id IS '编号';


--
-- Name: COLUMN files.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.files.created_at IS '创建时间';


--
-- Name: COLUMN files.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.files.updated_at IS '更新时间';


--
-- Name: form_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.form_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id text NOT NULL,
    row_id text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.form_values OWNER TO postgres;

--
-- Name: COLUMN form_values.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.form_values.id IS '编号';


--
-- Name: COLUMN form_values.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.form_values.created_at IS '创建时间';


--
-- Name: COLUMN form_values.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.form_values.updated_at IS '更新时间';


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    module text,
    action text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: COLUMN permissions.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.permissions.id IS '编号';


--
-- Name: COLUMN permissions.code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.permissions.code IS '编码';


--
-- Name: COLUMN permissions.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.permissions.name IS '名称';


--
-- Name: COLUMN permissions.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.permissions.created_at IS '创建时间';


--
-- Name: COLUMN permissions.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.permissions.updated_at IS '更新时间';


--
-- Name: positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    dept_id uuid,
    level text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.positions OWNER TO postgres;

--
-- Name: COLUMN positions.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.positions.id IS '编号';


--
-- Name: COLUMN positions.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.positions.name IS '名称';


--
-- Name: COLUMN positions.dept_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.positions.dept_id IS '部门ID';


--
-- Name: COLUMN positions.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.positions.status IS '状态';


--
-- Name: COLUMN positions.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.positions.created_at IS '创建时间';


--
-- Name: COLUMN positions.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.positions.updated_at IS '更新时间';


--
-- Name: raw_materials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.raw_materials (
    id integer NOT NULL,
    batch_no text NOT NULL,
    name text NOT NULL,
    category text,
    weight_kg numeric(10,2),
    entry_date date DEFAULT CURRENT_DATE,
    created_by text,
    properties jsonb DEFAULT '{}'::jsonb,
    version integer DEFAULT 1,
    updated_at timestamp without time zone DEFAULT now(),
    dept_id uuid
);


ALTER TABLE public.raw_materials OWNER TO postgres;

--
-- Name: COLUMN raw_materials.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.id IS '编号';


--
-- Name: COLUMN raw_materials.batch_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.batch_no IS '批次号';


--
-- Name: COLUMN raw_materials.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.name IS '物料名称';


--
-- Name: COLUMN raw_materials.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.category IS '物料分类';


--
-- Name: COLUMN raw_materials.weight_kg; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.weight_kg IS '重量(kg)';


--
-- Name: COLUMN raw_materials.entry_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.entry_date IS '入库日期';


--
-- Name: COLUMN raw_materials.created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.created_by IS '创建人';


--
-- Name: COLUMN raw_materials.properties; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.properties IS '????';


--
-- Name: COLUMN raw_materials.version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.version IS '??';


--
-- Name: COLUMN raw_materials.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.updated_at IS '????';


--
-- Name: COLUMN raw_materials.dept_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_materials.dept_id IS '??ID';


--
-- Name: raw_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.raw_materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.raw_materials_id_seq OWNER TO postgres;

--
-- Name: raw_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.raw_materials_id_seq OWNED BY public.raw_materials.id;


--
-- Name: role_data_scopes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_data_scopes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    module text NOT NULL,
    scope_type text NOT NULL,
    dept_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_data_scopes_scope_chk CHECK ((scope_type = ANY (ARRAY['self'::text, 'dept'::text, 'dept_tree'::text, 'all'::text])))
);


ALTER TABLE public.role_data_scopes OWNER TO postgres;

--
-- Name: COLUMN role_data_scopes.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.role_data_scopes.id IS '编号';


--
-- Name: COLUMN role_data_scopes.role_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.role_data_scopes.role_id IS '角色';


--
-- Name: COLUMN role_data_scopes.dept_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.role_data_scopes.dept_id IS '部门ID';


--
-- Name: COLUMN role_data_scopes.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.role_data_scopes.created_at IS '创建时间';


--
-- Name: COLUMN role_data_scopes.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.role_data_scopes.updated_at IS '更新时间';


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: COLUMN role_permissions.role_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.role_permissions.role_id IS '角色';


--
-- Name: COLUMN role_permissions.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.role_permissions.created_at IS '创建时间';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort integer DEFAULT 100,
    dept_id uuid
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: COLUMN roles.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.id IS '编号';


--
-- Name: COLUMN roles.code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.code IS '编码';


--
-- Name: COLUMN roles.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.name IS '名称';


--
-- Name: COLUMN roles.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.description IS '说明';


--
-- Name: COLUMN roles.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.created_at IS '创建时间';


--
-- Name: COLUMN roles.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.updated_at IS '更新时间';


--
-- Name: COLUMN roles.sort; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.sort IS '排序';


--
-- Name: sys_dict_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_dict_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dict_id uuid NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sys_dict_items OWNER TO postgres;

--
-- Name: COLUMN sys_dict_items.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dict_items.id IS '编号';


--
-- Name: COLUMN sys_dict_items.sort; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dict_items.sort IS '排序';


--
-- Name: COLUMN sys_dict_items.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dict_items.created_at IS '创建时间';


--
-- Name: COLUMN sys_dict_items.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dict_items.updated_at IS '更新时间';


--
-- Name: sys_dicts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_dicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dict_key text NOT NULL,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sys_dicts OWNER TO postgres;

--
-- Name: COLUMN sys_dicts.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dicts.id IS '编号';


--
-- Name: COLUMN sys_dicts.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dicts.name IS '名称';


--
-- Name: COLUMN sys_dicts.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dicts.description IS '说明';


--
-- Name: COLUMN sys_dicts.sort; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dicts.sort IS '排序';


--
-- Name: COLUMN sys_dicts.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dicts.created_at IS '创建时间';


--
-- Name: COLUMN sys_dicts.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_dicts.updated_at IS '更新时间';


--
-- Name: sys_field_acl; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_field_acl (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    module text NOT NULL,
    field_code text NOT NULL,
    can_view boolean DEFAULT true NOT NULL,
    can_edit boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sys_field_acl OWNER TO postgres;

--
-- Name: COLUMN sys_field_acl.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_field_acl.id IS '编号';


--
-- Name: COLUMN sys_field_acl.role_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_field_acl.role_id IS '角色';


--
-- Name: COLUMN sys_field_acl.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_field_acl.created_at IS '创建时间';


--
-- Name: COLUMN sys_field_acl.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_field_acl.updated_at IS '更新时间';


--
-- Name: sys_grid_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_grid_configs (
    view_id text NOT NULL,
    summary_config jsonb,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sys_grid_configs OWNER TO postgres;

--
-- Name: COLUMN sys_grid_configs.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sys_grid_configs.updated_at IS '更新时间';


--
-- Name: system_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_configs (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text
);


ALTER TABLE public.system_configs OWNER TO postgres;

--
-- Name: COLUMN system_configs.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.system_configs.description IS '说明';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: COLUMN user_roles.role_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_roles.role_id IS '角色';


--
-- Name: COLUMN user_roles.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_roles.created_at IS '创建时间';


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'web_user'::text NOT NULL,
    avatar text,
    permissions text[],
    full_name text,
    phone text,
    email text,
    dept_id uuid,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    position_id uuid
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.id IS '编号';


--
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.username IS '用户名';


--
-- Name: COLUMN users.password; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password IS '密码';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS '角色';


--
-- Name: COLUMN users.avatar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.avatar IS '头像';


--
-- Name: COLUMN users.permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.permissions IS '权限集合';


--
-- Name: COLUMN users.full_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.full_name IS '姓名';


--
-- Name: COLUMN users.phone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.phone IS '手机号';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS '邮箱';


--
-- Name: COLUMN users.dept_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.dept_id IS '部门ID';


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.status IS '状态';


--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.created_at IS '创建时间';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.updated_at IS '更新时间';


--
-- Name: COLUMN users.position_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.position_id IS '岗位ID';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: v_field_labels; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_field_labels AS
 WITH overrides AS (
         SELECT field_label_overrides.module,
            field_label_overrides.field_code,
            field_label_overrides.field_label,
            0 AS priority
           FROM public.field_label_overrides
        ), static_cols AS (
         SELECT 'hr_employee'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'archives'::name) AND (a.attnum > 0) AND (NOT a.attisdropped) AND (a.attname <> ALL (ARRAY['properties'::name, 'version'::name, 'updated_at'::name])))
        UNION ALL
         SELECT 'hr_change'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'archives'::name) AND (a.attnum > 0) AND (NOT a.attisdropped) AND (a.attname <> ALL (ARRAY['properties'::name, 'version'::name, 'updated_at'::name])))
        UNION ALL
         SELECT 'hr_attendance'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'attendance_records'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        UNION ALL
         SELECT 'hr_attendance'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'attendance_month_overrides'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        UNION ALL
         SELECT 'mms_ledger'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'public'::name) AND (c.relname = 'raw_materials'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        UNION ALL
         SELECT 'hr_user'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'public'::name) AND (c.relname = 'users'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        ), dynamic_cols AS (
         SELECT 'hr_employee'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'hr_table_cols'::text)
        UNION ALL
         SELECT 'hr_change'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'hr_transfer_cols'::text)
        UNION ALL
         SELECT 'hr_attendance'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'hr_attendance_cols'::text)
        UNION ALL
         SELECT 'mms_ledger'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'materials_table_cols'::text)
        ), merged AS (
         SELECT overrides.module,
            overrides.field_code,
            overrides.field_label,
            overrides.priority
           FROM overrides
        UNION ALL
         SELECT dynamic_cols.module,
            dynamic_cols.field_code,
            dynamic_cols.field_label,
            dynamic_cols.priority
           FROM dynamic_cols
        UNION ALL
         SELECT static_cols.module,
            static_cols.field_code,
            static_cols.field_label,
            static_cols.priority
           FROM static_cols
        )
 SELECT DISTINCT ON (module, field_code) module,
    field_code,
    field_label
   FROM merged
  WHERE ((field_code IS NOT NULL) AND (field_code <> ''::text))
  ORDER BY module, field_code, priority;


ALTER VIEW public.v_field_labels OWNER TO postgres;

--
-- Name: v_role_data_scopes_matrix; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_role_data_scopes_matrix AS
 WITH modules AS (
         SELECT unnest(ARRAY['hr_employee'::text, 'hr_org'::text, 'hr_attendance'::text, 'hr_change'::text, 'hr_acl'::text, 'hr_user'::text, 'mms_ledger'::text]) AS module
        ), matrix AS (
         SELECT r.id AS role_id,
            m.module
           FROM (public.roles r
             CROSS JOIN modules m)
        )
 SELECT (((matrix.role_id)::text || ':'::text) || matrix.module) AS id,
    matrix.role_id,
    matrix.module,
    COALESCE(rds.scope_type, 'self'::text) AS scope_type,
    rds.dept_id
   FROM (matrix
     LEFT JOIN public.role_data_scopes rds ON (((rds.role_id = matrix.role_id) AND (rds.module = matrix.module))));


ALTER VIEW public.v_role_data_scopes_matrix OWNER TO postgres;

--
-- Name: v_role_permissions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_role_permissions AS
 SELECT r.id AS role_id,
    r.code AS role_code,
    array_agg(p.code ORDER BY p.code) AS permissions
   FROM ((public.roles r
     LEFT JOIN public.role_permissions rp ON ((rp.role_id = r.id)))
     LEFT JOIN public.permissions p ON ((p.id = rp.permission_id)))
  GROUP BY r.id, r.code;


ALTER VIEW public.v_role_permissions OWNER TO postgres;

--
-- Name: COLUMN v_role_permissions.role_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.v_role_permissions.role_id IS '角色';


--
-- Name: COLUMN v_role_permissions.permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.v_role_permissions.permissions IS '权限集合';


--
-- Name: v_role_permissions_matrix; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_role_permissions_matrix AS
 SELECT (((r.id)::text || ':'::text) || (p.id)::text) AS id,
    r.id AS role_id,
    p.id AS permission_id,
    p.code,
    p.name,
    p.module,
    p.action,
    (rp.permission_id IS NOT NULL) AS granted
   FROM ((public.roles r
     CROSS JOIN public.permissions p)
     LEFT JOIN public.role_permissions rp ON (((rp.role_id = r.id) AND (rp.permission_id = p.id))));


ALTER VIEW public.v_role_permissions_matrix OWNER TO postgres;

--
-- Name: v_roles_manage; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_roles_manage AS
 SELECT id,
    code,
    name,
    description,
    sort,
    created_at,
    updated_at
   FROM public.roles r;


ALTER VIEW public.v_roles_manage OWNER TO postgres;

--
-- Name: v_sys_dict_items; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_sys_dict_items AS
 SELECT d.id AS dict_id,
    d.dict_key,
    d.name AS dict_name,
    d.enabled AS dict_enabled,
    i.id AS item_id,
    i.label,
    i.value,
    i.sort,
    i.enabled AS item_enabled,
    i.extra,
    i.created_at,
    i.updated_at
   FROM (public.sys_dicts d
     JOIN public.sys_dict_items i ON ((i.dict_id = d.id)));


ALTER VIEW public.v_sys_dict_items OWNER TO postgres;

--
-- Name: COLUMN v_sys_dict_items.sort; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.v_sys_dict_items.sort IS '排序';


--
-- Name: COLUMN v_sys_dict_items.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.v_sys_dict_items.created_at IS '创建时间';


--
-- Name: COLUMN v_sys_dict_items.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.v_sys_dict_items.updated_at IS '更新时间';


--
-- Name: v_users_manage; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_users_manage AS
 SELECT u.id,
    u.username,
    u.full_name,
    u.phone,
    u.email,
    u.dept_id,
    u.status,
    ur.role_id,
    r.code AS role_code,
    r.name AS role_name,
    u.password,
    u.avatar
   FROM ((public.users u
     LEFT JOIN LATERAL ( SELECT ur_1.role_id
           FROM public.user_roles ur_1
          WHERE (ur_1.user_id = u.id)
          ORDER BY ur_1.created_at DESC
         LIMIT 1) ur ON (true))
     LEFT JOIN public.roles r ON ((r.id = ur.role_id)));


ALTER VIEW public.v_users_manage OWNER TO postgres;

--
-- Name: archives id; Type: DEFAULT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.archives ALTER COLUMN id SET DEFAULT nextval('hr.archives_id_seq'::regclass);


--
-- Name: payroll id; Type: DEFAULT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.payroll ALTER COLUMN id SET DEFAULT nextval('hr.payroll_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: raw_materials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_materials ALTER COLUMN id SET DEFAULT nextval('public.raw_materials_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: users; Type: TABLE DATA; Schema: basic_auth; Owner: postgres
--

COPY basic_auth.users (username, password, role, full_name) FROM stdin;
admin	admin123	web_admin	系统管理员
zhangsan	123456	web_user	张三(采购员)
lisi	123456	web_user	李四(仓管员)
\.


--
-- Data for Name: archives; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.archives (id, name, employee_no, department, "position", phone, status, base_salary, entry_date, properties, version, updated_at) FROM stdin;
802	新员工	EMP330625		\N	\N	试用	0.00	2026-01-27	{"status": "created", "field_789": 0, "row_locked_by": null}	1	2026-01-27 18:59:05.560925
734	万轩敏	E0035	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
733	韩欣敏	E0034	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
732	徐睿宸	E0033	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
731	阮曦颖	E0032	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
730	李安	E0031	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
729	倪墨	E0030	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
728	华浩杰	E0029	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
727	沈萱鹏	E0028	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
726	闵鑫鑫	E0027	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
725	任雪彬	E0026	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
724	唐宇	E0025	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
723	吴欣超	E0024	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
722	焦梦曦	E0023	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
721	范皓勇	E0022	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
720	何安静	E0021	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
719	臧桐	E0020	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
718	葛雪	E0019	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
717	惠杰	E0018	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
716	徐子	E0017	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
715	山桐梦	E0016	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
714	龚宇勇	E0015	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
713	柯芳敏	E0014	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
712	郁雪超	E0013	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
711	杜桐	E0012	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
710	萧勇欣	E0011	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
709	封瑶晨	E0010	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
708	储宇雪	E0009	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
707	曲豪珂	E0008	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
706	巫涵	E0007	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
705	宣睿	E0006	\N	\N	\N	离职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
704	禹怡军	E0005	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
703	傅凯妍	E0004	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
701	王安桐	E0002	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
700	史俊晨	E0001	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
796	单杰悦	E0097		\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_2086": null, "field_5458": "1000", "field_9314": "500"}	7	2026-01-25 01:49:56.27
798	童杰敏	E0099		\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 1500, "field_2086": null, "field_5458": "1000", "field_9314": "500"}	4	2026-01-25 01:49:56.27
799	惠晨丽	E0100		\N	\N	试用	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:52.537
790	黄皓宸	E0091	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	4	2026-01-25 01:49:56.27
789	宋娜婉	E0090	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
788	林雯琪	E0089	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
786	米瑾梦	E0087	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
785	洪悦妍	E0086	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
784	安博	E0085	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
783	靳宸杰	E0084	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
782	颜超轩	E0083	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
781	巫超鹏	E0082	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
780	惠浩萱	E0081	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
779	郑杰颖	E0080	\N	\N	\N	离职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
778	袁丽珂	E0079	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
777	花豪倩	E0078	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
776	周珂婉	E0077	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
775	祁昕	E0076	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
774	喻墨敏	E0075	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
773	裘亦	E0074	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
772	董彬雯	E0073	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
771	应瑾怡	E0072	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
770	诸伟婉	E0071	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
769	解丽欣	E0070	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
768	柏凯浩	E0069	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
767	梅宇悦	E0068	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
766	钟皓	E0067	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": 0}	2	2026-01-25 01:47:29.804
765	支敏	E0066	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
764	姜丽轩	E0065	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
763	鲁瑾	E0064	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
793	宣睿婷	E0094	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:56.27
792	余涵萱	E0093	\N	\N	\N	离职	0.00	2026-01-24	{"gender": "女", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:56.27
702	应军超	E0003		\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
791	车鹏睿	E0092	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:56.27
797	翁涵	E0098	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	9	2026-01-25 01:49:56.27
787	马安瑾	E0088	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
749	花瑜	E0050	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
748	倪宸浩	E0049	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
747	鲁桐珊	E0048	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
746	严强	E0047	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
745	戴曦	E0046	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
744	车曦军	E0045	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
743	郝磊博	E0044	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
742	沈安梦	E0043	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
741	常睿皓	E0042	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
740	顾琪婷	E0041	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
739	贺超豪	E0040	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
738	曹宇桐	E0039	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
737	邹琪轩	E0038	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
736	富欣瑶	E0037	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
735	巴墨芳	E0036	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
801	林	EMP586274		\N	\N	试用	0.00	2026-01-25	{"field_789": 0, "field_2086": "1", "field_3727": [{"id": "9a83b87e-0368-4e87-bf0e-9e3fca0b4f4d", "ext": "jpg", "name": "进度.jpg", "size": 124887, "type": "image/jpeg", "dataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QBoRXhpZgAASUkqAAgAAAACADEBAgAHAAAAJgAAAGmHBAABAAAALgAAAAAAAABQaWNhc2EAAAIAAJAHAAQAAAAwMjIwA5ACABQAAABMAAAAAAAAADIwMjU6MTI6MjggMTA6NDM6MzAA/+EDO2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS41LjAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczpJcHRjNHhtcEV4dD0iaHR0cDovL2lwdGMub3JnL3N0ZC9JcHRjNHhtcEV4dC8yMDA4LTAyLTI5LyIgZXhpZjpEYXRlVGltZU9yaWdpbmFsPSIyMDI1LTEyLTI4VDEwOjQzOjMwKzAwOjAwIiBwaG90b3Nob3A6Q3JlZGl0PSJFZGl0ZWQgd2l0aCBHb29nbGUgQUkiIHBob3Rvc2hvcDpEYXRlQ3JlYXRlZD0iMjAyNS0xMi0yOFQxMDo0MzozMCswMDowMCIgSXB0YzR4bXBFeHQ6RGlnaXRhbFNvdXJjZWZpbGVUeXBlPSJodHRwOi8vY3YuaXB0Yy5vcmcvbmV3c2NvZGVzL2RpZ2l0YWxzb3VyY2V0eXBlL2NvbXBvc2l0ZVdpdGhUcmFpbmVkQWxnb3JpdGhtaWNNZWRpYSIgSXB0YzR4bXBFeHQ6RGlnaXRhbFNvdXJjZVR5cGU9Imh0dHA6Ly9jdi5pcHRjLm9yZy9uZXdzY29kZXMvZGlnaXRhbHNvdXJjZXR5cGUvY29tcG9zaXRlV2l0aFRyYWluZWRBbGdvcml0aG1p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", "uploadedAt": "2026-01-25T01:49:01.146Z"}], "field_3986": null, "field_7980": "4", "field_8633": "2"}	8	2026-01-27 18:39:56.588
762	霍勇鹏	E0063	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
761	陆轩	E0062	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
760	薛萱琳	E0061	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
759	彭琪桐	E0060	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
795	魏瑜墨	E0096	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "status": "created", "field_789": 1500, "field_5458": "1000", "field_9314": "500", "row_locked_by": null}	9	2026-01-25 01:51:09.553
794	齐娜妍	E0095	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "男", "status": "created", "field_789": 1500, "field_5458": "1000", "field_9314": "500", "row_locked_by": null}	7	2026-01-25 01:51:11.557
758	左怡轩	E0059	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
757	荣琳博	E0058	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
756	蓝瑶婷	E0057	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
755	乌彬鑫	E0056	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
754	莫瑾宸	E0055	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
753	魏伟	E0054	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
752	陈嘉婉	E0053	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
751	缪彬	E0052	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
800	你	EMP339009		\N	\N	试用	0.00	2026-01-25	{"field_789": 0}	4	2026-01-27 18:40:02.606
750	苗勇静	E0051	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
\.


--
-- Data for Name: attendance_month_overrides; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.attendance_month_overrides (id, att_month, person_type, employee_id, employee_name, employee_no, temp_name, temp_phone, dept_name, total_days, late_days, early_days, leave_days, absent_days, overtime_minutes, remark, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: attendance_records; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.attendance_records (id, att_date, person_type, employee_id, employee_name, employee_no, temp_name, temp_phone, dept_id, dept_name, shift_id, shift_name, shift_start_time, shift_end_time, shift_cross_day, late_grace_min, early_grace_min, ot_break_min, punch_times, late_flag, early_flag, leave_flag, absent_flag, overtime_minutes, remark, created_at, updated_at) FROM stdin;
00d84abd-ad63-4935-b3bd-e6c92c618ceb	2026-01-17	employee	689	新员工	EMP176696	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
96646e9b-0474-406a-80be-2f13c9a92953	2026-01-17	employee	692	新员工	EMP177340	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
a49548cd-2014-45ae-9704-aee44542af9f	2026-01-17	employee	690	新员工	EMP176913	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
22d99cb1-3be5-488a-86f3-d7791be1ac15	2026-01-17	employee	679	黄皓宸	E0091	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
927f3c61-b1ed-482e-af12-67245b9ba6a2	2026-01-17	employee	688	惠晨丽	E0100	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c3b91ac9-b6b9-4353-8192-e334c4d06397	2026-01-17	employee	684	魏瑜墨	E0096	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
a86de1ec-34ca-4834-886c-572928d9c83d	2026-01-17	employee	683	齐娜妍	E0095	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c9010a87-68e5-4b99-8fab-c13519b9362b	2026-01-17	employee	682	宣睿婷	E0094	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
dd3496c9-079b-4eca-81b7-6d6a666afb8b	2026-01-17	employee	681	余涵萱	E0093	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
f76ed670-e64b-408d-9d29-afe2e4eb10e6	2026-01-17	employee	680	车鹏睿	E0092	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
d00b96c8-6c32-4970-90ff-3498200cb70f	2026-01-17	employee	678	宋娜婉	E0090	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
8fa906b4-b040-4f1d-bcf8-031a850dd185	2026-01-17	employee	677	林雯琪	E0089	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
b2a03bf1-1825-475d-8c56-090ceb961828	2026-01-17	employee	676	马安瑾	E0088	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
5b01c362-846c-47a5-b9b8-4fddf8c055c1	2026-01-17	employee	675	米瑾梦	E0087	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
0a5bdcec-a43a-40ef-888a-8ddaa1a65e7d	2026-01-17	employee	687	童杰敏	E0099	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c39caf99-175a-4a0d-9412-da319d5c8520	2026-01-17	employee	686	翁涵	E0098	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c0561475-5bb6-4881-ac5f-f29f433353a7	2026-01-17	employee	691	新员工	EMP177124	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
f39ebe47-06b2-4264-b40a-6b3e451c0fc3	2026-01-17	employee	693	新员工	EMP572882	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
a7bc5a25-5462-4b20-948c-f8cc53cf0cd6	2026-01-17	employee	696	新员工	EMP573495	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
10ff8605-0df4-42f9-a9da-0a5125c8b97e	2026-01-17	employee	694	新员工	EMP573083	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
76af5081-d810-4daa-83fa-6147300bddf0	2026-01-17	employee	631	沈安梦	E0043	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c4f09851-821b-4492-93d7-6d822f6b28e9	2026-01-17	employee	664	祁昕	E0076	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
4d245524-3dfc-4782-843a-06862ec69eee	2026-01-17	employee	672	靳宸杰	E0084	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
03465ae4-395a-4249-b23d-7cb767bce444	2026-01-17	employee	671	颜超轩	E0083	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
a9e85864-a10a-4d8e-8f43-7aa1c820acd0	2026-01-17	employee	670	巫超鹏	E0082	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
4dd15097-8966-40cd-9c50-a2327229c1d5	2026-01-17	employee	669	惠浩萱	E0081	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
1ee66a69-30aa-4759-b800-c1053ec6f555	2026-01-17	employee	668	郑杰颖	E0080	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
7ac5b5d5-c05f-459c-bdd2-c1319455f2ef	2026-01-17	employee	667	袁丽珂	E0079	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
4ac54507-741f-43e7-98d3-425d57af44ef	2026-01-17	employee	666	花豪倩	E0078	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
07f48894-66dd-4a92-9b16-c3a47b7dcce9	2026-01-17	employee	665	周珂婉	E0077	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
ccf25668-0b98-4a62-8e4c-bf3ad080a22f	2026-01-17	employee	663	喻墨敏	E0075	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
5cc866a7-c7fd-4317-9e19-3a7274143290	2026-01-17	employee	662	裘亦	E0074	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
d3b66e3a-28e6-49c1-8685-4f265f129c62	2026-01-17	employee	661	董彬雯	E0073	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
297a5cb3-0289-4ece-a18c-32f9e19a8784	2026-01-17	employee	660	应瑾怡	E0072	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
b527694e-92d5-46b3-af98-00e05294390d	2026-01-17	employee	659	诸伟婉	E0071	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
107adae8-872b-4676-9d83-8a37f3bfc47a	2026-01-17	employee	658	解丽欣	E0070	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
752dbc96-f2ad-4948-a148-1c71fcd2dc81	2026-01-17	employee	657	柏凯浩	E0069	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
a2877f0e-6c0a-4339-8ae8-1aba942e3aa5	2026-01-17	employee	656	梅宇悦	E0068	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c05741fc-c71b-451d-b582-f8b58e41d781	2026-01-17	employee	655	钟皓	E0067	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
60bd9c93-6116-4466-a16f-d18466778938	2026-01-17	employee	654	支敏	E0066	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
4cc23194-8989-4e1f-9722-10868a6ef48b	2026-01-17	employee	653	姜丽轩	E0065	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
bb0ee890-5732-47ee-bb49-a8b9635c6329	2026-01-17	employee	652	鲁瑾	E0064	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
dfb5e778-0571-4861-90ad-32e73ae76799	2026-01-17	employee	650	陆轩	E0062	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c35be896-dc30-445c-a18d-3e88402b08e9	2026-01-17	employee	649	薛萱琳	E0061	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
4bcb4371-cdaa-4fea-8c4f-63214e9b86c1	2026-01-17	employee	647	左怡轩	E0059	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
85084dad-0c35-41e6-ba14-c24844f75bef	2026-01-17	employee	646	荣琳博	E0058	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
e2c66b7f-e1a1-4dea-9762-7facd2f94040	2026-01-17	employee	645	蓝瑶婷	E0057	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
4b1416eb-74d4-408f-b625-8ce6b2fed297	2026-01-17	employee	643	莫瑾宸	E0055	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
142d5757-f3ae-483a-9303-0e9079b23830	2026-01-17	employee	642	魏伟	E0054	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
fe94f0c9-3d2f-4775-a40a-dfef033e1e89	2026-01-17	employee	648	彭琪桐	E0060	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	t	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 22:16:10.069+00
cc6a78dd-a66e-4330-b307-360f7aac2e43	2026-01-17	employee	697	新员工	EMP573684	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	t	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
7f87aef8-b918-49da-82ea-8b87d877c554	2026-01-17	employee	674	洪悦妍	E0008	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	2	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
531046ad-6bc0-49de-98c9-4074cc9b6363	2026-01-17	employee	644	乌彬鑫	E0056	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
003e93f8-f07e-417c-a65a-4ce970bfe8ea	2026-01-17	employee	685	单杰悦	E0097	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 21:47:00.954+00
9300afc7-e837-4b28-9b6a-b0648326c339	2026-01-17	employee	651	霍勇鹏	E0063	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
bc132b55-f887-4c97-8a51-51f4d8aa0c90	2026-01-17	employee	641	陈嘉婉	E0053	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
93a1a4d3-29ee-4db3-92b0-3b882d7452f7	2026-01-17	employee	640	缪彬	E0052	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
ecb63586-bea4-4c48-adf9-0cb9ff127b7c	2026-01-17	employee	639	苗勇静	E0051	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
54181fe2-1d11-4dc8-8af7-fb5bfd908919	2026-01-17	employee	638	花瑜	E0050	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
591127f5-397e-429a-9568-31d3cb26efd5	2026-01-17	employee	637	倪宸浩	E0049	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
2c0d21fd-030a-416b-86e1-65b2254bf071	2026-01-17	employee	636	鲁桐珊	E0048	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
29979695-ed1d-43e3-b4a8-c6178d07e22a	2026-01-17	employee	589	史俊晨	E0001	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
ecde2ad1-a4d0-4bc5-8188-8fea197d96b5	2026-01-17	employee	695	新员工	EMP573327	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
28fb0b85-aade-46ed-8f68-f2c693050048	2026-01-17	employee	635	严强	E0047	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
9acc60df-58d3-4b95-8885-578749a5bb6b	2026-01-17	employee	634	戴曦	E0046	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c859ddb8-2aa6-4999-85a9-8ba0e64955d5	2026-01-17	employee	633	车曦军	E0045	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
a0223964-e54a-4f92-80ce-c50d8f2d88fb	2026-01-17	employee	632	郝磊博	E0044	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
acec1cd3-a960-4273-86cd-a9031f91c9aa	2026-01-17	employee	630	常睿皓	E0042	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
fb7c13d8-4466-446f-a84f-2755d4ad40ab	2026-01-17	employee	629	顾琪婷	E0041	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
866e14ea-19c5-42c1-ab2e-e90ab9b83bd9	2026-01-17	employee	628	贺超豪	E0040	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
307538fa-d9b3-4f6d-bfea-608713093419	2026-01-17	employee	627	曹宇桐	E0039	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
ad33db2e-4dea-4e46-8f60-ddd18b9db841	2026-01-17	employee	626	邹琪轩	E0038	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
fea78079-9f4b-493c-9327-6f4a45bab566	2026-01-17	employee	625	富欣瑶	E0037	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
decae824-2e06-48d4-a0d8-eac9f1cd7641	2026-01-17	employee	624	巴墨芳	E0036	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
e7840f71-94e6-4d9d-ad68-768e850a338f	2026-01-17	employee	622	韩欣敏	E0034	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
094ad70b-e263-470f-80d8-ddb2cea915c1	2026-01-17	employee	621	徐睿宸	E0033	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
b0583ab4-bd48-42e1-aa9b-6896a0700528	2026-01-17	employee	620	阮曦颖	E0032	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
dd81a34b-2a70-4f1c-9884-1bbdda795a52	2026-01-17	employee	619	李安	E0031	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
0c4d1b0e-65c7-4a5d-8c02-f4f4f2ad2f74	2026-01-17	employee	617	华浩杰	E0029	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
638c6a9a-f3b2-4f45-8260-0bdb79596b7a	2026-01-17	employee	616	沈萱鹏	E0028	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
55968a0f-b32f-41e2-b075-2f7f06431a3f	2026-01-17	employee	615	闵鑫鑫	E0027	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
1bea76a1-d82e-464e-86ca-5e2b29ac842e	2026-01-17	employee	614	任雪彬	E0026	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
3b12113f-d8db-4ba1-902c-fab2d0cc5805	2026-01-17	employee	613	唐宇	E0025	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
f7a533f0-8a62-40ef-adda-90290ae7b51a	2026-01-17	employee	611	焦梦曦	E0023	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
f532e729-aa72-4759-8ba6-5076160fe2d5	2026-01-17	employee	610	范皓勇	E0022	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
5fa787a6-8cc7-4732-a116-1a53b8f2d54d	2026-01-17	employee	609	何安静	E0021	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
0c847a39-f196-49db-acfd-66ed31302f69	2026-01-17	employee	608	臧桐	E0020	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
83788719-ae6d-4f2e-a160-9e23e19744ea	2026-01-17	employee	607	葛雪	E0019	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
30d58b43-04e0-42e3-b87f-bf43484c9973	2026-01-17	employee	606	惠杰	E0018	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
71dd86e1-9618-49e0-a7ae-9b6a82fd2854	2026-01-17	employee	605	徐子	E0017	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
392b0c8d-81be-4af1-88f5-8f20eb87e83e	2026-01-17	employee	603	龚宇勇	E0015	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
fb8567ce-ddf5-442e-ad49-1a6b8a7cf396	2026-01-17	employee	602	柯芳敏	E0014	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
02f1f4e6-6a12-4139-8e6f-8d93e7847486	2026-01-17	employee	601	郁雪超	E0013	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
bef1aadd-5317-4f80-a12b-6fea0c94c54e	2026-01-17	employee	600	杜桐	E0012	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
9f3d60b6-2b0f-4a1e-a2d4-313a2770e0be	2026-01-17	employee	599	萧勇欣	E0011	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
b0718c29-9226-4a36-b194-6be47c2d10cc	2026-01-17	employee	598	封瑶晨	E0010	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
f22a484e-0cb6-4720-8eb0-b5a03f42f16a	2026-01-17	employee	597	储宇雪	E0009	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
e7baa0df-3d97-48be-9542-5ba811c59a78	2026-01-17	employee	595	巫涵	E0007	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
3c068353-adf8-497a-b28c-c39c063a4618	2026-01-17	employee	594	宣睿	E0006	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
77a351e8-4a1e-4bfc-81e9-a8c68f36ec5d	2026-01-17	employee	592	傅凯妍	E0004	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
07da03ab-1409-42d8-8055-2d61f7aaa25a	2026-01-17	employee	591	应军超	E0003	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
ba7b5f43-1402-4a5f-9ec3-066f697525c1	2026-01-17	employee	590	王安桐	E0002	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
e4c22131-f174-4021-ba99-b9eaebc329b6	2026-01-17	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:51:06.250194+00	2026-01-16 20:51:06.250194+00
a969b365-dbdf-4769-bed6-98bb8f6e3430	2025-12-31	employee	689	新员工	EMP176696	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
df0af502-8bb7-49c0-a7c9-21768e846e62	2025-12-31	employee	692	新员工	EMP177340	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
aadd032b-aae3-45f4-b33d-c6c9862581c2	2026-01-17	employee	623	万轩敏	E0035	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 22:03:46.695+00
7d1427b0-8280-4d11-8add-fd7c7ba7edce	2026-01-17	employee	593	禹怡军	E0005	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
c5dd31ee-957d-41b9-8214-d2f566e09c55	2026-01-17	employee	698	新员工	EMP177340	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
ef106610-31e1-4115-9673-970fc8bb0afc	2026-01-17	employee	596	曲豪珂	E0008	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 20:50:58.836023+00
5bc9aa08-299c-462d-9954-04dbc8f9da26	2026-01-17	employee	618	倪墨	E0030	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 22:16:09.485+00
17315a9e-ce17-427f-9e1c-2313ddcdf2e3	2025-12-31	employee	690	新员工	EMP176913	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
61692530-c015-4994-ae08-8c1ca732cc73	2025-12-31	employee	679	黄皓宸	E0091	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
53a0ba6c-e82a-4cc9-9f1c-9b0ebb9dd46f	2025-12-31	employee	688	惠晨丽	E0100	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
61a5088f-dc6a-42f3-9628-b687813a08cc	2025-12-31	employee	685	单杰悦	E0097	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
2af26d6c-1347-44ff-a797-e177559e009f	2025-12-31	employee	684	魏瑜墨	E0096	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
817929e4-b941-45cc-ac39-6a3ca5853f71	2025-12-31	employee	683	齐娜妍	E0095	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
a8392d7b-54a7-400c-a464-ac068d3c22cd	2025-12-31	employee	682	宣睿婷	E0094	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
baa992c8-250d-4eb0-94a9-00ec29dc237d	2025-12-31	employee	681	余涵萱	E0093	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
bb710f79-4c87-4460-8f86-b4d72bb363df	2025-12-31	employee	680	车鹏睿	E0092	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
0f297037-0a14-438d-9a16-5e374101056b	2025-12-31	employee	678	宋娜婉	E0090	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
ffbef9aa-170c-4a77-8c08-4e702243b073	2025-12-31	employee	677	林雯琪	E0089	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
96ff13ae-f8e3-4767-a4ca-91b721eafd74	2025-12-31	employee	676	马安瑾	E0088	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
69be06ef-ac70-4c96-9a49-bc2c1d8d6fa7	2025-12-31	employee	675	米瑾梦	E0087	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
91d90bdd-18a6-4888-809a-10188f966c83	2025-12-31	employee	674	洪悦妍	E0086	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
9e9ce107-68da-4ce4-b46e-c01f05d5d44c	2025-12-31	employee	673	安博	E0085	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
a08586c1-1650-453c-ba6c-8294baece50b	2025-12-31	employee	687	童杰敏	E0099	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
15432999-7586-4974-9b99-2ee50a17e706	2025-12-31	employee	686	翁涵	E0098	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
28fa4468-caee-4e25-9d9a-8ea962fd2952	2025-12-31	employee	691	新员工	EMP177124	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
e82eb778-13df-438c-ae2f-529212cccb09	2025-12-31	employee	693	新员工	EMP572882	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
b834f724-5728-4da6-abdb-8a34ee533d89	2025-12-31	employee	696	新员工	EMP573495	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
1cf3382c-5efa-4c3c-a70d-edbd2c0f61f8	2025-12-31	employee	694	新员工	EMP573083	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
0a8e61f8-7d13-46eb-9094-ed010e7c20f0	2025-12-31	employee	697	新员工	EMP573684	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
cf555547-e637-40de-8021-9084a32884ba	2025-12-31	employee	631	沈安梦	E0043	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
1826b2f7-c0f5-4874-99e6-db8a7f0fc5e3	2025-12-31	employee	664	祁昕	E0076	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
b6825a68-1575-4a3e-93d5-edbc30a72b5a	2025-12-31	employee	672	靳宸杰	E0084	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
5ec2a957-76e9-40bf-a205-4b7c27209132	2025-12-31	employee	671	颜超轩	E0083	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
604323eb-866b-4069-92e5-6cb0cb3b0887	2025-12-31	employee	670	巫超鹏	E0082	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
1ad57de0-6308-4d95-ad8c-5560ee3c90e3	2025-12-31	employee	669	惠浩萱	E0081	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
ac8a87f9-20de-4ae5-9816-6366b8530f52	2025-12-31	employee	668	郑杰颖	E0080	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
94495f5c-9216-404d-8de8-16c8de07b463	2025-12-31	employee	667	袁丽珂	E0079	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
11439346-5093-4074-9eea-837adde46fa7	2025-12-31	employee	666	花豪倩	E0078	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
ff2382bb-649c-4ebf-bd72-bfe79ec0c9e3	2025-12-31	employee	665	周珂婉	E0077	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
210e04d8-bfb5-4752-83ac-0ab4a80be636	2025-12-31	employee	663	喻墨敏	E0075	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
07abc2b3-1dfc-4c64-8e97-a9e1467cf67f	2025-12-31	employee	662	裘亦	E0074	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
dfbab858-e86f-48fc-b3ac-df05cdb5cad0	2025-12-31	employee	661	董彬雯	E0073	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
19765f8b-3f82-4c8d-9cce-7d6371f48ffa	2025-12-31	employee	660	应瑾怡	E0072	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
a655d69a-bee5-49cd-9d9b-04e0272f7d23	2025-12-31	employee	659	诸伟婉	E0071	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
85b8fe36-41e6-422c-a2dd-081422b8b204	2025-12-31	employee	658	解丽欣	E0070	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
964d94d6-1943-42ca-8a7d-fff780dddcfc	2025-12-31	employee	657	柏凯浩	E0069	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
4d9cd78f-f721-4758-9597-08c7c04df7e4	2025-12-31	employee	656	梅宇悦	E0068	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
fdd742e2-86a1-47c4-9d04-e7930deb0897	2025-12-31	employee	655	钟皓	E0067	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
b1081920-972c-4f86-91b8-e2c28e311922	2025-12-31	employee	654	支敏	E0066	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
2ea7a3dc-9c37-415b-8d34-6a91f7de2967	2025-12-31	employee	653	姜丽轩	E0065	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
64296162-d588-4716-b1a5-fe10850e462a	2025-12-31	employee	652	鲁瑾	E0064	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
5c1ceae3-35e7-4147-ba4e-f40f6591b86e	2025-12-31	employee	651	霍勇鹏	E0063	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
5801ab27-ea2c-4c9f-b647-eb1a9fb20230	2025-12-31	employee	650	陆轩	E0062	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
f17286d8-b9a7-42e4-ad92-11e42797d7b7	2025-12-31	employee	649	薛萱琳	E0061	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
e259a258-e5e4-4437-a7d6-dac1e9f3710a	2025-12-31	employee	648	彭琪桐	E0060	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
9c53f57b-dc33-4278-892a-2a84bfc95c97	2025-12-31	employee	647	左怡轩	E0059	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
d580638e-e8cd-453f-bf46-0d82850e6c18	2025-12-31	employee	646	荣琳博	E0058	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
549d4445-b330-4fd7-90fe-0698e3e62c9d	2025-12-31	employee	645	蓝瑶婷	E0057	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
e245ceb3-a0d9-4b18-a55d-4554881f1159	2025-12-31	employee	644	乌彬鑫	E0056	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
4d42da06-86ea-42ab-a997-3e890cd7d352	2025-12-31	employee	643	莫瑾宸	E0055	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
cf584508-fadb-43e3-9cce-6484b24f5dc8	2025-12-31	employee	642	魏伟	E0054	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
c8ab5a92-5ad5-433b-8a3a-e235dff80b93	2025-12-31	employee	641	陈嘉婉	E0053	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
a826dfd3-02b8-49e2-80c0-672b45b78627	2025-12-31	employee	640	缪彬	E0052	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
970e0422-379f-44cd-b79a-7720fb8b48ba	2025-12-31	employee	639	苗勇静	E0051	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
1ae5ac61-7d28-448e-bfd3-6519fd88553d	2025-12-31	employee	638	花瑜	E0050	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
fcdb3e3e-78b9-493b-abc8-14cb3f0f9f35	2025-12-31	employee	637	倪宸浩	E0049	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
7d4b716e-2d8a-4344-b95f-4abaee0022fb	2025-12-31	employee	636	鲁桐珊	E0048	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
afef9bda-2977-4e6c-b63a-862fc7dc2b59	2025-12-31	employee	589	史俊晨	E0001	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
74e71566-6004-4c38-a365-b4847a15e222	2025-12-31	employee	698	新员工	EMP573870	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
f1f01dc7-fc10-474b-bcee-825713eb865d	2025-12-31	employee	695	新员工	EMP573327	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
7ffbe9be-9a80-4d38-993e-05acaad3959e	2025-12-31	employee	635	严强	E0047	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
feceb772-f39c-457d-93f8-b7ebc9ef75a0	2025-12-31	employee	634	戴曦	E0046	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
edc6023d-4db7-482d-a36c-ba331d57673c	2025-12-31	employee	633	车曦军	E0045	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
dc6cf24e-dcfd-402a-86c0-6e1226c45e04	2025-12-31	employee	632	郝磊博	E0044	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
fc99924f-f31f-4d54-918c-187b468cc88d	2025-12-31	employee	630	常睿皓	E0042	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
f33eeb9f-9251-4a55-9b04-2bb33207da8b	2025-12-31	employee	629	顾琪婷	E0041	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
81f866f4-8f3a-45af-be2c-6004a161f1e6	2025-12-31	employee	628	贺超豪	E0040	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
cf215159-bcb2-4cb5-aee7-d54f0309f28a	2025-12-31	employee	627	曹宇桐	E0039	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
8852abbd-051c-42d5-9095-b5bd58986b50	2025-12-31	employee	626	邹琪轩	E0038	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
c8a76e34-2ed4-4b3b-a605-d060485581ad	2025-12-31	employee	625	富欣瑶	E0037	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
6f2b1c8e-57e1-4599-abd2-f211f856524e	2025-12-31	employee	624	巴墨芳	E0036	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
40cedb1c-9c74-4da4-9bfa-e8d34f72202f	2025-12-31	employee	623	万轩敏	E0035	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
6082a279-6717-4e8c-9422-3f88e1d17e4b	2025-12-31	employee	622	韩欣敏	E0034	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
ba32c014-c876-47bc-a4ac-1ae87d0a0899	2025-12-31	employee	621	徐睿宸	E0033	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
91d94e48-a742-4fa5-b3b1-212f2b7b102d	2025-12-31	employee	620	阮曦颖	E0032	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
705bd511-3b40-44ae-bd49-baceb7ae4bea	2025-12-31	employee	619	李安	E0031	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
e4d30cc8-e82b-4fc4-87fe-27fc9ac1efca	2025-12-31	employee	618	倪墨	E0030	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
f848d968-912e-41fc-89bf-5b085984abd3	2025-12-31	employee	617	华浩杰	E0029	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
0f274e88-e104-4b87-9864-82822a79b71d	2025-12-31	employee	616	沈萱鹏	E0028	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
b4cca5f0-ac5d-4e97-b14c-18b70d6eb4d3	2025-12-31	employee	615	闵鑫鑫	E0027	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
d321b6ed-cb3d-42dd-9722-65252f4b4c41	2025-12-31	employee	614	任雪彬	E0026	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
663e3c11-f750-473c-9887-782b4fa07881	2025-12-31	employee	613	唐宇	E0025	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
dbd29f79-33b3-4b6e-b19e-b178a409c937	2025-12-31	employee	612	吴欣超	E0024	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
cb51e3f6-b5de-43b8-9a44-12b210336612	2025-12-31	employee	611	焦梦曦	E0023	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
8bff7edf-c2d4-49ab-8e17-0c5d26818df3	2025-12-31	employee	610	范皓勇	E0022	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
2ece8818-b619-408d-930e-3653d87824ba	2025-12-31	employee	609	何安静	E0021	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
b2e03828-035f-434a-8aae-9f7ab78a2c0f	2025-12-31	employee	608	臧桐	E0020	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
9bfa21c0-96c5-48b9-ad43-e4961812a9e2	2025-12-31	employee	607	葛雪	E0019	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
d85e6b87-31a1-4732-8dbc-8de723cb37a0	2025-12-31	employee	606	惠杰	E0018	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
24a7b221-9754-4dbe-aa9a-77ac232b843f	2025-12-31	employee	605	徐子	E0017	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
5f8c21ee-fe4c-47bf-bbbd-e3a826357b75	2025-12-31	employee	604	山桐梦	E0016	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
62dcb029-f070-4a6e-a5be-c7933561ff06	2025-12-31	employee	603	龚宇勇	E0015	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
ab651e15-19b3-4617-b716-df64da734ce7	2025-12-31	employee	602	柯芳敏	E0014	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
16226521-8a82-4ca5-ba12-449fe341e6f3	2025-12-31	employee	601	郁雪超	E0013	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
ce33cd91-5889-4304-9d95-28307eed7541	2025-12-31	employee	600	杜桐	E0012	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
2db383ce-e25a-4d7a-a0ac-2deb6a327aac	2025-12-31	employee	599	萧勇欣	E0011	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
bf76d711-2b5d-451b-8224-8f7b741fd431	2025-12-31	employee	598	封瑶晨	E0010	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
458e6caa-07e4-4f7e-b5af-f960f5cff0ea	2025-12-31	employee	597	储宇雪	E0009	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
524a54aa-4447-4e69-bd2c-ffd525df2839	2025-12-31	employee	596	曲豪珂	E0008	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
3fde02c3-0b26-457e-8ce0-4e8625731f7f	2025-12-31	employee	595	巫涵	E0007	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
3e473167-60b6-41f7-a52f-13586ec6f7ea	2025-12-31	employee	594	宣睿	E0006	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
beccf574-414d-48f6-9e48-41a125ab4719	2025-12-31	employee	593	禹怡军	E0005	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
2886eab6-5d16-43f5-aec8-2a3528057c0d	2025-12-31	employee	592	傅凯妍	E0004	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
9b686cfc-fb01-41bd-93bb-ec76b47074b8	2025-12-31	employee	591	应军超	E0003	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
efd1986b-7bcd-4ea7-88ff-5b276fdf2806	2025-12-31	employee	590	王安桐	E0002	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:47.2313+00	2026-01-16 20:53:47.2313+00
988cdd54-4119-4785-8185-0834bdf994b4	1970-01-01	employee	689	新员工	EMP176696	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
92d30c9c-54ba-4c4a-8a63-32e2845c183a	1970-01-01	employee	692	新员工	EMP177340	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
2f5fd168-720e-4ad2-9036-51a9dbc11ee6	1970-01-01	employee	690	新员工	EMP176913	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
01531c27-ffd8-4df0-8f78-17038a09e441	1970-01-01	employee	679	黄皓宸	E0091	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
fdb364fd-d380-4ba1-a46e-9599ee969730	2026-01-29	employee	716	徐子	E0017	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
d9f904a6-0b46-4300-9ed4-6637f0bcf1a0	1970-01-01	employee	688	惠晨丽	E0100	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
3e85f9da-9737-49c6-8eef-91f367d02757	1970-01-01	employee	685	单杰悦	E0097	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
8ee3fdda-75cd-412d-b669-8c3e13a28c61	1970-01-01	employee	684	魏瑜墨	E0096	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
e4a80784-7a2b-4806-b106-2c13e4f2e3b6	1970-01-01	employee	683	齐娜妍	E0095	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
8ffc809a-d6c1-4159-b811-79262683061c	1970-01-01	employee	682	宣睿婷	E0094	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
354bf4b4-8acc-43fa-b99d-794273e988eb	1970-01-01	employee	681	余涵萱	E0093	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
eea37e77-2f5c-48f7-9841-ccf71930e3a6	1970-01-01	employee	680	车鹏睿	E0092	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
1c314365-a868-4c53-a929-f4bc2d267221	1970-01-01	employee	678	宋娜婉	E0090	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
fc8c309e-9199-4fac-a140-cb3d16d51813	1970-01-01	employee	677	林雯琪	E0089	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
4cc3b2e3-b062-441f-82f5-ae8878f10558	1970-01-01	employee	676	马安瑾	E0088	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
15cc95ae-ce98-4f82-b0cd-8f0769adb8e8	1970-01-01	employee	675	米瑾梦	E0087	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
7576e30a-6400-488c-9c6f-dd161293554e	1970-01-01	employee	674	洪悦妍	E0086	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
49776c25-3714-4d60-a7f0-9008c0aa20be	1970-01-01	employee	673	安博	E0085	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
9d61babf-9785-43b8-90dc-06e79f150528	1970-01-01	employee	687	童杰敏	E0099	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
c036c17f-b538-4502-96f2-cdb4f61dc01d	1970-01-01	employee	686	翁涵	E0098	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
e33fd045-2b7e-4aaa-b060-9592b0ef325b	1970-01-01	employee	691	新员工	EMP177124	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
d5f57896-7df3-4b9c-8b97-e4f9d25ed814	1970-01-01	employee	693	新员工	EMP572882	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
236dc47f-4948-4941-93e0-1b4fc1798049	1970-01-01	employee	696	新员工	EMP573495	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
5e53110d-953f-4151-a3e5-803263026d66	1970-01-01	employee	694	新员工	EMP573083	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
9f341cfb-0a4f-45ef-9750-407378b92199	1970-01-01	employee	697	新员工	EMP573684	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
15adc7a6-08f7-4d52-a196-dcfdffeb47f1	1970-01-01	employee	631	沈安梦	E0043	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
8d6444be-77bd-4a3f-8849-b816594cdb13	1970-01-01	employee	664	祁昕	E0076	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
5a6de9b1-f3da-4f19-8b82-9dc2c256456d	1970-01-01	employee	672	靳宸杰	E0084	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
7c778189-52e3-4c6f-a221-c830b2fb511a	1970-01-01	employee	671	颜超轩	E0083	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
126948c8-abfb-4f5f-a28c-d766eba24497	1970-01-01	employee	670	巫超鹏	E0082	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
6087093d-16e2-4281-a701-f0ffdccd0bfa	1970-01-01	employee	669	惠浩萱	E0081	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
d089d64e-d7bf-4053-8bdd-53ce12f296ea	1970-01-01	employee	668	郑杰颖	E0080	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
de91a3a3-2869-45de-b05a-5390ca711b8d	1970-01-01	employee	667	袁丽珂	E0079	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
9bcdefb8-ceff-451b-b9ed-571b025b864a	1970-01-01	employee	666	花豪倩	E0078	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
63ce50b5-3cbc-4e0e-8e36-1dc59c35258c	1970-01-01	employee	665	周珂婉	E0077	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
a17d0c73-6cb9-4e34-ab4d-c1973c2c5203	1970-01-01	employee	663	喻墨敏	E0075	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
840aad2d-218c-468d-978a-3d4abf5bf91d	1970-01-01	employee	662	裘亦	E0074	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
df7a2eb2-ec63-41af-9c5a-4f181ebea2b0	1970-01-01	employee	661	董彬雯	E0073	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
fb41d798-8462-43c0-ae9b-c156e01bef38	1970-01-01	employee	660	应瑾怡	E0072	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
1ad91184-b713-4ec8-9cfe-08f0a2a4aa4c	1970-01-01	employee	659	诸伟婉	E0071	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
f472d599-0a62-4148-b599-70f5384be9c9	1970-01-01	employee	658	解丽欣	E0070	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
cb61a555-e4d2-41a6-b5e1-74fef3e3925e	1970-01-01	employee	657	柏凯浩	E0069	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
10911c23-e3f0-4586-a789-b417b9805148	1970-01-01	employee	656	梅宇悦	E0068	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
0415ae6a-6ab6-4249-875d-454e52c7e4c9	1970-01-01	employee	655	钟皓	E0067	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
9f27a2fe-f207-48d8-a811-2f94fe8f1937	1970-01-01	employee	654	支敏	E0066	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
b4556301-7a90-4092-881b-f897fb728cd7	1970-01-01	employee	653	姜丽轩	E0065	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
6b7b5bba-f30c-4f07-b2bc-c217b54c9565	1970-01-01	employee	652	鲁瑾	E0064	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
ff5d1509-6c7b-457f-b7ab-be2a39f18b9d	1970-01-01	employee	651	霍勇鹏	E0063	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
7128e4f7-c8c3-4b81-8308-a02304ffcbfc	1970-01-01	employee	650	陆轩	E0062	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
9d81d926-09f3-4488-84f0-140272237dfa	1970-01-01	employee	649	薛萱琳	E0061	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
a362a72e-8650-4f59-a0c0-fc9d33c3d676	1970-01-01	employee	648	彭琪桐	E0060	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
303a624b-7ccf-4ace-a05b-60c8ac072b19	1970-01-01	employee	647	左怡轩	E0059	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
58856b3b-377d-48cb-aa0d-f5d90be1d73b	1970-01-01	employee	646	荣琳博	E0058	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
f5f67a8a-9b9d-4935-898f-d5e1dc6d757f	1970-01-01	employee	645	蓝瑶婷	E0057	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
9b209680-c58d-480e-8b0a-0999b060d80f	1970-01-01	employee	644	乌彬鑫	E0056	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
6ee503af-9ac7-4a16-a262-ac1a9592d456	1970-01-01	employee	643	莫瑾宸	E0055	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
9c722cc9-739e-4c2b-98df-b8f28bae10de	1970-01-01	employee	642	魏伟	E0054	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
63bf56d1-3053-422e-82b0-b6d01b739e0c	1970-01-01	employee	641	陈嘉婉	E0053	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
f1a64f85-7d58-47ce-a7f7-e10f297d971f	1970-01-01	employee	640	缪彬	E0052	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
8295fad0-471e-4170-a9d7-d17092101a69	1970-01-01	employee	639	苗勇静	E0051	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
97dc159e-6ca9-4dcf-8cc5-6701349f8201	1970-01-01	employee	638	花瑜	E0050	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
e774725d-938d-407e-bbbe-420c6fe44b4f	1970-01-01	employee	637	倪宸浩	E0049	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
031e7fab-562a-4b55-9d39-a97cf7e5e453	1970-01-01	employee	636	鲁桐珊	E0048	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
555f842b-7579-4807-9f50-320acefc81af	1970-01-01	employee	589	史俊晨	E0001	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
a8280c8d-1292-4c2c-82b2-3c64fdc7fc69	1970-01-01	employee	698	新员工	EMP573870	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
d0906ce0-cd39-4928-a982-ee1a753b5844	1970-01-01	employee	695	新员工	EMP573327	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
37c0d83a-494e-41e6-83ab-767d01db9f37	1970-01-01	employee	635	严强	E0047	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
3a7cdcc5-d19d-462e-9d46-835386fe1217	1970-01-01	employee	634	戴曦	E0046	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
2aba0d2e-ef32-4f33-88f0-9340e3116dd9	1970-01-01	employee	633	车曦军	E0045	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
3fd89637-3b61-459a-873f-5300e1daafb2	1970-01-01	employee	632	郝磊博	E0044	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
d2e290d5-d2fe-4290-888b-06e216a93349	1970-01-01	employee	630	常睿皓	E0042	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
a8adace8-74cf-4147-a175-1773aa14686c	1970-01-01	employee	629	顾琪婷	E0041	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
749c749a-2665-4d84-b550-4880f7367fa8	1970-01-01	employee	628	贺超豪	E0040	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
0e3857c1-a863-4a1e-8bd7-b3b15560b58a	1970-01-01	employee	627	曹宇桐	E0039	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
560e1757-f0cd-4f0d-8458-c71ece9936b0	1970-01-01	employee	626	邹琪轩	E0038	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
4ba6c202-29aa-47de-a25f-a9bc18694c59	1970-01-01	employee	625	富欣瑶	E0037	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
acc357de-870a-405e-b841-5b5035ae511c	1970-01-01	employee	624	巴墨芳	E0036	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
0a3bcb62-ff11-4d8e-8a08-17e52ceb6542	1970-01-01	employee	623	万轩敏	E0035	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
96b1d483-fa2f-4eec-b7e9-32a988cec7c1	1970-01-01	employee	622	韩欣敏	E0034	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
ccbd9428-1cce-45ad-873a-f4075504e459	1970-01-01	employee	621	徐睿宸	E0033	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
2af1615e-e4b3-4178-bdb6-16bcb35e92ea	1970-01-01	employee	620	阮曦颖	E0032	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
cafb70cf-bc17-473c-a447-38716d7772ef	1970-01-01	employee	619	李安	E0031	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
0cf21ea4-87a7-47c8-aa4c-5829ec24544b	1970-01-01	employee	618	倪墨	E0030	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
b8961f82-81fa-461c-9c9b-3323fff1d81b	1970-01-01	employee	617	华浩杰	E0029	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
e51b22a1-2b9e-41ce-b4c0-204ad78ec166	1970-01-01	employee	616	沈萱鹏	E0028	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
2e0678fe-6ce3-4a50-83cc-75818efd5779	1970-01-01	employee	615	闵鑫鑫	E0027	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
35cffe93-0b81-4e9b-a024-065aae3cdea8	1970-01-01	employee	614	任雪彬	E0026	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
b622ef2e-64ea-4364-a0f3-2ea96603980c	1970-01-01	employee	613	唐宇	E0025	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
56c8ce17-86f4-477e-bd59-035320f97588	1970-01-01	employee	612	吴欣超	E0024	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
b4836459-6f4f-4838-ae85-82080444648b	1970-01-01	employee	611	焦梦曦	E0023	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
214e3ace-558d-4b29-bc1e-dcfd3d39ac7c	1970-01-01	employee	610	范皓勇	E0022	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
b251b985-80d9-4312-bbca-ad1f0b02f907	1970-01-01	employee	609	何安静	E0021	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
edeeb22f-4d89-4924-b512-7a5823740d85	1970-01-01	employee	608	臧桐	E0020	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
94c54ed3-4f2c-45f0-98ee-d04d6efe1575	1970-01-01	employee	607	葛雪	E0019	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
e111d358-8cbf-4910-a722-d4ed0ae5d7b0	1970-01-01	employee	606	惠杰	E0018	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
bf59c00e-ee50-4641-98e4-06a22c72f057	1970-01-01	employee	605	徐子	E0017	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
4d2b96d0-2511-4050-9b51-6764d7837e96	1970-01-01	employee	604	山桐梦	E0016	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
44fa4363-945a-4458-9c9b-371be3730fed	1970-01-01	employee	603	龚宇勇	E0015	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
1c2b7a13-a72a-489d-bc9e-ab7e487e770e	1970-01-01	employee	602	柯芳敏	E0014	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
bfc2f2b5-eac3-488c-a61b-09667ef03ab5	1970-01-01	employee	601	郁雪超	E0013	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
47f18c65-50ed-4903-983c-76927a7689a3	1970-01-01	employee	600	杜桐	E0012	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
53943fc0-d0d6-4c8c-b4d3-77c07122da6b	1970-01-01	employee	599	萧勇欣	E0011	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
1cd6b36a-141c-4b12-aef2-138023dc600b	1970-01-01	employee	598	封瑶晨	E0010	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
6facd754-eb61-40dc-bb2a-ce3191850051	1970-01-01	employee	597	储宇雪	E0009	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
43e3b280-eb34-4573-896f-425b157625ef	1970-01-01	employee	596	曲豪珂	E0008	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
71d83b95-1659-4894-9841-7c282517710d	1970-01-01	employee	595	巫涵	E0007	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
51ac8d92-7e21-427a-9fcd-d46849a40f0f	1970-01-01	employee	594	宣睿	E0006	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
dfaf30fc-6a78-4838-8754-4388a13fd83b	1970-01-01	employee	593	禹怡军	E0005	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
2cf52ba2-221e-40b5-b3c9-452c89c87074	1970-01-01	employee	592	傅凯妍	E0004	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
fcbd1c01-26f0-4bb4-954f-94eb6984cbd0	1970-01-01	employee	591	应军超	E0003	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
ccde8f25-0127-4b26-9caf-fc0b3c58272b	1970-01-01	employee	590	王安桐	E0002	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:53:48.835691+00	2026-01-16 20:53:48.835691+00
536b3f9a-10b5-4be1-b1ad-c67b524704ad	2026-01-17	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:54:30.835224+00	2026-01-16 20:54:30.835224+00
6412907d-c01b-4968-950b-4209fb5220d4	2026-01-17	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:57:34.464583+00	2026-01-16 20:57:34.464583+00
fd59321e-0228-4832-b5df-5a83574baa2a	2026-01-17	temp	\N	\N	EMP177340	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:56:26.212833+00	2026-01-16 20:56:26.212833+00
a511aa69-421a-4d90-924a-fc77dea1139e	2026-01-17	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	9	\N	2026-01-16 20:57:35.462426+00	2026-01-16 20:57:35.462426+00
3c9a215b-1b43-44c1-a952-22e121d1e506	2026-01-17	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	t	0	\N	2026-01-16 20:56:51.232268+00	2026-01-16 20:56:51.232268+00
24e5482c-ad7e-4137-8700-c9c4fef54451	2026-01-17	employee	612	吴欣超	E0030	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 22:16:13.615+00
12fb2ac9-a197-4116-8872-a3a2c0bbe55c	2026-01-25	employee	730	李安	E0031	\N	\N	\N	人力资源部	8e44af22-4f60-4ed1-b9b0-5325dae19640	白班	09:00:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	f	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
e34ea45e-4928-42fa-a384-ee69934aeb70	2026-01-25	employee	723	吴欣超	E0024	\N	\N	\N	人力资源部	8e44af22-4f60-4ed1-b9b0-5325dae19640	白班	09:00:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	f	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
3ab347f4-c725-459b-8c00-f929b5d3849d	2026-01-25	employee	729	倪墨	E0030	\N	\N	\N	人力资源部	7d33d5eb-b902-493f-b2ca-6513d3feb19a	晚班	07:30:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	t	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
39ab9cc3-a8be-4d48-a8c8-cae618f9c9e7	2026-01-24	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 15:50:01.739506+00	2026-01-24 15:50:01.739506+00
4dd264e5-982d-456b-9f72-03d616730bb1	2026-01-24	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 15:50:01.918456+00	2026-01-24 15:50:01.918456+00
4f4c741c-12f1-4a5d-a673-b0cf9865dc70	2026-01-24	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 15:50:02.112221+00	2026-01-24 15:50:02.112221+00
08e9ac40-efc6-4d93-8498-c4ea41f746fb	2026-01-24	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 15:50:04.072597+00	2026-01-24 15:50:04.072597+00
eb0d23a0-685a-4dee-b378-8f4914481538	2026-01-24	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 15:50:04.310347+00	2026-01-24 15:50:04.310347+00
daff23e5-a0fb-480e-b276-c07846d46879	2026-01-24	temp	\N	\N	\N	临时工	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 15:50:04.541971+00	2026-01-24 15:50:04.541971+00
d5eabcc6-621b-4fab-bfa6-eae29479dc48	2026-01-25	employee	756	蓝瑶婷	E0057	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
73817e45-8353-4e7a-a9c2-2a59342ea20f	2026-01-25	employee	700	史俊晨	E0001	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
49e7f895-fb06-462f-a639-47cbe92813db	2026-01-25	employee	745	戴曦	E0046	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
d6837b65-99f2-4465-851e-50fd8816aada	2026-01-25	employee	785	洪悦妍	E0086	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
8ec2ff23-fcbf-40ea-962b-0df25f678f13	2026-01-25	employee	765	支敏	E0066	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
1a317def-ab29-4928-a51a-80f276a27f3e	2026-01-25	employee	786	米瑾梦	E0087	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
4e4c025c-ec67-4f53-9c72-67fde51ca5ea	2026-01-25	employee	733	韩欣敏	E0034	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
318db9f4-20a4-4f63-908e-b92eec47c767	2026-01-25	employee	706	巫涵	E0007	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
c3b33cc1-d1d2-481d-853e-452f599d9ae5	2026-01-25	employee	774	喻墨敏	E0075	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
d0b93cdb-632a-4f0f-9b94-11cfea718ada	2026-01-25	employee	714	龚宇勇	E0015	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
61ebd4fb-5de1-4ec0-a2f4-322c20a0f6c4	2026-01-17	employee	673	安博	E0085	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	t	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 22:03:08.373+00
a560accc-fdc3-4315-81a3-2e4de4951eda	2026-01-17	employee	604	山桐梦	E0016	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-16 20:50:58.836023+00	2026-01-16 22:00:29.637+00
ecf98d8b-9fa0-40a2-b2cd-a9d3d6549670	2026-01-25	employee	779	郑杰颖	E0080	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
0a6c8a8c-d425-4896-b86d-7e6b6c999448	2026-01-25	employee	738	曹宇桐	E0039	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
39677d59-35f2-4fa3-9dcb-605dede1dbf5	2026-01-25	employee	763	鲁瑾	E0064	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
e8bc673a-b5ea-4cd1-8833-0cc2c1e57057	2026-01-25	employee	752	陈嘉婉	E0053	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
46dc45e0-45b1-411a-8c9f-aaf0ea459b05	2026-01-25	employee	777	花豪倩	E0078	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
a336fd2d-fb0b-4894-b74b-ea60ede9a81f	2026-01-25	employee	796	单杰悦	E0097	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
97766601-4d99-4a42-988a-f860815c218a	2026-01-25	employee	705	宣睿	E0006	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
b8723479-0244-41ad-9027-b5001250875b	2026-01-25	employee	727	沈萱鹏	E0028	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
7f64841b-bffe-41e1-bc55-305d832f91fe	2026-01-25	employee	781	巫超鹏	E0082	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
fcfe6eb5-8b17-4b55-95dd-bf7b13fa8415	2026-01-25	employee	741	常睿皓	E0042	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
fcf37924-7fb8-4936-945b-ce655f67659e	2026-01-25	employee	712	郁雪超	E0013	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
dc6176ff-a2bc-4c44-adb1-d7ad8fbb3b57	2026-01-25	employee	737	邹琪轩	E0038	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
e36652db-3afa-4881-ad2b-246cb3a9645b	2026-01-25	employee	770	诸伟婉	E0071	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
63f85bed-cf0a-4473-b7ad-aef6f31b24c1	2026-01-25	employee	782	颜超轩	E0083	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
3712a479-37ee-4788-95e0-2e83aa70365a	2026-01-25	employee	748	倪宸浩	E0049	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
c340ff47-447e-431c-b40f-82125054fb10	2026-01-25	employee	719	臧桐	E0020	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
55bea9b4-d074-401b-9685-1b686104b66f	2026-01-25	employee	789	宋娜婉	E0090	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
059832a7-7c3d-4f0f-b63c-8181b1861e72	2026-01-25	employee	718	葛雪	E0019	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
acae9aa8-4731-432f-8b2b-19c61158bbdb	2026-01-25	employee	775	祁昕	E0076	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
9bbfeb14-c7bb-40f6-af5c-ea2d92148eb9	2026-01-25	employee	701	王安桐	E0002	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
881013bf-c15e-438e-83ce-ea7f2f6f849e	2026-01-25	employee	736	富欣瑶	E0037	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
bb7fee99-c760-4a10-8a24-6ffe08755d1c	2026-01-25	employee	704	禹怡军	E0005	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
c6e5f95a-ba42-4fb0-a96e-3c9d7dfc146d	2026-01-25	employee	758	左怡轩	E0059	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
2ecfe286-c7a6-4dbf-ae2f-1ff28593156d	2026-01-25	employee	755	乌彬鑫	E0056	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
0bb42e36-6e6b-444e-9313-a39a70201b1a	2026-01-25	employee	739	贺超豪	E0040	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
ba16935e-ca6f-4f5d-bab0-44e5f16ff7d2	2026-01-25	employee	728	华浩杰	E0029	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
6265c70a-a311-4bf9-bd7f-402a97069f05	2026-01-25	employee	722	焦梦曦	E0023	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
5ae5b1db-8cdf-4a91-8394-c4b5307d42b8	2026-01-25	employee	725	任雪彬	E0026	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
08b55089-601c-4251-9f4a-4d76ec3c14a4	2026-01-25	employee	744	车曦军	E0045	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
c308c370-c3dc-4ae6-a391-d843fefcbdfc	2026-01-25	employee	707	曲豪珂	E0008	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
4f480891-dce3-4ebd-bbbc-7e72195223c2	2026-01-25	employee	732	徐睿宸	E0033	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
3f700771-f2bb-4327-b26c-8e8cfc753948	2026-01-25	employee	762	霍勇鹏	E0063	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
9bc63143-8f96-46a3-9a6a-58a23b546d10	2026-01-25	employee	751	缪彬	E0052	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
7ede9ec6-50a5-47eb-8326-68f93ee163ed	2026-01-25	employee	709	封瑶晨	E0010	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
fc7ec743-d3d8-4833-bcdd-7c06391b4fb3	2026-01-25	employee	708	储宇雪	E0009	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
b011baa6-4c11-488a-808e-10e07eef9239	2026-01-25	employee	795	魏瑜墨	E0096	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
ca1ec3ca-2927-410c-b54f-e69b1d9183cc	2026-01-25	employee	717	惠杰	E0018	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
a669e16f-35d5-4e6d-b0a0-eda6184b9484	2026-01-25	employee	710	萧勇欣	E0011	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
7fa30196-aeda-4957-9b2d-fc7893b8a3c9	2026-01-25	employee	799	惠晨丽	E0100	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
69c6643a-2533-44ac-9f67-9aa2ad1396ca	2026-01-25	employee	767	梅宇悦	E0068	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
44f59306-e909-456e-ae5b-0bf02a66e3ba	2026-01-25	employee	702	应军超	E0003	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
859f25b5-7b7f-410e-9e37-1dbb9724cdab	2026-01-25	employee	750	苗勇静	E0051	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
4f538093-43bd-4e22-b62d-308eade50d2e	2026-01-25	employee	721	范皓勇	E0022	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
83c51bdf-ab70-4d8e-9b03-6e3856408a7e	2026-01-25	employee	742	沈安梦	E0043	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
91e2e976-9250-44f4-8f07-c4e59aa70bdf	2026-01-25	employee	724	唐宇	E0025	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
9561364e-4dd6-46ac-88a1-45ea405e73d7	2026-01-25	employee	764	姜丽轩	E0065	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
97065b45-d104-44e2-a1ed-256c62b732db	2026-01-25	employee	761	陆轩	E0062	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
8ff99197-0e5d-4a0e-adee-f41b1307a241	2026-01-25	employee	703	傅凯妍	E0004	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
76c22aec-cb08-4303-94ec-17bb4dc0dbda	2026-01-25	employee	735	巴墨芳	E0036	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
26e41ba3-c88d-4169-ad76-1ac7d129cd94	2026-01-25	employee	778	袁丽珂	E0079	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
99f0101a-7132-4546-bb52-5beb18677a44	2026-01-25	employee	734	万轩敏	E0035	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
76a6e887-e76b-42cb-a4d4-177be6c56cb2	2026-01-25	employee	794	齐娜妍	E0095	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
8e8fae1f-4727-4995-8cb7-c6fc2d31a955	2026-01-25	employee	713	柯芳敏	E0014	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
9d469ebc-5d23-4eb9-8fbc-818b9ae05fcc	2026-01-25	employee	769	解丽欣	E0070	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
08a4d611-93d3-44f2-b9c3-dff510ad93e7	2026-01-25	employee	720	何安静	E0021	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
b4176f09-1ff6-4dbd-bb76-84ec3f72feec	2026-01-25	employee	766	钟皓	E0067	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
b8aea454-8ee8-45a9-af79-515e8c74e650	2026-01-25	employee	726	闵鑫鑫	E0027	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
742dbdbc-cd27-44e5-9f8c-1c0faa83717e	2026-01-25	employee	754	莫瑾宸	E0055	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
68ed4877-4af5-477d-bda2-afb31a566e76	2026-01-25	employee	791	车鹏睿	E0092	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
ef71367d-f6a2-4af0-b811-c836ece4d125	2026-01-25	employee	793	宣睿婷	E0094	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
994480e6-9efd-4b62-bc71-aaf579425120	2026-01-25	employee	768	柏凯浩	E0069	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
408e1e44-9456-4202-a698-56ac8252f7ff	2026-01-25	employee	743	郝磊博	E0044	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
50445f85-e638-42fd-93ed-96613d6f3467	2026-01-25	employee	780	惠浩萱	E0081	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
b39c7a56-ca46-453c-a198-b75b729e57f3	2026-01-25	employee	760	薛萱琳	E0061	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
2fdfb550-7dd5-4f21-9c61-e26064097161	2026-01-25	employee	790	黄皓宸	E0091	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
8363f73c-5115-46e2-af7a-180bb01dd31a	2026-01-25	employee	747	鲁桐珊	E0048	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
f08e665b-238c-4fd4-85c2-02cfb76086a8	2026-01-25	employee	771	应瑾怡	E0072	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
3426e42d-d323-44ac-b2d0-bd8e428c503e	2026-01-25	employee	731	阮曦颖	E0032	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
0df4244e-bc10-49f3-a036-05bfea1029d8	2026-01-25	employee	746	严强	E0047	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
9a6e3520-66e5-4cb2-a1b6-a60029c4ea20	2026-01-25	employee	797	翁涵	E0098	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
f78d465a-64e5-4521-a501-50ff3d8ca4e2	2026-01-25	employee	776	周珂婉	E0077	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
53b98873-110a-4711-bae5-3e35d170c6e4	2026-01-25	employee	787	马安瑾	E0088	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
f8457ce7-d9d2-4f18-a500-68640be2ac89	2026-01-25	employee	716	徐子	E0017	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
c6283cbb-2c73-45bd-acca-f327e3bc2e10	2026-01-25	employee	753	魏伟	E0054	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
801e125b-fe2d-422f-96cd-85eaa016a6d1	2026-01-25	employee	757	荣琳博	E0058	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
80d8fbf8-30ed-45fa-9c56-487db7d7dbe7	2026-01-25	employee	783	靳宸杰	E0084	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
52a0d1cc-0040-44eb-bbbb-131124e4589e	2026-01-25	employee	773	裘亦	E0074	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
9afdaeb9-9ea3-4bef-9b2a-0902d365f714	2026-01-25	employee	798	童杰敏	E0099	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
c3073e49-0c24-4fa1-978e-ae0e21b16ef8	2026-01-25	employee	711	杜桐	E0012	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
03c09210-b19f-408c-aa3f-6ffc3b1f282a	2026-01-25	employee	749	花瑜	E0050	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
55557477-a418-47e4-83f6-c1b89f2049cd	2026-01-25	employee	740	顾琪婷	E0041	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
2696b99a-1a09-42ba-8121-a0797039c9df	2026-01-25	employee	792	余涵萱	E0093	\N	\N	\N	人力资源部	7d33d5eb-b902-493f-b2ca-6513d3feb19a	晚班	07:30:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	t	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
68934a0b-5ea2-4a2e-88b5-b5f79b1876c8	2026-01-25	employee	784	安博	E0085	\N	\N	\N	人力资源部	8e44af22-4f60-4ed1-b9b0-5325dae19640	白班	09:00:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	f	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
f1c3ec1a-0a40-41c1-8952-306aed5e8740	2026-01-25	employee	715	山桐梦	E0016	\N	\N	\N	人力资源部	8e44af22-4f60-4ed1-b9b0-5325dae19640	白班	09:00:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	f	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
c851c408-1f5d-4176-a928-11f7bd090bbb	2026-01-25	employee	759	彭琪桐	E0060	\N	\N	\N	人力资源部	8e44af22-4f60-4ed1-b9b0-5325dae19640	白班	09:00:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	f	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
ec0a93d3-72e1-4d00-afde-bdf8b09e1ef8	2026-01-25	employee	788	林雯琪	E0089	\N	\N	\N	人力资源部	8e44af22-4f60-4ed1-b9b0-5325dae19640	白班	09:00:00	17:30:00	f	0	0	0	{08:31/12:00/13:00/18}	f	f	f	f	30	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
9a6814f9-a095-4161-904d-c2acf0d6ee46	2026-01-25	employee	772	董彬雯	E0073	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-24 17:48:22.447118+00	2026-01-24 17:48:22.447118+00
f8598de2-25c2-4d43-904e-74819abb2ac7	2026-01-28	employee	802	新员工	EMP330625	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
0b3b93d2-f274-4a9c-b487-68fedeff9b49	2026-01-28	employee	801	林	EMP586274	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
db7f093e-4177-456d-b4a6-bc35b06084ef	2026-01-28	employee	756	蓝瑶婷	E0057	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
89160016-dcdf-4cc1-8e29-22cc98266031	2026-01-28	employee	700	史俊晨	E0001	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
f08e709c-69f0-4a5f-b3f9-2acb3f40ecbb	2026-01-28	employee	745	戴曦	E0046	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
067dffef-0bf2-4e2f-91e1-494cc02de94a	2026-01-28	employee	785	洪悦妍	E0086	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
05a0c513-bd5a-440c-9f7c-4c5bf1559d32	2026-01-28	employee	765	支敏	E0066	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
a55f8162-b98b-455f-8300-e745b774dddf	2026-01-28	employee	786	米瑾梦	E0087	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
725efc02-130c-458f-a6f0-00d123a23e5c	2026-01-28	employee	733	韩欣敏	E0034	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
e9e65ecf-e9b9-4ed7-9d92-f98d1e67bc66	2026-01-28	employee	706	巫涵	E0007	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
c3bdb6d0-400f-4140-a42d-f9282c274642	2026-01-28	employee	774	喻墨敏	E0075	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
f7cbc7a6-b64b-40b0-9977-209cfa4c3fc6	2026-01-28	employee	714	龚宇勇	E0015	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
63e4a83e-3257-4b4d-b6dd-8f74b8432e83	2026-01-28	employee	779	郑杰颖	E0080	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
ea58d76d-f707-4bc2-a728-e47da9661096	2026-01-28	employee	738	曹宇桐	E0039	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
61ca8537-e018-41a8-a448-915b06927d9b	2026-01-28	employee	763	鲁瑾	E0064	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
b4e3ba0e-8050-4b77-a58f-650a179d50f7	2026-01-28	employee	752	陈嘉婉	E0053	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
8f2f8e44-c30a-469b-8a7d-2ee3aab177ac	2026-01-28	employee	777	花豪倩	E0078	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
1106d6b3-1d5c-4eb1-aa98-682f62d8e51c	2026-01-28	employee	796	单杰悦	E0097	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
3350c88f-59cc-4ce6-bb17-29450f4e0eaa	2026-01-28	employee	705	宣睿	E0006	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
b49fd261-80b7-4089-9385-15720787b244	2026-01-28	employee	727	沈萱鹏	E0028	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
4ca0b8f5-f706-4d61-9c3e-bd8f71722f6a	2026-01-28	employee	781	巫超鹏	E0082	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
fc59ddde-da36-4d88-b3f2-3d9fcb22cb0b	2026-01-28	employee	741	常睿皓	E0042	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
ee0526ce-402c-476e-bb6a-179f53f68eeb	2026-01-28	employee	729	倪墨	E0030	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
3cce7866-9596-4a73-9ed6-cd5edc41782a	2026-01-28	employee	730	李安	E0031	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
b561d470-67fd-4b79-90b4-12d7b6a3234c	2026-01-28	employee	800	你	EMP339009	\N	\N	\N	待分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
dda33ab1-8272-48b7-a889-ea9a7814eeb2	2026-01-28	employee	712	郁雪超	E0013	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
a2ce3baa-38d8-4ce1-b9d3-d68332d9a34c	2026-01-28	employee	723	吴欣超	E0024	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
0a831d05-a67e-43c0-b23a-87ccbf135ed4	2026-01-28	employee	737	邹琪轩	E0038	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
d63ce322-4036-4ad2-a0fc-f6123008cdd6	2026-01-28	employee	770	诸伟婉	E0071	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
7bb4cebd-ac05-4438-be0d-483391f1d82e	2026-01-28	employee	782	颜超轩	E0083	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
2888bc83-aa91-42be-a69d-56981ca602bd	2026-01-28	employee	748	倪宸浩	E0049	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
dfb2f00b-99a7-484c-acaf-cbc2278e37cb	2026-01-28	employee	719	臧桐	E0020	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
36b19797-3f7a-467a-bbd6-eada00ff099f	2026-01-28	employee	789	宋娜婉	E0090	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
fc6395c0-fe14-4774-9a97-a50d8b70d7ab	2026-01-28	employee	718	葛雪	E0019	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
b17a61c4-b5a2-49e0-ab80-fa3410c36e7c	2026-01-28	employee	775	祁昕	E0076	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
80d09c00-1e64-4028-be07-86cc9a81223b	2026-01-28	employee	759	彭琪桐	E0060	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
329039ee-42e3-4058-bd89-0086f30b93b3	2026-01-28	employee	701	王安桐	E0002	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
373471f7-daf9-4264-901d-7b2716d4683e	2026-01-28	employee	736	富欣瑶	E0037	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
e9670648-d1fc-436e-8fd5-c20ee672ad80	2026-01-28	employee	704	禹怡军	E0005	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
ab7a7161-6249-41a2-922d-8028cf61f67d	2026-01-28	employee	755	乌彬鑫	E0056	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
bd4dfab1-b0a5-4b35-b9a0-07f9ec8ef8a7	2026-01-28	employee	758	左怡轩	E0059	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
bdc396ab-f4ac-4233-8bad-11212cd00ee5	2026-01-28	employee	739	贺超豪	E0040	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
05f56a16-3711-49c1-856f-6a49706fb3bc	2026-01-28	employee	728	华浩杰	E0029	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
1382a117-8b00-451c-a18b-f46b4217cb91	2026-01-28	employee	722	焦梦曦	E0023	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
1a4cab74-55a2-456c-906e-4605e093f6ac	2026-01-28	employee	725	任雪彬	E0026	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
b4525d35-d369-4f93-a8af-f31794d19658	2026-01-28	employee	744	车曦军	E0045	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
8f687cf3-88b5-4a18-9be7-caf8d59f89b8	2026-01-28	employee	707	曲豪珂	E0008	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
1a751510-1243-4677-9270-d0ee48c54674	2026-01-28	employee	732	徐睿宸	E0033	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
20d92b87-1c7c-4ebd-b9ba-621601bed7fd	2026-01-28	employee	762	霍勇鹏	E0063	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
9accf8c7-acfa-4df6-a146-6ebe96d2d228	2026-01-28	employee	751	缪彬	E0052	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
0cffe458-1d85-4727-8ed7-1467e7200b82	2026-01-28	employee	709	封瑶晨	E0010	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
9ee21ff3-023f-444e-89d3-ab75a6f2faab	2026-01-28	employee	708	储宇雪	E0009	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
72e52e36-daff-4a55-bbf0-93ae7efcb97b	2026-01-28	employee	795	魏瑜墨	E0096	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
b3e61bfd-f281-4bc5-9aa8-56268b7582cb	2026-01-28	employee	710	萧勇欣	E0011	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
6d69104c-f994-47fc-b622-ddb934ef2d3f	2026-01-28	employee	717	惠杰	E0018	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
fdf3acc1-d4fb-4610-ada0-0e437254c711	2026-01-28	employee	799	惠晨丽	E0100	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
934caa39-1695-4b96-bded-cd23300f5bbd	2026-01-28	employee	767	梅宇悦	E0068	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
048b9dc5-5c54-47ef-b64c-e55368dba315	2026-01-28	employee	702	应军超	E0003	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
7f923158-3a69-4f52-be1e-25ccfc50193a	2026-01-28	employee	750	苗勇静	E0051	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
438d3828-a1f7-4cd3-abc7-37a10eb2f6a3	2026-01-28	employee	721	范皓勇	E0022	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
a0879e7c-3fe1-4ff8-83de-74ae78701913	2026-01-28	employee	742	沈安梦	E0043	\N	\N	\N	销售部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
0c28683f-1994-4710-8764-77f888aac612	2026-01-28	employee	724	唐宇	E0025	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
e6bbc80b-4f3b-4524-b28b-1958fdc2063a	2026-01-28	employee	788	林雯琪	E0089	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
6b5e3632-caa1-4c53-9bc5-b46a22e08ab8	2026-01-28	employee	764	姜丽轩	E0065	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
81431651-057e-4f97-8d3c-7be2d8f3d393	2026-01-28	employee	703	傅凯妍	E0004	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
ed7f8fec-c95a-47b9-b780-70a11eb4dcd5	2026-01-28	employee	761	陆轩	E0062	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
137b0056-0b60-4c59-9027-90a73a598a3b	2026-01-28	employee	735	巴墨芳	E0036	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
9b7460f2-42dc-4a7f-99fa-231c9d67d1e2	2026-01-28	employee	778	袁丽珂	E0079	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
a37517be-fe1f-4f7a-ad7d-a326c733443b	2026-01-28	employee	715	山桐梦	E0016	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
cdd2bbae-b559-49f4-ad70-6ce91184703b	2026-01-28	employee	734	万轩敏	E0035	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
0cbb0300-f37c-4d33-9354-b47146e5687d	2026-01-28	employee	794	齐娜妍	E0095	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
434de5ec-6ea6-4702-890c-9c3226898b3a	2026-01-28	employee	713	柯芳敏	E0014	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
53db76c4-2e97-4a6d-b7ad-db998e4e5a91	2026-01-28	employee	720	何安静	E0021	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
dfe44c2d-35a7-4879-b375-b5f0396cf50c	2026-01-28	employee	769	解丽欣	E0070	\N	\N	\N	质量管理部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
3ac27905-7c13-46df-b04a-5feed356e79a	2026-01-28	employee	766	钟皓	E0067	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
5dd69b50-391e-4244-b588-35bec78695b4	2026-01-28	employee	726	闵鑫鑫	E0027	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
914b819e-0cc0-4e4d-8124-35e898b5864d	2026-01-28	employee	754	莫瑾宸	E0055	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
cfd59efe-839c-4c1f-ade2-0ded85a225fb	2026-01-28	employee	791	车鹏睿	E0092	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
fc73c7a7-b18d-437e-904c-4b9a3461ae07	2026-01-28	employee	793	宣睿婷	E0094	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
6c602759-5578-4317-8569-9226bb161bc4	2026-01-28	employee	768	柏凯浩	E0069	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
202c4ac6-7407-4c8d-8f25-d45730ad056f	2026-01-28	employee	743	郝磊博	E0044	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
05508807-10fa-4f57-b53d-2f1fcbaa58f7	2026-01-28	employee	760	薛萱琳	E0061	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
58574e25-0a43-434f-a504-16f45847b32a	2026-01-28	employee	780	惠浩萱	E0081	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
b66084e2-fdc0-4ab7-97fa-5d663d880e21	2026-01-28	employee	790	黄皓宸	E0091	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
35ee5ff4-8aa9-46e1-ba24-fe5921a1ae9e	2026-01-28	employee	747	鲁桐珊	E0048	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
be37ab1b-5384-4872-b795-9f1250278e02	2026-01-28	employee	771	应瑾怡	E0072	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
a8dd3e3e-25e2-4664-9a3f-2c27efdddae9	2026-01-28	employee	731	阮曦颖	E0032	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
a876c87c-4c2e-43b7-bdb0-79e7f2e2c872	2026-01-28	employee	746	严强	E0047	\N	\N	\N	生产部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
14f90d4e-99ef-4f32-a649-5de4d1022b82	2026-01-28	employee	797	翁涵	E0098	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
33898597-52fa-438e-aac1-69aa16703783	2026-01-28	employee	776	周珂婉	E0077	\N	\N	\N	采购部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
47e80cd1-f1c9-432e-af67-786845915659	2026-01-28	employee	787	马安瑾	E0088	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
da143322-31fc-4490-935b-225210864520	2026-01-28	employee	716	徐子	E0017	\N	\N	\N	研发部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
19fbf676-b3da-443b-ad62-925ea9463c26	2026-01-28	employee	792	余涵萱	E0093	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
fb25cb9c-c7a8-4db8-8391-68cb3b0ff5a0	2026-01-28	employee	784	安博	E0085	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
e828aae8-fc41-414c-9869-0bdc58537416	2026-01-28	employee	753	魏伟	E0054	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
9b4c5935-ab60-42a8-accd-734481cfc2e4	2026-01-28	employee	757	荣琳博	E0058	\N	\N	\N	设备维护部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
05c928a8-37c8-4964-9985-4565cc519e8c	2026-01-28	employee	773	裘亦	E0074	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
398fa4a0-0a7b-4ef8-9b4d-35f6cb758ce3	2026-01-28	employee	783	靳宸杰	E0084	\N	\N	\N	客服部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
971b2193-e69f-408b-931c-48d2428e0d2c	2026-01-28	employee	798	童杰敏	E0099	\N	\N	\N	财务部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
2918ac8e-067f-4fc1-afaf-e246f76f93bb	2026-01-28	employee	711	杜桐	E0012	\N	\N	\N	行政部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
30ef9f0e-6e30-471c-af13-79f929e74c35	2026-01-28	employee	749	花瑜	E0050	\N	\N	\N	仓储物流部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
7e5a97df-075a-4c9c-bf9f-d4f9eac345e6	2026-01-28	employee	772	董彬雯	E0073	\N	\N	\N	人力资源部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
bf8502fd-fdcd-40e8-97a8-226c92475d8f	2026-01-28	employee	740	顾琪婷	E0041	\N	\N	\N	信息化/IT部	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-27 20:46:55.19211+00	2026-01-27 20:46:55.19211+00
859d870e-c148-481f-baa9-e87735dc0d30	2026-01-29	employee	802	新员工	EMP330625	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
1edadb61-2f3d-404f-bac7-00ed9f303028	2026-01-29	employee	734	万轩敏	E0035	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
2cb72ca1-cda1-4061-91bc-91bfc1b03e36	2026-01-29	employee	733	韩欣敏	E0034	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
0a9c318f-8248-44fb-a5ad-4f01b8e8d825	2026-01-29	employee	732	徐睿宸	E0033	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
68bcb1c4-54f6-4163-82e9-9844ee1e4759	2026-01-29	employee	731	阮曦颖	E0032	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
1253165e-0b10-4fce-bad5-3b32cfc901c3	2026-01-29	employee	730	李安	E0031	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
417fcf84-d7f2-4668-8ff3-f21afa3fc7fd	2026-01-29	employee	729	倪墨	E0030	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
ba6f9c09-436c-431c-9392-924d03b5b54d	2026-01-29	employee	728	华浩杰	E0029	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
8ae92d50-b00c-4a15-9483-aad7714bd68b	2026-01-29	employee	727	沈萱鹏	E0028	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
5e640627-ed4f-4afe-81fd-cc7dbd547e22	2026-01-29	employee	726	闵鑫鑫	E0027	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
670e4e49-3555-47b2-8de7-0b110c82bfc2	2026-01-29	employee	725	任雪彬	E0026	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
e00f2f69-3f69-408b-83c3-50e1cbe7ef6b	2026-01-29	employee	724	唐宇	E0025	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
4bf53fde-bddd-4fca-8fb5-a4242ee27604	2026-01-29	employee	723	吴欣超	E0024	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
6f71bd0c-105e-4b91-8de4-109812456da3	2026-01-29	employee	722	焦梦曦	E0023	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
19b53d6f-15df-4432-9b7c-4a779cfe7181	2026-01-29	employee	721	范皓勇	E0022	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
8480d979-3d83-4b8b-9fad-745b0032a2f6	2026-01-29	employee	720	何安静	E0021	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
6f430553-eb3c-4f0b-a55f-0016376023cf	2026-01-29	employee	719	臧桐	E0020	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
3738698f-fcf6-40f1-a60f-e02fbb349f24	2026-01-29	employee	718	葛雪	E0019	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
cf941c20-4243-4788-95e7-73d806ad45c4	2026-01-29	employee	717	惠杰	E0018	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
9a83cc3e-fd5d-48ec-9c6b-41a8c3fcd937	2026-01-29	employee	715	山桐梦	E0016	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
4394c60c-1024-404f-a0b5-d5283d262221	2026-01-29	employee	714	龚宇勇	E0015	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
ea67dc5a-6be6-4a93-bedd-ed85f14308c2	2026-01-29	employee	713	柯芳敏	E0014	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
84fd5a1a-b547-47f3-99b5-ea371e4c4ac4	2026-01-29	employee	712	郁雪超	E0013	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
f26b0cef-9bc1-415f-a1e6-ef093d2d9d9e	2026-01-29	employee	711	杜桐	E0012	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
a921dffa-8ba1-4e78-bb72-5a5777543c98	2026-01-29	employee	710	萧勇欣	E0011	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
daa85b19-4d89-457b-921a-553d0df2843c	2026-01-29	employee	709	封瑶晨	E0010	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
127c7bc5-3165-480c-96bd-877d4a631655	2026-01-29	employee	708	储宇雪	E0009	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
10268164-9b37-4584-9413-7d6000f0bd92	2026-01-29	employee	707	曲豪珂	E0008	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
0d16969b-928b-42c9-b578-f08805067e08	2026-01-29	employee	706	巫涵	E0007	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
5eea782d-d6ea-42a0-be19-cdafe389b982	2026-01-29	employee	705	宣睿	E0006	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
d0d17f45-3164-451d-a553-24c6c73149a5	2026-01-29	employee	704	禹怡军	E0005	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
bf70e9b0-057a-4e87-8914-c472f93b2de3	2026-01-29	employee	703	傅凯妍	E0004	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
ac039f6f-3669-4d75-a4bf-e9e40a5a1fc2	2026-01-29	employee	702	应军超	E0003	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
75a8457c-c26f-445c-802e-56dc8a83876c	2026-01-29	employee	701	王安桐	E0002	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
f03ff27f-1f2d-46cd-a0fa-27f629a4b51c	2026-01-29	employee	700	史俊晨	E0001	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
bf4f68f7-5acb-4f06-bf43-c72ce03c1460	2026-01-29	employee	799	惠晨丽	E0100	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
5a7ea6d3-6e97-41d9-b1a9-d0bfab1fca6d	2026-01-29	employee	798	童杰敏	E0099	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
e53456e9-7aa9-4030-bb40-05ba4aec449d	2026-01-29	employee	797	翁涵	E0098	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
30e0cb42-64d2-4727-a914-8ea5e5298286	2026-01-29	employee	790	黄皓宸	E0091	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
d6d73024-c546-4af0-a8b9-df5052fa6260	2026-01-29	employee	789	宋娜婉	E0090	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
6c88b369-b774-4afa-a96c-e7a138483582	2026-01-29	employee	788	林雯琪	E0089	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
990588df-04d9-435a-ae26-f0af90a01aa8	2026-01-29	employee	786	米瑾梦	E0087	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
123fb135-c0be-4bea-9236-474627337d9c	2026-01-29	employee	785	洪悦妍	E0086	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
7e4d34c0-eb3e-4672-b0e3-2d8ac1e79060	2026-01-29	employee	784	安博	E0085	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
a5b88079-21d8-4ac4-9d6e-cef5dc235473	2026-01-29	employee	783	靳宸杰	E0084	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
fdf85b6d-4322-43d6-bc6b-0fbc758eb3db	2026-01-29	employee	782	颜超轩	E0083	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
f2b58dfd-b9a7-4275-8b6c-7b0c21897b35	2026-01-29	employee	781	巫超鹏	E0082	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
9782d712-3ec2-4237-b275-874d61997738	2026-01-29	employee	780	惠浩萱	E0081	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
a222c471-2438-41f2-8b17-fd35fe53ce7d	2026-01-29	employee	779	郑杰颖	E0080	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
1e41c3f2-3d4e-44e3-90e1-da569b5ae654	2026-01-29	employee	778	袁丽珂	E0079	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
5c88ab5f-47bf-43e4-9383-7117c70cb1dd	2026-01-29	employee	777	花豪倩	E0078	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
861e9d35-2a96-44c6-b8f0-2e1ebf43808a	2026-01-29	employee	776	周珂婉	E0077	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
48e8bedf-047d-405b-a8b8-71fbf2cc7281	2026-01-29	employee	775	祁昕	E0076	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
b4972af3-a19d-4ad4-b02e-bd85e916c945	2026-01-29	employee	774	喻墨敏	E0075	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
91c78fef-0d1b-40a9-b83c-e6d7801b9bc5	2026-01-29	employee	773	裘亦	E0074	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
666bfedd-cb5a-480a-b3f1-31dee06a3833	2026-01-29	employee	772	董彬雯	E0073	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
9cec412b-d686-40c3-af19-616aecd30b7c	2026-01-29	employee	771	应瑾怡	E0072	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
3111cb66-8dba-44cd-a76a-94da4b1d7c7a	2026-01-29	employee	770	诸伟婉	E0071	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
dc558ac6-67fa-4779-8fe0-03b70d22c209	2026-01-29	employee	769	解丽欣	E0070	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
e4efff46-1584-4c31-967d-82470e2948ee	2026-01-29	employee	768	柏凯浩	E0069	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
54682825-8c82-4240-beb1-974989dfc368	2026-01-29	employee	767	梅宇悦	E0068	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
e27c2832-1b6c-46a6-a76e-653d8d629372	2026-01-29	employee	766	钟皓	E0067	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
aabbb9de-1d60-41c0-b31a-ed9a4662d772	2026-01-29	employee	765	支敏	E0066	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
00c913e5-6b15-44f4-af46-c77eacf937fc	2026-01-29	employee	764	姜丽轩	E0065	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
c3efc761-e2c7-4dcf-bbf8-17d042d35be3	2026-01-29	employee	763	鲁瑾	E0064	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
bd616b88-5380-47cf-a77a-e5a08a367d71	2026-01-29	employee	796	单杰悦	E0097	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
052d1674-6eef-4123-be46-ce3595af259e	2026-01-29	employee	793	宣睿婷	E0094	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
5144211f-83e5-4cb3-a3c8-2ec68f9e4756	2026-01-29	employee	792	余涵萱	E0093	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
b34d93a0-95da-4e05-81c1-ee318cab11b9	2026-01-29	employee	791	车鹏睿	E0092	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
797c326c-f875-46d5-b806-7f4a5553f6d2	2026-01-29	employee	801	林	EMP586274	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
298a47db-ce27-4c5b-885c-823bc0c76140	2026-01-29	employee	787	马安瑾	E0088	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
d1d6d038-66cc-4dd7-ac82-66a5fc63e41c	2026-01-29	employee	749	花瑜	E0050	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
389f1629-b073-4f39-beba-5079238118d7	2026-01-29	employee	748	倪宸浩	E0049	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
fe8944d0-846c-462e-b956-6e4003380e0f	2026-01-29	employee	747	鲁桐珊	E0048	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
fd8d3084-f9ce-4220-9451-d16cd2eb089f	2026-01-29	employee	746	严强	E0047	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
74f3bd38-bce4-455a-a1ba-1e948b2d4b32	2026-01-29	employee	745	戴曦	E0046	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
128fd396-440e-43f4-b417-513ccbdad6b7	2026-01-29	employee	744	车曦军	E0045	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
360ab28e-7616-4590-b6e1-ec83d2275def	2026-01-29	employee	743	郝磊博	E0044	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
9669e2d3-790d-467a-a427-2d77b2791e83	2026-01-29	employee	742	沈安梦	E0043	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
43123815-02b7-4b64-b335-20d5ba38626f	2026-01-29	employee	741	常睿皓	E0042	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
fd2a263b-87ea-4027-8b83-49616c15c4ac	2026-01-29	employee	740	顾琪婷	E0041	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
3763824d-f3f2-4c80-8236-6d52120559de	2026-01-29	employee	739	贺超豪	E0040	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
f4aa4db3-20df-4fc9-b589-2bfa7bba08ad	2026-01-29	employee	738	曹宇桐	E0039	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
014e9af3-b4ae-464e-9ead-a0b20ba21c9c	2026-01-29	employee	737	邹琪轩	E0038	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
4a4169ca-17c3-468a-9faa-c8467fddc160	2026-01-29	employee	736	富欣瑶	E0037	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
82ac175e-0629-4601-a136-588a2a137be3	2026-01-29	employee	735	巴墨芳	E0036	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
18285bc0-7a61-4efa-a09f-a2fc017ef8e6	2026-01-29	employee	762	霍勇鹏	E0063	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
3b6515c5-7218-4ca0-88ea-162c1e281a70	2026-01-29	employee	761	陆轩	E0062	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
028b7d8a-31de-4630-bda6-830fd3f77bd2	2026-01-29	employee	760	薛萱琳	E0061	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
26c327bc-7320-4273-9ad6-b6c7bf2337e3	2026-01-29	employee	759	彭琪桐	E0060	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
dfbf4986-e079-48ab-ba26-a9869038aa4c	2026-01-29	employee	795	魏瑜墨	E0096	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
c0c66972-e463-4630-8c64-3c4717f6daa0	2026-01-29	employee	794	齐娜妍	E0095	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
2369033c-b51a-44fd-873a-2d1332675acc	2026-01-29	employee	800	你	EMP339009	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
bc5f7a49-6e67-4821-bd2b-5760e116a8dd	2026-01-29	employee	758	左怡轩	E0059	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
a6b346ef-c143-4b96-bda5-25f21da576a0	2026-01-29	employee	757	荣琳博	E0058	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
b0b2179e-b4a6-4579-afc1-aa57413a93f8	2026-01-29	employee	756	蓝瑶婷	E0057	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
c7db4cfd-f62e-4b48-8426-e3759ae4dd21	2026-01-29	employee	755	乌彬鑫	E0056	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
3c3b20d7-918d-4cf6-b48f-ba806ed19d79	2026-01-29	employee	754	莫瑾宸	E0055	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
ce0ad632-846d-47fd-8b50-2484b4209ea7	2026-01-29	employee	753	魏伟	E0054	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
996a65e9-394f-4751-8c97-6ce95f80a8c9	2026-01-29	employee	752	陈嘉婉	E0053	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
0fea18d0-47ef-449c-b7b8-6169d4ab2124	2026-01-29	employee	751	缪彬	E0052	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
2b99ec31-8e6d-4d50-a812-a74217c499c2	2026-01-29	employee	750	苗勇静	E0051	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-28 20:11:44.449795+00	2026-01-28 20:11:44.449795+00
f414ba94-b145-46de-84e1-05dc40c17ba8	2026-01-30	employee	802	新员工	EMP330625	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
cea17948-814b-4b52-87fa-f08705da2b21	2026-01-30	employee	734	万轩敏	E0035	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
6125c503-9277-4f46-b5c4-78b8ce918d3b	2026-01-30	employee	733	韩欣敏	E0034	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
257ab562-0a61-42b9-8d50-40ba1a77a4c5	2026-01-30	employee	732	徐睿宸	E0033	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
cf7796e3-78bf-41c2-a063-078b904f1c01	2026-01-30	employee	731	阮曦颖	E0032	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
0b8efb9f-6ead-4c03-8b79-fe78ffc430dc	2026-01-30	employee	730	李安	E0031	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
9f6df9fa-470c-4c2e-9a90-bf45f4fc7f6c	2026-01-30	employee	729	倪墨	E0030	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
081ed70a-b85b-44d1-a418-9eaf0476a124	2026-01-30	employee	728	华浩杰	E0029	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
bdafbfdb-cf8d-4afc-b062-cb808d2a5366	2026-01-30	employee	727	沈萱鹏	E0028	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
da703323-b187-48b7-a4ca-d1d59a5243cf	2026-01-30	employee	726	闵鑫鑫	E0027	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
c017f477-a580-498c-8bcd-5b784aba22e6	2026-01-30	employee	725	任雪彬	E0026	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a68c514b-77df-448c-bfd9-f43f96073042	2026-01-30	employee	724	唐宇	E0025	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
0150085f-da41-4b4a-be84-e8619a96cdec	2026-01-30	employee	723	吴欣超	E0024	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
f527ffb7-8d61-49a3-9065-cdde7f3e7ae0	2026-01-30	employee	722	焦梦曦	E0023	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
2681d0cd-5207-4225-b35f-e85d815f8bc1	2026-01-30	employee	721	范皓勇	E0022	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
c7637eb4-0f0a-4fe9-ad2c-48b1b6596b18	2026-01-30	employee	720	何安静	E0021	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
262e16d9-45bd-408d-8a43-5386c7e5c761	2026-01-30	employee	719	臧桐	E0020	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
3db8a8ad-55c1-4e5f-9959-c5104582583e	2026-01-30	employee	718	葛雪	E0019	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
caf2ec2e-580d-4060-9e3a-ded4ac198e49	2026-01-30	employee	717	惠杰	E0018	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
ce07ec8b-2a21-44d4-9750-b0174ba88f17	2026-01-30	employee	716	徐子	E0017	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a5b6d32c-54da-4692-920d-29b23f67fd5c	2026-01-30	employee	715	山桐梦	E0016	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
204c434d-41a3-4e6f-ab98-48075eb5101c	2026-01-30	employee	714	龚宇勇	E0015	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
ad71b491-aff5-4ff3-8310-ecb321d2db9d	2026-01-30	employee	713	柯芳敏	E0014	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
774c25c3-8c24-4b99-99cc-6a14bfe2263f	2026-01-30	employee	712	郁雪超	E0013	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a63810dd-17db-438b-92f3-c14d07cf4062	2026-01-30	employee	711	杜桐	E0012	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
2d766ed2-07dd-4c80-9804-6cb0e1c9b686	2026-01-30	employee	710	萧勇欣	E0011	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
eef6bc95-d0aa-4851-9bb9-a267b983fa28	2026-01-30	employee	709	封瑶晨	E0010	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
279ede14-84f1-471b-a425-32e7129636bf	2026-01-30	employee	708	储宇雪	E0009	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
3ebf1ab4-e88c-4338-a4cb-1aac0ab1b325	2026-01-30	employee	707	曲豪珂	E0008	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
e50e9c85-6884-4632-ba4b-032e17bc878e	2026-01-30	employee	706	巫涵	E0007	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
3654c894-89e6-42a9-889e-90972d66d48a	2026-01-30	employee	705	宣睿	E0006	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
933540ee-d9d3-449d-8948-f18cb5bdafc7	2026-01-30	employee	704	禹怡军	E0005	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
16fd37e7-4a8c-4c98-bcde-acbe1e4d50b8	2026-01-30	employee	703	傅凯妍	E0004	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
fcf346ca-db23-410c-b310-0660099a03b0	2026-01-30	employee	702	应军超	E0003	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
649a130f-76fe-4064-b34c-ec8400421bcf	2026-01-30	employee	701	王安桐	E0002	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
9a074a67-4201-45b1-a7fa-d3039fd10d30	2026-01-30	employee	700	史俊晨	E0001	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
dbb28fb4-e23e-4d07-b4ac-e8b7056ca26e	2026-01-30	employee	799	惠晨丽	E0100	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
d73d8606-c5e1-40b3-ae4f-c7f9893b6cdb	2026-01-30	employee	798	童杰敏	E0099	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
addee962-7bca-44f2-b2be-1bdd9c85343f	2026-01-30	employee	797	翁涵	E0098	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
c04b0527-10fd-4979-b88f-54120b250fcb	2026-01-30	employee	790	黄皓宸	E0091	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a8b27e51-78d9-4617-ba9f-7df41a08f8b3	2026-01-30	employee	789	宋娜婉	E0090	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
775fcb4e-5de9-4e32-9d2f-252e189fb49e	2026-01-30	employee	788	林雯琪	E0089	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
9b64f7a7-17d8-4311-87be-b04cd34b6a30	2026-01-30	employee	786	米瑾梦	E0087	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
b6215c92-f0c0-4f12-8d54-f82e1345de8c	2026-01-30	employee	785	洪悦妍	E0086	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
e15e0a96-13cd-4caa-9661-d37683a9d05f	2026-01-30	employee	784	安博	E0085	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
93e9d509-1abf-4001-aa41-197a153992ec	2026-01-30	employee	783	靳宸杰	E0084	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
7cb89280-b43b-4234-98b3-0a0b1f224b49	2026-01-30	employee	782	颜超轩	E0083	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
2e41bd64-b1a3-4d98-aee7-55f16b6aa089	2026-01-30	employee	781	巫超鹏	E0082	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
6d91f501-cefe-4351-b66a-4891cc5ceff8	2026-01-30	employee	780	惠浩萱	E0081	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a79b4b2d-3260-4307-a474-e778c00fdcd1	2026-01-30	employee	779	郑杰颖	E0080	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
906193c0-4556-4159-a4f7-91a547dc3fbe	2026-01-30	employee	778	袁丽珂	E0079	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
71269421-e33b-47be-b8c4-f06176fa1023	2026-01-30	employee	777	花豪倩	E0078	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
532f135b-4a8d-4587-bb21-e3ddb82ef738	2026-01-30	employee	776	周珂婉	E0077	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
9882476e-35a1-4a04-ad20-1920055f7d5e	2026-01-30	employee	775	祁昕	E0076	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
095b1e58-c43c-407d-8788-aad883c305ee	2026-01-30	employee	774	喻墨敏	E0075	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
877fe35c-20c5-410c-91ac-6cbe3532348a	2026-01-30	employee	773	裘亦	E0074	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
d928e25e-587f-42ef-8e63-8c2c7f27edd5	2026-01-30	employee	772	董彬雯	E0073	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
f3961df6-d747-4757-b759-356d2f5d1237	2026-01-30	employee	771	应瑾怡	E0072	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
3df7ea4d-1e07-4a2e-9e2c-9f89565c1d00	2026-01-30	employee	770	诸伟婉	E0071	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a7d06b08-0f14-4aa1-a9a6-cf6ecd12d266	2026-01-30	employee	769	解丽欣	E0070	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
0dfb28d5-8c92-469d-9c60-2392ef820b90	2026-01-30	employee	768	柏凯浩	E0069	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
8ab6a8e5-cd14-4415-a362-b952b1f49fda	2026-01-30	employee	767	梅宇悦	E0068	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
ea9bb72f-2029-48a6-ae62-7e05288ddd3d	2026-01-30	employee	766	钟皓	E0067	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
c3399f47-f4e3-41e4-9ef1-a37a02776c3f	2026-01-30	employee	765	支敏	E0066	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
00181c79-58b1-4404-8809-0d29b95f9e5b	2026-01-30	employee	764	姜丽轩	E0065	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
38458a79-b745-488c-b142-3f4c597a2137	2026-01-30	employee	763	鲁瑾	E0064	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
7019a1fe-c36b-4746-9dd0-ba56d746f4f1	2026-01-30	employee	796	单杰悦	E0097	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
6d03fc37-0306-4688-92d1-03a1b2d91d9d	2026-01-30	employee	793	宣睿婷	E0094	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
17f9bd71-2252-440b-bb61-477b08ad668d	2026-01-30	employee	792	余涵萱	E0093	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
2534d4f6-d724-472b-9ae3-110e239eb83d	2026-01-30	employee	791	车鹏睿	E0092	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
7ed93fa4-cd2a-4b73-b9bd-0737e57e6fd2	2026-01-30	employee	801	林	EMP586274	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a0469a06-90e3-4ad9-ae6f-53ece3de8a11	2026-01-30	employee	787	马安瑾	E0088	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
499a4dc4-8c0e-450a-ba8e-e7426b9b0532	2026-01-30	employee	749	花瑜	E0050	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
9b41bec4-95b4-4024-8e1e-52dceddffe0b	2026-01-30	employee	748	倪宸浩	E0049	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
7da1cd2b-5721-42f1-8ecf-4d6e3cf2e28f	2026-01-30	employee	747	鲁桐珊	E0048	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
dc0b47cf-ae99-42dd-b4d8-c4ed15ede718	2026-01-30	employee	746	严强	E0047	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
859a2540-e3c6-49a4-a220-0814191572b9	2026-01-30	employee	745	戴曦	E0046	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
8f4a2589-0147-48d6-b2a5-4449867c3d1e	2026-01-30	employee	744	车曦军	E0045	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
a13598d2-0955-49d9-9f31-a682249c0cdd	2026-01-30	employee	743	郝磊博	E0044	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
454fcf6e-a1c9-4429-be91-b9333b38fc18	2026-01-30	employee	742	沈安梦	E0043	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
1254d19e-bab8-4602-a927-d23d4c9a6271	2026-01-30	employee	741	常睿皓	E0042	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
cbbc4126-738b-4a05-8b26-cacea6914acf	2026-01-30	employee	740	顾琪婷	E0041	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
440af2f6-9a3e-43cb-b49a-ac81eb87ca90	2026-01-30	employee	739	贺超豪	E0040	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
ba267e80-4222-40c7-99e9-32cfa0d49514	2026-01-30	employee	738	曹宇桐	E0039	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
4468cc20-c7f5-49ed-810f-41f5d5ffbc6b	2026-01-30	employee	737	邹琪轩	E0038	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
53e81c6c-b33f-4e84-ae59-7b4927b9ca7e	2026-01-30	employee	736	富欣瑶	E0037	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
adea7cbc-e6a3-4f3b-977f-b0d9f1892471	2026-01-30	employee	735	巴墨芳	E0036	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
5ecd2269-a0fb-439b-a249-db643e67f428	2026-01-30	employee	762	霍勇鹏	E0063	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
1d55c506-3f51-48fb-8ddb-abfb719951e5	2026-01-30	employee	761	陆轩	E0062	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
71b22a87-efee-4d7a-9225-a43551b18e8d	2026-01-30	employee	760	薛萱琳	E0061	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
5508595f-c705-4988-8582-2690f1bf8db2	2026-01-30	employee	759	彭琪桐	E0060	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
0fa3ba78-c3cd-4614-856b-32d9d813686d	2026-01-30	employee	795	魏瑜墨	E0096	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
623e2277-8d13-43a9-8924-59eff89f843f	2026-01-30	employee	794	齐娜妍	E0095	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
41d5309a-a12a-4443-8233-612cfdff527c	2026-01-30	employee	800	你	EMP339009	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
e3838e45-be44-4dd1-9afd-d1c01beedd02	2026-01-30	employee	758	左怡轩	E0059	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
0de7bce1-0203-418f-b3f6-e9183954bde2	2026-01-30	employee	757	荣琳博	E0058	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
369eb433-fe73-4d5f-a1c9-b76ad83215b5	2026-01-30	employee	756	蓝瑶婷	E0057	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
d6f86a40-fc9e-4788-8648-f91b3f75cc0d	2026-01-30	employee	755	乌彬鑫	E0056	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
4458c6cb-1112-47c4-a421-8abc0e57607b	2026-01-30	employee	754	莫瑾宸	E0055	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
98ebb847-a8a9-46de-9b40-9e569e75917b	2026-01-30	employee	753	魏伟	E0054	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
166d7558-ac32-4079-af61-569fafd9a491	2026-01-30	employee	752	陈嘉婉	E0053	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
ddfd2847-20ec-4122-8bb2-2244ece50a34	2026-01-30	employee	751	缪彬	E0052	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
150c1766-649f-45d0-beda-2378ed89abc2	2026-01-30	employee	750	苗勇静	E0051	\N	\N	\N	???	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-29 16:52:55.451216+00	2026-01-29 16:52:55.451216+00
aaacba52-46fd-4b74-a1ce-d9d59658a587	2026-01-31	employee	802	新员工	EMP330625	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
c4f21d5b-fad2-4612-96b7-80eb403897f1	2026-01-31	employee	801	林	EMP586274	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
8c020515-bd1e-4104-9887-6f93b12c87f5	2026-01-31	employee	796	单杰悦	E0097	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
7d93f946-a975-41ac-9c72-b8834d5a61a2	2026-01-31	employee	800	你	EMP339009	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
4be2240e-2368-416a-88d5-8fc2572faeb5	2026-01-31	employee	725	任雪彬	E0026	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
a0031a01-b69d-4f13-b771-090c8ffb1bcb	2026-01-31	employee	729	倪墨	E0030	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
428f5be6-ee9e-4ceb-a9e1-d134fc729656	2026-01-31	employee	748	倪宸浩	E0049	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
154fbb4b-64c6-4e8b-b573-f67e3898fa70	2026-01-31	employee	728	华浩杰	E0029	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
98fc4540-ea7f-4ea2-ba91-fc714f2c5756	2026-01-31	employee	700	史俊晨	E0001	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
08119e48-cbfd-4b9a-9bb1-ca6374b8f1f9	2026-01-31	employee	723	吴欣超	E0024	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
1ad414e9-3659-40c2-b487-2b3e53c2af45	2026-01-31	employee	774	喻墨敏	E0075	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
b26a4c1f-5a8e-4d0c-bb16-b1e2df48df3b	2026-01-31	employee	705	宣睿	E0006	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
03475884-8293-451a-8465-cf90be3a61cc	2026-01-31	employee	736	富欣瑶	E0037	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
930b5200-340b-4ae7-9523-bd35c1065031	2026-01-31	employee	758	左怡轩	E0059	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
fafe0eab-7738-4288-983e-5f295b1dd218	2026-01-31	employee	706	巫涵	E0007	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
f8c25b75-1fd7-4d44-9ccd-2dfc6199ccc6	2026-01-31	employee	781	巫超鹏	E0082	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
8e3095a6-90e9-4758-821b-629ddbfe9b06	2026-01-31	employee	759	彭琪桐	E0060	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
4dfc9e02-9cb8-4a56-bdbc-f2a797a31729	2026-01-31	employee	732	徐睿宸	E0033	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
63ed18e7-96eb-4932-8900-ff5f6e776b7d	2026-01-31	employee	745	戴曦	E0046	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
340e2de8-359e-4a0f-8575-ce7dbb3a190b	2026-01-31	employee	765	支敏	E0066	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
5916c03f-e1d4-46d4-8b35-577b439df031	2026-01-31	employee	707	曲豪珂	E0008	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
21c1ad23-aadd-4769-943e-c07ed24d3a2e	2026-01-31	employee	738	曹宇桐	E0039	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
31373db8-26e9-4707-ac48-34595e4da314	2026-01-31	employee	730	李安	E0031	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
f9262882-4a3a-4738-96ed-4d10c7aaafaf	2026-01-31	employee	727	沈萱鹏	E0028	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
6fbedc18-3973-4ebb-a28d-cfb8aea8355d	2026-01-31	employee	785	洪悦妍	E0086	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
e43539fa-9c04-4853-adae-dd8ebdd24f09	2026-01-31	employee	722	焦梦曦	E0023	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
04b7e17f-ea45-43e1-b4ab-c0ef8c1128cd	2026-01-31	employee	701	王安桐	E0002	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
ad41ee18-3fa9-4836-9ee9-ba263ae75eaf	2026-01-31	employee	775	祁昕	E0076	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
21322a25-d222-4a36-9fa3-8141246a70d0	2026-01-31	employee	704	禹怡军	E0005	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
6316e435-aabc-4420-98ed-246335bd8030	2026-01-31	employee	786	米瑾梦	E0087	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
58cef217-3fd5-4ec0-b30c-dc7abd8c30ea	2026-01-31	employee	751	缪彬	E0052	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
b0a447f2-9be9-45c0-a217-7fea1281cbb7	2026-01-31	employee	777	花豪倩	E0078	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
047dbfe0-df4c-4eb0-a032-8ab419b41d75	2026-01-31	employee	718	葛雪	E0019	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
5e898bb9-b79a-4656-a6f1-ecf3a92b6ad6	2026-01-31	employee	756	蓝瑶婷	E0057	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
2260baf0-65e7-4816-a6b5-5e8f09bc17e9	2026-01-31	employee	770	诸伟婉	E0071	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
4290c1dc-6ccc-4637-8e1e-026f700dc4ff	2026-01-31	employee	739	贺超豪	E0040	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
0f7a6354-6023-47ed-8d4f-e604e58b28c1	2026-01-31	employee	744	车曦军	E0045	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
6c2e990a-234e-4396-8be2-525893572dbe	2026-01-31	employee	737	邹琪轩	E0038	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
45123a39-bb56-4e8d-8fcf-e8b96a205df5	2026-01-31	employee	712	郁雪超	E0013	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
80862b72-0451-4bb2-b08e-ffc6b90df46a	2026-01-31	employee	779	郑杰颖	E0080	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
4a80ba8b-5996-410b-8535-5ec4a59668ff	2026-01-31	employee	752	陈嘉婉	E0053	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
2492e979-e002-43ee-9967-6703f0550627	2026-01-31	employee	762	霍勇鹏	E0063	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
4b0abf2e-a70a-41db-9b5d-0a0b99816da1	2026-01-31	employee	733	韩欣敏	E0034	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
e458e988-a0e0-4acc-b64b-8d9581720e43	2026-01-31	employee	782	颜超轩	E0083	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
d9751a4a-d1ab-4bc9-87dd-e1a939b483c7	2026-01-31	employee	763	鲁瑾	E0064	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
7f534d73-72a3-4ed3-b330-a2eccbaaf0c0	2026-01-31	employee	714	龚宇勇	E0015	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
55d6bee9-d47d-4ee9-af86-52512d241126	2026-01-31	employee	799	惠晨丽	E0100	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
ff733cf7-7a88-410e-8134-97026b8d0bff	2026-01-31	employee	702	应军超	E0003	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
2df5f99e-aa8e-4217-a925-ffd8a35a7b68	2026-01-31	employee	798	童杰敏	E0099	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
aa890467-d59e-4b60-8e6d-ef62abaf38e3	2026-01-31	employee	734	万轩敏	E0035	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
6715f693-07b7-46d9-a0e4-6da240f68329	2026-01-31	employee	746	严强	E0047	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
b2597a4d-19c5-4178-8898-df4a3eb0786b	2026-01-31	employee	755	乌彬鑫	E0056	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
cf712f14-fbd3-4471-94da-04fa217b17ee	2026-01-31	employee	720	何安静	E0021	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
6377ae52-f3f3-433e-a5ac-01a3fe00a89e	2026-01-31	employee	792	余涵萱	E0093	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
8f9145c6-f133-46f2-9a1f-da73bdb4c347	2026-01-31	employee	703	傅凯妍	E0004	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
6a1e3eb9-505e-4039-b82b-1df1d3f4336b	2026-01-31	employee	708	储宇雪	E0009	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
646eb93d-ef87-4852-a2a7-d42c4fe9974c	2026-01-31	employee	776	周珂婉	E0077	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
14759bd3-3fcc-4dab-9d81-e2b0634f9924	2026-01-31	employee	724	唐宇	E0025	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
269b77ae-2c0b-44d9-856f-e87a550d0c7b	2026-01-31	employee	764	姜丽轩	E0065	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
5d96b774-5aa7-4879-ac0b-2818da316a4a	2026-01-31	employee	784	安博	E0085	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
93714f42-ea3d-4569-9a27-e1223863409b	2026-01-31	employee	789	宋娜婉	E0090	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
a46f241e-4b8f-4a0f-89ec-2f7e8711aef4	2026-01-31	employee	793	宣睿婷	E0094	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
8ae5523e-ffd9-4629-9276-e38fe8e66783	2026-01-31	employee	709	封瑶晨	E0010	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
9dd1f0e6-67c7-4e49-be8e-e654fc9bed6e	2026-01-31	employee	715	山桐梦	E0016	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
94e1cfeb-9f64-4156-a24a-29791dc8dc2c	2026-01-31	employee	735	巴墨芳	E0036	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
8c08779b-9be3-466c-8f01-61f2d2dae45f	2026-01-31	employee	771	应瑾怡	E0072	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
ee305e2d-0314-41a4-a11e-664d1f9b1c26	2026-01-31	employee	716	徐子	E0017	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
8b586ed1-5199-4c9b-b003-e65dc37a9a93	2026-01-31	employee	717	惠杰	E0018	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
958b3381-aea8-4a5f-bfae-c25107497f6f	2026-01-31	employee	780	惠浩萱	E0081	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
766e4fd7-7184-41f1-8830-e38e9c67915c	2026-01-31	employee	711	杜桐	E0012	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
b4e7c8e9-2712-447a-bd8b-bafe1dc90dae	2026-01-31	employee	788	林雯琪	E0089	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
50f618bf-8d40-4860-8cce-c8185fd413f8	2026-01-31	employee	768	柏凯浩	E0069	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
5ee62e7e-8706-4a69-a7d0-9d3945ad7025	2026-01-31	employee	713	柯芳敏	E0014	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
37e61aaf-ffe8-4216-9d98-326daaedfa17	2026-01-31	employee	767	梅宇悦	E0068	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
9c48363c-9b94-4f47-aa9b-5c2343e7ce17	2026-01-31	employee	742	沈安梦	E0043	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
20eaeda8-d4a2-4570-9fb7-1e15ce411226	2026-01-31	employee	797	翁涵	E0098	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
5b5a89b7-fa6c-425a-b679-8edd37bf9cdb	2026-01-31	employee	719	臧桐	E0020	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
6fd69c6a-c8cd-4bf9-92bc-9ac6170e159e	2026-01-31	employee	749	花瑜	E0050	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
c8208dc2-d6b1-44ea-978d-5bb11ff9c39b	2026-01-31	employee	750	苗勇静	E0051	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
37adc945-6d0d-43fd-927b-5ddf61d8fc81	2026-01-31	employee	721	范皓勇	E0022	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
c620e009-e613-4f95-b880-dd25fe5a6a86	2026-01-31	employee	757	荣琳博	E0058	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
1da99b78-5e27-4c4a-800c-271c38e2f615	2026-01-31	employee	754	莫瑾宸	E0055	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
18955630-aaf3-4e92-8290-d7952ae18eb7	2026-01-31	employee	710	萧勇欣	E0011	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
2e2489c1-2432-432e-8985-91a75e356f12	2026-01-31	employee	772	董彬雯	E0073	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
b26934aa-dd14-4a2d-ac89-5cdc817f2666	2026-01-31	employee	760	薛萱琳	E0061	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
17f6596f-d954-4c7d-a970-ff55bf2cdbd2	2026-01-31	employee	778	袁丽珂	E0079	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
dd0576e1-a117-4488-96fc-8030047a0d78	2026-01-31	employee	773	裘亦	E0074	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
20c074cf-7d2e-4e91-b970-692f919c3c75	2026-01-31	employee	791	车鹏睿	E0092	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
102a661d-64a2-49ed-8d52-029c2b429c82	2026-01-31	employee	766	钟皓	E0067	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
a94f894b-1372-4455-9710-5fb62edb3a55	2026-01-31	employee	726	闵鑫鑫	E0027	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
a190610e-51b6-4f55-b257-1efd65ed4a43	2026-01-31	employee	731	阮曦颖	E0032	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
c863c255-1232-48c6-af36-981c1904fd02	2026-01-31	employee	761	陆轩	E0062	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
0cb26ddc-9d8e-43f3-b09a-f630a837776a	2026-01-31	employee	783	靳宸杰	E0084	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
ce9fdb96-8458-4cd6-86b1-2a9da4f46f1e	2026-01-31	employee	740	顾琪婷	E0041	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
8692ebd5-cd45-417e-beb3-e7bfba15995d	2026-01-31	employee	787	马安瑾	E0088	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
2808c637-0dc2-4884-8aae-e10c87c2c220	2026-01-31	employee	753	魏伟	E0054	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
4136afd7-dbe8-45f2-99df-bf796f1fbc50	2026-01-31	employee	747	鲁桐珊	E0048	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
347fbf72-70bc-4e3e-aae1-510fe3cbe68a	2026-01-31	employee	795	魏瑜墨	E0096	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
225b5e0f-32ca-47f8-9bb2-60923a34d030	2026-01-31	employee	790	黄皓宸	E0091	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
90e9c080-e834-456b-ba79-6547794b9f74	2026-01-31	employee	794	齐娜妍	E0095	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
9a9c4275-fea2-4686-9c61-f5010c48c0b0	2026-01-31	employee	769	解丽欣	E0070	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
c6ca9c22-bb25-44e6-99e0-c03ef8bc0757	2026-01-31	employee	743	郝磊博	E0044	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
44ef900a-9c90-4011-a0b0-5663b0d86ad0	2026-01-31	employee	741	常睿皓	E0042	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-30 18:01:53.021012+00	2026-01-30 18:01:53.021012+00
364c4ea2-2081-4fe3-9192-365563d4ea32	2026-02-01	employee	802	新员工	EMP330625	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
b10cd54f-cb64-4a41-bc37-f89eac218bf5	2026-02-01	employee	801	林	EMP586274	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
d29648c4-779e-48ed-ad1b-cfae1e4bc0d4	2026-02-01	employee	796	单杰悦	E0097	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
f257f29e-a180-4412-82da-8b944e38c3d9	2026-02-01	employee	800	你	EMP339009	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
4b47149c-c83f-4fe8-ac89-65b7468dfd88	2026-02-01	employee	799	惠晨丽	E0100	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
cca3364a-e4ab-46c7-8cb7-f97e8287d7ff	2026-02-01	employee	702	应军超	E0003	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
ef1575a5-8d47-43b5-93ed-2adc2046e1f4	2026-02-01	employee	725	任雪彬	E0026	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
3de57e54-8166-4d1d-b421-b701c06f828a	2026-02-01	employee	729	倪墨	E0030	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
36397168-fa16-4ecb-96cf-d12961ea2416	2026-02-01	employee	748	倪宸浩	E0049	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
e1a7577d-511f-4e1f-97d5-623b4f46b42e	2026-02-01	employee	708	储宇雪	E0009	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
9e0f0828-72f3-4e77-a46f-dd79386e22a0	2026-02-01	employee	728	华浩杰	E0029	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
6a766b50-6702-48c6-80e6-b257e58a6fb9	2026-02-01	employee	700	史俊晨	E0001	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
b7ef227d-bd6b-42fa-8c7d-8e8b1202e4ba	2026-02-01	employee	723	吴欣超	E0024	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
4a08f58b-f17b-47ec-9737-c5c0f0b2b16a	2026-02-01	employee	774	喻墨敏	E0075	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
43cb21e1-1656-43d1-a5ae-49a073356c9b	2026-02-01	employee	789	宋娜婉	E0090	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
27bee737-2aca-45be-ac78-4949487b84c3	2026-02-01	employee	736	富欣瑶	E0037	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
1fbfbbcd-52f1-48df-9702-59efcf464d6a	2026-02-01	employee	709	封瑶晨	E0010	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
0c572400-28f5-4ee4-a02d-3bb7970f7103	2026-02-01	employee	758	左怡轩	E0059	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
3782ddb3-eb7a-454b-bbf3-7f550694326e	2026-02-01	employee	706	巫涵	E0007	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
28c6c36c-0707-4bcb-bd1d-3e08f74cf310	2026-02-01	employee	781	巫超鹏	E0082	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
c91c83c9-b2e7-4c2e-8bfa-6a85f3e93498	2026-02-01	employee	741	常睿皓	E0042	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
af23a152-0423-4010-b465-1217f8625495	2026-02-01	employee	759	彭琪桐	E0060	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
23671b45-b015-44db-b20e-8f4f14cccf57	2026-02-01	employee	732	徐睿宸	E0033	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
a86eea93-7bd5-490e-8dfa-a64d9800fd68	2026-02-01	employee	717	惠杰	E0018	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
0186a5c8-9e44-4f9f-a410-01cde47e860d	2026-02-01	employee	745	戴曦	E0046	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
fa63bcb9-4a0a-4b33-8d18-d287854387af	2026-02-01	employee	765	支敏	E0066	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
1d3db232-793c-4b6f-b723-c0a0b1396d5a	2026-02-01	employee	707	曲豪珂	E0008	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
ddfc8982-df96-4f05-a7fa-c0ae89b0e55a	2026-02-01	employee	738	曹宇桐	E0039	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
875d7a54-6400-49f1-93f3-7c81f7b95066	2026-02-01	employee	730	李安	E0031	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
d2f7a071-8473-4341-b297-f7570e9e11f9	2026-02-01	employee	767	梅宇悦	E0068	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
ff698b13-844e-4404-bfdf-94c2925d8a07	2026-02-01	employee	727	沈萱鹏	E0028	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
fe62888b-f9a9-466f-b87b-2d155c1cc8a0	2026-02-01	employee	785	洪悦妍	E0086	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
b469b75d-3286-412a-88e3-0e7f2ba0ac89	2026-02-01	employee	722	焦梦曦	E0023	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
8b1845c1-e84b-40e2-bc2d-412d9f326fa8	2026-02-01	employee	701	王安桐	E0002	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
7f94b636-e26a-41b4-b701-c4d5f2aebdcd	2026-02-01	employee	775	祁昕	E0076	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
4e9de845-4f8e-49e8-9038-5779a58b44f9	2026-02-01	employee	786	米瑾梦	E0087	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
98f24db0-ff89-4bc4-b6e3-939dce37b513	2026-02-01	employee	751	缪彬	E0052	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
6c96a022-2f06-4f8c-843e-eb2fb1de62de	2026-02-01	employee	719	臧桐	E0020	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
a6e4ace2-941f-4e25-98f7-a53adbba29b9	2026-02-01	employee	777	花豪倩	E0078	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
379731ca-9798-48b0-8dec-cb1ede3ccf84	2026-02-01	employee	710	萧勇欣	E0011	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
88dcce70-142c-4e45-94e1-17c4147fcca6	2026-02-01	employee	718	葛雪	E0019	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
bfad9dee-234b-4ed2-a6cb-bf1e7209e1f9	2026-02-01	employee	756	蓝瑶婷	E0057	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
62cb59b8-850c-4a37-a4d3-42aaca46f88c	2026-02-01	employee	770	诸伟婉	E0071	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
2b705817-56de-4641-8f68-cfc9ec9b689d	2026-02-01	employee	739	贺超豪	E0040	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
2a52b184-d167-430d-85c9-d077ce34ad04	2026-02-01	employee	744	车曦军	E0045	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
45a6be3a-44c2-46df-8560-78955a64cd42	2026-02-01	employee	737	邹琪轩	E0038	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
751c3a4c-2d24-4e2c-9c49-2304c9e1002f	2026-02-01	employee	712	郁雪超	E0013	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
3f244bf5-6b5e-4edd-a145-336317752471	2026-02-01	employee	779	郑杰颖	E0080	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
5f2e9c94-4aea-42bb-bb16-1dd6c15ae217	2026-02-01	employee	752	陈嘉婉	E0053	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
3f750697-447e-4cf3-b402-7ee4a26be248	2026-02-01	employee	762	霍勇鹏	E0063	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
9b891b91-00f8-4f0d-a497-58aea0ba45fb	2026-02-01	employee	733	韩欣敏	E0034	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
fc54aa9b-0104-440b-b7b6-4ef4aba648d2	2026-02-01	employee	782	颜超轩	E0083	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
1bb53e34-5364-41da-b07a-00b5c09abcdf	2026-02-01	employee	795	魏瑜墨	E0096	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
c68407e0-67d3-4856-8f10-ba47d70d7482	2026-02-01	employee	763	鲁瑾	E0064	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
5a922238-dd36-4232-a13a-5880a78c2d3a	2026-02-01	employee	714	龚宇勇	E0015	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
e70e173c-e052-4ddd-85c1-36483540914d	2026-02-01	employee	798	童杰敏	E0099	\N	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
6d6f9237-dee2-4ba9-be11-8ddc0ccd7a37	2026-02-01	employee	734	万轩敏	E0035	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
ad84d478-99fc-4053-a061-162c2b95fc11	2026-02-01	employee	746	严强	E0047	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
e8cd51e0-2ceb-4e87-b328-bbffd4123edf	2026-02-01	employee	755	乌彬鑫	E0056	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
2d301cb8-4595-4a1f-8fdb-698b47463afe	2026-02-01	employee	720	何安静	E0021	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
022492aa-9cd2-425b-8207-d8f6605ecda8	2026-02-01	employee	792	余涵萱	E0093	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
6608a86f-0ff2-4dbe-8ee9-1c7c3ff102dd	2026-02-01	employee	703	傅凯妍	E0004	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
f8d807f0-7fc5-45f5-b3fe-3ef4d0e218bc	2026-02-01	employee	724	唐宇	E0025	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
f93e716e-0e6b-48dd-aebe-3e37fc2aebc0	2026-02-01	employee	776	周珂婉	E0077	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
f29a7153-e058-4487-a215-3290d711f394	2026-02-01	employee	764	姜丽轩	E0065	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
87e4a3bd-fc28-4587-84a5-d5ea9651edb2	2026-02-01	employee	784	安博	E0085	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
aa0f59b1-c254-41d7-ae73-6b0d08a26fb0	2026-02-01	employee	705	宣睿	E0006	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
cdf32b47-ec13-4748-84ef-0b50749ef1e8	2026-02-01	employee	793	宣睿婷	E0094	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
3a282bfc-6778-483d-8770-92f413e93ec9	2026-02-01	employee	715	山桐梦	E0016	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
aec4c01a-63a4-4224-b330-c617d229e585	2026-02-01	employee	735	巴墨芳	E0036	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
633a7411-6ba9-4f27-9775-bca9c87c64ec	2026-02-01	employee	771	应瑾怡	E0072	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
af68fe7f-fd3a-46bd-9c5a-1fddd2bae562	2026-02-01	employee	716	徐子	E0017	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
3919822c-9773-4ec9-b157-0f36b73ae13a	2026-02-01	employee	780	惠浩萱	E0081	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
4e4786ed-efc4-4daa-84ee-c1ee1651ebb9	2026-02-01	employee	711	杜桐	E0012	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
ee8337a9-c586-43c0-95b0-e0a39dacf1ab	2026-02-01	employee	788	林雯琪	E0089	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
931dc8dd-9a92-47d3-8fe7-9562d7b69725	2026-02-01	employee	768	柏凯浩	E0069	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
eb4aef71-2c28-46ce-ac4d-10974d93ba7e	2026-02-01	employee	713	柯芳敏	E0014	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
ff9fc164-9c42-4b1a-b019-0c4f292692e3	2026-02-01	employee	742	沈安梦	E0043	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
7a3c8575-882c-451f-aaee-09b75ec460fd	2026-02-01	employee	704	禹怡军	E0005	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
4c42d3bc-57c3-4800-ad6d-9b2f69e4be8b	2026-02-01	employee	797	翁涵	E0098	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
9d246f30-ac11-4d6b-ac14-d6fb72cbdc9c	2026-02-01	employee	749	花瑜	E0050	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
7b3f410c-44b6-439a-9d14-583c9f0d01e4	2026-02-01	employee	721	范皓勇	E0022	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
bfab98d4-3430-4b28-972f-6a2a06afd177	2026-02-01	employee	750	苗勇静	E0051	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
e156aef3-e5a8-41a5-b675-80d55095bd5b	2026-02-01	employee	757	荣琳博	E0058	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
d41986e4-5a0e-4bd8-a3d2-5b144533e46a	2026-02-01	employee	754	莫瑾宸	E0055	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
072e2a82-6d16-41d5-b75f-7842ed0c420c	2026-02-01	employee	772	董彬雯	E0073	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
c3dcd6f3-3241-4ad6-8b4c-9796bc3d83de	2026-02-01	employee	760	薛萱琳	E0061	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
da63f51e-2197-4c7c-8cf0-d0723ebcc46f	2026-02-01	employee	778	袁丽珂	E0079	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
460a480b-0d37-494a-b38c-c43519575f08	2026-02-01	employee	773	裘亦	E0074	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
9761658a-4fe7-489d-9e2d-5e05b76989aa	2026-02-01	employee	769	解丽欣	E0070	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
57764fbb-3510-4846-a56c-9d71c580a4a9	2026-02-01	employee	791	车鹏睿	E0092	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
564043e5-16ef-4161-bd79-b0fc8d3096ac	2026-02-01	employee	743	郝磊博	E0044	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
1e532267-61a0-4c82-9dd6-a15af51332d3	2026-02-01	employee	766	钟皓	E0067	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
e30ca583-dfed-4a09-8838-390b2f30dfd3	2026-02-01	employee	726	闵鑫鑫	E0027	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
3743b3bd-00dc-400e-886f-578759fb316d	2026-02-01	employee	731	阮曦颖	E0032	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
e2419fb4-17b4-4752-8d93-d1b9212c5d70	2026-02-01	employee	761	陆轩	E0062	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
742dadfe-654c-4825-aa16-cf14939c3b1e	2026-02-01	employee	783	靳宸杰	E0084	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
1d5849f8-87f2-45f0-adf6-bc782040f766	2026-02-01	employee	740	顾琪婷	E0041	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
8f7583f5-31ab-464f-962b-0bf20f876848	2026-02-01	employee	787	马安瑾	E0088	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
6d6c46d7-2d18-4436-a84d-bb8b9c5fa698	2026-02-01	employee	753	魏伟	E0054	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
7c5364c2-8ccd-4511-98a7-a1d5061c67d0	2026-02-01	employee	747	鲁桐珊	E0048	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
1d946125-3798-4d35-ae90-6c211543f5d0	2026-02-01	employee	790	黄皓宸	E0091	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
bf05c1bf-08f7-414c-b89a-e481d72ffd04	2026-02-01	employee	794	齐娜妍	E0095	\N	\N	\N	未分配	\N	\N	\N	\N	\N	\N	\N	\N	{}	f	f	f	f	0	\N	2026-01-31 17:01:44.795189+00	2026-01-31 17:01:44.795189+00
\.


--
-- Data for Name: attendance_shifts; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.attendance_shifts (id, name, start_time, end_time, cross_day, late_grace_min, early_grace_min, ot_break_min, is_active, sort, created_at, updated_at) FROM stdin;
7d33d5eb-b902-493f-b2ca-6513d3feb19a	晚班	07:30:00	17:30:00	f	0	0	0	t	0	2026-01-24 17:54:32.148392+00	2026-01-24 17:54:32.148392+00
8e44af22-4f60-4ed1-b9b0-5325dae19640	白班	09:00:00	17:30:00	f	0	0	0	t	0	2026-01-24 15:50:37.844238+00	2026-01-24 15:50:37.844238+00
\.


--
-- Data for Name: employee_profiles; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.employee_profiles (id, archive_id, payload, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payroll; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.payroll (id, archive_id, month, total_amount, status) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, parent_id, leader_id, sort, status, created_at, updated_at) FROM stdin;
15e61e02-6ef3-41a0-b858-21e1618f9632	徐闻工厂	b0aa5f36-a392-4a79-a908-e84c3aac1112	\N	10	active	2026-01-27 20:59:44.411323+00	2026-01-27 20:59:44.411323+00
f1b437fa-a799-4866-9478-50e15b961e93	财务部	b0aa5f36-a392-4a79-a908-e84c3aac1112	\N	30	active	2026-01-27 21:03:21.068578+00	2026-01-27 21:03:21.068578+00
821bae9d-d4d6-4f79-a2df-986400aaada3	英利工厂	b0aa5f36-a392-4a79-a908-e84c3aac1112	\N	40	active	2026-01-27 21:00:20.733454+00	2026-01-27 21:00:20.733454+00
8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64	总经理部	b0aa5f36-a392-4a79-a908-e84c3aac1112	\N	50	active	2026-01-27 20:59:19.590919+00	2026-01-27 20:59:19.590919+00
3ee73ef4-5352-4806-bfc5-002f2ac68564	销售部	b0aa5f36-a392-4a79-a908-e84c3aac1112	\N	20	active	2026-01-27 20:59:04.610513+00	2026-01-27 20:59:04.610513+00
427becfd-2d82-48d6-8171-195c7acaad53	采购部	821bae9d-d4d6-4f79-a2df-986400aaada3	\N	10	active	2026-01-27 21:05:12.19069+00	2026-01-27 21:05:12.19069+00
8c7d6883-4921-4ef4-ba45-8033103563e2	仓储部	821bae9d-d4d6-4f79-a2df-986400aaada3	\N	20	active	2026-01-27 21:03:18.147239+00	2026-01-27 21:03:18.147239+00
529af27e-6cfb-4dcf-be03-efe17c5bb285	质检部	821bae9d-d4d6-4f79-a2df-986400aaada3	\N	30	active	2026-01-27 21:02:48.169478+00	2026-01-27 21:02:48.169478+00
d26a3a93-e81d-4cc0-998f-d014edee55f4	生产部	821bae9d-d4d6-4f79-a2df-986400aaada3	\N	40	active	2026-01-27 21:02:09.756754+00	2026-01-27 21:02:09.756754+00
b0aa5f36-a392-4a79-a908-e84c3aac1112	南派	\N	\N	0	active	2026-01-27 20:58:52.006269+00	2026-01-27 20:58:52.006269+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, name, "position", department, created_at) FROM stdin;
1	林志荣	全栈架构师	研发中心	2025-12-21 22:48:47.338352
\.


--
-- Data for Name: field_label_overrides; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.field_label_overrides (module, field_code, field_label, updated_at) FROM stdin;
hr_employee	salary	工资	2026-01-29 00:01:12.786401+00
hr_employee	performance	绩效	2026-01-29 00:01:12.786401+00
hr_employee	total_salary	总工资	2026-01-29 00:01:12.786401+00
hr_employee	employee_no	工号	2026-02-01 02:57:25.771285+00
hr_employee	native_place	籍贯	2026-01-29 00:01:12.786401+00
hr_employee	field_2086	自定义字段8	2026-02-01 02:57:04.251947+00
hr_employee	phone	手机号	2026-01-29 00:01:12.786401+00
hr_employee	position	岗位	2026-01-29 00:01:12.786401+00
hr_user	username	用户名	2026-01-31 22:56:13.441646+00
hr_user	password	登录密码	2026-01-31 22:56:13.441646+00
hr_employee	department	部门	2026-02-01 02:57:25.771285+00
hr_employee	status	状态	2026-02-01 02:57:25.771285+00
hr_user	full_name	姓名	2026-01-31 22:56:13.441646+00
hr_user	phone	手机号	2026-01-31 22:56:13.441646+00
hr_user	email	邮箱	2026-01-31 22:56:13.441646+00
hr_user	dept_id	部门	2026-01-31 22:56:13.441646+00
hr_user	avatar	头像	2026-01-31 22:56:13.441646+00
hr_user	role_id	角色	2026-01-31 22:56:13.441646+00
hr_employee	gender	性别	2026-02-01 02:57:25.771285+00
hr_employee	id_card	身份证	2026-02-01 02:57:25.771285+00
hr_attendance	att_status	考勤状态	2026-01-29 00:01:12.786401+00
hr_attendance	check_in	签到时间	2026-01-29 00:01:12.786401+00
hr_attendance	check_out	签退时间	2026-01-29 00:01:12.786401+00
hr_attendance	att_note	备注	2026-01-29 00:01:12.786401+00
hr_attendance	ot_hours	加班时长	2026-01-29 00:01:12.786401+00
hr_employee	field_3410	籍贯	2026-02-01 02:57:25.771285+00
hr_employee	field_5458	工资	2026-02-01 02:57:25.771285+00
hr_employee	field_9314	绩效	2026-02-01 02:57:25.771285+00
hr_employee	field_789	总工资	2026-02-01 02:57:25.771285+00
hr_employee	field_1340	位置	2026-02-01 02:57:25.771285+00
mms_ledger	dept_id	部门	2026-01-31 20:57:06.007381+00
hr_employee	field_3727	员工照片	2026-02-01 02:57:25.771285+00
hr_change	id	编号	2026-02-01 03:02:45.319596+00
hr_change	name	姓名	2026-02-01 03:02:45.319596+00
hr_change	employee_no	工号	2026-02-01 03:02:45.319596+00
hr_employee	field_8633	自定义字段7	2026-02-01 02:57:05.433583+00
hr_change	department	部门	2026-02-01 03:02:45.319596+00
hr_change	status	状态	2026-02-01 03:02:45.319596+00
hr_employee	field_3986	性别1	2026-02-01 02:56:40.769599+00
hr_change	from_dept	原部门	2026-02-01 03:02:45.319596+00
hr_change	to_dept	新部门	2026-02-01 03:02:45.319596+00
hr_change	from_position	原岗位	2026-02-01 03:02:45.319596+00
hr_change	to_position	新岗位	2026-02-01 03:02:45.319596+00
hr_change	effective_date	生效日期	2026-02-01 03:02:45.319596+00
hr_change	transfer_type	调岗类型	2026-02-01 03:02:45.319596+00
hr_change	transfer_reason	调岗原因	2026-02-01 03:02:45.319596+00
hr_change	approver	审批人	2026-02-01 03:02:45.319596+00
hr_employee	field_7980	自定义字段9	2026-02-01 02:57:01.361361+00
mms_ledger	batch_no	物料编码	2026-02-01 02:56:22.35803+00
mms_ledger	name	物料名称	2026-02-01 02:56:22.35803+00
mms_ledger	category	物料分类编码	2026-02-01 02:56:22.35803+00
mms_ledger	spec	规格	2026-02-01 02:56:22.35803+00
mms_ledger	unit	单位	2026-02-01 02:56:22.35803+00
mms_ledger	measure_unit	计量单位	2026-02-01 02:56:22.35803+00
mms_ledger	conversion_ratio	换算比例	2026-02-01 02:56:22.35803+00
mms_ledger	conversion	换算关系	2026-02-01 02:56:22.35803+00
mms_ledger	finance_attribute	财务属性	2026-02-01 02:56:22.35803+00
mms_ledger	created_by	创建人	2026-02-01 02:56:22.35803+00
hr_employee	id	编号	2026-02-01 02:57:25.771285+00
hr_employee	name	姓名	2026-02-01 02:57:25.771285+00
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.files (id, filename, mime_type, size_bytes, content_base64, sha256, extra, created_at, updated_at) FROM stdin;
eb12d91b-f14c-4efc-ad44-37d602128f73	菠萝世家.png	image/png	75906	/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAMqBDgDASIAAhEBAxEB/8QAHQABAAAHAQEAAAAAAAAAAAAAAAECAwUGBwgECf/EAGYQAAEDAwEEBAgHCgsEBgcFCQEAAgMEBREGBxIhMRNBUZEIFBUWIlNhcRcyUoGUodEYIzNCVFVWYpKTNDY3Q3JzgrGywdN0daLSJERjg5WzJTWEpKXh4ydGo8LD8CZFV2RlheLx/8QAGwEBAAMBAQEBAAAAAAAAAAAAAAECAwQFBgf/xAAwEQACAgECBQIFBQEBAQEBAAAAAQIDEQQSExQhMVEFQRUiMjNSNEJhcYEGI6EkQ//aAAwDAQACEQMRAD8A6pREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBETKAIile9rPjuA95wgJsovNJXUkf4SphZ/SeAqD7zbGfHuNGPfO37VXevJKi37FwTKtXnBZxzulAP8A2hn2qB1HZRzu1vHvqGfao4kfJKrk/YuyK0ectj/PFu+ks+1POWx/ni3fSWfanEh5J4c/Bd8plWjzlsf54t30ln2p5yWT870H0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C7orR5yWT870H0hn2p5yWT87UH0hn2pxIeRw5+C75TKtHnJZPzvQfSGfannHZeq7UB/9oZ9qcSPkcOfgu+UyrSNRWc//AMVoPpDPtU3nBZ/zrQfSGfap3x8kOuXgumUVsF+tH5zovpDPtUfLlq6rlRfv2/am+PkbJeC5IrcL1bDyuNH80zftU3le3HlX0h/75v2pvXkbZeD3ovD5Wt/5dS/NK37VEXShd8Wspj/3rftTcvI2y8HtReTylRfldP8AvW/apvH6M8qqA/8AeBTuRG1+D0ovOK2lPKph/eBR8cp/XxfthNyGGV0VHxmD10f7QUfGIvWM/aUbkMMqIqYmjPKRn7QUelj+W3vTchgnRQ32fKHem+z5QTevJBMilD2nkVHeCbl5BFFDeHam83tTfHyCKKUvA/GCh0rBzc3vTcvIwToqZmjHN7R86lNREOcjP2k3x8k4ZWRUfGYBzljH9oKXxymHOeIf2wo4kfIwz0IvN47S/lEP7YUDcaMc6qD94E4kfI2s9SLyeUqL8rg/eBQ8qUI51tMP+9anEh5G1+D2IvF5Vt/5dTfvW/apTeLb119IPfM37U4kPI2vwe/KK3G9Wz84Un75v2p5btY53CjH/fN+1OLDyidkvBccorb5ctX5yov37ftUPL1q/OdF+/b9qjiw/JDZLwXNFbPL1q/OdF+/Z9qeXrT+c6L9+z7U40PyROyXguaK2eXrT+c6L9+z7U8vWr850X79n2pxofkhw5eC5orZ5etX5zov37ftTy9avznRfv2/anGh+SHDl4Lmitvl21fnKj+aZv2p5ctZ5XGkP/fN+1OND8kOHLwXJFb/ACzbfzhSfvm/anlm2/nCk/fN+1RxofkiNkvBcEVv8s2384Un75v2qPli3HlX0p90zftTjQ/JDZLwe9MrwC7W8/8AXab9637VHyrb/wAtpv3rftTjQ/JDZLwe7KZXi8qUHVXU371v2qYXKiP/AFuD94E41f5IbZeD1ovMK+kPKphP/eBTiphPKaM+5wVlbB9mRtZWRSh7XcnA/Opsq+ckBEyiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIitt4utPbIDJO4cOpRKSissmMXJ4RcXPa0cTheWouFLTt3ppmNHtK1XqjafThjoqbGeoDitS3vV9yr6ohkjwz2Lz7vUIV9up6VHpllnWXQ3/AHjXtFRSPEcsbsdiwC67W3ulLImg+8ZWt6Sgr7s4FzpSHdayC27OKudwc7K86fqFk/p6How0WnpXzvqTXLXdVXA7kRyfYsarLncalxLY85/VWzaHZ34u0GZwx7VeYNO2+lA6YNJHUuaVtj+pl+NTWsQRoh7bm/nE/uUni1xdzhf3LoVkFmiADoo+5VelsTQMxM7lk5p92TzuO0TnTxSv9S/uUPE7j1wP7l0X09h9SzuUOnsPqWdyjdHyOef4nO3idw64H9yh4ncTygefmXRfT2H1LO5OnsPqWdybo+RzsvxOc/E7l+Tv7k8SuX5O/uXRvT2H1LO5OnsPqWdyjiR8jnX+Bzn4ncuunf3J4pcPUP7l0V09i9SzuTp7D6lncnEj5HOv8DnXxS4eof3J4pcPUP7l0V09h9SzuTp7D6lncpU4v3HOv8DnXxS4eof3J4pcPUP7l0V09h9SzuTp7D6lncjnHyOef4HOvilw9Q/uTxS4eof3Lorp7D6lncnT2H1LO5RxI+Rzz/A518UuHqH9yeKXD1D+5dFdPYfUs7lHp7D6lncp3R8jnn+Bzp4pcPUP7k8UuHqH9y6K6ew+pZ3J09h9SzuU7o/kOef4HOvilw9Q/uTxS4eof3Lorp7D6lncnT2H1LO5N0fyHPP8DnXxS4eof3J4pcPUP7l0V09h9SzuTp7D6lncm6P5Dnn+Bzr4pcPUP7k8UuHqH9y6K6ew+pZ3J09h9SzuUOcfI55/gc6+KXD1D+5PFLh6h/cuiunsPqWdydPYfUs7lHEj5HPP8DnfxSv9Q/uTxSv9Q/uXRXT2H1LO5OnsPqWdycSPkc8/wOc/FLh6h/cnilw9Q/uXRXT2H1LO5OnsPqWdycSPkc8/wOdfFLh6h/cnilw9Q/uXRXT2H1LO5OnsPqWdynfHyOef4HO/ilf6h/cnilw9Q/uXRXT2H1LO5OnsPqWdyb4+Rzz/AAOd20dwz+Bf3L0RUdw9S/uXQBqLD6lncgqbGOUTB8yurI+SHrX+BoeOiuHqX9y9UdFcOH3l/ct4Cssnqmdyj47ZB/NM7lZXRXuUetb/AGmmoaGuPxoHn5l7IqGr4feXLbQuNnH82zuTylZ+qNnctFqYL3Kc1J/tNZQ0NX6kr2wUVV6srYIulqB4RtHzKYXa1j8Rvcr85DyVd83+0wiGjqfVle2GkqM/EKywXm2Dk1vcoi924fit7lbnq/Jm7Jv9pYIKWo+QvZFTTDGWq6eXqDsb3KIv9AOxTz9Zn8z9ihDTyAfFXrjhk4eiVIdQ0Q7FAakpB1hTz9ZRwk/Y90cD/kr1xREDJVqGpqQfjIdT0o5OCL1Cso6Zv2L7GzHUvRGz2LGfOmn+UFHzqp/lJ8QgZvTz8GVtVVuB2LDzqyBvJwKj53Q9rU+IQK8tPwZkCO1R3vasM87ou0J52w9rU+IVjlp+DMi9U3OWIjVsPa1BqyE9YVXroMctPwZO9688jvYsfOqafPEhQOp6c9ao9ZB+5ZaafgvEpXild2BeM6kpFL5yUvY3uVXqYv3Lqia9ieYv6mleOYyfJcvT5xUp5hvcnl+j6wO5ZSvi/c0UJL2LTO6b5Du5eCY1Hq3LJDfqA8wFI69UB6gs3bF+5dOS/aYlN4wf5ty8cran1bu5ZwLtbjzaEN1tfW0dyo5Rf7jSNkl+015M2r4/enLxSsq/UuWzjdbSecbe5Sm42n1be5ZSgn+41jc1+01VJFV5/BOXnkirPVOW3RcbT8hvcom4WbHGMdypwV+RotTj9hpt1PXD+Ycqfi9b1wPHvC3N49ZfVt7k8es3q29yh0L8i3NP8DTPi9Z6p3cni9Z6p3ctzePWX1TO5PHrN6tvco4C/Ic2/wATTPi9Z6p3co+L1nqn9y3L49ZfVt7k8esvq29ycBfkTzj/AANOCmrfVOVRtNW+pd3LcHj9m9W3uTx+y+rb3Jy6/Ic5L8TUjKWs9U7uVVlLWeqd3La4uFm9U1BcbR8hvcq8svyI5yX4mr2U1b6pyqtpqz1Tu5bNF0tPyG9yC52n5De5Q9Kn+4c3L8TXDKWs9U5VWU1Zn8E5bD8q2n5De5PK9qHJrR8yjlF+ZXmpfiYIynq8cY3D5lVZBU5+I7uWb+WLX8lvcnli1/Jb3Jyi/MrzEvxMRZBU8PQd3Ks2OpGPvbllIvVsH4o7lMLtbncmjuUrS47SK8Z/iY7TvnjOXNIVzpbnNERkFe81FHP8RoURbmT8WOaArRrtg8wZnKcX9SK9NqR8YHoBXqhvzJsb2B7Fjxsx6nNUopjCS0DPtC7qtbqqvq7GE66pdjOoKyOUDBC9LSHDIWB080zHABxV8oK+VoG+che1pvU1Z0kjjsox1RkKLzwVLZfeq+V6sZKayjnaa7kURFYgIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIhQBSSyNijL3cgqVZVRUkJkmdugLTO0PaS6GR1LRv4HI4LC++NKzI6NPpp3yxEyfXuuqa3wmKkfvSjOcHHFaQu+srjd5HMdIQHchnKtp8oXqq3hl28VsbSGz9j2slrGAY6yvAv1Vl76dEfQV006OOZdWYNZtK3C5Sh4aXNPNbKsWhqenax1cwNPWSFklVW2/TsBbCWFwHFYTfdZ1dW90VMw46sLilYovHuZyutufTojNJfINrYSwxh49islbrNkfoUhaT+qsVo7ZV3VwdO57QeeSsht+i4mAOMhUqu+x5SwjGShH6nllvqtTXep4RZ9i8D6i+1DsuDis6gszafAaxhA9i90MRaAOib3LoWg/KRXjJfSjWzaW7ycXBwVUW25EDIctmNZkfgm9yqdFn+bHcrrQV+7Dul4NYeTbl2OTybcuxy2f0X/AGYTov8Aswp5CryV40jWHky49jk8mXHsctn9D+oO5Oh/UHcnIVeRxpGsPJtx7HJ5NuXY5bP6L/swnRf9mE5CryOPI1h5MuP6yeTLj+stn9D+oO5Oh/UHcnIVeRx5msPJtx7HJ5NuPY5bP6L/ALMJ0X/ZhOQq8jjyNYeS7j+snku4/rLZ/Q/qDuTof1B3JyFXknjzNYeTbj2OTybcuxy2f0X/AGYTov8Aswo5GryOPM1h5LuP6yeS7j+stn9D+oO5Oh/UHcp5CryOPM1d5LuXY5PJdy7HLafQn5A7lDoP1B3JyFXkceZq7yZcuxyeTLl2OW0+g/UHcnQfqDuTkKiOPM1Z5OuXY5PJ1y7HLafi36g7k8W/UHcnIVk8eZqzydcuxyeTrj2OW0/Fh1RhPFgecYUv0+tEO+Xuat8nXHscnk649jltPxVvqwniw6ox3IvT62RzDNWeTbh1tcoeTbj2OW1PF/8Asx3J4v8AqBT8OrHMM1Z5NuPY5PJtx7HLaXi59WO5R8X7Yx3KPh9Y5hmrPJlx7HJ5MuPY5bTdAG/zYRsG9/NjuT4fWOYZqvydcuxyeTrl2OW1PFv+zHcni36g7lPw6vyOYZqvyZcuxyeTLl2OW1Og/wCzHcni/wD2Y7lD9PrQ5hmrBbrj7VHydcPatpeLD1Y7k8VHqx3IvT6xx2ar8nXD2p5OuHtW1fFR6tvcnio9W3uU/Dqxx2as8nXD2p5NuHtW0vFh6sdyeLD1Y7k+HVjmJGq/J1w9qeTrh7VtTxYerHcnio9WO5Ph1Y5hmq/J1w9qeTrh7VtTxUerHcnio9WO5V+H1jmGar8nXD2p5OuHtW1PFR6sdyeKj1Y7lK9PrY5hmq/J1w9qeTrh7VtTxYerHcniw9WO5T8OrHMSNV+Trh7U8nXD2ranio9WO5PFR6sdyh+n1ocdmq/Jtw9qh5NuHtW1PFh6sdyeLD1Y7lHw+snjM1X5OuHaU8nXDtK2p4sPVhPFh6sdyfD6xxmas8m3D2p5NuHtW0/Fh6sdyeLD1Y7lb4dWOMzVfk64dpTydcO0raniw9WE8WHqx3KPh1Y4zNWeTrj2lPJ1w9q2n4sPVjuTxYerHco+H1h3s1Z5OuPaU8nXD9b5ltPxYerHcniw9WO5OQrI5hmrfJtwPy/nTyZXjllbS8WHqx3J4sPVjuT4fWTx2zVvk64+1PJ1w9q2j4uPVDuUfF2+qb3J8PrJV7NW+TLh2lPJlw7StpeLD1Y7k8WHqx3JyFYd8jVvk64e1PJ1w9q2l4uPVjuTxcerHcnIVkK+Rq3ybX+1PJtf7VtLxZvqx3J4s31Y7k5CsnjyNW+Ta/2p5Nr/AGraXi49WE8XHqwnIVkceZq3ybX+1R8m3D2raHizfVjuTxZvqx3JyFRPHkau8mXD2p5NuHtW0PF2+qHcni7fVDuTkKfI48jV/k24dhTybcOwraHQN9WO5Ogb6sdychT5HHkav8m1/tTybcPatndAPVDuToB6odyjkafI48jWPk24e1PJlw9q2d0A9UO5OhA5RjuU8hT5HHkax8mXD2p5Mr/atndEfkDuToj8kdychT5I48jWBtlw7CpXUNzb8QOW0hD+oO5SPix/Nt7k5CrySr5GrS28w/FEiqxXW9UpG8XgLY8kY9WO5eWahbPnMTe5Vfp6/bInj57oxik1fUxgeMudw7Ssmt2qqCcASOAcrXV6TiqSSSGKwV+k3U2X07yXDsK5p6a+t5XVEf8AnPv0NpUtVSVTQYC0k+1ehkLg7qAWlKe7XG0SgYfge1Zvp/WgqgyOqdg8lnC3EvmWCk9O0sxeTYUDt3AHMK6U73lo3lYaSrp5WB0L949iutJLvjGML3tHfnpk4LIvOGXEFRUjMY4FThesnlZOYIiKQEREAREQBERAEREAREQBERAEREAREQBERAEREAVqv93htFL0szmg44ZVwqpm08D5X/FaMlc/bWNZtrpDTQOPokDIK5tVeqYZ9zq0mnd88exT2ibRH3Bj4KF7QeIy3qWD2Kz1V8q2mRrzvdblNpbT1ReaxvokjPYt6Wm1UGmrY11Q1u/jsXzll0rnun2PelOGljw611PLpvStJYaRstQPSHaVaNUayjj34KPDXdreKs+q9VVF2mfT0JO7yOOSq6a0yX4qK9ud7tC51vueyvsc2FH57XlloorVcb3N0sj34PtWa2mwxW5renY1+OZV6p6SKABtGMcFcaekkk/DcuxejTpa6e/VmM7XJ/weKnigfgMYAPcvVHb3h3okgdiucNLDEButGVVJxyW7n4M3LJ5IqQMHp8VXbDGMeiFUJyoFUyVI7sQ6gogRt5AKTCYQgm9DsT0OxS4TCAnwxQ3WdgUApVBJP6HYExH2BSKBOEyCpiPsCYj7AqeVFMgqYj7AmI+wKmikYKmI+wJiPsClUEBPiPsCYj7AoKCEE2I+wJiPsCgo4QMj97+SFECM9QUoCjj2KxBPus7Am6zsClRTkgqAM7AmGdgUqIVJsM7AmI+wKVEBNhnyQmI+wKVFKBNiPsCYj7ApUbxUruMk4Yz5IVOZ8Ubc4BPYozytgjLnKyioNVUDo/i5Vn0Lwg38z7HuwJ5ODV7442MaBhSwRCNnLip3BCkpZeEMR9ife+xS4TCsTgmxH2Jux9ilRBgmDY88lOGx45KmFMOSFWibdj7E3Yx1KCghA3Y+xN2PsREJGI03YuxEQE27H2Jux9igiEEN2PsTdj7ERCSbEfYm7H2KVRQgjux9ilxH2IoISkN2PsTdj7ERC2CO7H2JiPsTCYQjBDdj7E3Y+xQwmEJwR3Y+xN2PsUuEwoGCbdj7FDdj7FDCYUNDBHEfYmI+xQRQCOI+xMR9ihhMIQN2PsTdj7FBFAwR3Y+xQxH2ImFBJDEfYmI+xQwmEJJt2PsUu7H2KKlKAjux9iYj7FBMKGCOI+xQxH2KBClwqkk2IuxMRdikwmEGCOIuxTYj7FJhQwjGCbEfYmI+xS4TCgEd2PsTdj7FBEBPuxdibsXYpEQExbF2JiL5KlRAHMiPUqckDHNw1VFEITlots1A8ng7gvHJRmI70g3mq/7ylka17cEKymyUzEq2jpqiMs6Ju8e0LDrxpOZrjLTZaeeAtpTUDHAlvNW2oimj4OJ3FWyqu5YkjSFjg8o1jaNQ1dkqTFVFxHL0upbV0/qGK4saWvAOO1Y5e9PUldTudE378sCkFfp2uyd7osrzZV2aV5XVG+K749VhnQ9NUkEellXJjw4ZC1npDVMNfExr3ASYxzWbQVJaQ7OWr19Jr1JYZ5V1LhLqXhF52TB4BaqjX5XrRsUuxz4KiIi0ICIiAIiIAiIgCIiAIiIAiIgCIiAIiIAoPcGNLnHACiVrraJrGO2QyU8b92TlwWVtqqjuZrTVK2W2JZNrGthSwy0lJLkEFp3eGVpe0W2ovVa1zQTvOyc9aT1FTerrh2Xl7sLdGgtM09loxVVLByJ9y+b1Frvsy+x9GlHRV7V3ZdLJbabTdnE8jW9MB8619qnUNTeawwUpcYycAtXu1xqR1fVOoqNxAzj0V7NF2IQ0/S1LQ5+M4K5IReonsj2ObGxb59yppjTEVM1s83B3MZCy+Nr5B0QHoexU4InVL9xgxhXumgEMYB4u7V68YRqW2JyybbyynSUbYWgkcV6t72KKhhQ+pRsKCIoAREQBERAEUEQEcplS4TCq2SRyoIGu7F6GQMIyXBvvUCTS7nnwpwxzuQVVzKeJuXStCt9Ve6KkaT4wzgp/ohZn9CPb0L/kqIp5DyasSuG0OjpR6MjHLHavbBDDndGVZxklk66/TtZYsxibSFPKOYQRjrC0rU7an+nutPzDKt52y1J+LG8/Mqb17nRH0TWyWWsG/ejZjkpeiZ2LQnwv1h5RP7lO3a9V5/Bv/ZV1NEv0PWI3wYifihOif2LSUO2Cobjfjf3K6Ue18uxvxuGe0KV17FJ+j6yCzg230D8clIWObzCwe3bSoqo4cA3PWVkdFqKlrA3MgyVfazinpL4fXEuZOECrRupZG7zZWu+dJImcOjcD2qqx7HM5LOCmijuEDkhGOasSEREwSERFICniYXDIUirtIio5XHkG5VkVkYnrC4iOARRu9PkvRo+HpaMTO5rXNddHV+o3U5dkb+OC25p2Doba1oGOCs0enqqnp6IxfdnrPA4QcVK7i5RRHmYJsJhRRSSSIoooJyQUURCGwiIhAUCplPG1pzvED3oRnBTRVpGtDctIPuVJQRnJBFHCgpLBERAEREAREQBERCwREQEDwRRTCAlwmFNhMICCgoqCEhQJwoqCgEEUyICVERVICIigkYTCYTCAgiIgClUylKqERUMKKhlQCVERQWIIiICVERQQEREAREQBERAEREAUVBEBMFLLG2ZmHBTKAKElqqqV1P6TOIVmutugucDmTgBxHA4WXuw9uHDIVouVAeMkWfmVvqWJFk/c1BdLfU6drRJAHbmc4C2No7U0dfTiGV43+XFRrqOO6QOjkaN4DGStaytqdP3gObvdHnmvL1FMtNLiQ7HTHF0dku50BHKWNAC9MVQA4cViWl72y5UjS54LsK8mTd4rtp1TSTT6HmWV7XtZkUcgdyVRWWgqhv4ceCvLTkZC9vTXq6OTCccMiiIukoEREAREQBERAEREAREQBERAEREBSqZ2QROfIcNAyuWdqlc+qv8AOQctJ4LfO0m7tttofh2Hlp61za0vvd9cMlxLl4/qluVsXc9z0mrGbWZpsu01449lW78XrIWW7QNQNoqTxWldhw4Egq5adhFh0/JwAduf5LXTg7UF8kafSDXZAXhWN4Va7s1cuLY7Jdke/R9lfUymsqhluc5K2FHHl4ZAMM7e1eWgp20tGKdnxufBX21U25CHP5r1KqlTBL3Oaybm8s9VHTsgZlo9IjiqjjkqJPUoYUmTCIikqEREJCIiAKITkpHOUNkk5UqlALjhvEr0Rs6Ju9KMMAyVXuVk8Ipxt33YVd0HRN33uDQO1Y7f9YWu2RO9PDx7VpbWW1apfPJDRPdun2hFE7NL6fqNU1hYRvC66soLU1xkkYcc+K13qLa1SNLo4XNcfYVo+svl2v025vPeTz3VcbLoa5XGQOkjIYesqyWD6Cj0bS6eOb31LpfdpVbVvd0Di0e9WKKsvt3l9B8p3uXBbj03sho8MNUxod1krYls0Na6Bo3WsJHWrNpdyLPV9Hplsrjk5xo9EX+uHp9Jk9ZCyS17J7i8NM7HE9v/AOxXQ9PSQ0gAja0D2BVnVBbyCqn1ymefb/0eok9tSwjTVBspa1oMsQV5ptmNCxoD4QtlipcfYoGpKvn+Dkn6trJd5GDQbOba0cYWqsdnlsx+Casz6clOmKj/AAw+I6n8jA5tnNA74kYHuCttVs2ic0iOLuW0GznsURUuaeCsmWXqeqX7jStZs4r4RmlbgBWSo0jqSkcXQmUY5LofxlxPEKD3CVu65rcKzbN4es6mKxJJnPNPV3+0vb4yXkDn14WV2baSykwyrbnHAkrZVbp2jruMjR3LGLps1tswL2jj18FbKaxg1Wv0t6xdHD/gutn1zbrkWtYQ0ntKyONragb8bhhaQuukK+0vLreCQDluOpUbbqa/2yYMqWubGOBJyjil2MrPT65rdp5f4bzkjLDxUixbTutqCrjayqm9M8OKy+GWnrIg6mdnrTHk8u2E6XiaKKKo+JzBkqmpKpp9SIGVC5SFlqqN35J/uUQVJc4zJaKjd62n+5QyF9SOdNPzmTXjg4/j/wCa6Qto/wCiNwuU6es8n6+c6QkAyYHeuodK1Ta21se05GAoi21ln0Pr0cRrl7YPWimJwSFFaHz4REQkIiIQQKgolQQEygVHChxQhkwb973liOo74+AuZAcEdizIcaZw68LXt5pBFVPfN8U9alLLwb6TbKeJlXTuqd+o6OodkHhxWc5bI0FnIjK1m+2QwweNxczyWa6PndU0bXSccDCSWHg01lUILfDsXdo5phUGVkPSlhdxC9HxhkclXBw7sdyUlMphMIaZIoiKBkIiISSuUFOikgkRTomRgkUUCKSSKIiAKGFFEIJFBTKCgsQREQkgEKiigEqKZFUglREQBERQSEwiKAMKQhTqCBMlUFMiqWKaKKKAQREUEEqIiAIiIAiIgCIiAIiIAiIgCiRkEHrUFElSSWa405p3dJHwB5rHtSWuC40BLGffsdSzl8bZWFrhkFWGWLoKktPxVZpTjsZdSaeUatsNxnsVz6CQnczjicLcdNUtrKSORh4uGStZa3tTHTGpiHI5V72cXXxiMxSu4heO4Ombrl2ZvbBWwU/dGXmfoZcLJrXUCWEceOFiFwB6dxCuFircODSV06DVcK/ZJ9Dz7K3JZRloRQacjKivqzjCIiAIiIAiIgCIiAIiIAiIgCkmfuQveObQSp1bb1VspqOYOcATG7rUSeFkmKbeDRO2DUAqp/Fmv4jhgdqtWzSzGWvbUPZwA59qxXUsktXfp947x6XuW6dE0LaTT4nxghucr5W6xzscmfTyxp6FFe5S2g3RlNEKWEhriMcFZtC2/o6k1MjeD+OVaNRzuuV6bukkB26thWymbBboRGFnpIcW1zfZHJN7IKKLpS0+as8OCvZw1oAHBeWhjDYgeZPWvQvSk8s5WERFUgIiIAiIgCioIeCMECcoyNz3gAKZjN9ytGptT0thonl7gXDrVOrfQlRlNqMFll0ra2jtkL5JZgHDt4LTmu9rDYpJKalkz/RWvtoe0Gqu1ZIylmIZkg9ixCx2ivv9cGN3nuJ4krSMUu59FovSYVLi3k92vNwvdW529I8nqCyTRuga2+TNdURyAHtW1dn+ytlGyOaui3yeOXBbZo7fQW+JrKaIN3eRRtLsTq/W41f+dBgOlNllJag172gu/uWwqalpaGMNZG0OHXhTSVD+TTwVAkuOXHKr1Z89dqLtRLNjPQ+ZrvigBUnElSAKYKUsGSikOJ58VNglAFNhQwSgJuqIRSWINU4Clap1Yqwo4UFFSVAUruKmKgFZEkuCetVI3FpyeKhhFJD6npEkW7xjBKsl505R3aNw6JrXu6wFc1MHubyKshHMHug8M1FfNnE1A7xilc445BeC1auuVgqmwTRnoxw4rd7N2U4mAc3sKs2oNL2+408gZCxshHAgclMmmsI9CHqO/wCTULKJNPappbvAOllY1/YeCvpjaW5YQQtH3XS11slSaiB/3lpzgc1k2k9fxxObR1Z9IcOKlLoUt0eU7KHleDYxBHNVXenQyN7Wn+5IZYq6BskLm+kMow7noOQ83PU5N2r2ma03x1Y1uAXZBC3VsPvzK6wthfJl4AwF5NuOmG3C1GaBnptBOVprZdqKfT99FJKS1u9jBKh//D6ybj6hoVt+qJ1xLGQc9SkChbquO40Ec0Lgd4ZUXDBUnyvWL2siigooWIoiKCQiIhQjhMIhOFOCGTt+pWPVNo8fpS6LIcB1K9NBccBS3Gqht1C987wOCsoyfVEQco2Jx7mk5774nUi3zPIO9jitq6LNM62Dckb6XPiuedXOffNVO8n7xBceIKzK13Ou0xQiOYPzjkTyUxit/XufQ6zSKyqKXSTMv1bVNtdwBjlyHnllZhp+o8btbJOfDmtMskq9UVzMBx45yt0aepPELVHC85cBxwpawzytXVGupR/ceoqKiVBVwci7BERMEkMoooowCCKGUyowWyRRRRMDJBFFEwMkERFBJIohRRSQSoiKAMKGFFELEuEwpkwgJUVRFGSMlIqAUxUAhYgiIoaICIiqCCIigklwmFMiDJIimRVBTcpVMVDCgkgijhQUAIiIAiIgCIiAIiIAiIgCYREBELx3SHfh3gOIXsCEB4IKnsWRiF2pBUWuQEZdha8sNRJaLuY3eiCVtSvic15jx6JWuNd0gpqqJ8YIdzyuXXQ3RVi7o6KJJPa/c2e6RlRbGSt4uxzVrpZjFUA5wvPo2t8atbIZDk4U90AppwF4epk4uNyKbcScTYtqqBUUrTniBgr2hY1pKq6WLcPPCyVfcaC5X0Rmjy7Y7ZtBERdhmEREAREQBERAEREAREQBa/2n3DxLcGcb8Lv71sBaM8IOvkpbpbYo+T6d3+Jcuss2VNnZoa+JcomtbdELjfHvaMgyLdEsviGki0n0g3BWrdl1J41cwXcTvcVsHXE/QUbqYHBIxhfL2vo2e1qHmxV+yMa0tTmrqXSEZIK2Vb4t6NsfYsL2fQ4jkcRxJ4LPbYz76V3aSGynPk4rnmZc4R0bA3sU6OHAJhamLJUREICIiAIiIAqsMTpG7w4KWNuXgn4qx7XOq6bT9A/ckw/GeBUYy8IKMpyUY9ynrvVdHY6J7Q4dJjBAK5b1prGqvdXI0vO5nqK8+ttVVF8uDyJDuAnrV22d6Jqb1XMc+PLDxGQuiEEkfTaXTQ0cOJIo6H0XWXyrY/BDCetuV03o7RVFZqFhewGYcST2q6aY05SWChYI4gXY4+1XKSTfdnksZyz0R4+r9Rs1Tah0RPJUOaA1nxQqBcXHJQhFVI85RwuhFERSWCmREBFFHCggIlQUQogKyRICmUMYGTyUvlGghduyyhrvapwZvPsidRVUS08rA6NwLTyIVMjB4KyRVEERFOC4RHvjhw6c7rVMyutzzgTMz71JGf4JVFVSYHg9G4H3FU8KyfQKSZDKqRyOYctUGhChV4ZPNFFWRGOoAIK13rLQsQaam2DEoyc9a2Fjiqsb91WTRaq6dLzA0dYNSXHT1xENxc5secYPJbisl4o7zTNkpntccZVh1po2nvFPJNE0CYAu4DmtR0N2uWiLv0JLvF84Wiipdj0JQr1sd0OkkdC1VI2sifDUDLCMLl7bBomptV0luFHG4MzkboXR2lNR0l5oI5Wzt6U82kr3aitEN4tslNOxrg4cCQqNZWDn0ers0V2JLp7nP2xXaQKZ4orw88cNDieS6Kpp4bhSsmgLS1wyCCuVNpmzer0/Wvq7c1xaHb2GcF6NA7UrjaJo6K474jBwd5Vjnsz0dXoo6tcfTs6gewsPFSqy6e1jabvA0ioaH9hWQNmpZWhzHgj2K2DxJKVbxJFNFX6Jh5BQMR6gq4I3ooqGVXbEOsKZwjYMu4KcFd6KCj0bn8klraOJpL5WjHNYjqrX1stNM/xeoY6UdSvGPUvCE7GlBGVXCtp7TSGaqeGgDPFc97T9eSX+r8TsznE53TulWLVmvr3qatdR07ZDE8luGhZ7sp2ZiBsdxrQ1z3cTlTKWXtR7On00NBHj3vMvZF42TaPcyhjq7g0ifg4khbCumnLfcT9/bkq5sbHTQtjiaGsAwAFJvK2cLB5V+psvs4mcFut2n6G2nNM0Dh2K4HhwCFxKKnuYPdJ5k8hERQApVMpVJIREQBFFTtZvdSgN4KaKu2LPIKR0bgTwUYZG5FMhAMIQgCNYJyQJwohVGR7w4jKGJw+K1V6sjeikVADCmcxw5qCYaLEEUUTJbBBERASoiKCwRQRAHdSlCnIypcIAig9zYm70vBvavBPqO0079yWdocPaoYWX2R71KTnkvNBf7TPgR1DST1L3ZjkYHRHIKqQ8ruikimII5jCgqjcQRRRBggoKKgoLEpUMKJUFVkjCgoooBBEUEJIZTKYTCgEuUypsJhCSAUxUMKJREEERFICIiAiFFnAqAQKQeC4Qkyb3UsN1ZSiqYSRndCzyrGYSsbq4RJDM53UCjW6Diy8JYeTEdn9YYrkYHHg0rLNTNzUha/sUni2o3nOOK2NcYxU0rZhx4L5zUQcqXBd8nRNfMpFbR9T0UobngtgMdvNyOS0/bqp8Fa0N7Vtm3v36SN3aF7f/ADeo31OrwcGtr2vJ6URF9McIREQBERAEREAREQBERAFoHwjRm/Wof/07v8S38tBeET/GOz+2Bw/4lwepfYZ6Hpn6hf6eXY9TBlS6RwXu15L0l56POQvRszhEcRI54Vo1RKZdS4PUcL5m54ikepL5rmzJtIQ9FByxlZjbmHeLupY3ZGbsbPcsqpGlsYXsLpWkcM3l5PU7moKGUyqlCCIiEBERAFFgL3YClcqj3toojPKfRwquXsGzwakvUNmtE73yNa8DgD1rkraNrGovtxkYJXGMHq61l22vWU1TXvgppMRk4ODzWo7dRT3KsbHEC4k4JWsIOPVn0Hp+lVEOJPuy/wCgNOS326NjbGSwEAuXXWi9OU2nqBjOjb0pbjKxzZLo6C1WVlQ9mJSBxWe1UvSP4cgonP2R5uv1cr5cOHZEr5HOJBPAclKFBRCqjiSwEREIJkREAUQFBRllbTs33/FQgihXgbqm3Nk6MuaX9i9PnBRHluq21lXvj7FYJnCk8u0XymqZt9os/Gap2vwRmf4laqG5QOd1hcxbVdSVdFeHCGYtG9yC6NvF+o4rdKd5p4da5F2sV0dbeZHRcg5axhhZZ6npMczbkjLtK7WaqkdFFI8yAnBBXQ2k7m6921lSW7uRyXI2y620tddojVje3XAgEZXXWnq2gt1sjp4zjHNX25WS3qkIRwq49S7FpHNTRjjxXm8vUJ/nG94Uzb7RHk9veFmk8njPe1jBi+1i4uttk6Vjt07q5nbr+viqHls34xW69u19pp7GYoHgndPWuV4GdNNuZ9Iq2Gng+k9LpjwPnXU6O2c7SJ7nNFC8Ekda3tTgzUrJcYJ7FpDYbZrZRwsnqQ3pDh2XdS3T5doYzutkbujsKttPH9RjFW4rRW3SOoqAafaqPl6hPKRqlmv9DBA6Rz24CjacWJeD2tjzzUCMOwFqbV+1mio6voYHjIPLIWfaMvcd9tMc7SN7GTgo49DSdFkI7pIvzHkcOpYzrbSdNf6B25EOmAyCO1ZJI3cPFV6fex7FMG4vJnGx1tTj3OWoK646A1AHTb/Qh2PZhdCaJ1TT6ltwqIpGZ7Mqx7VtDxaitT3QRt8ZaDjhzXPOltQ3HQuo/EqlzugDsY6lpLGT2nCv1KvdHpNHXtdQ01bGWVMTZARjiFprX2yBlxe+e3sDCPSGAtqaVv8ATX+gjmpXgktBIyr41jvxioUW+iPKp1F2jn0fVHFdzst90hWb5le2Np4Zyr9ZNrdRRBhllLnNW3tu9upWWF8xbh5DuS5Ba3flcwc88FWXyPCPptNOGuq3WROi6Xbw4NwWBexu3YYH3sLXGzLZ3LqB7ZJGndWxpdih6U/exj3KVTZPqjmtq0Fctsu5Sn2845RjvVsrduDpwQMDPzrInbGoYaJznRDI6sLSe0SwwWOrfHG0Ag9SOqyCyy1FOhteIIut/wBplbXZ6KRzSvXozRN41fL4xJJLuHisF0lavK9xji3d7iOC7R2aWGKz2GINaN9zRngrwi5rJbW6mGirxUlktmitAUVjgY6qia+UDmRyWcjomR7kLQ1vYBhVZGOd7VKID1lWkmfM2XSte6bKIaSjmlqsWqNW0OnInOqnDI7TheTSuubdqM4p3tDuoZ5qhZVWOG9LoZMiqPZgb3UqYCFE8hFFFAIIqgaBglwCqFoeMBwQjcedFUdA7qKpgKWsE5TJmN3lheuNax6Za8SOaC3tWcRNXNnhFuk8beAc4RJPudOirjdcoS7F7otu0L6xsTgwg+xbL05rmgvUbSyVgeefFcN53feth7JfKs98jZC55jyBjKiDbPa1fplEIOUVjB2RweA5vEFTOG7E93yRlULWx8NFG2bi8NGVXqz/ANAlI+SUZ81LvhGtdZbTYNPPdEXNJHaV4NO7ZKO4Oa2R7GjsK0dtcmfJeZmv+WcLX8M00ZzTuLXnsKNbZdD6Wn0yidKbXU77tl4prnE18DwWkZXsI5laH2AMu88TTVOeWYGQ751vt4xHjrUSTzk8PUUqme1PJRHMo5RAUSqGZBFFEwQQRR3c8FCSVlM0vkcAB2qME7iBbhSngvPDdKarf0cLgXewquW4KlIdfcioj4wUvJGu9IKC2TwaqEnkh5i54K4/15dLhDepGdO8NbywV2TfB/6Mk9xXGe1M4v8AIOwlGuh63osurLXb9UXKlmY7xl5A7St77J9pfj0jaOoeAeQBXNA5ZWX7MBI7UkYgGX8MKmD19bRXbW8o7aOJmhzCMYyqR4FUdPiSO2R9P8cNVV7uOVGD5Bd2gihlMoXIqUlTMaXuwFVdTuAzvBVbwRuSKCKB4FFBYlUQoIqkhQKIgJUREJGUymEwhJEqCiVBQiAiIpAREQBERSBL+AcrFKzEEvtBV+d8QqzVzd1sgPWrw7lkaqro/Frs6Tl6S2daiJrAXc+C15qdm5JvfrLONJSGTT5aexeJdHFk1/B0z6wTLEz0a/P6y2zZpg+kiA+StVSN3az51sbTT8sYP1Vn/wA7ZstkvJjresEzIURF9yeQERFICIiAIiIAiIgCIiALQfhD/wAZLP8A1J/xLfi0H4Q/8Y7P/Un/ABLg9S+wz0PTP1C/0uOzrhTfMscvx/8A3p/tLI9nf8G/srHL9/Gr+0vmLe0f7PSX3Jf0Z9bOAZ7gsoh/BNWL23lH7gsoh/Bhe1JYSOGRUREVCoREQBEUQMuA7UBUijMhwOpa52w6qit1mfTxP3ZeIzlZ9c6xtso5pHu3cMJC5B2r6jlud+lYyQlgJyrVwTeWdWhpVtu6XZGF11XJXVTpZCXPceC3NsG0s6rq21NUz0M+/K1Bp6kdW3enhaM5dyXaGz6yx2mxU0jY2sO7x4LWySUT1PUNRwq3Fd2ZK4NpqcQRgBrRjgF5Qqkz+keT1KRciPBgsIiotUFFquSwiIpIJkRMFATR43l5r8wm1TObza0lehvAqaqYJqOWI/jNIUro8kPumcaas1NWUt/nayQ4aepeNmvbi3lI79pZ/rDZjVVt9nmiZ6Lj1LyQbHKx7M7jguhPofQQvo2rLRhvwgXP1rv2lAbQLnn8I7vWbfAvWfJKmGxir+SVO4nj6fyjBqjXtyniMZkcQf1ljtTUyVUpfK7JK2DqnZnPZKB1RJwAWtc4m3G5znCl5Z00zrazEuVou09pnElO4gg5V9ftDuY5PcPnXv0js9q9Qxte1vByyaXYrVsdjGPnTqjO7UUqWJYMI+EC5k8ZH/tKb4Qbpj8K/vWZ/AzVhTfAxVCF0jgcNGSmTPj6d+6Na3PUtddWFlRI4s48CVaYnGJ4eOYOVc9R2g2eufATxBPBeS0UElzro6aFpcXHqUPLOyDhGGUXyj1vX0LGsgkIA7CqztoV1c7Jkd3rMabYzVy08cpBy4ZVb4GKv5JVjid2nby2jCBtAug/nHd6ln1/c5oyxz34PtWb/AxVk8io/AxVnqKE8bTeUagrKp9XKZJHuJPatybENaS0tdFb3OODjA7VQfsYq+w//t86yvQOyeotV1ZWP5NA5nCFNTqdPOtps6CmPSUQkHHIyCtJbQ9otXpysdEHPac4C3jTtApWRu6m4XO3hG6flke6pgZlT0fY8P09QnbtmiraNtEk0Q6dxO8MLT+0a5xXa6Pq4jkud3LExT1cZLWxvCrNt9dJ8aCY/MolM+jp09dct0EbB2ZbQ59PPEL3v3Dw58FuKHbDAIQXyYOOorl7yTX9VLL3KcW26epnx7laNmHkyu0dVksy7m3dpG0Fl7ozDHJkEHrWmY3blSHnllSzMmicWy7wcO1SsDpHBrRkqk5ZeTr09UaYbUb22ZbQKew0zGOcBjhg9azqTbNCx2N4Fcttt1ycwGOnlLfYo+S7qf8Aq8/ctI3SSwcV2gpsluZ05cdsUE9vkbkbzhgLn3XV9N6uD5MnietWKWiuELd6aGZre0heQk5wUla5LDNtLpKqMuJkug7nHarq2aU4AI4rf9Dtbp4adrBIAAMcFzBBS1FQ/EEbnH2L1eS7oP5iVVhY4roTqdNXc8yOm/hhp8/hPrVGs2yQshJbKuafJt09RKoOtdzdwdTyn5lbjM5fh1JkevNaVWoqyQOkd0WTydwK8+g9TzWC6Qua9wj3uIzzVjFnr8elTSD5lK62VzCCKeTIPYs93XJ3cOChw12O7tGX6nvllgkjeDIWgkZV6eN0rQfg61VaHCKra5rB1OC6BkwVquvU+R1NfCtcEUVUY0FpJ4qm5VW8Kd/uRLLyYM1Ltm1lPp6kPiucjOCDhaate2a7RzgyyPLP6RWVeELNvtxnPNc8Ksukj6bRaet0rdHJ2PoXadFeWsbPI0SEcitoRESxNkbydxXJuwzTFZdK5s43gxpC6zo4fFqOOFxBLRglaYzE8bX1wqsxAqwhcyeEVVM8oPb2rptzwyNzj1Lj3b/Xma+uaDydhUfRGvpMU7tz9jV0LTPVMYBneOMLr7YxpWGjs8NY4AvIXK2j6R1XdqfAz6QXcOiIPF9N0rcY4KIppZR6PrGocYKEfcvUvLgqVbwtkv8ARKndlzl5r6/obJVEnHoFSfO4y0jjXazK3y9M0cfSKx7RNIK6+QwuGclVNodU6o1LU5OcFXvY5RmfUsTiOsKrbbyj7FT4dHT2R1toWzMtdohAbhzmDir7I70yFPTAR0kAA/EAVN4y4lS5OXc+Pc3KTkyCgplKqE5CIhGUwSVIRl4Wqts2rhY4nRMfh+O1bMu1dHbbY6okcG7oJGVxzth1K++3p5ZLvxtdhWSx1Oz02hXXbn2RtjYnqB9zu5NS8lp5ZW931FMDxcFwzo7WM+nH70XPPNZdJthrZHbxe9WzFo7dX6c7LN1fRHWvT0vyh3IJ6QHmMrkb4X6z5Tu5R+F+s+U751ljBy/C7fJ1fdp6eShkbvcccFxrtcYI9QSbvWSr27a/WYxvHitfalvT71WvnfnJOeKl9j0PTdLPTybkeKhpZaydkUQzvHC6Y2N6HpKCGGuqWjpXcTvLnLT90ba6psrmb2DlbFj2u1ENOIohutRJYOrWwsujiDwdbeMUjRutc3HYFIaik+UuR/hgrh/OuT4Xq4/zr1DSPGXpdnk62NRSn8ZRbPSn8Zck/C9XD+depo9sNc12elco2kv0uzydN6p1DQWi2SyGVokHLBWpdO7WDW3kwTvwzOPSPNaX1RrquvYc0yuawlYpSVktPWRzNe7eDgcpsR20emRhF8Q7/oJWVlvZUM5OGVAhYBsd1TFcbJFTSvBeMAcVsadm47gspLDPHnF1zcGedQU2FKqEkETCYQBQKioKCSUooqCEkSgUpQKCSZEUcKclSCIiAIiKQTdSs115FXlWe7fEcrw7ko1xrLgAsu0XxsJP6qxLWXGNpWW6K/i//ZXjan7sv6Ol/aRbKj+G/OtgaWPGMfqrX9R/DfnWfaX+PH/RXH6D+oM9X9syhERffnjhERSAiIgCIiAIiIAiIgC0H4Q/8ZLP/Un/ABLfi0H4Q/8AGSz/ANSf8S4PUvsM9D0z9Qv9Lns8/g39lY3fv41f2lkez3+Bn+iscvv8af7S+Yt7R/s9Jfcl/Rntv5R+4LKYfwYWLW/lH7gsph/BtXsyeUjhn3J0RFUqEREBEKLfjAqVVQN2kfIeQVZEN4Nb7b78bbanta4ZLCOa5GuFU6pqHyu4lxyt17fLuag9EDkjIWi42OlcGt4krprg4rqe3oocOtG3tilibcK5k5ZnGCuq42iG1xxDHojC074PdnMVAHuHMLcMvxt3sWVsk+h52unvtx4KaIizRzoKbClU2VZgimETKFWRUxClUxQEAFM3sPJQCjjKsQyWoNHTRmWdrfeQqVJe7dUPEUbmjsyvPqalfV2xzYcbwHJcoa3vd80/fZWtdLG0OO7k81rBZRpRp1fnqdltihe3eG6Qgii/FAXNWznbBK98VPcnkDkcroSzXekutI2WkdnfblGmuphdp5VPDNXbdZ92zSsjyTg8lzTpjTdZebqxsMb8b2eAXbV403S3dhZWNG6e0ZVCx6GtNpl6SmiZv9uFdTR2Ua2FNe33Lfs305HZrTA6Vv3wDPLks0c2B7sloUk8e7HutGAqAUbsnHN8Z7pHqDKb5IUtWyJ9HMxuAXNI5KiqkgDKORxPBrcoUcNvVHKm0LZ5crhqGWeDeLCSsx2T7J5qGeOsrQeHEFeDaBr/AMmXZ0URzgnI+dezRe19r3spqg4J+ZaJN9j15TvnV8p0JHDDFExmB6IwoFsHyR3K1WO4tutMyRhyHDKuDm4OCs23nB4zWHhlUMg+SO5DHTn8UdyotaTyVZr42DddwKt19irjhjooPkhHbobhuFLIzjkclKoJSJg8hWy+2WnvURbUtyCMH2q4EL0xYbCXdgyrRLZcPmRgDdn1jpnh00bWj2q8QaHsL2h0cTXj2LUu27WldaiW0ryOPUsU2c7YKymmENxkduB3PK02r3O9UaiyG9SOixoiyDh4sFLVaPsdPTSSPp2hu71qNi1pa7nTxvbKN4gEqGptQUHkydjZQTulXVccHJuvUtryce7V/Fo9RSxUgAaCeStOhqVtbf4IpG5aVcda26ortRSyQtyHOwtl7JdLUtFVQ1VcG5bjICpCKcup9JO9wqz/AAb1sui7L5IpN6laSWZzhe1mirIP+qM7l6qe/W2OnYwShrWjAGFVGobb68dy1dSU+h8xKy5tvLNUbX7ZZbZZ5WQxNZJg4GFybUP/AOlvA5ZOF1VtikhuzHMp3b3DmtMWLRJmuAdUtb0ZOeKzlXmWEe1orHCrMn1M62Dadork9rqyFx4jGVv6XRdle7PijQsZ2ewWmwW9oa5gkwBnCyyu1XbKSAyyS+iPmWirW083VXXTs+VvB5ho2xM+NTsHvUfM6xv+LTxn5lz9tS2tT+UHNtMjg1rjjirjsc2qVFXWsp7rJnePWs/l7YL8rqdm/Ju/zJsh+NSsPzKU6IsR/wCqM7lkFLUR1VOJYXBzHDOQmSCp2rvg4eLP3ZbbdYKC1uJo4WsJ7Arkfeqg9IKHRE8lGPA3N/UUsKo7hSye5R6JyVQ3aKX2NKtGLIbTwcpbeanfqHjOea05YKfxy4tixnPUtgbaq8yXuSMHiCQsT2d0z6jU1MyMZcXBVl9R9TS9lSx4OvNjlkjtlma5rMOLAQfmWwDzK8GmqM0lqp2kYO4P7grjjitPY+Yus32ORbr9N4vbZH5xwK4q2t1XjN+mdnPpLsHaLP0Gm5n5xwK4c1fWCrusr2nI3lSfY9X0mPRyMt2QUQq7xDkZw4Ls2zxCK1QsHU1cr+Dnb31V0a8NyAQV1qxgZEGN4ADCR6xwZep27ppFGLjIse2iVhptP1LWnBLSslijLXZK1pturvFLVIN7Ac3ClQyjipW61I4/1JKZb1UvPyluHYNbt+4RTEccjK0lc379wlPa5dQ+D7aHvoGzhvo8FFf1H0Gss2UM3q4bsUY7GqVrN4ZPNVpW8G+xa72i67pdPNDGuO/7CquDTPmq4Sm8RM9e3CkwsD0FtBo7+Wxb+884C2BMzB9EKHAtKMoS2yRTwqoYGNLnkNAGeKgwBrC93ILUG1/aXT2mkkpaCQmfGSexQuheuuVstkSxbcdobaeGW20zhvEuaS0rmjffWVPIlzzwVa9XSe61j6ipeXOJzxKyLZxYXXe8QOLcsDuWE7vB9JTXHSw6FwtmzG63GkZURRuLHDPJeo7JbyOcZ/ZXW2n5bbb7PTU53BuMA5K6R1lvmGWbh+ZW4f8AJ5svVrNz2xONPgou/qnfs/8AzT4J7v6t/wA7V2eHUZ/FZ3JvUfyWdyrtK/GLfxOMvgmu/q3fs/8AzT4Jrv8AIk/ZXZm/R/JZ3KO9R/JZ3JtHxezwcZfBNd/kSdyfBNd/kSdy7M36P5LO5N+j+SzuUYHxaz8TjRuya8E/Ef8As/8AzUkmyq6Ru3XEj5l1LrXVVrs9tlO9H0nUAuZbjtNrajUUYiJ6Le7FDj0OujV32ptJI87dkl6fxDHbvUcLwXvZtdLPRmoqWkMHsXYGg66G56bpqhwYXlgytO7e9Y0sdNJbo9wSAEYHUm3oZ0a+6y3Y0uhzS8Bjy3sOFK44wqtFSVNxqHCmZvuJ5LZmiNl9wuU0b62LdZz4hRjB6tmohCOZPBQ2L3eqg1BHC0uLMg4+ddhxuM1MxzvjEBa60fsuoLM5lQ5jel6+C2JwY3dHILKzqeBrbo3STgUVAqZCs2YEMKZQCmKqwSqCiVBVBIoKZSqxIKgqh3YgTJwCgHxS5EZ4hMDciQoSpnsIGSpVXJJEcVHCoveIxl3JUm3Km3t0nJTJB61BRaRI0OjAwoHgpyMkytF3+I5XcclaLt8Ry0h3LLua31j+Basu0V/F7+ysR1n8ULLtFfxe/srx9T92X9HQ/tf6Wqo/hvzrP9LfHZ/RWAVH8N+dZ/pb47P6K4/Qv1H+meq+2ZQiIv0A8ciiIgCIiAIiIAiIgCIiALQfhD/xjs/9Sf8AEt+LQfhD/wAY7P8A1J/xLg9S+wz0PTP1C/0uWzv+CEfqrHL3/Gr+0sj2d/wQn9VY5fP41f2l8xb2j/Z6S+5L+jPaDlH7gsph/BNWLUHKP3BZTD+CC9h9kcMu5OiIoKhERAFGueI7NOT2IBleLU8pisNSR1NUdyuMtI5A2pXE1N9mZvZDSVimnIvGLpHHjOTyXo1lMZb7Uk/KXo2fxCXUMLSuuP05Z9BJ7YrB2BstovEbQwbuCW8Vk0rsyuXl01B0FBFw5tXqk/CFccvqPAbzNsAJhTImSSVRCiilsBERSCKioKOFJBMoZwVNHGXHmB71UdT8MhwUlXJImpXAuwVqTbppSGrtktayPLwc571tXO6farLtFh6fSVSMZO7/AJFXg2mTVN12KSODpQ+CpeGktw7gt17DNaVDLnFQzPcWjA7Vp2+tdDdqpjgfwh4kYys82LUUhvsVU4FrMjmF0S6xPa1G2cGjsPUNSYLLJUDm0Zyuc7xtkqrZe3Qsc7omu3e1b01fWtGjZMHnH/kuItWObJeqhzflFRGMTzdDTGalvR2bojX9vvtvidNUN6Rw4glZcK23/lDO9cAWi/V9rka6CZwA6srKYtptza3dMz+9Tw030NJen5eYvB2z49b/AF8feqFxuNCLfPioj+KetcXHaZcs/h5O9Sz7SLlPC6Myuw4YR14Kr055+o8G02cS6oqN1280Eps7s4ul+ha9+4AeKxuvqX1lS6aQkuK9NovEtrnEkRwVKXsettxDDO8dMU1DabXBGypYSWDiSrq6uoS70qmPPvXFLtp1zc1oEzuAwpRtMufrnj502nkfDpSedx2Zd73brfQyTuqI8N/WXOGtdr9RT6gMdG95jDubTwWt7vtAuddSGEzvweeVhcz3TPL5HFzycklSsI6avT4w6y6nc2zjWlNqW3xASN6bdG8MrOHsC4h2SarqLJeYmEuMe8OC7Q0/XeUrbHPg8R1qJRXdHm6urhSzHsekjCrcqSQ+wqmQo1B3LfMT8kqazlbyjk7brVB1e9hOea0oxxHIkHK2Ptlrt+/yRg54lYvoqxy3y5sgjbkE4yrvLfQ+m07Vdaz7Etl1PX2rIhmdjsyrm/aBdJGlrpn4PVlbhh2EGSBjnsJcRkqjcdhwpaV8u4PRGcqcMy5mmUstmnI9Wyh++5m87mSveNoVc1gbEdwDsWN6lovJlykp8EYJGD1LJtnmipNTTNDGOI7QqLOTeUq1HL7FB2v7mT+Ff8yh5/3Mfzr+9bji2DkxMPR8xlW3U2xU2+2OmDcEda1e5HOtTp28I1i3X9cT989L3qqNodU0eiwArErzRigq3Q5yQs42X6Bk1bOAGEt55WfzN5N58OMdz7HgftDuTj6Ly33Lw3LWl0r6cxPldun2rdvwCkH8GvHediXiNukmLMYV2pYMI6mjOEc8ue6QkvcXH2lV7bWVFFVMkpnFrgc5C9OoKHybXSQEj0SRhZtse0edS3Qb8ZdGD2LOKeTqssjGDkzo3Yle6u5WBnjQPIc1s57cN3lZdLWKGx0IgiYBwCvjuLSFo/B8rdJSm5RNXbQtovmtIWOOFY7Ztopp4A58g3vasJ8JyOSKqbugneyeC59ilqWjEe8B7FGdp69GlrlWm0dija/SeuYqVy2vUjqCZomZvFpAHzLkXpqz5T0M1X1ucPnRzNloa85Ltq26Put5qKhzt4FxwvZs+uEdrv0VTKcNaRxWLknPpc1NvSNP3sHPsWbeXk9FqOzB2HFtcooqeFnStGGAZ7VEbYaL1zVx909afxnBTCat+U9XUzzFoK33R0ltK2pQXPT8lNBLlzgeAXNM0hllc89ZU0k1Q4bsrnYVEnCpJ5Z3UVQpjiJuPYlqun07JmVwDu0rcr9r9EP59i47ZJM0egHY9imM9V2yKYvBz36WFst2DsNm16kP86xan2ybQG3odFBI0jHUtKieq7ZFI98jjmUkn2qXN4whTo665bsBxLpd93Ek5XRmyTaDS2OxiB7gHDhgn2LnEHjwU7X1Tfwe+AqxeHk6L4RtjtZ1pfNsVOy3SiOZoeRgLm7Wmp6nUFwfJLK4jlzWOPkq3txIXEdikDH/ACHdyvOzPQyo01dXZGT7P9QSWC9Ry9K5sZcAQu1tB6jh1Fa2yxyBzgBntXAD2vGCGnK6A8HbUk9PUspZQ/cOBx61NfXoc3qFSnHcu6NybWdWN05ant3w1z2EDHNcYajusl2uc1RI9zt49a6w286Vq9QWxk1Ic4HADrXMw0LczVGAQyb47AquLb6FdBshDOepjdDSy1k7YYWlzyeAXUGyLRzrNp+auqog1zWb3Ecc+9WnZRsifBUMq7jGTjBy4Lfd3omU+nKinpmAfe90YHNRjCK6rWNtVxOR9X7Q62nvdRDBIQxjyAAvDR7VLlT4++PVLVOiK+W/1LmRkh7ieAXnpNmN1qeUblMU0jpSqS9i/fDJcflv71KdsNz6nv71aLhsxrrfSPqJ3brW9qwOZgjlcz5JwqyNY1VSWcI2kNsFz+U/vUfhgufy3961RhZTpzRVwvke/DE/HVwUImVVUVlpGXfDDcx+M4+8o3bFc259I8RjmrcdlN2bzjd3FSu2WXX5Du4oZLgPwWHU2rq6+ykzTPwfasdikLJmSZ9JpzlbA+Cy69TD3FQOy27fIPcVPVmytqisJoz7Y7r58FMaKSXPo7oBOFjWodK3LVOrnyNa8xSOznC9mhdmdzprqyWQljOfHgun9P2WhoKGLeiY6YDi7CrI8+3Uwqscq11Zr/QGyelskbJahrXP4E55raEDKejjEcMTRjsUXyHO6zg1UXFZttnDOcrXmZVlm3xw4KiohFR9SML2JSFDCmRZsZZBERQSmSKCioKCwUsrxHE95/FGVMOa812DjRylvYmepK7mDXvUtQ+rdBT5d7l46e/XClG+5jiAqumXQO1I9lQ1p48itk1dsoqiLcbC3j7FZvBMpKLxgxvTupG14DKlwYeXFZIWgt3mEEexa71VYKiimFRSEtY05wFdtG6lbWFtFMQJW8OPWqySfVEyX7o9jJ6iISs3Sscu1qmp4HzREkjksqlbuvwOSniDJR0cgyDwWbbRnu9zW1g1Y+Cs6CtJaOWCtiU8rKqnbNEQQexad24W11rMdRRDdJI4hX/ZNqVtZao6d78v4AZWjXy5Rs68w4iNihWi7fFcr1M3cwVY7v8AFKmt5ZSLya61n8UfMst0V/F7+ysR1n8UfMsu0V/F7+yvJ1P3Zf0dL+0v7LVUfw351n+lvjs/orAKj+G/Os/0t8dn9FcfoX6j/TPVfbMoREX6AeORREQBERAEREAREQBERAFoPwh/4x2f+pP+Jb8Wg/CH/jHZ/wCpP+JcHqX2Geh6Z+oX+ly2eHFL/ZWOX7+NP9pZFs9/gg/orHb9/Gn+0vmLe0f7PSX3Jf0Z5b+UfuCyuD8EFilv5R+5ZXB+CC9h9kcMiZERQVCIiAmj/CBWvWhxp+qx8kq6R/hArXrQZ0/Vf0Ske5C+pHDWqnZvlT/SV72Wx9JqmBqsWqf/AF7U/wBJZJsiaDqmA+1dcvoPalLMWds0DNyhg/oBU3/HKqwfwSH+iFQPxyuI8VdyoilCiEJIqIChhTBAMqBUcJhWIyAqkA3n8VTUzHFjshWKy7GL60vzrIx0riejbzwsSsO2S1T1Qp5n7riccVnusdOR360TRkgOe3h7VxntC0rU6Vu0vpEZdkYXRXGMkaaeFdnSXc7ctt4o7vC19K9pBHDBXputOKq2yUz+ThxC482V7Rau23KKnqZX9CSObl19p+4Mu1NHO0h2R1JKOH0K31Ovquxpi/bIoqyrfU7jt345PJW7xOltvRUNp3TUMdxA7VtTaZrOHTlI+AkB72kBa42UWqou+oZLlO0mF5yCQtf2m1c5bHOfYy3Uj5qfZ681nx9zI7lx1cZjPXzvPMuPBde7eq9lFpuSmjO76JyuOoPvlxDT+M9RGJ0aGWIN+TItP6QuF9x4rGT7lfpNlF8Y7HQOP9lb92E2pkNtilfE0k4PL2LcE8cJf6UbT8yiWU8Ipb6g4zaSOIG7Kr69wHQOH9lW6/6DuVjiMlTG4NAyfRXeMcULXZbG0fMtIeEhXw0lAWBrQ4t48FEWy1GulZNRwcovJY7dI4rJtP6LuV+j36SPLcZ5LGeM9UAOsrsrwf7ayDTZdJGMkDmrnTqdQ6oZOdPgovY/mnfM1QfsqvUbC50bgPa1dx9BAf5tvcsK2pXunsVke4MjD3NPAhF1OCHqM5SUcHDl3on2yrdBL8ZqqWO0VV5qWw0bC5x7BlXg0Fw1Zqd27CS178ZxjAXU+yvZjTaegiqJ2MdIRzPNWxg679Vw45Zg+zbZEYjFPWsO8cOOWroC3U7LfRtp4hwC9mWxegxoaB2Kk45UPqePOyVrzINBJwqN6lFPZ6knmGFeiH44WNbSK3xOyz8cbzCpijPHzJHFW0eq8Y1HUOzyctl+D9Z3SXAVDOojC07qeXpr3UnOfSK3HsZ1RRWanHjD93gCrweGe5e26monW8bS2JjesABY3tAr3UFjlLTjLSsWbtUtDWNxUge9YHta2kUVfaDFSTb5I/FKs5JdDxqqJykuhzvrOp8bv08vPLiuh/Bft7jTOlfyDcrmKeUz1Ze45yV0hsS1jbbFbTHUSYdu4xyVVjJ6+pg3S4o6bWB7Y7iaDSkpDsb2VbPhVtI51K1ptp2g0l4sZgpJskjBCvJrB5VGnk5rcjnm5VBrrjI8nLnHguq/ButklJQ9IRw3eK5KonAXBj3cg7iuodl2u7ZaLfGyWbdJbgpFr3PT1eXW0jokhYjtRrHUOlKmVhwVjh2rWnpHf9KHzLA9qm0iiulimpaafeceYVnhp4PMpos3ptHN99q3V94nc45JeV0n4NlB4s1j/lLmGmzLc2k9cn+a7Q2I21sFmglDepZxPT1s0qmmbTlPHClY7hhRmGXKQKH3yeIl0MF2h6Kp9UbvTM4j61jdr2MWwAGUYH9ELcDeCmDvYrdPBsr7IrCZrSPY9Yw8Es+oLXG17QlqsFE58LRvEZHALpVpwucfCdvBhzAw8QMYUtRx2N9NfbOxJs5mrcNqnhvLK6D2M7PKLUFtE9YOI9i54YHT1DesuK7Z2AUbqfS7XObjICpFJyPR1d0q68ondsesZHxFFmx6xAEvaQB2cVs48FSqn7lNK/saStPk9keO9Va+m44z2w6doLJVSMpgW8T7Fq+ywipusMTzwccLO9td1NXqWZgdwycrGNCUzqjUdKGtzhyzlhvoe9BvhrL64OnNF7JbXVWmmnnaHPcwEkrIJNjllc7O6FnmlYegsFE0gA9GMq6byslH3PElqrVJ4kapu2yax09uc8D0h2hcwbTrfTW26yQ0ow1p6hhdsa4qfFtOVUvLdauENdXI194qHZyN7AUyUcdDt0Ntk8uTPRs9tAvN5jheMgkBdT2LZHaXW5jpWekVoLYDSmo1PEMcnhdrQsbBA1rRwaFSONryNbfOtpRZrF2x2yE/EQ7HbJ8j6ls0S+xR6VUbT9jh5m5+5q+TY3ZXDG79Su9g2d26yyNfTtGRyKzjpfYpXSZUZx2DutksNkj4myQCKQAt3cEFWwabton6YQgSdquZJUpcR1qVJoz6rsRYBTxtZHgNAUHjpmlj+LSoYc4jCqu3IYt+Y4AUdyrLadN26WXpHQglea7z2XTlIZqkMYB86sGudodusMD2xVAM4HJcrbQNpNw1FNJH00gjPDgcBap9MHRRp529X2Mq2ubQ2V8skFtI6LePHK0zI8ySOeeZ4r2WizV92rI2QRukLzxPNbA1LoCOxWdtTUPaJC3eI7FRxbPZrca0oGObObdTXPUMcFZjc4HBXamldL2y10EfijWlpA4gLgujuMtrrxNTnDmldR7EdpcVypmUdfL99OAN4qmMHLr1OS+U3Y6hpPkt7lTNvpD+IzuVWRokjEkZyCOpI4jgF6o2eSsYzkkFtpTyjb3Ly3OO3W2kfPVNY1jRnirdqnVdtsFE90s7RKOrK5f2mbWK27TyU1NK8Q8sDgrV57s3ppnZ19jaV/2p2eirOjpnsGDjK2boy/019s7HwuZvHsK+f8srppC+RxJPFbS2Q7Qp7LdIqWeZ3QOPX1KZxyddulW35e52M9jmHjyUDxUtsuNPd6OOSmeHBzQeCmIwSFz++DiTfZkERFBcgh5IirggplRCFAqliCgVFFBJDOFVbGJaeRp6xhU8ZUzSQ7gVVsiWcdDVepqKax3Hx1owwuzkLOtHX6G50A9P75717b/aYr1RmCQDl2LU9RDcNKV+KYO6He+YrRYksEpqccPubmqqcVFPIyZoII4LUd/oH6buYq4xu7zs8OSzbTeq6atbG2qlax3IgnGVU15b4bxaz0G64gEgjqSKwRF7WlLserSt0F0tjZHkFxCukPCYe9ak0ZeHW65ttzyeBxgrczIR6D+tZWrHUm3EX07Gr9u7Wvtjd7q4rVGx26nzjjhacNc7uWZeElfYqaljgjd98cOQWs9hVNNU3+ObHoB44rphFqvLO2pY07ydeVnKP3Kw3b4pV+rODYx7FYbt8Urnq+o46+xrnWfxQst0V/F7+ysR1n8ULLtFfxe/sry9T96X9HU/tL+y1VH8N+dZ/pb47P6KwCo/hvzrP9LfHZ/RXH6F+o/0z1X2zKERF+gHjkUREAREQBERAEREAREQBaD8If8AjHZ/6k/4lvxaD8If+Mdn/qT/AIlwepfYZ6Hpn6hf6XHZ5/BfmWO33+NP9pZFs8/gvzLHb7/Gk/0l8xb2j/Z6S+5L+jPbfxEXuCyuAfegsUt3KL3BZXD+CC9mT6I4ZEURFUqEREBM3gV49RRGewVgAyd3gvWo1jOktE7e1pH1IVzhpnB2uoDBqKpGMZcVd9kcgbqaDe+UF7tsNs8VvUr93GeKsWzGcM1RT8cAkf3rsxms9V2Jx6eDuynO9RQH9UKgfjFVLa9slvgx8gKQ/GK4ex5aIhRCgOSiFJJMoqCioIYRTIrEEqKZQVkD0UrwRuO4hc/eE3am9F00UXHC37CQ14JWA7Y7C6/0D2RAk7vDC1rlhihqFmTiake+OqY6L44K7O2SXXyds9dXVrsOYwZWgdIbLbnLqONtXFiFhyfasz11qZlgpXaepfjEbhwV0NbjqulxflRZtS3Gr2g6pYKcuexr+AHHrXTOz2ystGnqaMs3ZQOK094POkJYKiStrI/ReN4ZHaugXuEUb2gYAaqSfXBzamzOK49kc3+EHdA9r4d7PDiuc7U0yXWIDretm7e7m+W/Pj3uAJCwTRtEam6wu6gcrWK6HdUlCCR2xsnomU2mqZ+Meis0fGHuyDhaGrNokWltP08LhlwGMA4Xip9u1MIhvZH9oKHE8+yibk3E6GDQxpJcFzB4TlaH1e4H54BXufbtSupywE56uIWk9peq/OWo6RucZ6+tIxNdLTOM90iwaRpvHLxFEeRIyu59mdE2k05Exow7AyuFNKXBtsusc8gJYCM4XQlk21UdDRCLdJA4c1fCZpqYWWLCOk8e1am212llfSx5qQ1ueIJWJO27UZjd6B71qXaRtKq7/Ju0rnMiB6utVSwc9Ommp5Z0bsm0xaaOgbIejfPw6+tbRlO5H6IA7Fxpsb2g1dBdI6arlc+NzhzPJdhUFZFcaSOWFwLXAHKSKaqEoyyyZFA8CQoqhmljqVIBly1Lt+vIoLW+MvwSxbcY4Mi3iuV/Cavbpa8wNPonHBaLJrpoqduX2NC1svT1skp4lzsqeJtZu5hZIG+xVtNW593ukVPE0ucXAYHtXYOz3ZZaY7Ox1dBvSkcVba32PRs1Ea11OO3NuB6pV55Jp3ZZK93DqJXZevNKaZsNlqXGJgl3cjJ5Lj7UMkLrtP4uMR72AocGu5am+Fqyjwg4Krx+NkfeRIWq+aE05PqG7RwRsJaXBvJdc6S2S2eloG+NwgvIUqDfYXamFfSRxdi4jqlUHRVzxiRspHYV3W7ZXp9xJ8Xb3KUbKtP+ob+ynDmc3P1r2OFRSVA5RP7lHoa78QSj3Lun4KtP+ob+yojZbp9pz4u3uThyLP1Ct+xwuGXEeu+tUZHTg7sznZ7CV3VJoXSkLJGOii3g3iuTtslqprfqOVlC3EeepRsma06mFrwjC7WN64QY+WF3fsng6PStIcYyxcf7L9F1t+usMrGO6JrgScLuDS1B5MsdPT4wWDCvFYOXXzTio+5cpPjKVTOOSoKMHnBEQICaZwZA5x6lx94SFeai9uAdlda36XobTM/OMBcP7ZK/xu9THOcFXkvlOzQr52zE9K03jd1ij55cF3dswpBSabhaBg44hcWbJ6bxvUULMfjBd2aZg8XtkbMdQURRprrG0olxJy/CtupaoUtqqCTj0Criz46wrazWmksT904JaVKjk4IrMkji3aRUdNqaqeDkF3BZPsVtxqL/ABSObnBWB6rqOnu8xz+MVu3wcaEVMwe4Z3VWMfmPZsm1W8eDqqhaI7bCB1MAVaLipY27tKwdgUYTlTNPd0PEznqYLtjrxTaSqMOxwPzrhO4PMlfLk5JeV194QNx6KyTxZ6iuO2u36/3uUOJ62je2s6C8Gq1Hymyd7cekCSuqpTjAWjPB8twhpIpA3ngrecvNQ49Dj1U99pSHBCMoiyMiXCZU3NN0s9I8kxkZwSgFT9E3GXkD3lWLUGrbdY43vqzwb7cLS2utu9Gd+G2tdkcuI4q6h5LQqnZ9KN337UNBZaYyPqId/qBcFz/tF23uf0tJQluOWBxwtKag1ZedRVbz0khDjyBXtsGzu9XqZh6F267mS0qWsLodtemjB5mY/dbvX3isfLNJJJvHtWYaD2Z3DUkrXGJzIyccRwW7dnmxalp443XSIZ5kOzlbJvdfZNCWpxjaxhYMYyArJCzVtfLWssxG0aUs+zyxie4dG6oa3OHceK592qa+Gpal8UGBCDw3eSl2rbSa3U1wkbFK4QZI3QeGFhumLBU6grWwUozI48VDL0wcXxJ9y1uO8ckK76UuclrvdPNHIWNB44K2Fq/ZhVac002sqAN7r4Faka4tfkcwqdGde+Ni6Hf+z7UlLdtPU8jp495kY3vSWIbS9rFJp5skNNNHI/iODly1ZtaXW3UvQUs7wzGMZVhutfW19Q99U97ieOSp2o41o4xnll91lrKt1FXPkdK8R5OACsZjjlmeAI3ucV7NOUzKq6xRScnHC6y2f7MbPLRQz1ETXHAPBQ+iNrLo0RRzZZtCXK6Ma5tPIAesBXePZjdaWcO6J2RyyuyqPTdpoWhsULRjlwXpdbKA842FZ8Q5XrW30Rg2xqjqqC1iKtJLgzAJWeyn0ypWQQ04DYGho9iE5WL6vJzP5pZIZTKhhMKuC2AiIoJJSoFTlSlVZJIiIqkhAiKATNcWHIK89yoae407o3xtL8cCQqruKDhxyhXBqq/6Hq6ad1RTSEN54BwrfBqqts0L6apic9jRzW6XESt3JOLSrfWaYtVcx5MLXOcMEkcldSx3LcRLpM5Yp9Zk62E7wGN3+IPvW5L5tehobQXU266Xd4FaO2v6fFnvMklKC3DupZBsj0tJqqF7apu8xo71riLWZHXZGuUFP2MG1Neblr69ACJxBdgAD2rozY5ojyJaI5Z48S/GGepXfS+zSzWZ3TOiBm7SFmvoxsEcQw0cOCrbbnojKd29Yj2FRJvkDsVouvxSrnjKtd1+KVjV3M0sI1zrP4o+ZZdor+L39lYjrP4o+ZZdor+L39leVqvuy/o6ZfaRaqj+G/Os/wBLfHZ/RWAVH8N+dZ/pb47P6K4/Qv1H+mer+2ZQiIv0A8ciiIgCIiAIiIAiIgCIiALQfhD/AMY7P/Un/Et+LQfhD/xjs/8AUn/EuD1L7DPQ9M/UL/S47O/4L8yx2+fxpP8ASWRbO/4L8yx2+/xoP9JfMW9o/wBnpL7kv6M9t3KL3BZXD+DasUt3KL3BZXD+DC9mSwkcTIoiKpQIiIAqzDmncztGFTDHdirQtYHffHAe9Q2Uk1g5o8I2zupwJ2tAyCVpXQswg1BTud8pdibZLHRXmzP3nMLw04XGErHWi+7odwZJzHvXdTmUOp1UyzBHe2jpTVWqHHH0Arm+ml3z6K1Tsq1pA2zgPeHENHErJptfRiQhpC5Z1vPQ5nGSk8GYCnl+SodDJ1tWJw65ic3Lnr302rKeXG9I3j7VVwaIe8vpYW8xhDwXmp7vRVHOZo95XuY6lkblkrD86YZVyx3KYOUyqj48fEVE56wiTLppkUaoBTj28lZBvBAuwqsUInGXNDh2FRY2E/GeB714r3f7dZbfLLNUMaWg9a0jFtmbeeiMa2pX+i0nY3zxsb07gQMcFy1YaOq1trRtZgubv5JPEYU21XXVZqu5GkZIXwh3Adq3h4OukG0NnNTWQAvcBhx710S+VHVB8GtuXdm4LDb47ZaqaONoBbGAp7xOIKOWQ/JK9RfktYBwasW2mXJltsL3uO6C0n6ljBuUjiim5fycZ7W6kz6lnJPWVedkVAaqQuaMuxyWE6yq/HbtLKHb284nK3H4NduNVV5c3LQMrrfRHpSk1F/wixbXrFWkRuETi0DOQMrU0FPI95iaPTHUvoHqfStJcbRMx0LN4NJGfcuJ6+KK067McsYEDZcfNlQnkpp7FNFmbpu6uPCleqg05dRzpHhdn7O7ZZ7xZmStgie4NHDd5LJ3aRtZ/wCpRdyrOW3uUesUW00cEjTl05eKv7lB2mLuGlxpJN0dZC73Zo+1ddJF3LD9pk9h0/YpAIIRUAZDccVMXlZC1ik8JHE1RSy0zy2ZhaRzyFTBVz1JdG3Gvmla3dBccAKjZLVUXerZT07N4uOFbB18RJdSFnjqn17DRBxkBHxepds7FJa19ijFeHAhg+MsJ2SbIIaOFlZXxxlxweIyVvSmpIaKFscDA0AY4KkmedqLVZ0RUkADzhSqPNyjyVUZLsRnaXUhaOeFzxtW2f1eoLsJGsIaTzwuhs9XUp2sifxMbSfaFpFkRm63lGntl+yOks7I6ypIdNnJGFte73GmsVsdNLhjGg47l6ayrpqCnMtQ9sUYBOVyvtv2pvrJ5rbQzb0XIOaOC0TwWjuul17GN7bNoMl9uLoaeR3QjLTg81qKP75IN8nieKPM1RI55DnuKi2Cob/NOUNtno1qMFhHS2xiv05ZLeypq5WNmHHjxW2nbWNPN4CpauFWzXCNu60va3sypTNXfKk70zIxnp65vLyd2/Cxp/8AKWqPwr6e/KR3rg8zV3ypO9TdNXdsvem6RXlKv5O7mbV9POeB4yO9Y9rHbDaqWim8Rn3pMYAXGPjFYD6T5G+8qR080gw6RxHtKnfJFo6SvujPrptRu81xkljlk3Se1bQ2Z260a9iBukjfGfaetc2O481lWzu/11mv0BpZHhhcMgKYybfU1lWox6HdGk9I0Om4t2kY3OMZAWRk4bhWHR13debVBNICHFgJ9+FfXHjhJdzyJtt9SCIiqAogKCnjHNSgzH9f1Piul6p/6q4G1lWOq7zOSTje5LtjbXXdBpOoaw4JacrhGue6avlLjkl3NTLwd+i6RbNoeD7RGfVERI5vC7ehjEUTWgcguVPBqtWbg2oe3k4YK6uccBMNLqYauW6eESAYdlad8Iq5ijspaDj0VuRntXNHhTXD0GRxu47qnsslNOk7Fk5mqX9NUPceJJyurfBitUjLc+VzPR3ea5Nidg7xW+9l21iHTlt6B+M7vEYVV3yelcnKtqJ128ejgclBjQ0cFzu/b7F2juCDb7F2j9lWlk81aaZZfCQuW7UPgJ45OVzjRN37lGO1yzLabq1+prq+cuy0uJWOaap/GbzTsxzcqvqelXHbBI7X2K0Bg01SyObj0QtjycSsc2d0/i+laFhGCGDKyF/FVbweVN5m2SKVVFKqEk0Y7Viu0CuraW1SeIAmXHDCylpVGamin/CtDh2FF0ITSeWce3Sm1RqC4yx1EU/RuccYBV609sOfcHNfWOLc+zmupo7dRRcWUsWe3dC9UccbeIY1p7QMK+5s6Jat4xHoak0zsUtNr3ZHEOd7Wg4WybVZaO0QjomgNb7F7qutpaOIvqJmMaO0rRO1PbLFaunpKCTff1Y4hSZZtueMmf6+2iW7T1E8RytM+CMZXIG0LX1dqOskYZXCHPIFWLUWprhqCtc+SWQhx4NCyjZvs1rtTVrelicIiRz/AM1J2V1xpW7JYNI6Ur7/AF7I6eEvY4811zs40DbNDWsXCv3GTbuTvDkrppnTVk2e2Rs9UIulYweke1aJ2xbXZLrJNQW+V8cY4eiqtFZWSue2PRHt29bSYbtvW6hIdGMjI5LnoFJZpqiQvke57jzJOVKPaoxg6qoKEcI23sQ0nSakq5WVJAIGcdquu2zQ8GmqfpIBgAdSl8G2ZzLyAPct37etP+WNMukij3nBuUefYwsucbks9Dimgqn0tS2VnxmnK678HzWnlWj8WqZOLW4BJXIdwp3UlS+JwwWnCzTZZqqXT92iDJC1jncQjjnoa3LfBxO7qhh394ciqJ4Lz6cuEd1sVPURuDi9gK9D+BwuWfRnmxfsyChhEwqmqIKCioIWCIiqQFKplKVUkIiKoJSpSpipSoJIIVFFAJF67ccB/uXmwq9GfSf7kZWfY578Iak6OCWdoAJJUfBeuxDaiEgODhxyrz4RVM3yCZP1lr7wbKnoq6ducZ4Lpcc1m6eacHVdS8vaSV5AvS/0qVp7V5gFyGVf0k6tN2+KVduoK03b4pWlfcua41n8ULLtFfxe/srEdZfEaFl2i/4uk+xeRqvuy/o6JfaRaqj+G/Os/wBLfHZ/RWAT/wAN+dZ/pX47P6K4/Qv1H+meq+2ZQiIv0A8ciiIgCIiAIiIAiIgCIiALQfhD/wAY7P8A1J/xLfi0H4Q/8Y7P/Un/ABLg9S+wz0PTP1C/0uOzv+C/Msdvv8aT/S/zWRbO/wCC/Msdvn8aT/SXzFvaP9npL7kv6M+t/KL3BZTB+CCxa38ovcFlMH4IL2ZPKRwy7kyIo4zwHNVKkpOF6GxhrBI5waPaqMjmU0D5ZuTRlaG2t7W46Nr6S3OeJRniOQ4K1cXN4RHfsbX1Lrqg0/G58z2O3erIWn7/ALc21lQ+GlhwDywStDOuV51TXCF0skheeWeS35sz2LQSwxVN2DgS3eIK6JVRr6suo14zI8VFNetUMc5jnFjhwAWr9f6JuFkfJVVTH7pccnC7NtWmbdZomx0rWADlwVp2oaZj1BpuWCONvSc84zyVK7vmwisbXF4S6HMuxWKquk74GPwBwwSt4jZ/WGPfJcfZhc40dTXaF1V0QJb99HDlwyuzdE36O+WGmlhcDIWDeGetaX/L1Ra6Ul8xrp+ga8/E3h8688ugbuwZa5/etyvnkidg8FDxpx5gLl4jZmpzZoap0nqGnJw9+6OQCp09zu+n3B9U6QhvMLfjyJRh4GCrdcdNWy5xltQ0HPPgtIyT7kOa/cjCNMbVKSqnbSzta1x4ZWx4ZY62FssLgQRlaV2j7OvJVFJW2jO/1BqseyvXtZa63xO9vcW5xly0cU+wUU1mJ0IWlrsFTSjEWRzUaeZlZQsqY+LXDIKmh9M7pHBZNYKd1k0HtS2kT6fq3QRA5zzJWidWa+uV8eQZXBhPaV09tk2e22vtFTXygCVgLhw61xrXQthuT4mZ3Q4tGV209Ub17cbl3Mz2S2I3nU0BmaXs3h/eu57NQR2m2xU7BjDeK5/8HXTbWwR1zhzcOpdF1WXPaAs731wZ3SzLb7EkILnOd1LSXhLX4QWplPC/ju8vmW7KyZtHbKiV2PQYSuKdtOqjd7zNAxx3WEjBUVR65K1LNmTWUe/VVG7zcSuuvBssRo6Fk0jMAsXLGjKJ1bqCmiAzlwXeuz60+SrNTtxxczJ4YW1jSRrqLGo4Mmm++08rBzLSAuJ9umnpLdqGWqY3DC48V2nG778/sK1D4QGl/KFhdPBHl2cnCxrllnPTN1yNbeDntBNBMbfWSDdeQBvLq2GRs0LJGn0XDIXzbop57Jc2yDLXsK6X0LtopqeyMirn5kazHNbygpdzW6pze6JuPX+saXS9tdNLJGXlpwMrivaPrer1Nd5pOkIiJPLrVfaVrus1Jc5d6R3i4PotzwAWE0VLLXVAihGXnkFaMcI1qgoL+SrbKCa4VkUMLC5z3Y4BdZ7E9mMdtp4a6uh++O48QrHsL2X7gZX3OMZwCA4Lo6NjKaBkUTQ1jRgAKspYM77craiLQ2BoZEA1o6gpC4uPFQJ3ioYVM5OeKIqKBpPJVmR4zvIlnsJSwSMjzzXmulxprVSvnqHgMYM8TjKsGstc2rTVHK6ql9MA8AuUdqO1ervlVJBQTPbT8vRPNaxjjqIwlPuZVtn2vOuJkorc4MaMtJYVoqkoa281ZMbHyPceeFetI6Nuupa4ERuLHHiSM5XWezfZRb7RQxy1UYMpHYrnVvjUjRehrHQ2bDrzEN5w4hwwtmUdr0tXMaWRRDPJWDwhdO1tFIZLaCImcchaCp9S3SikLGTPa5vDieSlY9yOti3JnX9Nsss1wg6SCON3sCgdjluz/B2rSWy3avdae7Q09VO58ZIGHFdh2O4sudDHMwgktB4K2EYWuyv3NVfA7buGYGpPsos1BEZ6iNgYO1bTvN3pbRTumrHhjQM8+a5e2xbYJqySWjtT3tjzzB4IkvcrB2zfRmAbV3WqmuD6e3sAwTy6lrYFT11dNWzulqHFzyc5KvWkdNVt+uEEVNEXNLuJxlVcc9j0FNxXUp6d09WX6rbBRxPcT1gclvzQGxGqpp2T17Hb3PB5LaWyrZxS2C3RTztBqXAEktW0S7ClLBzW6lv5Ylp09bG2qhjhYMbowrmTlQJyo4VWchBFHCYUAgp4+tQAU7eCtFdSGzR3hBXTorRLDvYdx4LjrO/Xf0nrojwk7sG174Gu4hxaVzvQDpLlF7XJLuehQtsEdf8Ag8W4RW6GYN4cyt7PC11sToWwaSpnBuDgLY2MlXn8ywcVrzNlGreIqKWQnG60nK4v8IC9eP3Uxb+d3hhdba7uLbbpqtlLt3DF8/8AWd0dcr5US5JbvcFV9sGumwnuZZ4wXDdYMlegUNU4ejC5ZJs005NfL9BGWZiyMrsK3bJbJHSxiaJpeBzxlVSOueojHozhkUFb6p6OoqxjSXRvC7tOyixerb+ysf2gbM7NTWF0tOwNe0dmMq2Mma1UW8HFDg5nxuazPZlB4xf6bhn0gse1PSmmu0sDAcBxwtr7B9IVtTdI6mSMiPmCQoXRms7cJtHXmmWBlipN35AXvdxVK2w+LUMMOPitwqxVJ9zy85eSQDmoAc1FxwoZJ5LMsOSma3eVGqqYqOAyzuwwda15qna3ZLSx8TZcyj2hSllhRcuxspxZG3ekcGtHasA1ltPtum4nelHJIBwG8ueNd7W7pdJJGWmeRrDwA5LW8tHqLUM2ZhUSZ7eK0UUuxvDT+8jONom2CtvvSMpMRsceBC1zbbZc9RVoYxksr3dZW2dn2xWquMjH3EbjXct5dD6W2bWTS0DJSxm9GOLiFZJtmsrI1rCNMbLNiEznNqbtG4M4E561uy63Sw7P7M5zGwtkY3qWPbRdrFtsFO6mt78ytGMtPJcl6z1zcNR1T3TSvMR5AuRoyUZ29Z9jLdqW1Cs1LVPZBKWwkkYB4LWVLBNcKxsbA58sh969NjsVfeKtkdNGXE9fYuo9k2yCCljhqrlH6fMgqh0uyNaNaWTZPVRWYV9Ux7WFu9xHNas1PCyluT44hhq7a2wXCLT+jjFDgDdIHV1Lhi7VRrK6WUnOTwUPuKrXNG6/BopjNeN7HWF1pc6Jlfa5Kd7Qct4LlrwXKunhubmy/GwusWuDmBzSC09azcmmc2pb4iOEdsemp7TqSd7Y3CEvIBIxla+ppDDUMkBwWnK7X24aObddPzVEDczt48AuLLnRy0FS6GYEOBwVeLydVNqnE6o8H/XZrxDbZ3gOaA0e5b7qWZfvNXz20FqGTT97iqWudjIyAu5dnuoYr/ZIpmvDnY+dZ2wb6o5ro7XvL6imkaWHBUuVzkEpUqmKlQuERFUBERQSSlSuUxUrlARAFHI1HKpJBERVAVSmPF3uVNVacek73IH2NReEU0eaxPXvLT/g9y9Hd3jOPSW3PCOlxpYj9Zac2ADN4f8A0l1w+2y8HitnYTTm3xu9i84K9TOFsi9y8q4MmVUuhOFabt8Uq7BWm7fFK2r7mqNcaz+KPmWXaK/i6R7FiOs/ij5ll2iv4v8A9leRqvuy/o6H9pFrn/hvzrPdK/hGf0VgdR/DfnWeaV/CM/orj9B/Uf6Z6r7ZlKIi/QDxyKIiAIiIAiIgCIiAIiIAtB+EP/GOz/1J/wAS34tB+EP/ABjs/wDUn/EuD1L7DPQ9M/UL/S47O/4L8yx2+fxpP9JZFs7/AIL8yx2+fxpP9JfMW9o/2ekvuS/oz638ovcFlMH4ILFrfyi9wWUwfggvYfZHDPuVFMz0XBx+KOtU3KlfZvFrLNLnG6M5VWZtmoNvmu3WeF9JSuw5zSMg8Vyk7xm9XHIy973LL9rt7kul7ka5+8GnkrpsM055U1HC6aMuiyOPZxXpVxVcMllhLBuvYbs4ioraytq4xvkBwBC3TNLGxnRxtDQOxQp4IrdAyCD0WBo4LzO4uJXn2WObKRSk8smyvRTyEvw/i32rzAKYZCzXTqaOOUae22bNG3Vk92o4x0jG7x3RzWuNj+tazTl88SuJdHTAlvpcF1eOjqInQ1DQ9jhgg9YWm9q2yoXEeOWSJrHN4lrea66rU1tmZOf7JG3rbcaK80raiCZkmR+KVUdG8dXBc0aV1Nc9DVDaSuDntacHq4LeemNe0l+iGAI3Y/G4KllWH0Kpyj0MiOWjiogn3Kq18MoDhIw+4pux/LHeqKLLbkVi1lTSujkaCHDByucdrGnG0+p45aYbge/PDtW9dQagp7NROeHsc5vtWsIXu1jdGyOZlrStYporCW1tmztHF7dN00cnMNCvVK374vLbqfxa2xQ9bRhTXevitNuNTI7dA61DWSrfQ1Vt61ZFbbRUUgkw9w5Ljre8Yujncw5+QtgbbdTvvWopi2TeYHHI+dYDZo3S3GEN7V21x2xN4dMI7f2H0bINHxODRngtihpdKCeSw/ZLTmHR0IxzWTX24R2q0S1Urg0MGeJwuV/NIwk/mZrzbdqyKx2WenEwDnRkbvWuJrtVOrLhNO528XuzlbB206yk1HepWtk3o2OLR7lh2jrLLfbrDSwt3nFwXXCCijev5ejNubAtFy1tbHXyxZa0jiQuvCBDTRxswMNAWH7K9Ms0/p9kUkYEpxlZjJuMBdI8NA7VjZ1ZhZPdLp2KTWu3hgcSvLqNlDPa3xV72tbjr6ljesdoVt03BIXSsMjQcDeHFc07RNs9Xd3SRUb3MB7OtWqraeSIxbeTEtsFLQ02o5hb3BzN48uSwRr3Aei4ge9VKqrqK+cvmc6RxOVTdHIwZexwHtC3O1SPXbKR1wq2wjJLiAuotjuyKnjZFcKxrXdeCFzBZK8W6tZOQTukHgul9mW2umjjio6prGg8AntgyucsfKdGRwRUdM2OFga1oxgKnvEnJVusupaG7RNc2aMZ6sq8COJ/pNe0g9hWLi8nJnHcoBTBVTCz5Q70m3W07t3jwUYG7weC4Xq3WuF0lXUxxhvUStJbTNtHiDHxWaVr38ssOVS2vaevV7nLaBzvkgArF9HbELtPM2a6t9D9Y81rFJGijHGX3NSXe8ag1pct2QSP3zy6ltLZ1sMqK58VTchho4kOXQOltnNktEQc+ghMuFmUUUFOwNgjawDqaMKXPBLv6YiWDSuk6LT1IyKCKPeA5hqyIPxwA4KRxKi0HPFQpZMW9zyy0axt0FxsFY2aJrsRniR7FwFrmgZQagqoo8Y3zyX0NvMJmtNVGDgujIz8y4W2raampdQTyuflriSOK1x0yb6d/tMd2e0MtZqWmYwejvjK7Q85bVpDTTTJVN6YR8BniVx7pW+w6fHTbuZBwC8Wr9Y11/qy90rhGBgNBRM1sgn3M22nbWq/UNRNBHIRDxaMcOC1NJJJM/JJe4qrQUVTcJ2xwsc97jjhxwt2bMtjFdcJ2VVZE4QdeeGUfUjdGC6GCaA0FXakrWtdCWxEjiQuwtmuzyk0rRRFzI3TgekcLINL6UtthpGMgpoxJji7HFZBzTOFg5p3SkRLuxSkIoquTNEoCmCAKICE5IYUccFFEwRklBwppX7kZco4Vj1bdYbXaZZZJWtIHarpdCrOM/CCuBqNVzM3s+m5YHpGjdV3mnaBnLuSuW1S5C5alqJo3bzd44Ku+xiljqL9CZSBjllR7noqWI4O19ntIaTStEwjB3AskCtdhmporTTxtmjw1oHFy9/jlN6+L9oK0kcDeXksGurQ69WWamZjLmkcVzLLsJqqm6yO3ssc7rC63NXSkcaiL9oKQVFCx2RLDvdu8FCXktGbisI17s22aUumKaNxYwy8yfatmcgAOSo+OU3r4v2goOrKX8oi/aChorJuTyysvDebe25UboHgEHtXo8dpfyiL9oIK2l/KIv2gg6mmqzYbQ1d78ceWgZ3ito6d07S2OlZFTxtG6MZAV0FZTnlPEf7QVKsudLS00k0k0WGjPxwp9izlOXQ9T3NYMvcGj2qXLXDLCCO0LnXabtujoKs0tCQ/dPxgsg2S7Vob+xtPUPaJSevhlUcchQZud3BAp+DmNcOIKpyDCzawRktOqaV9ZbXQxkhx7Foa67E6q91rpHzkAnPEro5rN7G8FWZG0cQFKJVjg8o0ZprYNS22VklRIyVw5h3/APxbRsekLda4wBDG8j9UYV2ud0prdA6SaZg3eYyFpbaHtvprS11PRlr3EZBGCtETunYzamoNUWiwU7jJNFG8Dg0HC5t2pbbqmoklo7ZMeiORkFai1jry6ahqi988gZk8AV4tM6YuOoatrYoZHB3WQrN4NoVJPLLdca6su1W973ySOcc4zlZ3s82Z3DUUo6WFzY84yQtt7L9hwhEdTd4wBwOCV0LabFbbTA2Ojga0N5cFVsmd214iYVs72ZUOmKdjnsjfLgHJHWtitDWMO60ANHIKYgHksY13qWn0/Z53ukYJCw8Cs2mzncnN9TQfhG6sbUR+JRyk7pIIXN1BCaqsihHN5wr5r69yXi/TzOeXNLip9nttkr9RUrQzeZvBWx0OyHyLBs7RdkrdKz01U1j29IASfYuotH3mG5WuNrXjpccQrTU6Sp6jTNOWx/fWQg5+Zax0VeZ7Nqt1PUOLYmvPA9axa3GEnxMs6BqoY6qndDMA5rhg5C5V8IPZ5LT1UldQQYZnJwF1PSzsq42zxn0SOS8eoLVT3u1TU87Gu32kAkcQVWL2srBuDPm9Kx0Uha4Fr2nBC3RsN2gTWu4QUFRK7xcnjk8ladsGzuq05cJZ2REROJIwOS1dSVEtHUCSMlr2nmFv9SOqTU0fSqnnir6OOaneHtIyCqRGFobYNtMbPTxUFymJcAGjeW/nBszBLEQ5p48Fy2RaOdZj0ZQKgon4xCgszRdQiIqssERFUEMKGFMpSgJSoKJUMKjJIIiKAQJwvTScd4+xeVwyvXRcI3k9QyokVm8RNBeElWYsxiJwc8VgHg4Q9LdJDjODlXLwj7s2WofTNfnjyVTwW6MyVkzyF3pbaS6TUMM6ixi3RjsC8rV65fRpw3sXlC81FK1hE7eStF2+KVd28laLt8UravuaI1zrL4jSst0V/F0n2LEdZfg2lZdor+L3zLyNV92X9HTL7SLVP/DfnWf6W+Oz+isAqP4b86z/AEt8dn9FcfoX6j/TPV/bMoREX6AeORREQBERAEREAREQBERAFoPwh/4x2f8AqT/iW/FoPwh/4x2f+pP+JcHqX2Geh6Z+oX+ly2d/wT5ljt9/jSf6SyHZy8GnAHYsf1CNzU5P6y+Yu7R/s9Jfcl/Rndu5Re4LKqf8GFilsdlsfuCyqmdmML2H9KOGRV61a9cnd0pUn2K6e1eDWEJqNLztb8YhV9zJ+xwLq1zn3yfPysLo7wd7fGyminaPTJXPOuaOSi1DO2UYO9kLpPwdpWSWyFrDkhejav8AyEn3N6XD47fcvKvVcMh7eHUvIDleYu5aH0k4CYQIrFyA4HIXojmcWlhIwe1UFEJjrkpKOSw6i0Nabw18skY6YjqWublom42tx8ltcGZyFudjy0qsJx8kH3rVTZRpmjYPOSmIDzIMKpPXagkbutL8+9bnlpYagnLG9yots9MxwduNKspoqaVoLFfrpVbtb0nQHicrbWltP09npWFjRv448FfWOZE3daxoHZhSveXI5NhIrxDe3uwDK0d4QOsTSWh9HC8b2SDx9i3nBgQv7cLjvb/TV8t8kcGnogVarrLBX3NLVE8lTK58riS7tWWbMbUbpf4Y2tzh3JY3brVWVtYyGGIue44AC6w2DbM3WuOK4VbWb54rtm9qL8RI3LpGj8nafhik9ENatE7fdoccDJ7VTuBycHjyWe7Zte02m7I6GmmxUuBG63muKdSXme83GSoqJHPc4k8Ssq47nkzjHL3M8R6SsrOsue7C6d2A6GZbmR3auwGEbw3lofRen6uvqmzRxlzWEOWw7trTUtvovJ1G17GtGMNC3ZrLqu50fqzajY9OsdHI4F7eQyuf9fbb5bgJorZkb3AEHkteNs+oNTVWahkpLut2eKzjTWwyrrnxuqXBgPVxVUorqzOKUO7NT3C73S+VJEj5Hl3UCrtY9n95ukg3KaUN7d0rqPSOw222vclnMbnj3raVpsVHaYg2CNnD2JKxJdCXZ16Ghdn+w+ACF90DuIzxH2q7bSdjFFLa3OtLMPaOHBb26UDAAUwc2QFjxkFYq1Nmbslk+buobDV2WrfFURuABwCQrVFM6JwcwkH2Lujafsuo9R0kskDGslxkcFyRrbQdx07WujdCXMzwI6l0KSZrGzJ4rRrS7W5zeiqXBreWDyWxbJtouFPC1tTKSRwzlaVkY+Mlrhgjgr5pDTNVqG5Mp4GHBPNWSyXbSjho33YdqtddqpsdO93HrzldAaKqKmroGOq+OR19a1xs02M0tqpWVNY4GYgEDC2q+42uxQCGomZFuqJx6dDnk12RcHUMLnl24M+5V2tcxoazkFjM2vtOxZ3q9vD2K1Vu1PTcIO7XDPsVEmujM9sjOy2U9ai1natPXXbTZomHoKolwWv9RbepQx7KGV2eo4VlBPuWUGzpypqIadhdI4ADtWKXvaFZbPG508oOOx2FyBeNr+pLg94FW8MKxC4XW93kkSSTSA8efNW2r2L8PydIa127UT2SRUIz1DC551bqya9VUkhcQHHkoWTRF4utQwdA/dd1kFbY0tsInrHRmrLGk8wcq37cGkcQeUaMo6GquLw2FjnlbB0Zsmu91rIzJA9kR68Lp3SWx612QBzmxyOGOYPBbMoqKGhgbHCxrWjsGFHZZInf16GrNA7IbVaIopaqPelb1EBbUoqWGih6KnaGsHUFW31IVG4wbcu5M4koFAKIUAioqCihBFFBFIIqIRESIPFeKg0tsqJgcFjSVxVtc2kXG5XSeiikIjYccCu17rTeNW+oh+WwhcI7ZNIzWXUFRM7hG48OKua1JZyzXckj5nb0pLnc8le+0Xee1SiSmduuByCrZC0yO3WcXFZlpnQd1vJ3o4DuYzxBUYOvfhZPbFtRvTIejEzt3q4lS/Chevyh/eVdHbI7r6o9xUnwR3X1Z7ipfUy4i8Ft+FC9evf+0U+FG9evf3lXP4I7r6o/WnwSXX1Z7iowSrfCLZ8KN69e/vKfCjevXv8A2irn8El19Ue4p8El19UfrTA4nnBbPhRvXr3/ALRURtRvXr3ftFXL4Jbt6t3cVEbJbt6t3cU2k8RfwW1m1K9NcD07/wBorzXHaTequF0ZncA7nxKvXwSXX1R7io/BJdfVHuKYHEX8Gs6yqlq5TJM4ucTnirjpe+T2S5R1EROAQfcs8GyS6+qPcVRqdk95DPQh+ooMp+51DsV1/Dqq3CNzh0rWg4ytpObx9i5+2DaKrdORumqBulw6+pXjbNre82OndHag8HGOAUdH3OVpOXQ2ld9RW+zxufVStAbz9IBag1vt5tFJG+Gia5zh2FaEuGptWaheYpnTva49iuli2RXK+PbJUOLS7jxypxH2NFBLuWHWO0q7ainkbTyPZG7kGkqw23S97vkoLIJZHO68ZXSmkPB+pKXcqKuZj3Dm05W4LFpC32djeihZkexVykid6j2OcNnuxGSbdlukT25xwLV0NpfQNnsVPGKeL0gOZAWWAtYMNaAFTc/jwWcpmbm5GA7VKi60NtzaA7daM8Fp+07ZZrTN0F0c5z2nByV0zUUsdbC6KYAtIxxXL23XZK2hjmu1I7geYCtHqiYJN4ZkVy29UDqMin+OtGbQ9oNdqOpdl5EXIAFa9eHRvLHEgg4QdmeKubqEYsElziTxK6R8HPRhqQK6VmC0g8lqTZnpCr1DfIWCLMQcMkhdy6M09Bpu1Np4WgOIG8cLObwis59MIvzWhlO2Hhuhu6tPbWtLGmhFdbGYl5kjtW3Xu9JUqqmir6d0M7Q4EY4rCMuuWZLMeprDZTqxraUW+4P+/nA49RW1clmCOS581rZanTuonV9OCyFrvjNW1dA6qhv9EGukBlAypnFvqiX16lw1hpqj1LbXxVLcndIXF+1HZ5W6duUr44X+L5yHY4YXdYzE/tBVq1Zpuj1NbH0tS1uHA8cKYWJLqSpbf6PndaLrUWmtZLA5zHNPausdjW1qCvp4aO4SAP5AkrUu1fZLVWGolmo4y6LORu9i1NR1FZZa1r2lzHsdxC2ajZEs3uR9J4zFW0zZoCMOGQQqD2Fhw5co7MttVTQyx09znldDwGTyXS2ndX2i+wMdDUMLyORK45wcCFmPcuyKu+Jrxvw8j19qpuje0ZcFl3NFJMkUFFQVWWBKgCoEqAKgEygVUDMN3njgqJnhkGI3ZKhpsjJBSqoepShVLEQOKqTyilo5pHcgwlSxDLxnksS2u32Ox2KQl+65zFKi5PCM5SORNrVz8oatqG5yBIQVvvwZrM6ko3Tvb8YZwuZoy+96tJ+N0kv+a7f2aWo2qzwhwwS3HvXbe1CvDLubawZNUH0iFRAVSU5kcpWrzl2Jj2wRHJWi7fFKu/USrPc+LHLWvuTE1zrEZjaPast0T/6gI9ixDVp3sD2rMtHMLbC4+xeRqetsv6OqX2kWmo/hvzrP9LD02f0FgM/Gs+dbB0u3Baf1VyegrOoMtW//ADMkREX355BFERAEREAREQBERAEREAWgvCKONQ2k9kDj/wAS36uf/CPO7frV/s7v8S4PUvsM9D0z9QipsmqOnJZ2cFS1nD0N/MmMDKs+x+t6K4EOPXhZXr6EPlfOOXUvmbfpT8Hp2Lbe15LnpyUSwtI44Cy+ieC3CwDQc/TUzuvAWb21+9I72L14SU61JHFNYbRcSppgJ6YwuGco5Ss4PBVWYtHLPhA6JmgrjWU0LizGTujKxzYlreTT96ip5yGx73Nx5Lry+WeivNLJFWRh+W4GVzntB2PT09U+qssbsk73Dgu2q5SW2ZVrJ0pb7xb7vC2SKqhJI6nheoNpuqVh+dcf2G3astEu7I6VrQeWStgW28Xrogx7pd72lZWUY6ojLXQ3+TTt5ys7155qqBmcSNOOwrUNO++VON17+9X+0Wu6mRpnc4t68rHYWTZn8UzZRlpVVeS3wuhiAfjK9eULBFEKOFGQMnqKjk9qipETyCPEqfPFS5wiuVwysx+6MdSxrUmj6O/RlskTMnjnCyEL0wNcXZapi3HqjOfQwHTezG3Wur6V9PE/ByOCumu9W0Gk7RI2J7GPa3gM8l6NdavptOW2Z8kjekA4cVxftP17VaiuMgbITFkgLrpjKbzIy7stu0PV1TqK7yyyTOfGXHA7FadK2ea73OKKNjnAuxwC8FottRda5kEDXOe844Bde7CtmUNroWVlxiHTgfOF0WNVroXbwjJtmmzumtFpgM8LN5zOORzWRDQ1rFY6WSmicCc/FWTvlDGCOPgGjCkEriuR2Nhbmsnkp7LaaQAxUULT7Gr3MMDAAxgAHIAKnku5qGFG5+42Z7k75fkcFIXuPMphMKCyikR96ioKOcIiGkVo5DydxBVp1Dpu23mmc2elic8jg4hXJk0bfjOA96lNxp2yhu+0/OtItoo012RzhrbYLLV3Hp7fGGsJ5BbA2T7MotKmKSohBlAyThbca9r25aQQqLqiNjiHOwtOIyrk30K2QBhowB2LQ+2axXOvmeaNz8Z5Ardz62JvHfBVNwoK78LuE9hU1yeepEd0euDiuXQt+nkLcyqn8FeoajPF/H2rtgWW382wNU4t1FGPwTR8y3co+5dWs4updh2oagji7j7Vfrb4Pd7e5vTZ3Oviutw+lhADSwY7FM2shPxXBQ2ieJJ9kaBsGwOOnwaprHEduFn9l2XWqh3elpojjtaFsCWuhjbkuC84usB/GHeikirc2UaHT9romNbDRQjH6oVxDI4wAxgAHUFJFVxSj0HAkqY8VVvKKPPuT7x6ipS0qZjccSjngYxg5UIr1JQFKVOoCZg+M4BSWTYCmaqT66Bhxvt71Up5mTN3mOBCtgPJHCijy1mN5wHvVF9bAxuS9vemB37FdRaqFPVxT/EPFVnODRkngrYIeSdQyqL6qJoyXhQjqo5DhpGU6DDPQtTba9AN1PacUsf37PMBbYyqcj490tlIAPUVYhNp9Dk7QuwmsjufTV8X3lp5OC6asenLdaqKKGGmiDmtxnCuJqqaIYD2DCp+VKfPxkyaNzZXFFTepZ3KHiNN6lncqkU8coBY4HKqqMlOq7nm8Rp/Us7lEUNN6lncvQpHvDPjFMkZbKXiNN6lncniNN6lncovqomtJL296o+U6f5SZJ2sq+I03qWdyeJUo/mWdylhrYZXbrHDKrH0kyRhruU/Eqb1LO5QNJSjnDH3KuOAVPO8q5BIKSlPKGPuUPE6b1DO5TF4j5pHURuOA4ZUbicEehiY3dZG1oPYFYLtpelucu9UxseOwjKyMnPJSbx6lDYXQstBpOz0bBuUEG927qusNNTU4xDBHH/RGFWBPWqE1XEx2C4H3KuS3VlbeB5BU3Occ5UI6iItzvBSPq4R+MFV9QRLu1Sqo2oi3N7fb86pvrIXYAcMqpP+FRpIPBYvtOoRcNLzw7heSOQWS72PSPJQnkp5ozHK5u6eBBRSaJy08o+fGotKV0d2miipJD6ZAwFmOidjVzvD4ZJI3tZkE73PC66k0vYaqcSPgjdJ2q80lDSW+ICBrWNHsWjn0wS5tsxfQGh6LS9vYxsDBMB8YBZbI8HgFTnuELDjKkjlbMMtWMmyFlvLJ1LvFhBCmIUmPas2y66nh1VZob5ZpadzGl7h6JxyXOlwfcdnWoWRtDtxzsnI5rpyKQtPsWOa40jQaht08kse9Uhh3Xda0hLrhle3fsVNFampL/aYXGRglLckA8lkBDoXcOS5Wgfdtn196SrDxSg8urC6D0PrGj1Nb2FrgJj1E81Flf7kR2/ov1xt9LdKV8VREx+8McQuftqOxJ9aJau1xNB5jAXQ0sboSC08FGObpAWTYLSMKkJuJZZ9j516j0rc9P1To5oZG7p544KtpXWl00/VB8c0m6OG7nku59T6Dsl+a4zU7elPWtD662GPYJJLawkDiAumNsH9Qyz16F2+PcIqe4ObgcyRjK3VY9fWm6wscKuAF36+FxTddnN9tsjyad7Wt5HBVpMl7tXN0jMH2qJVxl1QSR9D4KqhqBmOqgOex4VYxwn+caVwfYNpd4tbhvyyOxwKzu3bdZomtbIx5PYFi9O2WxL2OtOhiP44UuKWDLpJo2tHMucAuX37eGuaR0cgKxjUO0q6ahj6CgllaT1DrVVp2Q1I3ntE2lwWuqdRUUzZgTj0CCrjs2rKm5b00zTh3HitDaA2f3u+XRlVcY3GLOTvrqyz22C0UEMUTAC1oB4Kk0o9ETFs9Uo3HkBUnBTOO87Kmpoj0ozyXK316GucIna0Q0zpJTutaM5XKvhI6u8fqWUlPMHBoIODlbu2v60h03ZaiJrh0hacYK4qqZavUl+dzkc9y79LV++Rl1fUzrYjpWe63qKpdGTG0g7y7W6NlLTwxsGAxuFrPYZpQWbTTHTtxKQCtjzSbxx2Ln1MlN9C6y2implIorCJqTScI3FWSrdvRvPYrxMfvTlj80n3if8AolXh0Jia5vsvjFcWA54rYmnYzBp92exa0pN6rvxZ7Vs8PFLa3Ru7MLxbbFmc2dNv0qJjYdv13HtWzLBCY2xk/JWsqKN01eC0EguW3rbHuUsfaBzU/wDN0uU5TOfXPCSPWiIvtjywiIgCIiAIiIAiIgCIiALUe2uytuVZRzuGTFAR/wAS24sc1bbvHacvwDuxkfWufU18StxOjS2cO1SObtHyeT7oW4x6S2zqCnNXp4ygZ3m81qG4Rvo73KA0tw7gt02Yi4aVDM5ducAvmLYdHE97U942GHaDqOga+MnB61sW1v8ASz2rU7nOtV43MYBdjC2ZRztbRRPB4uAK6NDPfXs90cd0cSz5Ml3soFSon78IKq4XQc7RFp4qp0uWbpAVEFReFDRG081TZ6Wt4yhoPuVBul6FhBa1ncvb1qYHgoUmiNhSittPTfEY3PuVcYbyCk49qiFbJO3BM5xdzUAokcEaETDIoqBrIN/cD/S7F6WtLmggZClkN4WSDlBRc13Yohrj+KUiE8kMqYNLjwCqxxt/HOF47pebba6d0s1Sxpb1ErRdSrnjse+GLc9OQeiFg+0HaNa9O0j2Ml/6Rx9ELWu07bYKJklNbpAXOBGW9S5p1JqSvv1Y+eomc4uOfeuqvTt9WYybbL/tE15V6krJQ+Q7meQKxK02qqudSxlKx0j3HHAK86R0jX3+uZFHC4h3WRyXWOyfZHT6fjiqq6GN0vPB44XTKcalhEFl2J7J46CnhuFcwdJkO9ILfWGwxiOIANHDgpD0cDOihYGtHYFTyTzXFObm8ssoN9ZBTBSqZUL4AQoEKsiSZRUFFCoU5b94e72KVo3nYXkv9witloqXyu3SGO/uV4kPwjnratryvt9fJBb3uDskHBXlsN01LVackuDxJvNGc5WLWhzdS7RehnIdC6XBz710Brq4W3Seg5qOkbE6XcxujmVuowOpNwahjua02dbUaoXIUtxeW7zwMFZxtm1RNZNPw1dKTvSjqWitm9hrNR3qesLN2KN++XexZXtVurbvQQWinfvyRYbwKPb2QlXFXHu2Yajv2oqhhcJHQk45qjtZ1rc9MXuOFj5GMwDjK2rsWssWndFCpqYgx+M5K1Htst0mqZqmvpGA9H2DkFDWBDEptextHY3rvzmijje8Pfjjx4radbwhJXGng/Xd9p1W2GVxDA4Aj511pqq6x0+nX1cbxu4BypUU1lmF1W2awaa1nqK7M1Uyko950Tn44FXvVN7rbDZ2SzhwfuZ9Ir06Mt7L1cBcZ2Nc1ruawbwltSNdW01FSn0cAHB61aOPc27zUUuxj2ltZagvWoOgaZHRF+AMrZl8hv1PQOkjZIHBR2IWmhpLHDcKlrGPPEucFsWq1NQVNSaNgEgdwUxjH2Issan0RqvZ/d76+v6Osa8NDutb5oyXUzHO54VvobRSR7srYWtJGeS8ep79Ha6R7IcOkxjA6lbCj0OWyXEl0MU2o7QqOwUL44ZR047DheLY1qyfU7JnycgMrRG1ejq7jvVsriG7x5LZ/gtsxSzf0VU6LKYxqydAkcFpfbnqupsNA11GSHZxw6luapkEVPK93ANaT9S5I2i30an1O61h+Wb+MKzRjpYbpZPZoTUOo7/bJaiHpHhpzlVo9plz07d2U9yL2EnHpFbR0RSW7RWhZpHdF0u5nHXnBXPmooKrX2qHSU0QEbH8wFbb0OnpY3ldDpLU2rQNERXOJ4O+zeBB58FoW3ay1Feb4I6TpnRE44K+7RK7yToKjtTZczMG6RnrWX7ALPQQ2B11rQ3pGnm4clCSzhlIRVUHLGTCtU6zvul7hTNnMgaQDxW49C6xF+sQc57TKG73vWiPCAuxvuroYLdGHxtduZb18gsqt7HaG0pTVc7iwysDhk9ZU4LWx3RjlGJ6q2iXjzxkoKd7wwSYAGV0Bs68oS0rH1u8DgfGWiNn2nn6h1q26mPfi6QO9/Fda08LIomtjaGtAClRZlqZRWEidoWr9uWo59PWbp6YkPIPJbQleI43OccBoyuV9ueqBfaryXFLkg8kfYz08N8zzbP9Uah1DUOLA98Yd7etbDusd/gpDJHHICFX2BW+jsmmpJavoxKQDvFZ83UtBWydDTNZKD14ULt1N7LGpYS6Gsdmt3vs1+MVc2To97HFb4bxCtVvtVPC7p2Qta93HgFdWnClI5rrN77Eys2pqrxW3TSD4warytR7edUtsNtZGHEOe05wjxjqVpi5TSRpSt2gXuq1g6ipnSbnS4Az7VtdzNQeSZJjHIXtGc5WuNktspq6/su9Y5vRh+9kro6fUlA6ojpYA14f2dSrg77ZOLwkaT0hdtRvvO5URyhm9zK32bjHbLO2or3Yw3JUfJ1vpYjO6FjXYznC1ZtLvVRdIn0NHvNZjHDkpXRHO3xpdsIxu7bWzU6xbRUchMRkDeBXQNpe6aghkf8AGe0ErhGyW6Si11FHKSXCXrPuXdtj/wDVFJ/VhUi8vBbV1xrxtKN8e6GglkbzDSuR79tPutHrR0DJHiJr8AZK6f19c20dtla13pFhJC4w1FbJZ9SuqnN4OfnKSeC2nh8mWjs/Z7dpLvao5peZYCRnKyl3oZceQWutirybA0u5BoV21xqdlBQzsp35kDeQUvqsnNscp4Rhe2baXBY6Aw0Mh8ZOfilYRsl1PfNUVBL9+SPOckrUmpW1WqNSGLfLnF/xV1FshsEejdGyVNVGAQM5I44WdeJo7LK40wx7mE7bNYV2mZIIKYuy7ngq4bJbper7Tx1E7ZHRdp4rXG0WudrbVjYab0wx+O3rXQNnFPonZ7DJKGRvDMkgdqvt6ESltgunVml9pm0K4Wy/voKNzwd7dws+2R1N2ufRyXFsgYRxytLvppNWbRBPC0vjdNkEjhjK7Bstvp7bbII4ow3dYMqjRF81FJYKlYx3iMgZ8YNyuRtc7Qb1btSvp43SNa12MZXYbMO6uBXJW2+xeJ3yWu3MBx3uSbTPTdZ4aNw7HrlW3mjbNVgkYzkrLdc3qK1W+Qb2JcZAWsdiGqqZlhmbv/fI2jAXtqG1er7s5r94R73bzUPBayLdmX0MBs971Jc9TYZ0hpt/PBdG2KGWOjYZ/jFUtN6dpbPQsAiZ0oHE4V3c8cmjgsn2wZWT3v5SQqVTFSqgj0BSKRzDgdaIRlQT/ZYNbaQotV0u5UANe0ZBAXNdxgvmhL4fFhK2lYeDiDjC61a/dVp1Rp+k1BbZKeSMCQjgccVrCzH1GbWDC9AbUbZdqdsFxqWtqCMYPMlbI6Nk8bZIHAscMghco662b3HSFXJXUTi9jDvDdV32dbaLjDVR0N2O7EDu5IUyrUusSE2n0OlG78TvSGVWFQD+KrNY9UWq807XsrIelI+IXcVeOja9u9GQQexc8otMsmn3PBX2akuIPTMYc8+CxW77L7NcWkPa0E+xZm9kjeXBQ++jmVVSa9ycGnK3wf7PO4lkxGfYrZL4O1sBz4y7uW+A8jmoGbPNW40l7lsS9jRVN4PFs6TjUu7llOnNilmtFQJmyl5HaFszph1KVzi7kod02NsilR00Nrg6KBowEkeXnJKFjyeRVVkbGsL5nBoHasm2+5KSiinFG559EclatY6kotO2mWWZ4EgHH2K36z13atMUj3eMsdLjO6DxXIO0jaPc9UV0kbZT0XEAA81tRQ5vL7FHI8u1DWE2qr3IN95jLuHHmtk+D/s9mqKyC41UP3oPy3eCxXZDsxqdR3GKoqmfegcneXYtltdNYrVFSQRtbuDmOtb6i7bHZAhZb6npLI6OEQQANaBjgvOFM9xeclGhecdCWEMKIQ8FEEDmpLHnq3hrCM8SFiF5qPF4ZB2gq/3CQ9MMHhlYFr+r6EtYx3EpbJVVuRtVHMkjwaNp/GNRufjI3uCze/ydA7cBVp2f0BijFTI3B55Xq1NMJKz0eWF81q5baP5bNpdbEvB69LU/S1AdjrWzYRiJo9iwjQUO8CXt5clnIC+m/wCfp2aZS8nm62Tc8EURF7xxhERAEREAREQBERAEREAKo1TQ6mkDhkEFVlAjIIKBdHk512g2gwV7pGsxk5V82f3LfaKcnLcAYWU7VLU19B0sI9IDita6VkNDdN5+Q3rXgaunbJs9+uauowXTaNbzBcGzxt5HOVedM1orKeJmeTcK7amoxdrX0sbQSG5WvNL1z7bdnQznhnC82ibpu69mVac68e6NtUM+7MI84V0dwKx2mlDv+kj4ivlLO2eMEL1JLrlHKyohRCqkEqBRUQowSQUURSCdV4Y8xScccFQVSOUtGByKqjOaeOhozV+rZ9P34yTDMbXcB7lsPQu0ChvtEXOexrxzDjhW/aZoaC/2+SSBv34AnAXL94seqdP1b46Rs7GNPAtJXfXGE44OecpJYO1JNQUMbd4yxfO4Kw3faNbLaxxfJEccvSHFcazVusC3DnVPcV4Z6DU1ePvsVQ/PaCpWlj5M8yN/6v8ACAhGYaOJnDsOVo3WG0O632Z+ZnsjP4odwS07Ob1cZ2iWB7c+9bW0hsKfK6J1x4DrW8VXWsFupoSgt1feahrGskeXHmtubPNi1xr6pk1XC8QjjxBAXQ+ktlVksjWy4DpB1YWewxR0cYZAMN7FnPUe0SUmYvpDRNr0/BHuQNEoHNZVJKAMR8ByCpvkLzxUi5ZNyfU0UCJOTkqIUqmClFyZERSCZERSCKhnKiotaXZwozgpJ4RUgYd4O6lpPwidVvtbG0ULhmQceOFtnUd6p7NZ56id27uNOPauSdXXqPW+pWxMycP4ZW0I5WS+ni5S3S7F42X6QrJ6pl3a0jLg4O5LNrvoK932+MMznupj28cra+zqzQUOlqSPdG/u8yFlD5IqSIvfgAdauXnrJN/Ka1ltdu0PpapjYwRzPiI3jzWhdmNBNqLaI/pWl0XSZ58+KyjwhNbNmvMNBRyEx43SWrONilqt9ntLLrU8JHsySVbEc5ReO6utzfVsy/WddHa7G+20+A4sxjeVn0Np9lbpiuZUN4yNcAsa1BqCC961EEDss3sBbpsFEygt7I2DHDipzGUsGM24V492cU6qt82jdVPmZlhEnBbksesXaq0myibjpTw4K0+FLYSXwVFO38XOAOSx/wAHW21LLpGakFsIPIhS++EdO9OtTfc3rao2aU0FVVM2GuDCeK5qbDVbQNVyNZvvcH4AHHgts7d9c0lKyS0QFzt5u45oVu8HmloLfUy1s/BzgcKyj7FK8xi7MdWZTVaJu1JpSOkpHPa5reAUdnmkbhS10cle8uI7Stg3PWFqpYiHTZd2LGa/XlHTQOnieMDrwq4UZZRinZJYwZTq/UENhtrnPILww4APWtHWvVkt1vkwnY98ZJOOavhr365qwyLLogccFn9m2e2uhpnPezMpb2KzTk+haOylfN3Of9ql9pn0DqWGNrSCs+8F6FzaKdx5YWAbcqK3UD3mLhJnks88GS508dlqXyOwA3mii4y6m9rUqPlNi7WNTssFmczfa2SVhxkrmDR9irL1rQV0bXGMvzvArKfCM1bFdbpDSUbyWNdu8VtbYRYaYaSgqZG/fTjjhWeG8FK3y9W73ZYb/pC8XB0cEbpDEW8VlGjtGUuk7FU1FaxvS7hOSOOVs1zWQgOPBoWkdvWv4bVD4hC85cN049qtlIwjZK57UaZu9TPq3WstG3Lo+kw0c+tbcodJ3aisDrfSF7CW4AVg2Fafgrbw26njlwdy9q6VFPGHZwqRi87maW3cN7V7Gk9C7MDROdXX2MyOb6fpLB9u12Zd5IbXbSPvWGhjRnrW+tompqWy6fr+keBJ0ZDePXhcsbOLjBedcudWuJic/HatG0TVKU27JHQuwiwi36Xjknj++uxzHLgtpjgsVg1JZ7VRtZ0gbG0Kz1euqWerBo3uMbTz7VCkksHLOE7JN4L9ri+RWi1Tbzm77mHAPuXIFktFXqjaDkAua5/AhbC8ILWrZX09NTucA5uCFkWwunt0driuUn4f4xcjkmdMIyqrbL1dNEXSnsb4KB8jSQRgdak2S6SuNsrHyXJ7nnJPFZ7ddZWqCFzTL6Z5BefTd1dXyl0DstKjJz8SSjhmYt+KAiM+IMqIV/YwKVdP4tRzTfIaSuSNtF4k1dd46SmG+6P0cA561vjatrOktFhq4N/Er2lvNc8bFIPL+ui6cl7d85VJNdjroi4JzM80ns9ucWiR0Ae2XGcFZJoLSt0trhV3N+QztW4WNgt9I1pw2JgwtX642gUUUzqCleN9xxwUP5RCydnQt21PXpgbHS0Wex2D1qxsv9PFZBV1Ee89zeZWRaV0Qy9yeN3NpIed7JV217pe00FkLd1rWBqq1NmsZVwe33OZaOobctocMkHxel/zXbFA4w2KFw5tiB+pcQWOamp9fxNhPoGbAXW+ptU0dq09Cx0mHPiA93BVrWO5bUxdjjFGK19dJfbrU0ud5oJ4LUutbfHQXExvG67K29stiZX3ioqxgh/ELV3hCwTC7yCjHpgrTblZEHtlw2Zvsx1Syhtho4zl5bgKnfmTUzqmornfe5BkZ5LHfB90/Uyb9TdGuEbMH0vnU3hCapp+lgorY8AjDThVXXoTtxZiBi+zywuuOvWysZmHpM5+db52wXiGz6Qnt8BaHujxjuVk2HUdJRaaZc6oASEZLsLVO2PUxu+tfFoHb0O9u+9WUVFdDNxlOz5vY9/g7WB1x1BPVVjHFjTkZHtWZeEjfOjskdBSPaOPxWrKdnsVDpvS0k4wJ3Rb2T24WhbxeW6i1q+OsJ6EvwAVGemCVmyzd4NkeDppwTW019RGRK3GMhb/AJPibvUFhGhq+0WeyRwRSBgwM8OajeNZUzp2xUj/AEicHiqyMLN05ZaM1iPYtD+EhHF5FcWYMnVhbctdd0NA+oqnYbu5yuYdo+p3ag1a+3gkw72MFV9i9EWrMlPwebHXXGtlIa8QgekD1rq20WmlttPHusaJMcXALENjmnYbHai6NrQZWgnCzp5JccqjWCNRY5zeBLIXH2KkpsKCzzkpAgiIoZYg1HI1CqglJyjCWnIUUChroBW0dHc6cxVsTZGkYIIWkdqOx9lTE+o07BuPwSWtW7+SnbNwwVNdjiZuDOGBSak0RW9JUGZgaeGcgfOtlaP8IB1JuQ1kAeOs5W/NTaLtGo4HMrYhl3XhaL1xsMipWSS2nIPMBdSlCawyj6G39PbTLVe4Yy1zGPeOILuSy6mrqaqaDHPHx9q4KuFk1NZJ3sjjqGhjsAjIUlJq/U1sfl9TUBo4YyVSVEX2EZHf5Yx3843vTxaM/jBcU2va/eKZoEtRI4j2q+M251rWAFzs+9YvTy9i7kzrl1OxvJwCpPkggG8+Vg/tBceV22y5ztLY5nNz2LErltH1BXPcIquUdmEWll7kb5HZ191zbLPG58skR3eYLwtIa729NcyWnoGMyRgELRD5dSXjId4xNvcVl2iNk9zvcrHVsLmMdzLlvGqEPqKqTZhlyul31XdHHL5XPPIdS29sp2MT1lTHV3WI9GPSDXBbg0HsestiYyaVodKAOpbNjbHSRCKn4MCzu1PTbA0SbZ4LHZ6Gw0TIaOJrN0YyvVI9z3ZcoSPL3ZcoLgy33OiMcdSVERCxFUq6ToYd5VgRxz1K0VdQJ5TCDxKlLLJSPDWPPiz5jyHFa0vExu9zYwZcAcYWW6quzKOikpt7dceasuz20yVVY6omBIByuLX2OTVUTqpW2LsZndLCKKxMwN045LHA41dY0O45Kvl+qxHS9A08hyVq07TPnr4yOAJ5rwNS+LqI1x7CHSLn7mw9M0YpoA4DGVfQqVPGI4WtA5BVV+haWrg1KB4tk3OTbCIi6CgREQBERAEREAREQBERAEREBbb5QNrqRzCAThaSvludQ17yG4aCt/OWF6vsImY+eNuesgLl1FW9ZO3R3uD2vsWPStcJKXoJDnhjisP2g2aSin8ZibhrzngrtbhJR1YJ4AHBWW1sEN8t3ROaHOaF89qqX7HcpcOefZmJ6Qu7KmgbTSv9PrCyyimNNI1ufRPIrUldSVOnbr0jQ4R5Ww7Bco7rS9K144DuWulvVkdku6F1aj8y7GZtIe0OHWmFaLdWbj9yQ+iVeDh2COIXQ+hztEqIiEBERQEFFQRAVYpd12SMjsSroqStZ98p4i4+xSNU2SORTLXYzlDLLXJpWhe/Ip4v2VXh01b4sHxeIn+ivb0kg/GKj0r+0q6cmUVZPBSU1PjFPH+yvR4wxvxWAe5eQvceZ4KIT5vcbF7k8j985AwpB71MmFY0SCIikBTBSqbOFbKBFRUuVHeUp5BOigoqSoByp2O3TnqVMplMIrJZ7mK67tMt6oH0jSQ146lrjSWyLyNdjVvLHA8cELerNw/HCqkxY4BaZ+XA4koraux57UzxakbFgADkF5b+11RRviZzXuIA+LyQNaT6QyiM8YNB3zZCb1eW1j3ZcDnis+h09LS2KO3Rgt3BgYWwgYh1BPvWeSsa8aeNrNSWPZ++kuwrHY3gd7ituUzsQtB6hhPveOSlHA8EXQzlJzWGWLWOnItRQsjka0kAjirba9JRWWnayCMAj5KzLOCpsgjirpjfLbt9jQur9lMuorya8uPNXi0aLktNM2KNmCPkrcTTGOxRcIndisWWoklg05PoiouUx6Rzg0qnXbNpH0bqdrncfat0NEQ5NHco4j7EJ5mfsa/2aaP82wS/iSOtZ9O/724DrGFMd3qUg481ZMybcnlmmNe7NnalrS9ww1erSGgn6bt0tPET98GDhbha1gHxVEtZ1tCl4ZfjyS2o5+rtj5uN08bkOTnP1rcWi7WLLao6IDgwLIA1g4hoUMBT2KStlJYZQuOX0zg0cVo3Xmy6bVVzFU5+C08z7FvggEYKiI2dgU4yRCbreYmB7O9LjTlJFThoy0ceCz15w0lRDGg8AhCkrObm8s1ZtC0lNqJ0jeIac4WD2LZBJZKzxpjsO555LosMYfxQnRM+SE2p9zSF8orBpS4aNq62Poy5wCudh2fGhoHB7suK2uYYx+KFNutOBjgp2RJ5iRz5qbZI6+1Yke7i3t4q/WTSE9jt7KOIOw3s4LcnRtHJoUOhjd8ZoPzJsiS9TJrDNKHQk9wuIkkc4DsPWtn6YsEdmpmNHFwHFX1sTGHLWgFTKUkjKdrksBU5iQzgqmUzlG0ZmnNoWg5dTTO9J3Ek8VHZns5Gla5s4AL/AO5bh3G9gTcb2BU2myuajtLbfoHVNA5jOeMrTR2YvqtQCukdwznBW9y0HmoBjR+KFLWSIWyh2PNbKZtHQwwtAG60BY7ri3Pu9IaYNyCFlZHYpejaTxGSoz7FVJ7txz3Q7GRDdRXnHB+971kmpdGzXcwseX4jaG8luHdYPxVDcjP4oTButTNPJheg9POsbAAACRhTX7RVNd7l41KGb3PisyLQMYCYUNv2M5WSctxi3kkWu2PpqSJoJGMtC1Nedlkl1uPjMhPPOCugdxrvjIWR/JVctvqTG2UTWdtsc1DZhboxhmMclidRspM9yFe7JcDvErexjj62DuUSIy3AAwjZbjyNZS2WWa3ijAcAG7vBYRNssfBXGqAye0LoDoIR+IFAsg62hVyTG9p9DTdPpqrbB0YLuWFdLFoZ7ahlRM48DnitndHTjkwdyOLGDDRhUlIs7pSLDeLeZbYaWMcCMLVUGyQNvouLnD42VvAFp5hTF0eOAVNzKqcl2PFZofE6ZkYGN1oC9jueVISM8OSEqMkY65IqBTKlJ4KGyUCVDKgeagoyWJgoqVRVGyCKgThRUCMoSSoiISRBwcqoJ28nNB96o4UuE7EbU+5SuNqo7lEWS08XHr3Vg1/2SWy6McR0bHnsatgbxA4FQbI8Hmm6Xko6+uUaAr/B2jkkcY6loyrY/wAHN2eFUF0qJXHmVEStCtxZr3HDZzfTeDn6fGqCyiybBqOiex00rXgdq3P0zVB0rjyKrK6bHDZjNn0HbbVu9HFG4DtCyWDoaSMMiiYwD5IUjnvP4xUvPmsZTlLuTGvHcmmlEmcdapccAKICiqmq6EjlKp3c1I5C6CiAgGThUK2pbTsc3mUSBRuFR0TCGHJKsNbOyki8akOHL0ulLy98h4Dj7lrvVd8dXTPoqckj2KttqphuZpXBzeEeC4Okvl8AZksLgtrWymbY7ZxAa4jhlY/oPTTaWlFVVtGSMjeVx1JchUfeYjkN4DC8K251Vytl3fY3se9qqPZFmr5XVda9w4glZ1o62BkTZXt49SwikhqG1tPHDEXvk5DC2vZqeSnpGslbuuC39A0E7J8zPsc+qtUI8Ndz38kRF9seURREQBERAEREAREQBERAEREAREQBUqmITROYeRGFVRB2NdagtBhmc5gwqVqmfTuAws/rqRlVEQ4DKxKut7oJTw4Lz9RQmd9d2+OGW3VtljutBvMb98xngtYUVVVadruhlB6Le+YhbmopHN9B+CPasf1fpqK5QOkiaA8ceC8C+mVcuJDudVNqxw59iNvrYblA19KRvAcRlXmirHxkRy/WtPUdZW6dr9xxcGg962HaLvSV9O1xkzL2Lqo1Mb1t9ybK3B9OxmbHCQZCjhWSnq5I8BvEK6w1LJGB2cHrXQ4tGDRVUFPgnlxCgqkZIIiICIU2VKFMhBNhSqYqUKUCZTKCir5IIoiKQEREIIKKgooSCcIFBxwohWiyCfPBR5qVTBXyVZEoii1SiGTNCAKIQBWIIqCmwoYUkBRUFFSQRUVBRUkE2FHmoBRQhjCAIoq6KtEQEwiKQRREUgmyoIilIjBEKOVAKKsRgipsqUFRUkEVMpVMhAREV0AiJlSCKJlMqSAiZTKAKCioKGCKIiAgiiihonJBMcERVwCXCYRMKcE5IFFNhFGAUyFAqZykJVH0JGVKSpSVKSqtlsEznKkTkqJUhWcmXUSJKkypetMLLLL4I5UqhlTKMkjCjhFFQ2SSqKIpICIoZQkiihlRQBERQAiIgJSpSpipSoCIKCIoLhERQ0QFBRUFUlEqhnCiodargEQVAoAhB6gqN4eASqIapHyMjGXnCt9bXHlBxUpN9iyR6KyrbCwgfGVlnL3ZklPoqEtTGz75UuIAWD6p1O+SR1PROJzyAUW2xojmRpCuU3iJU1hqMBvQUPxuWQmiNMyVEwq6sZyc+l1qlpDS8tbUNq60EjnxC2FXVENroRFFjIHMLx7bXNu219PB0SahHZHuUbxXihY2GE4AGCscpoH1EpkA9HOTlSPlM8xlqHHdzzV+0/a33GpHQu3IGjOe1edp6LfU78R+lFZTjRDL7mUacpIpoYKncAczkVki89DTMpadkTMYaOpehfoWnojRWq49keNZNzluYREWxQIiIAiIgCIiAIiIAiIgCIiAIiIAiIgC8tbSsqIzw9JepFDimSm08oxmajdGT6KMbhgDuKyGWJr+YXgkpg0nK4L9On2No2N9zDdS6ZhusDyxoa9atrbfWadrd9m8YweK37JCT8UcFbLpZ6Wshd00YcevK8HUaVxe6HRnfTqmvll2NeWLVjaoCGU7rjzJWV0zo/wjZQ4+xYXqDR08chlost61Y6O411onDatxLW8FarWSh8lxs6oyWa2bbhupY7o+ftVwgqmyjJOFhNq1LRVkTWNaOkPMq5hs0jt6F/old8ds1mDMHHHfoZWC0/jBOHUQscpzUxu4u71721BA9I8UcGQ4l0UytrLg1vM5U4uMShxkRtZcSgVv8pRJ5Sj6ypUWNrLigOVbvKUSgLlGORU4ZG1l0ymVa/KbO1PKbO1SkxsZdMplWzymztUPKbO1T1Gxl0ymVa/KbO1PKbO1Oo2suaiFbPKbO1Bc2dqLI2MugKmBVo8ps7U8qM7VOWQ4Nl5ypmnirL5UZ2qIujO1SpNEcNl73lEEKx+VGdqeVG9qtxP4IdTL+isHlYfKTysPlKeI/BHCZfUVj8rjtUPK47U4jHCZf8pkKw+Vx8pPKw+UnEY4TL/vBR3m9qx7ysPlJ5WHyk4jI4LMh329qb7e1Y95WHyk8rDtVuKxwWZFvt7U329qxvysPlJ5WHyk4z8DgsyXeb2oHt7VjnlYfKTysPlJx34HAZke+3tQPb2rHPKw+UnlYfKU8w17DgMyUPb2qO+3tWM+WB2p5YHanMvwRwGZRvt7U6VvasX8sDtTyt+sp5nyiOXZlHSN7VHfb2rFvLA7VHywO1TzP8EcBmUb7e1R329qxbywO1PLA7U5r+By7Mq329qdI3tWKeWPanlj2qVq34HLSMr6RvanSN7Vinlj2p5Y9qnm/wCBy0jKukb2p0je1Yt5YHanlgdqc3/A5aRlXSN7U6RvasU8se1PLHtTm/4HLSMr6RvanSN7Vivlj2p5Y9qc3/A5aRlXSN7U6RvasV8se1PLHtTm34HLSMq6RvanSN7Vivlj2p5Y9qh6r+By0jKekZ2p0re1Yt5X9qeV/ao5p+By0jKOlb2p0re1Yv5XHaoeVx2pzT8E8szJnSN7VSdI3tWPeVv1lDyqPlKj1DfsSqGjIC9vapC4HkVY/Ko+UoeVf1lV2yLcJl8LlKXD2Ky+VW9ZynlRijiSZZVsvBPuUPnCtHlNnanlNnaoyyeGy7ZTKtHlNnanlNnaoyxw2XjuT5wrR5TYnlNinLHDZd0Vo8psTymxMvwOGy759yZVo8ps7U8ps7Uyxw2XfKZ9ytHlNnanlNnaoyxw2XfKfOFaPKbO1PKbFG5jhsu6K0eU2J5SYm5+Bw2XfKlVq8pMTymxTuZKgy5orZ5TYnlNijLGxlzRWzykxPKTFHzDYy5qUlW7ymxSm5MPWq/MNjLmCpmtYfjFWh1cHfFK8tRUyFuGOxlRtkydjZkDnxN/HCtdXdDESG8QrK9lW/8AHA95VCe5RUTCastduqNm3rJiMOvkuMlT4ycueGj2q0XS7xW1rnb7XkLFr7qqOoLo6AYP6qt9usNyvEjXyFxafnyua3XRi9tayzohS31l0RLdb7V3yYw07MA8MYWR6R0WcNqa7r48RzWR2HTdDaYRJUtBPMqa83hoHRUx3eo4XmaixR/9L3l+C29P5Kux66yvprdTiKEDhw4LFqid9XKXyOIZngFFvSVLi4kuI7VcbJbZrrK1joSyBjsOdjmuGmm/1W3bFYiv/hSUo0Ry+57LTYvKkGG46MYJ9q2DRUsVHTsigY1jWjHAc1Lb6OGggEUDAB1+1epfd6LRV6Ovh1nl22u2WWTIiLtMQiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgBUjmh3NTooaz3BRczGN0LzywDmvcqcjN4cFy26dS7FlJos9RCTlpaMLGL3pikrt5zx6R9iy6rrKSncI5p2NeeQK88kLnEObxaRkFeRqNN5R0VXSi8o0zddKVVueX0WeByMLwQ3S80Ty2VrgB7VuuXc4tfG13vCtVZaqesO70bB8y87gyg/kZ6EdQp/WjXEWo6kjLycr0w6kJP31x71lT9G05dkFoXkqdEQPBw4DKurtREvuqkW2PUNNj0pFWbqCiH46pyaAaXZZL9apnQOP5096tzeoXsNtXk9HnDRfLUPOGi+WvN5hAc5SPnTzCb67HvKc3f4GyryenzhovlfWnnDRfK+tebzCb68d6eYTfXjvTm7/AATsq8np8v0Xy08v0Xy15vMRvrx3p5iN9cP2k5u/wRsq8np84aL5aecNF8tefzBj9cP2lDzCZ1TD9pRzd/gbKvJ6POCi+WnnBRfLXm8w2+vHenmG31471POX+Bsq8np84aL1ij5wUXy15vMJnXMP2lDzDb68d6c3f4GyryerzgovlqHnBRfLXn8w2+vHenmG314705u/wNlXk9PnBRfLTzgovlrzeYbfXjvTzDb68d6c5f4J2VeT0+cNH8tPOGi+WvN5ht9eO9PMNvrx3pzl/gbKvJ6fOGj+WnnBRfLXm8w2+vHenmG314705y/wNlXk9HnBRfLTzgovlrz+YTfXjvTzCb68d6c5f4Gyryenzgovlp5wUXy15vMJvrx3p5hN9d9ac5f4I2VeT0ecFF8tPOCi+WvP5hN9eO9PMJvrx3pzl/gbKvJ6fOCj+WnnDR+sXm8wm+u+tR8wW+uPenN3+Bsq8no84aP1iecNH6xebzB7JfrTzAPrPrTm7/A2VeT0+cFH6xPOCj9Z9a83wfn1v1p8H59b9ac5qPA2VeT0+cNH8tPOGj9YvN5gH1n1p5gH1n1pzmo8DZV5PT5xUfrE84qP1i8x2fH1v1p8Hx9b9ac3qPA21eT0+cFH6xPOCj9YvN8H7vWHvT4P3esPenN6jwNtXk9PnFR+sTzio/WLzfB871p70+D13rD3pzeo8DbV5PT5wUXrE84KP1i83wfn1n1p5gH1n1pzeo8DbV5PT5xUfrE84qP1i83wfO9ae9Pg+PrT3pzeo8DbV5PT5wUfrE84KP1i83mAfW/WnmAfW/WnN3+Btq/I9PnBR+sTzgo/WLzfB+fWfWnmAfWfWnOX+Btq/I9HnDResTzhovWLzeYJ9Z9aeYJ9b9ac5f4G2ryenzho/WJ5w0XrF5vME+t+tPMHtlI+dOcv8DbV5PV5w0frE84aP1i8vmCPXfWnmC3131pzl/gnbV5PT5w0frE84aP1i83mEPXfWnmEPXnvTm7/AANtXk9XnDR+sTzho/WLy+YLfXfWnmC3131pzd/hDZV5PX5w0frE84aP1i83mE315708wm+vPenN3+ERtq8noGoaP1ih5w0frF5xoJvr/rUPMJvr/rTm9R4Q2VeT1ecNH6xPOGj9YvL5gt9d9aeYLfXfWp5zUeENlXk9fnDR+sTzho/WfWvN5hN9ee9PMJvrz3qOb1HhDZV5K/nDR+sTzho/WfWvN5hN9f8AWnmE31/1pzd/hDZV5PT5wUfy084KP1i83mC3131p5gj131pzd/hE7KvJ6fOCj9YnnBR+sXm8wR67608wR67605u/whsq8nr84aP1n1p5wUfrPrXm8wh6896eYTfXHvTm7/CI2VeSv5w0frE84aP1n1rzeYTfX/WnmE31/wBac3f4Q2VeT0+cFH6xPOCj9YvN5gj131p5gj131pzd/hE7KvJ6/OGj9YnnDR+sXm8wh6896eYTfXHvUc1f4RGyryV/OCj+WnnDResXm8wm+v8ArTzCb6/61PNX+ENlXk9PnBR/LTzgo/WLzeYI9d9aeYI9d9ac3f4ROyryenzgo/WJ5wUfrF5vMEeu+tPMEeu+tObv8IbKvJ6fOCj+WnnBR/LXm8wm+u+tPMJvrvrTmr/CGyryeo6ho/WKmdQ0fVIqR0E31/1qI0C3PGb605u/wiNlXkkqNRRbh6KTK8L9RTEZa4q+UmgoWOy+T61cG6OpR+O1VeovZGaomFVGoLhIzdh3ifYvNT0F3uz92cP3Xc1siLTlHSN3iWHCr+UoKIbsUbcBc1ty72zJViX0LqY/YdGUlLiSryHdYIWSVFVT26ENpQDuq03G9OqMtALfcrO+YDBleQD2rgnrv/50rP8AI2Sn1seEXKsus1ZwdwHsXjhgLpBvMJ9y9VLb5KqIPoyC4+xZXp60y0gHlCNshK7dD6HdqpKzUPoYWauuuO2vuW636dFfulj+jb2jrWbUFKyipmwx43W+zClhjYPwTQxvYF62DC+z0ulr0sNlaPNnZKbzImAUyIugoRREQgIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAtV1slHcMOmj++NOQ8cwvLd5a2ip42UVOZgB6WOoK/qBCpOuM1hlk8GORxOmpmyykMceYPUrdUvEbsNkB9yySvtsVYwtc9zP6K8kNgp4m4DnO9pXn26DLzA1hbjuYxPUSD4rivMa2QfGeVlNVaYsFrVZa6gZEDhpyuSz0+zumbxuh7ltfc3N/GK88t4x+OVRqm4dwierTUvaHEdE/uXLLQ3eDaN1Rc5L471hXnkvzvWFWaVzOP3t68Uu4fxHrCWi1HsmaK6kvz9QkfjlUX6lLeUpWPvDD+I9UHRsP4ju5ZvRal+zNVfpzI3aod60qm7Vbh/OFY66AZ/Bu7lA0rTzjd3Kvw/Uv2ZdX6cv/nY71hTztd6wqweJs9U7uTxNnqndyn4dqfDJ42nL752O9YU87XetKsfiDPVO7kFAzP4N3co+HanwxxtMX/zqd60p51O9aVZRQM9U7uURQMz+Cd3KH6fql5HG0xfG6pef50qYaml9YVZW0TMfgndynFI31TlV6DVfyONpi9DUsnrCpm6jkP84VZ20rfVOUzaZvqXKvIazwyHfp0XpuoHnnIVUbfSfxyrM2nb6pyqCFrf5pyj4frPDKu/TMvIvZ+WVVbeifxyrK1rB/NO7lUYWA/gnqeQ1nhkcfTl6beCfxiqgurjycVZ2uj9U/uVRssY/mXpyGs8Mh36cuzbm8/jFVW3J/yirOyeL1b+5VRVReqenw/WeGU41BdhXv8AlKYVru1WltXF6l/cqja2MHhE/uV16fq/dMh30l4ZVPP4yqtnefxlaWXBmPwTu5Vo7mwc4Xdy1j6dqfco76vYuzHvPJxVdhkP4ytDbzC3nDIfmVdt+hH8xJ3LeHpt3uZSuh7F1ayQ/jquyF5xl2VaG6ihHKnf84VZmpYh/wBXd3Lqh6dP3M5XIvLKdx61UbRuP4ytDNVxN/mHfsqs3WEI/mHH5l1Q9Oj7mbv8F3bb3nmQqjba7rOPcrONZw/k7+5T+eUP5PJ3LePp1fuZu1l38mH5R71HyYflHvVn88ofUSdyeeUPqJO5X+H1IrxZF38mH5R71DyZjm496tPnlD+Tydyh54wn/q8ncoehq9ieNIupt+PxsqU0fuVrdq6I8oHn5lT864/yeTuWEtBH2JVrLm+lcDwIVN8BbzVrfqmMn+Dydypu1NGf5iTuXPPQP2NFb5Lk6MhUntIVtfqJjuVPJ3Kk6/tP/V39y5p6Gz2RKsRcnF461SdK4fjK2vvbfUSdypuvDD/MSdy5p6HUeyZorYlxdUFp+MqclUcfGVrkujTygk7lSdcB6p/cuaWh1fsmXVsPcubqwg/GVN9wf8pW11c31T+5SPrG+qf3LGWg1vsmaK6ouBuD/lKmbm/5St7qlnqX9ypGZvqXrGXp+v8ADLcakuZub/lKXym/5StvSN9S9S9I31L1X4fr/DJ49JdPKj/lJ5Uf8pWvpB6l6dIPUvT4fr/BPGqZcvKj/lJ5Uf8AKVs6Qepf3J0sfqn9yfD9f4ZHGqLn5Uf8pPKb/lK2dLH6p/cnSx+qf3J8P1/hk8aouvlR/wApPKj/AJStHSx+qf3J0rPVPT4fr/A4tRdvKj/lJ5Uf8pWjpmeqf3J0zPVPT4fr/A4tJdvKj/lJ5Uf8pWnp4/VP7lDp4/VP7k+H6/wyeLSXnyo/5SeVH/KVl6eP1T06eP1T0+Ha/wAMK2kvXlR/yk8pv+UrL4xH6p6eMR+qenw/X+GTxqS8+VX/ACk8qv8AlKy+MR+qenjEfqnp8O1/hjjUl68pv+UnlN/ylZfGo/VPUDVR+qenw7X+GONSX3ym/wCUnlN/ylYDVR5/BPTxtnVG8Kfh2v8ADId9KL95Tf8AKKeU3/KWP+Ot9W/uQ1rfVv7lHw/X+GRzFJf/ACo/5SeU3/KWOm4Rjmx6G4RfJf3J8O1/hjmKTI/Kj/lJ5Uf8pY15Qj+Q/uUDcY/kvT4fr/DHMUmTeVH/ACk8qP8AlLF/KcfyHp5Tj+Q9Ph+v8McxSZP5Uf8AKUPKj/lLF/KkXyHp5Tj+Q9Ph2v8ADHMUmU+VH/KUfKj/AJSxXynH8h6mFzjP4j1K9O179mQ9RSZJJcZOqQhUPKE5PCZWZtWyXkCPeqjW755raPomssWW8Ec3VH2LnJWSyNw6cD3lUgS/lIHH2LzG0eOgN6Xc9quVu0z4s4EVJf7yuqn/AJq2XWyfQpLXxS+SJ4H+ONmaIoN8K9UFpFc6Px6JzG5yRhXugpHRHiQVeqeEuLc4X0Gj9I0+mw4x6nFZqZ2dyhRW2mpABTB2B1K8QseWguKjBThp4Betrcc16hgGMHBVAOCKKkkgiIgIoiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgGEwiICRzGk5IVGSKMj0o2H5l6VK5uVALVU00I5U8Z94VpqaOF+f8Ao0Y9wWTviyFQdRB3NyAw2otsROegj7l4pLbEf5hncs6fa2u/GCpGzNP447kBgZtsXqGdyp+TIvUM7ln3kUfLb3KHkQfLb3IDA/JkXqWdym8mR+pZ3LOfIg+U3uUfIg+W3uQGENtsXqGdynbbYs/gGdyzYWYD8ZqmFnb8pvcgMMFti9RH3KcW2L1Efcsx8kj5TVHyUPlN7kBiLbdF6iPuUwt0XqI+5ZcLYB1tURbW9oQGJ+TofUR9yeTYvUM7llnk0doTydjk5qAxYW2L1Efcoi2xeoZ3LKRQHtaoigPym9yAxYW+L8nj7lN5Oi/J4+5ZN4g75TVN4iflNQGMC3Q/k8fcoi3Rfk8fcsn8R9oTxLHWEBjIoIvyePuU3k+L1Efcsk8TPa1TeKe1vcgMZ8nRfk8fco+T4vyePuWS+Ke1vcnintb3IDHBQQ/k7O5TeIQ/k7O5ZCKUDmApvFx2BAY94hD6hncniEPqGdyyLxcdgTxcdgQGPeIw+oZ3KPiMXqGdyyDxcdgTxcdgQFh8Sh9QzuTxKH8nZ3K+9AOwIIB7EJLJ4jD+Tx9yeJQ/k0X7KvvQDsCdAPYhUsficX5NF3KIo4vyaLuV76AdgToB2BSSWcUsX5NF3J4rF+TRdyvPQjsCdCOwIC0eKxfk0XcnisX5NF3K8dEPYnRD2KAWjxWH8lh/ZTxWL8li7lduiHYE6EexAWnxWH8li7k8Vh/JYu5XboR7O5OhHs7kBavFYfyWLuTxWL8li7lduiHYE6IdgQktHisX5LF+yoeKxfksX7KvHRDsCdEOwICzeKxfksP7KeKw/ksP7Ku/RDsCdEOwICz+Jw/ksX7KeJw/ksX7KvXRDsCdEOwICx+KQ/ksX7KgaSH8li7lfOhHYE6EdgQgsPikP5NF+ynicX5NF3K+dCOwJ0I7AhJYvEofyePuQ0UPqGdyvnQe5Og9yAsJoYPyePuUPEYPydncr/4t7k8W9o7kBj/iMH5Oz9lPEYPydncsg8V/o9yeK/0e5AY74hB+Ts7lA0EOP4OzuWR+K+0KHivtHcpbBjRt8P5OzuUvk+Lrp2D5lk/io7R3KHiftHcoBjXk+D8nZ3KBt8XVTs7lk3iftHcniftHchBivk2PP8Gj7k8mx/k0fcsp8S/WCeJfrDuUpkmL+TI/ydncoG2R/k7O5ZT4me0dyeJ+0dynJDMV8mx/k0fcoeTWfk0fcsq8S9oUPEvaEyMGKm2x/k7O5SeTI/ydncst8R9oUviP6w7kyMGIutkf5OzuVN1sZj+Ds7lmJt/tHcoOt3a4dyjIMKNtj/J2dylNsZj+Ds7lm3ktvaFL5M7HjuU5GDBnWln5OzuUjrUz1DO5Z4bV+uO5SutIPNw7kyRgwB9qj9SzuVJ1qYf5lvcthGyj5Te5QNkB/Gb3KMjBrs2mP1Te5U3WmP1Te5bFNiB/Gb3IbCD+O3uU5GDW5tTOqFvcpPJfbE3uWyTp8esb3KXze/Xb3JkYNdNtQ9W3uUzbU3qib3LYo0/+u3uURYB8tvcm4YNfxWoZ/Bt7l7qe0g49Bvcs2ZZA38ZvcqrbTu8nN7lGRgxektYAxuDgrnTW70x6IV6joAzhnK9DKcNHA5Qk8ENIGtHABe2OENwMYVYRgclUCAkDOHYp8IiAIiICCIiAiiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAgiIgIoiIAiIgCIiAIiIAiIgCIiAgiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiICKIiAIiIAiIgCIiAgiIgIoiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgIIiICKIiAIiIAiIgCIiAIiIAiIgIIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAiiIgCIiAIiIAiIgIIiICKIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiICCIiAiiIgCIiAIiIAiIgCIiAIiICCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgIoiIAiIgCIiAIiICCIiAiiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAgiIgIoiIAiIgCIiAIiIAiIgCIiAgiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiICKIiAIiIAiIgCIiAgiIgIoiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCZUkuQ3LRk9i+eettoWq7lqy7VFReq2F/jD2COGZzGMDSQGtaDgAALWup2diG8H0PymV80/PLUuf/X90+kv+1dKeCBqa/Xo3+jutdNWUFO1kjHzvLnte4kYBPVgK9mncI7skZOmEQIucsFRfV08bi2SeJjhzDngFKxz2UszoiBIGEtz244L5q6mvV1umoLhWXSuqJqyWZxkeXkZIOOQ4AAADC1qq4hDeD6UePUn5TB+8CrRvbIwOY4OaeRHWvl941UflE37ZXYPgcXO6V2irrDX1T56Klqgyma/iWbw3nAHsyeXtV7KNkchM6CRAi5yQiIgCIiAIiIAiIgCIiAIiIAiKBQFKWphiduyyxsd2OcAVJ49S/lEP7YXz922Xu7V21HUguFdPIaetlp4m75AZE1xDWgD2LCPHKn8om/eO+1da0uUnkruPp/FMyVu9G5rh2tOQp1yh4GN4uU17v1slqpZLc2mbUCJ7t4Nk3w3IzyyM57cDsXV4XPZDZLBKeQiLW/hEXivsWyK+V9pqHU1W3oo2ys+M1r5WsdjsOHEZVYrc8EmwPHaX8pg/eBRjq6eR27HPC5x6g8Er5hmsqS4nxibJOTl5Xptt6uVsr4K2grqiGqgcHxyNectI610vTNe5GT6dIvFaXzyW2kfVfwh0LHSY+UWjP1r2rmawSERFACIiAIiIAiIgIIiIAiIgCIo4QEEUcKBQDCYXIG2PbrrG17QLra7BVMtlHQSmn3DBHK6QtPF5LmnGeoDqWFfdA7Sfz+z6FB/yLoWmm1kjJ3oi5N2F7b9W33aDQWXUdVFcKSvJjaTCyJ0Tg0uyNxozyxgrrMrKyt1vDJIIixXalqWbR2grxfqanFTPRxAsjccAlzg0E+wZz8yqll4QMqTC4NPhBbSC5xbfY2gnOBRQYH/AoO8IHaV+kDPoUH/Iunk7PKIyd5otU+Dpr25a+0XNVXtrHV9HP4u+djQ0TeiHB2AAAeOOC2suaUXF4ZIREUAIiIAiIgCIiAIiIAiIgCIiAIgWEbab9c9M7NL3dbHG51fDE0Me0A9FvODTJg890Enr5dilLLwgZpNNHDGXzPbGwc3OOAPnWu9V7atC6bL46i9w1lS3h0ND9+cD7SPRHzlcM3/V2oNQvc693m4Vu9xLZZ3Fv7PJWNdi0i/cyu4+l+kdUWnV1mjulhq2VVI843hwLXDm1wPEEK9Ll3wLNQAw6gsErvSaWVsLfYfRf9e53rqJctkNksIsERFQBERAEREAREQBERARREQBERAEREAREQEEREBFERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAUN5RK4x8ILafq2j2m3S1Wq81duoreWxRx0khj3ssa4lxHFxyetaVVux4RDeDs7KZXztj2ua+idluq7qf6Uu9/eF6ottW0OPO7qisOflNY7+9q25SXkjcfQjKZXz6+G7aL+k9T+6i/5VVg267SId7c1NKc/LpoH/3sKcpPyNx3+V8z9cR9FrO+s+TXTD/jKzf4ftpn6S/+403+mtbXCrnuFdUVlW/pKmokdLI/AG84nJOBwHzLammVb6kN5PMuw/Auomx6JvVXj0pq0Mz7GsH2rj3CzXSG1LWOjbU626bvHiVE6QymPxWGTLyACcvYT1Dhla3Qc47UD6KhRyuBPh+2mfpL/wC4U3+mnw/bTP0l/wDcKb/TXHysydx3zIA5uF8yNTNDNSXVreAbVSgftlZ98Pu0s/8A3l/9wpv9Na0raiWsq5qqpfvzzPMkjsAZcTknAW9NMq+5DeSmu1vA8pxFsrnmxh81xlJPaA1gH+a4oCzbR+1TWej7T5M07efE6HpDJ0fisMnpHmcvYT1dqvdBzjhBM+iuUyuBfh+2mfpMfoNN/pp8P20z9Jj9Bpv9NcvKTJyd9Ivn/UbddpMzgX6nmGPkU0DP7mBUvhv2jfpRVfuov+VOVn5G4+guUyvnnLtl2hS5LtVXAE/JLW/3DgqMO1vXsdRFN51XVzo3Bwa+Yuafe08CPYVblJeRuPokisGgbtPfdFWS61bWNqKyjimkDBhu85oJwr+uVrDwWCIhUA89fW01vpZKquqIaamiG8+WZ4Y1o7STwCtlNqzT9Tjxe+WuXPLcq2HP1rS/hnVU8Gg7PFDK9kc9w3ZGtdgPAjcQD28QCuOM5XTXp98d2SuT6ei7W88q6lP/AHzftUfKlD+WU371v2r5g7xHIke5TdNL6x3er8r/ACNx9PPKlD+WU/71v2qBulD+WU/71v2r5idPL6x/ehnl9Y7vUcr/ACMmbbct07WtUOjLS19Y5wLTkHIBzkduVg6ZLjknJUF3RWEkVZ0n4FskEF61PLPPFF/0eBoD3Ab2XP5Z931rq3yjRfllN+9b9q+YLXkciR7jhR6R/wAt37RXLbp98skp4Pp95Rovyym/et+1ap8KGtpZdit9jiqYJHufT4a2QEn7/GuF+kf8p37RUHSPIwXEjsJyohptskydxKFVpmdLVQx8PSeBxPtVJRyRyXXJZWCp9N6O5UQpIN6qpx6Df51vZ71X8qUP5ZT/AL1v2r5hCWQcnu71Hppflu71xvS5fctk+nnlSg/Lab9637U8qUH5bS/vm/avmH00vrHd6dNL8t3eo5X+RuPpxJebbG0ufX0jWjmTM0AfWvE7WGnGSCN9+tTXuIDWurIwTnlgZXzQySck5RStJ/IyfUsOzyUVgewqpnrNkmmZ6uV80zqXDnvcSSA5wHH3ALPFxyWG0WCIigEEREBBxw0kcSAvn5rvaXrKs1hdpH3640m7UviEFNUPjjYGuLQAAcdS+gi+be0uHxfaDqOLGN2vmH/GV16RJyeSGyb4QdYfpRevpsn2ra3g06+1VW7UaG1Vt2q7hRVzJGzMq5nS7gZG54c3J4HLcfOtBLcnglwiXbHSPJ/BUk7x+zu//mXTbGOx9CuTubKgiLyyx8/fCKp2wbZ9TNjGA6Zj/nMbSfrWtwtq+E5GY9s18yMb4id/+G1apXsV/QihszwcWF+2XTmBndke4/u3L6AZXAvg0fyy2H3yf+W5d8rh1f1IuiK154QcYk2N6pDuQpd75w9pH9y2GsF25RCbZHqtriQBQSO4doGf8lhX9aD7HzvREXslDtPwOoOj2YVUu6R0tfJx7cNaFvcrS/glN3dkFP7ayc/WFugrx7frZdEERFmSEREAREQBEXhvlVJQ2aurIGtfJTwPla1xwCWtJAPciB7sovnrc9seva+41FV5y3Cn6V5cIoJCyOME/Fa0cgF5vhZ17+ld2/fldK0sn7kZPomi+dnws69/Su7fvynws69/Su7fvyp5SXkZPomi+dnws69/Su7fvynws69/Su7fvynKS8jJ9E15LtRw3K31NFVsD6aojdFIwjOWuGCvnv8ACzr39K7t+/KfCzr39K7t+/KlaWS9xksmutPzaW1fdrLUZ36OofE0kfGZn0Xe4twVYwrhfLxcL9cX194q5ayskADppXZc4AYGSreu2KwsMozYuwHUg0vtSs1VLJuU1RJ4nNxwN2T0cn2A4K+goXy2a5zHtcwkOHEEdSzYbWNegcNWXf6QVhdRxGmiUz6KIvnX8LOvv0tu/wBIKfCzr79Lbv8ASCsOUl5J3H0URfOv4Wdffpbd/pBT4Wdffpbd/pBTlJeRuPooi+dfws6+/S27/SCnws6+/Sy7/SCp5SXkbj6JouDtAbYtcUusLV4xfKu4QzVDIZKerkL2Pa5wB9x48wu8eoLG2p1vDJTyERFkSRREQBERAEREAREQEEREBFERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAK+fXhEfy0ao/r2f+WxfQVas2ibD9L64vpu9eaqkrXt3Zn0rg3psABpcCDxAGM9nuW+nsVcsshrJwOmF2vF4MWh2tHSVF5e7rPjDBn/gVYeDNoHr8rH/ANrH/KuvmoEYOIsIuzLrsU2R2OeKmvFXJSzyAFjKi47j3DOMgcOGVeGeDls7eAW0lc4EZBFY7iFD1UUMHDeFFdyfc4bPhypK8f8AtblxdqmkgodSXSkowRTwVMkUeTk7rXEBXhdGzsQ0WxFALpbwedkOlddaCfdtQQVUlYKySAGKcsG61rSOA/pFWnNQWWQkc0Iu5fubtnv5JcPpbk+5u2e/klw+luWPNQLYOGworuT7m/Z8P+qV/wBLcuK9R0kVDqC5UlPkQwVMkTATk7rXEBaQujZ2IawW9QCiulfB52R6S13oKS6X6nqn1rKySAmKoLBugNI4D3lWnNQWWDmlF3L9zds9/JLh9Mcn3N2z38kuH0xyy5uBODhpF3N9zds9/JLh9Mcqcng17P3Y3IblH/Rqyf7wU5uAwcOou3X+DNoN3J13b7qlv/KqEfgx6Ljq45RU3V0THBxifM3Dh1gkNB4+xHq4DBsbY/8AyW6V/wB3Q/4AsvVCgpIKCjhpaSJkNNCwRxxsbhrGgYAA9yrrz5PLyWCIigGivC7sNyvOgbfLa6SWqbQ1nTziMZc1m44b2OzJGVx/T6Zv1RjoLLcpM8tymec/UvpqoYW9d7rWCGj5twaB1fO7dh0tfJHDmG0Mp/8Ayqt8HGtv0Q1D/wCGzf8AKvo8i05uXgjB84fg31t+iOof/DZv+VQOzfW36Iah/wDDpv8AlX0fUCnOS8DB8va+jqrdWzUlfTTU1VE7dkhmYWPYewtPEFUFme2Wc1W1XVUrwQfKErcHnhriB/csNwu2L3JMqXSxadvN/dM2xWmvuToQDIKSndKWA8s7oOM4Ku3wca2/RDUH/h0v/Kt4+BGP/SOrD/2VP/fIurlzW3uEmkSkfOH4ONbfohqD/wAPl/5V47torVFooJK27adu9DRxkB89RRyRsaScDLiMDJIC+lS1V4UEUkuxS/CKNzyHU7iGjOAJ2En3AcVSGpk2kTg4KUQCXAAEknAwimia50rBGHOeXANa0ZJPsXY5YWSpk8eznWsjQ5mkb+QeR8ny8f8AhU3wba3/AEQ1B/4fL/yr6JWlxfbaV7mFjnRMJaeYOOS9i4nqpZLYPnB8G+t/0P1D/wCHS/8AKnwb63/Q/UI99ul/5V9H0Uc3LwMHzWk0RqqLe6TTd6Zu/G3qKQY+peR2m722QRus9xEjiA1ppn5JPLhhfTTCbqnm34GDDdjdprbFsx0/bbpD0FbBTASxZyWEknB9vFZmgGEXK3l5LBERQCCIiAL51baY2x7VtVMbyFwl/vX0VXzw27NDdr2qt0c655XVpPqZWRgq3r4HDCdqtW4cm2uXP7yJaJW+vA1/lOr/APdkn/mRrrt+hkI7QREXlFjhLwqB/wDbHcv6mH/CtRrcvhaNA2xVWOukgP8AwlaZyvYqeYIobX8GCLpdstm443Gyv/4D9q70wuD/AAWf5ZbV/VTf4Cu8Fw6v60XXYLCdtf8AJNq3/d03+FZssL20tL9k+rGt4k26b/CueH1IM+c6Ii9kod1+CnGY9j1CT+PUzOH7S3CVqPwWf5HLX/Wy/wCMrbhXkW/Wy6IIiLMkIiIAiIgC8F/bv2K4sPJ1NIP+Er3rz3Fofb6lruTonA9xUruD5gTt3Z5Gjqcf71JhV64YrZwOXSOx3lUV69fYzfchhMLr7wY9D6Xv2zCOtvVgtlfVmsmZ01RTte7dGMDJ6ltn4LdC/olYvoTPsXPLUxi8NEpHzoymV9F/gu0L+iNj+hs+xPgu0L+iNj+hs+xRzcfBOD50ZTK+jHwW6F/RGx/Q2fYnwW6F/RGx/Q2fYnNw8DB858plfRj4LdC/ojY/obPsT4LdC/ojY/obPsTm4+BtPnPlMr6MfBboX9EbH9DZ9ifBboX9EbH9DZ9ic3HwMHznymV9GPgt0L+iNj+hs+xQ+C7Qv6I2P6Gz7E5uHgYPnRlMr6L/AAXaF/RGx/Q2fYo/BboX9EbH9DZ9ic3DwMHznymV0p4XWlLDpug0y+wWegtz5pagSmmgbHvhoYRnHPme9c1Lprmpx3IqZJs2Zv7RNMN//udN/wCa1fSfqXzh2SsD9pulw4ZHlGH/ABhfR7OVx6z6kWiERFxliKIiAIiIAiIgCIiAgiIgIoiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAFaz2x7W7Rs8tpj3o6y+St+8UQdxHY9+OTfrPUtmFcU+FBoG/0Gtbpql1P09mrZGETxcehIY1u6/s+KePJa0xjKWJEM1Bqm/3LU97qbteqp9TWVDt5zncgOpoHUByAW79ge3WXTnQaf1dM+az/Fp6t2XPpuxruss/u93LnoqK9F1xmsMrk+oNNWQ1dGyppJGTwSM32PicHNeOogjmvmlqoyecl1M7HMkNXKXNcMEHfPAhbL2I7Z7hoOpjt9z6St0653pQ5y+DtdHnv3eR9i6mp9JbPNfxDUbLNbLn46A41W76TyOHpY6xjr4rkj/+dvPYnufPkc1214H8b2bJpC9ha11xmLSRjeG6wZ7we5YjtLvGx7Q2oXWaXRMFwrIm5n6Boa2Ink0kniccVWtnhOaWtdBDRW7S1dTUkDQyKKJ8bWsaOoBaWOVsMRRHY6ZymVzh91XYP0euf7xifdV2D9Hrn+8YuXl7PBO46PK+e+3ywUOmtqd6t9ulmkj32zvErcbjpGiQtB6x6XP5urK3yPCqsH6PXP8AeMXPe2TWNJrvXNTfqCklpIp4omOjlcC7ea0Nzw9gC6NPXOEnuXQhvJhC6Y8D3W7Ke4VOjpaTHjW/Vw1DMn0mgbzXDOAMDgR2YPMLmVbH2G67t+zvVlTeblQz1ofSOp42QuDS0uc0l3H2NI+ddFsd0GiD6ChMrnAeFXYP0euf71ifdV2D9Hrn+9jXBy9ngtk6PRc4fdV2D9Hrn+9Yn3Vdg/R65/vWJy9ngnJ0ci57tfhR6crLlS009muNLFNK2N873sLYgTjeIHHA610DFIyWNkkbg5jmhzXDkQVSUJQ+pAqIiKhIREQBY9r/AFLDpDSNyvtRC+dlHHviJhwXnIAGeriRxWQrBducIn2R6pa7qonuHvHEK0OskmDnB/hTau3iRZ7CB1ZjmJ/8xS/dTav/ADPYP3U3+oufyoL0uDDwUydA/dTav/M9g/dTf6ifdTav/M9g/dTf6i5+RODDwDZmptqjNTXV9yvWjNNVFa9oa+UNnaXY5ZxLxPtVo88rV+g2nO+p/wBVYUi02pdEDc2k9vd00lQOo9PaY05RU73772sjmJc7tJMmSr591Pq78z2H93N/qLn1FR0wby0DoL7qbV35nsP7ub/UUk/hQ6rnhfFNZNPyRPaWvY+KUhwPMH75yWgETg1+AbN+FKk//l9o36LL/qL0Wza+LXXQ1tv0Lo+CqhdvRyNpZctPaPvnNaqRTsTIOgfup9X/AJnsH7qb/UT7qfV/5nsH7qb/AFFz8irwYeCToH7qfV/5nsH7qb/UT7qfV/5nsH7qb/UXPyJwYeBk7D2I7fLnrbWDbFf7ZRQuqIy6nkomvGHNBJDw5x4EciMcvauiVwx4JsPS7XqY4z0dJO4ew7uP8yu5wuLUQjCWIlkwiIsCQiIgCLT/AISu0G7aB0rQyWExxVtfO6EVD2B5iAbnIaQQT1cVzZD4Qe0ePGb5HJj5dFB/kwLaFEprciG8HeS+eW3f+V7VX+3PWTx+EdtBY3D6yhkPa6kaP7sBau1Je6zUd9rbvcyx1ZVyGWUsbuguPYF1UUyreWVbLat/eBmwHaLdHnm23OA+eRn2Ln9ZVs/1zedB3Se4affAypmi6F5mj3xu5B5e8Bb2Rco4RB9IQhXDh8JLaF+U276G37VD7pLaF+U276G37Vw8rMtkm8LX+WGp/wBjg/wlaXysg1vq26a1vz7xfHxPrHRtiJiZuN3WjA4LH8Lvri4xSZU234LP8stq/qpv8BXeC+aGjNUXLR1/hvFldE2tha5rTKzfbxGDwWy/uktoX5VbvobftXNfTKyWYlkzuRYftg/kt1Uey3Tf4SuS/ukdoP5VbvojftXgv23zW99stba7hUULqWridDKGUoad1wwcFZLTTTTyS2amRRReiUO7/BZ/kctf9bL/AIytuc18/wDRe2nV2jdPw2eyy0baKJznNEtOHnJOTxV8+6R2gflFt+iD7V589PKUm0WTO40wuHPukdoH5Rbfog+1eOTwiNo724F4p2e1tFFn62qvKz8onJ3fhFxrss2862rNe2egvtwZcaGuqGUronU0Ue5vuDQ9pY0HIz15C7KWVlUq3hkhERZgLxXt5js9c9pwWwPIP9kr2q2aoeItM3aR3ANpJT/wFSu4PmbV8amU5yS8n61TRxJcSUXr19jP3O4PBF/keh/26f8AvCznazraHZ/oypvktMaqRrmxQxZwHSOzjJ6hwKwbwReGyCIdldP/AHhU/DAP/wBkX/8AkIf7nrzZJStw/Jf2NaQ+FXehnptN25/ZuTvbj+9e9vhYzDHSaQj9pFxP93RLl5Cu16evwVydTfdYN/RL/wCIf/TT7rBv6Jf/ABD/AOmuWMJhOXh4B1P91g39Ev8A4h/9NPusG/ol/wDEP/prljCYTl4eCDqf7rBv6Jf/ABD/AOmn3WDf0S/+If8A01yxhQTl4eCTqj7rBv6Jf/EP/pqR/hYuHxNINPvuOP8A9NctKITl6/AydL1HhXXQ58W0vRRjqD6pzv7mhbM2EbaXbRbhW2y421lFXwsM7HQOLo3x5APPiCCfnXDy354Gv8o9x/3e7/G1UsogoNpBMzPw2/8A1bpL+uqf8Ma5OXYPhmWWvuGmrDX0dM+amoZpvGHMGejDwwNJHZ6J4rkTxab1Mn7JV9M//NIMyLZfJ0W0fTD84/8ASVOM++RoX0jHJfOHZnZrvcte2KG0Ucs1VHVxTgAYDQx4cXEnkBhfR5c+rknJYLRQREXISRREQBERAEREAREQEEREBFERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBUqqCKpgkhqI2SwyNLXseMtcDzBC5z174SfkDWNTarXZ4qyhop+hnndMQ6Qj4251DByOtbQ2dbWNL67ijZbavxe4kelQ1GGyg9eOpw9oK0dU0t2CDQ23bYFJaxPftEQyTUQBfPbm+k6LmS6Ptb+rzH93N5BBIcCCOBB6l9R8cFztt12Bt1DUSXzRUMMF0kdvVFFvCOOf9Zp5Nd29R9/Pop1H7ZFWjkEAucGtBJJwAOtdteCrpC8aW0TWS3uA0z7jO2eKB59NrA3ALh1Z5459qxnYPsDnsly8t65poHVULv8AolGHiQMI/nHEZBPYPnXSuABgcgovuUltRKRwL4S8Ah2y33d/H6N5+dgWrluDwrGNZtluW6OcEBP7sLUC663mKIIIs02bbOb3tDqK2CwOoxJSMa+TxmUsGCSBjAPYs8+5m178qz/Snf8AIpdkYvDYNIBRW7vuZte/Ks/0p3/Itaa+0fc9DagfZr2YDWNjbKegeXtw7lxwFMbIyeEyDHEUMrMdm+z29bQq6spLAaUS0sYlk8YkLBgnHAgFWbUerBhqLeP3M2u/WWb6U7/lT7mbXfrLN9Kd/wAipxoeSTRyK6als1Rp6/V1orZIX1VHKYZTC4uZvDngkD+5W1WzkgyrZXpk6v17ZrOQehnnaZyBnETeLz3Aj3kL6NwQxwQsihaGRsaGNaOQAGAAuQPAwtbKnWd5uMjMmkowxj/kue77GldiYXn6qWZ4LIIiLmLBERAFhW2n+SjVP+wSf3LNVhW2n+SjVP8AsEn9ytD60D50qCioL132KHa+jdgugrnpGyV9Zbah9TVUUM8rhUvALnMBOBnhxKvH3O+zv81VH0uT7VlWz+92yPQem433Cja9ttpgQZ2Ag9E32rIfLlq/OdF9IZ9q8yU7M9y5q2v8HzZ7DRVEkdrqA9kbnA+NPPEA461wuvpdd75avJtUBc6InoX4HTs4+ifavmiunTSk+5VlSBodMxrhkEhdw2rwftn1RbKSaW11Bkkia9xFU8ZJAJ61w9AcTMPY4f3r6UWS+2ptmoGm50IIgZkGoYMeiPampcljaEYH9zxs7/NdT9Lf9q0r4TezTTWhLHZajTlJLBLU1D45C+Zz8gNBHNdZ+X7T+c6D6Sz7Vzp4Zdyoq7TmnWUlVTzubVSkiKVr8egOeOSxplNzWWGcora3g3aPs+tte1Vr1DA+ejbb5Jw1khYd8SRgHI9jitVLeHggVNPR7T62WrqIYI/JcoDpXhoJ6WLhk/Ou2xtQeCEb/wDueNnf5qqPpT/tT7nnZ3+aqj6VJ9q2T5ftH50oPpDPtTy/aPzpQfSGfavN3z8ljirwmdDWPQuprTRacp5IIJ6MyyB8heS7fIzk+wLTmF0F4ZFZTVusrG+jqYahjaAgmKQPAPSO4cFz4F6NTbgslWbt8EThtbZ/sU3+S7fXD/gjfyuR/wCxTf5LuBceq+smIREXMWCIiA5u8Nn+K+m/9tk/8tciL6E7a9nEO0jTcNC6rNJV0snTU8pbvMDsYIcOwrSdP4KNURmXVcGP1KM/5vXdRdCEMSKtdTmRF1K3wUBjjqk59lJ//suedfWBultZXayMndUNoZzCJXN3S4DrwuiF0JvESpYFAqK2HsU2dxbSNQ1ltnuElC2CnM++xgeSd4DGCR2q8pbVlg10i6v+5Rov0nqfow+1PuUaL9J6n6MPtWXM1+STlEKKzbbBomPQGspLHFWOrWsgjl6VzN0+kM4wsIytcprKIIosw2T6Pj11rWksU1U6kZMx7jK1u8RujPJb++5Tof0ln+jj7VnOyEHiTByioFdX/cp0P6Sz/Rx9qsutPBro9PaTu14ZqCeZ9FTPnbEYAA8tGcE5VVfBvCZJzSiIugqTIt+bJ9gVNrvRVLfZb3NRvme9vRNgDgN0455WYfcpUX6TVH0Yfaud3QTw2ScpouqJfBRg/mtTyj+lTD/mXmm8FGXgItVxgdjqQ/8AMnHr8kmidlf8pmlP96U3/mNX0g6lzhs+8Gzzc1fQXe6X1tZDQvbURRQwmMmVrgRkkn0Rjq5ro8cguTU2Rm1gsgiIuckKnU08VVTS09QxskMrSx7HcnA8CCqiIDQ1d4L+jqmsmmjuN6p2SPLhDFLHusyeQywnHvJVH7lnSH54v/72L/TXQGUytVdYuzIwWHRGlLZozTlLZbLG5lLAMlzzl8jjzc49p9nBWva1oeHaBo2osktQ6mkL2zQygZDZG5xvDrHEg+9Zkiz3PO73JORo/BTvDs9LqSgHZuwPK90fgoz7zRJqyNo6y2iJ7vTXT12udFaKKSrudVDS0zBl0kzwxo+crn3aZ4S1toBLQ6Jh8fqcYNbMMQtP6rebvfwHvXTCy2bwirRhes/B/wBP6MtElw1Br7xaIZ3GG3DflOPitb0uSVz3VtiZUSNpnvkhDjuPe0Nc4dRIBOO8q66o1Nd9U3WS43+vmrap/wCNIeDfY0Dg0ewBWbOV2VqSXzPJUgqtLBLVVEcFNE+aeRwYyNgy5zjyAHWVIuzPBm2Z2C2WKk1Qailu12qG5ZLGd5lLw4taD+N1En5kss2RySYHpLwXa+6WOnrL9fPJNZKN40jaQTFg6t4744+zqV4+5Nh/TF//AIaP9VdQgKOFwPUWN9ycHLv3J0P6Yv8A/DR/qqlP4J5GOg1cHdu/QbuO6QrqfCYUcxZ5GDkqbwU7kCeg1LRP7N+ne3+4lZVsx0dpvYjdp63WGraBt3q4jHDCMsaIsjLsH0jxGM8hhbb2n68tuz/TclzuR35n5ZTUzT6U0nYPYOs9S4A1lqW46t1DV3i8Tmarndn9VjeprR1ABb1udy+Z9COx9J6aohraaOopZI5qeRodHIxwc17TyII5hVOjZ8hvcuJNg+2qq0VUR2i/vmqdOPdhuPSfSEnm3rLe1vcu1rdW01xoYKyhmZPSzND45WHLXA9YXPZBwZZFVsTQ7IaB7gqiIsm8kkEREBFERAEREAREQBERAQREQEUREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBa32+a7boTQdTUwPAulZmmo2g8Q4ji/3NHH34HWtkLXm2vZtDtK07T0JqvE6ykmM9POWbwyWkFrh2HgeHH0QrQxuW7sD58yPc95e8kuJySVGKV8MrJInuZI05a5pwQfYVmO0LZrqXQdS5l8oXeKl2I6yHL4X/2ur3HBWFZyvVTTWUUZvnZj4Rd908+Kj1SH3m28G9K53/SIx27x+N7j3rqzROt7BrWgbVaeuENRgZkhJ3ZYj2OZzH9y+bYWy/B5orxWbVbMbGXB8EgmqDvEMEIPpb2OrjjHaVz3URayhk7/AERFwFjhbwsP5Zbh/s8H/lhadW4vCw/lluH+zwf+WFp1erV9KKnTfgTRZueqJc/Fhhbj3ucf8l1guTfA1utrtbNVvulwo6J8hphGaiZse8MS72MkZ6vqXSw1fpr9IbR9Mj+1cOoTdjZKL5hcO+Fx/LFUf7FB/cV2P536a/SG0fTY/tXF3hUV9HctrNRUW+qgqoPFIW9JBIJG5APWCQr6RPf1DNQLo/wKv406j/2KP/GucF0H4Ht0oLXqfUDrlW0tGySjYGuqJmxhx3+QLiMrr1HWDIOyAFRrJvFqWabcdJ0bHP3GDJdgZwB2q0jV+m/0gtH02P7VA6v03+f7P9Nj+1eWovwWPm/faue4Xu4VtUHNqKmokmkBHJznEn6yvEF3XfdE7Hr7V1FXcG2E1U7y+SWK5dEXOJyT6LwM59iwy67Etk9USaDVEdE7sFyhkb3Hj9a74aiKWGiCPgUW/otMajuBH4erjgB/q2F3/wCoukgsZ2f6PtWh9PxWiyRvbA078j5HFzpHkcXHuHALJVx2yU5tolEURFmSEREAWEbbniPZLqpx6qCT+5ZusN2wWGu1Ns4vlptW4a2ogxG15wHEEHGfaBhWhhSTYPnMmFlUmzvWDXFp0zdt5pwQKZ5we5S/B7rAf/dm7/RX/YvW3RfuUMX3ndqbz+1ZR8HusP0Zu/0V/wBifB9q8c9NXYe+lf8AYq4j5Bi+87tUFM5jmOc1ww5pwVDClRSIAOCmT2lXq06Uv14pzPabRW1sAOC+CIvAPYcL3fB9q/8ARq7/AEV32KWo+7JMXye0pk9pWUfB9q/9Grv9Fd9ifB9q/wDRq7/RXfYqqMV7gxfKZPaso+D7V/6NXf6K77E+D7V/6NXf6K77Fb5fIMXye0pk9pWUfB9q/wDRq7/RXfYnwfav/Rq7/RXfYq7YeQYvk9pTKyj4PtX/AKNXf6K77E+D7V/6NXf6K77FZbV7g2D4IzwNr0QPXRTf3BdxLjrwY9n2p6HaNFd663VFvo6OJ4kNVGWGTfBAa3PPtPuXYoXn6ppz6EoIiLnLBERAQREQgYXzx27/AMr2qf8AbX/5L6HlfPDbv/K7qn/bX/5Lq0n1MhmCLoDwMv5Qrr/u8/42rn9dAeBl/KFdf93n/G1dl322QjslEReSScOeFt/LFU/7HB/hK0xhbn8LUg7YqrBzijgz+yVplerX9CIZtnwWf5ZbV/VTf4Cu8AFwf4LP8s1q/qpv8BXeIXJq/rJQwsO2w/yXap/3fN/hKzFYdth/ku1T/u+b/CVzw+pEs+ciiFBRXsood3eCx/I5a/62b/EVt3C1H4LH8jls/rZv8RW3F5Fv1suiCIizAREQEUREJIIixLanrSn0Do2qvtTB4yYnMjig3t0yvc4DGccMDJ9wKlJt4QMtUk00cEZfM9rGDm5xwB864w1L4TOr7gXNs1PQWqM8nCPppB87uH1LVGo9a6k1I9zr5eq6tDubJJTue7dHAdy6Y6WX7mQ3g7j1Zto0Ppoujqr1BVVLeHQUR6d2ew7vAH3laP1l4UVyqRJBpO0xUbDw8Zqz0knzMHog+/K5qJJ5qIW0NNCLyyuS+6q1ZfNVVZqdQXKprpcktEjzuM9jW8h8ysWFBZTovQmotZVIi0/bZahoOHzH0Y4/6TzwC6HiK8Igxco5hbjIIyMjI6l2Hs48Gyz2h0VbrGZl2q28fFY8tga72ngX/PgdoWCeFNftEVpobTp+CGW82/726ekDWwxRerOODjnjw5cePHCzjepS2oHPC2Jsd2n3HZ1fRJE509nncPG6Qng4Yxvt7HD6+RWuggWkoqSwwfTbS9/t2prHS3az1DaijqWBzHN5jtBHURyIV1XCvg7bUZND6ibbrpK46fr3hkjSeEDyeEg9nb7Pcu4KmtpqWikq6meKKljbvule4BrW9pPYvNtqcJF0z1LX+1fajY9ntse6tlbU3R7MwUEbvTf7XfJb7T82VqTa34SENM2a26AxNPxY65SNBY3+rafje88PYVy1drjWXa4TVtyqJamrmcXSSyuLnOPvK0q07fWQbL1r7Wl31xf5brfJ+kkOWxRN4MhZnIa0dixvKgsg0bpC+axuTaLT9BJVSfjvHBkY7XOPAD3ruzGCx7FO5YAumPA4vt9lvNyszpXy2GOAzbjwSIpN4ABh6s8chZJs68Ga1W8R1es6rynUjDvFYHFkAPtdwc76lv6y2i32SiZSWqjp6SnYMCOCMMaPmC5Lr4yW1Fkj3oiLiJIoiISEREAREQBERAEREBBERARREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREB562jpq+llpq2COop5Wlj4pGhzXA9RBXNe13wcIJmz3PQZEMvFzrbI7DHf1bjyPsPD2hdOIVeFkoPKIaPl9cLfV2ytmo7hTy01XC4tkhlYWuaR1EFdx+DZoAaN0NDV1sW7eLoG1E+RxjZ+Iz5gcn2k9iyLV9bs9odQUr9TusTb0d1kJqmsdKMn0RxyQPes5jc0saWEFhGQRywt7b3OOMYIwTIiLlJODPCgl6TbLeOOd1kLe6MLU62R4RM3TbZNS/qTtZ3Matbr1q/pRUjngB1KCmax7/iMc73DKPY5nB7S0+0YU9GyCVEUWtc9wa0EnsCthLqSQUynNPMP5p/7JToJ/VP8A2SquaYKeFAhVegm9U/8AZKkIIOCCD7VKwQS4UW8DlRWd7ENKnWG0m0258YfSxv8AGanPIRM4nPvOB86Swk2yUdxbKKS40GznT9PeppJrg2kYZXSfGGRkNPtAIHzLLFBoDWgNGABgKK8d9WWIoiISEREAREQDCYRMoCC528Jba/HZaOo0rpyoBu0rd2sqGO/g7CPijH45B+Ye/hHbzt4gsUc9i0bUMnuxBZNWsw5lP1Yb1Of9Q9vVyFVVEtTPJPUSOlmkcXPe85LieZJXZRQ87pFGymSScniUUFFdpB1X4HOlrzQOut/q4jBa6yBsMAkBDpXB2d8D5IGRnryunl82qbXurKaGOGn1HdY4o2hjGNqXgNaOQAzyU3whaw/Sa7/Sn/auSyiU5ZJyfSPgnBfNz4QtYfpNd/pT/tT4QtYfpNd/pT/tWfKy8k5PpHwTgvm58IWsP0mu/wBKf9qfCFrD9Jrv9Kf9qcrLyMn0j4JwXzc+ELWH6TXf6U/7U+ELWH6TXf6U/wC1OVl5GT6R8Ewvm58IWsP0mu/0p/2rc3gr6s1hd9oUtNU19ZcbUaZzqs1MpeIsfEcM8iXcMdYJ7FEtO4rLYydeoiLmJIoiISEREAREQBfPDbv/ACvap/21/wDkvoevnht3/le1T/tr/wDJdWj+plZGBLoLwMP5Qbt/u8/42rn1dBeBh/KDdv8Ad5/xtXZd9tkI7JREXkknCfhU/wAsly/qIf8ACtRLa3hPvLtst5B/FbEB7twLU69av6EVNu+Cz/LLav6qb/AV3eFwL4Ntyo7VtZtlVcqmGlpmxyh0szw1oyw4ySu0/P8A0l+kdp+lM+1ceqTc+hZGTrDtsP8AJdqn/d83+Er1ef8ApL9I7T9KZ9qxPavrbTNZs21LT0l+tk1RLQSsjjZUNLnOLTgAArGEZbl0JZwMohQUV65Q7s8FN5fsct+fxaiYD3by2+tM+CU/e2PUo+TVzj6wtzLyLfrZdBERZkhERAEREAWObQNJ0GttLVlkujcxTDLHjnFIPivHtH2rI0KlNp5QPmlrTTNw0hqOtst2jLKineQHY4SM/Fe32EcVYcLtvwnNm3nZpc3q1wb96tjS/dYDvTQ83Nx1kcx8/atCaE8H/WOp2snq4GWahcM9LWAh5H6sY4n58D2r067oShmTKM0/hZ1oTZXqzWsjTaLXKyjJwauoBjhHuJ+N82V1poHYJo7Su5UVNMbxcW8p6wZa0/qx/F78ngtlXe62vTtsNVdKumoKGIfHkcGNHsH2BYz1XtBDBpLZ/wCDVp+z9HVaonN5qwAehA3IGnrGObvn7ltXUepNMbPbEJbhNR2yhjbiKCJoaXexjBzPu+daR2k+ExSU/S0WhqXxmYZaa+pbhjfaxnM+849y5j1Lf7rqW5yXC+V01bVv5vldnHsA5AewAKqpnZ1mwbZ2ubfLzq4TW6wb9qsrstO64iadv6xHxQfkj58rSOcqAKuNhs1wv90ht1npJauslOGRRNyT7fYPaV1KMa1hAt6Lr/ZH4PNvsTIrtrjoK64tHSNowcwQntcfxyO4Ht5rnnbXHp2LaNdW6PlElsL8ncH3tsv47WHrbnr9pxwGVELVOW1EYMFWQ3rWeob1aaK2XO61U9vo42xwwF5DAByyOsjtKx1TK7WQN5FfdMaQv2p/GTYrbPVsp43SyyMGGMAGeLjwzw5c1YlOU+iJMn2ZWO36k13Z7Rd6p9LR1cwjfIzGe0NGeWeWfavoXpfTlq0vaIbZYqOKkpI+TGDi4/KceZPtK+aVFVTUNZT1dK8x1EEjZY3jm1zTkHvC+kegdRQ6t0ja73TuBbVwtc4Dk1/JzfmcCFx6vPRrsSjIURFxEhERARREQkIiIAiIgCIiAIiICCIiAiiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIApJntijc97g1jQXOc44AA5lTrWfhFao81tll0mik3KutHiMGDx3ng57mhxVoxcmkgcTbS9RO1Xrq9XjeLoqmpd0JPqwcM/4QFtDY1t/uGkoYbRqaOS5WVnoxyh2Zqcdgz8Zo7Dy6j1LRSgvUlWpR2sofTPS2orVqmzxXSxVbKuilyA9uQQRzBB4gjsV3WofBd03Vae2XUz61z+kuUrq0RuPBjXABuPeGg/Otk6qurLHpu5XSQgNpKeSYZ5EtaSB3rzJRxLaiT557U64XLaPqaqY4PY+4TBrhyIDyAe4LFVUmkdLK+R5Je9xcSeslU16kemCDs/wPLZ0GzSrqpIxmruEjmuPW1rWt/vBXi8L7RXlHTFFqOghBqLa7opw0c4Xcj8zsftexbE8H20+SNkenoS3dfND4w4e15Lge4hZxebdTXe11VvroxLS1UTopGHra4YK4JWNWNk4PmFhXfSV8qNNakt14owDNRzNlAP4wB4j5xkL2bQdL1ejtXXGy1rTmCQmJ+Pjxni13zjCx1eimpIg+menLnQ6hsVDdrcWSUtXC2VhHYRyPtHL5lcuhZ8hvcuTfBO2lsttWdHXqfdp6mTeoJHngyQ84/wC1wI9ue1dZySNjaXPIaxoJLicAD2ry7IyhLDLJmKbTtU0WiNGXC9VbYy+KMtgj65JT8Vvf9S+ddyrJrjcKmtqnb09RI6WR3a5xyf71trwj9pZ1vqkUFslzY7a5zIt08JpOTpPdwwO/rWncLt09e2OX3KtkV2H4H+jDa9MVWp6qPdqLp97gyOIhaTk/O4fUPYuZNmmkarW+s7dZaQEMlkDp5McIohxc7u5e0hfRa02+mtVtpqChjEVNTxtijYOprRgBV1VmFtQR60RF55YiiIhIREQBFYdc6pt+jNNVd7u4mdSU4G82Foc9xJAAaCQM5PauYNceE/dq5kkGkrcy3MPBtTU4llHtDfig960hVKfYhvB09q7V1j0lbn1uoLjBRxAEta93pyHsa3mT7lyTtg8IC66pbPa9MtltVmdlrpd7E849pHxW+wcfb1LTd9vlzv8AXPrb1XVFbVPOTJO8uPzdg9gVtzldlenjF5fcrkiVAqK2FoLZzNebbLqLUU/knSNL6U1ZIPSmx+JC38ZxPDsXS2oog1/HDI9u81jiPYMqbxeb1T/2Ss7rdpNZQakpKrSUMdstNAOipaItD2vjyMmbPx3OxxPdjAXUex/avpfXsUdDV0FJb7+Bh1M+NoZL7Yz1+48VlZZKCzgI4hNPN6mX9goaeb1Mv7BX04Frt/5DS/uW/Ypja7f+Q0v7lv2LDm/4JwfMTxeb1Mv7BTxeb1Mv7BX068l2/wDIaX9y37E8l2/8hpf3LfsTnP4G0+Yvi83qZf2CjoJWjLopAPa0hfTaehtdPC+Wekoo4Y2l73ujaA1oGSScclx74Qm1qkv8kuntJRQxWdj8T1TI2h1SR1NOMhme/HYta73N9hg0MiIukHqtlBVXS4U9DQQvnqqiRsUUbBkvcTgAL6A7FNn1Ns90dDRYa+5z4lrZh+M8/ij2AcB3rXXgzbJDp2jZqbUNOPK9SzNLC8caeM/jEfKP1D3roYLz9Tbue1EoBERchYIiIAiIgCIiAL54bd/5XtU/7a//ACX0PXzw27/yvap/21/+S6tH9TKyMCXQXgYfyg3b/d5/xtXPq6C8DD+UG7f7vP8Ajauy77bIR2SiIV5JJwD4SMvSbZ9R8c7skbf/AMJi1othbf6KvpNreo33KB8Lp6p0sO9yfEeDHD2YAWvV6kJJRSIJURFO9AIiKd6AUVBFO9A7Z8D6Yv2WzRl2ejr5RjsyGlbzWhPA4o6yl2d3CSrgkigqK4yU7nDAe3caCR7Mgrfa8y362XCIizAREQBERAERYFtu1fV6H2d195trGPrmPiih6RhewOc8AlwHVjPz4UpNvCBnb3BjS5xwBxJPUsC1ltb0bpIPZcbzTzVTf+rUrulkz7QODfnIXE2q9p+stUlwvN+q5InHPQwkQxj+ywAd+SsNyuuOk6/MymTpHXHhQ3GqD6fR9rjoWZI8aqz0kh9oYOA+claF1LqW86mrDVX25VVdOeuaQuA9gHID3BWfCiumNUY9EiGwoLK9DaA1FresEGn6B8zAcSTv9CKP3u+ziur9lvg+2HSxhr9Q7l5uzOI3wegiP6rfxve7uUWWxr9+pJz/ALKdiGodavjq6xjrTZjgmpnj9KRvX0bTjPv5LrPTmmNH7JtMzTQeLUFNG0Gorqlw6SQ+13M56mjuVt2n7XtObPad1K5wrbru4joacjLf6Z5NH1+xcbbR9o2ode3Lxm9VbhTsdmCkiO7FCPYOs+08VglO9+EOxsXbdt3rdXCosmmukorHvFsk2d2WqHt+S32dfX2LRKgFdNO2G5aku0FtstJLV1kp9FkYzgdpPID2ldUYRgsIjuWvKiqtbSy0NZPS1DQ2aGR0b255OacH+5UlYk+h+xWSkqtk+mJqOGGJr6GMPbGwNHSNG688OsuBXEu2bS7tH7RrxaxHuU3S9PT9hifxbj2DiPmXWvgq1prNjtvYTkU080IHYN/e/wDzLGPC80P5V0zT6ooot6rtg6Oo3eboCef9lxJ9xK4q7NlrTJZx4ul/BA18yjq6rR1xmIZVONRQlx4CTHpsHvAyB2g9q5nXooK2ot1dT1lFK+GpgeJI5GHBa4HIIXTZDfHBB9QkWr9h+1Sh2g2GKOd7Ib9TMDaqn5b2P5xvaD9R+ZbQXmSi4vDJCIiqSRREQkIiIAiIgCIiAIiICCIiAiiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAThcceGBqvylrKj09A/7xao9+UA/zsgB+pu7+0ustT3im0/p64Xaudu09HC6Z57cDkPaeXzr5uamvFRqHUFwu1a7eqKyZ0zz7Sc4+bkurSw+bcyrLaVlWy3TDtX67tNmAJinlDpiByjbxce4HvWJrqXwMdLZkvWp6hnIChpyR7nSEf8ACO9dlstkGyEdR08LIIWRQtDI2NDWtHIADAC014WGpG2TZdLQsfiqu0zaZg/UHpPPcAP7S3SOS4h8K/V4v+0M2mll36KzN6DhyMxwZO7g35ivPoi5TLM0kV7rFbprveaG3U34ernZCz3uIH+a8OFuTwU9Nm97U4KySPeprVC6qc7qD/isHvySf7JXoWfKmyp27bKSK30FNR07d2GnibExvY1oAA7gvSoBRXkvqWNGeFFs3OqtNtvtrj3rvao3FzGD0poObm+0jmPn7VxSeC+o72Ne0tcAQVxb4S+yrzRurtQ2SFrLFXTYfED/AAeZ2TjHyTgkdnEdi7dNbn5GQzRkUr4pGvjcWPactc04IK27qbbxqO/bPKfTcg6KpIMdXcGv9OojHJpGOBPHePX7OK1AoLslCMu6K5Ik4RjS9wa0ZJ5BSrffgsbP7dqO/Pvd5qKWSKgdmnoTIOkkk575b8kfWfconLZHcEbq8GnZq7Rel3XK6xFt6ubWvka4cYI+bWe/jk93UtzIOxRXkzm5vczRBERVAREQBERAYvtJ0fR660pVWOvllhjlIeyWM8WPHxXY6x7OtcA6+0hdNEajqLPeodyWP0o5APQmYeT2nsP1EEdS+kxGVrjbhs4ptoelXwNY1l3pgZKOfkQ7HxCfknl3HqW9Fzg8PsQ0fPxe6y2e4Xy4R0Nno56yskOGQwsLnHu/vW89nng1X27PbUatnbaaPP4BhD53e/qb3k+xdRaJ0Lp7RVD4rp23x02Rh8x9KWT+k88T/d2Lqs1EYdupGDReyLwcIqN0N114WTTjD2W6M5Y08/vjvxv6I4e0rUG3vW111BrCstM25SWi0zup6Whg4Rx7vo73tJx83ILvlau2qbGNO68bLVFnk+9uHo1sDfjHskbycO4+1c9d63ZmMHAvNVIZZIJWSwyOjkYd5r2HBB7QVl20bZ1f9AXPxW+Uw6F5PQ1cXGGYex3UfYcFYeu9SUllFWdP7EvCFcySCy69lLmOIjhuZ/F9kvs/W7+1dT008VTAyankZLE8bzXscHNcO0Ecwvl0Ctu7GttV00FNHQXHpbhp0n0qfOZIe10ZP+E8PcuW3T56xJTO61jOttcWDRdvdVaguEVPwO5DvZlkPY1vMrmnX/hOXSvElNoyiFthPAVdSGyTY7Q3i1p71z9eLrX3mtfWXWrnrKp5y6WZ5c4/OVnDSt9ZEtm0tse2276+MtvoWvtthBwIGu9OcZ5yHu9EcB7VqEhQKrUlPNV1MdPTRvlmkcGsYwZc4k8AAuyMIwXQrnJRwupPBw2JkOpdWaugIxiShoZG90kg/ub85Vz2FbAo7YYL9reBktaMSUtA70mw9jpOou9nEBdJNbhc1+oytsSUiKIi4SxFERSSEREAREQBERAF88Nu/wDK9qn/AG1/+S+h6+eG3f8Ale1T/tr/APJdWj+plZGBLoLwMP5Qbt/u8/42rn1dBeBh/KDdv93n/G1dl322QjslEReSSeapoKSpcDU0sMzhyMjA4jvVHyNbPzdR/uW/YveinLJPB5Gtn5uo/wBy37E8jWz83Uf7lv2L3plNzIPB5Gtn5uo/3LfsTyNbPzdR/uW/YvemU3MHg8jWz83Uf7lv2J5Gtn5uo/3LfsXvTKbmSSxRMijbHExrI2jAa0YAHuU+EymVACJlEJCIiAIiIAvJdaClulBPRXCCOopJ2lkkUjctc09RC9aIngHB23zZRPs/vIqrc182n6t56GQ84Xc+jd/kese4rUx4L6X6w07b9VaerLNdoulpalm6e1h6nA9RB4rVmjPBy0fY5W1F4E97qmHLRUHciH9hvP5yR7F216mKj83crg5I0ZobUWsqvoNP2uepAID5sbsUf9J54BdLbOPBpttsdDWa0qBcalvpCjgJbA3+kebvqHvWyNU7S9DbPaPxOorqWN8PotoKBgc8Y4Y3W8G8uvC592geEvfbsJKXSdM2z0ruHTyASTkez8Vv1+9Tvtt6RWER2OmdQ6m0ps7s0TLhU0VrpY24hpYwA5wHUyMcT/8ANcybUPCOvF7bNQaQjfaaB3A1JINQ/wB2ODB7sn2haMulyrbtWyVlzqp6uqkOXyzPL3O+crxrSvTxi8vqGyeaaSeV8sz3ySPJc5znEkk8ySeakXottBV3KtipLfTy1NTK4NZFE3ec4+wLp3ZH4N26+G57QN1w4OZbI3Hs/nHD/CPnPUtZ2RrXUhLJp/ZPsmv20Gta6mhNJaAcS18zDugdYYOG873fOQu1Nnmz+x6BtLaSyU46Z3GaqkAMsx9p7PYOCyiioqegpIqWigjgpomhscUbQ1rR2ABV3DgvOsuc3/BfB83Np8TafaRqqCP4kd1qmN9wlcAsaWQ7R6yOv2g6mrIOMVRc6mVh7WmVxCx1elB5iijOyvAzqOk2fXSDPCGvP1saVvi4UkFfRT0lXE2annYY5GOGQ5pGCFz94Ff8Sb9/vAf+W1dFFeZf0sZdHzu2xaEqNAazq7a8OdQSkzUUxHB8R5D3jkfcsEX0P2xbO6LaHpeShl3IrhDmSjqCPwb8cjjjunkR8/UuA9RWWv07eaq13andT1tM8skY4cj2jtHXldtNu9de5DRTst3r7HdKe42mqlpK2B29HLG7BH/y9i7A2OeEDa9SMgterXwWy8O9Fs5IbBOerifiO9h4Hq7FxkpVaypTXUg+pQIcAWkEHiCOtRXB2zDblqbRPRUk8vlWztOPFag+kwfqP5j3HIXV2zra7pXXTWRW6s8WuJHGiqsMkz1hvU75iuGymUP5RKeTYiIixLBERAEREAREQBERAQREQEUREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBCisWu7lWWfR14uNshZPWUtLJNGx/Ilozx/vRLLBzz4X2v2iKDRltmzI7dnry08hzZGf8R+ZcsL13a41d3udVcLjO+oq6mQyyyPPFzjzXkXq1wUIpIoyLGl7mtaMuJwAOZK+iuxzTI0ls3slqLQJ2Q9LPw4mR5LnZ9xOPcAuL/B/wBKHVu06008ke/RUj/G6kHkWM4gfO7dHzld6Xy7UNhtFTcrpOymoqZm/LI7k0fb2Bc+qlnEESjD9tevIdA6IqrhvNNwmBgooifjSEfG9zeZ/wDmvnzVTSVVRJPO90k0ri973HJc4nJJWb7YdoVZtD1VLXydJFbocxUdM4/g2Z5kct48z3dSwRbUVbI/yQ2F2x4JukvIez83eoj3Ku8P6UAjiIWktZ38T84XJOzzTFRrDWVqslMD/wBJmaJHD8SMcXu+YArPtpu0zWdq1Xc7DbrpXWe02+U01LRxNbC6OJow3JaATkYOSetLk5/IgjuGsraaijMlZPFBGASXyPDQB7ytf6n22aD0814nvsFZO3+aofv572+j9a4Mud5udzlMlxr6qqceuaVz/wC8rwZJ5rKOkXuxuOmNa+FHW1DHwaRtDKVp5VVYd949oYOA+cn3LQeqdW3zVVcau/3GorZfxRI87jR2NbyA9ysZUFvGqMfpIyRUVd9LaavGqbk2gsFvnrak82xt4N9rjyA9pW+afwWrrJpnpqi9UsV9JyKcNJgaPkl/PPtAwrSsjH6mMHN6qU9RNSzNmppXxStOWvY4tc09oIWRa10LqPRdWYdQ2yamaThk2N6KT+i8cCsYKsmproSbV0pt613p9rIzcm3Knb/N17OkOOze4O+tbVsPhWQ7jG37TUjDjDpKKcOGfY1wGB85XKyKkqIS9hlncVs8JDQVY1njE9fRuPPpqYkD9klZdYdrGh7/AHCChtOoqSernduxxFr2OcewbzRxXzvWc7FdKXDVu0K2Ultlkp/F5BVTVLBxhYwgk+8nAHtKwnpoJZCZ9EQig1RXAXCIiAKB4ryXmeoprVWTUMPT1ccL3xQ5x0jw0kNz1ZOAvn7dNqm0A19R0+p7tTydK/eijncwMOeLQ0csclrXU7OxDeD6GfOpshfOSTadrmVhZJqy9OYeYNW/7V4ajXGqan8PqK7P99U/7VutHLyRuPpHNUwwDM0scY7XuAH1qzXPWembXkXLUFqpSOqWrY09xOV84Kq63GqP/Sa+rm/rJnO/vK8W8SckklStJ5Y3HdWtdr+y6qtVRQXe4wXemlaWvp4qd0oI9hIAz7QeC401t5uOv879Hmu8lOOWMrGgPZ7Mg8R2Zwf71YclFvXUq1hEN5IIootAQCis/wBGbIdZatdG632mWCleR/0mr+8xgdvHiR7gV0Rs+8Giw2h8VXqqoN4qm8fF25ZAD7eO8758D2LOdsYd2DmrZ5s31HryvENkon+LNI6WslBbDGM/K6z7BxXZGyXY5Ytn1O2oa0V96cPTrZm8W9ojH4o+v2rY1uoaW20kdLb6eKmpoxhkUTQ1rfcAvSuKy9z/AKJSCIiwJCIiAiiIhIREQBERAEREAK+dm2+Zk+1nVT2HLfH5B3HC+iMrxHG57uTQSV8zdYV3lPVV4rcktqKuWRpPWC84+pdWk+plZFnWZ7LtoNy2dXqouVppaOpmnhMDm1TXFobkHI3SDngsNTC7msrDIOgfup9W/maxfsTf6ifdT6t/M1i/Ym/1Fz9hMLLgw8A6B+6n1b+ZrF+xN/qJ91Pq38zWL9ib/UXP2EwnBh4B0D91Pq38zWL9ib/UT7qfVv5msX7E3+oufsJhODDwDoH7qfVv5msX7E3+on3U+rfzNYv2Jv8AUXP2EwnBh4B0D91Pq38zWL9ib/UT7qfVv5msX7E3+oufsJhODDwDoH7qfVv5msX7E3+oqc/hSawkaAy1WOMg5yI5T/e9aCwicGHgG8ZvCa1zIfvcdqiGOTacn+8rcfg4bW7tr6quVsv8ELqumYJ2VMLdwOaSBulvbnrXFS6K8C7+Od9/2Ef41W6qCg2kSmdgoiLziSKIiEhWPVeq7JpK3it1FcYKGnc7dY6Q8Xu7GgcSfcFfFovwq9D3bVWk6W4WhzpjaS+WSkaOMjSBlze0jHLsyrwSckpAsusfCitFHvw6WtU1wlA/DVJ6KMe3AyT9S0TrXbNrPVolirLo+ko5OBp6LMLCOwkcT85WuSMIvRhVCHVIo2HvL3FziXOPMk5JUqmWy9nOxjVWt3Rz09OKC1nBNbVAhpH6jebv7vatZSUVlkdzWrGl7g1oLieAA5lbf2Y7BdTawMVXcYnWa0O49NUM++yD9Rh4/OcBdLbNtiOlNFsjqDSi5XUAE1dUN7dP6jeTffz9q2oBhcdmq9oFsGF7PNm2nNBUXRWSkBqXNAlq5cOlk+fqHsGAr7LqSyQF7ZrxbmOYcODqlgLT7ePDrVTUkNbU2C4wWqoFNXyU8jKeYjIZIWkNPfhfNC5w1FNcKiCuY9tXHI5koecu3geOfblZVVu5ttk9j6J3HaXoq3Rl9XqmzNxzayrY937LST9S1BtT8I2yRWart+jOlra+dhjbVuYWRxZ4FwBwScE45cVyHlMrojpYxeWVciMhc95c85cTkn2qVRJWVbNNFXDXmq6W0W5hDHHeqJyPRhjHNxP1AdZXQ2oLLI7nWHgi2eS3bLjWTNLfKFU+ZmRzaPQB/wCEreBVusFrprHZaK2UEYjpaSFsMTR1NaMBXBeTZLdNs0RFau22bJbftEtfTRFtLfqdmKeqxwcOe4/rLefHqzn2HaKKIycXlA+ZWp9PXTS95qLXe6SSlq4XYLXDg4dTmnrB7QrUvoxtK2d2LX9p8UvFPioYPvFXHwlhPsPWO0HguKNqeyq/7Pq53j8PjVte771XQAljuwO+S72H5sr0KrlZ0fcq0a+W6/Bq2eXu9axtmpY2eLWe21Ie+eVv4Zw/EZ28+J5D6lY9g2zOfaHqb/pIfHY6Ih9XKMgv7I2ntPb1DJ7F3ha7fSWq3wUNvp46akgaGRxRtw1oHUq33bfkRCPWiIuAuEREAREQBERAEREBBERARREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAFB7WvaWuALSMEHrUUQGsNbbENFaqD5H21turXDhUUAERz2luN09y5v2g+DvqrTrnT2Njr7Rb2B4uzEwHaY8/3Ert9MLaF84ENGjvBi2bV+irDcK7UFL4td694b0ZILo4W8gSCeJJJI9gWM+GLT6hqaeyx0DameyEPdPFDGXNEjSMF+OrB4Z610soYUcV797B8uHtcxxa8FpHUVBfRzVezrSmq43Nvdko5pDymYzo5Ae0Pbg/WtE6l8Ftrr5Syadu48lyTN8Yhq89JHHnjuOAw446jj3rqhqYvuVwXLwQdDGgtNXq24R4qK37zR5HERD4z/7R4f2fasn8I7ZXFrOwSXi0xAahoWFzd1vGpjA4sPaRzB+brW3rTbqa1W2moKCJsNLTRtiijaODWgYAXrIyuZ2vfvLYPluQQSHAgg4IPUoYXV+ofBnlvOurrcGXamoLLUT9NFDHGXygO4uGDgNGSccSti6O2DaH00WTOt5ulY0fhq93SAH2M+KO4n2rreqglkrg410foDU+r5gyw2iqqI84dMWbkTfe84H+a6F0B4MNLCYqrWlwM7xh3idH6LM/rPPE+4Ae9dLU9PFTRNip42RRNGGsY3daPcAqq556mUlhdCUi16esFq07QNorJQU9FSt49HCwNBPaesn2nirrlQRczbfcseevo6avpn09dTxVFPIN18UrA5rh2EHgVpnW/g5aRv75J7SZrJVuOc0434s/1Z/yIW7kV4zlHsxg4a1f4O+tbEZJKCCK80zRkOpD98x/Qdg592Vqe6Wq4WmpfT3ShqqKdhw6OoidG4fMQvp6eK8N0tFvu9MYLrRU1ZEfxJ4g8fWF0R1Uv3FXE+Yi7Z8FDR7LFoAXqoZu3C8npTn8WEEhg+fBd84V61BsB2f3glzLS+3Sk5LqGZ0Y/YOWj5gtmWuhgtlvpqKkYGQU8TYY2jqa0YCi7Ub44QSPWERFylgiIgIELkfws9mwt9w88rTCG01U4R1zI28GychJ7AeRPb711yrdqC00l9s9ZbLlGJaSqidFI09h6/eFpXY4SyQz5ihRXWVF4KluD3eO6lqpGZy0RU7WnHvJKya3eDLoanDTVvulW4cw6oDGn5mgH613PVQRGDidTQwyTO3YWOe/saMlfQS2bFtnttwabTFG8jrqXPn+qRxWXW3T1ntbWi3Wuhpt3kYoGtx3BUesj7IYPnrZNnesL45nkvTV1mY7lIadzI/23YH1rYdh8GzXFw3HXAUFsY7mJpt9w+Zuf7122GqOFlLVyfYbTnLTXgs2Wmw/UF7q653XFTRiFnuJJcT9S25pTZnpDS+460WOjZOzlPIzpJM9u87JHzLMsIsZXTl3ZOCCIiyAREUgIiIAiIgIoiISEREAREQBERAU6iJs8MkT/iPaWnBwcFcp3vwV6+W7VT7PfqOOgMhMLKhjy9rTyBI5kcsrrBFeFkodiGjkL7lS/wD6Q2v93In3Kl+/SG1/u5F17hMLTmLPJGDkL7lS/fpDa/3cifcqX79IbX+7kXXqJzFnkbTkL7lS/fpDa/3cifcqX79IbX+7kXXqJzFnkbTkL7lS/fpDa/3cifcqX79IbX+7kXXqJzFnkbTkL7lS/fpDa/3cifcqX79IbX+7kXXqJzFnkbTkL7lS/fpDa/3cifcqX79IbX+7kXXqJzFnkbTkL7lS/fpDa/3cig7wVNQbvo6htRPtjkH+S6+wmE5izyMHG8/gtaqY4CG72iUduZB/e1ba8HrY/XbPJ7jcb1WRS11WwQNig4sYwHOSesk//txW7sJhVlfOSwycAIiLEkIiKQEKIgOPfCc2Rmx1kurNPQf+jKl5dWQRt4QSH8YDqaT3H3rXGzvZHqrXMrH0FE6ltxPpV1U0sj/s9bvmX0EqaeKqgfDURslheMOY9oc1w7CDzCmhhZDG2OJjWMbwDWjAHuXStTJR2kYNQbNtgWl9I9HVVzPLV0bx6aqYOjYf1I+XfkrcDGhjQ1oAA6gMKZFhKUpPMmSERFUEp4rhzwq9Kt0/tKdXU8e5SXeEVIwOAkHovH9x/tLuQLWm3DZg3aXaLfTw1kdDWUc5e2d8e+NwjDm4yOvB+ZbUWbJ5ZD6nAKixrnuDWNLnHgABkkrryw+CzY4HMfe73XVh/Gjga2Jp+fiVtrSGzLSGkQDZLHSxTj/rEuZZf2nkke4YC65aqCXTqUwcj7NtguqdWujqLjC+y2p2D01Sz748fqRnB+c4C7B2faGsuhLILbYYCxrjvTTPOZJndrj/AJcgsoAwpguOy6VnfsXSGEQIsSSCIikEV566jp66klpayGKenlaWvjlaHNcOwgr0IgLLpbTFo0rb30Vgoo6OldI6UsZ1uccnn3ewBXpERvPVgIiIAiIgCIiAIiIAiIgIIiICKIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAgiIhAREQEUREJIIiIAiIgIoiIAiIgCIiAIiICCIiEEUREJCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAJhEQEEREIIoiISQREQBERARREQBERAEREAREQBERAEREAREQEEREBFERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAQREQBERARREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQEEREAREQEUREAREQBERAEREAREQBERAEREBBERARREQBERAEREAREQBERAf/Z	\N	{}	2026-01-30 13:54:25.110749+00	2026-01-30 13:54:25.110749+00
a22e6d1b-a13a-46a1-9989-0fe50641c8b7	成本核算图标.png	image/png	4866	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	\N	{}	2026-01-30 14:29:19.522848+00	2026-01-30 14:29:19.522848+00
ff258564-6278-4ea5-8c87-48699459ba27	成本核算图标.png	image/png	4866	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	\N	{}	2026-01-30 14:30:09.202775+00	2026-01-30 14:30:09.202775+00
d46c93c7-3240-4b12-80f4-fe51999fe0d4	成本核算图标.png	image/png	4866	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	\N	{}	2026-01-30 14:42:14.29809+00	2026-01-30 14:42:14.29809+00
1378e655-3bed-4a0a-908f-391b3e339a95	菠萝世家.png	image/png	75906	/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAMqBDgDASIAAhEBAxEB/8QAHQABAAAHAQEAAAAAAAAAAAAAAAECAwUGBwgECf/EAGYQAAEDAwEEBAgHCgsEBgcFCQEAAgMEBREGBxIhMRNBUZEIFBUWIlNhcRcyUoGUodEYIzNCVFVWYpKTNDY3Q3JzgrGywdN0daLSJERjg5WzJTWEpKXh4ydGo8LD8CZFV2RlheLx/8QAGwEBAAMBAQEBAAAAAAAAAAAAAAECAwQFBgf/xAAwEQACAgECBQIFBQEBAQEBAAAAAQIDEQQSExQhMVEFQRUiMjNSNEJhcYEGI6EkQ//aAAwDAQACEQMRAD8A6pREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBETKAIile9rPjuA95wgJsovNJXUkf4SphZ/SeAqD7zbGfHuNGPfO37VXevJKi37FwTKtXnBZxzulAP8A2hn2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	\N	{}	2026-01-30 14:54:17.61923+00	2026-01-30 14:54:17.61923+00
539d3c8c-da38-4421-81da-6bca95d1c516	果多多商标.png	image/png	85244	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	\N	{}	2026-01-30 17:31:35.379589+00	2026-01-30 17:31:35.379589+00
7008869a-52a1-4558-bcae-e96746d62435	生产计划.png	image/png	8384	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	\N	{}	2026-01-30 18:00:07.923767+00	2026-01-30 18:00:07.923767+00
\.


--
-- Data for Name: form_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.form_values (id, template_id, row_id, payload, created_at, updated_at) FROM stdin;
c290b276-4e5d-4116-bf06-e8368a3be014	employee_detail	486	{"work_history": [{"company": "示例前司A", "end_date": "2021-01-01", "position": "初级工", "start_date": "2020-01-01"}, {"company": "示例前司B", "end_date": "2023-01-01", "position": "组长", "start_date": "2021-02-01"}]}	2025-12-30 14:54:17.752266+00	2025-12-30 14:54:17.752266+00
b4fd00bc-777b-405e-99b7-d6c162eca333	employee_detail	479	{"work_history": [{"company": "示例前司A", "end_date": "2021-01-01", "position": "初级工", "start_date": "2020-01-01"}, {"company": "示例前司B", "end_date": "2023-01-01", "position": "组长", "start_date": "2021-02-01"}]}	2025-12-30 15:45:44.635427+00	2025-12-30 15:45:44.635427+00
aef909a2-3ed1-4fd3-a6da-3e29cb04c8b7	hr_form	479	{"contract_period": "1"}	2025-12-30 15:59:30.533382+00	2025-12-30 15:59:30.533382+00
87cfaaab-a9b7-48fa-83e2-afd54b7d42b0	employee_detail	801	{}	2026-01-25 01:52:11.932572+00	2026-01-25 01:52:11.932572+00
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, code, name, module, action, created_at, updated_at) FROM stdin;
749a0f67-dc5b-4b61-be56-4b1859260ad1	hr:employee.view	花名册查看	人事花名册	查看	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
0da90206-1c4b-48b3-9be4-36cbdb58e1b8	hr:employee.create	花名册新增	人事花名册	新增	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
1c507edf-adb5-4f35-ac70-da6daa6a9f7e	hr:employee.edit	花名册编辑	人事花名册	编辑	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
df4fde3f-17ac-47fb-b513-6c64ea71d137	hr:employee.delete	花名册删除	人事花名册	删除	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
e0baac90-7926-4337-a3fb-f5c1f6a77966	hr:employee.export	花名册导出	人事花名册	导出	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
00a17c4e-e84e-4f61-8610-e18d73ed17c6	hr:employee.config	花名册配置	人事花名册	配置	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
23bd6bc7-1717-4c2a-be99-42093e2c4a96	hr:org.view	组织架构查看	部门架构	查看	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
22607dfa-0016-447d-9382-af4ff3f72958	hr:org.create	组织架构新增	部门架构	新增	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
5db69a98-dc1c-45b8-85f0-2f5fa94ec2ad	hr:org.edit	组织架构编辑	部门架构	编辑	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
7c80805f-47bd-46d6-a80e-f195cc0be2ff	hr:org.delete	组织架构删除	部门架构	删除	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
f9a66726-7fcb-4596-81f5-5c558e06e69d	hr:org.export	组织架构导出	部门架构	导出	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
27ab46fc-3086-41c5-8ee2-4867ce222c7d	hr:org.config	组织架构配置	部门架构	配置	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
da0914e1-5105-4156-9a46-cb4a36f95518	hr:change.view	调岗查看	调岗记录	查看	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
7217fcde-beb2-4b2b-8a50-4717d3bfd2e7	module:home	模块-首页	模块	显示	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
974f2d33-db7c-4a63-b681-39053a3296c9	module:hr	模块-人事	模块	显示	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
6d5d625b-102d-44c6-9b43-ac95a43b7030	module:mms	模块-物料	模块	显示	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
52891a44-2cf0-41a8-87bf-61645d1ef732	app:hr_employee	应用-人事花名册	应用	进入	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
39958fbb-b520-44fd-bc6b-95ac7f56f1e9	app:hr_org	应用-部门架构	应用	进入	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
5c40500a-ed0d-4cbf-9a31-03af3b967974	app:hr_attendance	应用-考勤管理	应用	进入	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
30d0a60e-b529-4c7c-8809-3c803d8fc3a9	app:hr_change	应用-调岗记录	应用	进入	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
12c29a45-a19a-4fbc-ac12-9e7f9d9f72c3	app:hr_acl	应用-权限管理	应用	进入	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
c0bd2ecb-57bf-4bbb-a3e3-4c208420d211	app:mms_ledger	应用-物料台账	应用	进入	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
0902a50b-3f49-476e-b8e5-1ac0bca4b78f	op:hr_employee.create	人事花名册-新增	人事花名册	新增	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
c7177812-4aad-4925-9d3c-8b1043ad1751	op:hr_employee.edit	人事花名册-编辑	人事花名册	编辑	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
a2f2a882-1c0f-4a88-b972-36bb5be8a42f	op:hr_employee.delete	人事花名册-删除	人事花名册	删除	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
32b9854d-357c-49c9-9dd4-3c3c4f466a57	op:hr_employee.export	人事花名册-导出	人事花名册	导出	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
8e29f33b-a3d4-407d-bd84-ec41c90fccff	op:hr_employee.config	人事花名册-配置	人事花名册	配置	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
defd5f65-6660-43b9-b725-4af827c51ea6	op:hr_org.create	部门架构-新增	部门架构	新增	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
3c89b5f3-2bec-4e93-b939-6f751df2619f	op:hr_org.edit	部门架构-编辑	部门架构	编辑	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
212de9d3-3fca-484c-bea6-85a458a6d2e5	op:hr_org.delete	部门架构-删除	部门架构	删除	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
abe9f0e0-8a6c-47f3-8c39-600801e72374	op:hr_org.save_layout	部门架构-保存布局	部门架构	保存布局	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
b90a386f-ec09-4026-bdbc-6993bca73ba5	op:hr_org.member_manage	部门架构-成员管理	部门架构	成员管理	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
c325877d-19dd-4022-9e27-ff00b53d6c7e	op:hr_acl.create	权限管理-新增	权限管理	新增	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
d1b10f18-d7d8-499f-8bb9-684bee30a64a	op:hr_acl.edit	权限管理-编辑	权限管理	编辑	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
dab7524c-dd66-47cf-bd64-30b910c9adbb	op:hr_acl.delete	权限管理-删除	权限管理	删除	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
7c97b7ab-f058-4e07-bc0b-8f7b9cefd1e6	op:hr_change.create	调岗记录-新增	调岗记录	新增	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
3a9b0e2a-7726-4d71-9e7f-85c76a67825a	op:hr_change.edit	调岗记录-编辑	调岗记录	编辑	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
71b3c53c-4ea9-470b-be04-0d361ddf4b2a	op:hr_change.delete	调岗记录-删除	调岗记录	删除	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
de7a5ba6-578a-4199-8182-4dee3c977ec4	op:hr_change.export	调岗记录-导出	调岗记录	导出	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
803dbf8c-f9df-4628-b751-71f89082c9a9	op:hr_change.config	调岗记录-配置	调岗记录	配置	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
a89fb985-111c-4507-afc5-0c73602c89ee	op:hr_attendance.create	考勤管理-新增	考勤管理	新增	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
833ba41f-564d-4d53-b1f4-58068df04123	op:hr_attendance.edit	考勤管理-编辑	考勤管理	编辑	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
98a0bccb-72a5-4977-90e0-bbee6842b7e3	op:hr_attendance.delete	考勤管理-删除	考勤管理	删除	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
338880a9-7464-4cc2-8bb0-83719f3a4404	op:hr_attendance.export	考勤管理-导出	考勤管理	导出	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
701b506c-2de7-4446-8ee6-6ed9a4649508	op:hr_attendance.config	考勤管理-配置	考勤管理	配置	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
1cb97f81-8a2c-4caa-b7f0-d99dc11ed4f4	op:hr_attendance.shift_manage	考勤管理-班次管理	考勤管理	班次管理	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
d0517d99-9f67-4877-9a52-cd6542994b10	op:hr_attendance.shift_create	考勤管理-班次新增	考勤管理	班次新增	2026-01-28 20:10:19.031294+00	2026-01-29 00:00:52.098359+00
15b8295c-a5df-4b8b-b37d-c3b57eb204e3	op:mms_ledger.create	物料台账-新增	物料台账	新增	2026-01-28 20:35:59.045028+00	2026-01-29 00:00:52.098359+00
6d23e088-f7d9-49fe-bb07-cee9c3fe9c18	hr:change.create	调岗新增	调岗记录	新增	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
0cbdfa8a-948e-407d-9a6f-f4e1784ecbd7	hr:change.edit	调岗编辑	调岗记录	编辑	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
cca47339-1940-4c27-94cf-66f89923888f	hr:change.delete	调岗删除	调岗记录	删除	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
2c9ed352-5d9c-4f8b-8993-68ec3e67a5b5	hr:change.export	调岗导出	调岗记录	导出	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
9da35eef-2dab-4a37-bc95-73e12284c86e	hr:attendance.view	考勤查看	考勤管理	查看	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
fe698f3c-4a79-4e5c-8147-2324e10117be	hr:attendance.create	考勤新增	考勤管理	新增	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
b57c9900-909d-4528-89b4-8c4910bfcdb8	hr:attendance.edit	考勤编辑	考勤管理	编辑	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
cf33aaf0-be78-46ef-a3a8-ad0eea93f67e	hr:attendance.delete	考勤删除	考勤管理	删除	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
23c8f1bf-23e5-46bc-a965-e4f74a9c5bd5	hr:attendance.export	考勤导出	考勤管理	导出	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
7dff6243-ab88-4090-ad3e-f7419176d4e6	hr:payroll.view	薪酬查看	薪酬管理	查看	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
7d97095f-1371-4aee-99b3-e69cc5cad037	hr:payroll.create	薪酬新增	薪酬管理	新增	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
e8bfa2dc-ab95-4970-a245-0d0b31f316a2	hr:payroll.edit	薪酬编辑	薪酬管理	编辑	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
bb89aa41-93b0-4da9-99f0-5b2d20525a50	hr:payroll.delete	薪酬删除	薪酬管理	删除	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
6f212a0f-c0d4-472d-a889-34a6f9ce3f7c	hr:payroll.export	薪酬导出	薪酬管理	导出	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
37396318-923d-4fcd-bc17-8fd584200def	hr:profile.view	档案查看	人事档案	查看	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
a53b2f02-f4b7-4c22-9c43-637e19f94ab5	hr:profile.create	档案新增	人事档案	新增	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
6108f0ae-516c-459f-92c7-cbab491d3c9b	hr:profile.edit	档案编辑	人事档案	编辑	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
938f813c-f070-460a-b9f3-b34e537e01bd	hr:profile.delete	档案删除	人事档案	删除	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
96dcd908-214a-4842-beed-c6df4b34dc71	hr:profile.export	档案导出	人事档案	导出	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00
cd03668e-f24f-4b04-9015-0d8567f829f7	hr:attendance.config	考勤配置	考勤管理	配置	2026-01-28 16:50:30.552906+00	2026-01-28 19:39:52.154034+00
6148a122-5ff1-4b53-9016-edd8af4c9ef1	hr:acl.config	权限配置	权限管理	配置	2026-01-28 16:50:30.552906+00	2026-01-28 19:39:52.154034+00
68dd9b9e-b264-4af0-a95e-6f3163e28b25	app:hr_user	应用-用户管理	应用	进入	2026-01-29 00:00:52.098359+00	2026-01-29 00:00:52.098359+00
30ab876f-a563-47c6-a4fd-4c488bdb83a6	op:hr_user.create	用户管理-新增	用户管理	新增	2026-01-29 00:00:52.098359+00	2026-01-29 00:00:52.098359+00
a7e97ec8-ef4b-412f-9ba9-aadea7e15059	op:hr_user.edit	用户管理-编辑	用户管理	编辑	2026-01-29 00:00:52.098359+00	2026-01-29 00:00:52.098359+00
7f471355-1ab3-461f-bca0-46a886b37fe2	op:hr_user.delete	用户管理-删除	用户管理	删除	2026-01-29 00:00:52.098359+00	2026-01-29 00:00:52.098359+00
f5c4bbdb-9a75-4fa0-8d42-037fa9c79267	op:hr_user.export	用户管理-导出	用户管理	导出	2026-01-29 00:00:52.098359+00	2026-01-29 00:00:52.098359+00
f7032fce-1cad-4772-a8aa-6e0a83f0b1fc	op:hr_user.config	用户管理-配置	用户管理	配置	2026-01-29 00:00:52.098359+00	2026-01-29 00:00:52.098359+00
9058f230-f9a9-4c2a-a1f2-2fedae68d9cf	op:mms_ledger.edit	物料台账-编辑	物料台账	编辑	2026-01-28 20:35:59.045028+00	2026-01-29 00:00:52.098359+00
ad2fb879-b364-4699-af80-a4566ae40441	op:mms_ledger.delete	物料台账-删除	物料台账	删除	2026-01-28 20:35:59.045028+00	2026-01-29 00:00:52.098359+00
448f5c64-0718-4bfa-af41-7723848c41d1	op:mms_ledger.import	物料台账-导入	物料台账	导入	2026-01-28 20:35:59.045028+00	2026-01-29 00:00:52.098359+00
21cf8896-f18a-417b-9c18-9b41c08c2aae	op:mms_ledger.export	物料台账-导出	物料台账	导出	2026-01-28 20:35:59.045028+00	2026-01-29 00:00:52.098359+00
96319cc7-2a65-4364-866d-5dfbefbde93e	op:mms_ledger.config	物料台账-配置	物料台账	配置	2026-01-28 20:35:59.045028+00	2026-01-29 00:00:52.098359+00
\.


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.positions (id, name, dept_id, level, status, created_at, updated_at) FROM stdin;
5c95c523-1cae-4c6c-a540-f1977de4058e	HR主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
c6978198-989f-48c4-a9e4-a746e3dfa81e	招聘专员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
032d10a0-c0a3-46ed-a304-a2395ffe3ee0	行政主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
a965d683-da64-4dd5-8e51-9f78f1c5ddad	行政专员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
ef2ea270-6813-4c78-a1e6-0c446ae47005	后端工程师	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
2d4b8fb8-a02e-40d3-9fe9-00511e7efb06	前端工程师	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
c8de51d4-bf7c-417d-baf0-0e3c8a372928	生产主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
928bca4f-0a23-41c7-948c-61a8a30ce5cf	生产工	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
a6414079-83d9-4a89-ac90-7018b91d026e	质检主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
94f36b7b-93cc-41e0-8472-e28fccbf5f60	质检员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
76c01715-a79f-46bf-bbe2-e05ce500249c	维修工	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
d65577e9-360f-45c9-8f11-25e254bdee82	设备工程师	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
284f35ea-a41f-47d8-a932-b37e1a1dca2f	物流专员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
8062bf92-bcda-49c6-892e-febd2fdb9b3e	仓管员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
d74b2d80-7685-43fb-ad90-d908e4320c20	采购主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
529c6605-6a79-424d-b7ac-6e1064ce6ba0	采购员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
d077210f-2b70-49aa-b8b2-9699dd0fd28e	出纳	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
f7df5b02-b698-4b1c-bf3d-f1a8840ba01e	会计	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
cc3ac529-4e56-4978-a462-d338ed8d36f8	销售主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
5fc8fcd9-e5e4-4fd9-9337-493aa955b093	销售专员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
5191e259-d7a6-4014-a9ff-8348c1778605	客服主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
1bfa1a1a-cdef-49df-8b8e-1e2490b24b7e	客服专员	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
104f3d80-c9a8-4c45-8a74-0c489b4f0ad8	IT主管	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
a017fd86-9ccd-45dc-94f9-ebcd388555df	运维工程师	\N	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
\.


--
-- Data for Name: raw_materials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.raw_materials (id, batch_no, name, category, weight_kg, entry_date, created_by, properties, version, updated_at, dept_id) FROM stdin;
1	NP-20251220-01	金鲳鱼(特级)	海鲜原料	500.50	2025-12-20	zhangsan	{}	1	2026-01-30 19:55:01.309888	\N
2	NP-20251220-02	食用盐	辅料	50.00	2025-12-20	lisi	{}	1	2026-01-30 19:55:01.309888	\N
3	NP-20251221-01	真空包装袋	包材	120.00	2025-12-20	zhangsan	{}	1	2026-01-30 19:55:01.309888	\N
11	02.0001	新物料	02	\N	2026-01-30	admin	{}	1	2026-01-30 23:48:29.905537	b0aa5f36-a392-4a79-a908-e84c3aac1112
24	02.99.0004	小方托盒	02.09	\N	2026-01-31	admin	{"spec": null, "unit": null, "conversion": "无", "measure_unit": null, "finance_attribute": null}	5	2026-01-31 16:00:47.767	b0aa5f36-a392-4a79-a908-e84c3aac1112
25	02.05.0015	透明真空袋	02.04	\N	2026-01-31	admin	{"spec": null, "unit": "个", "conversion": "1", "measure_unit": "箱", "conversion_ratio": "2", "finance_attribute": "4111.01"}	13	2026-01-31 16:08:39.542	b0aa5f36-a392-4a79-a908-e84c3aac1112
26	01.0001	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 17:05:59.199248	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
27	01.0002	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 17:05:59.94157	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
28	01.0003	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:16.911482	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
29	01.0004	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:17.612603	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
30	01.0005	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:17.78898	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
31	01.0006	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:17.945129	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
32	01.0007	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:18.061937	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
33	01.0008	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:18.212584	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
34	01.0009	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:18.334983	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
35	01.0010	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:18.507408	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
36	01.0011	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:18.657005	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
37	01.0012	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:18.822502	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
38	01.0013	新物料	01	\N	2026-01-31	hr_viewer	{}	1	2026-01-31 20:20:19.098694	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64
\.


--
-- Data for Name: role_data_scopes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_data_scopes (id, role_id, module, scope_type, dept_id, created_at, updated_at) FROM stdin;
7ef5aa89-0031-4bc5-bc31-47cf25b00155	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	all	\N	2026-01-28 16:50:30.565775+00	2026-01-28 16:50:30.565775+00
acb88f94-ae35-40de-8fd5-2a0e566d8af6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	dept_tree	\N	2026-01-28 16:50:30.568748+00	2026-01-28 16:50:30.568748+00
48bb2e6d-6805-404e-a81d-5b38b0272c86	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	dept	\N	2026-01-28 16:50:30.570423+00	2026-01-28 16:50:30.570423+00
4e0dc234-241c-4b3d-a0b3-4da9b5e71774	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_acl	all	\N	2026-01-31 17:06:30.094213+00	2026-01-31 17:06:30.094213+00
c11c2bfb-a931-408e-9222-250e1f35057a	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	all	\N	2026-01-31 17:06:32.581452+00	2026-01-31 17:06:32.581452+00
cfeb6cc2-de36-497e-9273-c27c686f7128	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	all	\N	2026-01-31 17:06:34.891904+00	2026-01-31 17:06:34.891904+00
6a888574-4f88-4aca-bafc-6dfe6aef791c	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_org	all	\N	2026-01-31 17:06:37.867249+00	2026-01-31 17:06:37.867249+00
2445de65-6ab4-4058-94fa-82da4e46dc8d	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	all	\N	2026-01-31 17:06:39.899197+00	2026-01-31 17:06:39.899197+00
7bbf2f05-1985-4421-abcd-0e5589c74b4c	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	all	\N	2026-01-31 17:06:42.042257+00	2026-01-31 20:27:55.014246+00
c9ec4a6f-53dd-4447-9ff2-5311d740c465	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	self	\N	2026-01-31 20:27:55.014246+00	2026-01-31 22:01:01.031541+00
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (role_id, permission_id, created_at) FROM stdin;
acf335a2-f56f-4aca-bb4d-682553c8e5ec	749a0f67-dc5b-4b61-be56-4b1859260ad1	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	0da90206-1c4b-48b3-9be4-36cbdb58e1b8	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	1c507edf-adb5-4f35-ac70-da6daa6a9f7e	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	df4fde3f-17ac-47fb-b513-6c64ea71d137	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	e0baac90-7926-4337-a3fb-f5c1f6a77966	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	00a17c4e-e84e-4f61-8610-e18d73ed17c6	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	23bd6bc7-1717-4c2a-be99-42093e2c4a96	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	22607dfa-0016-447d-9382-af4ff3f72958	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	5db69a98-dc1c-45b8-85f0-2f5fa94ec2ad	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	7c80805f-47bd-46d6-a80e-f195cc0be2ff	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	f9a66726-7fcb-4596-81f5-5c558e06e69d	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	27ab46fc-3086-41c5-8ee2-4867ce222c7d	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	da0914e1-5105-4156-9a46-cb4a36f95518	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	6d23e088-f7d9-49fe-bb07-cee9c3fe9c18	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	0cbdfa8a-948e-407d-9a6f-f4e1784ecbd7	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	cca47339-1940-4c27-94cf-66f89923888f	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	2c9ed352-5d9c-4f8b-8993-68ec3e67a5b5	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	9da35eef-2dab-4a37-bc95-73e12284c86e	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	fe698f3c-4a79-4e5c-8147-2324e10117be	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	b57c9900-909d-4528-89b4-8c4910bfcdb8	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	cf33aaf0-be78-46ef-a3a8-ad0eea93f67e	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	23c8f1bf-23e5-46bc-a965-e4f74a9c5bd5	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	7dff6243-ab88-4090-ad3e-f7419176d4e6	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	7d97095f-1371-4aee-99b3-e69cc5cad037	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	e8bfa2dc-ab95-4970-a245-0d0b31f316a2	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	bb89aa41-93b0-4da9-99f0-5b2d20525a50	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	6f212a0f-c0d4-472d-a889-34a6f9ce3f7c	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	37396318-923d-4fcd-bc17-8fd584200def	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	a53b2f02-f4b7-4c22-9c43-637e19f94ab5	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	6108f0ae-516c-459f-92c7-cbab491d3c9b	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	938f813c-f070-460a-b9f3-b34e537e01bd	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	96dcd908-214a-4842-beed-c6df4b34dc71	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	749a0f67-dc5b-4b61-be56-4b1859260ad1	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	0da90206-1c4b-48b3-9be4-36cbdb58e1b8	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	1c507edf-adb5-4f35-ac70-da6daa6a9f7e	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	df4fde3f-17ac-47fb-b513-6c64ea71d137	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	e0baac90-7926-4337-a3fb-f5c1f6a77966	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	00a17c4e-e84e-4f61-8610-e18d73ed17c6	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	23bd6bc7-1717-4c2a-be99-42093e2c4a96	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	22607dfa-0016-447d-9382-af4ff3f72958	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	5db69a98-dc1c-45b8-85f0-2f5fa94ec2ad	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	7c80805f-47bd-46d6-a80e-f195cc0be2ff	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	f9a66726-7fcb-4596-81f5-5c558e06e69d	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	27ab46fc-3086-41c5-8ee2-4867ce222c7d	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	da0914e1-5105-4156-9a46-cb4a36f95518	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	6d23e088-f7d9-49fe-bb07-cee9c3fe9c18	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	0cbdfa8a-948e-407d-9a6f-f4e1784ecbd7	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	cca47339-1940-4c27-94cf-66f89923888f	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	2c9ed352-5d9c-4f8b-8993-68ec3e67a5b5	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	9da35eef-2dab-4a37-bc95-73e12284c86e	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	fe698f3c-4a79-4e5c-8147-2324e10117be	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	b57c9900-909d-4528-89b4-8c4910bfcdb8	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	cf33aaf0-be78-46ef-a3a8-ad0eea93f67e	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	23c8f1bf-23e5-46bc-a965-e4f74a9c5bd5	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	7dff6243-ab88-4090-ad3e-f7419176d4e6	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	7d97095f-1371-4aee-99b3-e69cc5cad037	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	e8bfa2dc-ab95-4970-a245-0d0b31f316a2	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	bb89aa41-93b0-4da9-99f0-5b2d20525a50	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	6f212a0f-c0d4-472d-a889-34a6f9ce3f7c	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	37396318-923d-4fcd-bc17-8fd584200def	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	a53b2f02-f4b7-4c22-9c43-637e19f94ab5	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	6108f0ae-516c-459f-92c7-cbab491d3c9b	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	938f813c-f070-460a-b9f3-b34e537e01bd	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	96dcd908-214a-4842-beed-c6df4b34dc71	2026-01-16 15:27:08.757051+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	cd03668e-f24f-4b04-9015-0d8567f829f7	2026-01-28 16:50:30.559143+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	6148a122-5ff1-4b53-9016-edd8af4c9ef1	2026-01-28 16:50:30.559143+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	cd03668e-f24f-4b04-9015-0d8567f829f7	2026-01-28 16:50:30.562776+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	6148a122-5ff1-4b53-9016-edd8af4c9ef1	2026-01-28 16:50:30.562776+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	7217fcde-beb2-4b2b-8a50-4717d3bfd2e7	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	974f2d33-db7c-4a63-b681-39053a3296c9	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	6d5d625b-102d-44c6-9b43-ac95a43b7030	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	52891a44-2cf0-41a8-87bf-61645d1ef732	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	39958fbb-b520-44fd-bc6b-95ac7f56f1e9	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	5c40500a-ed0d-4cbf-9a31-03af3b967974	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	30d0a60e-b529-4c7c-8809-3c803d8fc3a9	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	12c29a45-a19a-4fbc-ac12-9e7f9d9f72c3	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	c0bd2ecb-57bf-4bbb-a3e3-4c208420d211	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	0902a50b-3f49-476e-b8e5-1ac0bca4b78f	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	c7177812-4aad-4925-9d3c-8b1043ad1751	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	a2f2a882-1c0f-4a88-b972-36bb5be8a42f	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	32b9854d-357c-49c9-9dd4-3c3c4f466a57	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	8e29f33b-a3d4-407d-bd84-ec41c90fccff	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	defd5f65-6660-43b9-b725-4af827c51ea6	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	3c89b5f3-2bec-4e93-b939-6f751df2619f	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	212de9d3-3fca-484c-bea6-85a458a6d2e5	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	abe9f0e0-8a6c-47f3-8c39-600801e72374	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	b90a386f-ec09-4026-bdbc-6993bca73ba5	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	c325877d-19dd-4022-9e27-ff00b53d6c7e	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	d1b10f18-d7d8-499f-8bb9-684bee30a64a	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	dab7524c-dd66-47cf-bd64-30b910c9adbb	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	7c97b7ab-f058-4e07-bc0b-8f7b9cefd1e6	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	3a9b0e2a-7726-4d71-9e7f-85c76a67825a	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	71b3c53c-4ea9-470b-be04-0d361ddf4b2a	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	de7a5ba6-578a-4199-8182-4dee3c977ec4	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	803dbf8c-f9df-4628-b751-71f89082c9a9	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	a89fb985-111c-4507-afc5-0c73602c89ee	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	833ba41f-564d-4d53-b1f4-58068df04123	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	98a0bccb-72a5-4977-90e0-bbee6842b7e3	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	338880a9-7464-4cc2-8bb0-83719f3a4404	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	701b506c-2de7-4446-8ee6-6ed9a4649508	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	1cb97f81-8a2c-4caa-b7f0-d99dc11ed4f4	2026-01-28 20:10:59.774431+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	d0517d99-9f67-4877-9a52-cd6542994b10	2026-01-28 20:10:59.774431+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	974f2d33-db7c-4a63-b681-39053a3296c9	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	52891a44-2cf0-41a8-87bf-61645d1ef732	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	39958fbb-b520-44fd-bc6b-95ac7f56f1e9	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	5c40500a-ed0d-4cbf-9a31-03af3b967974	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	30d0a60e-b529-4c7c-8809-3c803d8fc3a9	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	12c29a45-a19a-4fbc-ac12-9e7f9d9f72c3	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	0902a50b-3f49-476e-b8e5-1ac0bca4b78f	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	c7177812-4aad-4925-9d3c-8b1043ad1751	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	a2f2a882-1c0f-4a88-b972-36bb5be8a42f	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	32b9854d-357c-49c9-9dd4-3c3c4f466a57	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	8e29f33b-a3d4-407d-bd84-ec41c90fccff	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	defd5f65-6660-43b9-b725-4af827c51ea6	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	3c89b5f3-2bec-4e93-b939-6f751df2619f	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	212de9d3-3fca-484c-bea6-85a458a6d2e5	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	abe9f0e0-8a6c-47f3-8c39-600801e72374	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	b90a386f-ec09-4026-bdbc-6993bca73ba5	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	c325877d-19dd-4022-9e27-ff00b53d6c7e	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	d1b10f18-d7d8-499f-8bb9-684bee30a64a	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	dab7524c-dd66-47cf-bd64-30b910c9adbb	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	7c97b7ab-f058-4e07-bc0b-8f7b9cefd1e6	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	3a9b0e2a-7726-4d71-9e7f-85c76a67825a	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	71b3c53c-4ea9-470b-be04-0d361ddf4b2a	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	de7a5ba6-578a-4199-8182-4dee3c977ec4	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	803dbf8c-f9df-4628-b751-71f89082c9a9	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	a89fb985-111c-4507-afc5-0c73602c89ee	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	833ba41f-564d-4d53-b1f4-58068df04123	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	98a0bccb-72a5-4977-90e0-bbee6842b7e3	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	338880a9-7464-4cc2-8bb0-83719f3a4404	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	701b506c-2de7-4446-8ee6-6ed9a4649508	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	1cb97f81-8a2c-4caa-b7f0-d99dc11ed4f4	2026-01-28 20:25:08.645115+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	d0517d99-9f67-4877-9a52-cd6542994b10	2026-01-28 20:25:08.645115+00
dab1f261-b0ef-4050-82d4-251514f9041b	974f2d33-db7c-4a63-b681-39053a3296c9	2026-01-28 20:25:08.65021+00
dab1f261-b0ef-4050-82d4-251514f9041b	52891a44-2cf0-41a8-87bf-61645d1ef732	2026-01-28 20:25:08.65021+00
dab1f261-b0ef-4050-82d4-251514f9041b	39958fbb-b520-44fd-bc6b-95ac7f56f1e9	2026-01-28 20:25:08.65021+00
dab1f261-b0ef-4050-82d4-251514f9041b	5c40500a-ed0d-4cbf-9a31-03af3b967974	2026-01-28 20:25:08.65021+00
dab1f261-b0ef-4050-82d4-251514f9041b	30d0a60e-b529-4c7c-8809-3c803d8fc3a9	2026-01-28 20:25:08.65021+00
dab1f261-b0ef-4050-82d4-251514f9041b	12c29a45-a19a-4fbc-ac12-9e7f9d9f72c3	2026-01-28 20:25:08.65021+00
e1ba01bc-955c-4d41-9ed8-35dfd8644320	974f2d33-db7c-4a63-b681-39053a3296c9	2026-01-28 20:25:08.652939+00
e1ba01bc-955c-4d41-9ed8-35dfd8644320	52891a44-2cf0-41a8-87bf-61645d1ef732	2026-01-28 20:25:08.652939+00
e1ba01bc-955c-4d41-9ed8-35dfd8644320	39958fbb-b520-44fd-bc6b-95ac7f56f1e9	2026-01-28 20:25:08.652939+00
e1ba01bc-955c-4d41-9ed8-35dfd8644320	5c40500a-ed0d-4cbf-9a31-03af3b967974	2026-01-28 20:25:08.652939+00
e1ba01bc-955c-4d41-9ed8-35dfd8644320	30d0a60e-b529-4c7c-8809-3c803d8fc3a9	2026-01-28 20:25:08.652939+00
11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	974f2d33-db7c-4a63-b681-39053a3296c9	2026-01-28 20:25:08.655632+00
11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	52891a44-2cf0-41a8-87bf-61645d1ef732	2026-01-28 20:25:08.655632+00
11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	5c40500a-ed0d-4cbf-9a31-03af3b967974	2026-01-28 20:25:08.655632+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	15b8295c-a5df-4b8b-b37d-c3b57eb204e3	2026-01-28 20:37:35.505715+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	9058f230-f9a9-4c2a-a1f2-2fedae68d9cf	2026-01-28 20:37:35.505715+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	ad2fb879-b364-4699-af80-a4566ae40441	2026-01-28 20:37:35.505715+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	448f5c64-0718-4bfa-af41-7723848c41d1	2026-01-28 20:37:35.505715+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	21cf8896-f18a-417b-9c18-9b41c08c2aae	2026-01-28 20:37:35.505715+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	96319cc7-2a65-4364-866d-5dfbefbde93e	2026-01-28 20:37:35.505715+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	68dd9b9e-b264-4af0-a95e-6f3163e28b25	2026-01-29 14:27:02.502333+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	30ab876f-a563-47c6-a4fd-4c488bdb83a6	2026-01-29 14:27:02.502333+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	a7e97ec8-ef4b-412f-9ba9-aadea7e15059	2026-01-29 14:27:02.502333+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	7f471355-1ab3-461f-bca0-46a886b37fe2	2026-01-29 14:27:02.502333+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	f5c4bbdb-9a75-4fa0-8d42-037fa9c79267	2026-01-29 14:27:02.502333+00
acf335a2-f56f-4aca-bb4d-682553c8e5ec	f7032fce-1cad-4772-a8aa-6e0a83f0b1fc	2026-01-29 14:27:02.502333+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	68dd9b9e-b264-4af0-a95e-6f3163e28b25	2026-01-29 14:27:02.502333+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	30ab876f-a563-47c6-a4fd-4c488bdb83a6	2026-01-29 14:27:02.502333+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	a7e97ec8-ef4b-412f-9ba9-aadea7e15059	2026-01-29 14:27:02.502333+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	7f471355-1ab3-461f-bca0-46a886b37fe2	2026-01-29 14:27:02.502333+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	f5c4bbdb-9a75-4fa0-8d42-037fa9c79267	2026-01-29 14:27:02.502333+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	f7032fce-1cad-4772-a8aa-6e0a83f0b1fc	2026-01-29 14:27:02.502333+00
dab1f261-b0ef-4050-82d4-251514f9041b	68dd9b9e-b264-4af0-a95e-6f3163e28b25	2026-01-29 14:27:02.502333+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	7217fcde-beb2-4b2b-8a50-4717d3bfd2e7	2026-01-29 17:13:46.824506+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	701b506c-2de7-4446-8ee6-6ed9a4649508	2026-01-29 18:55:00.732363+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	c325877d-19dd-4022-9e27-ff00b53d6c7e	2026-01-29 18:55:02.743024+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	c0bd2ecb-57bf-4bbb-a3e3-4c208420d211	2026-01-31 22:50:43.936293+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	15b8295c-a5df-4b8b-b37d-c3b57eb204e3	2026-01-31 22:50:43.936293+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	9058f230-f9a9-4c2a-a1f2-2fedae68d9cf	2026-01-31 22:50:43.936293+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	ad2fb879-b364-4699-af80-a4566ae40441	2026-01-31 22:50:43.936293+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	448f5c64-0718-4bfa-af41-7723848c41d1	2026-01-31 22:50:43.936293+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	21cf8896-f18a-417b-9c18-9b41c08c2aae	2026-01-31 22:50:43.936293+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	96319cc7-2a65-4364-866d-5dfbefbde93e	2026-01-31 22:50:43.936293+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	6d5d625b-102d-44c6-9b43-ac95a43b7030	2026-01-29 17:02:55.508643+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	52891a44-2cf0-41a8-87bf-61645d1ef732	2026-01-29 18:54:46.588+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	0902a50b-3f49-476e-b8e5-1ac0bca4b78f	2026-01-29 18:54:46.588+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	c7177812-4aad-4925-9d3c-8b1043ad1751	2026-01-29 18:54:46.588+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	a2f2a882-1c0f-4a88-b972-36bb5be8a42f	2026-01-29 18:54:46.588+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	32b9854d-357c-49c9-9dd4-3c3c4f466a57	2026-01-29 18:54:46.588+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	8e29f33b-a3d4-407d-bd84-ec41c90fccff	2026-01-29 18:54:46.588+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	a89fb985-111c-4507-afc5-0c73602c89ee	2026-01-29 18:55:00.010143+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	974f2d33-db7c-4a63-b681-39053a3296c9	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	d1b10f18-d7d8-499f-8bb9-684bee30a64a	2026-01-29 18:55:01.480468+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	39958fbb-b520-44fd-bc6b-95ac7f56f1e9	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	dab7524c-dd66-47cf-bd64-30b910c9adbb	2026-01-29 18:55:01.980034+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	12c29a45-a19a-4fbc-ac12-9e7f9d9f72c3	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	defd5f65-6660-43b9-b725-4af827c51ea6	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	3c89b5f3-2bec-4e93-b939-6f751df2619f	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	212de9d3-3fca-484c-bea6-85a458a6d2e5	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	abe9f0e0-8a6c-47f3-8c39-600801e72374	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	b90a386f-ec09-4026-bdbc-6993bca73ba5	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	68dd9b9e-b264-4af0-a95e-6f3163e28b25	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	30ab876f-a563-47c6-a4fd-4c488bdb83a6	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	a7e97ec8-ef4b-412f-9ba9-aadea7e15059	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	7f471355-1ab3-461f-bca0-46a886b37fe2	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	f5c4bbdb-9a75-4fa0-8d42-037fa9c79267	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	f7032fce-1cad-4772-a8aa-6e0a83f0b1fc	2026-01-29 17:12:20.917855+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	5c40500a-ed0d-4cbf-9a31-03af3b967974	2026-01-29 17:12:25.79148+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	833ba41f-564d-4d53-b1f4-58068df04123	2026-01-29 17:12:25.79148+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	98a0bccb-72a5-4977-90e0-bbee6842b7e3	2026-01-29 17:12:25.79148+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	338880a9-7464-4cc2-8bb0-83719f3a4404	2026-01-29 17:12:25.79148+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	1cb97f81-8a2c-4caa-b7f0-d99dc11ed4f4	2026-01-29 17:12:25.79148+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	d0517d99-9f67-4877-9a52-cd6542994b10	2026-01-29 17:12:25.79148+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	30d0a60e-b529-4c7c-8809-3c803d8fc3a9	2026-01-29 17:12:26.570929+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	7c97b7ab-f058-4e07-bc0b-8f7b9cefd1e6	2026-01-29 17:12:26.570929+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	3a9b0e2a-7726-4d71-9e7f-85c76a67825a	2026-01-29 17:12:26.570929+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	71b3c53c-4ea9-470b-be04-0d361ddf4b2a	2026-01-29 17:12:26.570929+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	de7a5ba6-578a-4199-8182-4dee3c977ec4	2026-01-29 17:12:26.570929+00
e0d14028-ec80-4c81-aa95-24fe79a1ad05	803dbf8c-f9df-4628-b751-71f89082c9a9	2026-01-29 17:12:26.570929+00
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, code, name, description, created_at, updated_at, sort, dept_id) FROM stdin;
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_admin	人事管理员	人事模块全权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100	\N
dab1f261-b0ef-4050-82d4-251514f9041b	hr_clerk	人事文员	人事模块编辑权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100	\N
e1ba01bc-955c-4d41-9ed8-35dfd8644320	dept_manager	部门主管	部门管理权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100	\N
11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	employee	员工	普通员工权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100	\N
acf335a2-f56f-4aca-bb4d-682553c8e5ec	super_admin	超级管理员	拥有全部权限	2026-01-16 15:27:08.757051+00	2026-01-31 21:27:28.580586+00	100	\N
e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_viewer	人事只读	仅查看权限	2026-01-28 16:50:30.556875+00	2026-01-31 21:27:28.580586+00	30	\N
\.


--
-- Data for Name: sys_dict_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_dict_items (id, dict_id, label, value, sort, enabled, extra, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sys_dicts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_dicts (id, dict_key, name, description, enabled, sort, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sys_field_acl; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_field_acl (id, role_id, module, field_code, can_view, can_edit, created_at, updated_at) FROM stdin;
ee4cec45-ddc4-4f25-b26c-c26432289b56	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	salary	t	t	2026-01-28 20:25:18.733054+00	2026-01-28 20:25:18.733054+00
e684a2b1-7892-47b2-809c-ad3f38b36abc	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	id_card	t	f	2026-01-28 20:25:18.733054+00	2026-01-28 20:25:18.733054+00
11dc3d73-9940-435f-ac80-fe6351fe11c7	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	salary	t	f	2026-01-28 20:25:18.733054+00	2026-01-28 20:25:18.733054+00
a244d679-feb2-43b8-8846-ea5f85389c93	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	id_card	t	f	2026-01-28 20:25:18.733054+00	2026-01-28 20:25:18.733054+00
8f265d03-c074-4958-bfad-cb3f6be39bb6	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	salary	f	f	2026-01-28 20:25:18.733054+00	2026-01-28 20:25:18.733054+00
398781b0-e1c6-48cb-b343-68d90c8ed6a6	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	id_card	f	f	2026-01-28 20:25:18.733054+00	2026-01-28 20:25:18.733054+00
a649caf2-a292-4daa-a872-d56f884ea8f6	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	id	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
36ac320f-daf5-4d0e-a3bc-8313146ea04b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	id	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
ca7a6c8c-b1df-446a-8e47-86a65b7db3e1	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	id	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
f2316834-c5f3-4ae1-93e6-03ed8b298e07	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	id	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
600b6644-71bc-406a-a8f6-77f55d84331e	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	id	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
c7fa69e5-b133-4d4d-9a11-6553cc33a4ba	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_5458	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:31.647365+00
a4b6df97-6cfa-4686-8bd1-5e6e24230714	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	name	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
846ebd60-f834-49a7-80b3-ead071c0cc2e	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	name	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
7fac947c-e6b6-4f14-8335-414424973b9b	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	name	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
da4c320e-087f-45e6-ae56-fd06fd8ca65b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	name	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
346a3a79-dce1-4f9c-b7f5-9fff82753a9e	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	name	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
59572376-dd31-4baf-8144-dfb41d75860b	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	employee_no	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
3c200e2b-24fe-4f83-826f-fc214adfe68a	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	employee_no	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
0eb10478-8443-41e7-9b63-ec3b860f5605	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	employee_no	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
6cc8a8d9-c528-4f23-b91e-12820eb83c50	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	employee_no	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
242f9cf8-ee09-4eed-9316-329490b09f20	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	employee_no	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
28b9026f-37b9-443c-b37a-d1847a1b7e2b	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	department	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
5b6a0b33-7170-44d1-8302-68ca9e986201	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	department	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
2920293b-ba90-4f95-a5e9-230e9e8a7126	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	department	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
b9b5aba2-3db8-4440-900a-c5148d46ffaf	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	department	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
6091f7df-35c6-4d43-9a29-389400e9059c	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	department	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
39b096f1-038f-4c59-9d12-4a04b6ed3bd8	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	status	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
2bc28437-c0ac-4c0a-a292-b0266b185ca9	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	status	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
6c7b6a9c-1276-4916-b5b9-748f3d89ea44	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	status	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
341f6021-0634-4f18-af00-755cbc52ab5e	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	status	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
acb69bf6-16cd-408e-8c80-fd1f62d1bbbd	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	status	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
625b4e5d-1ab7-4d34-87c0-e766abb74bc2	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	from_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
54776101-de1c-455c-9bf8-b4eb6fa1077b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	from_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
7ff8ce26-f65d-48fb-9c38-5f85b2486c7f	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	from_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
3282e16c-ba7e-4def-bfd9-992059d669a5	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	from_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
6989d552-1ddd-444f-83fe-f0dd3cdfe3f1	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	from_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
42728f12-c8ab-407e-916c-e2ffd4b70dad	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	to_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
e2dcd469-d174-405c-ae93-6eddc104e747	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	to_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
314bde83-eca6-4440-aa84-0474c6568b20	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	to_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
45fff6ac-b7f5-4637-8d3d-a698848c41cb	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	to_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
917b2052-ae95-4a4b-963d-931f9fd71677	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	to_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
a2cb1e10-503f-475c-ba0d-aae327572a85	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	from_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
4fc3ad37-cd35-4d56-8d94-0445c18eebd9	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	from_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
79b0cdef-f51c-4054-8795-30b3e1e800dd	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	from_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
372705f1-87c6-4681-9b3a-ed707c7c1f8b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	from_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
8d2b527b-46fc-43be-a8a0-e4f234e4496d	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	from_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
5a501694-89f6-4302-8712-9ff5740a5910	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	to_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
0143f39d-d637-453e-a721-67e92d965652	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	to_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
6cffd676-f4ef-4005-979e-5ee33a100837	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	to_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
b93547b0-a413-483f-8df3-6d48993e4f7d	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	to_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
da4b92b7-6236-4b9c-ac67-f7a2990595ae	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	to_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
e75f3357-1d9c-4e6e-b199-ca453e96206a	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	effective_date	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
5e06567e-7c54-47b7-8a90-a9ac59578e0e	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	effective_date	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
dee94892-975a-4e76-87f8-f6d2101d3ae9	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	effective_date	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
342f7822-e8d9-4eb9-94bc-3ab3c2208b18	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	effective_date	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
34e7476e-6d3d-42da-8fff-1794a7c5a23e	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	effective_date	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
5eadec20-2a96-4c18-b728-1889b6e9ddc9	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	transfer_type	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
4ad5a292-6289-4926-a983-f4238d2abe2b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	transfer_type	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
c9ab0501-db4a-4262-895f-d8375fe22bb3	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	transfer_type	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
364b409c-28ec-42d8-995f-dd759ebd5458	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	transfer_type	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
3b919f28-4e65-496d-9eb1-1450ca38568f	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	transfer_type	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
8889500d-12f3-4b07-b6a5-69de9d3a6486	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	transfer_reason	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
4a701594-f3d1-44ba-82b0-2ca81137e8e3	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	transfer_reason	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
3ca9023c-feae-4c24-af0b-0c03784fafcb	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	transfer_reason	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
02000ba9-4241-4f24-a08a-73b4c085c71b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	transfer_reason	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
7fef2e89-4347-4606-a939-c7e3cf6d00dc	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	transfer_reason	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
12c7070a-db75-487a-8030-b3e5639c551d	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	approver	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
cbb9e864-97cf-4b6a-8ef2-14f3505194bc	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	approver	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
f6d5a64d-a1a0-448a-a179-703c22356149	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	approver	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
858e862b-e7ff-4d3d-9d95-958340fa297a	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	approver	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
02b2959b-96ec-4948-94b1-670c0a77b15c	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	approver	t	t	2026-01-28 20:59:05.725584+00	2026-01-28 20:59:05.725584+00
024d543f-dcc0-4fab-92ed-ed874624487d	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	password	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
9c09485d-661d-495a-986b-32e9c5b7fee7	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	id	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
63546768-9d37-4a07-a16b-fc6c9365955f	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	id	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
582d1820-1237-4109-bee6-70f30f51182a	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	id	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
d237fa58-c43b-42d5-9bfc-830df9fe2d99	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	id	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
db6c5312-29f1-43e5-a7f5-73b615ab9b48	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	id	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
c6581f05-a98c-43ca-974b-30b6ca9a2616	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	password	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
c143d24b-2cb9-45a0-aa67-e316bf3b9250	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	name	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
fccc8b1a-9e36-4e79-b676-b0772d484d1e	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	name	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
28444f4b-bfff-48fb-b4cd-71e4f7441446	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	name	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
a95053e1-34ff-44d8-9810-67247454b770	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	name	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
6b970cef-3aa9-4278-84af-beca5ba17ab8	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	name	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
6f4bdd17-6265-43dc-9020-2ce0b9f4b017	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	password	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
abef6d12-aff1-454e-941b-7d54707f0853	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	employee_no	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
5216e2a9-200c-430a-85ae-79c5953a37a4	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	employee_no	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
966b4939-f426-481c-b6af-1997c66e5623	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	employee_no	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
d3768ec9-0854-482b-b9da-3c054b92f957	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	employee_no	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
c6053c6f-eeb1-4167-92f9-f02b45b0db2d	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	employee_no	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
10dffcfb-49e4-4ff4-bad9-a3a8f52b7f72	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	password	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
bddbdbe7-0634-4468-811a-afc771865565	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	department	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
4c2beab3-52f1-41fa-bf6c-9209781c8f93	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	department	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
d2edfe56-f3b6-4a24-8c36-d5cf381cc987	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	department	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
020e0cee-5a0c-4b0b-b85e-35744312335c	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	department	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
94e03acf-5970-423a-8172-7563785ea556	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	department	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
8ba5fb07-d806-4afb-a524-f715caefebce	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	password	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
ce4f1839-9d97-4e44-bf84-9efa43339713	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	status	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
d1855455-97ad-43e1-b0a8-d25c8f38588a	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	status	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
1c1012ef-62de-40c8-8781-24f97fac2e16	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	status	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
36d320b0-967d-4ac4-ab91-2315795be17e	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	status	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
e1c207ae-ddf1-4de5-b611-7f7631f24361	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	status	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
2b1b9823-46d8-45af-b2c7-4231639d5d90	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	password	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
972ea1e3-125e-4ef6-8eac-28751a0631c2	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	gender	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
5b58be16-dfb8-4922-ae96-42626d746337	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	gender	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
f325e628-f36d-44f7-a00f-7b3cd984544a	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	gender	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
07c2216e-1754-44ca-b4cf-556c4ec653c3	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	gender	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
5ca17f77-bb72-45f9-a278-0da534faf78c	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	gender	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
d2057941-c813-45ba-a501-49be9466230e	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	avatar	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
7f548d15-f07a-41c4-b30a-285be6660548	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	id_card	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
4c5eb0ab-744a-4b10-8bac-99dcdc0adf31	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	id_card	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
9e07a029-8ce4-4404-b96e-7c9ebfb623b5	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_3410	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
af1f4e55-d35c-4991-b1b8-f85f09633f66	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_3410	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
78d02c94-849d-48fb-b87b-fe430d1ec023	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_3410	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
c740a3ea-4536-4a57-976b-ef7bde1c379a	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_3410	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
7a309f9e-6fbe-47bf-ae63-d89fc9619fbf	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_3410	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
57735154-48f5-4774-ad44-0cfd5d9f59aa	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	avatar	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
2d27315d-003b-4988-96a7-a5bd6b659279	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_5458	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
e18a3f7b-e298-4337-8026-25848318f2bd	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_5458	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
3d54b4d9-8893-46a4-af0b-2a10d072cef4	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_5458	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
dd21a7e5-862f-4295-aeb8-9f92648d7b4f	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_5458	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
d8077a83-f00d-48ca-8a6e-69049a7fe475	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_5458	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
80debf77-9c61-4ba8-9d51-9996d0de1144	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	avatar	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
36f2c8ec-9131-4ee0-b1fb-ab36446adf69	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_9314	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
f5c428ef-29d7-4619-8131-66d4d91889b4	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_9314	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
12bc97bf-2a38-4d51-b96d-3c67bd02c9ab	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_9314	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
10654b21-11fe-4c6e-8dc7-2fe17ef92237	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_9314	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
fbd6b460-6e14-4542-ac34-ae43f391b06a	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_9314	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
0a3faedf-56f1-45b5-a04b-a0ca909f3a1b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	avatar	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
29efa2cf-2e3f-490d-b441-cb428238a5cf	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_789	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
1b482265-ed73-4a53-a038-cd40e71b32b5	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_789	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
201d4227-8e1a-4491-99a7-da47834e6807	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_789	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
3b0d96cf-9c7c-4a10-996c-a7dcb91bc183	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_789	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
de245b70-c7dc-4c5d-b6b5-eaad0d92af71	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_789	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
8ceae5c5-0af8-4533-8259-c4779ba653f9	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	avatar	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
c8ba1e48-0fdb-4da5-a048-603035dfeb3e	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_8633	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
79fbf106-cb7a-4163-bec4-ac365e8feb75	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_8633	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
05001a2f-2626-4945-b064-f9b6418d98c1	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_8633	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
7ba99a47-4dbd-4731-8c1b-f580cc6dcdf3	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_8633	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
73f16322-3587-4935-ba11-1233f8b67028	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_8633	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
f67800a0-2e92-40a1-8ddb-c1328f9c2f34	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	avatar	t	t	2026-01-29 20:35:24.585598+00	2026-01-29 20:35:24.585598+00
f42d7664-82c1-45cd-b833-12b2f7471028	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_2086	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
98a63639-5011-45be-a1e5-8cd6098a62c6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_2086	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
3e6d0898-a756-4068-8b4f-4bc9c2e29033	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_2086	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
22e5ac78-46bc-4b65-ae99-5efe3bb7b3e6	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_2086	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
60632ad0-c54a-4780-aac9-e2fbea8255d5	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_2086	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
25927ef1-1ef9-43cc-a757-03d2b0484cde	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	conversion_ratio	t	t	2026-01-31 15:57:21.066205+00	2026-01-31 15:57:21.066205+00
175294a3-2698-432b-831e-67493ffef013	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_7980	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
2e9502ed-82a1-4f74-a27f-b5d962ffdff3	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_7980	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
7de36d3e-97e0-4b4f-a247-b5c2710045b8	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_7980	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
913dc224-7335-44b6-908a-d1e0273b9640	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_7980	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
7a1e3c83-20c1-47c2-afdc-795958df10a0	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_7980	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
b150cfa2-1b69-45e0-99f2-07a0e6ba1477	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	conversion_ratio	t	t	2026-01-31 15:57:21.066205+00	2026-01-31 15:57:21.066205+00
d8c0a0ab-9b8d-4a01-8db5-6cc87072e374	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_1340	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
7c2b35ea-4f06-4811-ac75-bca3d1f9beab	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_1340	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
f31893a8-d9e4-4339-bc53-9d99448e5ac3	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_1340	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
5ac35d3d-4dc3-4706-b278-95e2410b0e41	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_1340	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
86c187da-2592-4ca0-8ddb-35554f53b293	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_1340	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
b8b1fecb-afb6-40b9-b54e-21ffd1697dcc	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	conversion_ratio	t	t	2026-01-31 15:57:21.066205+00	2026-01-31 15:57:21.066205+00
bfae220f-e1f9-432b-8d7d-1660e5d4e300	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_3727	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
a0dee0f7-1c55-4daa-a5de-0eb007d60a23	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_3727	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
06b3b165-7ef0-4c12-8142-15af1cddf862	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_3727	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
43ebb8ff-b08c-46ac-863b-cea6787608e4	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_3727	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
3a3f0b04-1ef1-4fcc-8c21-7b22ed09db34	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_3727	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
d24971d5-2961-4d6a-a01c-6f06472ddee3	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	conversion_ratio	t	t	2026-01-31 15:57:21.066205+00	2026-01-31 15:57:21.066205+00
3a81cc73-490d-437f-9553-219d25e7d636	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	field_3986	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
e4b49d42-5046-4e43-a3eb-947845422ce7	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	field_3986	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
e4969fbd-a119-4177-bb2c-d99165d9d978	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	field_3986	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
825ecad4-7d44-4178-8276-fbd81ab09587	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	field_3986	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
8de03dfa-fcb0-4a82-a011-b0d1aaf18e46	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	field_3986	t	t	2026-01-28 20:59:08.678182+00	2026-01-28 20:59:08.678182+00
f8258f10-6a3a-4dad-9c48-8a0164c7add1	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	conversion_ratio	t	t	2026-01-31 15:57:21.066205+00	2026-01-31 15:57:21.066205+00
66747505-6a8f-47e5-83d6-28598f40e1bc	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
ae69fb86-2fff-46fe-9237-8a217a5a0a65	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
11173efc-fdc0-4f4d-8fa9-1225e73a82fc	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
3ebf67c2-afbf-4ca0-b598-aa03a3dc9095	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
2168a92e-cec4-46e0-a507-99585926e304	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
3e111485-30e7-484c-801c-1fe7d694f13a	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
4a93377d-e441-4a30-ba9d-e0e048beb635	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
37809228-3de8-47e1-bc36-b63520abe785	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
b4ef6b5c-7ef9-477a-89a9-6c56383e2668	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
1d5a2c6f-9756-4160-80d4-b9a75f4d6ec5	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
e2234bd5-bbf1-441d-9358-865789ef6486	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	conversion_ratio	t	t	2026-01-31 15:57:21.066205+00	2026-01-31 22:50:43.936293+00
052f4fee-76ac-4308-bbd1-9408b85c12cd	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	employee_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
dce147ef-504c-4022-b571-9313c6fefc45	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	employee_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
be9165ee-bed9-4a44-8aba-f3ec00f91530	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	employee_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
825f7727-a7fe-4ee4-b290-bd53cf0f6058	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	employee_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
0e60b280-c5e7-4cea-a788-57f19cdd2fce	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	employee_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
1af9e70d-79a4-4f74-9e22-1062e4e69b5b	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	department	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
e62eb441-48d5-4812-b832-298ecc627c29	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	department	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
db587e1a-63c6-4b05-b455-14d8d7b3322f	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	department	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
8e1d4b4b-eccc-4167-b31d-aa0aa416eed5	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	department	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d2557f3e-7c56-435c-91c2-d36992d53ca3	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	department	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
322c3d8d-d9fe-49e2-b2fc-6794bfb27b91	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
26d9ee84-df0c-4bd5-92b0-593ada220f26	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
fbdac596-cf5a-45b0-842a-b20e5a42d8c0	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
22b3428f-f81a-4440-a13e-abc3e733654e	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
0ef662e6-0e4d-4160-9432-aa0987ee6d34	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
7932e45d-1e3b-40d8-a9b3-c8097cf9763f	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	att_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
89bfe670-0e4f-4fb3-a87c-cb46e8122de3	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	att_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
f9a4f9f5-fa1a-45d4-8bc8-e8c622e1d040	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	att_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
40ff8166-8811-4369-8c35-f663ed10da15	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	att_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
0554c5a0-2dbe-4e90-bcd6-89728e1cf8bc	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	att_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
7f9a427d-f400-4d6c-8000-a08283f133bd	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	att_note	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
5e3be08a-ea5e-4531-9ed2-9252a57be0bc	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	att_note	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
97da98b0-a1f4-41bb-87c1-93c0ab314fa3	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	att_note	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
005e7ca8-7082-4fc0-85da-c3df4efb6444	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	att_note	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
49be8a1a-5e94-4caf-9da7-4f99694cdf6e	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	att_note	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d20176f0-e107-41ae-864d-4c274f31031a	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	att_status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
464116a5-666c-4cba-891d-a80b76fd2881	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	att_status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
29654a15-74ac-4ad4-9838-5b8b06934051	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	att_status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
a3522f6a-169f-43d8-b6cf-ce34dd419c47	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	att_status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
64d98b84-be28-4c41-ad64-bceebb74a7bd	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	att_status	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
2245aacb-ca12-4311-b372-2b02ef5a7341	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	check_in	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
dc549cd4-f88d-4900-b041-bd189aea5db4	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	check_in	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
1956a080-16b7-4264-80b8-0708ee5c101b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	spec	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d3e9ccf4-0381-4e44-9733-049dcb00be16	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	check_in	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
eea27d32-e449-496e-acef-83d827a5f075	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	check_in	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
3f4eadc9-e383-4ece-8d95-5d3c820110d0	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	check_in	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
af66c40d-b93d-448a-9bfa-6053e650bb04	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	properties	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
9014a237-72dd-4cc8-b8bf-a0b22ee42c79	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	check_out	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
9d9ddf9c-9e5b-4518-a11d-5c4e1a51e06f	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	check_out	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
2256ae94-ec6d-4ad9-864f-aef5c9d34ae7	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	check_out	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
43bc6654-8f60-491e-b737-cd0d5ad43b60	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	check_out	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
53e92810-34cc-4d07-bffa-9596ef448e5b	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	check_out	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
4d6b8d52-26dc-4d6e-858c-9ba0ab6bf9b4	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	properties	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
0f3b882c-5bba-4c6e-925e-ecf252772d18	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	ot_hours	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
0ac06099-888f-4d19-8e7b-6118e6bb42cf	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	ot_hours	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
0a80efca-1745-41a9-b1dd-6238009d5ba6	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	ot_hours	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
343863bb-a608-4fac-ba72-49b1c28407ed	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	ot_hours	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
516647f5-a46f-4af0-abcf-f62ab47bc203	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	ot_hours	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
ea3e1e79-6409-45f1-92e6-60515d2514cc	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	properties	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
27dad196-ce86-4e9f-86b9-75f434a49254	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d764b1c0-74b0-4e49-aac9-fc0788405384	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
599f4b12-502e-4f6e-aa74-141cf068398e	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
deca9bb5-bf2a-4c88-94d3-105f608cde91	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
694481c0-16f1-4626-811e-691584a4ce46	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
6cdb21d3-fc1b-408e-b5fd-f22bb9a5acdd	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	properties	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
2ccdcb37-d97b-463a-9dcf-5fb60fa9b8bf	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	batch_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
fdfe6e13-1d03-4240-81db-5ad62b99cac6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	batch_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
7b192178-7ed1-4b30-8282-151995406597	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	batch_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
2605909c-1b56-4d32-b4f7-f79da754dbe3	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	batch_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
99a3be33-5b73-4bbe-8fa1-0f4dea9c992f	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	batch_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
b90066fb-5188-4d82-8782-698cd5163187	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	properties	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
1ebf99bf-9e55-44d5-98d4-00185b136af2	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
7a396094-b4ad-4c85-9cd7-fde07935809f	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
b6152398-8596-48a5-b4f1-d004fec96e1b	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
a9f13f7f-ba86-4fdc-9c75-50d0a228598f	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
f93f689c-9a17-413e-96d7-255e1ee79d48	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
6249458f-ac2a-479a-b497-fb6e48cf553c	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	category	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
4c01681a-3998-4987-a123-b4c1e470146e	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	category	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
f7c6ab06-c65e-4585-a93d-e4ca1cc90418	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	category	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
6de4de79-0893-48bb-a27a-77f67288d819	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	category	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
8cc11c24-c728-471c-8b03-16c934ea54fa	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	category	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
036439fb-7556-4a0e-8b17-9a9fdcb5b491	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	version	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
69f95283-1941-463b-9c40-f47de7be9311	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	weight_kg	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d95cdafc-3a6f-4775-bee2-e6896d0d5e12	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	weight_kg	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
eb2c5530-3740-40d3-a0af-d4d158cb9a2e	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	weight_kg	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
89e6579d-7fa6-44f3-ab2a-5420c5e397fe	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	weight_kg	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
7d489c2e-f02a-4628-82e1-474eb16ad297	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	weight_kg	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
391b30f2-5bee-4494-ba59-3b07280730cb	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	version	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
792936f6-5b84-4475-8364-de3c9fab5b05	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	entry_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
ee734f2a-cf63-4682-b1be-ec8067e385d0	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	entry_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
314ea738-9f03-47c5-9f7b-e0305818ed0e	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	entry_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
90882ac5-8f5a-4924-aa53-3cb3616cf680	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	entry_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
37d625be-07bc-43c7-be14-4f284eb165f7	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	entry_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
b311e63c-c7fe-43e5-97a4-570ec7c906ee	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	version	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
1d922bfe-8dfd-43e1-8fe2-5e0e5c88b232	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	created_by	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d9ed26fe-bf00-4b30-acd8-c90dccb8c8c6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	created_by	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
94777ec0-a54e-4259-980c-85c0b6a33c6f	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	created_by	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
56f8e144-0f24-44c8-bc50-c1c58670c589	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	created_by	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
80168e0f-0f50-4dae-93c7-a32ba45bbec4	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	created_by	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
763422da-f36c-4204-9021-5d86560b70a2	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	version	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
55481cc6-9ae1-47cf-9343-335ff6173997	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	conversion	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d4697596-2be3-41c6-980f-82e7e12a3ef2	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	conversion	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
5c979dda-92fb-4c5e-a12b-ca2f497ec83e	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	conversion	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
e8c2516f-ad76-4880-88eb-d9e561cbf680	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	conversion	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
41b8f5ca-45c6-4710-8aa9-d656e3e6ec4d	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	conversion	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
0c047956-53a0-4449-a168-0fae4537d522	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	version	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
b28ec9f5-e57d-434d-a81d-4cd612f02693	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	finance_attribute	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
e3794ceb-ac98-4354-bafe-aa6ec6eb7c90	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	finance_attribute	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
96113ad6-22d5-4560-83ea-107a0302afe4	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	finance_attribute	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
d9d3479d-a293-42c8-92ab-673b6473e2e0	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	finance_attribute	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
5712813d-2a27-491e-ad36-29f53ade4d2e	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	finance_attribute	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
c3a323c3-5328-450b-8def-f6be402ec926	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	measure_unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
84c9e1f7-e1d0-430f-babd-71dcdd04fa8b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	measure_unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
98f44e64-d352-40fd-843e-d886cdc48c6e	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	measure_unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
b90c6ddf-6869-44fd-868f-f83c7b9cc91d	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	measure_unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
099e5a94-c7cb-4901-850d-36058c138da2	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	measure_unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
af9670e2-83ee-42f8-bc09-b39bbf46c641	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	updated_at	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
9963a45c-0d9a-4529-9abe-2e8204d4465f	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	spec	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
044e4a06-9377-4cb9-bafd-13c333bf5922	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	spec	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
a6e26b14-ef4c-4825-bf24-a43cb36aaa44	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	spec	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
499d6a6c-fcfc-420e-991f-7dc4ba69f041	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	updated_at	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
07ff49d6-1e72-4fce-9496-34d337d916c3	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	version	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 22:50:43.936293+00
5b4ac594-9d64-41e1-b035-24b1cc5dcb64	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	spec	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
91d9c6d0-ea8e-4977-a6da-454a934e6305	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	total_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-29 17:12:25.79148+00
055a359d-7a93-4266-b4b3-fb3910b730e7	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
15ed0e9c-70ac-4a3b-878c-f03421c33770	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
474bbf6f-a79a-4289-bc4d-83bf58557ba9	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
2a9f3eb7-38a6-45a0-9e6f-0e70c56384b5	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
b4515015-1122-491e-a977-bb6c0ba8c9e7	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-28 21:07:34.873684+00
c2efb56e-c90f-4a46-be15-234c1bb4ea18	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	late_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-29 17:12:25.79148+00
3c541041-6359-4b66-bb6f-9c9b81c95e9c	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	position	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
01154660-a51a-4913-acfd-1bfb7082e22b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	position	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
a5b79921-dce6-4b67-9ea4-ca93edac265d	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	position	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
3a134d9b-f8d9-4f10-bc2b-991416b13068	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	position	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
e0d0e384-047b-42a4-aa36-7479b094e742	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	position	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
9b6e5312-c803-45d0-bd02-5a2d4aed6d26	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	att_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
643ddc59-971e-4481-9290-1ba71e90395b	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	phone	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
436fe3d7-71f7-42af-bc62-4f934c16929c	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	phone	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
63d0ee15-575f-4206-8cec-a3c5502352f8	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	phone	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
2541823d-c3fa-4cd3-9294-4cd83957dd66	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	phone	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
3d2e9ceb-fcd5-4ef2-8769-ddc5a70c81bc	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	phone	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
8ef03670-fe68-4860-b173-97967844058f	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	person_key	t	t	2026-01-28 22:00:48.90728+00	2026-01-29 17:12:25.79148+00
9fe7866f-0421-4309-b1e9-494b92f8d0f4	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	base_salary	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
370794ad-85ce-4961-a3b3-d262046771ca	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	base_salary	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
3adaa8db-1bc6-427f-80bc-b4128e28c378	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	base_salary	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
957a3745-ce3a-4a84-9a47-d4f4fdb2dbc9	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	base_salary	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
faa271eb-a89e-4f9f-8542-c793233c0dd1	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	base_salary	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
e9e588d5-8d91-463d-9d31-28dcaacd8782	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	updated_at	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
369f3ce7-1dfe-4334-94af-563dd2530c3c	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	entry_date	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
df7c450d-b775-4718-9094-3ab85fde4bef	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	entry_date	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
2440b3c3-292a-45f7-bdd5-f25a07d95743	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	entry_date	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
91dd64ea-19c7-48ee-a4ee-82a6b61ac57f	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	entry_date	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
a1fd6a6e-ff30-469b-a0b2-03f19e2acb68	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	entry_date	t	t	2026-01-28 21:10:07.688335+00	2026-01-28 21:10:07.688335+00
c1df2cac-dfc2-4134-be02-c4adf33335da	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	updated_at	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
c64e8449-6842-4244-8004-eeecc358d367	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	person_type	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0b39f00f-2651-425a-8190-a3d00b70643f	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	person_type	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a7bf3502-d3f9-4329-b089-1bc97062731a	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	person_type	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
41ddf4db-a622-4f31-931d-759793a4a62b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	person_type	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0efd5adc-9269-4176-825b-02d8e74c111a	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	person_type	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
f0ae9200-f033-41c3-9c86-e7deaef0f28b	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	updated_at	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 16:01:04.069981+00
3ba10960-b9aa-40d8-b7ca-c30040e0b0af	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	employee_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a6f05b16-f10d-4726-920f-5e8114cdf080	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	employee_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0ce82955-c8ad-4f07-a541-1247e9384848	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	employee_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
c63d7f97-8b09-41f6-ab1f-a1e3ca8fefba	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	employee_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
47dbbcde-ce3d-4317-bd65-b02f3afd4157	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	employee_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0a99db99-b59f-4fed-b8aa-15de12244ca6	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	employee_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0312f0b6-74e3-4778-84f7-701a35ac3a77	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	employee_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
71b698bf-63f0-4783-ad48-d9d8c7166eb9	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	employee_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
c0251730-28d2-48cc-ae38-15e017ee6380	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	employee_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
e1338414-ec02-4e71-b318-db7f913c0779	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	employee_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
ffaf1be8-454a-48ed-973e-d8282fd864f1	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	updated_at	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 22:50:43.936293+00
befb6601-8a33-41fd-8487-d35fc94683dc	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	temp_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
2b085c71-d0bd-422e-9bfe-fc32f63b6f59	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	temp_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
278715c8-2f9e-4103-84d6-ed2e40049dba	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	temp_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
9cd95e13-8596-424b-92fe-7f187357f7a5	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	temp_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
c91f1031-3172-413f-b4d4-8d9245756140	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	temp_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
d1c37ccf-8720-408e-9c78-22a8867e8b39	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	temp_phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
292d638b-99ff-4917-8049-ac734544452d	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	temp_phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
116c19f9-a91e-4304-87f5-44d2729eedc2	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	temp_phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
dd143cbe-0ecb-4b20-90e1-7f726c6265ea	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	temp_phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
48ca3512-aa67-4d9b-bd67-bcbe1618911b	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	temp_phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
dae73352-06cc-4871-a766-b6ab0dd79edf	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	dept_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a9840446-2257-48a9-9184-07aef990f6c2	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	dept_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
3da2139c-611d-4010-89ac-4615e2acab26	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	dept_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
d7c6c2d2-7dc6-4642-b431-cc9a07b50a15	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	dept_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
ed9cbe91-1819-44f5-a425-b0a189af14c2	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	dept_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0dfda35c-5f74-4c9e-93a7-07b0e3bcb97d	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	dept_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
10b74336-2e2b-496c-a8ab-c7f16f06d42a	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	dept_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
c929dd0b-b3a6-4ec6-aa6b-5f25c333fb9d	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	dept_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
48fc4d5d-5bf7-47ba-b5d5-d06de5651744	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	dept_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
383c9bd9-1f8f-4310-8fef-0ac7a65064b7	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	dept_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
efbf0fbf-3bf6-477e-8062-d53b031dd0ef	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	shift_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
30d9e271-f194-4e48-ad28-f457f5f41281	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	shift_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
4a2c145d-cf23-4226-a6db-1fbb25f2e182	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	shift_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
304cec56-e0a6-4bda-99e2-069221087f79	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	shift_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
acf101ca-92f7-4497-955b-d31c80ed718e	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	shift_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
7310a6bd-182d-44e2-aea0-23e4a5376c08	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	native_place	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
e45f1535-1535-4854-bbaf-45361f417b59	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	shift_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
88a070a2-0997-49ce-926b-df579ce605d7	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	shift_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
af0e9945-5408-4bda-bee0-9482e8c361e3	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	shift_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
6a4859de-808e-4da1-a19b-bc54c4ff2b0c	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	shift_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
9221aead-9abb-41ac-9499-74f5ba29abee	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	shift_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
2b0fdb60-d44c-497e-bd77-4429e26f57a7	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	native_place	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
faec2641-4596-43c4-8f45-41113e5d49a4	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	shift_start_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0437b4b4-7e84-42e4-83ae-d6992e382d45	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	shift_start_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
9bf3d1e7-cf8c-49b8-b75d-4187cb8012b9	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	shift_start_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
3a27c596-8b3d-4197-9cac-5b26cf11b9e2	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	shift_start_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
f685c2ea-f0c1-43a9-83c7-26a367ce50b1	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	shift_start_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
31d5e32d-ffb5-4443-9f9b-d38c1bbb5d18	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	native_place	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
41ed2a9e-54e1-4a73-8daf-f840dc1e2efa	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	shift_end_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a790d023-0bb7-44e5-84f2-e3cd6dc088cb	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	shift_end_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
c103342c-d3f0-4eb4-b27a-6461d76f43d5	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	shift_end_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0af3dac4-0595-4c8e-8a36-c6be2f443121	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	shift_end_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
1d54e3bb-aae6-47f4-8428-bc47dae6a27f	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	shift_end_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
4b99ec2b-ead8-4f0c-9f75-701b5813421a	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	native_place	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
2547f767-9c6f-4445-9538-a8c224b505d7	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	shift_cross_day	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
d016c0fc-4510-4cc4-965d-d3e7657e7c9b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	shift_cross_day	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
60d87ea4-e838-417a-95fc-b16ee0a9440e	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	shift_cross_day	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
61631817-c4c0-40a4-8cc5-d857c1f4fde8	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	shift_cross_day	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
6b3d8b10-45a7-441f-88b8-86363f04a365	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	shift_cross_day	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
b4d60896-b17a-42c6-812a-961a6f943e0b	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	native_place	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
fe4651d2-2af6-4524-9c48-ecc0d9037233	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	late_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
6601704a-bc18-4a67-a358-d314a92041e7	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	late_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
944ad726-cf2c-4d2a-a3ce-828f00290bde	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	late_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
64dd58d8-64b2-4587-aa2e-7a5950fcb844	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	late_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a151df24-cd13-41b9-9ba7-997ca0a04995	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	late_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
02ab200c-74fc-49c7-aea5-db594286ba10	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	native_place	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
c10b2731-e124-4bf9-bde7-d696a9d500df	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	early_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
6bcc2f7d-bbd4-4515-a903-6c510491d83f	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	early_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
30efae71-5d42-4289-be23-ff71ef1431d2	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	early_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
13e82ced-432b-4762-b659-f20ffcb57959	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	early_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
1abddc4f-3314-4962-96dc-cf708763a957	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	early_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
b0bb5762-019c-406c-afcb-0f29637d73c8	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	performance	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
a5924644-1ff1-4afb-baad-abea0c6c8143	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	ot_break_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
7d394ea5-a40c-4874-9415-74ca1c4e6b6b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	ot_break_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0d040922-66f9-45d4-a5e6-c4641b9ddcc7	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	ot_break_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
5861f0d3-afb0-4b36-8503-15579961fdf5	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	ot_break_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
e9ca7a2d-1674-45af-82fc-3d0cd0e5de1c	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	ot_break_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
09c7955d-64a3-4566-a18b-c97799fc3f99	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	performance	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
d14565f7-d17d-47bb-82b4-e2f3dbc67dfe	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	punch_times	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
e0a12a70-1097-4ff4-97c1-7a0143767c16	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	punch_times	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
dd9f1417-0ccb-42c6-8255-e9312fde83dc	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	punch_times	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
912ebe3c-aca6-433f-aea5-4133698b9cec	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	punch_times	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
79da81e6-7af2-470a-8f2a-8daea3933047	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	punch_times	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
5dbe591b-29a4-4fd7-817e-9574a6ea25ef	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	performance	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
1cf951a8-43ad-4145-852f-efbb2d3b5d8d	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	late_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a10d8872-15f8-49ed-bafd-1805a6895cbf	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	late_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
09f5ef3e-f4be-4184-85ef-9f5a9336028a	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	late_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
9835b106-3bd4-4508-8b22-46de28ad2928	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	late_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
be68b7fe-13d5-4853-acca-53cde1256587	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	late_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
78e49441-d6ee-432b-96c2-bf7052e0d256	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	performance	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
fad365e1-6a48-4a5b-9123-b75be0e51636	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	early_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0af87bce-bbc0-4f5e-9efc-6e10b13f9a5c	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	early_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
cc57eb10-65f3-4cb1-abce-36074d5b77b6	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	early_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
08086b5e-7ea4-4e1d-9ef6-0b2d362bf098	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	early_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
304f2d0d-8451-4ba8-b8e6-565339d825cf	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	early_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
8d670b00-6b60-45df-8308-d7c3989bacc5	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	performance	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
7f43bba4-fb6a-4e9d-afc9-33ffd94a1c7b	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	leave_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a3e59d5e-fc02-42dd-80f8-35340654650b	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	leave_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
29321d67-1869-46f0-a2be-3da716c4cf8c	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	leave_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
eba03979-eb33-4bd6-9c0a-42d1aaff9062	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	leave_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
2095c285-21fc-436a-8c3e-0548d76b7fe2	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	leave_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
f357f377-201a-47bf-944c-12f19fd1133f	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	performance	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
7de5d8be-aa8b-4fc7-bb4e-fb743c4f75e3	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	absent_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
db556dcb-3655-463c-88ef-4bb95950770c	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	absent_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
9a9cf7bb-cb45-4240-bcaa-a5598de51b8c	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	absent_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
73b44aa0-af7e-4d0f-88d8-99a1233f9881	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	absent_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
e0c3a0b6-f92d-4412-a2ef-e1c86f52cedf	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	absent_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
bd01d654-66c1-4f48-94d6-556bc4279674	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
644553ef-d137-47ef-ad3d-0bece593369d	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	overtime_minutes	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
c02c4e80-b1e8-4a58-afbb-2d282e392535	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	overtime_minutes	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
d141bb97-fa23-427d-a5c0-85c6a2c0a4af	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	overtime_minutes	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
97c4c3d1-aea5-4da0-8471-421534e7f11b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	overtime_minutes	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
363d24b1-bdf8-46cf-8c21-564e3519bd3e	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	overtime_minutes	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
fc9f73bb-3613-4fb8-b6a2-8130683090af	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
157b69cd-e7c0-42b7-a8a0-928ee83972c7	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	remark	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
db187e9c-97f2-49f9-9f60-ef7599e1ffa6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	remark	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
e5bea215-f4ea-4eb1-ab17-e9955a63b37f	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	remark	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
2ca5cc4e-b8fb-4438-9c4a-d35113fd3643	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	remark	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
97a324dc-eb83-46f9-9df5-29858cc72585	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	remark	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
64455f36-60c9-4e36-a16d-5f9219d5a5b6	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	total_salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
988af640-dba1-4f82-bd5f-853dc506c4dc	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	created_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
cbeeae2a-4123-4a5f-8059-1ded163c54ef	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	created_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
09c125e5-5fa9-400e-bccb-a26b81f0f695	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	created_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
5dbd06cc-1b55-4eec-922e-65f9211a699a	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	created_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
5876fb8f-2691-4d64-bed1-d7eafc62a541	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	created_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
8b0b6340-af8e-404e-8e42-d0dc5d4a45c8	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	total_salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
4974a0ad-b5b3-46cd-9e99-382fc4b35957	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	updated_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
8b627e7f-4d7a-447d-bf6b-761e47c60144	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	updated_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
2a49f804-8b55-4f67-8eb9-d1e2ae3b8b76	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	updated_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
7cbd2b32-feab-43f3-895c-fbfbca4ee920	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	updated_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
bc5482be-4c1d-4295-b094-22b9724d2b0b	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	updated_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
37e822f7-6859-4c11-bf1a-9e2098375638	dab1f261-b0ef-4050-82d4-251514f9041b	hr_employee	total_salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
6e39b252-4c15-4a4a-aa87-6af9eaedae50	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	position	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
30a66aa2-b922-49c9-8e37-48ba5fa128a2	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	position	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
33a4fa62-128d-40ea-abf9-b3a1fb5e7119	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	position	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
df5cb384-f401-477e-9446-2d3c964ff12b	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	position	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
d564cc26-9ec0-4f08-9c7d-e24eed1047bb	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	position	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
f324db91-f726-412f-83e8-9529852ac930	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_employee	total_salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
1b55e1fb-9cab-4013-afb6-9cb666770e96	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a87830e0-2b66-4f97-bd6c-6e2fb0247f13	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
fc0ba110-9999-4ba2-9550-eeb77b5b6ba7	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
82eb8ab2-1a88-4668-a30b-8ce4b1751f46	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
6e74df1d-ff45-4f10-b938-f847d0aba3fe	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
f4c4815e-c7b2-48ad-a537-61f810e6c69f	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_employee	total_salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
e3e7b57b-0313-4a87-b459-43e7f8e07565	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	base_salary	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
64255522-98b2-43e1-a41f-48fc8655ab26	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	base_salary	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
cfdadae1-d1d8-4953-9296-96bcb38ddba0	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	base_salary	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
e3b89f46-13a7-4c04-9723-5c8ad79bde66	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	base_salary	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
10a1409d-bc82-477d-a75c-0f53e8b72726	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	base_salary	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
0084610c-bec9-4474-8219-3e326c98518b	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	total_salary	t	t	2026-01-31 19:31:40.879556+00	2026-01-31 19:31:40.879556+00
db9322de-1995-4f15-860c-a501ff3d8426	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_change	entry_date	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
48ddaa5f-9376-429d-bdfa-d0692d1cbfe7	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_change	entry_date	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
a68136e0-5f85-4ae5-812c-254fef65910e	dab1f261-b0ef-4050-82d4-251514f9041b	hr_change	entry_date	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
552d2b9c-6d3b-4f7a-96bd-3b87c4c23857	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_change	entry_date	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
d20f8500-76ec-4128-b20a-6ef65089e2e3	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_change	entry_date	t	t	2026-01-28 21:18:50.550529+00	2026-01-28 21:18:50.550529+00
d47636dd-924d-480d-a8e8-a0afbdaaf76c	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	att_month	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
59815391-5f90-47be-be64-dc729672e4e9	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	att_month	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
a6652267-41ec-4473-b10f-a2479e76ba6a	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	att_month	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
32fa0daa-0cea-4745-8bd9-cd26ec69b390	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	att_month	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
c2a3b40b-9887-4e93-a03a-4518b9363d4b	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	att_month	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
3236c834-f103-4ce9-8d43-f17266d1fb28	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	person_key	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
fa81adbb-a898-4a35-974e-5fb8686c809e	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	person_key	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
4e9fca75-3fba-4ed6-91ce-b1e03f5976fa	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	person_key	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
e924b945-9d41-4972-82bf-5172a2907432	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	person_key	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
a37fca85-f457-4b84-b2ba-8bb511fd1074	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	person_key	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
f81f662f-223a-4fe0-8dd2-7dedc2015493	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	total_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
9c81288e-e679-4790-afb2-b446f4dfff4e	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	total_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
ecb1c9cd-43c0-4ea2-8174-5e64dd917345	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	total_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
f6eb37b3-9852-4c14-adf2-34ab349c3776	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	total_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
23783a11-006b-4ed7-8ba9-e76c42e7fed9	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	total_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
f0233b61-8c0c-4aa3-a822-64818aed84a9	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	late_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
6f5b0115-6176-4d51-8a1c-cb3844ca2aed	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	late_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
b16fd5c4-f15b-4966-89eb-b6d10ebc745a	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	late_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
4a8d8907-bd73-4fe3-a25f-1e7c05fdbb72	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	late_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
3b5ddd63-93c3-4d20-8655-73c6ea90c1fc	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	late_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
334920e0-9322-4816-ae8c-01e46980a5c6	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	early_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
9f74ac38-f849-490f-b05e-5378b4b25ead	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	early_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
e42f4512-0e8f-4b84-b8da-3f51d2d192ac	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	early_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
c75348c1-962b-457d-8af0-87396340d805	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	early_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
c515c1d5-3648-40e9-8ebd-11e58dd84271	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	early_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
3111da8f-124c-4e0a-9a5a-4c274621fdfe	acf335a2-f56f-4aca-bb4d-682553c8e5ec	mms_ledger	dept_id	t	t	2026-01-31 20:48:14.30396+00	2026-01-31 20:48:14.30396+00
d98501a9-478a-4abc-8493-8c887084da99	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	leave_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
6620489e-4c59-4948-a84d-954eec29d95d	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	leave_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
9dab9f4c-7dbf-472c-95ea-87783222bfd4	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	leave_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
36f776fb-77e2-4b72-a256-40a302a292e8	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	leave_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
1b25401f-5619-478b-b360-18b0fe6b824c	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	leave_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
468534e9-eb38-4458-9bbe-0bd50163d80d	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	mms_ledger	dept_id	t	t	2026-01-31 20:48:14.30396+00	2026-01-31 20:48:14.30396+00
3d22f12e-449f-4d9d-ba6c-c649c86c5343	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_attendance	absent_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
253fb997-1b0f-4c57-ac10-17569413ad1a	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_attendance	absent_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
7bba1f8d-279a-4876-b93c-d5ca8b85640c	dab1f261-b0ef-4050-82d4-251514f9041b	hr_attendance	absent_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
8ebb6fae-ea73-4a6c-8cbf-ae5e6a3e6c94	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_attendance	absent_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
58484492-25b0-4e23-9fc8-86070a9cb102	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_attendance	absent_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-28 22:00:48.90728+00
89c7bfba-5815-4c43-a46a-4686db01c88b	dab1f261-b0ef-4050-82d4-251514f9041b	mms_ledger	dept_id	t	t	2026-01-31 20:48:14.30396+00	2026-01-31 20:48:14.30396+00
0b7abbed-6ddb-4213-ade3-fed8068fd299	e1ba01bc-955c-4d41-9ed8-35dfd8644320	mms_ledger	dept_id	t	t	2026-01-31 20:48:14.30396+00	2026-01-31 20:48:14.30396+00
a2835376-16ce-4bcc-beb6-a9be88d571a5	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	mms_ledger	dept_id	t	t	2026-01-31 20:48:14.30396+00	2026-01-31 20:48:14.30396+00
134b09d9-06d0-4720-9324-182e5956a04c	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	dept_id	t	t	2026-01-31 20:48:14.30396+00	2026-01-31 22:50:43.936293+00
9bf011df-ec72-42bf-bc63-c0ebe081e1db	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	username	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
1ef6ef4b-e35e-413a-8e76-91f83e90eced	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	username	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
e9862047-0e27-4b88-9b61-e23eb63ff98c	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	username	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
75d27137-be5c-487d-9d9c-d2d02e3732ee	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	username	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
93f6181f-6701-46df-b70a-7cfb864b04ba	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	username	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
e3087345-6e33-447e-a3e8-1465e16c9ccf	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	full_name	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
47d3bc69-9385-406c-b56b-93e757e1f0e8	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	full_name	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
f5f8715d-3324-4e7b-b729-0f1b72ef63e4	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	full_name	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
72336b36-b5dc-4789-8a5e-4c5e23b92a14	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	full_name	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
e655fb15-2b82-4a1e-9c81-9ffc63c87b2d	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	full_name	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
7f0950b0-672c-4729-ab28-a6c8a565783e	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	phone	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
6f67bbdb-e357-433a-94f9-c782a617704e	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	phone	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
41d92cf4-5752-49d3-802f-a85e59d312d8	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	phone	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
3bc057aa-fdc2-4a42-88b8-63784b54cdd6	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	phone	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
355a32b2-e431-4c1b-8467-32e78207d363	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	phone	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
5fd478e6-9bd7-4dea-8802-778c814ff897	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	email	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
c3249469-c523-4218-b78c-a12365968392	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	email	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
61022783-f4d4-4f18-9036-6c022ca7b008	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	email	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
c636046e-5b57-495e-8852-81a81443cb8e	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	email	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
513bdfa2-794f-4ba4-8670-26d424e885e5	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	email	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
3a9fb52a-391d-4212-9712-94c30bffe04f	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	role_id	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
85f937e9-6150-40a0-8f0b-bbf78cfb7a58	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	role_id	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
4caf51b9-2eff-4455-b8f3-62d98ce80f68	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	role_id	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
65978dff-0de5-441f-a9b3-b217860ec6e9	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	role_id	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
968979ea-0ef9-41e9-b360-70a8b6273455	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	role_id	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
5ce7eb6f-5b51-46d0-b9e0-af9b4f81a91e	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	status	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
2fd2bd0c-91fb-4164-b0bd-587189c1b829	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	status	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
f9c6fe5d-f9dd-4a0e-947a-61335bf7cd9d	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	status	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
5e57ca4b-b312-43fc-ae70-6303277a9561	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	status	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
fa966880-a754-4bd5-9080-930ae4291281	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	status	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 14:45:18.835105+00
fd1d3773-ae04-46f6-951d-95de9353e959	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	id	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
8185caf9-505c-43ab-a8ba-650e85f4d320	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	dept_id	t	t	2026-01-31 21:50:30.741185+00	2026-01-31 21:50:30.741185+00
057ce5b3-16ed-4ae3-aca2-039dc4fb54ad	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	dept_id	t	t	2026-01-31 21:50:30.741185+00	2026-01-31 21:50:30.741185+00
9b4bf855-632a-4248-9e89-fec30449af64	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	dept_id	t	t	2026-01-31 21:50:30.741185+00	2026-01-31 21:50:30.741185+00
0d4ece99-d6d5-47f7-977f-0ebcec9dc727	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	dept_id	t	t	2026-01-31 21:50:30.741185+00	2026-01-31 21:50:30.741185+00
732a2c10-93c5-4c9e-85b6-5f7839e23c88	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	dept_id	t	t	2026-01-31 21:50:30.741185+00	2026-01-31 21:50:30.741185+00
840bbe26-75e1-4205-8810-6a8b4e26f9c3	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	dept_id	t	t	2026-01-31 21:50:30.741185+00	2026-01-31 21:50:30.741185+00
3b17ce9f-793a-452e-bec9-3c87a48abf43	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	spec	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
bc97ea79-a57f-4ef8-9228-0fad8f8e0775	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	category	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
f16f2900-12fe-4f09-bba9-3de16f8bb5bc	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	weight_kg	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
4a860e18-f14a-4e98-815f-cb258dc056a0	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	entry_date	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
ad44829f-16a6-44fa-a8af-f9691e2fa42e	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	created_by	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
e39907c8-f983-43b9-92f8-470c54df2997	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	conversion	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
c7cd2207-0ccc-41f0-a7f8-9212aee0f090	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	finance_attribute	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
2b842b28-263b-46ef-9543-d01d2803971c	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	measure_unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
67498c13-5e54-4632-91e5-4c1b7942d79b	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	unit	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
9ccb879b-4d22-4790-99a4-4799e023da15	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
ba1b05d9-ace7-4885-ba9e-b2caeeaab034	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-31 22:50:43.936293+00
b344a3cf-5519-48bc-ba5c-2ac713f07797	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	batch_no	t	f	2026-01-28 21:07:34.873684+00	2026-01-31 22:51:56.040964+00
07bf7656-091f-4f18-b962-70589539cc60	e0d14028-ec80-4c81-aa95-24fe79a1ad05	mms_ledger	properties	t	t	2026-01-31 16:01:04.069981+00	2026-01-31 22:50:43.936293+00
3c0909ec-2689-459d-8c01-1f4c81815fd9	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	id_card	t	t	2026-01-28 16:50:30.572916+00	2026-01-29 19:21:40.209268+00
c598dabd-8776-41e1-b06e-9fbe5dcde2ac	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	salary	f	f	2026-01-28 16:50:30.572916+00	2026-01-29 20:00:41.532583+00
c73fd9d3-52ef-439c-bdf5-4ea539b48811	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	created_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
dfbca679-f721-4f49-9ad3-893fd5ac4af2	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	att_note	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
7913c2a3-1246-4024-8b36-9aa7b6875713	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	created_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
57deda61-955b-4c91-9c76-e009a1c54a41	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	early_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-29 17:12:25.79148+00
7862c2cc-97d5-4d97-ae19-1755c672f5ba	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	leave_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-29 17:12:25.79148+00
c8a0c04b-1b0a-4ce9-8345-44fb3ea260a8	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	check_in	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
a949c05d-9592-493a-beb2-c5fad496d84a	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	check_out	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
b5441e5e-fc7c-4f0b-a04f-0b152f46b5fc	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	shift_end_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
bad791aa-bf17-4a7a-9ff4-061fa0014bfe	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	ot_hours	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
6935ae09-fa32-4666-b2c9-67ad112e7040	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	early_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
ba5a9e81-351b-4052-b405-1a5cafa81e0a	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	leave_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
d7cf3698-2f91-4d04-8418-a676310b1f6c	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	created_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
c260c289-ccfa-47b1-b02e-c08eff583569	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	created_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
af714adc-89d5-4be4-927b-c539488c7802	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	created_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
3d52fa84-14a9-455b-a19b-2e635335ebaf	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	created_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
32e17833-201e-4933-b57b-1a2a6704058d	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	created_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
f4b17519-7dfe-4267-8664-4536f9e126de	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
983f1bf3-fafd-48de-a433-54835182421d	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
04171393-2d7f-4622-9e49-221c864b8975	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
4ee33085-a9b6-45c4-8864-86af9429a279	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
c6d5bf1a-86ca-4dde-86ae-5393148125af	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
390616b3-f01a-434c-9340-a41ec49fde6f	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
ea2f7422-7c09-473a-b7e6-baad0ac87ad6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	permissions	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
f2409ec2-91d5-48d2-b3aa-6ff9c7164725	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	permissions	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
06ee349f-bf22-45c6-87a2-727aca624dbf	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	permissions	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
bdbbae68-8cdc-4ba1-a542-e6d3ab5e65c0	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	permissions	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
339a91d4-ad3f-470e-8b07-ded4d7559898	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	permissions	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
a7a8575d-2c40-4cd3-af32-a24cf7c0e680	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	permissions	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
bc98cc51-0d13-481c-b3ca-9865e6473fae	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	position_id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
56ba477f-ed4a-439b-b006-43152c7ac2e8	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	position_id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
81c0f664-3641-49d0-a3db-c1463a9240a6	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	position_id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
921b7e06-7f33-4d85-bb16-50019bbacce5	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	position_id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
593a49c6-b80b-4d7d-bbe9-56163db4e6ea	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	position_id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
5d943413-4825-499c-b868-d05021504b39	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	position_id	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
6c9d9826-5096-4012-8768-7b28d22007e7	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	role	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
85f7dd45-be2d-4974-8e66-a2d4270ef0d5	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	role	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
4e27b19f-b10b-4f86-9043-a1ce3bfe1505	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	role	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
55fca97c-e4ae-4efb-bd8a-b37cf21612fc	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	role	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
1e0f5e62-f7e3-4470-a15f-9c8053b9281e	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	role	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
8a0eb041-bec7-4d1c-9742-8f8b224a52b6	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	role	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
e24b8985-c548-4d7c-86e6-0a40910c22c6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_user	updated_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
596933de-d831-493a-8e3e-e98bcfbdd35b	dab1f261-b0ef-4050-82d4-251514f9041b	hr_user	updated_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
fc147532-a651-4022-abab-cd6b0b0242f9	e1ba01bc-955c-4d41-9ed8-35dfd8644320	hr_user	updated_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
fbca62ce-79aa-4450-8326-eca07d4f9bdf	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	hr_user	updated_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
4e407b5a-8816-430d-9b71-59133d72a181	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_user	updated_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
9939b7e9-650f-4be1-9a30-7097f7162ec8	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	updated_at	t	t	2026-01-31 22:51:43.578607+00	2026-01-31 22:51:43.578607+00
4d46ce11-6933-489f-8a23-17d2990dc5cf	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	department	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:24.074486+00
097353dd-9253-4637-90fa-55bec21f2f47	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	entry_date	t	t	2026-01-28 21:10:07.688335+00	2026-01-29 19:21:25.795433+00
f49d024d-e703-4b4a-a136-fc4595dd4dde	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_1340	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:26.869354+00
d424599c-bd9e-467a-9ef4-387a61c79a97	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	phone	t	t	2026-01-28 21:10:07.688335+00	2026-01-29 19:21:42.153599+00
d12eefe4-a6c3-4b84-b716-89367091448d	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	position	t	t	2026-01-28 21:10:07.688335+00	2026-01-29 19:21:43.792743+00
283528e0-af00-454a-80e9-7b21e08a91bc	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	status	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:45.772861+00
f59f5d90-a3b6-4011-a61c-958b2212d747	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	name	t	f	2026-01-28 20:59:08.678182+00	2026-01-29 19:47:44.911971+00
c8d8d03e-b5c8-4ebc-985f-de34cfa978a1	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	base_salary	f	f	2026-01-28 21:10:07.688335+00	2026-01-29 19:59:46.797853+00
32bc74d2-14a0-4ffe-a5c9-710f64ba3fe9	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_9314	f	f	2026-01-28 20:59:08.678182+00	2026-01-29 20:00:45.841339+00
739bc18d-882c-417a-9589-4187da091440	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_789	f	f	2026-01-28 20:59:08.678182+00	2026-01-29 20:02:47.254092+00
558a6f48-aec6-41ea-985b-fefee8df85d1	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	employee_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
5918c3dd-0605-49a6-9a56-7ccd97305c49	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	temp_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
04e03acc-7de2-487d-882f-7f8651ff296e	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	dept_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
ce259dc0-3d3f-41fd-ac7a-9ff062cad39b	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	shift_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
e5bbc510-462f-4630-869c-63915561536e	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	shift_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
4b5676b7-a69f-496b-9817-ee7c82f08314	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	shift_start_time	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
2fc435a7-c1c5-48d4-951a-cbfc8ba8504a	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	att_status	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
1b9981a2-ff39-418a-87e1-87ed33474958	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	punch_times	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
80ba6b34-4f88-4ff2-9818-f63be91357ba	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	late_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
4d33da46-748d-4a86-a15d-cd6adf0fb65b	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	person_type	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
10413a39-950c-40a9-9b97-9b6d04f02e0d	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	employee_id	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
c88ce757-775f-497c-8c8f-cefca5808296	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	early_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
fb0a6e88-0c70-4ea0-aa05-be6c347981aa	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	ot_break_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
89e966a6-2654-4aa9-b7a4-1f997463f091	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	id	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
4ed5d405-308f-4ed3-abcc-c7b9dfef5cbe	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	overtime_minutes	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
66ed3dcc-fdbb-4e39-8970-d155106b2066	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	name	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
29d6debd-150a-4548-b89e-d310a971814e	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	employee_no	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:24.722673+00
6c8a89cb-73b1-4de4-bb85-4440c29b0169	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_2086	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:27.539201+00
75cf991a-8c3d-40ea-99ea-03e51e7203f3	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_3410	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:28.246322+00
b3e34ca3-eb6f-4ee8-a648-bbe1eddabe75	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_3727	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:30.042864+00
c57761e5-5d0f-4579-b099-6a8f3bd11bcf	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_3986	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:30.761806+00
da0a4159-625e-4c47-963c-25d879307dd1	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_7980	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:34.008389+00
6fa8c960-08a9-40b0-aa64-b5ca9e49349d	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	field_8633	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:37.083498+00
4b4ea2cd-68e8-4a0a-8309-2de91c1ceaef	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	gender	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:38.999416+00
2cb2e917-1995-4c6e-b66c-ee079740b0e6	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	id	t	t	2026-01-28 20:59:08.678182+00	2026-01-29 19:21:39.622025+00
f53b4a09-c12b-4743-86b2-6b2b467c2b48	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	full_name	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 17:12:20.917855+00
650f1f4f-dbfd-4f45-b81a-13fb2535f9a4	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	email	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 17:12:20.917855+00
2aeb3fbf-c40d-4253-8bec-b63f38969693	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	temp_phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
b25354fc-1ed4-4dc2-a771-7d97efb616a7	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	updated_at	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
556a0fff-a7ac-4251-916d-291f631fbcd4	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	late_grace_min	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
38a824ba-b35f-40ed-893f-3f3d28ece0f1	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	absent_flag	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
4b3d1e28-1459-4af3-8835-cee3b7b61806	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	remark	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
0a6e0328-4391-4c6d-acef-c308c0131b2d	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	shift_cross_day	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
a953c56c-d977-4067-8deb-7a3befaa977a	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	absent_days	t	t	2026-01-28 22:00:48.90728+00	2026-01-29 17:12:25.79148+00
60e23230-5e8c-4dfa-b600-5cf73db1b938	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	dept_name	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:25.79148+00
278f820d-2757-47dc-8d30-3c0b9d70f55c	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	phone	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 17:12:20.917855+00
20a99352-8c12-4498-9471-5a1c6db3a36a	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	username	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 17:12:20.917855+00
3345e611-0045-42a4-b934-6e409463e494	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	role_id	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 17:12:20.917855+00
b4028219-a636-4a86-aaf3-fb18ac71cc68	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_user	status	t	t	2026-01-29 14:45:18.835105+00	2026-01-29 17:12:20.917855+00
82a95a25-1fe7-4979-b1a3-65df8168ef0d	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	employee_no	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
847b5c86-8294-452b-ba9d-3e88ceaebd1b	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	department	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
1baf9495-822a-45a9-be3f-7704ce9255c3	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	status	t	t	2026-01-28 21:07:34.873684+00	2026-01-29 17:12:25.79148+00
2ce5c900-8744-47e6-ab1c-988a0ee3ace0	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_attendance	att_month	t	t	2026-01-28 22:00:48.90728+00	2026-01-29 17:12:25.79148+00
b295ebd6-ec73-48ef-be45-671facd106da	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	phone	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:26.570929+00
616907f8-d8a4-4f9b-b13a-19e2556f957c	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	base_salary	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:26.570929+00
476a3565-28d1-4eb3-b208-3805ec878346	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	entry_date	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:26.570929+00
5b91250b-46bc-43eb-859a-cb8e3f9cfa9b	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	transfer_type	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
28cac2c4-74d1-4aa5-9bb4-8509f7cd1ec8	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	transfer_reason	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
09fb1810-d44b-44d2-a8e5-43b39ea00a30	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	to_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
dc160a1a-bc5b-44a5-9369-0d002c2bd8f4	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	to_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
f62e98ec-1b03-427c-a52c-5c8fe7e95fa0	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	effective_date	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
919c7e6f-652e-4b67-beb0-f6c19c6b1596	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	department	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
1f2247ac-5a29-4e5c-b4c2-3e7e48e3a8d0	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	status	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
3ea3f3d8-efba-487b-8726-00b6b4d740eb	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	from_dept	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
c3054b66-2f0b-4e00-b03d-c4d28dacd231	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	from_position	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
c1cec663-d337-4742-827e-628788712ff5	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	approver	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
f83ae997-38dd-4b46-a1a6-ed6bec32f16b	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	position	t	t	2026-01-28 21:18:50.550529+00	2026-01-29 17:12:26.570929+00
5a35cee9-0d41-4841-a71d-7f60326f4cde	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	name	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
2a48df5a-e062-47a1-879c-57534c3d1c97	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_change	employee_no	t	t	2026-01-28 20:59:05.725584+00	2026-01-29 17:12:26.570929+00
\.


--
-- Data for Name: sys_grid_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_grid_configs (view_id, summary_config, updated_by, updated_at) FROM stdin;
employee_list	{"label": "合计", "rules": {"id": "count", "name": "none"}, "cell_labels": {"id": "员工人数"}, "expressions": {}, "column_locks": {}}	admin	2025-12-25 18:44:29.890141+00
attendance_day	{"label": "合计", "rules": {}, "cell_labels": {}, "expressions": {}, "column_locks": {}}	Admin	2026-01-16 22:31:15.107929+00
hr_acl_fields	{"label": "合计", "rules": {"role_id": "count", "can_view": "none"}, "cell_labels": {}, "expressions": {}, "column_locks": {}}	Admin	2026-01-28 21:43:19.025169+00
\.


--
-- Data for Name: system_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_configs (key, value, description) FROM stdin;
hr_column_locks	{}	HR表格列锁配置
hr_transfer_cols	[{"prop": "from_dept", "type": "text", "label": "原部门"}, {"prop": "to_dept", "type": "text", "label": "新部门"}, {"prop": "from_position", "type": "text", "label": "原岗位"}, {"prop": "to_position", "type": "text", "label": "新岗位"}, {"prop": "effective_date", "type": "text", "label": "生效日期"}, {"prop": "transfer_type", "type": "select", "label": "调岗类型", "options": [{"label": "平调", "value": "平调"}, {"label": "晋升", "value": "晋升"}, {"label": "降级", "value": "降级"}]}, {"prop": "transfer_reason", "type": "text", "label": "调岗原因"}, {"prop": "approver", "type": "text", "label": "审批人"}]	\N
ai_glm_config	{"model": "glm-4.6v", "api_key": "01e666998e24458e960cfc51fd7a1ff2.a67QjUwrs2433Wk2", "api_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions", "provider": "zhipu", "thinking": {"type": "enabled"}}	智谱 AI GLM-4.6V 模型配置
hr_org_layout	[{"x": 850, "y": 60, "id": "b0aa5f36-a392-4a79-a908-e84c3aac1112"}, {"x": 80, "y": 200, "id": "15e61e02-6ef3-41a0-b858-21e1618f9632"}, {"x": 300, "y": 200, "id": "8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64"}, {"x": 850, "y": 200, "id": "821bae9d-d4d6-4f79-a2df-986400aaada3"}, {"x": 520, "y": 340, "id": "8c7d6883-4921-4ef4-ba45-8033103563e2"}, {"x": 740, "y": 340, "id": "d26a3a93-e81d-4cc0-998f-d014edee55f4"}, {"x": 960, "y": 340, "id": "529af27e-6cfb-4dcf-be03-efe17c5bb285"}, {"x": 1180, "y": 340, "id": "3ee73ef4-5352-4806-bfc5-002f2ac68564"}, {"x": 1400, "y": 200, "id": "f1b437fa-a799-4866-9478-50e15b961e93"}, {"x": 1620, "y": 200, "id": "427becfd-2d82-48d6-8171-195c7acaad53"}]	\N
hr_attendance_cols	[{"prop": "att_date", "type": "text", "label": "日期"}, {"prop": "check_in", "type": "text", "label": "签到时间"}, {"prop": "check_out", "type": "text", "label": "签退时间"}, {"prop": "att_status", "type": "select", "label": "考勤状态", "options": [{"label": "正常", "value": "正常"}, {"label": "迟到", "value": "迟到"}, {"label": "早退", "value": "早退"}, {"label": "缺勤", "value": "缺勤"}, {"label": "请假", "value": "请假"}]}, {"prop": "ot_hours", "type": "text", "label": "加班时长"}, {"prop": "att_note", "type": "text", "label": "备注"}]	\N
form_templates	[{"id": "transfer_record", "name": "调岗记录单", "schema": {"docNo": "employee_no", "title": "调岗记录单", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "widget": "input", "editable": false}, {"field": "name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号", "widget": "input", "editable": false}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "status", "label": "状态", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "调岗信息", "children": [{"field": "from_dept", "label": "原部门", "widget": "input"}, {"field": "to_dept", "label": "新部门", "widget": "input"}, {"field": "from_position", "label": "原岗位", "widget": "input"}, {"field": "to_position", "label": "新岗位", "widget": "input"}, {"field": "effective_date", "label": "生效日期", "widget": "date"}, {"field": "transfer_type", "label": "调岗类型", "widget": "select", "options": [{"label": "平调", "value": "平调"}, {"label": "晋升", "value": "晋升"}, {"label": "降级", "value": "降级"}]}, {"field": "transfer_reason", "label": "调岗原因", "widget": "textarea"}, {"field": "approver", "label": "审批人", "widget": "input"}]}], "docType": "transfer_record"}, "source": "ai", "created_at": "2026-01-24T19:58:19.366Z", "updated_at": "2026-01-24T19:58:19.366Z"}, {"id": "attendance_record", "name": "考勤记录单", "schema": {"docNo": "employee_no", "title": "考勤记录单", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "employee_name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号/电话", "widget": "input"}, {"field": "dept_name", "label": "部门", "widget": "input"}, {"field": "att_date", "label": "日期", "widget": "date"}]}, {"cols": 2, "type": "section", "title": "班次与打卡", "children": [{"field": "shift_name", "label": "班次", "widget": "input"}, {"field": "punch_times", "label": "打卡记录", "widget": "textarea"}, {"field": "check_in", "label": "签到时间", "widget": "input"}, {"field": "check_out", "label": "签退时间", "widget": "input"}]}, {"cols": 4, "type": "section", "title": "考勤状态", "children": [{"field": "late_flag", "label": "迟到", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "early_flag", "label": "早退", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "leave_flag", "label": "请假", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "absent_flag", "label": "缺勤", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "att_status", "label": "考勤状态", "widget": "select", "options": [{"label": "正常", "value": "正常"}, {"label": "迟到", "value": "迟到"}, {"label": "早退", "value": "早退"}, {"label": "缺勤", "value": "缺勤"}, {"label": "请假", "value": "请假"}]}]}, {"cols": 2, "type": "section", "title": "加班与备注", "children": [{"field": "overtime_minutes", "label": "加班(分钟)", "widget": "number"}, {"field": "ot_hours", "label": "加班时长", "widget": "input"}, {"field": "remark", "label": "备注", "widget": "textarea"}, {"field": "att_note", "label": "备注", "widget": "textarea"}]}], "docType": "attendance_record"}, "source": "ai", "created_at": "2026-01-24T19:25:56.311Z", "updated_at": "2026-01-24T19:25:56.311Z"}, {"id": "employee_profile", "name": "员工详细档案表", "schema": {"docNo": "employee_no", "title": "员工详细档案表", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "value": "688", "widget": "input"}, {"field": "name", "label": "姓名", "value": "惠晨丽", "widget": "input"}, {"field": "employee_no", "label": "工号", "value": "E0100", "widget": "input"}, {"field": "department", "label": "部门", "value": "行政部", "widget": "input"}, {"field": "status", "label": "状态", "value": "试用", "widget": "input"}, {"field": "gender", "label": "性别", "value": "男", "widget": "input"}, {"field": "id_card", "label": "身份证", "widget": "input"}, {"field": "field_3410", "label": "籍贯", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "薪资信息", "children": [{"field": "field_5458", "label": "工资", "widget": "input"}, {"field": "field_9314", "label": "绩效", "widget": "input"}, {"field": "field_789", "label": "总工资", "value": 0, "widget": "input", "disabled": true}]}, {"cols": 2, "type": "section", "title": "分类信息", "children": [{"field": "field_8633", "label": "1", "value": "1", "widget": "select", "options": [{"type": "success", "label": "1", "value": "1"}, {"type": "warning", "label": "2", "value": "2"}, {"type": "danger", "label": "3", "value": "3"}, {"type": "info", "label": "4", "value": "4"}, {"type": "", "label": "5", "value": "5"}, {"type": "", "label": "6", "value": "6"}, {"type": "", "label": "7", "value": "7"}]}, {"field": "field_2086", "label": "2", "value": "1", "widget": "cascader", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}, {"label": "5", "value": "5"}], "3": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "4": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "5": [{"label": "1", "value": "1"}], "6": [{"label": "1", "value": "1"}], "7": [{"label": "1", "value": "1"}]}}, {"field": "field_7980", "label": "3", "value": "1", "widget": "cascader", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "3": [{"label": "1", "value": "1"}], "4": [{"label": "2", "value": "2"}], "5": [{"label": "3", "value": "3"}]}}]}, {"cols": 2, "type": "section", "title": "其他信息", "children": [{"field": "field_1340", "label": "位置", "widget": "input", "geoAddress": true}, {"field": "field_3727", "label": "员工照片", "widget": "image", "fileSource": "field_3727"}]}], "docType": "employee_profile"}, "source": "ai", "created_at": "2025-12-30T19:26:26.913Z", "updated_at": "2025-12-30T19:26:26.913Z"}, {"id": "employee_detail", "name": "员工信息表", "schema": {"docNo": "id", "title": "员工信息表", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "widget": "input"}, {"field": "name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号", "widget": "input"}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "status", "label": "状态", "widget": "input"}, {"field": "gender", "label": "性别", "widget": "input"}, {"field": "id_card", "label": "身份证", "widget": "input"}, {"field": "field_3410", "label": "籍贯", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "薪资信息", "children": [{"field": "field_5458", "label": "工资", "widget": "input"}, {"field": "field_9314", "label": "绩效", "widget": "input"}, {"field": "field_789", "label": "总工资", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "其他信息", "children": [{"field": "field_8633", "label": "1", "widget": "select"}, {"field": "field_2086", "label": "2", "widget": "cascader"}, {"field": "field_7980", "label": "3", "widget": "cascader"}, {"field": "field_1340", "label": "位置", "widget": "geo"}, {"field": "field_3727", "label": "员工照片", "widget": "image", "fileSource": "field_3727"}]}], "docType": "employee_detail"}, "source": "ai", "created_at": "2025-12-30T13:59:49.163Z", "updated_at": "2025-12-30T13:59:49.163Z"}, {"id": "hr_form", "name": "人事信息表", "schema": {"docNo": "hr_no", "title": "人事信息表", "layout": [{"cols": 2, "type": "section", "title": "个人信息", "children": [{"field": "name", "label": "姓名", "widget": "input"}, {"field": "gender", "label": "性别", "widget": "input"}, {"field": "birth_date", "label": "出生日期", "widget": "date"}, {"field": "ethnicity", "label": "民族", "widget": "input"}, {"field": "id_card", "label": "身份证号", "widget": "input"}, {"field": "phone", "label": "联系电话", "widget": "input"}, {"field": "email", "label": "电子邮箱", "widget": "input"}, {"field": "address", "label": "现住址", "widget": "textarea"}]}, {"cols": 2, "type": "section", "title": "工作信息", "children": [{"field": "employee_no", "label": "员工编号", "widget": "input"}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "position", "label": "职位", "widget": "input"}, {"field": "entry_date", "label": "入职日期", "widget": "date"}, {"field": "contract_period", "label": "合同期限", "widget": "input"}, {"field": "contract_start_date", "label": "合同起始日期", "widget": "date"}, {"field": "contract_end_date", "label": "合同结束日期", "widget": "date"}, {"field": "supervisor", "label": "直属上级", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "紧急联系人", "children": [{"field": "emergency_contact_name", "label": "姓名", "widget": "input"}, {"field": "emergency_contact_relation", "label": "关系", "widget": "input"}, {"field": "emergency_contact_phone", "label": "联系电话", "widget": "input"}]}], "docType": "hr_form"}, "source": "ai", "created_at": "2025-12-30T13:51:48.884Z", "updated_at": "2025-12-30T13:51:48.884Z"}]	\N
materials_table_cols	[]	\N
materials_table_cols_static_hidden	[]	\N
app_settings	{"title": "EISCore", "themeColor": "#2b0408", "notifications": true, "materialsCategoryDepth": 2}	系统全局设置
hr_table_cols	[{"prop": "gender", "label": "性别"}, {"prop": "id_card", "label": "身份证"}, {"prop": "field_3410", "label": "籍贯"}, {"prop": "field_5458", "type": "text", "label": "工资"}, {"prop": "field_9314", "type": "text", "label": "绩效"}, {"prop": "field_789", "type": "formula", "label": "总工资", "expression": "{工资}+{绩效}"}, {"prop": "field_1340", "type": "geo", "label": "位置", "geoAddress": true}, {"prop": "field_3727", "type": "file", "label": "员工照片", "fileAccept": "", "fileMaxCount": 3, "fileMaxSizeMb": 20}]	HR花名册的动态列配置
materials_categories	[{"id": "01", "label": "原材料"}, {"id": "02", "label": "包装材料", "children": [{"id": "02.01", "label": "纸箱类"}, {"id": "02.02", "label": "桶类"}, {"id": "02.03", "label": "罐类"}, {"id": "02.04", "label": "袋子类"}, {"id": "02.05", "label": "瓶子类"}, {"id": "02.06", "label": "封口膜类"}, {"id": "02.07", "label": "标签类"}, {"id": "02.08", "label": "封口胶"}, {"id": "02.09", "label": "其他包材"}]}, {"id": "03", "label": "五金耗材类", "children": [{"id": "03.01", "label": "办公文具"}, {"id": "03.02", "label": "清洁劳保用品"}, {"id": "03.03", "label": "机械设备"}, {"id": "03.04", "label": "五金配件"}, {"id": "03.05", "label": "其他耗材"}]}, {"id": "04", "label": "半成品", "children": [{"id": "04.01", "label": "速冻果汁系列"}, {"id": "04.02", "label": "速冻果浆系列"}, {"id": "04.03", "label": "速冻冰淇淋系列"}]}, {"id": "05", "label": "库存商品", "children": [{"id": "05.01", "label": "速冻果汁系列"}, {"id": "05.02", "label": "速冻果浆系列"}, {"id": "05.03", "label": "常温果酱系列"}, {"id": "05.04", "label": "速冻块/粒系列"}, {"id": "05.05", "label": "常温饮料类"}, {"id": "05.06", "label": "其他库存商品"}]}, {"id": "06", "label": "代加工产品"}]	\N
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (user_id, role_id, created_at) FROM stdin;
2	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	2026-01-16 15:27:08.757051+00
3	dab1f261-b0ef-4050-82d4-251514f9041b	2026-01-16 15:27:08.757051+00
4	e1ba01bc-955c-4d41-9ed8-35dfd8644320	2026-01-16 15:27:08.757051+00
5	11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	2026-01-16 15:27:08.757051+00
1	acf335a2-f56f-4aca-bb4d-682553c8e5ec	2026-01-16 15:27:08.757051+00
6	e0d14028-ec80-4c81-aa95-24fe79a1ad05	2026-01-29 15:30:24.345083+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, role, avatar, permissions, full_name, phone, email, dept_id, status, created_at, updated_at, position_id) FROM stdin;
4	dept_manager	123456	dept_manager	\N	\N	Dept Manager	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	c8de51d4-bf7c-417d-baf0-0e3c8a372928
5	employee	123456	employee	\N	\N	Employee	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	928bca4f-0a23-41c7-948c-61a8a30ce5cf
3	hr_clerk	123456	hr_clerk	\N	\N	HR Clerk	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	c6978198-989f-48c4-a9e4-a746e3dfa81e
6	hr_viewer	123456	web_user	file:539d3c8c-da38-4421-81da-6bca95d1c516	\N	HR Viewer	\N	\N	8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64	active	2026-01-29 15:30:24.345083+00	2026-01-31 21:55:39.494754+00	\N
1	admin	123456	super_admin	file:7008869a-52a1-4558-bcae-e96746d62435	{hr:employee.view,hr:employee.create,hr:employee.edit,hr:employee.delete,hr:employee.export,hr:employee.config,hr:org.view,hr:org.create,hr:org.edit,hr:org.delete,hr:org.export,hr:org.config,hr:change.view,hr:change.create,hr:change.edit,hr:change.delete,hr:change.export,hr:attendance.view,hr:attendance.create,hr:attendance.edit,hr:attendance.delete,hr:attendance.export,hr:payroll.view,hr:payroll.create,hr:payroll.edit,hr:payroll.delete,hr:payroll.export,hr:profile.view,hr:profile.create,hr:profile.edit,hr:profile.delete,hr:profile.export}	\N	\N	\N	b0aa5f36-a392-4a79-a908-e84c3aac1112	active	2026-01-16 15:25:52.722816+00	2026-01-31 21:55:31.055248+00	032d10a0-c0a3-46ed-a304-a2395ffe3ee0
2	hr_admin	123456	hr_admin	\N	{hr:employee.view,hr:employee.create,hr:employee.edit,hr:employee.delete,hr:employee.export,hr:employee.config,hr:org.view,hr:org.create,hr:org.edit,hr:org.delete,hr:org.export,hr:org.config,hr:change.view,hr:change.create,hr:change.edit,hr:change.delete,hr:change.export,hr:attendance.view,hr:attendance.create,hr:attendance.edit,hr:attendance.delete,hr:attendance.export,hr:payroll.view,hr:payroll.create,hr:payroll.edit,hr:payroll.delete,hr:payroll.export,hr:profile.view,hr:profile.create,hr:profile.edit,hr:profile.delete,hr:profile.export}	HR Admin	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-31 21:52:28.60864+00	5c95c523-1cae-4c6c-a540-f1977de4058e
\.


--
-- Name: archives_id_seq; Type: SEQUENCE SET; Schema: hr; Owner: postgres
--

SELECT pg_catalog.setval('hr.archives_id_seq', 803, true);


--
-- Name: payroll_id_seq; Type: SEQUENCE SET; Schema: hr; Owner: postgres
--

SELECT pg_catalog.setval('hr.payroll_id_seq', 1, false);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employees_id_seq', 1, true);


--
-- Name: raw_materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.raw_materials_id_seq', 38, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: basic_auth; Owner: postgres
--

ALTER TABLE ONLY basic_auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (username);


--
-- Name: archives archives_employee_no_key; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.archives
    ADD CONSTRAINT archives_employee_no_key UNIQUE (employee_no);


--
-- Name: archives archives_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.archives
    ADD CONSTRAINT archives_pkey PRIMARY KEY (id);


--
-- Name: attendance_month_overrides attendance_month_overrides_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.attendance_month_overrides
    ADD CONSTRAINT attendance_month_overrides_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: attendance_shifts attendance_shifts_name_key; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.attendance_shifts
    ADD CONSTRAINT attendance_shifts_name_key UNIQUE (name);


--
-- Name: attendance_shifts attendance_shifts_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.attendance_shifts
    ADD CONSTRAINT attendance_shifts_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_archive_id_key; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.employee_profiles
    ADD CONSTRAINT employee_profiles_archive_id_key UNIQUE (archive_id);


--
-- Name: employee_profiles employee_profiles_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.employee_profiles
    ADD CONSTRAINT employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: field_label_overrides field_label_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.field_label_overrides
    ADD CONSTRAINT field_label_overrides_pkey PRIMARY KEY (module, field_code);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: form_values form_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.form_values
    ADD CONSTRAINT form_values_pkey PRIMARY KEY (id);


--
-- Name: form_values form_values_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.form_values
    ADD CONSTRAINT form_values_unique UNIQUE (template_id, row_id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: raw_materials raw_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_materials
    ADD CONSTRAINT raw_materials_pkey PRIMARY KEY (id);


--
-- Name: role_data_scopes role_data_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_pkey PRIMARY KEY (id);


--
-- Name: role_data_scopes role_data_scopes_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_unique UNIQUE (role_id, module);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sys_dict_items sys_dict_items_dict_id_value_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_dict_items
    ADD CONSTRAINT sys_dict_items_dict_id_value_key UNIQUE (dict_id, value);


--
-- Name: sys_dict_items sys_dict_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_dict_items
    ADD CONSTRAINT sys_dict_items_pkey PRIMARY KEY (id);


--
-- Name: sys_dicts sys_dicts_dict_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_dicts
    ADD CONSTRAINT sys_dicts_dict_key_key UNIQUE (dict_key);


--
-- Name: sys_dicts sys_dicts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_dicts
    ADD CONSTRAINT sys_dicts_pkey PRIMARY KEY (id);


--
-- Name: sys_field_acl sys_field_acl_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_field_acl
    ADD CONSTRAINT sys_field_acl_pkey PRIMARY KEY (id);


--
-- Name: sys_field_acl sys_field_acl_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_field_acl
    ADD CONSTRAINT sys_field_acl_unique UNIQUE (role_id, module, field_code);


--
-- Name: sys_grid_configs sys_grid_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_grid_configs
    ADD CONSTRAINT sys_grid_configs_pkey PRIMARY KEY (view_id);


--
-- Name: system_configs system_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_configs
    ADD CONSTRAINT system_configs_pkey PRIMARY KEY (key);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_attendance_month_overrides_dept; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE INDEX idx_attendance_month_overrides_dept ON hr.attendance_month_overrides USING btree (dept_name, att_month);


--
-- Name: idx_attendance_month_overrides_month; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE INDEX idx_attendance_month_overrides_month ON hr.attendance_month_overrides USING btree (att_month);


--
-- Name: idx_attendance_records_date; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE INDEX idx_attendance_records_date ON hr.attendance_records USING btree (att_date);


--
-- Name: idx_attendance_records_dept; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE INDEX idx_attendance_records_dept ON hr.attendance_records USING btree (dept_name, att_date);


--
-- Name: idx_attendance_records_employee; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE INDEX idx_attendance_records_employee ON hr.attendance_records USING btree (employee_id);


--
-- Name: idx_employee_profiles_archive_id; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE INDEX idx_employee_profiles_archive_id ON hr.employee_profiles USING btree (archive_id);


--
-- Name: uniq_attendance_employee_day; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE UNIQUE INDEX uniq_attendance_employee_day ON hr.attendance_records USING btree (att_date, employee_id) WHERE ((person_type = 'employee'::text) AND (employee_id IS NOT NULL));


--
-- Name: uniq_attendance_month_person; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE UNIQUE INDEX uniq_attendance_month_person ON hr.attendance_month_overrides USING btree (att_month, person_key);


--
-- Name: uniq_attendance_temp_day_phone; Type: INDEX; Schema: hr; Owner: postgres
--

CREATE UNIQUE INDEX uniq_attendance_temp_day_phone ON hr.attendance_records USING btree (att_date, temp_phone) WHERE ((person_type = 'temp'::text) AND (temp_phone IS NOT NULL));


--
-- Name: idx_departments_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_departments_parent_id ON public.departments USING btree (parent_id);


--
-- Name: idx_files_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_created_at ON public.files USING btree (created_at);


--
-- Name: idx_form_values_row_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_form_values_row_id ON public.form_values USING btree (row_id);


--
-- Name: idx_positions_dept_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_dept_id ON public.positions USING btree (dept_id);


--
-- Name: idx_sys_dict_items_dict_id_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sys_dict_items_dict_id_sort ON public.sys_dict_items USING btree (dict_id, sort);


--
-- Name: idx_users_dept_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_dept_id ON public.users USING btree (dept_id);


--
-- Name: archives trg_eis_notify_hr_archives; Type: TRIGGER; Schema: hr; Owner: postgres
--

CREATE TRIGGER trg_eis_notify_hr_archives AFTER INSERT OR DELETE OR UPDATE ON hr.archives FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: attendance_month_overrides trg_eis_notify_hr_attendance_month_overrides; Type: TRIGGER; Schema: hr; Owner: postgres
--

CREATE TRIGGER trg_eis_notify_hr_attendance_month_overrides AFTER INSERT OR DELETE OR UPDATE ON hr.attendance_month_overrides FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: attendance_records trg_eis_notify_hr_attendance_records; Type: TRIGGER; Schema: hr; Owner: postgres
--

CREATE TRIGGER trg_eis_notify_hr_attendance_records AFTER INSERT OR DELETE OR UPDATE ON hr.attendance_records FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: attendance_shifts trg_eis_notify_hr_attendance_shifts; Type: TRIGGER; Schema: hr; Owner: postgres
--

CREATE TRIGGER trg_eis_notify_hr_attendance_shifts AFTER INSERT OR DELETE OR UPDATE ON hr.attendance_shifts FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: field_label_overrides tg_field_label_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_field_label_overrides_updated_at BEFORE UPDATE ON public.field_label_overrides FOR EACH ROW EXECUTE FUNCTION public.touch_field_label_overrides();


--
-- Name: permissions tg_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_permissions_updated_at BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: role_data_scopes tg_role_data_scopes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_role_data_scopes_updated_at BEFORE UPDATE ON public.role_data_scopes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: role_permissions tg_role_permissions_cascade_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_role_permissions_cascade_delete AFTER DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.cascade_revoke_permissions();


--
-- Name: role_permissions tg_role_permissions_cascade_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_role_permissions_cascade_insert AFTER INSERT ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.cascade_grant_permissions();


--
-- Name: roles tg_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: system_configs tg_sync_field_acl_configs; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_sync_field_acl_configs AFTER INSERT OR UPDATE ON public.system_configs FOR EACH ROW EXECUTE FUNCTION public.sync_field_acl_from_config();


--
-- Name: sys_field_acl tg_sys_field_acl_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_sys_field_acl_updated_at BEFORE UPDATE ON public.sys_field_acl FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: v_role_data_scopes_matrix tg_v_role_data_scopes_matrix_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_role_data_scopes_matrix_update INSTEAD OF UPDATE ON public.v_role_data_scopes_matrix FOR EACH ROW EXECUTE FUNCTION public.tg_v_role_data_scopes_matrix_update();


--
-- Name: v_role_permissions_matrix tg_v_role_permissions_matrix_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_role_permissions_matrix_update INSTEAD OF UPDATE ON public.v_role_permissions_matrix FOR EACH ROW EXECUTE FUNCTION public.tg_v_role_permissions_matrix_update();


--
-- Name: v_roles_manage tg_v_roles_manage_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_roles_manage_delete INSTEAD OF DELETE ON public.v_roles_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_roles_manage_delete();


--
-- Name: v_roles_manage tg_v_roles_manage_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_roles_manage_insert INSTEAD OF INSERT ON public.v_roles_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_roles_manage_insert();


--
-- Name: v_roles_manage tg_v_roles_manage_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_roles_manage_update INSTEAD OF UPDATE ON public.v_roles_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_roles_manage_update();


--
-- Name: v_users_manage tg_v_users_manage_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_users_manage_delete INSTEAD OF DELETE ON public.v_users_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_users_manage_delete();


--
-- Name: v_users_manage tg_v_users_manage_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_users_manage_insert INSTEAD OF INSERT ON public.v_users_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_users_manage_insert();


--
-- Name: v_users_manage tg_v_users_manage_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_v_users_manage_update INSTEAD OF UPDATE ON public.v_users_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_users_manage_update();


--
-- Name: raw_materials trg_eis_notify_public_raw_materials; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_eis_notify_public_raw_materials AFTER INSERT OR DELETE OR UPDATE ON public.raw_materials FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: files trg_files_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: raw_materials trg_raw_materials_set_dept_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_raw_materials_set_dept_id BEFORE INSERT ON public.raw_materials FOR EACH ROW EXECUTE FUNCTION public.raw_materials_set_dept_id();


--
-- Name: sys_dict_items trg_sys_dict_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sys_dict_items_updated_at BEFORE UPDATE ON public.sys_dict_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sys_dicts trg_sys_dicts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sys_dicts_updated_at BEFORE UPDATE ON public.sys_dicts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attendance_records attendance_records_shift_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.attendance_records
    ADD CONSTRAINT attendance_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES hr.attendance_shifts(id);


--
-- Name: employee_profiles employee_profiles_archive_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.employee_profiles
    ADD CONSTRAINT employee_profiles_archive_id_fkey FOREIGN KEY (archive_id) REFERENCES hr.archives(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_archive_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_archive_id_fkey FOREIGN KEY (archive_id) REFERENCES hr.archives(id);


--
-- Name: departments departments_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: positions positions_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: raw_materials raw_materials_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_materials
    ADD CONSTRAINT raw_materials_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: role_data_scopes role_data_scopes_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: role_data_scopes role_data_scopes_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: sys_dict_items sys_dict_items_dict_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_dict_items
    ADD CONSTRAINT sys_dict_items_dict_id_fkey FOREIGN KEY (dict_id) REFERENCES public.sys_dicts(id) ON DELETE CASCADE;


--
-- Name: sys_field_acl sys_field_acl_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_field_acl
    ADD CONSTRAINT sys_field_acl_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: users users_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL;


--
-- Name: raw_materials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_materials raw_materials_scope_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY raw_materials_scope_delete ON public.raw_materials FOR DELETE TO web_user USING (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END);


--
-- Name: raw_materials raw_materials_scope_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY raw_materials_scope_insert ON public.raw_materials FOR INSERT TO web_user WITH CHECK (((created_by = public.current_username()) AND ((dept_id IS NULL) OR (dept_id = public.current_user_dept_id()))));


--
-- Name: raw_materials raw_materials_scope_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY raw_materials_scope_select ON public.raw_materials FOR SELECT TO web_user USING (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END);


--
-- Name: raw_materials raw_materials_scope_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY raw_materials_scope_update ON public.raw_materials FOR UPDATE TO web_user USING (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END) WITH CHECK (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END);


--
-- Name: SCHEMA hr; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA hr TO web_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT USAGE ON SCHEMA public TO web_user;


--
-- Name: SCHEMA scm; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA scm TO web_user;


--
-- Name: FUNCTION init_attendance_records(p_date date, p_dept_name text); Type: ACL; Schema: hr; Owner: postgres
--

GRANT ALL ON FUNCTION hr.init_attendance_records(p_date date, p_dept_name text) TO web_user;


--
-- Name: FUNCTION apply_role_permission_templates(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_role_permission_templates() TO web_user;


--
-- Name: FUNCTION ensure_field_acl(module_name text, field_codes text[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ensure_field_acl(module_name text, field_codes text[]) TO web_user;


--
-- Name: FUNCTION login(payload json); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.login(payload json) TO web_anon;


--
-- Name: FUNCTION login(username text, password text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.login(username text, password text) TO web_anon;


--
-- Name: FUNCTION upsert_field_acl(payload jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.upsert_field_acl(payload jsonb) TO web_user;


--
-- Name: FUNCTION upsert_permissions(payload jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.upsert_permissions(payload jsonb) TO web_user;


--
-- Name: TABLE archives; Type: ACL; Schema: hr; Owner: postgres
--

GRANT ALL ON TABLE hr.archives TO web_user;


--
-- Name: SEQUENCE archives_id_seq; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE hr.archives_id_seq TO web_user;


--
-- Name: TABLE attendance_month_overrides; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.attendance_month_overrides TO web_user;


--
-- Name: TABLE attendance_records; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.attendance_records TO web_user;


--
-- Name: TABLE attendance_shifts; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.attendance_shifts TO web_user;


--
-- Name: TABLE employee_profiles; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.employee_profiles TO web_user;


--
-- Name: TABLE payroll; Type: ACL; Schema: hr; Owner: postgres
--

GRANT ALL ON TABLE hr.payroll TO web_user;


--
-- Name: SEQUENCE payroll_id_seq; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE hr.payroll_id_seq TO web_user;


--
-- Name: TABLE v_attendance_daily; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT ON TABLE hr.v_attendance_daily TO web_user;


--
-- Name: TABLE v_attendance_monthly; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT ON TABLE hr.v_attendance_monthly TO web_user;


--
-- Name: TABLE debug_me; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.debug_me TO web_user;


--
-- Name: TABLE departments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.departments TO web_user;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.employees TO web_anon;
GRANT ALL ON TABLE public.employees TO web_user;


--
-- Name: SEQUENCE employees_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.employees_id_seq TO web_user;


--
-- Name: TABLE field_label_overrides; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.field_label_overrides TO web_user;


--
-- Name: TABLE files; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.files TO web_user;


--
-- Name: TABLE form_values; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.form_values TO web_user;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.permissions TO web_user;


--
-- Name: TABLE positions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.positions TO web_user;


--
-- Name: TABLE raw_materials; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.raw_materials TO web_anon;
GRANT ALL ON TABLE public.raw_materials TO web_user;


--
-- Name: SEQUENCE raw_materials_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.raw_materials_id_seq TO web_user;


--
-- Name: TABLE role_data_scopes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_data_scopes TO web_user;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_permissions TO web_user;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.roles TO web_user;


--
-- Name: TABLE sys_field_acl; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sys_field_acl TO web_user;


--
-- Name: TABLE sys_grid_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sys_grid_configs TO web_user;
GRANT SELECT ON TABLE public.sys_grid_configs TO web_anon;


--
-- Name: TABLE system_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_configs TO web_user;
GRANT SELECT ON TABLE public.system_configs TO web_anon;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_roles TO web_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO web_user;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.users_id_seq TO web_user;


--
-- Name: TABLE v_field_labels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_field_labels TO web_user;


--
-- Name: TABLE v_role_data_scopes_matrix; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_role_data_scopes_matrix TO web_user;


--
-- Name: TABLE v_role_permissions_matrix; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,UPDATE ON TABLE public.v_role_permissions_matrix TO web_user;


--
-- Name: TABLE v_roles_manage; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_roles_manage TO web_user;


--
-- Name: TABLE v_users_manage; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_users_manage TO web_user;


--
-- PostgreSQL database dump complete
--

\unrestrict j4vYuiLASwWtKbK74NkdlfsWG22TbwVh9twlTGMqloWmuW1WKXx8LT3BVEaac6K

