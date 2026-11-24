drop function if exists public.join_company_with_code(text);
create or replace function public.join_company_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  code_row public.company_codes%rowtype;
  membership_id uuid;
  previous public.memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select c.*
  into code_row
  from public.company_codes c
  where upper(c.code)=upper(trim(p_code))
    and c.active;
  if code_row.id is null then raise exception 'invalid or inactive company code'; end if;
  if not exists (
    select 1 from public.companies c
    where c.id=code_row.company_id and c.active
  ) then raise exception 'empresa suspensa'; end if;

  select * into previous
  from public.memberships
  where user_id=auth.uid()
    and company_id=code_row.company_id
  for update;
  if previous.id is not null then
    if not previous.active then raise exception 'this membership was deactivated'; end if;
    if previous.role='employee' then
      update public.memberships
      set code_id=code_row.id
      where id=previous.id and active;
      insert into public.audit_log(user_id,company_id,action,data)
      values(auth.uid(),code_row.company_id,'join_company_with_code',
        jsonb_build_object('membership_id',previous.id,'code_id',code_row.id,'code_version',code_row.version));
    end if;
    return previous.id;
  end if;

  insert into public.memberships(user_id,company_id,role,active,code_id)
  values(auth.uid(),code_row.company_id,'employee',true,code_row.id)
  returning id into membership_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),code_row.company_id,'join_company_with_code',
    jsonb_build_object('membership_id',membership_id,'code_id',code_row.id,'code_version',code_row.version));
  return membership_id;
end;
$$;

revoke execute on function public.join_company_with_code(text) from public, anon;
grant execute on function public.join_company_with_code(text) to authenticated;
