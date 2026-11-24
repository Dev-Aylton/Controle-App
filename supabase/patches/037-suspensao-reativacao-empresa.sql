alter table public.companies
  add column if not exists active boolean not null default true,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id),
  add column if not exists suspended_reason text;

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
    join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid()
      and m.company_id = p_company_id
      and m.active
      and c.active
      and (
        m.role in ('owner','manager')
        or exists (
          select 1
          from public.company_codes cc
          where cc.id = m.code_id
            and cc.company_id = m.company_id
            and cc.active
        )
      )
  );
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
    join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid()
      and m.company_id = p_company_id
      and m.active
      and c.active
      and m.role in ('owner','manager')
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
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid()
    and m.company_id = p_company_id
    and m.active
    and c.active
  limit 1;
$$;

drop function if exists public.suspend_company(uuid,text);
create or replace function public.suspend_company(
  p_company_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
  then raise exception 'somente administrador do app pode suspender empresa'; end if;
  if btrim(coalesce(p_reason,'')) = ''
  then raise exception 'motivo da suspensão obrigatório'; end if;
  if not exists (select 1 from public.companies c where c.id=p_company_id)
  then raise exception 'empresa não encontrada'; end if;
  update public.companies
  set active=false,
      suspended_at=timezone('utc',now()),
      suspended_by=auth.uid(),
      suspended_reason=btrim(p_reason)
  where id=p_company_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'suspend_company',
    jsonb_build_object('reason',btrim(p_reason),'support',true));
end;
$$;

drop function if exists public.reactivate_company(uuid);
create or replace function public.reactivate_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
  then raise exception 'somente administrador do app pode reativar empresa'; end if;
  if not exists (select 1 from public.companies c where c.id=p_company_id)
  then raise exception 'empresa não encontrada'; end if;
  update public.companies
  set active=true,
      suspended_at=null,
      suspended_by=null,
      suspended_reason=null
  where id=p_company_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'reactivate_company',
    jsonb_build_object('support',true));
end;
$$;

revoke execute on function public.suspend_company(uuid,text) from public, anon;
revoke execute on function public.reactivate_company(uuid) from public, anon;
grant execute on function public.suspend_company(uuid,text) to authenticated;
grant execute on function public.reactivate_company(uuid) to authenticated;

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
  if not coalesce(public.is_admin(), false)
    and not exists (
      select 1
      from public.companies c
      where c.id=p_company_id
        and c.active
    )
  then raise exception 'empresa suspensa'; end if;

  if not coalesce(public.is_admin(), false)
    and not exists (
      select 1
      from public.memberships m
      where m.company_id=p_company_id
        and m.user_id=auth.uid()
        and m.active
        and m.role in ('owner','manager')
    )
  then raise exception 'somente administrador, proprietário ou gerente ativo pode consultar os membros da equipe'; end if;

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

revoke execute on function public.get_team_members(uuid) from public, anon;
grant execute on function public.get_team_members(uuid) to authenticated;
