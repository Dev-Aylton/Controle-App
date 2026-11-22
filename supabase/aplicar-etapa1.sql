-- Controle-App - Etapa 1
-- Gerado por npm run sql:unir. Não aplicar automaticamente.

-- ============================================================
-- Migration: 001_etapa1_enum_extensions.sql
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.company_role as enum ('owner', 'manager', 'employee');
exception
  when duplicate_object then null;
end;
$$;

-- ============================================================
-- Migration: 002_etapa1_tables.sql
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  photo text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null unique,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  constraint company_codes_version_positive check (version > 0)
);

create unique index if not exists company_codes_one_active_per_company
  on public.company_codes(company_id) where active;

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.company_role not null,
  active boolean not null default true,
  code_id uuid references public.company_codes(id),
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint memberships_unique_user_company unique (user_id, company_id),
  constraint memberships_employee_code
    check (role <> 'employee' or code_id is not null),
  constraint memberships_nonemployee_no_code
    check (role = 'employee' or code_id is null)
);

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role public.company_role not null,
  invited_by uuid not null references auth.users(id),
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint company_invites_roles check (role in ('owner', 'manager')),
  constraint company_invites_email_lower check (email = lower(email))
);

create index if not exists company_invites_pending_email
  on public.company_invites(lower(email), used_at);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  company_id uuid references public.companies(id),
  action text not null,
  data jsonb not null default '{}'::jsonb,
  acted_as_support boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.mark_audit_support()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  new.acted_as_support:=coalesce(public.is_admin(),false);
  return new;
end;
$$;

drop trigger if exists audit_log_mark_support on public.audit_log;
create trigger audit_log_mark_support
before insert on public.audit_log
for each row execute function public.mark_audit_support();

create or replace function public.block_audit_changes()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'audit log is immutable';
end;
$$;

drop trigger if exists audit_log_block_update on public.audit_log;
create trigger audit_log_block_update
before update or delete on public.audit_log
for each statement execute function public.block_audit_changes();

create or replace function public.enforce_owner_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.active, false) and new.role = 'owner' then
    if (
      select count(*)
      from public.memberships m
      where m.company_id = new.company_id
        and m.active
        and m.role = 'owner'
        and m.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
    ) >= 3 then
      raise exception 'company already has three active owners';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_owner_limit on public.memberships;
create trigger memberships_owner_limit
before insert or update of role, active, company_id on public.memberships
for each row execute function public.enforce_owner_limit();

create or replace function public.enforce_single_app_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.app_admins) then
    raise exception 'only one application admin is allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists app_admins_single_row on public.app_admins;
create trigger app_admins_single_row
before insert on public.app_admins
for each row execute function public.enforce_single_app_admin();

-- ============================================================
-- Migration: 003_etapa1_profile_helpers.sql
-- ============================================================

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

-- ============================================================
-- Migration: 004_etapa1_functions.sql
-- ============================================================

create or replace function public.secure_company_code(p_company_id uuid)
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  byte_value integer;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..10 loop
      byte_value := (get_byte(extensions.gen_random_bytes(1), 0) & 127) % length(alphabet);
      candidate := candidate || substr(alphabet, byte_value + 1, 1);
    end loop;
    candidate := substr(candidate, 1, 5) || '-' || substr(candidate, 6, 5);
    begin
      perform 1 from public.company_codes where code = candidate;
      if not found then
        return candidate;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.rotate_company_code(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_code text;
  next_version integer;
begin
  if not public.is_admin() then
    raise exception 'only the app admin can rotate company codes';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'company not found';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.company_codes
  where company_id = p_company_id;

  update public.company_codes
  set active = false
  where company_id = p_company_id and active;

  new_code := public.secure_company_code(p_company_id);
  insert into public.company_codes(company_id, code, version, active, created_by)
  values (p_company_id, new_code, next_version, true, auth.uid());

  insert into public.audit_log(user_id, company_id, action, data)
  values (
    auth.uid(), p_company_id, 'rotate_company_code',
    jsonb_build_object('code_version', next_version)
  );
  return new_code;
end;
$$;

create or replace function public.join_company_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  code_row public.company_codes%rowtype;
  membership_id uuid;
  previous public.memberships%rowtype;
begin
  select *
  into code_row
  from public.company_codes
  where upper(code) = upper(trim(p_code))
    and active;

  if code_row.id is null then
    raise exception 'invalid or inactive company code';
  end if;

  select * into previous
  from public.memberships
  where user_id = auth.uid()
    and company_id = code_row.company_id;

  if previous.id is not null then
    if not previous.active then
      raise exception 'this membership was deactivated';
    end if;
    if previous.role = 'employee' then
      update public.memberships
      set code_id = code_row.id
      where id = previous.id
        and active;

      insert into public.audit_log(user_id, company_id, action, data)
      values (
        auth.uid(), code_row.company_id, 'join_company_with_code',
        jsonb_build_object(
          'membership_id', previous.id,
          'previous_code_id', previous.code_id,
          'code_id', code_row.id,
          'code_version', code_row.version
        )
      );
    end if;
    return previous.id;
  end if;

  insert into public.memberships(user_id, company_id, role, active, code_id)
  values (auth.uid(), code_row.company_id, 'employee', true, code_row.id)
  returning id into membership_id;

  insert into public.audit_log(user_id, company_id, action, data)
  values (
    auth.uid(), code_row.company_id, 'join_company_with_code',
    jsonb_build_object('membership_id', membership_id, 'code_id', code_row.id)
  );
  return membership_id;
end;
$$;

create or replace function public.claim_invites()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed integer := 0;
  invite record;
  existing public.memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  for invite in
    select i.*
    from public.company_invites i
    where i.used_at is null
      and i.email = lower(coalesce(auth.email(), ''))
    for update
  loop
    select * into existing
    from public.memberships
    where user_id = auth.uid()
      and company_id = invite.company_id;

    if existing.id is null then
      insert into public.memberships(user_id, company_id, role, active)
      values (auth.uid(), invite.company_id, invite.role, true);
    elsif not existing.active then
      -- A deactivated membership is never silently reactivated by an invite.
      null;
    elsif existing.role = 'employee' and invite.role = 'manager' then
      update public.memberships
      set role = 'manager', code_id = null
      where id = existing.id;
    elsif existing.role = 'employee' and invite.role = 'owner' then
      update public.memberships
      set role = 'owner', code_id = null
      where id = existing.id;
    end if;

    update public.company_invites
    set used_at = timezone('utc', now())
    where id = invite.id;

    insert into public.audit_log(user_id, company_id, action, data)
    values (
      auth.uid(), invite.company_id, 'claim_invite',
      jsonb_build_object('invite_id', invite.id, 'role', invite.role)
    );
    claimed := claimed + 1;
  end loop;
  return claimed;
end;
$$;

create or replace function public.create_invite(p_company_id uuid, p_email text, p_role public.company_role)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(p_email));
  invite_id uuid;
begin
  if normalized_email = '' then
    raise exception 'email is required';
  end if;

  if public.is_admin() then
    if p_role = 'employee' then
      raise exception 'use the company code for employees';
    end if;
  elsif public.member_role(p_company_id) = 'owner'
    and p_role = 'manager' then
    null;
  else
    raise exception 'not authorized to create this invite';
  end if;

  insert into public.company_invites(company_id, email, role, invited_by)
  values (p_company_id, normalized_email, p_role, auth.uid())
  returning id into invite_id;

  insert into public.audit_log(user_id, company_id, action, data)
  values (
    auth.uid(), p_company_id, 'create_invite',
    jsonb_build_object('invite_id', invite_id, 'email', normalized_email, 'role', p_role)
  );
  return invite_id;
end;
$$;

create or replace function public.promote_to_manager(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.memberships%rowtype;
begin
  select * into target
  from public.memberships
  where id = p_membership_id;

  if target.id is null then
    raise exception 'membership not found';
  end if;
  if not target.active then
    raise exception 'cannot promote a deactivated membership';
  end if;
  if target.role = 'owner' then
    raise exception 'cannot promote an owner';
  end if;
  if target.role = 'manager' then
    raise exception 'cannot promote a manager';
  end if;
  if target.role <> 'employee' then
    raise exception 'only active employees can be promoted';
  end if;
  if not coalesce(public.is_admin(), false)
    and not exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.company_id = target.company_id
        and m.active
        and m.role = 'owner'
    ) then
    raise exception 'only an admin or company owner can promote members';
  end if;

  update public.memberships
  set role = 'manager', code_id = null
  where id = p_membership_id;

  insert into public.audit_log(user_id, company_id, action, data)
  values (
    auth.uid(), target.company_id, 'promote_to_manager',
    jsonb_build_object('membership_id', p_membership_id, 'promoted_user_id', target.user_id)
  );
end;
$$;

create or replace function public.deactivate_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.memberships%rowtype;
  caller_role public.company_role;
begin
  select * into target
  from public.memberships
  where id = p_membership_id;

  if target.id is null then
    raise exception 'membership not found';
  end if;
  if target.user_id = auth.uid() then
    raise exception 'a member cannot deactivate themselves';
  end if;
  if exists (select 1 from public.app_admins where user_id = target.user_id) then
    raise exception 'the application admin cannot be deactivated';
  end if;

  if public.is_admin() then
    null;
  else
    caller_role := public.member_role(target.company_id);
    if caller_role = 'owner' and target.role in ('manager', 'employee') then
      null;
    elsif caller_role = 'manager' and target.role = 'employee'
      and public.is_active_member(target.company_id) then
      null;
    else
      raise exception 'not authorized to deactivate this membership';
    end if;
  end if;

  update public.memberships
  set active = false,
      deactivated_at = timezone('utc', now()),
      deactivated_by = auth.uid()
  where id = p_membership_id;

  insert into public.audit_log(user_id, company_id, action, data)
  values (
    auth.uid(), target.company_id, 'deactivate_member',
    jsonb_build_object(
      'membership_id', p_membership_id,
      'deactivated_user_id', target.user_id,
      'previous_role', target.role
    )
  );
end;
$$;

-- ============================================================
-- Migration: 005_etapa1_storage.sql
-- ============================================================

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-photos',
  'company-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- Migration: 006_etapa1_rls_grants_policies.sql
-- ============================================================

alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.companies enable row level security;
alter table public.company_codes enable row level security;
alter table public.memberships enable row level security;
alter table public.company_invites enable row level security;
alter table public.audit_log enable row level security;

revoke all on table
  public.profiles,
  public.app_admins,
  public.companies,
  public.company_codes,
  public.memberships,
  public.company_invites,
  public.audit_log
from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update(name, avatar_url) on public.profiles to authenticated;

grant select on public.app_admins to authenticated;

grant select, insert(name, phone, photo) on public.companies to authenticated;
grant update(name, phone, photo) on public.companies to authenticated;

grant select on public.company_codes to authenticated;
grant select on public.memberships to authenticated;

grant select on public.company_invites to authenticated;

grant select on public.audit_log to authenticated;
revoke update, delete on public.audit_log from public, anon, authenticated, service_role;
revoke update, delete on public.audit_log from public, anon, authenticated, service_role;

grant usage, select on sequence public.audit_log_id_seq to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.member_role(uuid) to authenticated;
grant execute on function public.is_manager_or_owner(uuid) to authenticated;
grant execute on function public.rotate_company_code(uuid) to authenticated;
grant execute on function public.join_company_with_code(text) to authenticated;
grant execute on function public.claim_invites() to authenticated;
grant execute on function public.create_invite(uuid, text, public.company_role) to authenticated;
grant execute on function public.promote_to_manager(uuid) to authenticated;
grant execute on function public.deactivate_member(uuid) to authenticated;

revoke execute on function public.secure_company_code(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_owner_limit() from public, anon, authenticated;
revoke execute on function public.enforce_single_app_admin() from public, anon, authenticated;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "app_admins_select_admin" on public.app_admins;
create policy "app_admins_select_admin"
on public.app_admins for select
to authenticated
using (public.is_admin());

drop policy if exists "companies_select_active_members_or_admin" on public.companies;
create policy "companies_select_active_members_or_admin"
on public.companies for select
to authenticated
using (public.is_admin() or public.is_active_member(id));

drop policy if exists "companies_insert_admin" on public.companies;
create policy "companies_insert_admin"
on public.companies for insert
to authenticated
with check (public.is_admin());

drop policy if exists "companies_update_admin_owner_manager" on public.companies;
create policy "companies_update_admin_owner_manager"
on public.companies for update
to authenticated
using (public.is_admin() or public.is_manager_or_owner(id))
with check (public.is_admin() or public.is_manager_or_owner(id));

drop policy if exists "company_codes_select_admin_owner_manager" on public.company_codes;
create policy "company_codes_select_admin_owner_manager"
on public.company_codes for select
to authenticated
using (
  public.is_admin()
  or public.is_manager_or_owner(company_id)
);

drop policy if exists "memberships_select_self_or_leaders" on public.memberships;
create policy "memberships_select_self_or_leaders"
on public.memberships for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or public.is_manager_or_owner(company_id)
);

drop policy if exists "invites_select_admin_owner" on public.company_invites;
create policy "invites_select_admin_owner"
on public.company_invites for select
to authenticated
using (
  public.is_admin()
  or public.member_role(company_id) = 'owner'
);

drop policy if exists "audit_select_admin_owner_manager" on public.audit_log;
create policy "audit_select_admin_owner_manager"
on public.audit_log for select
to authenticated
using (
  public.is_admin()
  or (
    company_id is not null
    and public.is_manager_or_owner(company_id)
  )
);

drop policy if exists "company_photos_select_members" on storage.objects;
create policy "company_photos_select_members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_active_member(
      split_part(name, '/', 2)::uuid
    )
  )
);

drop policy if exists "company_photos_insert_leaders" on storage.objects;
create policy "company_photos_insert_leaders"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_manager_or_owner(split_part(name, '/', 2)::uuid)
  )
);

drop policy if exists "company_photos_update_leaders" on storage.objects;
create policy "company_photos_update_leaders"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_manager_or_owner(split_part(name, '/', 2)::uuid)
  )
)
with check (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_manager_or_owner(split_part(name, '/', 2)::uuid)
  )
);
