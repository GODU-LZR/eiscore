-- 用户管理视图（users + user_roles）
-- 执行方式（UTF-8）：cat user_manage_view.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace view public.v_users_manage as
select u.id,
       u.username,
       u.full_name,
       u.phone,
       u.email,
       u.status,
       ur.role_id,
       r.code as role_code,
       r.name as role_name,
       u.password,
       u.avatar
from public.users u
left join lateral (
  select role_id
  from public.user_roles ur
  where ur.user_id = u.id
  order by ur.created_at desc
  limit 1
) ur on true
left join public.roles r on r.id = ur.role_id;

grant select, insert, update, delete on public.v_users_manage to web_user;

create or replace function public.tg_v_users_manage_insert()
returns trigger language plpgsql as $$
declare
  _user_id integer;
begin
  insert into public.users (username, password, full_name, phone, email, status)
  values (
    coalesce(new.username, 'user_' || to_char(now(), 'HH24MISS')),
    coalesce(new.password, '123456'),
    new.full_name,
    new.phone,
    new.email,
    coalesce(new.status, 'active')
  )
  returning id into _user_id;

  if new.avatar is not null then
    update public.users set avatar = new.avatar where id = _user_id;
  end if;

  if new.role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (_user_id, new.role_id)
    on conflict do nothing;
  end if;

  new.id := _user_id;
  return new;
end;
$$;

create or replace function public.tg_v_users_manage_update()
returns trigger language plpgsql as $$
begin
  update public.users
  set username = coalesce(new.username, old.username),
      full_name = new.full_name,
      phone = new.phone,
      email = new.email,
      status = coalesce(new.status, old.status),
      avatar = new.avatar,
      updated_at = now()
  where id = old.id;

  if new.password is not null and new.password <> '' then
    update public.users set password = new.password where id = old.id;
  end if;

  if new.role_id is distinct from old.role_id then
    delete from public.user_roles where user_id = old.id;
    if new.role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (old.id, new.role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.tg_v_users_manage_delete()
returns trigger language plpgsql as $$
begin
  delete from public.user_roles where user_id = old.id;
  delete from public.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists tg_v_users_manage_insert on public.v_users_manage;
create trigger tg_v_users_manage_insert
instead of insert on public.v_users_manage
for each row execute function public.tg_v_users_manage_insert();

drop trigger if exists tg_v_users_manage_update on public.v_users_manage;
create trigger tg_v_users_manage_update
instead of update on public.v_users_manage
for each row execute function public.tg_v_users_manage_update();

drop trigger if exists tg_v_users_manage_delete on public.v_users_manage;
create trigger tg_v_users_manage_delete
instead of delete on public.v_users_manage
for each row execute function public.tg_v_users_manage_delete();
