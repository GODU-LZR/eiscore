-- RLS template for HR archives (data scope by role)
-- Note: PostgREST should set role=web_user and JWT contains app_role / username.
-- This template assumes current_user permissions are already validated.

-- Enable RLS on hr.archives
alter table hr.archives enable row level security;

-- Helper: current username from jwt
create or replace function public.current_username()
returns text
language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'username'
$$;

-- Helper: current app_role
create or replace function public.current_app_role()
returns text
language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'app_role'
$$;

-- Helper: current role data scope for module
create or replace function public.current_scope(module_name text)
returns text
language sql stable as $$
  select scope_type
  from public.role_data_scopes rds
  join public.roles r on r.id = rds.role_id
  where r.code = public.current_app_role()
    and rds.module = module_name
  limit 1
$$;

-- Helper: current user's department name (from hr.archives)
create or replace function public.current_user_dept()
returns text
language sql stable as $$
  select department
  from hr.archives
  where name = public.current_username()
  limit 1
$$;

-- Placeholder for dept tree resolution. Replace with real function if needed.
create or replace function public.dept_tree_names(root_name text)
returns setof text
language sql stable as $$
  -- naive: only returns root_name (extend with dept tree later)
  select root_name
$$;

drop policy if exists hr_archives_scope_policy on hr.archives;
create policy hr_archives_scope_policy on hr.archives
for select using (
  case public.current_scope('hr_employee')
    when 'all' then true
    when 'self' then name = public.current_username()
    when 'dept' then department = public.current_user_dept()
    when 'dept_tree' then department in (select * from public.dept_tree_names(public.current_user_dept()))
    else false
  end
);

-- Optional: write policy (adjust as needed)
drop policy if exists hr_archives_write_policy on hr.archives;
create policy hr_archives_write_policy on hr.archives
for update using (
  case public.current_scope('hr_employee')
    when 'all' then true
    when 'dept' then department = public.current_user_dept()
    when 'dept_tree' then department in (select * from public.dept_tree_names(public.current_user_dept()))
    else false
  end
)
with check (
  case public.current_scope('hr_employee')
    when 'all' then true
    when 'dept' then department = public.current_user_dept()
    when 'dept_tree' then department in (select * from public.dept_tree_names(public.current_user_dept()))
    else false
  end
);

