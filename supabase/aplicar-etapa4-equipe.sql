create or replace function public.get_team_members(p_company_id uuid)
returns table(
  membership_id uuid,
  user_id uuid,
  name text,
  email text,
  role public.company_role,
  active boolean,
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
      select 1
      from public.memberships m
      where m.company_id = p_company_id
        and m.user_id = auth.uid()
        and m.active
        and m.role in ('owner', 'manager')
    ) then
    raise exception 'somente administrador, proprietário ou gerente ativo pode consultar os membros da equipe';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'empresa não encontrada';
  end if;

  return query
    select m.id,
      m.user_id,
      coalesce(p.name::text, u.email::text, 'Usuário sem nome'::text)::text,
      u.email::text,
      m.role,
      m.active,
      m.created_at
    from public.memberships m
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.company_id = p_company_id
      and m.active
    order by
      case m.role when 'owner' then 1 when 'manager' then 2 else 3 end,
      coalesce(p.name::text, u.email::text, 'Usuário sem nome'::text),
      m.id;
end;
$$;

revoke execute on function public.get_team_members(uuid) from public, anon;
grant execute on function public.get_team_members(uuid) to authenticated;
