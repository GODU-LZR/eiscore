// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'

export const applicationSchemas = ['app_center', 'app_data', 'company_site', 'hr', 'public', 'scm', 'workflow']

const schemaArraySql = `ARRAY[${applicationSchemas.map((name) => `'${name}'`).join(', ')}]`

export const databaseCatalogQueries = {
  schemas: `
    SELECT jsonb_build_object(
      'name', n.nspname,
      'owner', owner_role.rolname,
      'acl', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grantee', CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
          'grantor', grantor_role.rolname,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
                   acl.privilege_type)
        FROM aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
        LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
        LEFT JOIN pg_roles grantor_role ON grantor_role.oid = acl.grantor
      ), '[]'::jsonb)
    )::text
    FROM pg_namespace n
    JOIN pg_roles owner_role ON owner_role.oid = n.nspowner
    WHERE n.nspname = ANY (${schemaArraySql})
    ORDER BY n.nspname;
  `,
  relations: `
    SELECT jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'kind', c.relkind,
      'owner', owner_role.rolname,
      'rowSecurity', c.relrowsecurity,
      'forceRowSecurity', c.relforcerowsecurity,
      'persistence', c.relpersistence,
      'replicaIdentity', c.relreplident,
      'viewDefinition', CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, true) ELSE NULL END,
      'columns', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'position', a.attnum,
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'notNull', a.attnotnull,
          'identity', a.attidentity,
          'generated', a.attgenerated,
          'default', pg_get_expr(d.adbin, d.adrelid),
          'collation', CASE WHEN a.attcollation <> t.typcollation THEN coll.collname ELSE NULL END
        ) ORDER BY a.attnum)
        FROM pg_attribute a
        JOIN pg_type t ON t.oid = a.atttypid
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        LEFT JOIN pg_collation coll ON coll.oid = a.attcollation
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      ), '[]'::jsonb),
      'constraints', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'name', con.conname,
          'type', con.contype,
          'definition', pg_get_constraintdef(con.oid, true),
          'validated', con.convalidated,
          'deferrable', con.condeferrable,
          'deferred', con.condeferred
        ) ORDER BY con.conname)
        FROM pg_constraint con WHERE con.conrelid = c.oid
      ), '[]'::jsonb),
      'indexes', coalesce((
        SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY index_class.relname)
        FROM pg_index i
        JOIN pg_class index_class ON index_class.oid = i.indexrelid
        WHERE i.indrelid = c.oid
      ), '[]'::jsonb),
      'acl', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grantee', CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
                   acl.privilege_type)
        FROM aclexplode(coalesce(c.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END, c.relowner))) acl
        LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
      ), '[]'::jsonb)
    )::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner_role ON owner_role.oid = c.relowner
    WHERE n.nspname = ANY (${schemaArraySql})
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
    ORDER BY n.nspname, c.relname;
  `,
  functions: `
    SELECT jsonb_build_object(
      'schema', n.nspname,
      'name', p.proname,
      'identityArguments', pg_get_function_identity_arguments(p.oid),
      'result', pg_get_function_result(p.oid),
      'kind', p.prokind,
      'language', language.lanname,
      'owner', owner_role.rolname,
      'securityDefiner', p.prosecdef,
      'leakproof', p.proleakproof,
      'strict', p.proisstrict,
      'volatility', p.provolatile,
      'parallel', p.proparallel,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
      'definition', CASE WHEN p.prokind IN ('f', 'p') THEN pg_get_functiondef(p.oid) ELSE NULL END,
      'acl', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grantee', CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
                   acl.privilege_type)
        FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
      ), '[]'::jsonb)
    )::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language language ON language.oid = p.prolang
    JOIN pg_roles owner_role ON owner_role.oid = p.proowner
    WHERE n.nspname = ANY (${schemaArraySql})
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);
  `,
  policies: `
    SELECT jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', p.polname,
      'command', p.polcmd,
      'permissive', p.polpermissive,
      'roles', coalesce((
        SELECT jsonb_agg(
          CASE role_oid WHEN 0 THEN 'PUBLIC' ELSE role_name.rolname END
          ORDER BY CASE role_oid WHEN 0 THEN 'PUBLIC' ELSE role_name.rolname END
        )
        FROM unnest(p.polroles) role_oid
        LEFT JOIN pg_roles role_name ON role_name.oid = role_oid
      ), '[]'::jsonb),
      'using', pg_get_expr(p.polqual, p.polrelid),
      'withCheck', pg_get_expr(p.polwithcheck, p.polrelid)
    )::text
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY (${schemaArraySql})
    ORDER BY n.nspname, c.relname, p.polname;
  `,
  triggers: `
    SELECT jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', t.tgname,
      'enabled', t.tgenabled,
      'definition', pg_get_triggerdef(t.oid, true)
    )::text
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY (${schemaArraySql}) AND NOT t.tgisinternal
    ORDER BY n.nspname, c.relname, t.tgname;
  `,
  roles: `
    SELECT jsonb_build_object(
      'name', r.rolname,
      'login', r.rolcanlogin,
      'inherit', r.rolinherit,
      'superuser', r.rolsuper,
      'createDb', r.rolcreatedb,
      'createRole', r.rolcreaterole,
      'replication', r.rolreplication,
      'bypassRls', r.rolbypassrls
    )::text
    FROM pg_roles r
    WHERE r.rolname IN ('eiscore_owner', 'eiscore_migrator', 'eiscore_authenticator', 'eiscore_agent', 'web_anon', 'web_user')
    ORDER BY r.rolname;
  `,
  memberships: `
    SELECT jsonb_build_object(
      'role', granted.rolname,
      'member', member_role.rolname,
      'grantor', grantor_role.rolname,
      'adminOption', membership.admin_option,
      'inheritOption', membership.inherit_option,
      'setOption', membership.set_option
    )::text
    FROM pg_auth_members membership
    JOIN pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
    WHERE granted.rolname IN ('eiscore_owner', 'web_anon', 'web_user')
       OR member_role.rolname IN ('eiscore_migrator', 'eiscore_authenticator')
    ORDER BY granted.rolname, member_role.rolname;
  `,
  defaultPrivileges: `
    SELECT jsonb_build_object(
      'owner', owner_role.rolname,
      'schema', coalesce(n.nspname, ''),
      'objectType', d.defaclobjtype,
      'acl', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grantee', CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
                   acl.privilege_type)
        FROM aclexplode(d.defaclacl) acl
        LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
      ), '[]'::jsonb)
    )::text
    FROM pg_default_acl d
    JOIN pg_roles owner_role ON owner_role.oid = d.defaclrole
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE owner_role.rolname IN ('eiscore_owner', 'postgres')
      AND (n.nspname IS NULL OR n.nspname = ANY (${schemaArraySql}))
    ORDER BY owner_role.rolname, n.nspname, d.defaclobjtype;
  `,
  extensions: `
    SELECT jsonb_build_object('name', extname, 'version', extversion)::text
    FROM pg_extension ORDER BY extname;
  `,
  databaseSettingNames: `
    SELECT to_jsonb(split_part(setting, '=', 1))::text
    FROM pg_db_role_setting s
    CROSS JOIN LATERAL unnest(s.setconfig) setting
    WHERE s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
    ORDER BY split_part(setting, '=', 1);
  `
}

export const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  }
  return value
}

export const canonicalJson = (value) => JSON.stringify(stableValue(value))
export const sha256CanonicalJson = (value) => createHash('sha256').update(canonicalJson(value)).digest('hex')

export const createDatabaseCatalog = (sections) => ({
  schemaVersion: 1,
  schemas: sections.schemas || [],
  relations: sections.relations || [],
  functions: sections.functions || [],
  policies: sections.policies || [],
  triggers: sections.triggers || [],
  roles: sections.roles || [],
  memberships: sections.memberships || [],
  defaultPrivileges: sections.defaultPrivileges || [],
  extensions: sections.extensions || [],
  databaseSettingNames: sections.databaseSettingNames || []
})

export const summarizeDatabaseCatalog = (catalog) => ({
  schemas: catalog.schemas.length,
  relations: catalog.relations.length,
  functions: catalog.functions.length,
  policies: catalog.policies.length,
  triggers: catalog.triggers.length,
  roles: catalog.roles.length,
  memberships: catalog.memberships.length,
  defaultPrivileges: catalog.defaultPrivileges.length,
  extensions: catalog.extensions.length
})

export const normalizePostgrestOpenApi = (document) => {
  const normalized = structuredClone(document)
  delete normalized.host
  delete normalized.basePath
  delete normalized.schemes
  delete normalized.servers
  if (normalized.info) delete normalized.info.description
  return stableValue(normalized)
}

export const summarizePostgrestOpenApi = (document) => {
  const paths = Object.keys(document.paths || {}).sort()
  return {
    paths: paths.length,
    rpcPaths: paths.filter((path) => path.startsWith('/rpc/')).length,
    definitions: Object.keys(document.definitions || document.components?.schemas || {}).length
  }
}

export const summarizePostgrestOpenApiCatalog = (roleCatalogs) => Object.values(roleCatalogs)
  .flatMap((documents) => Object.values(documents))
  .map(summarizePostgrestOpenApi)
  .reduce((total, counts) => ({
    roles: total.roles,
    schemaProfiles: total.schemaProfiles,
    paths: total.paths + counts.paths,
    rpcPaths: total.rpcPaths + counts.rpcPaths,
    definitions: total.definitions + counts.definitions
  }), {
    roles: Object.keys(roleCatalogs).length,
    schemaProfiles: Object.values(roleCatalogs).reduce(
      (total, documents) => total + Object.keys(documents).length,
      0
    ),
    paths: 0,
    rpcPaths: 0,
    definitions: 0
  })
