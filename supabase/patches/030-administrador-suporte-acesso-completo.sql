-- Administrador do aplicativo atua como suporte: acesso completo a todas as
-- empresas, sem exigir vínculo/membership e com identificação na auditoria.

create or replace function public.register_dose_movement(
  p_company_id uuid,
  p_product_id uuid,
  p_environment_id uuid,
  p_kind text,
  p_doses numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_doses_per_unit integer;
  v_quantity numeric(14,3);
  v_movement_id uuid;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_active_member(p_company_id), false)
  then
    raise exception 'Membro ativo necessário para lançar dose';
  end if;
  if p_kind not in ('entrada','saida','perda') then raise exception 'Tipo de dose inválido'; end if;
  if p_doses is null or p_doses <= 0 then raise exception 'Quantidade de doses deve ser positiva'; end if;
  select * into v_product
  from public.products
  where id=p_product_id and company_id=p_company_id and active;
  if v_product.id is null then raise exception 'Produto inválido'; end if;
  if not exists (
    select 1 from public.environments e
    where e.id=p_environment_id and e.company_id=p_company_id and e.active
  ) then raise exception 'Ambiente inválido'; end if;
  if v_product.volume_ml is null or v_product.dose_ml is null
    or v_product.volume_ml <= 0 or v_product.dose_ml <= 0
  then raise exception 'Produto sem volume ou dose cadastrados'; end if;
  v_doses_per_unit := floor(v_product.volume_ml / v_product.dose_ml)::integer;
  if v_doses_per_unit < 1 then raise exception 'Produto não possui dose válida'; end if;
  v_quantity := (p_doses / v_doses_per_unit)::numeric(14,3);
  v_movement_id := public.register_movement(
    p_company_id, p_product_id, p_environment_id, p_kind, v_quantity, p_note
  );
  return v_movement_id;
end;
$$;

revoke execute on function public.register_dose_movement(uuid,uuid,uuid,text,numeric,text) from public, anon;
grant execute on function public.register_dose_movement(uuid,uuid,uuid,text,numeric,text) to authenticated;

create or replace function public.zero_stock(
  p_company_id uuid,
  p_environment_id uuid,
  p_product_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric;
  v_product record;
  v_adjusted integer := 0;
  v_differences jsonb := '[]'::jsonb;
  v_movement_id uuid;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then
    raise exception 'Somente proprietário, gerente ou administrador pode zerar estoque';
  end if;
  if btrim(coalesce(p_reason,'')) = '' then raise exception 'Motivo da zeragem é obrigatório'; end if;
  if not exists (
    select 1 from public.environments e
    where e.id=p_environment_id and e.company_id=p_company_id and e.active
  ) then raise exception 'Ambiente inválido'; end if;
  if p_product_id is not null and not exists (
    select 1 from public.products p
    where p.id=p_product_id and p.company_id=p_company_id
  ) then raise exception 'Produto inválido'; end if;

  for v_product in
    select p.id,p.name
    from public.products p
    where p.company_id=p_company_id
      and p.active
      and (p_product_id is null or p.id=p_product_id)
  loop
    select coalesce(sum(m.signed_quantity),0)::numeric(14,3) into v_balance
    from public.stock_movements m
    where m.company_id=p_company_id
      and m.environment_id=p_environment_id
      and m.product_id=v_product.id;
    if v_balance<>0 then
      insert into public.stock_movements(
        company_id,product_id,environment_id,type,quantity,signed_quantity,note,created_by
      )
      values(
        p_company_id,v_product.id,p_environment_id,'zeragem',
        abs(v_balance),-v_balance,p_reason,auth.uid()
      )
      returning id into v_movement_id;
      v_adjusted := v_adjusted+1;
      v_differences := v_differences || jsonb_build_object(
        'product_id',v_product.id,'previous_balance',v_balance,'movement_id',v_movement_id
      );
    end if;
  end loop;

  insert into public.audit_log(user_id,company_id,action,data)
  values(
    auth.uid(),p_company_id,'stock_zeroed',
    jsonb_build_object(
      'environment_id',p_environment_id,'reason',p_reason,'product_id',p_product_id,
      'adjusted',v_adjusted,'differences',v_differences,'support',coalesce(public.is_admin(),false)
    )
  );
  return jsonb_build_object('adjusted',v_adjusted,'differences',v_differences);
end;
$$;

revoke execute on function public.zero_stock(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.zero_stock(uuid,uuid,uuid,text) to authenticated;
