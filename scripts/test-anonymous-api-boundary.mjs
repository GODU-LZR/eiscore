// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const container = `eiscore-anon-test-${process.pid}-${Date.now()}`
const wsl = process.argv.find(arg => arg.startsWith('--wsl='))?.slice(6)
const image = process.env.EISCORE_TEST_POSTGRES_IMAGE || 'postgres:16-alpine'
const docker = (args, input, allowFailure = false) => {
  const run = spawnSync(wsl ? 'wsl' : 'docker', wsl ? ['-d', wsl, '--', 'docker', ...args] : args, {
    input, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024
  })
  if (run.error) throw run.error
  if (!allowFailure && run.status !== 0) throw new Error(run.stderr || run.stdout)
  return run
}
const sql = (input, allowFailure = false) => docker([
  'exec', '-i', container, 'psql', '-X', '-Atq', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'
], input, allowFailure)
const source = path => readFileSync(resolve(root, path), 'utf8')
const fingerprint = roles => sql(`
  WITH roles AS (SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map(role => `'${role}'`).join(',')})),
  privileges AS (
    SELECT r.rolname, 'table' kind, c.oid obj, x.priv,
      has_table_privilege(r.rolname,c.oid,x.priv) allowed
    FROM roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) x(priv)
    WHERE n.nspname IN ('public','scm','hr','app_data','app_center','company_site','workflow') AND c.relkind IN ('r','v','p','m','f')
    UNION ALL
    SELECT r.rolname,'function',p.oid,'EXECUTE',has_function_privilege(r.rolname,p.oid,'EXECUTE')
    FROM roles r CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','scm','hr','app_data','app_center','company_site','workflow')
    UNION ALL
    SELECT r.rolname,'sequence',c.oid,x.priv,has_sequence_privilege(r.rolname,c.oid,x.priv)
    FROM roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','USAGE','UPDATE']) x(priv)
    WHERE n.nspname IN ('public','scm','hr','app_data','app_center','company_site','workflow') AND c.relkind='S'
    UNION ALL
    SELECT r.rolname,'schema',n.oid,x.priv,has_schema_privilege(r.rolname,n.oid,x.priv)
    FROM roles r CROSS JOIN pg_namespace n CROSS JOIN unnest(ARRAY['USAGE','CREATE']) x(priv)
    WHERE n.nspname IN ('public','scm','hr','app_data','app_center','company_site','workflow')
  ) SELECT concat_ws('|',rolname,kind,obj,priv,allowed) FROM privileges ORDER BY 1;
`).stdout

try {
  docker(['run','-d','--name',container,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=256m',
    '-e','POSTGRES_HOST_AUTH_METHOD=trust',image])
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    if (docker(['exec',container,'pg_isready','-U','postgres'],undefined,true).status === 0) { ready = true; break }
    await new Promise(resolvePromise => setTimeout(resolvePromise,250))
  }
  assert.ok(ready, 'isolated PostgreSQL must start')
  sql(`
    CREATE ROLE eiscore_owner NOLOGIN;
    CREATE ROLE web_anon NOLOGIN;
    CREATE ROLE web_user NOLOGIN;
    CREATE ROLE eiscore_agent NOLOGIN;
    CREATE ROLE eiscore_flash_agent NOLOGIN;
    DO $$DECLARE n text; BEGIN
      FOREACH n IN ARRAY ARRAY['scm','hr','app_data','app_center','company_site','workflow'] LOOP
        EXECUTE format('CREATE SCHEMA %I AUTHORIZATION eiscore_owner',n);
      END LOOP;
      FOREACH n IN ARRAY ARRAY['public','scm','hr','app_data','app_center','company_site','workflow'] LOOP
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO web_anon,web_user,eiscore_agent,eiscore_flash_agent',n);
        EXECUTE format('CREATE TABLE %I.records (id serial PRIMARY KEY, name text)',n);
        EXECUTE format('ALTER TABLE %I.records OWNER TO eiscore_owner',n);
        EXECUTE format('GRANT SELECT ON %I.records TO web_anon',n);
        EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I.records TO web_user,eiscore_agent,eiscore_flash_agent',n);
        EXECUTE format('GRANT USAGE ON SEQUENCE %I.records_id_seq TO web_user,eiscore_agent,eiscore_flash_agent',n);
        EXECUTE format('INSERT INTO %I.records(name) VALUES (''fixture'')',n);
      END LOOP;
    END$$;
    CREATE VIEW public.business_view AS SELECT * FROM public.records;
    ALTER VIEW public.business_view OWNER TO eiscore_owner;
    GRANT SELECT ON public.business_view TO web_anon,web_user,eiscore_agent;
    GRANT SELECT(name) ON public.records TO web_anon;
    ALTER TABLE scm.records ENABLE ROW LEVEL SECURITY;
    CREATE POLICY records_access ON scm.records USING (true) WITH CHECK (true);
    CREATE FUNCTION public.login(text,text) RETURNS json LANGUAGE sql SECURITY DEFINER AS 'SELECT ''{"fixture":true}''::json';
    CREATE FUNCTION public.login(json) RETURNS json LANGUAGE sql SECURITY DEFINER AS 'SELECT ''{"fixture":true}''::json';
    CREATE FUNCTION public.eis_grid_summary() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM public.records';
    CREATE FUNCTION public.eis_app_card_stats() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM public.records';
    CREATE FUNCTION public.ensure_field_acl() RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION scm.stock_in() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM scm.records';
    CREATE FUNCTION scm.explode_bom() RETURNS bigint LANGUAGE sql SECURITY DEFINER AS 'SELECT count(*) FROM scm.records';
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public,scm FROM PUBLIC;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public,scm TO web_user,eiscore_agent,eiscore_flash_agent;
    GRANT EXECUTE ON FUNCTION public.login(text,text),public.login(json),scm.explode_bom() TO web_anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA scm GRANT SELECT ON TABLES TO web_anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE eiscore_owner IN SCHEMA app_data GRANT SELECT ON TABLES TO web_anon;
  `)
  const anonymousBefore = fingerprint(['web_anon'])
  const authenticatedBefore = fingerprint(['web_user','eiscore_agent','eiscore_flash_agent'])
  const rollback = sql(source('scripts/backup-anonymous-api-acl.sql')).stdout
  const migration = source('database/migrations/sql/core-032-anonymous-api-boundary.sql')
  sql(`BEGIN; ${migration} COMMIT;`)
  sql(source('database/migrations/postchecks/core-032.sql'))
  assert.equal(fingerprint(['web_user','eiscore_agent','eiscore_flash_agent']),authenticatedBefore,
    'existing authenticated roles must keep their effective permissions')
  for (const query of ['SELECT * FROM public.records','SELECT name FROM public.records','SELECT * FROM public.business_view',
    'SELECT * FROM scm.records','SELECT scm.explode_bom()']) {
    const result = sql(`SET ROLE web_anon; ${query};`,true)
    assert.notEqual(result.status,0,`anonymous must be refused: ${query}`)
    assert.match(result.stderr,/permission denied/)
  }
  const login = sql(`SET ROLE web_anon; SELECT public.login('fixture','fixture'); SELECT public.login('{}'::json);`).stdout
  assert.equal(login.trim().split('\n').length,2,'both anonymous login overloads execute')
  for (const role of ['web_user','eiscore_agent','eiscore_flash_agent']) {
    sql(`SET ROLE ${role}; SELECT * FROM public.records; SELECT public.eis_grid_summary(),public.eis_app_card_stats(),
      public.ensure_field_acl(),scm.stock_in(); INSERT INTO public.records(name) VALUES ('authenticated');`)
  }
  // Reapplying is safe, and future functions do not inherit PUBLIC EXECUTE.
  sql(`BEGIN; ${migration} COMMIT;`)
  sql(`CREATE TABLE scm.future_postgres(id integer); CREATE FUNCTION public.future_postgres() RETURNS integer LANGUAGE sql AS 'SELECT 1';
    SET ROLE eiscore_owner; CREATE TABLE app_data.future_owner(id integer);
    CREATE FUNCTION app_data.future_owner() RETURNS integer LANGUAGE sql AS 'SELECT 1'; RESET ROLE;`)
  sql(source('database/migrations/postchecks/core-032.sql'))
  sql('DROP TABLE scm.future_postgres,app_data.future_owner; DROP FUNCTION public.future_postgres(),app_data.future_owner();')
  sql(rollback)
  assert.equal(fingerprint(['web_anon']),anonymousBefore,'generated rollback must restore previous effective anonymous ACLs')
  assert.equal(fingerprint(['web_user','eiscore_agent','eiscore_flash_agent']),authenticatedBefore)
  sql(`CREATE FUNCTION public.rollback_default_probe() RETURNS integer LANGUAGE sql AS 'SELECT 1';
    DO $$BEGIN IF NOT has_function_privilege('web_anon','public.rollback_default_probe()','EXECUTE')
      THEN RAISE EXCEPTION 'rollback must restore implicit global PUBLIC EXECUTE'; END IF; END$$;`)
  console.log('PASS: isolated PostgreSQL anonymous denial, login, authenticated roles, RPCs, future defaults, idempotence and ACL rollback')
} finally {
  docker(['rm','-f',container],undefined,true)
}
