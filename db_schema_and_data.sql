--
-- PostgreSQL database dump
--

\restrict u186wHA6vfojEmp6xBrc9DioIr5UAGkowFjBM7JAzmQRqEEvGZHf1YA3mP2pM0k

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
700	史俊晨	E0001	研发部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
701	王安桐	E0002	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
702	应军超	E0003	行政部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
703	傅凯妍	E0004	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
704	禹怡军	E0005	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
705	宣睿	E0006	客服部	\N	\N	离职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
706	巫涵	E0007	行政部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
707	曲豪珂	E0008	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
708	储宇雪	E0009	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
709	封瑶晨	E0010	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
710	萧勇欣	E0011	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
711	杜桐	E0012	行政部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
712	郁雪超	E0013	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
713	柯芳敏	E0014	财务部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
714	龚宇勇	E0015	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
715	山桐梦	E0016	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
716	徐子	E0017	研发部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
717	惠杰	E0018	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
718	葛雪	E0019	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
719	臧桐	E0020	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
720	何安静	E0021	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
721	范皓勇	E0022	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
722	焦梦曦	E0023	财务部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
723	吴欣超	E0024	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
724	唐宇	E0025	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
725	任雪彬	E0026	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
726	闵鑫鑫	E0027	行政部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
727	沈萱鹏	E0028	财务部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
728	华浩杰	E0029	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
729	倪墨	E0030	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
730	李安	E0031	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
731	阮曦颖	E0032	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
732	徐睿宸	E0033	生产部	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
733	韩欣敏	E0034	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
734	万轩敏	E0035	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
735	巴墨芳	E0036	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
736	富欣瑶	E0037	行政部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
737	邹琪轩	E0038	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
738	曹宇桐	E0039	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
739	贺超豪	E0040	采购部	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
740	顾琪婷	E0041	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
741	常睿皓	E0042	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
742	沈安梦	E0043	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
743	郝磊博	E0044	生产部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
744	车曦军	E0045	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
745	戴曦	E0046	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
746	严强	E0047	生产部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
747	鲁桐珊	E0048	财务部	\N	\N	试用	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
748	倪宸浩	E0049	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
749	花瑜	E0050	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
750	苗勇静	E0051	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
751	缪彬	E0052	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
752	陈嘉婉	E0053	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
753	魏伟	E0054	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
754	莫瑾宸	E0055	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
755	乌彬鑫	E0056	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
756	蓝瑶婷	E0057	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
757	荣琳博	E0058	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
758	左怡轩	E0059	生产部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
759	彭琪桐	E0060	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
760	薛萱琳	E0061	研发部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
761	陆轩	E0062	质量管理部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
762	霍勇鹏	E0063	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
763	鲁瑾	E0064	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
764	姜丽轩	E0065	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
765	支敏	E0066	研发部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
766	钟皓	E0067	信息化/IT部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": 0}	1	2026-01-24 17:48:02.917123
767	梅宇悦	E0068	研发部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
768	柏凯浩	E0069	采购部	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
769	解丽欣	E0070	质量管理部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
770	诸伟婉	E0071	财务部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
771	应瑾怡	E0072	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
772	董彬雯	E0073	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
773	裘亦	E0074	客服部	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
774	喻墨敏	E0075	行政部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
775	祁昕	E0076	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
776	周珂婉	E0077	采购部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
777	花豪倩	E0078	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
778	袁丽珂	E0079	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
779	郑杰颖	E0080	质量管理部	\N	\N	离职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
780	惠浩萱	E0081	财务部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
781	巫超鹏	E0082	研发部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
782	颜超轩	E0083	销售部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
783	靳宸杰	E0084	客服部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
784	安博	E0085	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
785	洪悦妍	E0086	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
786	米瑾梦	E0087	生产部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
787	马安瑾	E0088	行政部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
788	林雯琪	E0089	人力资源部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
789	宋娜婉	E0090	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
790	黄皓宸	E0091	财务部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
791	车鹏睿	E0092	设备维护部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
792	余涵萱	E0093	人力资源部	\N	\N	离职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
793	宣睿婷	E0094	生产部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
794	齐娜妍	E0095	研发部	\N	\N	试用	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
795	魏瑜墨	E0096	质量管理部	\N	\N	试用	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
796	单杰悦	E0097	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
797	翁涵	E0098	仓储物流部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
798	童杰敏	E0099	财务部	\N	\N	在职	0.00	2026-01-24	{"gender": "女", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
799	惠晨丽	E0100	行政部	\N	\N	试用	0.00	2026-01-24	{"gender": "男", "field_5458": "0", "field_9314": "0"}	1	2026-01-24 17:48:02.917123
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
0d48e5d2-9fb2-4425-8633-1281f18f89ec	行政部	\N	\N	10	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
91bf9316-84fa-4093-9919-7b4610908a26	人力资源部	\N	\N	20	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
0a24e743-1029-46cc-a97d-994f23958ace	仓储物流部	\N	\N	70	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
e64667e9-94ce-45e0-9a37-13c14ff96546	信息化/IT部	\N	\N	120	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
241eaebd-d8c8-4e0a-94b2-4f5103431eab	采购部	\N	\N	80	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
57b1963a-c470-4722-8304-5231ea34abae	客服部	\N	\N	110	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
48263242-95e1-4e97-9b8b-b4a7b6e29e4e	生产部	\N	\N	40	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
69aa4c1e-d18e-4fe6-8f6a-56536dbdfdba	研发部	\N	\N	30	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
76467e33-7074-4793-84f3-f2c7403d52e0	质量管理部	\N	\N	50	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
dca07e5f-653c-4af4-8494-525bb25a6703	销售部	\N	\N	100	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
3a247a02-1b60-462c-b37b-1a75be534368	设备维护部	\N	\N	60	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
239ddda2-2fd5-4cac-9940-0f63872854d4	财务部	\N	\N	90	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
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
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, code, name, module, action, created_at, updated_at) FROM stdin;
749a0f67-dc5b-4b61-be56-4b1859260ad1	hr:employee.view	Employee View	hr	view	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
0da90206-1c4b-48b3-9be4-36cbdb58e1b8	hr:employee.create	Employee Create	hr	create	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
1c507edf-adb5-4f35-ac70-da6daa6a9f7e	hr:employee.edit	Employee Edit	hr	edit	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
df4fde3f-17ac-47fb-b513-6c64ea71d137	hr:employee.delete	Employee Delete	hr	delete	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
e0baac90-7926-4337-a3fb-f5c1f6a77966	hr:employee.export	Employee Export	hr	export	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
00a17c4e-e84e-4f61-8610-e18d73ed17c6	hr:employee.config	Employee Config	hr	config	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
23bd6bc7-1717-4c2a-be99-42093e2c4a96	hr:org.view	Org View	hr	view	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
22607dfa-0016-447d-9382-af4ff3f72958	hr:org.create	Org Create	hr	create	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
5db69a98-dc1c-45b8-85f0-2f5fa94ec2ad	hr:org.edit	Org Edit	hr	edit	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
7c80805f-47bd-46d6-a80e-f195cc0be2ff	hr:org.delete	Org Delete	hr	delete	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
f9a66726-7fcb-4596-81f5-5c558e06e69d	hr:org.export	Org Export	hr	export	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
27ab46fc-3086-41c5-8ee2-4867ce222c7d	hr:org.config	Org Config	hr	config	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
da0914e1-5105-4156-9a46-cb4a36f95518	hr:change.view	Change View	hr	view	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
6d23e088-f7d9-49fe-bb07-cee9c3fe9c18	hr:change.create	Change Create	hr	create	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
0cbdfa8a-948e-407d-9a6f-f4e1784ecbd7	hr:change.edit	Change Edit	hr	edit	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
cca47339-1940-4c27-94cf-66f89923888f	hr:change.delete	Change Delete	hr	delete	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
2c9ed352-5d9c-4f8b-8993-68ec3e67a5b5	hr:change.export	Change Export	hr	export	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
9da35eef-2dab-4a37-bc95-73e12284c86e	hr:attendance.view	Attendance View	hr	view	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
fe698f3c-4a79-4e5c-8147-2324e10117be	hr:attendance.create	Attendance Create	hr	create	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
b57c9900-909d-4528-89b4-8c4910bfcdb8	hr:attendance.edit	Attendance Edit	hr	edit	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
cf33aaf0-be78-46ef-a3a8-ad0eea93f67e	hr:attendance.delete	Attendance Delete	hr	delete	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
23c8f1bf-23e5-46bc-a965-e4f74a9c5bd5	hr:attendance.export	Attendance Export	hr	export	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
7dff6243-ab88-4090-ad3e-f7419176d4e6	hr:payroll.view	Payroll View	hr	view	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
7d97095f-1371-4aee-99b3-e69cc5cad037	hr:payroll.create	Payroll Create	hr	create	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
e8bfa2dc-ab95-4970-a245-0d0b31f316a2	hr:payroll.edit	Payroll Edit	hr	edit	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
bb89aa41-93b0-4da9-99f0-5b2d20525a50	hr:payroll.delete	Payroll Delete	hr	delete	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
6f212a0f-c0d4-472d-a889-34a6f9ce3f7c	hr:payroll.export	Payroll Export	hr	export	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
37396318-923d-4fcd-bc17-8fd584200def	hr:profile.view	Profile View	hr	view	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
a53b2f02-f4b7-4c22-9c43-637e19f94ab5	hr:profile.create	Profile Create	hr	create	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
6108f0ae-516c-459f-92c7-cbab491d3c9b	hr:profile.edit	Profile Edit	hr	edit	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
938f813c-f070-460a-b9f3-b34e537e01bd	hr:profile.delete	Profile Delete	hr	delete	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
96dcd908-214a-4842-beed-c6df4b34dc71	hr:profile.export	Profile Export	hr	export	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
\.


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.positions (id, name, dept_id, level, status, created_at, updated_at) FROM stdin;
032d10a0-c0a3-46ed-a304-a2395ffe3ee0	行政主管	0d48e5d2-9fb2-4425-8633-1281f18f89ec	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
a965d683-da64-4dd5-8e51-9f78f1c5ddad	行政专员	0d48e5d2-9fb2-4425-8633-1281f18f89ec	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
5c95c523-1cae-4c6c-a540-f1977de4058e	HR主管	91bf9316-84fa-4093-9919-7b4610908a26	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
c6978198-989f-48c4-a9e4-a746e3dfa81e	招聘专员	91bf9316-84fa-4093-9919-7b4610908a26	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
284f35ea-a41f-47d8-a932-b37e1a1dca2f	物流专员	0a24e743-1029-46cc-a97d-994f23958ace	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
8062bf92-bcda-49c6-892e-febd2fdb9b3e	仓管员	0a24e743-1029-46cc-a97d-994f23958ace	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
104f3d80-c9a8-4c45-8a74-0c489b4f0ad8	IT主管	e64667e9-94ce-45e0-9a37-13c14ff96546	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
a017fd86-9ccd-45dc-94f9-ebcd388555df	运维工程师	e64667e9-94ce-45e0-9a37-13c14ff96546	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
d74b2d80-7685-43fb-ad90-d908e4320c20	采购主管	241eaebd-d8c8-4e0a-94b2-4f5103431eab	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
529c6605-6a79-424d-b7ac-6e1064ce6ba0	采购员	241eaebd-d8c8-4e0a-94b2-4f5103431eab	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
5191e259-d7a6-4014-a9ff-8348c1778605	客服主管	57b1963a-c470-4722-8304-5231ea34abae	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
1bfa1a1a-cdef-49df-8b8e-1e2490b24b7e	客服专员	57b1963a-c470-4722-8304-5231ea34abae	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
c8de51d4-bf7c-417d-baf0-0e3c8a372928	生产主管	48263242-95e1-4e97-9b8b-b4a7b6e29e4e	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
928bca4f-0a23-41c7-948c-61a8a30ce5cf	生产工	48263242-95e1-4e97-9b8b-b4a7b6e29e4e	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
ef2ea270-6813-4c78-a1e6-0c446ae47005	后端工程师	69aa4c1e-d18e-4fe6-8f6a-56536dbdfdba	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
2d4b8fb8-a02e-40d3-9fe9-00511e7efb06	前端工程师	69aa4c1e-d18e-4fe6-8f6a-56536dbdfdba	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
a6414079-83d9-4a89-ac90-7018b91d026e	质检主管	76467e33-7074-4793-84f3-f2c7403d52e0	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
94f36b7b-93cc-41e0-8472-e28fccbf5f60	质检员	76467e33-7074-4793-84f3-f2c7403d52e0	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
cc3ac529-4e56-4978-a462-d338ed8d36f8	销售主管	dca07e5f-653c-4af4-8494-525bb25a6703	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
5fc8fcd9-e5e4-4fd9-9337-493aa955b093	销售专员	dca07e5f-653c-4af4-8494-525bb25a6703	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
76c01715-a79f-46bf-bbe2-e05ce500249c	维修工	3a247a02-1b60-462c-b37b-1a75be534368	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
d65577e9-360f-45c9-8f11-25e254bdee82	设备工程师	3a247a02-1b60-462c-b37b-1a75be534368	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
d077210f-2b70-49aa-b8b2-9699dd0fd28e	出纳	239ddda2-2fd5-4cac-9940-0f63872854d4	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
f7df5b02-b698-4b1c-bf3d-f1a8840ba01e	会计	239ddda2-2fd5-4cac-9940-0f63872854d4	\N	active	2026-01-16 15:31:07.495947+00	2026-01-16 15:31:07.495947+00
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
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, code, name, description, created_at, updated_at) FROM stdin;
acf335a2-f56f-4aca-bb4d-682553c8e5ec	super_admin	Super Admin	All permissions	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
f0c1fe49-34a3-4025-a0bc-0a7f81c313c8	hr_admin	HR Admin	HR full access	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
dab1f261-b0ef-4050-82d4-251514f9041b	hr_clerk	HR Clerk	HR edit access	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
e1ba01bc-955c-4d41-9ed8-35dfd8644320	dept_manager	Dept Manager	Department manager	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
11965ac4-0b1b-4545-a2b0-c9d32d7a49ba	employee	Employee	Regular employee	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00
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
hr_table_cols	[{"prop": "gender", "label": "性别"}, {"prop": "id_card", "label": "身份证"}, {"prop": "field_3410", "label": "籍贯"}, {"prop": "field_5458", "type": "text", "label": "工资"}, {"prop": "field_9314", "type": "text", "label": "绩效"}, {"prop": "field_789", "type": "formula", "label": "总工资", "expression": "{工资}+{绩效}"}, {"tag": true, "prop": "field_8633", "type": "select", "label": "1", "options": [{"type": "success", "label": "1", "value": "1"}, {"type": "warning", "label": "2", "value": "2"}, {"type": "danger", "label": "3", "value": "3"}, {"type": "info", "label": "4", "value": "4"}, {"type": "", "label": "5", "value": "5"}, {"type": "", "label": "6", "value": "6"}, {"type": "", "label": "7", "value": "7"}]}, {"prop": "field_2086", "type": "cascader", "label": "2", "dependsOn": "field_8633", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}, {"label": "5", "value": "5"}], "3": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "4": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "5": [{"label": "1", "value": "1"}], "6": [{"label": "1", "value": "1"}], "7": [{"label": "1", "value": "1"}]}}, {"prop": "field_7980", "type": "cascader", "label": "3", "dependsOn": "field_2086", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "3": [{"label": "1", "value": "1"}], "4": [{"label": "2", "value": "2"}], "5": [{"label": "3", "value": "3"}]}}, {"prop": "field_1340", "type": "geo", "label": "位置", "geoAddress": true}, {"prop": "field_3727", "type": "file", "label": "员工照片", "fileAccept": "", "fileMaxCount": 3, "fileMaxSizeMb": 20}]	HR花名册的动态列配置
hr_transfer_cols	[{"prop": "from_dept", "type": "text", "label": "原部门"}, {"prop": "to_dept", "type": "text", "label": "新部门"}, {"prop": "from_position", "type": "text", "label": "原岗位"}, {"prop": "to_position", "type": "text", "label": "新岗位"}, {"prop": "effective_date", "type": "text", "label": "生效日期"}, {"prop": "transfer_type", "type": "select", "label": "调岗类型", "options": [{"label": "平调", "value": "平调"}, {"label": "晋升", "value": "晋升"}, {"label": "降级", "value": "降级"}]}, {"prop": "transfer_reason", "type": "text", "label": "调岗原因"}, {"prop": "approver", "type": "text", "label": "审批人"}]	\N
form_templates	[{"id": "transfer_record", "name": "调岗记录单", "schema": {"docNo": "employee_no", "title": "调岗记录单", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "widget": "input", "editable": false}, {"field": "name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号", "widget": "input", "editable": false}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "status", "label": "状态", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "调岗信息", "children": [{"field": "from_dept", "label": "原部门", "widget": "input"}, {"field": "to_dept", "label": "新部门", "widget": "input"}, {"field": "from_position", "label": "原岗位", "widget": "input"}, {"field": "to_position", "label": "新岗位", "widget": "input"}, {"field": "effective_date", "label": "生效日期", "widget": "date"}, {"field": "transfer_type", "label": "调岗类型", "widget": "select", "options": [{"label": "平调", "value": "平调"}, {"label": "晋升", "value": "晋升"}, {"label": "降级", "value": "降级"}]}, {"field": "transfer_reason", "label": "调岗原因", "widget": "textarea"}, {"field": "approver", "label": "审批人", "widget": "input"}]}], "docType": "transfer_record"}, "source": "ai", "created_at": "2026-01-24T19:58:19.366Z", "updated_at": "2026-01-24T19:58:19.366Z"}, {"id": "attendance_record", "name": "考勤记录单", "schema": {"docNo": "employee_no", "title": "考勤记录单", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "employee_name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号/电话", "widget": "input"}, {"field": "dept_name", "label": "部门", "widget": "input"}, {"field": "att_date", "label": "日期", "widget": "date"}]}, {"cols": 2, "type": "section", "title": "班次与打卡", "children": [{"field": "shift_name", "label": "班次", "widget": "input"}, {"field": "punch_times", "label": "打卡记录", "widget": "textarea"}, {"field": "check_in", "label": "签到时间", "widget": "input"}, {"field": "check_out", "label": "签退时间", "widget": "input"}]}, {"cols": 4, "type": "section", "title": "考勤状态", "children": [{"field": "late_flag", "label": "迟到", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "early_flag", "label": "早退", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "leave_flag", "label": "请假", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "absent_flag", "label": "缺勤", "widget": "select", "options": [{"label": "否", "value": false}, {"label": "是", "value": true}]}, {"field": "att_status", "label": "考勤状态", "widget": "select", "options": [{"label": "正常", "value": "正常"}, {"label": "迟到", "value": "迟到"}, {"label": "早退", "value": "早退"}, {"label": "缺勤", "value": "缺勤"}, {"label": "请假", "value": "请假"}]}]}, {"cols": 2, "type": "section", "title": "加班与备注", "children": [{"field": "overtime_minutes", "label": "加班(分钟)", "widget": "number"}, {"field": "ot_hours", "label": "加班时长", "widget": "input"}, {"field": "remark", "label": "备注", "widget": "textarea"}, {"field": "att_note", "label": "备注", "widget": "textarea"}]}], "docType": "attendance_record"}, "source": "ai", "created_at": "2026-01-24T19:25:56.311Z", "updated_at": "2026-01-24T19:25:56.311Z"}, {"id": "employee_profile", "name": "员工详细档案表", "schema": {"docNo": "employee_no", "title": "员工详细档案表", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "value": "688", "widget": "input"}, {"field": "name", "label": "姓名", "value": "惠晨丽", "widget": "input"}, {"field": "employee_no", "label": "工号", "value": "E0100", "widget": "input"}, {"field": "department", "label": "部门", "value": "行政部", "widget": "input"}, {"field": "status", "label": "状态", "value": "试用", "widget": "input"}, {"field": "gender", "label": "性别", "value": "男", "widget": "input"}, {"field": "id_card", "label": "身份证", "widget": "input"}, {"field": "field_3410", "label": "籍贯", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "薪资信息", "children": [{"field": "field_5458", "label": "工资", "widget": "input"}, {"field": "field_9314", "label": "绩效", "widget": "input"}, {"field": "field_789", "label": "总工资", "value": 0, "widget": "input", "disabled": true}]}, {"cols": 2, "type": "section", "title": "分类信息", "children": [{"field": "field_8633", "label": "1", "value": "1", "widget": "select", "options": [{"type": "success", "label": "1", "value": "1"}, {"type": "warning", "label": "2", "value": "2"}, {"type": "danger", "label": "3", "value": "3"}, {"type": "info", "label": "4", "value": "4"}, {"type": "", "label": "5", "value": "5"}, {"type": "", "label": "6", "value": "6"}, {"type": "", "label": "7", "value": "7"}]}, {"field": "field_2086", "label": "2", "value": "1", "widget": "cascader", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}, {"label": "5", "value": "5"}], "3": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "4": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "5": [{"label": "1", "value": "1"}], "6": [{"label": "1", "value": "1"}], "7": [{"label": "1", "value": "1"}]}}, {"field": "field_7980", "label": "3", "value": "1", "widget": "cascader", "cascaderOptions": {"1": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "2": [{"label": "1", "value": "1"}, {"label": "2", "value": "2"}, {"label": "3", "value": "3"}, {"label": "4", "value": "4"}], "3": [{"label": "1", "value": "1"}], "4": [{"label": "2", "value": "2"}], "5": [{"label": "3", "value": "3"}]}}]}, {"cols": 2, "type": "section", "title": "其他信息", "children": [{"field": "field_1340", "label": "位置", "widget": "input", "geoAddress": true}, {"field": "field_3727", "label": "员工照片", "widget": "image", "fileSource": "field_3727"}]}], "docType": "employee_profile"}, "source": "ai", "created_at": "2025-12-30T19:26:26.913Z", "updated_at": "2025-12-30T19:26:26.913Z"}, {"id": "employee_detail", "name": "员工信息表", "schema": {"docNo": "id", "title": "员工信息表", "layout": [{"cols": 2, "type": "section", "title": "基本信息", "children": [{"field": "id", "label": "编号", "widget": "input"}, {"field": "name", "label": "姓名", "widget": "input"}, {"field": "employee_no", "label": "工号", "widget": "input"}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "status", "label": "状态", "widget": "input"}, {"field": "gender", "label": "性别", "widget": "input"}, {"field": "id_card", "label": "身份证", "widget": "input"}, {"field": "field_3410", "label": "籍贯", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "薪资信息", "children": [{"field": "field_5458", "label": "工资", "widget": "input"}, {"field": "field_9314", "label": "绩效", "widget": "input"}, {"field": "field_789", "label": "总工资", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "其他信息", "children": [{"field": "field_8633", "label": "1", "widget": "select"}, {"field": "field_2086", "label": "2", "widget": "cascader"}, {"field": "field_7980", "label": "3", "widget": "cascader"}, {"field": "field_1340", "label": "位置", "widget": "geo"}, {"field": "field_3727", "label": "员工照片", "widget": "image", "fileSource": "field_3727"}]}], "docType": "employee_detail"}, "source": "ai", "created_at": "2025-12-30T13:59:49.163Z", "updated_at": "2025-12-30T13:59:49.163Z"}, {"id": "hr_form", "name": "人事信息表", "schema": {"docNo": "hr_no", "title": "人事信息表", "layout": [{"cols": 2, "type": "section", "title": "个人信息", "children": [{"field": "name", "label": "姓名", "widget": "input"}, {"field": "gender", "label": "性别", "widget": "input"}, {"field": "birth_date", "label": "出生日期", "widget": "date"}, {"field": "ethnicity", "label": "民族", "widget": "input"}, {"field": "id_card", "label": "身份证号", "widget": "input"}, {"field": "phone", "label": "联系电话", "widget": "input"}, {"field": "email", "label": "电子邮箱", "widget": "input"}, {"field": "address", "label": "现住址", "widget": "textarea"}]}, {"cols": 2, "type": "section", "title": "工作信息", "children": [{"field": "employee_no", "label": "员工编号", "widget": "input"}, {"field": "department", "label": "部门", "widget": "input"}, {"field": "position", "label": "职位", "widget": "input"}, {"field": "entry_date", "label": "入职日期", "widget": "date"}, {"field": "contract_period", "label": "合同期限", "widget": "input"}, {"field": "contract_start_date", "label": "合同起始日期", "widget": "date"}, {"field": "contract_end_date", "label": "合同结束日期", "widget": "date"}, {"field": "supervisor", "label": "直属上级", "widget": "input"}]}, {"cols": 2, "type": "section", "title": "紧急联系人", "children": [{"field": "emergency_contact_name", "label": "姓名", "widget": "input"}, {"field": "emergency_contact_relation", "label": "关系", "widget": "input"}, {"field": "emergency_contact_phone", "label": "联系电话", "widget": "input"}]}], "docType": "hr_form"}, "source": "ai", "created_at": "2025-12-30T13:51:48.884Z", "updated_at": "2025-12-30T13:51:48.884Z"}]	\N
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
1	admin	123456	super_admin	\N	{hr:employee.view,hr:employee.create,hr:employee.edit,hr:employee.delete,hr:employee.export,hr:employee.config,hr:org.view,hr:org.create,hr:org.edit,hr:org.delete,hr:org.export,hr:org.config,hr:change.view,hr:change.create,hr:change.edit,hr:change.delete,hr:change.export,hr:attendance.view,hr:attendance.create,hr:attendance.edit,hr:attendance.delete,hr:attendance.export,hr:payroll.view,hr:payroll.create,hr:payroll.edit,hr:payroll.delete,hr:payroll.export,hr:profile.view,hr:profile.create,hr:profile.edit,hr:profile.delete,hr:profile.export}	\N	\N	\N	0d48e5d2-9fb2-4425-8633-1281f18f89ec	active	2026-01-16 15:25:52.722816+00	2026-01-16 15:25:52.728626+00	032d10a0-c0a3-46ed-a304-a2395ffe3ee0
2	hr_admin	123456	hr_admin	\N	{hr:employee.view,hr:employee.create,hr:employee.edit,hr:employee.delete,hr:employee.export,hr:employee.config,hr:org.view,hr:org.create,hr:org.edit,hr:org.delete,hr:org.export,hr:org.config,hr:change.view,hr:change.create,hr:change.edit,hr:change.delete,hr:change.export,hr:attendance.view,hr:attendance.create,hr:attendance.edit,hr:attendance.delete,hr:attendance.export,hr:payroll.view,hr:payroll.create,hr:payroll.edit,hr:payroll.delete,hr:payroll.export,hr:profile.view,hr:profile.create,hr:profile.edit,hr:profile.delete,hr:profile.export}	HR Admin	\N	\N	91bf9316-84fa-4093-9919-7b4610908a26	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	5c95c523-1cae-4c6c-a540-f1977de4058e
3	hr_clerk	123456	hr_clerk	\N	\N	HR Clerk	\N	\N	91bf9316-84fa-4093-9919-7b4610908a26	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	c6978198-989f-48c4-a9e4-a746e3dfa81e
4	dept_manager	123456	dept_manager	\N	\N	Dept Manager	\N	\N	48263242-95e1-4e97-9b8b-b4a7b6e29e4e	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	c8de51d4-bf7c-417d-baf0-0e3c8a372928
5	employee	123456	employee	\N	\N	Employee	\N	\N	48263242-95e1-4e97-9b8b-b4a7b6e29e4e	active	2026-01-16 15:27:08.757051+00	2026-01-16 15:27:08.757051+00	928bca4f-0a23-41c7-948c-61a8a30ce5cf
\.


--
-- Name: archives_id_seq; Type: SEQUENCE SET; Schema: hr; Owner: postgres
--

SELECT pg_catalog.setval('hr.archives_id_seq', 799, true);


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
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_permissions TO web_user;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.roles TO web_user;


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

\unrestrict u186wHA6vfojEmp6xBrc9DioIr5UAGkowFjBM7JAzmQRqEEvGZHf1YA3mP2pM0k

