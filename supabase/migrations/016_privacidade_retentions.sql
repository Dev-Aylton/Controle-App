create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  finalization_started_at timestamptz,
  canceled_at timestamptz,
  completed_at timestamptz,
  constraint account_deletion_requests_status_check
    check (status in ('pending', 'finalizing', 'cancelled', 'completed')),
  constraint account_deletion_requests_schedule_check
    check (scheduled_for > requested_at)
);

create unique index if not exists account_deletion_requests_one_pending
  on public.account_deletion_requests(user_id)
  where status in ('pending', 'finalizing');

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from public, anon, authenticated, service_role;

create table if not exists public.privacy_policy_releases (
  version text primary key,
  status text not null default 'draft',
  is_current boolean not null default false,
  published_at timestamptz,
  content_sha256 text,
  created_at timestamptz not null default now(),
  constraint privacy_policy_releases_status_check
    check (status in ('draft', 'published', 'retired')),
  constraint privacy_policy_releases_current_check
    check (not is_current or (status = 'published' and published_at is not null))
);

create unique index if not exists privacy_policy_releases_one_current
  on public.privacy_policy_releases(is_current)
  where is_current;

insert into public.privacy_policy_releases(version, status, is_current)
values ('1.0.0', 'draft', false)
on conflict (version) do nothing;

alter table public.privacy_policy_releases enable row level security;
revoke all on table public.privacy_policy_releases from public, anon, authenticated, service_role;

create table if not exists public.privacy_policy_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null references public.privacy_policy_releases(version),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version)
);

alter table public.privacy_policy_acceptances enable row level security;
revoke all on table public.privacy_policy_acceptances from public, anon, authenticated, service_role;

create or replace function public.get_privacy_policy_status()
returns table(policy_version text, published_at timestamptz, accepted_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  return query
    select release.version, release.published_at, acceptance.accepted_at
    from public.privacy_policy_releases release
    left join public.privacy_policy_acceptances acceptance
      on acceptance.user_id = auth.uid()
      and acceptance.policy_version = release.version
    where release.is_current
      and release.status = 'published';
end;
$$;

create or replace function public.accept_current_privacy_policy()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_version text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select release.version into current_version
  from public.privacy_policy_releases release
  where release.is_current
    and release.status = 'published';

  if current_version is null then
    raise exception 'no published privacy policy';
  end if;

  insert into public.privacy_policy_acceptances(user_id, policy_version)
  values (auth.uid(), current_version)
  on conflict (user_id, policy_version) do nothing;

  return current_version;
end;
$$;

revoke all on function public.get_privacy_policy_status() from public, anon;
grant execute on function public.get_privacy_policy_status() to authenticated;
revoke all on function public.accept_current_privacy_policy() from public, anon;
grant execute on function public.accept_current_privacy_policy() to authenticated;

create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  requested_time timestamptz := now();
  current_request public.account_deletion_requests%rowtype;
  company_row record;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if exists (
    select 1 from public.app_admins admin_row
    where admin_row.user_id = current_user_id
  ) then
    raise exception 'A conta administradora do app não pode ser excluída';
  end if;

  select * into current_request
  from public.account_deletion_requests request_row
  where request_row.user_id = current_user_id
    and request_row.status in ('pending', 'finalizing')
  order by request_row.requested_at desc
  limit 1
  for update;

  if found then
    return current_request.scheduled_for;
  end if;

  for company_row in
    select membership.company_id
    from public.memberships membership
    where membership.user_id = current_user_id
      and membership.active
      and membership.role = 'owner'
  loop
    if not exists (
      select 1 from public.memberships other_owner
      where other_owner.company_id = company_row.company_id
        and other_owner.user_id <> current_user_id
        and other_owner.active
        and other_owner.role = 'owner'
    ) then
      raise exception 'Transfira a propriedade antes de excluir esta conta';
    end if;
  end loop;

  insert into public.account_deletion_requests(user_id, requested_at, scheduled_for)
  values (current_user_id, requested_time, requested_time + interval '90 days')
  returning * into current_request;

  update public.memberships
  set active = false,
      deactivated_at = requested_time,
      deactivated_by = current_user_id
  where user_id = current_user_id
    and active;

  delete from auth.sessions
  where user_id = current_user_id;

  insert into public.audit_log(user_id, company_id, action, data)
  select current_user_id, membership.company_id, 'account_deletion_requested',
    jsonb_build_object('scheduled_for', current_request.scheduled_for)
  from public.memberships membership
  where membership.user_id = current_user_id
  group by membership.company_id;

  return current_request.scheduled_for;
end;
$$;

create or replace function public.get_account_deletion_status()
returns table(
  request_id uuid,
  status text,
  requested_at timestamptz,
  scheduled_for timestamptz,
  can_reactivate boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  return query
    select request.id, request.status, request.requested_at, request.scheduled_for,
      request.status = 'pending' and request.scheduled_for > now()
    from public.account_deletion_requests request
    where request.user_id = auth.uid()
      and request.status in ('pending', 'finalizing')
    order by request.requested_at desc
    limit 1;
end;
$$;

create or replace function public.reactivate_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_request public.account_deletion_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into current_request
  from public.account_deletion_requests request
  where request.user_id = current_user_id
    and request.status = 'pending'
  order by request.requested_at desc
  limit 1
  for update;

  if not found or current_request.scheduled_for <= now() then
    raise exception 'O prazo para reativar a conta terminou';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled',
      canceled_at = now()
  where id = current_request.id;

  update public.memberships
  set active = true,
      deactivated_at = null,
      deactivated_by = null
  where user_id = current_user_id
    and not active
    and deactivated_by = current_user_id
    and deactivated_at = current_request.requested_at;

  insert into public.audit_log(user_id, company_id, action, data)
  select current_user_id, membership.company_id, 'account_deletion_cancelled',
    jsonb_build_object('request_id', current_request.id)
  from public.memberships membership
  where membership.user_id = current_user_id
  group by membership.company_id;
end;
$$;

create or replace function public.prevent_pending_deletion_membership_activation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.active and exists (
    select 1 from public.account_deletion_requests request
    where request.user_id = new.user_id
      and request.status in ('pending', 'finalizing')
  ) then
    raise exception 'A conta está desativada enquanto aguarda exclusão';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_pending_account_deletion on public.memberships;
create trigger memberships_pending_account_deletion
before insert or update of active, user_id on public.memberships
for each row execute function public.prevent_pending_deletion_membership_activation();

create or replace function public.claim_expired_account_deletions(p_limit integer default 100)
returns table(request_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_request public.account_deletion_requests%rowtype;
  batch_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  for current_request in
    select request.*
    from public.account_deletion_requests request
    where (request.status = 'pending' and request.scheduled_for <= now())
      or (
        request.status = 'finalizing'
        and request.finalization_started_at < now() - interval '30 minutes'
      )
    order by request.scheduled_for
    limit batch_limit
    for update skip locked
  loop
    update public.account_deletion_requests
    set status = 'finalizing',
        finalization_started_at = now()
    where id = current_request.id;

    request_id := current_request.id;
    user_id := current_request.user_id;
    return next;
  end loop;
end;
$$;

create or replace function public.release_expired_account_deletion(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.account_deletion_requests
  set status = 'pending',
      finalization_started_at = null
  where id = p_request_id
    and status = 'finalizing'
    and scheduled_for <= now();
end;
$$;

create or replace function public.finalize_expired_account_deletion(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_request public.account_deletion_requests%rowtype;
  current_email text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  select * into current_request
  from public.account_deletion_requests request
  where request.id = p_request_id
    and request.status = 'finalizing'
    and request.scheduled_for <= now()
  for update;

  if not found then
    return false;
  end if;

  select auth_user.email into current_email
  from auth.users auth_user
  where auth_user.id = current_request.user_id;

  if current_email is not null then
    delete from public.company_invites invite
    where invite.used_at is null
      and lower(invite.email) = lower(current_email);
  end if;

  update public.profiles
  set name = 'Conta excluída',
      avatar_url = null,
      avatar_key = null
  where id = current_request.user_id;

  update auth.users
  set email = null,
      phone = null,
      encrypted_password = null,
      raw_user_meta_data = '{}'::jsonb,
      banned_until = now() + interval '100 years',
      updated_at = now()
  where id = current_request.user_id;

  delete from auth.identities
  where user_id = current_request.user_id;

  delete from auth.sessions
  where user_id = current_request.user_id;

  update public.account_deletion_requests
  set status = 'completed',
      completed_at = now()
  where id = current_request.id;

  insert into public.audit_log(user_id, company_id, action, data)
  select current_request.user_id, membership.company_id, 'account_deleted',
    jsonb_build_object('request_id', current_request.id, 'identifiers_removed', true)
  from public.memberships membership
  where membership.user_id = current_request.user_id
  group by membership.company_id;

  return true;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
revoke all on function public.get_account_deletion_status() from public, anon;
grant execute on function public.get_account_deletion_status() to authenticated;
revoke all on function public.reactivate_my_account() from public, anon;
grant execute on function public.reactivate_my_account() to authenticated;
revoke all on function public.prevent_pending_deletion_membership_activation() from public, anon, authenticated, service_role;
revoke all on function public.claim_expired_account_deletions(integer) from public, anon, authenticated;
grant execute on function public.claim_expired_account_deletions(integer) to service_role;
revoke all on function public.release_expired_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.release_expired_account_deletion(uuid) to service_role;
revoke all on function public.finalize_expired_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.finalize_expired_account_deletion(uuid) to service_role;
