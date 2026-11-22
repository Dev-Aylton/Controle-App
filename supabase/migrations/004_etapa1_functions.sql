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
