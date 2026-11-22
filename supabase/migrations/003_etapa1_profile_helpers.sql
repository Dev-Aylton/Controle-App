create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set name = coalesce(excluded.name, public.profiles.name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_company record;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if exists(select 1 from public.app_admins a where a.user_id=v_user_id) then
    raise exception 'A conta administradora do app não pode ser excluída';
  end if;
  for v_company in
    select m.company_id from public.memberships m
    where m.user_id=v_user_id and m.active and m.role='owner'
  loop
    if not exists(
      select 1 from public.memberships other
      where other.company_id=v_company.company_id and other.user_id<>v_user_id
        and other.active and other.role='owner'
    ) then raise exception 'Transfira a propriedade antes de excluir esta conta'; end if;
  end loop;
  update public.memberships
  set active=false,deactivated_at=timezone('utc',now()),deactivated_by=v_user_id
  where user_id=v_user_id and active;
  update public.profiles set avatar_url=null,avatar_key=null where id=v_user_id;
  update auth.users
  set email=null,phone=null,encrypted_password=null,raw_user_meta_data='{}'::jsonb,
      banned_until=timezone('utc',now())+interval '100 years',updated_at=timezone('utc',now())
  where id=v_user_id;
  delete from auth.identities where user_id=v_user_id;
  delete from auth.sessions where user_id=v_user_id;
  insert into public.audit_log(user_id,company_id,action,data)
  select v_user_id,m.company_id,'account_deleted',jsonb_build_object('self_service',true)
  from public.memberships m where m.user_id=v_user_id group by m.company_id;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.is_active_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.company_id = p_company_id
      and m.active
      and (
        m.role in ('owner', 'manager')
        or exists (
          select 1
          from public.company_codes c
          where c.id = m.code_id
            and c.company_id = m.company_id
            and c.active
            and c.code = (
              select cc.code
              from public.company_codes cc
              where cc.company_id = m.company_id
                and cc.active
              limit 1
            )
        )
      )
  );
$$;

create or replace function public.member_role(p_company_id uuid)
returns public.company_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.memberships m
  where m.user_id = auth.uid()
    and m.company_id = p_company_id
    and m.active
  limit 1;
$$;

create or replace function public.is_manager_or_owner(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.company_id = p_company_id
      and m.active
      and m.role in ('owner', 'manager')
  );
$$;
