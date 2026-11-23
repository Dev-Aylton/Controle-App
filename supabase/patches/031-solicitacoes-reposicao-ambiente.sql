create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  destination_environment_id uuid not null references public.environments(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  status text not null default 'pendente'
    check (status in ('pendente','aprovada','rejeitada','atendida')),
  note text,
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null,
  approved_quantity numeric(14,3),
  constraint purchase_request_quantity_positive check (quantity > 0),
  constraint purchase_request_approved_quantity_positive check (approved_quantity is null or approved_quantity >= 0),
  unique(request_id, product_id)
);

alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
revoke all on public.purchase_requests, public.purchase_request_items from public, anon, authenticated;

create or replace function public.create_purchase_request(
  p_company_id uuid,
  p_destination_environment_id uuid,
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric(14,3);
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_active_member(p_company_id), false)
  then
    raise exception 'Membro ativo necessário';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0
  then
    raise exception 'Adicione ao menos um produto';
  end if;
  if not exists (
    select 1 from public.environments e
    where e.id=p_destination_environment_id
      and e.company_id=p_company_id
      and e.active
  ) then raise exception 'Ambiente de destino inválido'; end if;

  insert into public.purchase_requests(company_id,destination_environment_id,requested_by,note)
  values(p_company_id,p_destination_environment_id,auth.uid(),nullif(btrim(coalesce(p_note,'')),''))
  returning id into v_request_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_quantity := nullif(v_item->>'quantity','')::numeric;
    if v_product_id is null or v_quantity is null or v_quantity <= 0
    then raise exception 'Item de solicitação inválido'; end if;
    if not exists (
      select 1 from public.products p
      where p.id=v_product_id and p.company_id=p_company_id and p.active
    ) then raise exception 'Produto inválido'; end if;
    insert into public.purchase_request_items(request_id,product_id,quantity)
    values(v_request_id,v_product_id,v_quantity);
  end loop;
  return v_request_id;
end;
$$;

create or replace function public.list_purchase_requests(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_manage boolean;
begin
  v_manage := coalesce(public.is_admin(), false)
    or coalesce(public.is_manager_or_owner(p_company_id), false);
  if not v_manage and not coalesce(public.is_active_member(p_company_id), false)
  then raise exception 'Membro ativo necessário'; end if;

  return coalesce((
    select jsonb_agg(request_row order by request_row.created_at desc)
    from (
      select jsonb_build_object(
        'id', r.id,
        'destination_environment_id', r.destination_environment_id,
        'destination_environment_name', e.name,
        'status', r.status,
        'note', r.note,
        'review_note', r.review_note,
        'created_at', r.created_at,
        'reviewed_at', r.reviewed_at,
        'requested_by', r.requested_by,
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'product_id', i.product_id,
            'product_name', p.name,
            'sku', p.sku,
            'quantity', i.quantity,
            'approved_quantity', i.approved_quantity
          ) order by p.name), '[]'::jsonb)
          from public.purchase_request_items i
          join public.products p on p.id=i.product_id
          where i.request_id=r.id
        )
      ) as json,
      r.created_at
      from public.purchase_requests r
      join public.environments e on e.id=r.destination_environment_id
      where r.company_id=p_company_id
        and (v_manage or r.requested_by=auth.uid())
    ) request_row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.resolve_purchase_request(
  p_request_id uuid,
  p_action text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.purchase_requests%rowtype;
begin
  select * into v_request from public.purchase_requests where id=p_request_id;
  if v_request.id is null then raise exception 'Solicitação não encontrada'; end if;
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(v_request.company_id), false)
  then raise exception 'Somente gestor ou administrador pode revisar solicitação'; end if;
  if v_request.status<> 'pendente' then raise exception 'Solicitação já foi revisada'; end if;
  if p_action not in ('aprovar','rejeitar') then raise exception 'Ação inválida'; end if;

  update public.purchase_requests
  set status=case when p_action='aprovar' then 'aprovada' else 'rejeitada' end,
      review_note=nullif(btrim(coalesce(p_review_note,'')), ''),
      reviewed_by=auth.uid(),
      reviewed_at=timezone('utc',now())
  where id=p_request_id;
  if p_action='aprovar' then
    update public.purchase_request_items
    set approved_quantity=quantity
    where request_id=p_request_id;
  end if;
end;
$$;

create or replace function public.fulfill_purchase_request(
  p_request_id uuid,
  p_source_environment_id uuid,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.purchase_requests%rowtype;
  v_item record;
  v_transfer_group uuid;
begin
  select * into v_request from public.purchase_requests where id=p_request_id;
  if v_request.id is null then raise exception 'Solicitação não encontrada'; end if;
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(v_request.company_id), false)
  then raise exception 'Somente gestor ou administrador pode atender solicitação'; end if;
  if v_request.status<>'aprovada' then raise exception 'A solicitação precisa estar aprovada'; end if;
  if not exists (
    select 1 from public.environments e
    where e.id=p_source_environment_id
      and e.company_id=v_request.company_id
      and e.active
  ) then raise exception 'Ambiente de origem inválido'; end if;

  for v_item in
      select i.product_id,coalesce(i.approved_quantity,i.quantity) as quantity
      from public.purchase_request_items i
      where i.request_id=p_request_id
  loop
      if public.get_environment_balance(v_request.company_id,p_source_environment_id,v_item.product_id) < v_item.quantity
      then raise exception 'Saldo insuficiente no ambiente de origem'; end if;
  end loop;

  for v_item in
    select i.product_id,coalesce(i.approved_quantity,i.quantity) as quantity
    from public.purchase_request_items i
    where i.request_id=p_request_id
  loop
    v_transfer_group := public.register_transfer(
      v_request.company_id,v_item.product_id,p_source_environment_id,
      v_request.destination_environment_id,v_item.quantity,p_review_note
    );
  end loop;

  update public.purchase_requests
  set status='atendida',
      review_note=nullif(btrim(coalesce(p_review_note,'')), ''),
      reviewed_by=auth.uid(),
      reviewed_at=timezone('utc',now())
  where id=p_request_id;
  return v_request.id;
end;
$$;

revoke execute on function public.create_purchase_request(uuid,uuid,jsonb,text) from public, anon;
revoke execute on function public.list_purchase_requests(uuid) from public, anon;
revoke execute on function public.resolve_purchase_request(uuid,text,text) from public, anon;
revoke execute on function public.fulfill_purchase_request(uuid,uuid,text) from public, anon;
grant execute on function public.create_purchase_request(uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.list_purchase_requests(uuid) to authenticated;
grant execute on function public.resolve_purchase_request(uuid,text,text) to authenticated;
grant execute on function public.fulfill_purchase_request(uuid,uuid,text) to authenticated;
