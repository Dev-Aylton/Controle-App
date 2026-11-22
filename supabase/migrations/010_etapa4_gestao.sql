-- min_stock já existe desde a Etapa 2; o padrão zero é preservado.
alter table public.products alter column min_stock drop not null;
alter table public.products add column if not exists max_stock numeric(14,3);
alter table public.products
  add constraint products_max_stock_check check (max_stock >= 0),
  add constraint products_stock_range_check
    check (max_stock is null or min_stock is null or max_stock >= min_stock);

-- SELECT * passa a exigir colunas que não são públicas. Os gestores usam
-- get_product_stock_limits para obter os limites.
revoke select on public.products from public, anon, authenticated;
grant select (id, company_id, category_id, name, sku, unit, photo_path, active, created_at, created_by)
  on public.products to authenticated;

create or replace function public.get_product_stock_limits(p_company_id uuid)
returns table(product_id uuid, min_stock numeric, max_stock numeric)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'somente administrador, proprietário ou gerente pode consultar limites de estoque';
  end if;
  return query
    select p.id, p.min_stock, p.max_stock
    from public.products p where p.company_id = p_company_id;
end;
$$;

create or replace function public.get_low_stock_alerts(p_company_id uuid)
returns table(
  product_id uuid, product_name text, total_balance numeric, min_stock numeric,
  max_stock numeric, suggested_qty numeric, unit_cost numeric, estimated_cost numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'somente administrador, proprietário ou gerente pode consultar alertas de estoque';
  end if;
  return query
    with balances as (
      select m.product_id, sum(m.signed_quantity) as balance
      from public.stock_movements m
      where m.company_id = p_company_id group by m.product_id
    ), alerts as (
      select p.id, p.name, coalesce(b.balance, 0) as balance,
        p.min_stock as minimum, p.max_stock as maximum,
        greatest(0, coalesce(p.max_stock, 2 * p.min_stock) - coalesce(b.balance, 0)) as suggested,
        c.unit_cost as cost
      from public.products p
      left join balances b on b.product_id = p.id
      left join public.product_costs c on c.product_id = p.id and c.company_id = p_company_id
      where p.company_id = p_company_id and p.active and p.min_stock is not null
        and coalesce(b.balance, 0) < p.min_stock
    )
    select a.id, a.name, a.balance, a.minimum, a.maximum, a.suggested, a.cost,
      a.suggested * a.cost
    from alerts a
    order by a.balance / nullif(a.minimum, 0) asc nulls first, a.name, a.id;
end;
$$;

create or replace function public.get_negative_balances(p_company_id uuid)
returns table(product_id uuid, product_name text, environment_id uuid, environment_name text, balance numeric)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'somente administrador, proprietário ou gerente pode consultar saldos negativos';
  end if;
  return query
    select p.id, p.name, e.id, e.name, sum(m.signed_quantity)
    from public.stock_movements m
    join public.products p on p.id = m.product_id and p.company_id = m.company_id
    join public.environments e on e.id = m.environment_id and e.company_id = m.company_id
    where m.company_id = p_company_id
    group by p.id, p.name, e.id, e.name
    having sum(m.signed_quantity) < 0
    order by sum(m.signed_quantity), p.name, e.name;
end;
$$;

create or replace function public.get_environment_low_stock(p_company_id uuid)
returns table(
  product_id uuid, product_name text, environment_id uuid, environment_name text,
  balance numeric, total_balance numeric, min_stock numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'somente administrador, proprietário ou gerente pode consultar saldos por ambiente';
  end if;
  return query
    with balances as (
      select m.product_id, m.environment_id, sum(m.signed_quantity) as balance
      from public.stock_movements m where m.company_id = p_company_id
      group by m.product_id, m.environment_id
    )
    select p.id, p.name, e.id, e.name, coalesce(b.balance, 0),
      sum(coalesce(b.balance, 0)) over (partition by p.id), p.min_stock
    from public.products p
    join public.environments e on e.company_id = p.company_id
    left join balances b on b.product_id = p.id and b.environment_id = e.id
    where p.company_id = p_company_id
    order by p.name, e.name, p.id, e.id;
end;
$$;

create or replace function public.get_movement_report(
  p_company_id uuid, p_from timestamptz, p_to timestamptz, p_environment_id uuid default null
)
returns table(
  product_id uuid, product_name text, environment_id uuid, environment_name text,
  entradas numeric, saidas numeric, perdas numeric, transferencias_saida numeric,
  transferencias_entrada numeric, ajustes numeric, estornos numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'somente administrador, proprietário ou gerente pode consultar relatórios';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'período inválido';
  end if;
  if p_to - p_from > interval '366 days' then
    raise exception 'o período não pode ultrapassar 366 dias';
  end if;
  return query
    select p.id, p.name, e.id, e.name,
      coalesce(sum(m.quantity) filter (where m.type = 'entrada'), 0),
      coalesce(sum(m.quantity) filter (where m.type = 'saida'), 0),
      coalesce(sum(m.quantity) filter (where m.type = 'perda'), 0),
      coalesce(sum(m.quantity) filter (where m.type = 'transferencia_saida'), 0),
      coalesce(sum(m.quantity) filter (where m.type = 'transferencia_entrada'), 0),
      coalesce(sum(m.signed_quantity) filter (where m.type = 'ajuste_inventario'), 0),
      coalesce(sum(m.signed_quantity) filter (where m.type = 'estorno'), 0)
    from public.stock_movements m
    join public.products p on p.id = m.product_id and p.company_id = m.company_id
    join public.environments e on e.id = m.environment_id and e.company_id = m.company_id
    where m.company_id = p_company_id and m.created_at >= p_from and m.created_at <= p_to
      and (p_environment_id is null or m.environment_id = p_environment_id)
    group by p.id, p.name, e.id, e.name
    order by p.name, e.name, p.id, e.id;
end;
$$;

-- products_audit já captura os valores antigo e novo de min_stock e max_stock.
-- As ações de estorno, inventário, código e membros já são registradas pelas RPCs.
drop function if exists public.get_audit_log(uuid,timestamptz,timestamptz,int);

create or replace function public.get_audit_log(
  p_company_id uuid, p_from timestamptz, p_to timestamptz, p_limit int default 200
)
returns table(action text, object_name text, user_name text, created_at timestamptz, summary text, acted_as_support boolean)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'somente administrador, proprietário ou gerente pode consultar auditoria';
  end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'período inválido'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then raise exception 'limite deve estar entre 1 e 1000'; end if;
  return query
    select a.action,
      case
        when a.action like 'products_%' then 'products'
        when a.action like 'environments_%' then 'environments'
        when a.action like 'product_categories_%' then 'product_categories'
        when a.action like 'movement_%' or a.action = 'transfer_registered' then 'stock_movements'
        when a.action like 'inventory_%' then 'inventory_sessions'
        when a.action = 'rotate_company_code' then 'company_codes'
        when a.action in ('promote_to_manager', 'deactivate_member', 'join_company_with_code', 'claim_invite') then 'memberships'
        when a.action = 'create_invite' then 'company_invites'
        else 'company'
      end,
      coalesce(pr.name, 'Usuário sem nome'), a.created_at,
      case a.action
        when 'movement_reversed' then 'Movimentação estornada'
        when 'inventory_finished' then 'Inventário finalizado'
        when 'rotate_company_code' then 'Código da empresa alterado'
        when 'promote_to_manager' then 'Membro promovido a gerente'
        when 'deactivate_member' then 'Membro desativado'
        when 'products_updated' then 'Produto atualizado'
        when 'products_created' then 'Produto criado'
        else 'Operação registrada'
      end,
      a.acted_as_support
    from public.audit_log a
    left join public.profiles pr on pr.id = a.user_id
    where a.company_id = p_company_id and a.created_at >= p_from and a.created_at <= p_to
    order by a.created_at desc, a.id desc
    limit p_limit;
end;
$$;

create or replace function public.import_products(p_company_id uuid, p_rows jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  v_category_id uuid;
  v_product_id uuid;
  created_count integer := 0;
  updated_count integer := 0;
  ignored_count integer := 0;
  item_name text;
  item_sku text;
  item_unit text;
  item_min_stock numeric;
  item_max_stock numeric;
  existing_max_stock numeric;
  item_cost numeric;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'rows must be a JSON array'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'import limit is 1000 rows'; end if;
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'not authorized to import products';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then raise exception 'company not found'; end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    item_name := btrim(coalesce(item->>'name', ''));
    item_sku := nullif(btrim(coalesce(item->>'sku', '')), '');
    item_unit := lower(coalesce(item->>'unit', 'un'));
    begin
      item_min_stock := coalesce(nullif(item->>'min_stock', '')::numeric, 0);
      item_max_stock := nullif(item->>'max_stock', '')::numeric(14,3);
      item_cost := nullif(item->>'unit_cost', '')::numeric;
    exception when data_exception then
      ignored_count := ignored_count + 1;
      continue;
    end;
    select p.id, p.max_stock into v_product_id, existing_max_stock
    from public.products p
    where p.company_id = p_company_id
      and ((item_sku is not null and lower(p.sku) = lower(item_sku))
        or (item_sku is null and lower(p.name) = lower(item_name)))
    limit 1;
    if not (item ? 'max_stock') and v_product_id is not null then item_max_stock := existing_max_stock; end if;
    if item_name = '' or item_unit not in ('un','kg','g','l','ml','cx','pct')
      or item_min_stock < 0 or item_max_stock < 0
      or item_max_stock < item_min_stock or item_cost < 0 then
      ignored_count := ignored_count + 1;
      continue;
    end if;
    if nullif(btrim(coalesce(item->>'category', '')), '') is not null then
      select c.id into v_category_id from public.product_categories c
      where c.company_id = p_company_id and lower(c.name) = lower(btrim(item->>'category')) limit 1;
      if v_category_id is null then
        insert into public.product_categories(company_id, name, active, created_by)
        values (p_company_id, btrim(item->>'category'), true, auth.uid()) returning id into v_category_id;
      end if;
    else
      v_category_id := null;
    end if;
    if v_product_id is null then
      insert into public.products(company_id, category_id, name, sku, unit, min_stock, max_stock, active, created_by)
      values (p_company_id, v_category_id, item_name, item_sku, item_unit, item_min_stock, item_max_stock, true, auth.uid())
      returning id into v_product_id;
      created_count := created_count + 1;
    else
      update public.products p set category_id = v_category_id, name = item_name, sku = item_sku,
        unit = item_unit, min_stock = item_min_stock, max_stock = item_max_stock, active = true
      where p.id = v_product_id;
      updated_count := updated_count + 1;
    end if;
    if item_cost is not null then perform public.upsert_product_cost(v_product_id, item_cost); end if;
  end loop;
  insert into public.audit_log(user_id, company_id, action, data)
  values (auth.uid(), p_company_id, 'products_imported',
    jsonb_build_object('created', created_count, 'updated', updated_count, 'ignored', ignored_count));
  return jsonb_build_object('created', created_count, 'updated', updated_count, 'ignored', ignored_count);
end;
$$;

revoke execute on function public.get_product_stock_limits(uuid) from public, anon;
revoke execute on function public.get_low_stock_alerts(uuid) from public, anon;
revoke execute on function public.get_negative_balances(uuid) from public, anon;
revoke execute on function public.get_environment_low_stock(uuid) from public, anon;
revoke execute on function public.get_movement_report(uuid, timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function public.get_audit_log(uuid, timestamptz, timestamptz, int) from public, anon;
revoke execute on function public.import_products(uuid, jsonb) from public, anon;
grant execute on function public.get_product_stock_limits(uuid) to authenticated;
grant execute on function public.get_low_stock_alerts(uuid) to authenticated;
grant execute on function public.get_negative_balances(uuid) to authenticated;
grant execute on function public.get_environment_low_stock(uuid) to authenticated;
grant execute on function public.get_movement_report(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.get_audit_log(uuid, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.import_products(uuid, jsonb) to authenticated;
