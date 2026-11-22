alter table public.audit_log
  add column if not exists acted_as_support boolean not null default false;

create or replace function public.mark_audit_support()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  new.acted_as_support := coalesce(public.is_admin(), false);
  return new;
end;
$$;

drop trigger if exists audit_log_mark_support on public.audit_log;
create trigger audit_log_mark_support
before insert on public.audit_log
for each row execute function public.mark_audit_support();

create or replace function public.block_audit_changes()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'audit log is immutable';
end;
$$;

drop trigger if exists audit_log_block_update on public.audit_log;
create trigger audit_log_block_update
before update or delete on public.audit_log
for each statement execute function public.block_audit_changes();

revoke update, delete on public.audit_log from public, anon, authenticated, service_role;
revoke insert on public.audit_log from public, anon, authenticated;

create or replace function public.register_movement(
  p_company_id uuid,p_product_id uuid,p_environment_id uuid,p_type text,p_quantity numeric,p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_movement_id uuid; v_signed numeric(14,3); v_current numeric(14,3); v_kind public.stock_movement_type;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_active_member(p_company_id),false) then
    raise exception 'active membership required';
  end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'quantity must be positive'; end if;
  if p_type not in ('entrada','saida','perda') then raise exception 'invalid movement type'; end if;
  v_kind:=p_type::public.stock_movement_type;
  if v_kind='entrada' then v_signed:=p_quantity;
  else
    v_signed:=-p_quantity;
    v_current:=public.get_environment_balance(p_company_id,p_environment_id,p_product_id);
    if v_current+v_signed<0 then raise exception 'saldo insuficiente no ambiente'; end if;
  end if;
  insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,note,created_by)
  values(p_company_id,p_product_id,p_environment_id,v_kind,p_quantity,v_signed,p_note,auth.uid())
  returning id into v_movement_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'movement_registered',
    jsonb_build_object('movement_id',v_movement_id,'type',p_type,'quantity',p_quantity,'support',coalesce(public.is_admin(),false)));
  return v_movement_id;
end;
$$;

create or replace function public.register_transfer(
  p_company_id uuid,p_product_id uuid,p_from_environment_id uuid,p_to_environment_id uuid,p_quantity numeric,p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_group uuid:=gen_random_uuid(); v_source numeric(14,3); v_from uuid; v_to uuid;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_active_member(p_company_id),false) then
    raise exception 'active membership required';
  end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'quantity must be positive'; end if;
  if p_from_environment_id=p_to_environment_id then raise exception 'source and destination must differ'; end if;
  v_source:=public.get_environment_balance(p_company_id,p_from_environment_id,p_product_id);
  if v_source-p_quantity<0 then raise exception 'saldo insuficiente no ambiente'; end if;
  insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,transfer_group_id,note,created_by)
  values(p_company_id,p_product_id,p_from_environment_id,'transferencia_saida',p_quantity,-p_quantity,v_group,p_note,auth.uid()) returning id into v_from;
  insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,transfer_group_id,note,created_by)
  values(p_company_id,p_product_id,p_to_environment_id,'transferencia_entrada',p_quantity,p_quantity,v_group,p_note,auth.uid()) returning id into v_to;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'transfer_registered',
    jsonb_build_object('transfer_group_id',v_group,'from_movement_id',v_from,'to_movement_id',v_to,'support',coalesce(public.is_admin(),false)));
  return v_group;
end;
$$;

create or replace function public.reverse_movement(p_movement_id uuid,p_note text default null)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_target public.stock_movements%rowtype; v_role public.company_role; v_estorno uuid; v_leg public.stock_movements%rowtype;
begin
  select * into v_target from public.stock_movements where id=p_movement_id;
  if v_target.id is null then raise exception 'movement not found'; end if;
  if v_target.type='estorno' then raise exception 'cannot reverse an estorno'; end if;
  if exists(select 1 from public.stock_movements s where s.reverses_movement_id=v_target.id) then raise exception 'movement already reversed'; end if;
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_active_member(v_target.company_id),false) then
    raise exception 'active membership required';
  end if;
  v_role:=public.member_role(v_target.company_id);
  if not coalesce(public.is_admin(),false) and v_role not in ('owner','manager') then
    if v_target.created_by<>auth.uid() then raise exception 'employee cannot reverse another users movement'; end if;
    if v_target.created_at<timezone('utc',now())-interval '15 minutes' then raise exception '15 minute correction window expired'; end if;
  end if;
  if v_target.transfer_group_id is not null and v_target.type in ('transferencia_saida','transferencia_entrada') then
    for v_leg in select * from public.stock_movements m where m.transfer_group_id=v_target.transfer_group_id loop
      insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,reverses_movement_id,note,created_by)
      values(v_leg.company_id,v_leg.product_id,v_leg.environment_id,'estorno',v_leg.quantity,-v_leg.signed_quantity,v_leg.id,p_note,auth.uid())
      returning id into v_estorno;
    end loop;
  else
    insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,reverses_movement_id,note,created_by)
    values(v_target.company_id,v_target.product_id,v_target.environment_id,'estorno',v_target.quantity,-v_target.signed_quantity,v_target.id,p_note,auth.uid())
    returning id into v_estorno;
  end if;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_target.company_id,'movement_reversed',
    jsonb_build_object('movement_id',v_target.id,'estorno_id',v_estorno,'transfer_group_id',v_target.transfer_group_id,'support',coalesce(public.is_admin(),false)));
  return v_estorno;
end;
$$;

revoke execute on function public.register_movement(uuid,uuid,uuid,text,numeric,text) from public,anon;
revoke execute on function public.register_transfer(uuid,uuid,uuid,uuid,numeric,text) from public,anon;
revoke execute on function public.reverse_movement(uuid,text) from public,anon;
grant execute on function public.register_movement(uuid,uuid,uuid,text,numeric,text) to authenticated;
grant execute on function public.register_transfer(uuid,uuid,uuid,uuid,numeric,text) to authenticated;
grant execute on function public.reverse_movement(uuid,text) to authenticated;

create or replace function public.open_inventory_session(p_company_id uuid,p_environment_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_session uuid;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_active_member(p_company_id),false) then
    raise exception 'active membership required';
  end if;
  if not exists(select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id)
  then raise exception 'environment does not belong to company'; end if;
  insert into public.inventory_sessions(company_id,environment_id,status,opened_by)
  values(p_company_id,p_environment_id,'aberta',auth.uid()) returning id into v_session;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'inventory_opened',jsonb_build_object('session_id',v_session,'support',coalesce(public.is_admin(),false)));
  return v_session;
end;
$$;

create or replace function public.submit_inventory_count(p_session_id uuid,p_product_id uuid,p_counted_quantity numeric)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_session public.inventory_sessions%rowtype;
begin
  select * into v_session from public.inventory_sessions where id=p_session_id;
  if v_session.id is null then raise exception 'inventory session not found'; end if;
  if v_session.status<>'aberta' then raise exception 'inventory session is not open'; end if;
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_active_member(v_session.company_id),false)
  then raise exception 'active membership required'; end if;
  if not exists(select 1 from public.products p where p.id=p_product_id and p.company_id=v_session.company_id)
  then raise exception 'product does not belong to company'; end if;
  if p_counted_quantity<0 then raise exception 'counted quantity cannot be negative'; end if;
  insert into public.inventory_counts(session_id,product_id,counted_quantity,counted_by)
  values(p_session_id,p_product_id,p_counted_quantity,auth.uid())
  on conflict(session_id,product_id) do update
  set counted_quantity=excluded.counted_quantity,counted_by=auth.uid(),counted_at=timezone('utc',now());
end;
$$;

create or replace function public.finish_inventory_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_session public.inventory_sessions%rowtype; v_count public.inventory_counts%rowtype;
v_current numeric(14,3); v_difference numeric(14,3); v_counted integer:=0; v_differences jsonb:='[]'::jsonb;
begin
  select * into v_session from public.inventory_sessions where id=p_session_id;
  if v_session.id is null then raise exception 'inventory session not found'; end if;
  if v_session.status<>'aberta' then raise exception 'inventory session is not open'; end if;
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_manager_or_owner(v_session.company_id),false)
  then raise exception 'only owner or manager can finish inventory'; end if;
  for v_count in select * from public.inventory_counts where session_id=p_session_id loop
    v_current:=public.get_environment_balance(v_session.company_id,v_session.environment_id,v_count.product_id);
    v_difference:=v_count.counted_quantity-v_current;
    if v_difference<>0 then
      insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,inventory_session_id,note,created_by)
      values(v_session.company_id,v_count.product_id,v_session.environment_id,'ajuste_inventario',abs(v_difference),v_difference,p_session_id,'ajuste de inventário',auth.uid());
      v_counted:=v_counted+1;
      v_differences:=v_differences||jsonb_build_object('product_id',v_count.product_id,'difference',v_difference);
    end if;
  end loop;
  update public.inventory_sessions set status='finalizada',finished_at=timezone('utc',now()) where id=p_session_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_session.company_id,'inventory_finished',
    jsonb_build_object('session_id',p_session_id,'adjustments',v_counted,'differences',v_differences,'support',coalesce(public.is_admin(),false)));
  return jsonb_build_object('adjustments',v_counted,'differences',v_differences);
end;
$$;

revoke execute on function public.open_inventory_session(uuid,uuid) from public,anon;
revoke execute on function public.submit_inventory_count(uuid,uuid,numeric) from public,anon;
revoke execute on function public.finish_inventory_session(uuid) from public,anon;
grant execute on function public.open_inventory_session(uuid,uuid) to authenticated;
grant execute on function public.submit_inventory_count(uuid,uuid,numeric) to authenticated;
grant execute on function public.finish_inventory_session(uuid) to authenticated;

create or replace function public.register_dose_movement(p_company_id uuid,p_product_id uuid,p_environment_id uuid,p_kind text,p_doses numeric,p_note text default null)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_product public.products%rowtype; v_doses integer; v_quantity numeric(14,3);
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode lançar movimentação por dose';
  end if;
  if p_kind not in ('entrada','saida','perda') then raise exception 'Tipo de dose inválido'; end if;
  if p_doses is null or p_doses<=0 then raise exception 'Quantidade de doses deve ser positiva'; end if;
  select * into v_product from public.products where id=p_product_id and company_id=p_company_id and active;
  if v_product.id is null then raise exception 'Produto inválido'; end if;
  if not exists(select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id and e.active)
  then raise exception 'Ambiente inválido'; end if;
  if v_product.volume_ml is null or v_product.dose_ml is null or v_product.volume_ml<=0 or v_product.dose_ml<=0
  then raise exception 'Produto sem volume ou dose cadastrados'; end if;
  v_doses:=floor(v_product.volume_ml/v_product.dose_ml)::integer;
  if v_doses<1 then raise exception 'Produto não possui dose válida'; end if;
  v_quantity:=(p_doses/v_doses)::numeric(14,3);
  return public.register_movement(p_company_id,p_product_id,p_environment_id,p_kind,v_quantity,p_note);
end;
$$;

create or replace function public.zero_stock(p_company_id uuid,p_environment_id uuid,p_product_id uuid default null,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_product record; v_balance numeric(14,3); v_adjusted integer:=0; v_differences jsonb:='[]'::jsonb; v_movement uuid;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode zerar estoque';
  end if;
  if btrim(coalesce(p_reason,''))='' then raise exception 'Motivo da zeragem é obrigatório'; end if;
  if not exists(select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id and e.active)
  then raise exception 'Ambiente inválido'; end if;
  if p_product_id is not null and not exists(select 1 from public.products p where p.id=p_product_id and p.company_id=p_company_id)
  then raise exception 'Produto inválido'; end if;
  for v_product in select p.id,p.name from public.products p where p.company_id=p_company_id and p.active and (p_product_id is null or p.id=p_product_id) loop
    select coalesce(sum(m.signed_quantity),0)::numeric(14,3) into v_balance
    from public.stock_movements m
    where m.company_id=p_company_id and m.environment_id=p_environment_id and m.product_id=v_product.id;
    if v_balance<>0 then
      insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,note,created_by)
      values(p_company_id,v_product.id,p_environment_id,'zeragem',abs(v_balance),-v_balance,p_reason,auth.uid())
      returning id into v_movement;
      v_adjusted:=v_adjusted+1;
      v_differences:=v_differences||jsonb_build_object('product_id',v_product.id,'previous_balance',v_balance,'movement_id',v_movement);
    end if;
  end loop;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'stock_zeroed',
    jsonb_build_object('environment_id',p_environment_id,'reason',p_reason,'product_id',p_product_id,'adjusted',v_adjusted,'differences',v_differences,'support',coalesce(public.is_admin(),false)));
  return jsonb_build_object('adjusted',v_adjusted,'differences',v_differences);
end;
$$;

revoke execute on function public.register_dose_movement(uuid,uuid,uuid,text,numeric,text) from public,anon;
revoke execute on function public.zero_stock(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.register_dose_movement(uuid,uuid,uuid,text,numeric,text) to authenticated;
grant execute on function public.zero_stock(uuid,uuid,uuid,text) to authenticated;

create or replace function public.save_sales_product_map(p_company_id uuid,p_external_name text,p_product_id uuid,p_environment_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_id uuid; v_name text;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode alterar o mapa';
  end if;
  v_name:=public.normalize_external_name(p_external_name);
  if v_name='' then raise exception 'Nome externo inválido'; end if;
  if not exists(select 1 from public.products p where p.id=p_product_id and p.company_id=p_company_id)
    or not exists(select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id)
  then raise exception 'Produto ou ambiente não pertence à empresa'; end if;
  insert into public.sales_product_map(company_id,external_name,external_name_normalized,product_id,environment_id,created_by)
  values(p_company_id,btrim(p_external_name),v_name,p_product_id,p_environment_id,auth.uid())
  on conflict(company_id,external_name_normalized,environment_id)
  do update set external_name=excluded.external_name,product_id=excluded.product_id,created_by=auth.uid()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_sales_product_map(p_company_id uuid,p_map_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode alterar o mapa';
  end if;
  delete from public.sales_product_map where id=p_map_id and company_id=p_company_id;
  if not found then raise exception 'Vínculo de vendas inválido para esta empresa'; end if;
end;
$$;

create or replace function public.import_sales_batch(p_company_id uuid,p_environment_id uuid,p_label text,p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_batch uuid; v_item jsonb; v_product uuid; v_quantity numeric; v_type text; v_deducted numeric(14,3);
v_movement uuid; v_total numeric(14,3):=0; v_items integer:=0; v_volume numeric; v_dose numeric; v_doses integer;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_manager_or_owner(p_company_id),false) then
    raise exception 'Somente proprietário ou gerente pode importar vendas';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Lista de vendas inválida'; end if;
  if not exists(select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id and e.active)
  then raise exception 'Ambiente inválido'; end if;
  insert into public.sales_import_batches(company_id,environment_id,label,imported_by,total_items,total_quantity)
  values(p_company_id,p_environment_id,btrim(p_label),auth.uid(),0,0) returning id into v_batch;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product:=nullif(v_item->>'product_id','')::uuid;
    v_quantity:=(v_item->>'quantity')::numeric;
    v_type:=lower(coalesce(v_item->>'sale_type','unidade'));
    if v_product is null or v_quantity<=0 or v_type not in ('unidade','dose') then raise exception 'Item de venda inválido'; end if;
    if not exists(select 1 from public.products p where p.id=v_product and p.company_id=p_company_id and p.active)
    then raise exception 'Produto não pertence à empresa'; end if;
    if v_type='dose' then
      select p.volume_ml,p.dose_ml into v_volume,v_dose from public.products p where p.id=v_product;
      if v_volume is null or v_dose is null or v_volume<=0 or v_dose<=0 then raise exception 'Produto sem volume ou dose cadastrados'; end if;
      v_doses:=floor(v_volume/v_dose)::integer;
      if v_doses<1 then raise exception 'Produto não possui dose válida'; end if;
      v_deducted:=(v_quantity/v_doses)::numeric(14,3);
    else v_deducted:=v_quantity; end if;
    insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,note,created_by)
    values(p_company_id,v_product,p_environment_id,'saida',v_deducted,-v_deducted,'Venda: '||btrim(p_label),auth.uid())
    returning id into v_movement;
    insert into public.sales_import_items(batch_id,product_id,quantity,sale_type,movement_id)
    values(v_batch,v_product,v_quantity,v_type,v_movement);
    v_total:=v_total+v_quantity; v_items:=v_items+1;
  end loop;
  update public.sales_import_batches set total_items=v_items,total_quantity=v_total where id=v_batch;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),p_company_id,'sales_import_applied',
    jsonb_build_object('batch_id',v_batch,'items',v_items,'quantity',v_total,'support',coalesce(public.is_admin(),false)));
  return v_batch;
end;
$$;

create or replace function public.undo_sales_import(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_batch public.sales_import_batches%rowtype; v_item public.sales_import_items%rowtype;
begin
  select * into v_batch from public.sales_import_batches where id=p_batch_id;
  if v_batch.id is null then raise exception 'Lote de vendas não encontrado'; end if;
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_manager_or_owner(v_batch.company_id),false)
  then raise exception 'Somente proprietário ou gerente pode desfazer importação'; end if;
  if v_batch.status='undone' then raise exception 'Importação já desfeita'; end if;
  for v_item in select * from public.sales_import_items where batch_id=p_batch_id loop
    if v_item.movement_id is not null then perform public.reverse_movement(v_item.movement_id,'Desfazimento da importação de vendas'); end if;
  end loop;
  update public.sales_import_batches set status='undone',undone_at=timezone('utc',now()),undone_by=auth.uid() where id=p_batch_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_batch.company_id,'sales_import_undone',
    jsonb_build_object('batch_id',p_batch_id,'support',coalesce(public.is_admin(),false)));
end;
$$;

revoke execute on function public.save_sales_product_map(uuid,text,uuid,uuid) from public,anon;
revoke execute on function public.remove_sales_product_map(uuid,uuid) from public,anon;
revoke execute on function public.import_sales_batch(uuid,uuid,text,jsonb) from public,anon;
revoke execute on function public.undo_sales_import(uuid) from public,anon;
grant execute on function public.save_sales_product_map(uuid,text,uuid,uuid) to authenticated;
grant execute on function public.remove_sales_product_map(uuid,uuid) to authenticated;
grant execute on function public.import_sales_batch(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.undo_sales_import(uuid) to authenticated;

create or replace function public.complete_pending_loss_reason(p_movement_id uuid,p_reason_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_pending public.loss_reason_pending%rowtype; v_movement public.stock_movements%rowtype;
begin
  select * into v_pending from public.loss_reason_pending where movement_id=p_movement_id;
  if v_pending.movement_id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if v_pending.reason_id is not null then raise exception 'Motivo da perda já informado'; end if;
  select * into v_movement from public.stock_movements where id=p_movement_id and type='perda';
  if v_movement.id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if not exists(select 1 from public.loss_reasons r where r.id=p_reason_id and r.company_id=v_movement.company_id and r.active)
  then raise exception 'Motivo de perda inválido'; end if;
  if not coalesce(public.is_admin(),false)
    and not coalesce(public.is_manager_or_owner(v_movement.company_id),false)
    and v_movement.created_by<>auth.uid()
  then raise exception 'Funcionário só pode informar motivo da própria perda'; end if;
  update public.loss_reason_pending
  set reason_id=p_reason_id,completed_at=timezone('utc',now()),completed_by=auth.uid()
  where movement_id=p_movement_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_movement.company_id,'loss_reason_completed',
    jsonb_build_object('movement_id',p_movement_id,'reason_id',p_reason_id,'support',coalesce(public.is_admin(),false)));
end;
$$;

drop function if exists public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid);
create or replace function public.register_movement_idempotent(
  p_company_id uuid,p_product_id uuid,p_environment_id uuid,p_type text,p_quantity numeric,
  p_note text default null,p_client_request_id uuid default null
) returns uuid language plpgsql volatile security definer set search_path=public,pg_temp
as $$
declare v_existing uuid; v_movement uuid;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_active_member(p_company_id),false)
  then raise exception 'active membership required'; end if;
  if p_client_request_id is not null then
    select r.movement_id into v_existing from public.movement_client_requests r
    where r.company_id=p_company_id and r.user_id=auth.uid() and r.client_request_id=p_client_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;
  v_movement:=public.register_movement(p_company_id,p_product_id,p_environment_id,p_type,p_quantity,p_note);
  if p_client_request_id is not null then
    insert into public.movement_client_requests(company_id,user_id,client_request_id,movement_id,result)
    values(p_company_id,auth.uid(),p_client_request_id,v_movement,jsonb_build_object('movement_id',v_movement,'support',coalesce(public.is_admin(),false)))
    on conflict do nothing;
  end if;
  return v_movement;
end;
$$;

drop function if exists public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid);
create or replace function public.register_transfer_idempotent(
  p_company_id uuid,p_product_id uuid,p_from_environment_id uuid,p_to_environment_id uuid,p_quantity numeric,
  p_note text default null,p_client_request_id uuid default null
) returns uuid language plpgsql volatile security definer set search_path=public,pg_temp
as $$
declare v_existing uuid; v_group uuid;
begin
  if not coalesce(public.is_admin(),false) and not coalesce(public.is_active_member(p_company_id),false)
  then raise exception 'active membership required'; end if;
  if p_client_request_id is not null then
    select nullif(r.result->>'transfer_group_id','')::uuid into v_existing
    from public.movement_client_requests r
    where r.company_id=p_company_id and r.user_id=auth.uid() and r.client_request_id=p_client_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;
  v_group:=public.register_transfer(p_company_id,p_product_id,p_from_environment_id,p_to_environment_id,p_quantity,p_note);
  if p_client_request_id is not null then
    insert into public.movement_client_requests(company_id,user_id,client_request_id,movement_id,result)
    values(p_company_id,auth.uid(),p_client_request_id,null,jsonb_build_object('transfer_group_id',v_group,'support',coalesce(public.is_admin(),false)))
    on conflict do nothing;
  end if;
  return v_group;
end;
$$;

revoke execute on function public.complete_pending_loss_reason(uuid,uuid) from public,anon;
revoke execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) from public,anon;
revoke execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.complete_pending_loss_reason(uuid,uuid) to authenticated;
grant execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) to authenticated;
grant execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) to authenticated;

drop function if exists public.get_audit_log(uuid,timestamptz,timestamptz,int);

create or replace function public.get_audit_log(
  p_company_id uuid,p_from timestamptz,p_to timestamptz,p_limit int default 200
)
returns table(action text,object_name text,user_name text,created_at timestamptz,summary text,acted_as_support boolean)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not (
    coalesce(public.is_admin(),false)
    or coalesce(public.is_manager_or_owner(p_company_id),false)
  ) then raise exception 'somente administrador, proprietário ou gerente pode consultar auditoria'; end if;
  if p_from is null or p_to is null or p_to<p_from then raise exception 'período inválido'; end if;
  if p_limit is null or p_limit<1 or p_limit>1000 then raise exception 'limite deve estar entre 1 e 1000'; end if;
  return query
    select a.action,
      case
        when a.action like 'products_%' then 'products'
        when a.action like 'environments_%' then 'environments'
        when a.action like 'movement_%' or a.action='transfer_registered' then 'stock_movements'
        when a.action like 'inventory_%' then 'inventory_sessions'
        when a.action='sales_import_applied' or a.action='sales_import_undone' then 'sales_import_batches'
        when a.action='stock_zeroed' then 'stock_movements'
        else 'company'
      end,
      coalesce(pr.name,'Usuário sem nome'),
      a.created_at,
      case a.action
        when 'movement_reversed' then 'Movimentação estornada'
        when 'movement_registered' then 'Movimentação registrada'
        when 'inventory_finished' then 'Inventário finalizado'
        when 'stock_zeroed' then 'Estoque zerado'
        when 'sales_import_applied' then 'Importação de vendas aplicada'
        when 'sales_import_undone' then 'Importação de vendas desfeita'
        else 'Operação registrada'
      end,
      a.acted_as_support
    from public.audit_log a
    left join public.profiles pr on pr.id=a.user_id
    where a.company_id=p_company_id and a.created_at>=p_from and a.created_at<=p_to
    order by a.created_at desc,a.id desc
    limit p_limit;
end;
$$;
revoke execute on function public.get_audit_log(uuid,timestamptz,timestamptz,int) from public,anon;
grant execute on function public.get_audit_log(uuid,timestamptz,timestamptz,int) to authenticated;
