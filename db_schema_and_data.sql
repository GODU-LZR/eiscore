--
-- PostgreSQL database dump
--

\restrict aLHhf61RPyg0ZaZfHKTmTeHDBrNXGuFtzYFZ7awmpL0u8MnGHxB6fou3ESdhI4I

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
-- Name: login(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.login(username text, password text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
-- Name: raw_materials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.raw_materials (
    id integer NOT NULL,
    batch_no text NOT NULL,
    name text NOT NULL,
    category text,
    weight_kg numeric(10,2),
    entry_date date DEFAULT CURRENT_DATE,
    created_by text
);


ALTER TABLE public.raw_materials OWNER TO postgres;

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
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

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
    sort integer DEFAULT 100
);


ALTER TABLE public.roles OWNER TO postgres;

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
-- Name: system_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_configs (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text
);


ALTER TABLE public.system_configs OWNER TO postgres;

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
802	新员工	EMP330625		\N	\N	试用	0.00	2026-01-27	{"status": "locked", "row_locked_by": "Admin"}	1	2026-01-27 18:59:05.560925
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
702	应军超	E0003	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
701	王安桐	E0002	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
700	史俊晨	E0001	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.806
799	惠晨丽	E0100	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:52.537
798	童杰敏	E0099	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	4	2026-01-25 01:49:56.27
797	翁涵	E0098	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	9	2026-01-25 01:49:56.27
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
796	单杰悦	E0097	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	7	2026-01-25 01:49:56.27
793	宣睿婷	E0094	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:56.27
792	余涵萱	E0093	\N	\N	\N	离职	0.00	2026-01-24	{"gender": "女", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:56.27
791	车鹏睿	E0092	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 1500, "field_5458": "1000", "field_9314": "500"}	5	2026-01-25 01:49:56.27
801	林	EMP586274	\N	\N	\N	试用	0.00	2026-01-25	{"field_789": 0, "field_2086": "1", "field_3727": [{"id": "9a83b87e-0368-4e87-bf0e-9e3fca0b4f4d", "ext": "jpg", "name": "进度.jpg", "size": 124887, "type": "image/jpeg", "dataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QBoRXhpZgAASUkqAAgAAAACADEBAgAHAAAAJgAAAGmHBAABAAAALgAAAAAAAABQaWNhc2EAAAIAAJAHAAQAAAAwMjIwA5ACABQAAABMAAAAAAAAADIwMjU6MTI6MjggMTA6NDM6MzAA/+EDO2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS41LjAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczpJcHRjNHhtcEV4dD0iaHR0cDovL2lwdGMub3JnL3N0ZC9JcHRjNHhtcEV4dC8yMDA4LTAyLTI5LyIgZXhpZjpEYXRlVGltZU9yaWdpbmFsPSIyMDI1LTEyLTI4VDEwOjQzOjMwKzAwOjAwIiBwaG90b3Nob3A6Q3JlZGl0PSJFZGl0ZWQgd2l0aCBHb29nbGUgQUkiIHBob3Rvc2hvcDpEYXRlQ3JlYXRlZD0iMjAyNS0xMi0yOFQxMDo0MzozMCswMDowMCIgSXB0YzR4bXBFeHQ6RGlnaXRhbFNvdXJjZWZpbGVUeXBlPSJodHRwOi8vY3YuaXB0Yy5vcmcvbmV3c2NvZGVzL2RpZ2l0YWxzb3VyY2V0eXBlL2NvbXBvc2l0ZVdpdGhUcmFpbmVkQWxnb3JpdGhtaWNNZWRpYSIgSXB0YzR4bXBFeHQ6RGlnaXRhbFNvdXJjZVR5cGU9Imh0dHA6Ly9jdi5pcHRjLm9yZy9uZXdzY29kZXMvZGlnaXRhbHNvdXJjZXR5cGUvY29tcG9zaXRlV2l0aFRyYWluZWRBbGdvcml0aG1p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", "uploadedAt": "2026-01-25T01:49:01.146Z"}], "field_7980": "4", "field_8633": "2"}	8	2026-01-27 18:39:56.588
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
762	霍勇鹏	E0063	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
761	陆轩	E0062	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
760	薛萱琳	E0061	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.804
759	彭琪桐	E0060	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
795	魏瑜墨	E0096	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "status": "created", "field_789": 1500, "field_5458": "1000", "field_9314": "500", "row_locked_by": null}	9	2026-01-25 01:51:09.553
794	齐娜妍	E0095	\N	\N	\N	试用	0.00	2026-01-24	{"gender": "男", "status": "created", "field_789": 1500, "field_5458": "1000", "field_9314": "500", "row_locked_by": null}	7	2026-01-25 01:51:11.557
800	你	EMP339009	\N	\N	\N	试用	0.00	2026-01-25	{"field_789": 0}	4	2026-01-27 18:40:02.606
758	左怡轩	E0059	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
757	荣琳博	E0058	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
756	蓝瑶婷	E0057	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
755	乌彬鑫	E0056	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
754	莫瑾宸	E0055	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
753	魏伟	E0054	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
752	陈嘉婉	E0053	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
751	缪彬	E0052	\N	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_789": 0, "field_5458": "0", "field_9314": "0"}	2	2026-01-25 01:47:29.805
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
3ee73ef4-5352-4806-bfc5-002f2ac68564	销售部	15e61e02-6ef3-41a0-b858-21e1618f9632	\N	20	active	2026-01-27 20:59:04.610513+00	2026-01-27 20:59:04.610513+00
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
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.files (id, filename, mime_type, size_bytes, content_base64, sha256, extra, created_at, updated_at) FROM stdin;
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

COPY public.raw_materials (id, batch_no, name, category, weight_kg, entry_date, created_by) FROM stdin;
1	NP-20251220-01	金鲳鱼(特级)	海鲜原料	500.50	2025-12-20	zhangsan
2	NP-20251220-02	食用盐	辅料	50.00	2025-12-20	lisi
3	NP-20251221-01	真空包装袋	包材	120.00	2025-12-20	zhangsan
\.


--
-- Data for Name: role_data_scopes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_data_scopes (id, role_id, module, scope_type, dept_id, created_at, updated_at) FROM stdin;
7ef5aa89-0031-4bc5-bc31-47cf25b00155	acf335a2-f56f-4aca-bb4d-682553c8e5ec	hr_employee	all	\N	2026-01-28 16:50:30.565775+00	2026-01-28 16:50:30.565775+00
acb88f94-ae35-40de-8fd5-2a0e566d8af6	f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_employee	dept_tree	\N	2026-01-28 16:50:30.568748+00	2026-01-28 16:50:30.568748+00
48bb2e6d-6805-404e-a81d-5b38b0272c86	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	dept	\N	2026-01-28 16:50:30.570423+00	2026-01-28 16:50:30.570423+00
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
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, code, name, description, created_at, updated_at, sort) FROM stdin;
acf335a2-f56f-4aca-bb4d-682553c8e5ec	super_admin	超级管理员	拥有全部权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_admin	人事管理员	人事模块全权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100
dab1f261-b0ef-4050-82d4-251514f9041b	hr_clerk	人事文员	人事模块编辑权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100
e1ba01bc-955c-4d41-9ed8-35dfd8644320	dept_manager	部门主管	部门管理权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100
11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	employee	员工	普通员工权限	2026-01-16 15:27:08.757051+00	2026-01-28 19:39:52.154034+00	100
e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_viewer	人事只读	仅查看权限	2026-01-28 16:50:30.556875+00	2026-01-28 19:39:52.154034+00	30
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
c598dabd-8776-41e1-b06e-9fbe5dcde2ac	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	salary	t	f	2026-01-28 16:50:30.572916+00	2026-01-28 16:50:30.572916+00
3c0909ec-2689-459d-8c01-1f4c81815fd9	e0d14028-ec80-4c81-aa95-24fe79a1ad05	hr_employee	id_card	t	f	2026-01-28 16:50:30.572916+00	2026-01-28 16:50:30.572916+00
\.


--
-- Data for Name: sys_grid_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_grid_configs (view_id, summary_config, updated_by, updated_at) FROM stdin;
attendance_day	{"label": "合计", "rules": {}, "expressions": {}, "column_locks": {}}	Admin	2026-01-16 22:31:15.107929+00
employee_list	{"label": "合计", "rules": {"id": "count", "name": "none"}, "cell_labels": {"id": "员工人数"}, "expressions": {}, "column_locks": {}}	Admin	2025-12-25 18:44:29.890141+00
\.


--
-- Data for Name: system_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_configs (key, value, description) FROM stdin;
hr_column_locks	{}	HR表格列锁配置
ai_glm_config	{"model": "glm-4.6v", "api_key": "01e666998e24458e960cfc51fd7a1ff2.a67QjUwrs2433Wk2", "api_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions", "provider": "zhipu", "thinking": {"type": "enabled"}}	智谱 AI GLM-4.6V 模型配置
hr_attendance_cols	[{"prop": "att_date", "type": "text", "label": "日期"}, {"prop": "check_in", "type": "text", "label": "签到时间"}, {"prop": "check_out", "type": "text", "label": "签退时间"}, {"prop": "att_status", "type": "select", "label": "考勤状态", "options": [{"label": "正常", "value": "正常"}, {"label": "迟到", "value": "迟到"}, {"label": "早退", "value": "早退"}, {"label": "缺勤", "value": "缺勤"}, {"label": "请假", "value": "请假"}]}, {"prop": "ot_hours", "type": "text", "label": "加班时长"}, {"prop": "att_note", "type": "text", "label": "备注"}]	\N
hr_org_layout	[{"x": 850, "y": 60, "id": "b0aa5f36-a392-4a79-a908-e84c3aac1112"}, {"x": 80, "y": 200, "id": "15e61e02-6ef3-41a0-b858-21e1618f9632"}, {"x": 300, "y": 200, "id": "8f2d51a8-5d51-4fd4-88b1-b0ccd455fc64"}, {"x": 850, "y": 200, "id": "821bae9d-d4d6-4f79-a2df-986400aaada3"}, {"x": 520, "y": 340, "id": "8c7d6883-4921-4ef4-ba45-8033103563e2"}, {"x": 740, "y": 340, "id": "d26a3a93-e81d-4cc0-998f-d014edee55f4"}, {"x": 960, "y": 340, "id": "529af27e-6cfb-4dcf-be03-efe17c5bb285"}, {"x": 1180, "y": 340, "id": "3ee73ef4-5352-4806-bfc5-002f2ac68564"}, {"x": 1400, "y": 200, "id": "f1b437fa-a799-4866-9478-50e15b961e93"}, {"x": 1620, "y": 200, "id": "427becfd-2d82-48d6-8171-195c7acaad53"}]	\N
hr_transfer_cols	[{"prop": "from_dept", "type": "text", "label": "原部门"}, {"prop": "to_dept", "type": "text", "label": "新部门"}, {"prop": "from_position", "type": "text", "label": "原岗位"}, {"prop": "to_position", "type": "text", "label": "新岗位"}, {"prop": "effective_date", "type": "text", "label": "生效日期"}, {"prop": "transfer_type", "type": "select", "label": "调岗类型", "options": [{"label": "平调", "value": "平调"}, {"label": "晋升", "value": "晋升"}, {"label": "降级", "value": "降级"}]}, {"prop": "transfer_reason", "type": "text", "label": "调岗原因"}, {"prop": "approver", "type": "text", "label": "审批人"}]	\N
form_templates	[{"id": "transfer_record", "name": "调岗记录单", "schema": {"docNo": "employee_no", "title": "调岗记录单", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "widget": "input", "editable": false}, {"field": "name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号", "widget": "input", "editable": false}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "status", "label": "状态", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "调岗信息", "children": [{"field": "from_dept", "label": "原部门", "widget": "input"}, {"field": "to_dept", "label": "新部门", "widget": "input"}, {"field": "from_position", "label": "原岗位", "widget": "input"}, {"field": "to_position", "label": "新岗位", "widget": "input"}, {"field": "effective_date", "label": "生效日期", "widget": "date"}, {"field": "transfer_type", "label": "调岗类型", "widget": "select", "options": [{"label": "平调", "value": "平调"}, {"label": "晋升", "value": "晋升"}, {"label": "降级", "value": "降级"}]}, {"field": "transfer_reason", "label": "调岗原因", "widget": "textarea"}, {"field": "approver", "label": "审批人", "widget": "input"}]}], "docType": "transfer_record"}, "source": "ai", "created_at": "2026-01-24T19:58:19.366Z", "updated_at": "2026-01-24T19:58:19.366Z"}, {"id": "attendance_record", "name": "考勤记录单", "schema": {"docNo": "employee_no", "title": "考勤记录单", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "employee_name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号/电话", "widget": "input"}, {"field": "dept_name", "label": "部门", "widget": "input"}, {"field": "att_date", "label": "日期", "widget": "date"}]}, {"cols": 2, "type": "section", "title": "班次与打卡", "children": [{"field": "shift_name", "label": "班次", "widget": "input"}, {"field": "punch_times", "label": "打卡记录", "widget": "textarea"}, {"field": "check_in", "label": "签到时间", "widget": "input"}, {"field": "check_out", "label": "签退时间", "widget": "input"}]}, {"cols": 4, "type": "section", "title": "考勤状态", "children": [{"field": "late_flag", "label": "迟到", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "early_flag", "label": "早退", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "leave_flag", "label": "请假", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "absent_flag", "label": "缺勤", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "att_status", "label": "考勤状态", "widget": "select", "options": [{"label": "正常", "value": "正常"}, {"label": "迟到", "value": "迟到"}, {"label": "早退", "value": "早退"}, {"label": "缺勤", "value": "缺勤"}, {"label": "请假", "value": "请假"}]}]}, {"cols": 2, "type": "section", "title": "加班与备注", "children": [{"field": "overtime_minutes", "label": "加班(分钟)", "widget": "number"}, {"field": "ot_hours", "label": "加班时长", "widget": "input"}, {"field": "remark", "label": "备注", "widget": "textarea"}, {"field": "att_note", "label": "备注", "widget": "textarea"}]}], "docType": "attendance_record"}, "source": "ai", "created_at": "2026-01-24T19:25:56.311Z", "updated_at": "2026-01-24T19:25:56.311Z"}, {"id": "employee_profile", "name": "员工详细档案表", "schema": {"docNo": "employee_no", "title": "员工详细档案表", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "value": "688", "widget": "input"}, {"field": "name", "label": "姓名", "value": "惠晨丽", "widget": "input"}, {"field": "employee_no", "label": "工号", "value": "E0100", "widget": "input"}, {"field": "department", "label": "部门", "value": "行政部", "widget": "input"}, {"field": "status", "label": "状态", "value": "试用", "widget": "input"}, {"field": "gender", "label": "性别", "value": "男", "widget": "input"}, {"field": "id_card", "label": "身份证", "widget": "input"}, {"field": "field_3410", "label": "籍贯", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "薪资信息", "children": [{"field": "field_5458", "label": "工资", "widget": "input"}, {"field": "field_9314", "label": "绩效", "widget": "input"}, {"field": "field_789", "label": "总工资", "value": 0, "widget": "input", "disabled": true}]}, {"cols": 2, "type": "section", "title": "分类信息", "children": [{"field": "field_8633", "label": "1", "value": "1", "widget": "select", "options": [{"type": "success", "label": "1", "value": "1"}, {"type": "warning", "label": "2", "value": "2"}, {"type": "danger", "label": "3", "value": "3"}, {"type": "info", "label": "4", "value": "4"}, {"type": "", "label": "5", "value": "5"}, {"type": "", "label": "6", "value": "6"}, {"type": "", "label": "7", "value": "7"}]}, {"field": "field_2086", "label": "2", "value": "1", "widget": "cascader", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}, {"label": "5", "value": "5"}], "3": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "4": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "5": [{"label": "1", "value": "1"}], "6": [{"label": "1", "value": "1"}], "7": [{"label": "1", "value": "1"}]}}, {"field": "field_7980", "label": "3", "value": "1", "widget": "cascader", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "3": [{"label": "1", "value": "1"}], "4": [{"label": "2", "value": "2"}], "5": [{"label": "3", "value": "3"}]}}]}, {"cols": 2, "type": "section", "title": "其他信息", "children": [{"field": "field_1340", "label": "位置", "widget": "input", "geoAddress": true}, {"field": "field_3727", "label": "员工照片", "widget": "image", "fileSource": "field_3727"}]}], "docType": "employee_profile"}, "source": "ai", "created_at": "2025-12-30T19:26:26.913Z", "updated_at": "2025-12-30T19:26:26.913Z"}, {"id": "employee_detail", "name": "员工信息表", "schema": {"docNo": "id", "title": "员工信息表", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "widget": "input"}, {"field": "name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号", "widget": "input"}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "status", "label": "状态", "widget": "input"}, {"field": "gender", "label": "性别", "widget": "input"}, {"field": "id_card", "label": "身份证", "widget": "input"}, {"field": "field_3410", "label": "籍贯", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "薪资信息", "children": [{"field": "field_5458", "label": "工资", "widget": "input"}, {"field": "field_9314", "label": "绩效", "widget": "input"}, {"field": "field_789", "label": "总工资", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "其他信息", "children": [{"field": "field_8633", "label": "1", "widget": "select"}, {"field": "field_2086", "label": "2", "widget": "cascader"}, {"field": "field_7980", "label": "3", "widget": "cascader"}, {"field": "field_1340", "label": "位置", "widget": "geo"}, {"field": "field_3727", "label": "员工照片", "widget": "image", "fileSource": "field_3727"}]}], "docType": "employee_detail"}, "source": "ai", "created_at": "2025-12-30T13:59:49.163Z", "updated_at": "2025-12-30T13:59:49.163Z"}, {"id": "hr_form", "name": "人事信息表", "schema": {"docNo": "hr_no", "title": "人事信息表", "layout": [{"cols": 2, "type": "section", "title": "个人信息", "children": [{"field": "name", "label": "姓名", "widget": "input"}, {"field": "gender", "label": "性别", "widget": "input"}, {"field": "birth_date", "label": "出生日期", "widget": "date"}, {"field": "ethnicity", "label": "民族", "widget": "input"}, {"field": "id_card", "label": "身份证号", "widget": "input"}, {"field": "phone", "label": "联系电话", "widget": "input"}, {"field": "email", "label": "电子邮箱", "widget": "input"}, {"field": "address", "label": "现住址", "widget": "textarea"}]}, {"cols": 2, "type": "section", "title": "工作信息", "children": [{"field": "employee_no", "label": "员工编号", "widget": "input"}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "position", "label": "职位", "widget": "input"}, {"field": "entry_date", "label": "入职日期", "widget": "date"}, {"field": "contract_period", "label": "合同期限", "widget": "input"}, {"field": "contract_start_date", "label": "合同起始日期", "widget": "date"}, {"field": "contract_end_date", "label": "合同结束日期", "widget": "date"}, {"field": "supervisor", "label": "直属上级", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "紧急联系人", "children": [{"field": "emergency_contact_name", "label": "姓名", "widget": "input"}, {"field": "emergency_contact_relation", "label": "关系", "widget": "input"}, {"field": "emergency_contact_phone", "label": "联系电话", "widget": "input"}]}], "docType": "hr_form"}, "source": "ai", "created_at": "2025-12-30T13:51:48.884Z", "updated_at": "2025-12-30T13:51:48.884Z"}]	\N
hr_table_cols	[{"prop": "gender", "label": "性别"}, {"prop": "id_card", "label": "身份证"}, {"prop": "field_3410", "label": "籍贯"}, {"prop": "field_5458", "type": "text", "label": "工资"}, {"prop": "field_9314", "type": "text", "label": "绩效"}, {"prop": "field_789", "type": "formula", "label": "总工资", "expression": "{工资}+{绩效}"}, {"tag": true, "prop": "field_8633", "type": "select", "label": "1", "options": [{"type": "success", "label": "1", "value": "1"}, {"type": "warning", "label": "2", "value": "2"}, {"type": "danger", "label": "3", "value": "3"}, {"type": "info", "label": "4", "value": "4"}, {"type": "", "label": "5", "value": "5"}, {"type": "", "label": "6", "value": "6"}, {"type": "", "label": "7", "value": "7"}]}, {"prop": "field_2086", "type": "cascader", "label": "2", "dependsOn": "field_8633", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}, {"label": "5", "value": "5"}], "3": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "4": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "5": [{"label": "1", "value": "1"}], "6": [{"label": "1", "value": "1"}], "7": [{"label": "1", "value": "1"}]}}, {"prop": "field_7980", "type": "cascader", "label": "3", "dependsOn": "field_2086", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "3": [{"label": "1", "value": "1"}], "4": [{"label": "2", "value": "2"}], "5": [{"label": "3", "value": "3"}]}}, {"prop": "field_1340", "type": "geo", "label": "位置", "geoAddress": true}, {"prop": "field_3727", "type": "file", "label": "员工照片", "fileAccept": "", "fileMaxCount": 3, "fileMaxSizeMb": 20}, {"prop": "field_3986", "type": "select", "label": "性别1", "options": [{"label": "男", "value": "男"}, {"label": "女", "value": "女"}]}]	HR花名册的动态列配置
materials_table_cols	[{"prop": "spec", "type": "text", "label": "规格"}, {"prop": "unit", "type": "text", "label": "单位"}, {"prop": "measure_unit", "type": "text", "label": "计量单位"}, {"prop": "conversion", "type": "text", "label": "换算关系"}, {"prop": "finance_attribute", "type": "text", "label": "财务属性"}]	\N
materials_categories	[{"id": "cat_raw", "label": "原料", "children": []}, {"id": "cat_aux", "label": "辅料"}, {"id": "cat_pack", "label": "包装材料"}]	\N
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
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, role, avatar, permissions, full_name, phone, email, dept_id, status, created_at, updated_at, position_id) FROM stdin;
4	dept_manager	123456	dept_manager	\N	\N	Dept Manager	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	c8de51d4-bf7c-417d-baf0-0e3c8a372928
5	employee	123456	employee	\N	\N	Employee	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	928bca4f-0a23-41c7-948c-61a8a30ce5cf
2	hr_admin	123456	hr_admin	\N	{hr:employee.view,hr:employee.create,hr:employee.edit,hr:employee.delete,hr:employee.export,hr:employee.config,hr:org.view,hr:org.create,hr:org.edit,hr:org.delete,hr:org.export,hr:org.config,hr:change.view,hr:change.create,hr:change.edit,hr:change.delete,hr:change.export,hr:attendance.view,hr:attendance.create,hr:attendance.edit,hr:attendance.delete,hr:attendance.export,hr:payroll.view,hr:payroll.create,hr:payroll.edit,hr:payroll.delete,hr:payroll.export,hr:profile.view,hr:profile.create,hr:profile.edit,hr:profile.delete,hr:profile.export}	HR Admin	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	5c95c523-1cae-4c6c-a540-f1977de4058e
3	hr_clerk	123456	hr_clerk	\N	\N	HR Clerk	\N	\N	\N	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	c6978198-989f-48c4-a9e4-a746e3dfa81e
1	admin	123456	super_admin	\N	{hr:employee.view,hr:employee.create,hr:employee.edit,hr:employee.delete,hr:employee.export,hr:employee.config,hr:org.view,hr:org.create,hr:org.edit,hr:org.delete,hr:org.export,hr:org.config,hr:change.view,hr:change.create,hr:change.edit,hr:change.delete,hr:change.export,hr:attendance.view,hr:attendance.create,hr:attendance.edit,hr:attendance.delete,hr:attendance.export,hr:payroll.view,hr:payroll.create,hr:payroll.edit,hr:payroll.delete,hr:payroll.export,hr:profile.view,hr:profile.create,hr:profile.edit,hr:profile.delete,hr:profile.export}	\N	\N	\N	\N	active	2026-01-16 15:25:52.722816+00	2026-01-16 15:25:52.728626+00	032d10a0-c0a3-46ed-a304-a2395ffe3ee0
\.


--
-- Name: archives_id_seq; Type: SEQUENCE SET; Schema: hr; Owner: postgres
--

SELECT pg_catalog.setval('hr.archives_id_seq', 802, true);


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

SELECT pg_catalog.setval('public.raw_materials_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


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
-- Name: permissions tg_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_permissions_updated_at BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: role_data_scopes tg_role_data_scopes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_role_data_scopes_updated_at BEFORE UPDATE ON public.role_data_scopes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: roles tg_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sys_field_acl tg_sys_field_acl_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_sys_field_acl_updated_at BEFORE UPDATE ON public.sys_field_acl FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: raw_materials trg_eis_notify_public_raw_materials; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_eis_notify_public_raw_materials AFTER INSERT OR DELETE OR UPDATE ON public.raw_materials FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: files trg_files_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


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
-- Name: raw_materials Users can only see their own data; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can only see their own data" ON public.raw_materials FOR SELECT TO web_user USING ((created_by = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)));


--
-- Name: raw_materials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

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
-- Name: FUNCTION login(username text, password text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.login(username text, password text) TO web_anon;


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
-- PostgreSQL database dump complete
--

\unrestrict aLHhf61RPyg0ZaZfHKTmTeHDBrNXGuFtzYFZ7awmpL0u8MnGHxB6fou3ESdhI4I

