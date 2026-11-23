alter table public.sales_import_batches
  add column if not exists source_hash text;

create unique index if not exists sales_import_batches_unique_source
  on public.sales_import_batches(company_id, environment_id, lower(source_hash))
  where source_hash is not null and status = 'applied';

create or replace function public.register_movement(
  p_company_id uuid,
  p_product_id uuid,
  p_environment_id uuid,
  p_type text,
  p_quantity numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_signed numeric(14,3);
  v_current numeric(14,3);
  v_kind public.stock_movement_type;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_active_member(p_company_id), false)
  then
    raise exception 'active membership required';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if p_type not in ('entrada','saida','perda') then raise exception 'invalid movement type'; end if;

  v_kind := p_type::public.stock_movement_type;
  if v_kind = 'entrada' then
    v_signed := p_quantity;
  else
    v_signed := -p_quantity;
    v_current := public.get_environment_balance(p_company_id, p_environment_id, p_product_id);
    if v_current + v_signed < 0 then raise exception 'saldo insuficiente no ambiente'; end if;
  end if;

  insert into public.stock_movements(
    company_id, product_id, environment_id, type,
    quantity, signed_quantity, note, created_by
  )
  values(
    p_company_id, p_product_id, p_environment_id, v_kind,
    p_quantity, v_signed, p_note, auth.uid()
  )
  returning id into v_movement_id;

  insert into public.audit_log(user_id, company_id, action, data)
  values(
    auth.uid(),
    p_company_id,
    'movement_registered',
    jsonb_build_object(
      'movement_id', v_movement_id,
      'product_id', p_product_id,
      'environment_id', p_environment_id,
      'type', p_type,
      'quantity', p_quantity,
      'support', coalesce(public.is_admin(), false)
    )
  );
  return v_movement_id;
end;
$$;

revoke execute on function public.register_movement(uuid,uuid,uuid,text,numeric,text) from public, anon;
grant execute on function public.register_movement(uuid,uuid,uuid,text,numeric,text) to authenticated;

drop function if exists public.import_sales_batch(uuid,uuid,text,jsonb);
create or replace function public.import_sales_batch(
  p_company_id uuid,
  p_environment_id uuid,
  p_label text,
  p_items jsonb,
  p_source_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric(14,3);
  v_sale_type text;
  v_deducted_quantity numeric(14,3);
  v_cost_quantity numeric;
  v_movement_id uuid;
  v_total_quantity numeric(14,3) := 0;
  v_total_items integer := 0;
  v_total_revenue numeric(14,2) := 0;
  v_total_cogs numeric(14,2) := 0;
  v_costs_complete boolean := true;
  v_volume_ml numeric;
  v_dose_ml numeric;
  v_doses_per_unit integer;
  v_unit_price numeric(12,2);
  v_dose_price numeric(12,2);
  v_sale_price numeric(12,2);
  v_unit_cost numeric(12,4);
  v_revenue numeric(14,2);
  v_cogs numeric(14,2);
  v_product_name text;
  v_current_balance numeric(14,3);
  v_requested numeric(14,3);
  v_demand jsonb;
  v_demand_product_id uuid;
  v_demand_quantity numeric(14,3);
  v_demand_type text;
  v_demand_volume numeric;
  v_demand_dose numeric;
  v_demand_doses integer;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then
    raise exception 'Somente proprietário ou gerente pode importar vendas';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
  then raise exception 'Lista de vendas inválida';
  end if;
  if not exists (
    select 1
    from public.environments e
    where e.id = p_environment_id and e.company_id = p_company_id and e.active
  ) then raise exception 'Ambiente inválido';
  end if;

  if nullif(btrim(coalesce(p_source_hash, '')), '') is not null then
    select b.id into v_batch_id
    from public.sales_import_batches b
    where b.company_id = p_company_id
      and b.environment_id = p_environment_id
      and b.source_hash = p_source_hash
      and b.status = 'applied'
    limit 1;
    if v_batch_id is not null then
      raise exception 'Esta planilha já foi aplicada a este ambiente';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_sale_type := lower(coalesce(v_item->>'sale_type','unidade'));
    if v_product_id is null or v_quantity <= 0 or v_sale_type not in ('unidade','dose')
    then raise exception 'Item de venda inválido';
    end if;

    select p.volume_ml, p.dose_ml, p.name::text,
      ep.unit_price, ep.dose_price, coalesce(ep.unit_cost, c.unit_cost)
    into v_volume_ml, v_dose_ml, v_product_name,
      v_unit_price, v_dose_price, v_unit_cost
    from public.products p
    left join public.product_environment_pricing ep
      on ep.product_id = p.id
      and ep.company_id = p_company_id
      and ep.environment_id = p_environment_id
    left join public.product_costs c
      on c.product_id = p.id and c.company_id = p_company_id
    where p.id = v_product_id and p.company_id = p_company_id and p.active;
    if not found then raise exception 'Produto não pertence à empresa ou está inativo';
    end if;

    v_sale_price := case when v_sale_type = 'dose' then v_dose_price else v_unit_price end;
    if v_sale_price is null
    then raise exception 'Preço de venda não cadastrado para o produto "%"', v_product_name;
    end if;

    if v_sale_type = 'dose' then
      if v_volume_ml is null or v_dose_ml is null or v_volume_ml <= 0 or v_dose_ml <= 0
      then raise exception 'Produto sem volume ou dose cadastrados';
      end if;
      v_doses_per_unit := floor(v_volume_ml / v_dose_ml)::integer;
      if v_doses_per_unit < 1 then raise exception 'Produto não possui dose válida'; end if;
      v_deducted_quantity := (v_quantity / v_doses_per_unit)::numeric(14,3);
    else
      v_deducted_quantity := v_quantity;
    end if;

    v_requested := 0;
    for v_demand in select * from jsonb_array_elements(p_items)
    loop
      v_demand_product_id := nullif(v_demand->>'product_id','')::uuid;
      v_demand_quantity := (v_demand->>'quantity')::numeric;
      v_demand_type := lower(coalesce(v_demand->>'sale_type','unidade'));
      if v_demand_product_id = v_product_id and v_demand_type = 'dose' then
        select p.volume_ml, p.dose_ml into v_demand_volume, v_demand_dose
        from public.products p where p.id = v_demand_product_id;
        v_demand_doses := floor(v_demand_volume / v_demand_dose)::integer;
        if v_demand_doses < 1
        then raise exception 'Produto não possui dose válida';
        end if;
        v_requested := v_requested + (v_demand_quantity / v_demand_doses)::numeric(14,3);
      elsif v_demand_product_id = v_product_id and v_demand_type = 'unidade' then
        v_requested := v_requested + v_demand_quantity;
      end if;
    end loop;

    v_current_balance := public.get_environment_balance(p_company_id,p_environment_id,v_product_id);
    if v_current_balance - v_requested < 0
    then raise exception 'Saldo insuficiente no ambiente para a importação da venda';
    end if;
  end loop;

  insert into public.sales_import_batches(
    company_id, environment_id, label, source_hash, imported_by,
    total_items, total_quantity
  )
  values(
    p_company_id, p_environment_id,
    coalesce(nullif(btrim(p_label), ''), 'Importação de vendas'),
    nullif(btrim(coalesce(p_source_hash, '')), ''),
    auth.uid(), 0, 0
  )
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_sale_type := lower(coalesce(v_item->>'sale_type','unidade'));
    select p.volume_ml, p.dose_ml,
      ep.unit_price, ep.dose_price, coalesce(ep.unit_cost, c.unit_cost)
    into v_volume_ml, v_dose_ml,
      v_unit_price, v_dose_price, v_unit_cost
    from public.products p
    left join public.product_environment_pricing ep
      on ep.product_id = p.id
      and ep.company_id = p_company_id
      and ep.environment_id = p_environment_id
    left join public.product_costs c
      on c.product_id = p.id and c.company_id = p_company_id
    where p.id = v_product_id;

    if v_sale_type = 'dose' then
      v_doses_per_unit := floor(v_volume_ml / v_dose_ml)::integer;
      v_deducted_quantity := (v_quantity / v_doses_per_unit)::numeric(14,3);
      v_cost_quantity := v_quantity / v_doses_per_unit;
      v_sale_price := v_dose_price;
    else
      v_deducted_quantity := v_quantity;
      v_cost_quantity := v_quantity;
      v_sale_price := v_unit_price;
    end if;

    v_revenue := round(v_quantity * v_sale_price, 2);
    v_cogs := case when v_unit_cost is null then null
      else round(v_cost_quantity * v_unit_cost, 2) end;

    insert into public.stock_movements(
      company_id, product_id, environment_id, type,
      quantity, signed_quantity, note, created_by
    )
    values(
      p_company_id, v_product_id, p_environment_id, 'saida',
      v_deducted_quantity, -v_deducted_quantity,
      'Venda: ' || coalesce(nullif(btrim(p_label), ''), 'Importação de vendas'),
      auth.uid()
    )
    returning id into v_movement_id;

    insert into public.sales_import_items(
      batch_id, product_id, quantity, sale_type, movement_id,
      sale_price_snapshot, unit_cost_snapshot, revenue, cost_of_goods_sold
    )
    values(
      v_batch_id, v_product_id, v_quantity, v_sale_type, v_movement_id,
      v_sale_price, v_unit_cost, v_revenue, v_cogs
    );

    v_total_quantity := v_total_quantity + v_quantity;
    v_total_revenue := v_total_revenue + v_revenue;
    if v_cogs is null then
      v_costs_complete := false;
    else
      v_total_cogs := v_total_cogs + v_cogs;
    end if;
    v_total_items := v_total_items + 1;
  end loop;

  update public.sales_import_batches
  set total_items = v_total_items,
      total_quantity = v_total_quantity,
      total_revenue = v_total_revenue,
      total_cogs = case when v_costs_complete then v_total_cogs else null end,
      total_gross_profit = case when v_costs_complete then v_total_revenue - v_total_cogs else null end
  where id = v_batch_id;

  insert into public.audit_log(user_id, company_id, action, data)
  values(
    auth.uid(), p_company_id, 'sales_import_applied',
    jsonb_build_object(
      'batch_id', v_batch_id,
      'items', v_total_items,
      'quantity', v_total_quantity,
      'source_hash', nullif(btrim(coalesce(p_source_hash, '')), '')
    )
  );
  return v_batch_id;
end;
$$;

revoke execute on function public.import_sales_batch(uuid,uuid,text,jsonb,text) from public, anon;
grant execute on function public.import_sales_batch(uuid,uuid,text,jsonb,text) to authenticated;
