alter table public.products
  add column if not exists volume_ml numeric(14,3),
  add column if not exists dose_ml numeric(14,3);

alter table public.products
  add constraint products_volume_ml_check
    check (volume_ml is null or volume_ml > 0),
  add constraint products_dose_ml_check
    check (dose_ml is null or dose_ml > 0);

create table if not exists public.sales_product_map (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  external_name text not null,
  external_name_normalized text not null,
  product_id uuid not null references public.products(id),
  environment_id uuid not null references public.environments(id),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  unique(company_id, external_name_normalized, environment_id)
);

create table if not exists public.sales_import_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  environment_id uuid not null references public.environments(id),
  label text not null,
  period_start timestamptz,
  period_end timestamptz,
  status text not null default 'applied',
  imported_by uuid references auth.users(id),
  imported_at timestamptz not null default timezone('utc', now()),
  undone_at timestamptz,
  undone_by uuid references auth.users(id),
  total_items integer not null default 0,
  total_quantity numeric(14,3) not null default 0,
  constraint sales_import_status_check check (status in ('applied','undone'))
);

create table if not exists public.sales_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.sales_import_batches(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null,
  sale_type text not null,
  movement_id uuid references public.stock_movements(id),
  constraint sales_import_quantity_positive check (quantity > 0),
  constraint sales_import_sale_type_check check (sale_type in ('unidade','dose'))
);

create table if not exists public.movement_client_requests (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  movement_id uuid references public.stock_movements(id),
  result jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key(company_id, user_id, client_request_id)
);

create or replace function public.normalize_external_name(p_name text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_name,'')),
      'áàãâäéèêëíìîïóòõôöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+',
    ' ',
    'g'
  ))
$$;

create or replace function public.get_stock_level_suggestions(
  p_company_id uuid,
  p_environment_id uuid default null,
  p_days integer default 90
)
returns table(
  product_id uuid,
  product_name text,
  environment_id uuid,
  environment_name text,
  current_min numeric,
  current_max numeric,
  suggested_min numeric,
  suggested_max numeric,
  data_days integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'Somente administrador, proprietário ou gerente pode consultar sugestões';
  end if;
  if p_days < 7 then raise exception 'Período mínimo de 7 dias'; end if;

  return query
    with consumption as (
      select
        m.product_id,
        m.environment_id,
        count(distinct m.created_at::date)::integer as v_data_days,
        sum(m.quantity) filter (where m.type in ('saida','perda'))::numeric
          / nullif(count(distinct m.created_at::date),0) as v_daily
      from public.stock_movements m
      where m.company_id = p_company_id
        and m.type in ('saida','perda')
        and m.created_at >= timezone('utc',now()) - (p_days::text || ' days')::interval
        and (p_environment_id is null or m.environment_id = p_environment_id)
        and not exists (
          select 1
          from public.stock_movements reversed
          where reversed.reverses_movement_id = m.id
        )
      group by m.product_id, m.environment_id
    )
    select
      p.id,
      p.name::text,
      e.id,
      e.name::text,
      p.min_stock,
      p.max_stock,
      ceiling(c.v_daily * 2)::numeric(14,3),
      ceiling(c.v_daily * 7)::numeric(14,3),
      c.v_data_days
    from consumption c
    join public.products p on p.id = c.product_id and p.company_id = p_company_id
    join public.environments e on e.id = c.environment_id and e.company_id = p_company_id
    where c.v_data_days >= 7
    order by c.v_daily desc, p.name, e.name;
end;
$$;

create or replace function public.list_sales_product_map(p_company_id uuid)
returns table(
  map_id uuid,
  external_name text,
  normalized_name text,
  product_id uuid,
  product_name text,
  environment_id uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'Somente gestores podem listar o mapa de vendas';
  end if;
  return query
    select m.id, m.external_name, m.external_name_normalized, m.product_id,
      p.name::text, m.environment_id
    from public.sales_product_map m
    join public.products p on p.id = m.product_id
    where m.company_id = p_company_id
    order by m.external_name_normalized;
end;
$$;

create or replace function public.save_sales_product_map(
  p_company_id uuid,
  p_external_name text,
  p_product_id uuid,
  p_environment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_map_id uuid;
  v_normalized text;
begin
  if not coalesce(public.is_admin(), false) and not coalesce(public.is_manager_or_owner(p_company_id), false) then
    raise exception 'Somente proprietário ou gerente pode alterar o mapa';
  end if;

  v_normalized := public.normalize_external_name(p_external_name);
  if v_normalized = '' then
    raise exception 'Nome externo inválido';
  end if;
  if not exists (
    select 1 from public.products p
    where p.id = p_product_id and p.company_id = p_company_id
  ) or not exists (
    select 1 from public.environments e
    where e.id = p_environment_id and e.company_id = p_company_id
  ) then
    raise exception 'Produto ou ambiente não pertence à empresa';
  end if;

  insert into public.sales_product_map(
    company_id, external_name, external_name_normalized,
    product_id, environment_id, created_by
  )
  values(
    p_company_id, btrim(p_external_name), v_normalized,
    p_product_id, p_environment_id, auth.uid()
  )
  on conflict(company_id, external_name_normalized, environment_id)
  do update set
    external_name = excluded.external_name,
    product_id = excluded.product_id,
    created_by = auth.uid()
  returning id into v_map_id;
  return v_map_id;
end;
$$;

create or replace function public.remove_sales_product_map(p_company_id uuid, p_map_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false) and not coalesce(public.is_manager_or_owner(p_company_id), false) then
    raise exception 'Somente proprietário ou gerente pode alterar o mapa';
  end if;
  delete from public.sales_product_map
  where id=p_map_id and company_id=p_company_id;
  if not found then raise exception 'Vínculo de vendas inválido para esta empresa'; end if;
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
  v_quantity numeric;
  v_sale_type text;
  v_deducted_quantity numeric(14,3);
  v_movement_id uuid;
  v_total_quantity numeric(14,3) := 0;
  v_total_items integer := 0;
  v_volume_ml numeric;
  v_dose_ml numeric;
  v_doses_per_unit integer;
begin
  if not coalesce(public.is_admin(), false) and not coalesce(public.is_manager_or_owner(p_company_id), false) then
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
  values(p_company_id, p_environment_id, btrim(p_label), auth.uid(), 0, 0)
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_sale_type := lower(coalesce(v_item->>'sale_type','unidade'));

    if v_product_id is null or v_quantity <= 0 or v_sale_type not in ('unidade','dose') then
      raise exception 'Item de venda inválido';
    end if;
    if not exists (
      select 1 from public.products p
      where p.id = v_product_id and p.company_id = p_company_id and p.active
    ) then
      raise exception 'Produto não pertence à empresa';
    end if;

    if v_sale_type = 'dose' then
      select p.volume_ml, p.dose_ml
      into v_volume_ml, v_dose_ml
      from public.products p
      where p.id = v_product_id;
      if v_volume_ml is null or v_dose_ml is null or v_volume_ml <= 0 or v_dose_ml <= 0 then
        raise exception 'Produto sem volume ou dose cadastrados';
      end if;
      v_doses_per_unit := floor(v_volume_ml / v_dose_ml)::integer;
      if v_doses_per_unit < 1 then
        raise exception 'Produto não possui dose válida';
      end if;
      v_deducted_quantity := (v_quantity / v_doses_per_unit)::numeric(14,3);
    else
      v_deducted_quantity := v_quantity;
    end if;

    insert into public.stock_movements(
      company_id, product_id, environment_id, type,
      quantity, signed_quantity, note, created_by
    )
    values(
      p_company_id, v_product_id, p_environment_id, 'saida',
      v_deducted_quantity, -v_deducted_quantity,
      'Venda: ' || btrim(p_label), auth.uid()
    )
    returning id into v_movement_id;

    insert into public.sales_import_items(batch_id, product_id, quantity, sale_type, movement_id)
    values(v_batch_id, v_product_id, v_quantity, v_sale_type, v_movement_id);
    v_total_quantity := v_total_quantity + v_quantity;
    v_total_items := v_total_items + 1;
  end loop;

  update public.sales_import_batches
  set total_items = v_total_items, total_quantity = v_total_quantity
  where id = v_batch_id;

  insert into public.audit_log(user_id, company_id, action, data)
  values(
    auth.uid(), p_company_id, 'sales_import_applied',
    jsonb_build_object('batch_id',v_batch_id,'items',v_total_items,'quantity',v_total_quantity)
  );
  return v_batch_id;
end;
$$;

create or replace function public.undo_sales_import(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.sales_import_batches%rowtype;
  v_item public.sales_import_items%rowtype;
begin
  select * into v_batch
  from public.sales_import_batches
  where id = p_batch_id;
  if v_batch.id is null then
    raise exception 'Lote de vendas não encontrado';
  end if;
  if not coalesce(public.is_admin(), false) and not coalesce(public.is_manager_or_owner(v_batch.company_id), false) then
    raise exception 'Somente proprietário ou gerente pode desfazer importação';
  end if;
  if v_batch.status = 'undone' then
    raise exception 'Importação já desfeita';
  end if;

  for v_item in
    select * from public.sales_import_items where batch_id = p_batch_id
  loop
    if v_item.movement_id is not null then
      perform public.reverse_movement(v_item.movement_id,'Desfazimento da importação de vendas');
    end if;
  end loop;

  update public.sales_import_batches
  set status='undone', undone_at=timezone('utc',now()), undone_by=auth.uid()
  where id=p_batch_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_batch.company_id,'sales_import_undone',jsonb_build_object('batch_id',p_batch_id));
end;
$$;

create or replace function public.list_sales_imports(p_company_id uuid)
returns table(
  batch_id uuid,
  label text,
  status text,
  total_items integer,
  total_quantity numeric,
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
    select b.id, b.label, b.status, b.total_items, b.total_quantity, b.imported_at,
      coalesce(p.name,u.email,'Usuário sem nome')::text
    from public.sales_import_batches b
    left join public.profiles p on p.id=b.imported_by
    left join auth.users u on u.id=b.imported_by
    where b.company_id=p_company_id
    order by b.imported_at desc,b.id;
end;
$$;

create or replace function public.register_movement_idempotent(
  p_company_id uuid,
  p_product_id uuid,
  p_environment_id uuid,
  p_type text,
  p_quantity numeric,
  p_note text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_movement_id uuid;
begin
  if not coalesce(public.is_admin(), false) and not coalesce(public.is_active_member(p_company_id), false) then
    raise exception 'Membro ativo necessário';
  end if;
  if p_client_request_id is not null then
    select r.movement_id into v_existing
    from public.movement_client_requests r
    where r.company_id=p_company_id
      and r.user_id=auth.uid()
      and r.client_request_id=p_client_request_id;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_movement_id := public.register_movement(
    p_company_id,p_product_id,p_environment_id,p_type,p_quantity,p_note
  );
  if p_client_request_id is not null then
    insert into public.movement_client_requests(
      company_id,user_id,client_request_id,movement_id,result
    )
    values(
      p_company_id,auth.uid(),p_client_request_id,v_movement_id,
      jsonb_build_object('movement_id',v_movement_id)
    )
    on conflict do nothing;
  end if;
  return v_movement_id;
end;
$$;

create or replace function public.register_transfer_idempotent(
  p_company_id uuid,
  p_product_id uuid,
  p_from_environment_id uuid,
  p_to_environment_id uuid,
  p_quantity numeric,
  p_note text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_transfer_group_id uuid;
begin
  if not coalesce(public.is_admin(), false) and not coalesce(public.is_active_member(p_company_id), false) then
    raise exception 'Membro ativo necessário';
  end if;
  if p_client_request_id is not null then
    select nullif(r.result->>'transfer_group_id','')::uuid into v_existing
    from public.movement_client_requests r
    where r.company_id=p_company_id
      and r.user_id=auth.uid()
      and r.client_request_id=p_client_request_id;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_transfer_group_id := public.register_transfer(
    p_company_id,p_product_id,p_from_environment_id,p_to_environment_id,p_quantity,p_note
  );
  if p_client_request_id is not null then
    insert into public.movement_client_requests(
      company_id,user_id,client_request_id,movement_id,result
    )
    values(
      p_company_id,auth.uid(),p_client_request_id,null,
      jsonb_build_object('transfer_group_id',v_transfer_group_id)
    )
    on conflict do nothing;
  end if;
  return v_transfer_group_id;
end;
$$;

alter table public.sales_product_map enable row level security;
alter table public.sales_import_batches enable row level security;
alter table public.sales_import_items enable row level security;
alter table public.movement_client_requests enable row level security;

revoke all on table
  public.sales_product_map,
  public.sales_import_batches,
  public.sales_import_items,
  public.movement_client_requests
from public, anon, authenticated;

grant select on public.sales_product_map to authenticated;
grant select on public.sales_import_batches to authenticated;
grant select on public.sales_import_items to authenticated;
grant select on public.movement_client_requests to authenticated;

grant select, insert, update, delete on public.sales_product_map to service_role;
grant select, insert, update on public.sales_import_batches to service_role;
grant select, insert, update on public.sales_import_items to service_role;
grant select, insert on public.movement_client_requests to service_role;

drop policy if exists sales_map_leader_select on public.sales_product_map;
create policy sales_map_leader_select on public.sales_product_map
for select to authenticated
using(public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists sales_batches_leader_select on public.sales_import_batches;
create policy sales_batches_leader_select on public.sales_import_batches
for select to authenticated
using(public.is_admin() or public.is_manager_or_owner(company_id));

drop policy if exists sales_items_leader_select on public.sales_import_items;
create policy sales_items_leader_select on public.sales_import_items
for select to authenticated
using(
  exists (
    select 1
    from public.sales_import_batches b
    where b.id=sales_import_items.batch_id
      and (public.is_admin() or public.is_manager_or_owner(b.company_id))
  )
);

drop policy if exists movement_requests_self on public.movement_client_requests;
create policy movement_requests_self on public.movement_client_requests
for select to authenticated
using(user_id=auth.uid());

revoke execute on function public.normalize_external_name(text) from public, anon, authenticated;
revoke execute on function public.get_stock_level_suggestions(uuid,uuid,integer) from public, anon;
revoke execute on function public.list_sales_product_map(uuid) from public, anon;
revoke execute on function public.save_sales_product_map(uuid,text,uuid,uuid) from public, anon;
revoke execute on function public.remove_sales_product_map(uuid,uuid) from public, anon;
revoke execute on function public.import_sales_batch(uuid,uuid,text,jsonb) from public, anon;
revoke execute on function public.undo_sales_import(uuid) from public, anon;
revoke execute on function public.list_sales_imports(uuid) from public, anon;
revoke execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) from public, anon;
revoke execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) from public, anon;

grant execute on function public.get_stock_level_suggestions(uuid,uuid,integer) to authenticated;
grant execute on function public.list_sales_product_map(uuid) to authenticated;
grant execute on function public.save_sales_product_map(uuid,text,uuid,uuid) to authenticated;
grant execute on function public.remove_sales_product_map(uuid,uuid) to authenticated;
grant execute on function public.import_sales_batch(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.undo_sales_import(uuid) to authenticated;
grant execute on function public.list_sales_imports(uuid) to authenticated;
grant execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) to authenticated;
grant execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) to authenticated;
