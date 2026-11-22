create or replace function public.save_sales_product_map(
  p_company_id uuid,
  p_external_name text,
  p_product_id uuid,
  p_environment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_map_id uuid; v_normalized text;
begin
  if coalesce(public.is_admin(),false) then raise exception 'Administrador não altera o mapa de vendas'; end if;
  if not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode alterar o mapa';
  end if;
  v_normalized:=public.normalize_external_name(p_external_name);
  if v_normalized='' then raise exception 'Nome externo inválido'; end if;
  if not exists(select 1 from public.products p where p.id=p_product_id and p.company_id=p_company_id)
    or not exists(select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id)
  then raise exception 'Produto ou ambiente não pertence à empresa'; end if;
  insert into public.sales_product_map(company_id,external_name,external_name_normalized,product_id,environment_id,created_by)
  values(p_company_id,btrim(p_external_name),v_normalized,p_product_id,p_environment_id,auth.uid())
  on conflict(company_id,external_name_normalized,environment_id)
  do update set external_name=excluded.external_name,product_id=excluded.product_id,created_by=auth.uid()
  returning id into v_map_id;
  return v_map_id;
end;
$$;

create or replace function public.remove_sales_product_map(p_company_id uuid,p_map_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if coalesce(public.is_admin(),false) then raise exception 'Administrador não altera o mapa de vendas'; end if;
  if not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode alterar o mapa';
  end if;
  delete from public.sales_product_map where id=p_map_id and company_id=p_company_id;
  if not found then raise exception 'Vínculo de vendas inválido para esta empresa'; end if;
end;
$$;

create or replace function public.import_sales_batch(p_company_id uuid,p_environment_id uuid,p_label text,p_items jsonb)
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_batch_id uuid; v_item jsonb; v_product_id uuid; v_quantity numeric;
  v_sale_type text; v_deducted numeric(14,3); v_movement_id uuid;
  v_total_quantity numeric(14,3):=0; v_total_items integer:=0;
  v_volume numeric; v_dose numeric; v_doses integer;
begin
  if coalesce(public.is_admin(),false) then raise exception 'Administrador não importa vendas'; end if;
  if not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode importar vendas';
  end if;
  if jsonb_typeof(p_items)<> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Lista de vendas inválida'; end if;
  if not exists(select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id and e.active)
  then raise exception 'Ambiente inválido'; end if;
  insert into public.sales_import_batches(company_id,environment_id,label,imported_by,total_items,total_quantity)
  values(p_company_id,p_environment_id,btrim(p_label),auth.uid(),0,0) returning id into v_batch_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id:=nullif(v_item->>'product_id','')::uuid;
    v_quantity:=(v_item->>'quantity')::numeric;
    v_sale_type:=lower(coalesce(v_item->>'sale_type','unidade'));
    if v_product_id is null or v_quantity<=0 or v_sale_type not in ('unidade','dose') then raise exception 'Item de venda inválido'; end if;
    if not exists(select 1 from public.products p where p.id=v_product_id and p.company_id=p_company_id and p.active)
    then raise exception 'Produto não pertence à empresa'; end if;
    if v_sale_type='dose' then
      select p.volume_ml,p.dose_ml into v_volume,v_dose from public.products p where p.id=v_product_id;
      if v_volume is null or v_dose is null or v_volume<=0 or v_dose<=0 then raise exception 'Produto sem volume ou dose cadastrados'; end if;
      v_doses:=floor(v_volume/v_dose)::integer;
      if v_doses<1 then raise exception 'Produto não possui dose válida'; end if;
      v_deducted:=(v_quantity/v_doses)::numeric(14,3);
    else v_deducted:=v_quantity; end if;
    insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,note,created_by)
    values(p_company_id,v_product_id,p_environment_id,'saida',v_deducted,-v_deducted,'Venda: '||btrim(p_label),auth.uid())
    returning id into v_movement_id;
    insert into public.sales_import_items(batch_id,product_id,quantity,sale_type,movement_id)
    values(v_batch_id,v_product_id,v_quantity,v_sale_type,v_movement_id);
    v_total_quantity:=v_total_quantity+v_quantity; v_total_items:=v_total_items+1;
  end loop;
  update public.sales_import_batches set total_items=v_total_items,total_quantity=v_total_quantity where id=v_batch_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'sales_import_applied',jsonb_build_object('batch_id',v_batch_id,'items',v_total_items,'quantity',v_total_quantity));
  return v_batch_id;
end;
$$;

create or replace function public.undo_sales_import(p_batch_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_batch public.sales_import_batches%rowtype; v_item public.sales_import_items%rowtype;
begin
  select * into v_batch from public.sales_import_batches where id=p_batch_id;
  if v_batch.id is null then raise exception 'Lote de vendas não encontrado'; end if;
  if coalesce(public.is_admin(),false) then raise exception 'Administrador não desfaz importação de vendas'; end if;
  if not coalesce(public.is_manager_or_owner(v_batch.company_id),false) then
    raise exception 'Somente proprietário ou gerente pode desfazer importação';
  end if;
  if v_batch.status='undone' then raise exception 'Importação já desfeita'; end if;
  for v_item in select * from public.sales_import_items where batch_id=p_batch_id loop
    if v_item.movement_id is not null then perform public.reverse_movement(v_item.movement_id,'Desfazimento da importação de vendas'); end if;
  end loop;
  update public.sales_import_batches set status='undone',undone_at=timezone('utc',now()),undone_by=auth.uid() where id=p_batch_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_batch.company_id,'sales_import_undone',jsonb_build_object('batch_id',p_batch_id));
end;
$$;

create or replace function public.list_sales_imports(p_company_id uuid)
returns table(batch_id uuid,label text,status text,total_items integer,total_quantity numeric,imported_at timestamptz,imported_by_name text)
language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
  if not (
    coalesce(public.is_admin(),false)
    or coalesce(public.is_manager_or_owner(p_company_id),false)
  ) then raise exception 'Somente gestores podem listar importações de vendas'; end if;
  return query
    select b.id,b.label,b.status,b.total_items,b.total_quantity,b.imported_at,
      coalesce(p.name,u.email,'Usuário sem nome')::text
    from public.sales_import_batches b
    left join public.profiles p on p.id=b.imported_by
    left join auth.users u on u.id=b.imported_by
    where b.company_id=p_company_id
    order by b.imported_at desc,b.id;
end;
$$;

create or replace function public.complete_pending_loss_reason(p_movement_id uuid,p_reason_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_pending public.loss_reason_pending%rowtype; v_movement public.stock_movements%rowtype;
begin
  select * into v_pending from public.loss_reason_pending where movement_id=p_movement_id;
  if v_pending.movement_id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if v_pending.reason_id is not null then raise exception 'Motivo da perda já informado'; end if;
  select * into v_movement from public.stock_movements where id=p_movement_id and type='perda';
  if v_movement.id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if coalesce(public.is_admin(),false) then raise exception 'Administrador não pode completar motivos de perda'; end if;
  if not exists(select 1 from public.loss_reasons r where r.id=p_reason_id and r.company_id=v_movement.company_id and r.active)
  then raise exception 'Motivo de perda inválido'; end if;
  if not coalesce(public.is_manager_or_owner(v_movement.company_id),false)
    and v_movement.created_by<>auth.uid()
  then raise exception 'Funcionário só pode informar motivo da própria perda'; end if;
  update public.loss_reason_pending
  set reason_id=p_reason_id,completed_at=timezone('utc',now()),completed_by=auth.uid()
  where movement_id=p_movement_id;
end;
$$;

revoke execute on function public.save_sales_product_map(uuid,text,uuid,uuid) from public,anon;
revoke execute on function public.remove_sales_product_map(uuid,uuid) from public,anon;
revoke execute on function public.import_sales_batch(uuid,uuid,text,jsonb) from public,anon;
revoke execute on function public.undo_sales_import(uuid) from public,anon;
revoke execute on function public.list_sales_imports(uuid) from public,anon;
revoke execute on function public.complete_pending_loss_reason(uuid,uuid) from public,anon;
drop function if exists public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid);
create or replace function public.register_movement_idempotent(
  p_company_id uuid,p_product_id uuid,p_environment_id uuid,p_type text,p_quantity numeric,
  p_note text default null,p_client_request_id uuid default null
) returns uuid language plpgsql volatile security definer set search_path=public,pg_temp
as $$
declare v_existing uuid; v_movement_id uuid;
begin
  if not coalesce(public.is_active_member(p_company_id),false) then raise exception 'Membro ativo necessário'; end if;
  if p_client_request_id is not null then
    select r.movement_id into v_existing from public.movement_client_requests r
    where r.company_id=p_company_id and r.user_id=auth.uid() and r.client_request_id=p_client_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;
  v_movement_id:=public.register_movement(p_company_id,p_product_id,p_environment_id,p_type,p_quantity,p_note);
  if p_client_request_id is not null then
    insert into public.movement_client_requests(company_id,user_id,client_request_id,movement_id,result)
    values(p_company_id,auth.uid(),p_client_request_id,v_movement_id,jsonb_build_object('movement_id',v_movement_id))
    on conflict do nothing;
  end if;
  return v_movement_id;
end;
$$;

drop function if exists public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid);
create or replace function public.register_transfer_idempotent(
  p_company_id uuid,p_product_id uuid,p_from_environment_id uuid,p_to_environment_id uuid,p_quantity numeric,
  p_note text default null,p_client_request_id uuid default null
) returns uuid language plpgsql volatile security definer set search_path=public,pg_temp
as $$
declare v_existing uuid; v_transfer_group_id uuid;
begin
  if not coalesce(public.is_active_member(p_company_id),false) then raise exception 'Membro ativo necessário'; end if;
  if p_client_request_id is not null then
    select nullif(r.result->>'transfer_group_id','')::uuid into v_existing
    from public.movement_client_requests r
    where r.company_id=p_company_id and r.user_id=auth.uid() and r.client_request_id=p_client_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;
  v_transfer_group_id:=public.register_transfer(p_company_id,p_product_id,p_from_environment_id,p_to_environment_id,p_quantity,p_note);
  if p_client_request_id is not null then
    insert into public.movement_client_requests(company_id,user_id,client_request_id,movement_id,result)
    values(p_company_id,auth.uid(),p_client_request_id,null,jsonb_build_object('transfer_group_id',v_transfer_group_id))
    on conflict do nothing;
  end if;
  return v_transfer_group_id;
end;
$$;

grant execute on function public.save_sales_product_map(uuid,text,uuid,uuid) to authenticated;
grant execute on function public.remove_sales_product_map(uuid,uuid) to authenticated;
grant execute on function public.import_sales_batch(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.undo_sales_import(uuid) to authenticated;
grant execute on function public.list_sales_imports(uuid) to authenticated;
grant execute on function public.complete_pending_loss_reason(uuid,uuid) to authenticated;
revoke execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) from public,anon;
revoke execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) to authenticated;
grant execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) to authenticated;

create or replace function public.reverse_movement(p_movement_id uuid,p_note text default null)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_target public.stock_movements%rowtype;
  v_role public.company_role;
  v_estorno_id uuid;
  v_leg public.stock_movements%rowtype;
begin
  select * into v_target from public.stock_movements where id=p_movement_id;
  if v_target.id is null then raise exception 'movement not found'; end if;
  if v_target.type='estorno' then raise exception 'cannot reverse an estorno'; end if;
  if exists(select 1 from public.stock_movements s where s.reverses_movement_id=v_target.id)
  then raise exception 'movement already reversed'; end if;
  if coalesce(public.is_admin(),false) then raise exception 'admin cannot reverse movements'; end if;
  if not coalesce(public.is_active_member(v_target.company_id),false) then
    raise exception 'active membership required';
  end if;
  v_role:=public.member_role(v_target.company_id);
  if v_role not in ('owner','manager') then
    if v_target.created_by<>auth.uid() then raise exception 'employee cannot reverse another users movement'; end if;
    if v_target.created_at<timezone('utc',now())-interval '15 minutes' then raise exception '15 minute correction window expired'; end if;
  end if;
  if v_target.transfer_group_id is not null and v_target.type in ('transferencia_saida','transferencia_entrada') then
    for v_leg in select * from public.stock_movements m where m.transfer_group_id=v_target.transfer_group_id loop
      if exists(select 1 from public.stock_movements s where s.reverses_movement_id=v_leg.id) then raise exception 'transfer already reversed'; end if;
      insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,reverses_movement_id,note,created_by)
      values(v_leg.company_id,v_leg.product_id,v_leg.environment_id,'estorno',v_leg.quantity,-v_leg.signed_quantity,v_leg.id,p_note,auth.uid())
      returning id into v_estorno_id;
    end loop;
  else
    insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,reverses_movement_id,note,created_by)
    values(v_target.company_id,v_target.product_id,v_target.environment_id,'estorno',v_target.quantity,-v_target.signed_quantity,v_target.id,p_note,auth.uid())
    returning id into v_estorno_id;
  end if;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_target.company_id,'movement_reversed',jsonb_build_object('movement_id',v_target.id,'estorno_id',v_estorno_id,'transfer_group_id',v_target.transfer_group_id));
  return v_estorno_id;
end;
$$;
revoke execute on function public.reverse_movement(uuid,text) from public,anon;
grant execute on function public.reverse_movement(uuid,text) to authenticated;
