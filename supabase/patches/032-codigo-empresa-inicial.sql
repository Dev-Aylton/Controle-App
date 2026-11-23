create or replace function public.get_company_code(p_company_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then
    raise exception 'Somente administrador, proprietário ou gerente pode consultar o código';
  end if;
  select c.code into v_code
  from public.company_codes c
  where c.company_id=p_company_id and c.active
  order by c.version desc
  limit 1;
  return v_code;
end;
$$;

create or replace function public.ensure_company_code(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_version integer;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then
    raise exception 'Somente administrador, proprietário ou gerente pode gerar o código';
  end if;
  if not exists (select 1 from public.companies where id=p_company_id)
  then raise exception 'Empresa não encontrada'; end if;

  select c.code into v_code
  from public.company_codes c
  where c.company_id=p_company_id and c.active
  order by c.version desc limit 1;
  if v_code is not null then return v_code; end if;

  select coalesce(max(c.version),0)+1 into v_version
  from public.company_codes c where c.company_id=p_company_id;
  v_code := public.secure_company_code(p_company_id);
  insert into public.company_codes(company_id,code,version,active,created_by)
  values(p_company_id,v_code,v_version,true,auth.uid());
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'create_company_code',jsonb_build_object('code_version',v_version));
  return v_code;
end;
$$;

revoke execute on function public.get_company_code(uuid) from public, anon;
revoke execute on function public.ensure_company_code(uuid) from public, anon;
grant execute on function public.get_company_code(uuid) to authenticated;
grant execute on function public.ensure_company_code(uuid) to authenticated;
