--
-- PostgreSQL database dump
--

\restrict hON7Xvh3ba3FioffjkGKS0gKfjZz83jHfXT5pO2ChISLPPlrY5KNRNezgdIMBG6

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
313	新员工	EMP1766594300655	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:40.42
312	新员工	EMP1766594300473	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": ""}	10	2025-12-24 17:13:40.421
311	新员工	EMP1766594300309	\N	\N	\N	\N	0.00	2025-12-24	{"gender": "", "id_card": null}	10	2025-12-24 17:13:40.422
310	新员工	EMP1766594300129	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	7	2025-12-24 17:13:40.423
309	新员工	EMP1766594299945	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.423
308	新员工	EMP1766594299785	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.424
289	新员工	EMP1766594296369	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	7	2025-12-24 17:13:42.549
327	新员工	EMP1766594347673	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": ""}	9	2025-12-24 17:13:43.275
324	新员工	EMP1766594347190	\N	\N	\N	\N	0.00	2025-12-24	{"gender": "", "id_card": null}	9	2025-12-24 17:13:43.28
323	新员工	EMP1766594347025	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.282
322	新员工	EMP1766594346874	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.283
321	新员工	EMP1766594346719	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.285
320	新员工	EMP1766594302004	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:43.286
319	新员工	EMP1766594301790	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:43.287
318	新员工	EMP1766594301617	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:43.288
317	新员工	EMP1766594301432	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:43.29
316	新员工	EMP1766594301243	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:43.291
315	新员工	EMP1766594301046	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:43.293
314	新员工	EMP1766594300852	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	10	2025-12-24 17:13:44.827
307	新员工	EMP1766594299588	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.425
306	新员工	EMP1766594299407	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.425
305	新员工	EMP1766594299197	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.426
304	新员工	EMP1766594299023	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.426
303	新员工	EMP1766594298857	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.427
302	新员工	EMP1766594298674	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.428
301	新员工	EMP1766594298490	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.429
300	新员工	EMP1766594298311	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.431
299	新员工	EMP1766594298111	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.432
298	新员工	EMP1766594297938	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.432
297	新员工	EMP1766594297767	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.433
296	新员工	EMP1766594297591	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.434
295	新员工	EMP1766594297420	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.434
294	新员工	EMP1766594297261	\N	\N	\N	\N	0.00	2025-12-24	{"gender": ""}	7	2025-12-24 17:13:40.435
293	新员工	EMP1766594297088	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.435
292	新员工	EMP1766594296887	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.436
291	新员工	EMP1766594296698	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.436
290	新员工	EMP1766594296524	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null}	6	2025-12-24 17:13:40.437
364	新员工	EMP1766594353932	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	22	2025-12-24 17:41:38.271
326	新员工	EMP1766594347510	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": ""}	9	2025-12-24 17:13:43.277
325	新员工	EMP1766594347348	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.278
361	新员工	EMP1766594353405	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	32	2025-12-24 17:41:40.321
358	新员工	EMP1766594352900	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	21	2025-12-24 17:41:40.322
332	新员工	EMP1766594348466	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.267
331	新员工	EMP1766594348306	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.269
362	新员工	EMP1766594353574		\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	31	2025-12-24 17:41:40.321
359	新员工	EMP1766594353067	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	24	2025-12-24 17:41:40.322
330	新员工	EMP1766594348147	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.271
365	新员工	EMP1766594354088	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": ""}	30	2025-12-24 17:39:52.382
329	新员工	EMP1766594347991	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.273
328	新员工	EMP1766594347834	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:43.274
347	新员工	EMP1766594351048	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.369
346	新员工	EMP1766594350867	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.37
345	新员工	EMP1766594350685	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.371
344	新员工	EMP1766594350520	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.372
343	新员工	EMP1766594350330	\N	\N	\N	\N	0.00	2025-12-24	{"gender": "", "id_card": null}	9	2025-12-24 17:13:45.373
342	新员工	EMP1766594350167	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": ""}	9	2025-12-24 17:13:45.374
341	新员工	EMP1766594349987	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.376
340	新员工	EMP1766594349821	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.38
339	新员工	EMP1766594349653	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.383
338	新员工	EMP1766594349485	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.385
337	新员工	EMP1766594349296	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.386
336	新员工	EMP1766594349134	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.391
335	新员工	EMP1766594348968	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.398
334	新员工	EMP1766594348808	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:46.219
333	新员工	EMP1766594348622	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	9	2025-12-24 17:13:47.941
360	新员工	EMP1766594353239	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	28	2025-12-24 17:41:40.321
357	新员工	EMP1766594352723	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	16	2025-12-24 17:41:40.322
356	新员工	EMP1766594352559	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	17	2025-12-24 17:41:40.323
355	新员工	EMP1766594352388	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	10	2025-12-24 17:41:40.323
349	新员工	EMP1766594351374	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.367
348	新员工	EMP1766594351201	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:45.369
354	新员工	EMP1766594352231	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:48.821
353	新员工	EMP1766594352055	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:48.822
352	新员工	EMP1766594351892	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:48.823
351	新员工	EMP1766594351696	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:48.824
350	新员工	EMP1766594351540	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	8	2025-12-24 17:13:48.825
363	新员工	EMP1766594353748	\N	\N	\N	\N	0.00	2025-12-24	{"gender": null, "id_card": null}	33	2025-12-24 17:39:51.217
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

SELECT pg_catalog.setval('hr.archives_id_seq', 365, true);


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

\unrestrict hON7Xvh3ba3FioffjkGKS0gKfjZz83jHfXT5pO2ChISLPPlrY5KNRNezgdIMBG6

