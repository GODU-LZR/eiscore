--
-- PostgreSQL database dump
--

\restrict RfQYwwJvtwBBLNO1oh1clSaDW1eERNtMsm384DxNXpf0czRwXR8AV2VLfBNVinR

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
-- Name: login(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.login(username text, password text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    _role text;
    _permissions text[];
    result json;
    _secret text := 'my_super_secret_key_for_eiscore_system_2025';
BEGIN
    SELECT users.role, users.permissions INTO _role, _permissions FROM public.users
    WHERE users.username = login.username AND users.password = login.password;

    IF _role IS NULL THEN
        RAISE invalid_password USING MESSAGE = '账号或密码错误';
    END IF;

    result := json_build_object(
        'role', _role,
        'username', username,
        'permissions', _permissions, 
        'exp', extract(epoch from now() + interval '2 hours')::integer
    );

    RETURN json_build_object('token', public.sign(result, _secret));
END;
$$;


ALTER FUNCTION public.login(username text, password text) OWNER TO postgres;

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
-- Name: debug_me; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.debug_me AS
 SELECT current_setting('request.jwt.claims'::text, true) AS full_json_data,
    ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text) AS extracted_name,
    CURRENT_USER AS db_role;


ALTER VIEW public.debug_me OWNER TO postgres;

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
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'web_user'::text NOT NULL,
    avatar text,
    permissions text[]
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
469	新员工	EMP1766677815289	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "status": "created", "field_789": 150, "field_5458": "100", "field_9314": "50", "row_locked_by": null}	40	2025-12-28 14:24:09.408
471	新员工	EMP1766677815646	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 150, "field_5458": "100", "field_9314": "50"}	35	2025-12-28 14:24:09.836
472	新员工	EMP1766677815838	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 150, "field_5458": "100", "field_9314": "50"}	22	2025-12-28 14:24:10.107
473	新员工	EMP1766677815973	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 150, "field_5458": "100", "field_9314": "50"}	22	2025-12-28 14:24:10.354
470	新员工	EMP1766677815473	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 150, "field_5458": "100", "field_9314": "50"}	45	2025-12-28 14:24:09.187
482	新员工	EMP950387	\N	\N	\N	试用	0.00	2025-12-27	{"status": "created", "field_789": 0, "row_locked_by": null}	15	2025-12-28 11:59:58.599
481	新员工	EMP948130	\N	\N	\N	试用	0.00	2025-12-27	{"status": "created", "id_card": null, "field_789": 0, "row_locked_by": null}	17	2025-12-28 12:00:02.666
453	新员工	EMP1766677812422	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
467	新员工	EMP1766677814931	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "id_card": "", "field_789": 150, "field_5458": "100", "field_9314": "50"}	37	2025-12-27 19:45:03.942
466	新员工	EMP1766677814748	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "id_card": "", "field_789": 150, "field_5458": "100", "field_9314": "50"}	32	2025-12-27 19:45:03.942
465	新员工	EMP1766677814608	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 150, "field_5458": "100", "field_9314": "50"}	29	2025-12-27 19:45:03.942
479	新员工	EMP123876	\N	\N	\N	试用	0.00	2025-12-27	{"field_789": 150, "field_5458": "100", "field_9314": "50"}	15	2025-12-28 11:28:03.175
477	新员工	EMP1766840518997	\N	\N	\N	试用	0.00	2025-12-27	{"status": "created", "field_789": 150, "field_5458": "100", "field_9314": "50", "row_locked_by": null}	18	2025-12-28 11:28:03.175
476	新员工	EMP1766840515500	\N	\N	\N	试用	0.00	2025-12-27	{"field_789": 150, "field_5458": "100", "field_9314": "50"}	16	2025-12-28 11:28:03.175
483	新员工	EMP862011	\N	\N	\N	试用	0.00	2025-12-28	{"status": "created", "field_789": 0, "row_locked_by": null}	6	2025-12-28 12:00:19.932
468	新员工	EMP1766677815111	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "id_card": "", "field_789": 150, "field_5458": "100", "field_9314": "50"}	35	2025-12-28 13:12:22.992
475	新员工	EMP1766839736899	\N	\N	\N	试用	0.00	2025-12-27	{"field_789": 150, "field_5458": "100", "field_9314": "50"}	28	2025-12-28 14:20:20.143
474	新员工	EMP1766839066179	\N	\N	\N	试用	0.00	2025-12-27	{"field_789": 150, "field_5458": "100", "field_9314": "50"}	30	2025-12-28 14:20:20.143
464	新员工	EMP1766677814414	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 150, "field_5458": "100", "field_9314": "50"}	20	2025-12-27 15:53:00.554
461	新员工	EMP1766677813895	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	5	2025-12-27 15:53:00.554
463	新员工	EMP1766677814225	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 150, "field_5458": "100", "field_9314": "50"}	16	2025-12-27 15:53:00.554
462	新员工	EMP1766677814028	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 150, "field_5458": "100", "field_9314": "50"}	11	2025-12-27 15:53:00.554
460	新员工	EMP1766677813707	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	5	2025-12-27 15:53:00.554
459	新员工	EMP1766677813464	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	5	2025-12-27 15:53:00.554
458	新员工	EMP1766677813288	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	4	2025-12-27 15:53:00.554
457	新员工	EMP1766677813118	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	4	2025-12-27 15:53:00.554
456	新员工	EMP1766677812941	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	4	2025-12-27 15:53:00.554
455	新员工	EMP1766677812777	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	4	2025-12-27 15:53:00.554
454	新员工	EMP1766677812597	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	4	2025-12-27 15:53:00.554
452	新员工	EMP1766677812238	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
451	新员工	EMP1766677812058	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
450	新员工	EMP1766677811936	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
449	新员工	EMP1766677811709	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
448	新员工	EMP1766677811547	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
447	新员工	EMP1766677811372	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
446	新员工	EMP1766677811189	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
445	新员工	EMP1766677811023	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
444	新员工	EMP1766677810899	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
443	新员工	EMP1766677810675	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
442	新员工	EMP1766677810508	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
441	新员工	EMP1766677810339	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
440	新员工	EMP1766677810204	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
439	新员工	EMP1766677810025	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
438	新员工	EMP1766677809836	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
437	新员工	EMP1766677802583	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
436	新员工	EMP1766677802467	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
435	新员工	EMP1766677802259	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
434	新员工	EMP1766677802093	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
433	新员工	EMP1766677801932	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
432	新员工	EMP1766677801806	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
431	新员工	EMP1766677801594	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
430	新员工	EMP1766677801437	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.554
429	新员工	EMP1766677801289	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
428	新员工	EMP1766677801085	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
427	新员工	EMP1766677800935	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
426	新员工	EMP1766677800755	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	6	2025-12-27 15:53:00.555
425	新员工	EMP1766677800607	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	12	2025-12-27 15:53:00.555
424	新员工	EMP1766677800479	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	13	2025-12-27 15:53:00.555
423	新员工	EMP1766677800269	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	8	2025-12-27 15:53:00.555
422	新员工	EMP1766677800104	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	4	2025-12-27 15:53:00.555
421	新员工	EMP1766677799934	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
420	新员工	EMP1766677799761	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
419	新员工	EMP1766677799607	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
418	新员工	EMP1766677799415	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
417	新员工	EMP1766677799259	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
416	新员工	EMP1766677799119	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
415	新员工	EMP1766677798906	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
414	新员工	EMP1766677798735	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	10	2025-12-27 15:53:00.555
413	新员工	EMP1766677798557	\N	\N	\N	试用	0.00	2025-12-25	{"gender": null, "field_789": 0}	8	2025-12-27 15:53:00.555
412	新员工	EMP1766677798400	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
411	新员工	EMP1766677798223	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
410	新员工	EMP1766677798034	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
409	新员工	EMP1766677797920	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
408	新员工	EMP1766677797714	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
407	新员工	EMP1766677797550	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
406	新员工	EMP1766677797384	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
405	新员工	EMP1766677797256	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
404	新员工	EMP1766677797038	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
403	新员工	EMP1766677796892	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
402	新员工	EMP1766677796725	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
401	新员工	EMP1766677796563	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
400	新员工	EMP1766677796446	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
399	新员工	EMP1766677796243	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
398	新员工	EMP1766677796095	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
397	新员工	EMP1766677795947	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
396	新员工	EMP1766677075856	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
395	新员工	EMP1766677075741	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
394	新员工	EMP1766677075548	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
393	新员工	EMP1766677075366	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
392	新员工	EMP1766677075211	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
391	新员工	EMP1766677075051	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
390	新员工	EMP1766677074899	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
389	新员工	EMP1766677074746	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
388	新员工	EMP1766677074589	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
387	新员工	EMP1766677074400	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
386	新员工	EMP1766677074258	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
385	新员工	EMP1766677074092	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
384	新员工	EMP1766677073934	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
383	新员工	EMP1766677073784	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
382	新员工	EMP1766676479427	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
381	新员工	EMP1766676479034	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
380	新员工	EMP1766676478858	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
379	新员工	EMP1766676476186	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
378	新员工	EMP1766676475997	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
377	新员工	EMP1766676475812	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
376	新员工	EMP1766676475607	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
375	新员工	EMP1766676475428	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
374	新员工	EMP1766676475262	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
373	新员工	EMP1766676475098	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
372	新员工	EMP1766676474916	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
371	新员工	EMP1766676474715	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
370	新员工	EMP1766676474340	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
369	新员工	EMP1766676474175	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
368	新员工	EMP1766676473621	\N	\N	\N	试用	0.00	2025-12-25	{"field_789": 0}	2	2025-12-27 15:53:00.555
\.


--
-- Data for Name: payroll; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.payroll (id, archive_id, month, total_amount, status) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, name, "position", department, created_at) FROM stdin;
1	林志荣	全栈架构师	研发中心	2025-12-21 22:48:47.338352
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
-- Data for Name: sys_grid_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_grid_configs (view_id, summary_config, updated_by, updated_at) FROM stdin;
employee_list	{"label": "合计", "rules": {"id": "avg", "name": "none"}, "expressions": {}, "column_locks": {}}	Admin	2025-12-25 18:44:29.890141+00
\.


--
-- Data for Name: system_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_configs (key, value, description) FROM stdin;
hr_column_locks	{}	HR表格列锁配置
hr_table_cols	[{"prop": "gender", "label": "性别"}, {"prop": "id_card", "label": "身份证"}, {"prop": "field_3410", "label": "籍贯"}, {"prop": "field_5458", "type": "text", "label": "工资"}, {"prop": "field_9314", "type": "text", "label": "绩效"}, {"prop": "field_789", "type": "formula", "label": "总工资", "expression": "{工资}+{绩效}"}]	HR花名册的动态列配置
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, role, avatar, permissions) FROM stdin;
1	admin	123456	web_user	\N	{hr:view,scm:view}
\.


--
-- Name: archives_id_seq; Type: SEQUENCE SET; Schema: hr; Owner: postgres
--

SELECT pg_catalog.setval('hr.archives_id_seq', 483, true);


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

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


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
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: raw_materials raw_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_materials
    ADD CONSTRAINT raw_materials_pkey PRIMARY KEY (id);


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
-- Name: payroll payroll_archive_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_archive_id_fkey FOREIGN KEY (archive_id) REFERENCES hr.archives(id);


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
-- Name: TABLE payroll; Type: ACL; Schema: hr; Owner: postgres
--

GRANT ALL ON TABLE hr.payroll TO web_user;


--
-- Name: SEQUENCE payroll_id_seq; Type: ACL; Schema: hr; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE hr.payroll_id_seq TO web_user;


--
-- Name: TABLE debug_me; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.debug_me TO web_user;


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
-- Name: TABLE raw_materials; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.raw_materials TO web_anon;
GRANT ALL ON TABLE public.raw_materials TO web_user;


--
-- Name: SEQUENCE raw_materials_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.raw_materials_id_seq TO web_user;


--
-- Name: TABLE sys_grid_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sys_grid_configs TO web_user;
GRANT SELECT ON TABLE public.sys_grid_configs TO web_anon;


--
-- Name: TABLE system_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_configs TO web_user;


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

\unrestrict RfQYwwJvtwBBLNO1oh1clSaDW1eERNtMsm384DxNXpf0czRwXR8AV2VLfBNVinR

