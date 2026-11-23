-- Controle-App - Etapa 2
-- Gerado por npm run sql:unir. Não aplicar automaticamente.

-- ============================================================
-- Migration: 007_etapa2_ambientes_produtos.sql
-- ============================================================

create table if not exists public.environments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id)
);

create unique index if not exists environments_unique_active_name
  on public.environments(company_id, lower(name))
  where active;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id)
);

create unique index if not exists product_categories_unique_active_name
  on public.product_categories(company_id, lower(name))
  where active;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.product_categories(id),
  name text not null,
  sku text,
  unit text not null default 'un',
  min_stock numeric not null default 0,
  photo_path text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  constraint products_unit_check check (unit in ('un','kg','g','l','ml','cx','pct','garrafa','lata','maço','porcao','duzia','bandeja','pacote','saco')),
  constraint products_min_stock_check check (min_stock >= 0)
);

create unique index if not exists products_unique_sku
  on public.products(company_id, lower(sku))
  where sku is not null;

create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_cost numeric(12,4) not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id),
  constraint product_costs_nonnegative check (unit_cost >= 0)
);

create table if not exists public.product_cost_history (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_cost numeric(12,4) not null,
  changed_at timestamptz not null default timezone('utc', now()),
  changed_by uuid references auth.users(id)
);

create or replace function public.record_product_cost_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.unit_cost is distinct from old.unit_cost then
    insert into public.product_cost_history(product_id, company_id, unit_cost, changed_by)
    values (new.product_id, new.company_id, new.unit_cost, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into public.product_cost_history(product_id, company_id, unit_cost, changed_by)
    values (new.product_id, new.company_id, new.unit_cost, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists product_cost_history_trigger on public.product_costs;
create trigger product_cost_history_trigger
after insert or update of unit_cost on public.product_costs
for each row execute function public.record_product_cost_history();

create or replace function public.record_etapa2_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_company uuid;
  action_name text;
begin
  target_company := coalesce(new.company_id, old.company_id);
  action_name := case
    when tg_op = 'INSERT' then tg_table_name || '_created'
    when tg_op = 'DELETE' then tg_table_name || '_deleted'
    else tg_table_name || '_updated'
  end;
  insert into public.audit_log(user_id, company_id, action, data)
  values (
    auth.uid(),
    target_company,
    action_name,
    jsonb_build_object('table', tg_table_name, 'old', to_jsonb(old), 'new', to_jsonb(new))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists environments_audit on public.environments;
create trigger environments_audit
after insert or update on public.environments
for each row execute function public.record_etapa2_audit();

drop trigger if exists product_categories_audit on public.product_categories;
create trigger product_categories_audit
after insert or update on public.product_categories
for each row execute function public.record_etapa2_audit();

drop trigger if exists products_audit on public.products;
create trigger products_audit
after insert or update on public.products
for each row execute function public.record_etapa2_audit();

create or replace function public.upsert_product_cost(p_product_id uuid, p_unit_cost numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.products%rowtype;
begin
  select * into target from public.products where id = p_product_id;
  if target.id is null then raise exception 'product not found'; end if;
  if p_unit_cost < 0 then raise exception 'unit cost cannot be negative'; end if;
  if not public.is_admin()
    and not public.is_manager_or_owner(target.company_id) then
    raise exception 'not authorized to change product cost';
  end if;
  insert into public.product_costs(product_id, company_id, unit_cost, updated_by)
  values (target.id, target.company_id, p_unit_cost, auth.uid())
  on conflict (product_id) do update
    set unit_cost = excluded.unit_cost,
        updated_at = timezone('utc', now()),
        updated_by = auth.uid();
end;
$$;

create or replace function public.import_products(p_company_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row jsonb;
  category_id uuid;
  product_id uuid;
  created_count integer := 0;
  updated_count integer := 0;
  ignored_count integer := 0;
  line_count integer := 0;
  item_name text;
  item_sku text;
  item_unit text;
  item_min_stock numeric;
  item_cost numeric;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'import limit is 1000 rows';
  end if;
  if not public.is_admin()
    and not public.is_manager_or_owner(p_company_id) then
    raise exception 'not authorized to import products';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'company not found';
  end if;

  for row in select value from jsonb_array_elements(p_rows)
  loop
    line_count := line_count + 1;
    item_name := btrim(coalesce(row->>'name', ''));
    item_sku := nullif(btrim(coalesce(row->>'sku', '')), '');
    item_unit := lower(coalesce(row->>'unit', 'un'));
    begin
      item_min_stock := coalesce(nullif(row->>'min_stock', '')::numeric, 0);
      item_cost := nullif(row->>'unit_cost', '')::numeric;
    exception when others then
      ignored_count := ignored_count + 1;
      continue;
    end;
    if item_name = '' or item_unit not in ('un','kg','g','l','ml','cx','pct')
      or item_min_stock < 0 or (item_cost is not null and item_cost < 0) then
      ignored_count := ignored_count + 1;
      continue;
    end if;

    if nullif(btrim(coalesce(row->>'category', '')), '') is not null then
      select id into category_id
      from public.product_categories
      where company_id = p_company_id
        and lower(name) = lower(btrim(row->>'category'))
      limit 1;
      if category_id is null then
        insert into public.product_categories(company_id, name, active, created_by)
        values (p_company_id, btrim(row->>'category'), true, auth.uid())
        returning id into category_id;
      end if;
    else
      category_id := null;
    end if;

    select id into product_id
    from public.products
    where company_id = p_company_id
      and ((item_sku is not null and lower(sku) = lower(item_sku))
        or (item_sku is null and lower(name) = lower(item_name)))
    limit 1;

    if product_id is null then
      insert into public.products(company_id, category_id, name, sku, unit, min_stock, active, created_by)
      values (p_company_id, category_id, item_name, item_sku, item_unit, item_min_stock, true, auth.uid())
      returning id into product_id;
      created_count := created_count + 1;
    else
      update public.products
      set category_id = category_id,
          name = item_name,
          sku = item_sku,
          unit = item_unit,
          min_stock = item_min_stock,
          active = true
      where id = product_id;
      updated_count := updated_count + 1;
    end if;

    if item_cost is not null then
      perform public.upsert_product_cost(product_id, item_cost);
    end if;
  end loop;

  insert into public.audit_log(user_id, company_id, action, data)
  values (auth.uid(), p_company_id, 'products_imported',
    jsonb_build_object('created', created_count, 'updated', updated_count, 'ignored', ignored_count));
  return jsonb_build_object('created', created_count, 'updated', updated_count, 'ignored', ignored_count);
end;
$$;

alter table public.environments enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.product_cost_history enable row level security;

revoke all on table
  public.environments,
  public.product_categories,
  public.products,
  public.product_costs,
  public.product_cost_history
from anon, authenticated;

grant select, insert, update on public.environments to authenticated;
grant select, insert, update on public.product_categories to authenticated;
grant select, insert, update on public.products to authenticated;
grant select on public.product_costs to authenticated;
grant select on public.product_cost_history to authenticated;

grant execute on function public.upsert_product_cost(uuid, numeric) to authenticated;
grant execute on function public.import_products(uuid, jsonb) to authenticated;

revoke execute on function public.record_product_cost_history() from public, anon, authenticated;
revoke execute on function public.record_etapa2_audit() from public, anon, authenticated;

drop policy if exists "environments_company_access" on public.environments;
create policy "environments_company_access"
on public.environments for select
to authenticated
using (public.is_admin() or public.is_active_member(company_id));

drop policy if exists "environments_manage" on public.environments;
create policy "environments_manage"
on public.environments for insert
to authenticated
with check (public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists "environments_update" on public.environments;
create policy "environments_update"
on public.environments for update
to authenticated
using (public.is_admin() or public.is_manager_or_owner(company_id))
with check (public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists "categories_company_access" on public.product_categories;
create policy "categories_company_access"
on public.product_categories for select
to authenticated
using (public.is_admin() or public.is_active_member(company_id));

drop policy if exists "categories_manage" on public.product_categories;
create policy "categories_manage"
on public.product_categories for insert
to authenticated
with check (public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists "categories_update" on public.product_categories;
create policy "categories_update"
on public.product_categories for update
to authenticated
using (public.is_admin() or public.is_manager_or_owner(company_id))
with check (public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists "products_company_access" on public.products;
create policy "products_company_access"
on public.products for select
to authenticated
using (public.is_admin() or public.is_active_member(company_id));

drop policy if exists "products_manage" on public.products;
create policy "products_manage"
on public.products for insert
to authenticated
with check (public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists "products_update" on public.products;
create policy "products_update"
on public.products for update
to authenticated
using (public.is_admin() or public.is_manager_or_owner(company_id))
with check (public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists "product_costs_leaders" on public.product_costs;
create policy "product_costs_leaders"
on public.product_costs for select
to authenticated
using (public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists "product_cost_history_leaders" on public.product_cost_history;
create policy "product_cost_history_leaders"
on public.product_cost_history for select
to authenticated
using (public.is_admin() or public.is_manager_or_owner(company_id));
