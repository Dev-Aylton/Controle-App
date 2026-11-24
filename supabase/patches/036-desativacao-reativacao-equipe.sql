alter table public.memberships
  add column if not exists deactivated_reason text;

drop function if exists public.deactivate_member(uuid);
create or replace function public.deactivate_member(
  p_membership_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.memberships%rowtype;
  v_caller public.company_role;
begin
  select * into v_target
  from public.memberships
  where id = p_membership_id
  for update;
  if v_target.id is null then raise exception 'membership not found'; end if;
  if not v_target.active then raise exception 'membership already inactive'; end if;
  if v_target.user_id = auth.uid() then raise exception 'a member cannot deactivate themselves'; end if;
  if exists(select 1 from public.app_admins where user_id = v_target.user_id)
  then raise exception 'the application admin cannot be deactivated'; end if;

  if coalesce(public.is_admin(), false) then null;
  else
    v_caller := public.member_role(v_target.company_id);
    if v_caller = 'owner' and v_target.role in ('manager','employee') then null;
    elsif v_caller = 'manager' and v_target.role = 'employee'
      and coalesce(public.is_active_member(v_target.company_id), false) then null;
    else raise exception 'not authorized to deactivate this membership'; end if;
  end if;

  update public.memberships
  set active = false,
      deactivated_at = timezone('utc', now()),
      deactivated_by = auth.uid(),
      deactivated_reason = nullif(btrim(coalesce(p_reason,'')), '')
  where id = p_membership_id;

  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_target.company_id,'deactivate_member',
    jsonb_build_object(
      'membership_id',p_membership_id,
      'deactivated_user_id',v_target.user_id,
      'previous_role',v_target.role,
      'reason',nullif(btrim(coalesce(p_reason,'')),''),
      'support',coalesce(public.is_admin(),false)
    ));
end;
$$;

drop function if exists public.reactivate_member(uuid);
create or replace function public.reactivate_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.memberships%rowtype;
  v_caller public.company_role;
  v_active_code uuid;
begin
  select * into v_target
  from public.memberships
  where id = p_membership_id
  for update;
  if v_target.id is null then raise exception 'membership not found'; end if;
  if v_target.active then raise exception 'membership already active'; end if;

  if coalesce(public.is_admin(), false) then null;
  else
    v_caller := public.member_role(v_target.company_id);
    if v_caller = 'owner' and v_target.role in ('manager','employee') then null;
    elsif v_caller = 'manager' and v_target.role = 'employee'
      and coalesce(public.is_active_member(v_target.company_id), false) then null;
    else raise exception 'not authorized to reactivate this membership'; end if;
  end if;

  v_active_code := null;
  if v_target.role = 'employee' then
    if v_target.code_id is not null
      and exists (
        select 1 from public.company_codes c
        where c.id = v_target.code_id
          and c.company_id = v_target.company_id
          and c.active
      ) then
      v_active_code := v_target.code_id;
    else
      select c.id into v_active_code
      from public.company_codes c
      where c.company_id = v_target.company_id and c.active
      order by c.created_at desc
      limit 1;
      if v_active_code is null then raise exception 'active company code required to reactivate employee'; end if;
    end if;
  end if;

  update public.memberships
  set active = true,
      code_id = v_active_code,
      deactivated_at = null,
      deactivated_by = null,
      deactivated_reason = null
  where id = p_membership_id;

  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_target.company_id,'reactivate_member',
    jsonb_build_object(
      'membership_id',p_membership_id,
      'reactivated_user_id',v_target.user_id,
      'role',v_target.role,
      'support',coalesce(public.is_admin(),false)
    ));
end;
$$;

drop function if exists public.get_team_members(uuid);
create or replace function public.get_team_members(p_company_id uuid)
returns table(
  membership_id uuid,
  user_id uuid,
  name text,
  email text,
  role public.company_role,
  active boolean,
  deactivated_at timestamptz,
  deactivated_by uuid,
  deactivated_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
    and not exists (
      select 1 from public.memberships m
      where m.company_id=p_company_id and m.user_id=auth.uid()
        and m.active and m.role in ('owner','manager')
    )
  then raise exception 'somente administrador, proprietário ou gerente ativo pode consultar os membros da equipe'; end if;
  if not exists (select 1 from public.companies c where c.id=p_company_id)
  then raise exception 'empresa não encontrada'; end if;
  return query
    select m.id,m.user_id,
      coalesce(p.name::text,u.email::text,'Usuário sem nome'::text)::text,
      u.email::text,m.role,m.active,m.deactivated_at,m.deactivated_by,
      m.deactivated_reason,m.created_at
    from public.memberships m
    left join public.profiles p on p.id=m.user_id
    left join auth.users u on u.id=m.user_id
    where m.company_id=p_company_id
    order by m.active desc,
      case m.role when 'owner' then 1 when 'manager' then 2 else 3 end,
      coalesce(p.name::text,u.email::text,'Usuário sem nome'::text),m.id;
end;
$$;

revoke execute on function public.deactivate_member(uuid,text) from public, anon;
revoke execute on function public.reactivate_member(uuid) from public, anon;
revoke execute on function public.get_team_members(uuid) from public, anon;
grant execute on function public.deactivate_member(uuid,text) to authenticated;
grant execute on function public.reactivate_member(uuid) to authenticated;
grant execute on function public.get_team_members(uuid) to authenticated;
