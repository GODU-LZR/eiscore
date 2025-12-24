--
-- PostgreSQL database dump
--

\restrict hRzWsU4b56YE0bGCfCXOwgrq2ob4ocguwBZsojlzHF5VraS3gUMG6magaNS4klq

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
62	新员工	EMP1766506870331	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:10.03752
63	新员工	EMP1766506870497	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:10.199166
64	新员工	EMP1766506870711	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:10.420498
2	测试	EMP811618	总公司/研发部	2	1	在职	0.00	2025-12-23	{"gender": "男", "id_card": "1", "field_7757": "1"}	5	2025-12-23 13:50:19.791
3	1	EMP1766498618886	总公司/研发部	\N	\N	试用	0.00	2025-12-23	{"gender": "1", "id_card": "1", "field_3410": "1"}	1	2025-12-23 14:03:38.767586
1	1	EMP001	研发部	开发	\N	在职	8000.00	2025-12-22	{"gender": "男"}	2	2025-12-23 16:13:36.833
4	新员工	EMP1766506856852	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:20:57.06595
5	新员工	EMP1766506860655	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:00.935117
6	新员工	EMP1766506860810	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:01.092336
7	新员工	EMP1766506860979	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:01.260737
8	新员工	EMP1766506861133	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:01.42281
9	新员工	EMP1766506861306	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:01.598167
10	新员工	EMP1766506861461	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:01.756883
11	新员工	EMP1766506861615	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:01.92047
12	新员工	EMP1766506861770	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:02.073613
13	新员工	EMP1766506861931	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:02.245118
14	新员工	EMP1766506862111	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:02.428379
15	新员工	EMP1766506862274	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:02.593706
16	新员工	EMP1766506862434	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:02.762768
17	新员工	EMP1766506862614	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:02.942084
18	新员工	EMP1766506862775	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:03.112019
19	新员工	EMP1766506862936	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:03.270873
20	新员工	EMP1766506863108	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:03.455078
21	新员工	EMP1766506863295	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:03.640459
22	新员工	EMP1766506863447	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:03.79893
23	新员工	EMP1766506863605	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:03.961184
24	新员工	EMP1766506863782	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:04.140925
25	新员工	EMP1766506863960	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:04.324678
26	新员工	EMP1766506864126	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:04.494635
27	新员工	EMP1766506864293	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:04.674759
28	新员工	EMP1766506864476	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:04.854697
29	新员工	EMP1766506864653	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.041851
30	新员工	EMP1766506864802	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.190439
31	新员工	EMP1766506864970	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.366816
32	新员工	EMP1766506865141	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.536488
33	新员工	EMP1766506865309	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.711589
34	新员工	EMP1766506865469	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.878305
35	新员工	EMP1766506865645	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.666347
36	新员工	EMP1766506865818	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.38881
37	新员工	EMP1766506866002	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.581074
38	新员工	EMP1766506866177	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.762562
39	新员工	EMP1766506866356	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:05.940004
40	新员工	EMP1766506866516	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:06.107567
41	新员工	EMP1766506866691	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:06.287809
42	新员工	EMP1766506866856	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:06.455822
43	新员工	EMP1766506867014	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:06.617626
44	新员工	EMP1766506867192	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:06.800041
45	新员工	EMP1766506867365	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:06.982309
46	新员工	EMP1766506867531	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:07.153459
47	新员工	EMP1766506867722	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:07.357479
48	新员工	EMP1766506867901	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:07.530637
49	新员工	EMP1766506868061	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:07.691971
50	新员工	EMP1766506868249	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:07.886542
51	新员工	EMP1766506868433	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:08.078539
52	新员工	EMP1766506868662	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:08.314462
53	新员工	EMP1766506868813	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:08.467182
54	新员工	EMP1766506868981	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:08.640926
55	新员工	EMP1766506869165	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:08.829149
56	新员工	EMP1766506869314	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:08.983713
57	新员工	EMP1766506869503	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:09.186626
58	新员工	EMP1766506869674	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:09.354688
59	新员工	EMP1766506869823	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:09.505125
60	新员工	EMP1766506869998	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:09.68695
61	新员工	EMP1766506870158	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:09.852378
65	新员工	EMP1766506870886	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:10.600495
66	新员工	EMP1766506871057	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:10.773505
67	新员工	EMP1766506871236	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:10.962261
68	新员工	EMP1766506871384	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:11.109836
69	新员工	EMP1766506871582	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:11.318156
70	新员工	EMP1766506871767	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:11.504891
71	新员工	EMP1766506871939	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:11.687077
72	新员工	EMP1766506872114	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:11.86094
73	新员工	EMP1766506872282	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:12.038297
74	新员工	EMP1766506872463	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:12.220552
75	新员工	EMP1766506872617	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:12.377437
76	新员工	EMP1766506872782	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:12.548648
77	新员工	EMP1766506872969	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:12.742175
78	新员工	EMP1766506873135	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:12.90968
79	新员工	EMP1766506873315	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:13.09622
80	新员工	EMP1766506873517	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:13.302607
81	新员工	EMP1766506873729	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:13.522482
82	新员工	EMP1766506873913	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:13.717146
83	新员工	EMP1766506874102	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:13.906152
84	新员工	EMP1766506874265	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:14.074025
85	新员工	EMP1766506874482	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:14.298341
86	新员工	EMP1766506874675	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:14.494127
87	新员工	EMP1766506874818	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:14.641733
88	新员工	EMP1766506874988	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:14.817662
89	新员工	EMP1766506875173	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:15.006765
90	新员工	EMP1766506875377	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:15.216799
91	新员工	EMP1766506875553	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:15.396861
92	新员工	EMP1766506875702	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:15.550074
93	新员工	EMP1766506901065	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:40.823828
94	新员工	EMP1766506901279	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:41.035596
95	新员工	EMP1766506901392	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:41.150025
96	新员工	EMP1766506901579	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:41.342982
97	新员工	EMP1766506901724	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:41.496599
98	新员工	EMP1766506901890	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:41.667038
99	新员工	EMP1766506902077	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:41.856298
100	新员工	EMP1766506902257	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:42.039743
101	新员工	EMP1766506902478	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:42.270253
102	新员工	EMP1766506902629	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:42.42451
103	新员工	EMP1766506902802	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:42.604441
104	新员工	EMP1766506903007	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:42.812455
105	新员工	EMP1766506903203	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:43.015073
106	新员工	EMP1766506903397	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:43.217587
107	新员工	EMP1766506903595	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:43.418652
108	新员工	EMP1766506903773	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:43.601843
109	新员工	EMP1766506903935	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:43.768477
110	新员工	EMP1766506904123	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:43.9617
111	新员工	EMP1766506904293	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:44.137581
112	新员工	EMP1766506904499	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:44.346546
113	新员工	EMP1766506904643	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:44.494577
114	新员工	EMP1766506904832	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:44.691521
115	新员工	EMP1766506905028	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:44.895609
116	新员工	EMP1766506905215	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:45.115662
117	新员工	EMP1766506905366	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:45.241421
118	新员工	EMP1766506905537	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:45.42239
119	新员工	EMP1766506905681	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:45.571133
120	新员工	EMP1766506905866	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:45.765833
121	新员工	EMP1766506906016	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:45.909772
122	新员工	EMP1766506906196	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:46.090496
123	新员工	EMP1766506906357	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:46.256495
124	新员工	EMP1766506906551	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:46.457584
125	新员工	EMP1766506906692	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:46.601633
126	新员工	EMP1766506906885	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:46.803345
127	新员工	EMP1766506907008	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:46.9257
128	新员工	EMP1766506907154	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:47.076908
129	新员工	EMP1766506907332	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:47.261139
130	新员工	EMP1766506907488	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:47.419296
131	新员工	EMP1766506907661	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:47.597541
132	新员工	EMP1766506907827	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:47.766114
133	新员工	EMP1766506907986	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:47.933371
134	新员工	EMP1766506908141	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:21:48.091054
135	新员工	EMP1766508061077	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:01.060024
136	新员工	EMP1766508061232	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:01.176939
137	新员工	EMP1766508061391	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:01.339861
138	新员工	EMP1766508061723	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:01.681867
139	新员工	EMP1766508061910	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:01.874643
140	新员工	EMP1766508062118	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:02.085635
141	新员工	EMP1766508062405	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:01.991126
142	新员工	EMP1766508062579	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:02.1723
143	新员工	EMP1766508062756	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:02.350894
144	新员工	EMP1766508062910	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:02.509657
145	新员工	EMP1766508063094	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:02.701716
146	新员工	EMP1766508063272	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:02.886364
147	新员工	EMP1766508063439	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:03.053404
148	新员工	EMP1766508063608	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:03.23543
149	新员工	EMP1766508063774	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:03.402327
150	新员工	EMP1766508063957	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:03.589949
151	新员工	EMP1766508064111	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:03.747384
152	新员工	EMP1766508064301	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:03.94475
153	新员工	EMP1766508064461	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:04.106331
154	新员工	EMP1766508064645	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:04.300499
155	新员工	EMP1766508064831	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:41:04.48828
156	新员工	EMP1766508317441	\N	\N	\N	试用	0.00	2025-12-23	{}	1	2025-12-23 16:45:17.690914
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
-- Data for Name: system_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_configs (key, value, description) FROM stdin;
hr_table_cols	[{"prop": "gender", "label": "性别"}, {"prop": "id_card", "label": "身份证"}, {"prop": "field_3410", "label": "籍贯"}]	HR花名册的动态列配置
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

SELECT pg_catalog.setval('hr.archives_id_seq', 156, true);


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

\unrestrict hRzWsU4b56YE0bGCfCXOwgrq2ob4ocguwBZsojlzHF5VraS3gUMG6magaNS4klq

