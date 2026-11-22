create table if not exists public.product_environment_pricing (
  product_id uuid not null references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  environment_id uuid not null references public.environments(id) on delete cascade,
  unit_cost numeric(12,4),
  unit_price numeric(12,2),
  dose_price numeric(12,2),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id),
  primary key (product_id, environment_id),
  constraint product_environment_pricing_nonnegative check (
    (unit_cost is null or unit_cost >= 0)
    and (unit_price is null or unit_price >= 0)
    and (dose_price is null or dose_price >= 0)
  ),
  constraint product_environment_pricing_has_value check (
    unit_cost is not null or unit_price is not null or dose_price is not null
  )
);

alter table public.sales_import_batches
  add column if not exists total_revenue numeric(14,2),
  add column if not exists total_cogs numeric(14,2),
  add column if not exists total_gross_profit numeric(14,2);

alter table public.sales_import_items
  add column if not exists sale_price_snapshot numeric(12,2),
  add column if not exists unit_cost_snapshot numeric(12,4),
  add column if not exists revenue numeric(14,2),
  add column if not exists cost_of_goods_sold numeric(14,2);

alter table public.product_environment_pricing enable row level security;
revoke all on table public.product_environment_pricing from public, anon, authenticated;
grant select, insert, update, delete on table public.product_environment_pricing to service_role;

drop policy if exists product_environment_pricing_leaders on public.product_environment_pricing;
create policy product_environment_pricing_leaders on public.product_environment_pricing
for select to authenticated
using (public.is_admin() or public.is_manager_or_owner(company_id));

create or replace function public.record_product_environment_pricing_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_company uuid;
begin
  if tg_op = 'DELETE' then
    target_company := old.company_id;
    insert into public.audit_log(user_id, company_id, action, data)
    values(auth.uid(), target_company, 'product_environment_pricing_deleted',
      jsonb_build_object('old', to_jsonb(old)));
    return old;
  end if;

  target_company := new.company_id;
  insert into public.audit_log(user_id, company_id, action, data)
  values(
    auth.uid(),
    target_company,
    case when tg_op = 'INSERT' then 'product_environment_pricing_created' else 'product_environment_pricing_updated' end,
    jsonb_build_object('old', case when tg_op = 'INSERT' then null else to_jsonb(old) end, 'new', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists product_environment_pricing_audit on public.product_environment_pricing;
create trigger product_environment_pricing_audit
after insert or update or delete on public.product_environment_pricing
for each row execute function public.record_product_environment_pricing_audit();

create or replace function public.list_product_environment_pricing(
  p_company_id uuid,
  p_environment_id uuid
)
returns table(
  product_id uuid,
  product_name text,
  sku text,
  unit text,
  volume_ml numeric,
  dose_ml numeric,
  unit_cost numeric,
  base_unit_cost numeric,
  unit_price numeric,
  dose_price numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false) then
    raise exception 'Somente proprietário ou gerente pode consultar preços e custos por ambiente';
  end if;
  if not exists (
    select 1 from public.environments e
    where e.id = p_environment_id and e.company_id = p_company_id and e.active
  ) then
    raise exception 'Ambiente inválido';
  end if;

  return query
    select p.id, p.name::text, p.sku::text, p.unit::text, p.volume_ml, p.dose_ml,
      ep.unit_cost, c.unit_cost, ep.unit_price, ep.dose_price
    from public.products p
    left join public.product_costs c
      on c.product_id = p.id and c.company_id = p_company_id
    left join public.product_environment_pricing ep
      on ep.product_id = p.id
      and ep.company_id = p_company_id
      and ep.environment_id = p_environment_id
    where p.company_id = p_company_id and p.active
    order by p.name, p.id;
end;
$$;

create or replace function public.upsert_product_environment_pricing(
  p_company_id uuid,
  p_environment_id uuid,
  p_product_id uuid,
  p_unit_cost numeric,
  p_unit_price numeric,
  p_dose_price numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  product_row public.products%rowtype;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false) then
    raise exception 'Somente proprietário ou gerente pode alterar preços e custos por ambiente';
  end if;
  if not exists (
    select 1 from public.environments e
    where e.id = p_environment_id and e.company_id = p_company_id and e.active
  ) then
    raise exception 'Ambiente inválido';
  end if;

  select * into product_row
  from public.products p
  where p.id = p_product_id and p.company_id = p_company_id and p.active;
  if product_row.id is null then
    raise exception 'Produto inválido';
  end if;
  if (p_unit_cost is not null and p_unit_cost < 0)
    or (p_unit_price is not null and p_unit_price < 0)
    or (p_dose_price is not null and p_dose_price < 0) then
    raise exception 'Custos e preços não podem ser negativos';
  end if;
  if p_dose_price is not null and (
    product_row.volume_ml is null
    or product_row.dose_ml is null
    or product_row.volume_ml <= 0
    or product_row.dose_ml <= 0
    or floor(product_row.volume_ml / product_row.dose_ml) < 1
  ) then
    raise exception 'Cadastre volume e dose válidos no produto antes do preço por dose';
  end if;

  if p_unit_cost is null and p_unit_price is null and p_dose_price is null then
    delete from public.product_environment_pricing
    where product_id = p_product_id and company_id = p_company_id and environment_id = p_environment_id;
    return;
  end if;

  insert into public.product_environment_pricing(
    product_id, company_id, environment_id, unit_cost, unit_price, dose_price, updated_by
  )
  values(
    p_product_id, p_company_id, p_environment_id, p_unit_cost, p_unit_price, p_dose_price, auth.uid()
  )
  on conflict(product_id, environment_id) do update
  set company_id = excluded.company_id,
      unit_cost = excluded.unit_cost,
      unit_price = excluded.unit_price,
      dose_price = excluded.dose_price,
      updated_at = timezone('utc', now()),
      updated_by = auth.uid();
end;
$$;

create or replace function public.get_inventory_valuation(p_company_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false) then
    raise exception 'Somente gestores podem consultar o valor do estoque';
  end if;

  return (
    with balances as (
      select m.product_id, m.environment_id, sum(m.signed_quantity)::numeric as balance
      from public.stock_movements m
      where m.company_id = p_company_id
      group by m.product_id, m.environment_id
    )
    select case
      when coalesce(bool_or(greatest(b.balance, 0) > 0 and coalesce(ep.unit_cost, c.unit_cost) is null), false)
        then null
      else coalesce(sum(greatest(b.balance, 0) * coalesce(ep.unit_cost, c.unit_cost, 0)), 0)
    end
    from balances b
    join public.products p on p.id = b.product_id and p.company_id = p_company_id
    join public.environments e on e.id = b.environment_id and e.company_id = p_company_id
    left join public.product_environment_pricing ep
      on ep.product_id = p.id and ep.company_id = p_company_id and ep.environment_id = e.id
    left join public.product_costs c on c.product_id = p.id and c.company_id = p_company_id
  );
end;
$$;

create or replace function public.import_sales_batch(
  p_company_id uuid,
  p_environment_id uuid,
  p_label text,
  p_items jsonb
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
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false) then
    raise exception 'Somente proprietário ou gerente pode importar vendas';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Lista de vendas inválida';
  end if;
  if not exists (
    select 1 from public.environments e
    where e.id = p_environment_id and e.company_id = p_company_id and e.active
  ) then
    raise exception 'Ambiente inválido';
  end if;

  insert into public.sales_import_batches(
    company_id, environment_id, label, imported_by, total_items, total_quantity
  )
  values(p_company_id, p_environment_id, coalesce(nullif(btrim(p_label), ''), 'Importação de vendas'), auth.uid(), 0, 0)
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_sale_type := lower(coalesce(v_item->>'sale_type','unidade'));

    if v_product_id is null or v_quantity <= 0 or v_sale_type not in ('unidade','dose') then
      raise exception 'Item de venda inválido';
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

    if not found then
      raise exception 'Produto não pertence à empresa ou está inativo';
    end if;

    v_sale_price := case when v_sale_type = 'dose' then v_dose_price else v_unit_price end;
    if v_sale_price is null then
      raise exception 'Preço de venda por % não cadastrado para o produto "%"', v_sale_type, v_product_name;
    end if;

    if v_sale_type = 'dose' then
      if v_volume_ml is null or v_dose_ml is null or v_volume_ml <= 0 or v_dose_ml <= 0 then
        raise exception 'Produto sem volume ou dose cadastrados';
      end if;
      v_doses_per_unit := floor(v_volume_ml / v_dose_ml)::integer;
      if v_doses_per_unit < 1 then
        raise exception 'Produto não possui dose válida';
      end if;
      v_deducted_quantity := (v_quantity / v_doses_per_unit)::numeric(14,3);
      v_cost_quantity := v_quantity / v_doses_per_unit;
    else
      v_deducted_quantity := v_quantity;
      v_cost_quantity := v_quantity;
    end if;

    v_revenue := round(v_quantity * v_sale_price, 2);
    v_cogs := case when v_unit_cost is null then null else round(v_cost_quantity * v_unit_cost, 2) end;

    insert into public.stock_movements(
      company_id, product_id, environment_id, type,
      quantity, signed_quantity, note, created_by
    )
    values(
      p_company_id, v_product_id, p_environment_id, 'saida',
      v_deducted_quantity, -v_deducted_quantity,
      'Venda: ' || coalesce(nullif(btrim(p_label), ''), 'Importação de vendas'), auth.uid()
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
      'batch_id', v_batch_id, 'items', v_total_items, 'quantity', v_total_quantity,
      'revenue', v_total_revenue,
      'cogs', case when v_costs_complete then v_total_cogs else null end,
      'gross_profit', case when v_costs_complete then v_total_revenue - v_total_cogs else null end
    )
  );
  return v_batch_id;
end;
$$;

drop function if exists public.list_sales_imports(uuid);
create function public.list_sales_imports(p_company_id uuid)
returns table(
  batch_id uuid,
  label text,
  status text,
  total_items integer,
  total_quantity numeric,
  total_revenue numeric,
  total_cogs numeric,
  total_gross_profit numeric,
  imported_at timestamptz,
  imported_by_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    coalesce(public.is_admin(), false)
    or coalesce(public.is_manager_or_owner(p_company_id), false)
  ) then
    raise exception 'Somente gestores podem listar importações de vendas';
  end if;
  return query
    select b.id, b.label, b.status, b.total_items, b.total_quantity,
      b.total_revenue, b.total_cogs, b.total_gross_profit, b.imported_at,
      coalesce(p.name, u.email, 'Usuário sem nome')::text
    from public.sales_import_batches b
    left join public.profiles p on p.id = b.imported_by
    left join auth.users u on u.id = b.imported_by
    where b.company_id = p_company_id
    order by b.imported_at desc, b.id;
end;
$$;

revoke execute on function public.record_product_environment_pricing_audit() from public, anon, authenticated;
revoke execute on function public.list_product_environment_pricing(uuid, uuid) from public, anon;
revoke execute on function public.upsert_product_environment_pricing(uuid, uuid, uuid, numeric, numeric, numeric) from public, anon;
revoke execute on function public.get_inventory_valuation(uuid) from public, anon;
revoke execute on function public.import_sales_batch(uuid, uuid, text, jsonb) from public, anon;
revoke execute on function public.list_sales_imports(uuid) from public, anon;

grant execute on function public.list_product_environment_pricing(uuid, uuid) to authenticated;
grant execute on function public.upsert_product_environment_pricing(uuid, uuid, uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.get_inventory_valuation(uuid) to authenticated;
grant execute on function public.import_sales_batch(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.list_sales_imports(uuid) to authenticated;

create or replace function public.get_purchase_list(p_company_id uuid, p_environment_id uuid default null)
returns table(
  product_id uuid, product_name text, environment_id uuid, environment_name text,
  balance numeric, min_stock numeric, max_stock numeric, suggested_qty numeric,
  unit_cost numeric, estimated_cost numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false) then
    raise exception 'Somente administrador, proprietário ou gerente pode consultar a lista de compras';
  end if;
  if p_environment_id is not null and not exists (
    select 1 from public.environments e
    where e.id = p_environment_id and e.company_id = p_company_id and e.active
  ) then
    raise exception 'Ambiente inválido';
  end if;

  return query
    with envs as (
      select e.id, e.name
      from public.environments e
      where e.company_id = p_company_id and e.active
        and (p_environment_id is null or e.id = p_environment_id)
    ), balances as (
      select m.product_id, m.environment_id, sum(m.signed_quantity)::numeric(14,3) as balance
      from public.stock_movements m
      where m.company_id = p_company_id
      group by m.product_id, m.environment_id
    )
    select p.id, p.name::text, e.id, e.name::text,
      coalesce(b.balance, 0)::numeric(14,3),
      p.min_stock,
      p.max_stock,
      greatest(
        1,
        case
          when p.max_stock is not null then p.max_stock - coalesce(b.balance, 0)
          else p.min_stock - coalesce(b.balance, 0)
        end
      )::numeric(14,3),
      coalesce(ep.unit_cost, c.unit_cost),
      greatest(
        1,
        case
          when p.max_stock is not null then p.max_stock - coalesce(b.balance, 0)
          else p.min_stock - coalesce(b.balance, 0)
        end
      )::numeric(14,3) * coalesce(ep.unit_cost, c.unit_cost)
    from public.products p
    cross join envs e
    left join balances b on b.product_id = p.id and b.environment_id = e.id
    left join public.product_environment_pricing ep
      on ep.product_id = p.id and ep.company_id = p_company_id and ep.environment_id = e.id
    left join public.product_costs c on c.product_id = p.id and c.company_id = p_company_id
    where p.company_id = p_company_id
      and p.active
      and p.min_stock is not null
      and coalesce(b.balance, 0) <= p.min_stock
    order by coalesce(b.balance, 0) asc, p.name, e.name;
end;
$$;

revoke execute on function public.get_purchase_list(uuid, uuid) from public, anon;
grant execute on function public.get_purchase_list(uuid, uuid) to authenticated;
