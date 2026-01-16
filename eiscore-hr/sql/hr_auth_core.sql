-- Core HR + auth schema (public + hr)
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- Roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permissions
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text,
  action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User-role mapping
create table if not exists public.user_roles (
  user_id integer not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Role-permission mapping
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- Departments
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.departments(id) on delete set null,
  leader_id integer references public.users(id) on delete set null,
  sort integer default 0,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Positions
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dept_id uuid references public.departments(id) on delete set null,
  level text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend existing users table (public.users already exists)
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists dept_id uuid references public.departments(id) on delete set null;
alter table public.users add column if not exists position_id uuid references public.positions(id) on delete set null;
alter table public.users add column if not exists status text default 'active';
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();

-- Employee profiles (extension fields)
create table if not exists hr.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  archive_id integer not null references hr.archives(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (archive_id)
);

create index if not exists idx_departments_parent_id on public.departments(parent_id);
create index if not exists idx_positions_dept_id on public.positions(dept_id);
create index if not exists idx_users_dept_id on public.users(dept_id);
create index if not exists idx_employee_profiles_archive_id on hr.employee_profiles(archive_id);

-- Grants for PostgREST role
grant usage on schema public to web_user;
grant select, insert, update, delete on public.roles to web_user;
grant select, insert, update, delete on public.permissions to web_user;
grant select, insert, update, delete on public.user_roles to web_user;
grant select, insert, update, delete on public.role_permissions to web_user;
grant select, insert, update, delete on public.departments to web_user;
grant select, insert, update, delete on public.positions to web_user;
grant select, insert, update, delete on hr.employee_profiles to web_user;
