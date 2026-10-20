// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const container = `eiscore-field-acl-test-${process.pid}-${Date.now()}`
const wsl = process.argv.find(arg => arg.startsWith('--wsl='))?.slice(6)
const image = process.env.EISCORE_TEST_POSTGRES_IMAGE || 'postgres:16-alpine'
const docker = (args, input, allowFailure = false) => {
  const run = spawnSync(wsl ? 'wsl' : 'docker', wsl ? ['-d', wsl, '--', 'docker', ...args] : args, {
    input, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024
  })
  if (run.error) throw run.error
  if (!allowFailure && run.status !== 0) throw new Error(run.stderr || run.stdout)
  return run
}
const sql = input => docker(['exec', '-i', container, 'psql', '-X', '-Atq', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input).stdout.trim()
const source = readFileSync(new URL('../database/migrations/sql/core-033-static-field-acl-bootstrap.sql', import.meta.url), 'utf8')
let started = false
try {
  docker(['run', '-d', '--name', container, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=256m',
    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image])
  started = true
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    if (docker(['exec', container, 'pg_isready', '-U', 'postgres'], undefined, true).status === 0) { ready = true; break }
    await new Promise(done => setTimeout(done, 250))
  }
  assert.ok(ready, 'isolated PostgreSQL must start')
  sql(`
    CREATE ROLE eiscore_owner NOLOGIN;
    CREATE ROLE web_user NOLOGIN;
    CREATE ROLE web_anon NOLOGIN;
    CREATE SCHEMA app_center AUTHORIZATION eiscore_owner;
    CREATE TABLE public.roles (id uuid PRIMARY KEY, code text, status text);
    CREATE TABLE public.permissions (code text, source_app_id uuid, status text);
    CREATE TABLE public.sys_field_acl (
      role_id uuid, module text, field_code text, can_view boolean, can_edit boolean,
      status text, source_app_id uuid, UNIQUE(role_id,module,field_code)
    );
    CREATE TABLE app_center.apps (id uuid PRIMARY KEY, config jsonb);
    ALTER TABLE public.roles OWNER TO eiscore_owner;
    ALTER TABLE public.permissions OWNER TO eiscore_owner;
    ALTER TABLE public.sys_field_acl OWNER TO eiscore_owner;
    ALTER TABLE app_center.apps OWNER TO eiscore_owner;
    INSERT INTO public.roles VALUES
      ('00000000-0000-0000-0000-000000000001','baseline','active'),
      ('00000000-0000-0000-0000-000000000002','denied','active'),
      ('00000000-0000-0000-0000-000000000003','pending','active'),
      ('00000000-0000-0000-0000-000000000004','disabled_rule','active'),
      ('00000000-0000-0000-0000-000000000005','locked_rule','active'),
      ('00000000-0000-0000-0000-000000000006','new_role','created'),
      ('00000000-0000-0000-0000-000000000007','locked_role','locked'),
      ('00000000-0000-0000-0000-000000000008','disabled_role','disabled');
    INSERT INTO public.sys_field_acl
      SELECT id,'mms_ledger','name',false,false,
        CASE code WHEN 'denied' THEN 'active' WHEN 'pending' THEN 'created'
          WHEN 'disabled_rule' THEN 'disabled' WHEN 'locked_rule' THEN 'locked' END,NULL
      FROM public.roles WHERE code IN ('denied','pending','disabled_rule','locked_rule');
    CREATE TABLE public.saved_rules AS SELECT * FROM public.sys_field_acl;
    INSERT INTO public.permissions VALUES ('app:mms_ledger',NULL,'active'),('app:inactive',NULL,'disabled');
    INSERT INTO app_center.apps VALUES ('11111111-1111-1111-1111-111111111111','{"aclModule":"dynamic_fixture"}');
    INSERT INTO public.permissions VALUES ('app:dynamic_fixture','11111111-1111-1111-1111-111111111111','active');
  `)
  sql(source)
  assert.equal(sql("SELECT has_function_privilege('web_user','public.ensure_field_acl(text,text[])','EXECUTE');"), 't')
  assert.equal(sql("SELECT has_function_privilege('web_anon','public.ensure_field_acl(text,text[])','EXECUTE');"), 'f')
  assert.equal(sql("SET ROLE web_user; SELECT public.ensure_field_acl('mms_ledger',ARRAY['name','spec','spec',NULL,'']);"), '8')
  assert.equal(sql(`SELECT count(*) FROM public.sys_field_acl f JOIN public.roles r ON r.id=f.role_id
    WHERE r.code='baseline' AND f.module='mms_ledger' AND f.status='active' AND f.can_view AND f.can_edit;`), '2', 'all first-batch fields preserve default access')
  assert.equal(sql(`SELECT count(*) FROM public.sys_field_acl f JOIN public.roles r ON r.id=f.role_id
    WHERE r.code='new_role' AND f.module='mms_ledger' AND f.status='created';`), '2', 'created role never acquires effective grants')
  assert.equal(sql(`SELECT count(*) FROM public.sys_field_acl f JOIN public.roles r ON r.id=f.role_id
    WHERE r.code IN ('denied','pending','disabled_rule','locked_rule') AND f.field_code='spec' AND f.status='created';`), '4', 'configured modules retain review for discovered fields')
  assert.equal(sql(`SELECT count(*) FROM (
    (SELECT * FROM public.saved_rules EXCEPT SELECT * FROM public.sys_field_acl)
    UNION ALL
    (SELECT f.* FROM public.sys_field_acl f JOIN public.saved_rules old USING(role_id,module,field_code) EXCEPT SELECT * FROM public.saved_rules)
  ) changed;`), '0', 'active denial, pending, disabled and locked rules are byte-for-byte preserved')
  assert.equal(sql("SELECT public.ensure_field_acl('mms_ledger',ARRAY['name','spec']);"), '0', 'refresh is idempotent')
  sql("SELECT public.ensure_field_acl('mms_ledger',ARRAY['unit']);")
  assert.equal(sql(`SELECT f.status FROM public.sys_field_acl f JOIN public.roles r ON r.id=f.role_id
    WHERE r.code='baseline' AND f.module='mms_ledger' AND f.field_code='unit';`), 'created', 'new fields after bootstrap still require activation')
  sql("SELECT public.ensure_field_acl('dynamic_fixture',ARRAY['name','spec']);")
  assert.equal(sql("SELECT count(*) FROM public.sys_field_acl WHERE module='dynamic_fixture' AND (status<>'created' OR source_app_id IS DISTINCT FROM '11111111-1111-1111-1111-111111111111'::uuid);"), '0', 'dynamic fields remain pending and owned')
  sql("SELECT public.ensure_field_acl('unknown_fixture',ARRAY['name']); SELECT public.ensure_field_acl('inactive',ARRAY['name']);")
  assert.equal(sql("SELECT count(*) FROM public.sys_field_acl WHERE module IN ('unknown_fixture','inactive') AND status<>'created';"), '0', 'unknown/inactive catalogs do not bootstrap effective grants')
  assert.equal(sql(`SELECT count(*) FROM public.sys_field_acl f JOIN public.roles r ON r.id=f.role_id
    WHERE r.status IN ('locked','disabled');`), '0', 'locked and disabled roles remain untouched')
  assert.equal(sql("SELECT public.ensure_field_acl('',ARRAY['name']); SELECT public.ensure_field_acl('mms_ledger',NULL); SELECT public.ensure_field_acl('mms_ledger',ARRAY[]::text[]);"), '0\n0\n0')
  sql(source)
  assert.equal(sql("SELECT public.ensure_field_acl('mms_ledger',ARRAY['name','spec','unit']);"), '0', 'reapplying the function never activates existing pending rules')
  console.log('PASS: isolated PostgreSQL field ACL bootstrap preserves static defaults, existing denials/lifecycle, dynamic ownership and RPC privileges')
} finally {
  if (started) docker(['rm', '-f', container], undefined, true)
}
