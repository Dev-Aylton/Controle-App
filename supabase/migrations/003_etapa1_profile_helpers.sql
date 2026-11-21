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
