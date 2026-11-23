create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  constraint suppliers_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists suppliers_unique_name
  on public.suppliers(company_id, lower(btrim(name)))
  where active;

create table if not exists public.product_supplier_prices (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  unit_price numeric(12,4) not null,
  purchase_unit text not null default 'un',
  units_per_purchase numeric(14,3),
  valid_from timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  constraint supplier_price_nonnegative check (unit_price >= 0),
  constraint supplier_units_positive check (units_per_purchase is null or units_per_purchase > 0)
);

create index if not exists product_supplier_prices_lookup
  on public.product_supplier_prices(company_id,product_id,supplier_id,valid_from desc);

alter table public.suppliers enable row level security;
alter table public.product_supplier_prices enable row level security;
revoke all on public.suppliers, public.product_supplier_prices from public, anon, authenticated;
grant select on public.suppliers to authenticated;
grant select on public.product_supplier_prices to authenticated;

drop policy if exists suppliers_manage on public.suppliers;
create policy suppliers_manage
on public.suppliers for select to authenticated
using (public.is_admin() or public.is_active_member(company_id));

drop policy if exists supplier_prices_manage on public.product_supplier_prices;
create policy supplier_prices_manage
on public.product_supplier_prices for select to authenticated
using (
  public.is_admin()
  or public.is_manager_or_owner(company_id)
);

create or replace function public.save_supplier(
  p_company_id uuid,
  p_supplier_id uuid,
  p_name text,
  p_contact_name text default null,
  p_phone text default null,
  p_email text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then raise exception 'Somente gestor pode cadastrar fornecedor'; end if;
  if btrim(coalesce(p_name,''))='' then raise exception 'Nome do fornecedor obrigatório'; end if;
  if p_supplier_id is null then
    insert into public.suppliers(company_id,name,contact_name,phone,email,notes,created_by)
    values(p_company_id,btrim(p_name),nullif(btrim(coalesce(p_contact_name,'')),''),nullif(btrim(coalesce(p_phone,'')),''),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_notes,'')),''),auth.uid())
    returning id into v_id;
  else
    select s.id into v_id
    from public.suppliers s
    where s.id=p_supplier_id and s.company_id=p_company_id;
    if v_id is null then raise exception 'Fornecedor não pertence à empresa'; end if;
    update public.suppliers
    set name=btrim(p_name),
        contact_name=nullif(btrim(coalesce(p_contact_name,'')),''),
        phone=nullif(btrim(coalesce(p_phone,'')),''),
        email=nullif(btrim(coalesce(p_email,'')),''),
        notes=nullif(btrim(coalesce(p_notes,'')),'')
    where id=v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.save_product_supplier_price(
  p_company_id uuid,
  p_product_id uuid,
  p_supplier_id uuid,
  p_unit_price numeric,
  p_purchase_unit text default 'un',
  p_units_per_purchase numeric default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then raise exception 'Somente gestor pode registrar preço de fornecedor'; end if;
  if p_unit_price is null or p_unit_price < 0 then raise exception 'Preço inválido'; end if;
  if not exists (select 1 from public.suppliers s where s.id=p_supplier_id and s.company_id=p_company_id and s.active)
  then raise exception 'Fornecedor inválido'; end if;
  if not exists (select 1 from public.products p where p.id=p_product_id and p.company_id=p_company_id)
  then raise exception 'Produto inválido'; end if;
  insert into public.product_supplier_prices(
    company_id,product_id,supplier_id,unit_price,purchase_unit,units_per_purchase,created_by
  )
  values(
    p_company_id,p_product_id,p_supplier_id,p_unit_price,
    btrim(coalesce(p_purchase_unit,'un')),p_units_per_purchase,auth.uid()
  );
end;
$$;

revoke execute on function public.save_supplier(uuid,uuid,text,text,text,text,text) from public, anon;
revoke execute on function public.save_product_supplier_price(uuid,uuid,uuid,numeric,text,numeric) from public, anon;
grant execute on function public.save_supplier(uuid,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.save_product_supplier_price(uuid,uuid,uuid,numeric,text,numeric) to authenticated;
