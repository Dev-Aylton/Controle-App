create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  category text not null default 'outro'
    check (category in ('bebida','prato','porcao','outro')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  constraint sale_items_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists sale_items_unique_active_name
  on public.sale_items(company_id, lower(btrim(name)))
  where active;

create table if not exists public.sale_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null,
  unit text not null,
  constraint sale_item_ingredients_positive check (quantity > 0)
);

create table if not exists public.sale_item_environment_prices (
  sale_item_id uuid not null references public.sale_items(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  environment_id uuid not null references public.environments(id) on delete cascade,
  sale_price numeric(12,2) not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id),
  primary key (sale_item_id, environment_id),
  constraint sale_item_environment_prices_nonnegative check (sale_price >= 0)
);

alter table public.sale_items enable row level security;
alter table public.sale_item_ingredients enable row level security;
alter table public.sale_item_environment_prices enable row level security;

create or replace function public.upsert_sale_item(
  p_company_id uuid,
  p_sale_item_id uuid,
  p_name text,
  p_category text,
  p_ingredients jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item_id uuid;
  v_ingredient jsonb;
  v_product_id uuid;
  v_quantity numeric(14,3);
  v_unit text;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then
    raise exception 'Somente administrador, proprietário ou gerente pode cadastrar itens vendidos';
  end if;
  if btrim(coalesce(p_name,''))='' then raise exception 'Nome do item vendido não informado'; end if;
  if p_category not in ('bebida','prato','porcao','outro') then raise exception 'Categoria inválida'; end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' then raise exception 'Ingredientes inválidos'; end if;

  if p_sale_item_id is null then
    insert into public.sale_items(company_id,name,category,active,created_by)
    values(p_company_id,btrim(p_name),p_category,true,auth.uid())
    returning id into v_item_id;
  else
    select s.id into v_item_id
    from public.sale_items s
    where s.id=p_sale_item_id and s.company_id=p_company_id;
    if v_item_id is null then raise exception 'Item vendido não pertence à empresa'; end if;
    update public.sale_items
    set name=btrim(p_name),category=p_category
    where id=v_item_id;
    delete from public.sale_item_ingredients where sale_item_id=v_item_id;
  end if;

  for v_ingredient in select * from jsonb_array_elements(p_ingredients)
  loop
    v_product_id := nullif(v_ingredient->>'product_id','')::uuid;
    v_quantity := (v_ingredient->>'quantity')::numeric;
    v_unit := lower(coalesce(v_ingredient->>'unit','un'));
    if v_product_id is null or v_quantity<=0 then raise exception 'Ingrediente inválido'; end if;
    if not exists (
      select 1 from public.products p
      where p.id=v_product_id and p.company_id=p_company_id and p.active
    ) then raise exception 'Ingrediente não pertence à empresa';
    end if;
    insert into public.sale_item_ingredients(sale_item_id,product_id,quantity,unit)
    values(v_item_id,v_product_id,v_quantity,v_unit);
  end loop;
  return v_item_id;
end;
$$;

create or replace function public.upsert_sale_item_environment_price(
  p_company_id uuid,
  p_environment_id uuid,
  p_sale_item_id uuid,
  p_sale_price numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then
    raise exception 'Somente administrador, proprietário ou gerente pode alterar preços';
  end if;
  if p_sale_price is null or p_sale_price<0 then raise exception 'Preço inválido'; end if;
  if not exists (
    select 1
    from public.environments e
    where e.id=p_environment_id and e.company_id=p_company_id and e.active
  ) then raise exception 'Ambiente inválido'; end if;
  if not exists (
    select 1
    from public.sale_items s
    where s.id=p_sale_item_id and s.company_id=p_company_id and s.active
  ) then raise exception 'Item vendido inválido'; end if;

  insert into public.sale_item_environment_prices(
    sale_item_id,company_id,environment_id,sale_price,updated_by
  )
  values(p_sale_item_id,p_company_id,p_environment_id,p_sale_price,auth.uid())
  on conflict (sale_item_id,environment_id) do update
    set sale_price=excluded.sale_price,
        updated_at=timezone('utc',now()),
        updated_by=auth.uid();
end;
$$;

revoke all on table public.sale_items, public.sale_item_ingredients, public.sale_item_environment_prices
  from public, anon, authenticated;
grant select on table public.sale_items, public.sale_item_ingredients, public.sale_item_environment_prices
  to authenticated;
grant insert, update, delete on table public.sale_items, public.sale_item_ingredients, public.sale_item_environment_prices
  to service_role;

drop policy if exists sale_items_company_select on public.sale_items;
create policy sale_items_company_select
on public.sale_items for select to authenticated
using(public.is_admin() or public.is_active_member(company_id));

drop policy if exists sale_item_ingredients_company_select on public.sale_item_ingredients;
create policy sale_item_ingredients_company_select
on public.sale_item_ingredients for select to authenticated
using(
  exists(
    select 1
    from public.sale_items s
    where s.id=sale_item_ingredients.sale_item_id
      and (public.is_admin() or public.is_active_member(s.company_id))
  )
);

drop policy if exists sale_item_environment_prices_company_select on public.sale_item_environment_prices;
create policy sale_item_environment_prices_company_select
on public.sale_item_environment_prices for select to authenticated
using(public.is_admin() or public.is_active_member(company_id));

revoke execute on function public.upsert_sale_item(uuid,uuid,text,text,jsonb) from public, anon;
grant execute on function public.upsert_sale_item(uuid,uuid,text,text,jsonb) to authenticated;

revoke execute on function public.upsert_sale_item_environment_price(uuid,uuid,uuid,numeric) from public, anon;
grant execute on function public.upsert_sale_item_environment_price(uuid,uuid,uuid,numeric) to authenticated;
