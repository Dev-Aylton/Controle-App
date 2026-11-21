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
  created_at timestamptz not null default timezone('utc', now())
);

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
