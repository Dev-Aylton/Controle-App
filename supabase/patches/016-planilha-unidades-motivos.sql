-- Suporte às unidades da planilha PIPA e importação completa de produtos.

alter table public.products drop constraint if exists products_unit_check;
alter table public.products add constraint products_unit_check
  check (unit in ('un','kg','g','l','ml','cx','pct','garrafa','lata','maço','porcao','duzia','bandeja','pacote','saco'));

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
  item_volume_ml numeric;
  item_dose_ml numeric;
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
      item_volume_ml := nullif(item->>'volume_ml', '')::numeric(14,3);
      item_dose_ml := nullif(item->>'dose_ml', '')::numeric(14,3);
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
    if item_name = '' or item_unit not in ('un','kg','g','l','ml','cx','pct','garrafa','lata','maço','porcao','duzia','bandeja','pacote','saco')
      or item_min_stock < 0 or item_max_stock < 0
      or item_max_stock < item_min_stock or item_cost < 0
      or (item_volume_ml is not null and item_volume_ml <= 0)
      or (item_dose_ml is not null and item_dose_ml <= 0)
      or (item_volume_ml is not null and item_dose_ml is not null and item_dose_ml > item_volume_ml) then
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
      insert into public.products(company_id, category_id, name, sku, unit, min_stock, max_stock, volume_ml, dose_ml, active, created_by)
      values (p_company_id, v_category_id, item_name, item_sku, item_unit, item_min_stock, item_max_stock, item_volume_ml, item_dose_ml, true, auth.uid())
      returning id into v_product_id;
      created_count := created_count + 1;
    else
      update public.products p set category_id = v_category_id, name = item_name, sku = item_sku,
        unit = item_unit, min_stock = item_min_stock, max_stock = item_max_stock,
        volume_ml = item_volume_ml, dose_ml = item_dose_ml, active = true
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

revoke execute on function public.import_products(uuid, jsonb) from public, anon;
grant execute on function public.import_products(uuid, jsonb) to authenticated;

create or replace function public.seed_loss_reasons(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_count integer := 0;
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'Somente administrador, proprietário ou gerente pode cadastrar motivos';
  end if;
  foreach v_name in array array[
    'Quebra','Derramamento','Vencimento/Validade','Cortesia','Consumo interno',
    'Furto/Extravio','Erro de preparo','Devolução ao fornecedor','Outros'
  ] loop
    if not exists (
      select 1 from public.loss_reasons r
      where r.company_id = p_company_id and lower(r.name) = lower(v_name)
    ) then
      insert into public.loss_reasons(company_id, name, active, created_by)
      values (p_company_id, v_name, true, auth.uid());
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.seed_loss_reasons(uuid) from public, anon;
grant execute on function public.seed_loss_reasons(uuid) to authenticated;
