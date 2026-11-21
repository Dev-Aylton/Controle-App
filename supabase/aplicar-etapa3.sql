-- Controle-App - Etapa 3
-- Gerado por npm run sql:unir. Não aplicar automaticamente.

-- ============================================================
-- Migration: 009_etapa3_movimentacoes.sql
-- ============================================================

do $$
begin
  create type public.stock_movement_type as enum (
    'entrada','saida','perda','ajuste_inventario','transferencia_saida','transferencia_entrada','estorno'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.inventory_status as enum ('aberta','finalizada','cancelada');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id),
  environment_id uuid not null references public.environments(id),
  type public.stock_movement_type not null,
  quantity numeric(14,3) not null,
  signed_quantity numeric(14,3) not null,
  note text,
  transfer_group_id uuid,
  reverses_movement_id uuid references public.stock_movements(id),
  inventory_session_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint stock_movements_quantity_positive check (quantity > 0),
  constraint stock_movements_reverses_no_self check (reverses_movement_id is null or reverses_movement_id <> id)
);

create unique index if not exists stock_movements_one_estorno
  on public.stock_movements(reverses_movement_id)
  where reverses_movement_id is not null;

create table if not exists public.inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  environment_id uuid not null references public.environments(id),
  status public.inventory_status not null default 'aberta',
  opened_by uuid references auth.users(id),
  opened_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  counted_quantity numeric(14,3) not null,
  counted_by uuid references auth.users(id),
  counted_at timestamptz not null default timezone('utc', now()),
  constraint inventory_counts_nonnegative check (counted_quantity >= 0),
  constraint inventory_counts_unique_product unique (session_id, product_id)
);

alter table public.stock_movements
  add constraint stock_movements_inventory_session_fk
  foreign key (inventory_session_id) references public.inventory_sessions(id);

create or replace function public.validate_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = new.product_id
      and p.company_id = new.company_id
  ) then
    raise exception 'product does not belong to company';
  end if;
  if not exists (
    select 1 from public.environments e
    where e.id = new.environment_id
      and e.company_id = new.company_id
  ) then
    raise exception 'environment does not belong to company';
  end if;
  if new.quantity <= 0 then raise exception 'quantity must be positive'; end if;
  return new;
end;
$$;

drop trigger if exists validate_stock_movement on public.stock_movements;
create trigger validate_stock_movement
before insert on public.stock_movements
for each row execute function public.validate_stock_movement();

create or replace function public.block_stock_movement_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'stock movements are immutable';
end;
$$;

drop trigger if exists block_stock_movement_update on public.stock_movements;
create trigger block_stock_movement_update
before update or delete on public.stock_movements
for each statement execute function public.block_stock_movement_changes();

create or replace function public.get_stock_balance(p_company_id uuid, p_environment_id uuid default null)
returns table(product_id uuid, environment_id uuid, balance numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() and not public.is_manager_or_owner(p_company_id) then
    raise exception 'only admin, owner or manager can read stock balances';
  end if;
  return query
    select m.product_id, m.environment_id, sum(m.signed_quantity)::numeric(14,3)
    from public.stock_movements m
    where m.company_id = p_company_id
      and (p_environment_id is null or m.environment_id = p_environment_id)
    group by m.product_id, m.environment_id;
end;
$$;

create or replace function public.get_environment_balance(p_company_id uuid, p_environment_id uuid, p_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(signed_quantity),0)::numeric(14,3)
  from public.stock_movements
  where company_id = p_company_id
    and environment_id = p_environment_id
    and product_id = p_product_id
$$;

create or replace function public.register_movement(p_company_id uuid, p_product_id uuid, p_environment_id uuid, p_type text, p_quantity numeric, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  movement_id uuid;
  signed numeric(14,3);
  current_balance numeric(14,3);
  movement_kind public.stock_movement_type;
begin
  if public.is_admin() then raise exception 'admin cannot register movements'; end if;
  if not public.is_active_member(p_company_id) then raise exception 'active membership required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if p_type not in ('entrada','saida','perda') then raise exception 'invalid movement type'; end if;
  movement_kind := p_type::public.stock_movement_type;
  if movement_kind = 'entrada' then signed := p_quantity;
  else
    signed := -p_quantity;
    current_balance := public.get_environment_balance(p_company_id,p_environment_id,p_product_id);
    if current_balance + signed < 0 then raise exception 'saldo insuficiente no ambiente'; end if;
  end if;
  insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,note,created_by)
  values (p_company_id,p_product_id,p_environment_id,movement_kind,p_quantity,signed,p_note,auth.uid())
  returning id into movement_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values (auth.uid(),p_company_id,'movement_registered',jsonb_build_object('movement_id',movement_id,'type',p_type,'quantity',p_quantity));
  return movement_id;
end;
$$;

create or replace function public.register_transfer(p_company_id uuid,p_product_id uuid,p_from_environment_id uuid,p_to_environment_id uuid,p_quantity numeric,p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  group_id uuid := gen_random_uuid();
  source_balance numeric(14,3);
  from_id uuid;
  to_id uuid;
begin
  if public.is_admin() then raise exception 'admin cannot register movements'; end if;
  if not public.is_active_member(p_company_id) then raise exception 'active membership required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if p_from_environment_id = p_to_environment_id then raise exception 'source and destination must differ'; end if;
  source_balance := public.get_environment_balance(p_company_id,p_from_environment_id,p_product_id);
  if source_balance - p_quantity < 0 then raise exception 'saldo insuficiente no ambiente'; end if;
  insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,transfer_group_id,note,created_by)
  values (p_company_id,p_product_id,p_from_environment_id,'transferencia_saida',p_quantity,-p_quantity,group_id,p_note,auth.uid()) returning id into from_id;
  insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,transfer_group_id,note,created_by)
  values (p_company_id,p_product_id,p_to_environment_id,'transferencia_entrada',p_quantity,p_quantity,group_id,p_note,auth.uid()) returning id into to_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values (auth.uid(),p_company_id,'transfer_registered',jsonb_build_object('transfer_group_id',group_id,'from_movement_id',from_id,'to_movement_id',to_id));
  return group_id;
end;
$$;

create or replace function public.reverse_movement(p_movement_id uuid,p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.stock_movements%rowtype;
  role_name public.company_role;
  estorno_id uuid;
  leg public.stock_movements%rowtype;
begin
  select * into target from public.stock_movements where id = p_movement_id;
  if target.id is null then raise exception 'movement not found'; end if;
  if target.type = 'estorno' then raise exception 'cannot reverse an estorno'; end if;
  if exists (select 1 from public.stock_movements s where s.reverses_movement_id = target.id) then raise exception 'movement already reversed'; end if;
  role_name := public.member_role(target.company_id);
  if public.is_admin() then raise exception 'admin cannot reverse movements'; end if;
  if role_name not in ('owner','manager') then
    if target.created_by <> auth.uid() then raise exception 'employee cannot reverse another users movement'; end if;
    if target.created_at < timezone('utc', now()) - interval '15 minutes' then raise exception '15 minute correction window expired'; end if;
  end if;
  if target.transfer_group_id is not null and target.type in ('transferencia_saida','transferencia_entrada') then
    for leg in select * from public.stock_movements m where m.transfer_group_id = target.transfer_group_id loop
      if exists (select 1 from public.stock_movements s where s.reverses_movement_id = leg.id) then raise exception 'transfer already reversed'; end if;
      insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,reverses_movement_id,note,created_by)
      values (leg.company_id,leg.product_id,leg.environment_id,'estorno',leg.quantity,-leg.signed_quantity,leg.id,p_note,auth.uid()) returning id into estorno_id;
    end loop;
  else
    insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,reverses_movement_id,note,created_by)
    values (target.company_id,target.product_id,target.environment_id,'estorno',target.quantity,-target.signed_quantity,target.id,p_note,auth.uid()) returning id into estorno_id;
  end if;
  insert into public.audit_log(user_id,company_id,action,data)
  values (auth.uid(),target.company_id,'movement_reversed',jsonb_build_object('movement_id',target.id,'estorno_id',estorno_id,'transfer_group_id',target.transfer_group_id));
  return estorno_id;
end;
$$;

create or replace function public.open_inventory_session(p_company_id uuid,p_environment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_id uuid;
begin
  if not public.is_active_member(p_company_id) then raise exception 'active membership required'; end if;
  if not exists (select 1 from public.environments e where e.id=p_environment_id and e.company_id=p_company_id) then raise exception 'environment does not belong to company'; end if;
  insert into public.inventory_sessions(company_id,environment_id,status,opened_by)
  values (p_company_id,p_environment_id,'aberta',auth.uid()) returning id into session_id;
  return session_id;
end;
$$;

create or replace function public.submit_inventory_count(p_session_id uuid,p_product_id uuid,p_counted_quantity numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session public.inventory_sessions%rowtype;
begin
  select * into session from public.inventory_sessions where id=p_session_id;
  if session.id is null then raise exception 'inventory session not found'; end if;
  if session.status <> 'aberta' then raise exception 'inventory session is not open'; end if;
  if not public.is_active_member(session.company_id) then raise exception 'active membership required'; end if;
  if not exists (select 1 from public.products p where p.id=p_product_id and p.company_id=session.company_id) then raise exception 'product does not belong to company'; end if;
  if p_counted_quantity < 0 then raise exception 'counted quantity cannot be negative'; end if;
  insert into public.inventory_counts(session_id,product_id,counted_quantity,counted_by)
  values (p_session_id,p_product_id,p_counted_quantity,auth.uid())
  on conflict (session_id,product_id) do update set counted_quantity=excluded.counted_quantity,counted_by=auth.uid(),counted_at=timezone('utc',now());
end;
$$;

create or replace function public.finish_inventory_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session public.inventory_sessions%rowtype;
  count_row public.inventory_counts%rowtype;
  current_balance numeric(14,3);
  difference numeric(14,3);
  created_count integer := 0;
  differences jsonb := '[]'::jsonb;
begin
  select * into session from public.inventory_sessions where id=p_session_id;
  if session.id is null then raise exception 'inventory session not found'; end if;
  if session.status <> 'aberta' then raise exception 'inventory session is not open'; end if;
  if public.is_admin() then raise exception 'admin cannot finish inventory'; end if;
  if public.member_role(session.company_id) not in ('owner','manager') then raise exception 'only owner or manager can finish inventory'; end if;
  for count_row in select * from public.inventory_counts where session_id=p_session_id loop
    current_balance := public.get_environment_balance(session.company_id,session.environment_id,count_row.product_id);
    difference := count_row.counted_quantity-current_balance;
    if difference <> 0 then
      insert into public.stock_movements(company_id,product_id,environment_id,type,quantity,signed_quantity,inventory_session_id,note,created_by)
      values (session.company_id,count_row.product_id,session.environment_id,'ajuste_inventario',abs(difference),difference,p_session_id,'ajuste de inventário',auth.uid());
      created_count := created_count+1;
      differences := differences || jsonb_build_object('product_id',count_row.product_id,'difference',difference);
    end if;
  end loop;
  update public.inventory_sessions set status='finalizada',finished_at=timezone('utc',now()) where id=p_session_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values (auth.uid(),session.company_id,'inventory_finished',jsonb_build_object('session_id',p_session_id,'adjustments',created_count,'differences',differences));
  return jsonb_build_object('adjustments',created_count,'differences',differences);
end;
$$;

alter table public.stock_movements enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_counts enable row level security;

revoke all on table public.stock_movements, public.inventory_sessions, public.inventory_counts from anon, authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.inventory_sessions to authenticated;
grant select on public.inventory_counts to authenticated;

revoke execute on function public.get_stock_balance(uuid, uuid) from public, anon;
grant execute on function public.get_stock_balance(uuid, uuid) to authenticated;
revoke execute on function public.register_movement(uuid, uuid, uuid, text, numeric, text) from public, anon;
grant execute on function public.register_movement(uuid, uuid, uuid, text, numeric, text) to authenticated;
revoke execute on function public.register_transfer(uuid, uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.register_transfer(uuid, uuid, uuid, uuid, numeric, text) to authenticated;
revoke execute on function public.reverse_movement(uuid, text) from public, anon;
grant execute on function public.reverse_movement(uuid, text) to authenticated;
revoke execute on function public.open_inventory_session(uuid, uuid) from public, anon;
grant execute on function public.open_inventory_session(uuid, uuid) to authenticated;
revoke execute on function public.submit_inventory_count(uuid, uuid, numeric) from public, anon;
grant execute on function public.submit_inventory_count(uuid, uuid, numeric) to authenticated;
revoke execute on function public.finish_inventory_session(uuid) from public, anon;
grant execute on function public.finish_inventory_session(uuid) to authenticated;

revoke execute on function public.get_environment_balance(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.validate_stock_movement() from public, anon, authenticated;
revoke execute on function public.block_stock_movement_changes() from public, anon, authenticated;

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
using (
  public.is_admin()
  or (public.is_manager_or_owner(company_id) and public.is_active_member(company_id))
  or (member_role(company_id) = 'employee' and created_by = auth.uid() and created_at >= timezone('utc', now()) - interval '15 minutes')
);

drop policy if exists inventory_sessions_select on public.inventory_sessions;
create policy inventory_sessions_select on public.inventory_sessions for select to authenticated
using (public.is_admin() or public.is_active_member(company_id));

drop policy if exists inventory_counts_select on public.inventory_counts;
create policy inventory_counts_select on public.inventory_counts for select to authenticated
using (
  exists (
    select 1 from public.inventory_sessions s
    where s.id = inventory_counts.session_id
      and (
        public.is_admin()
        or public.is_manager_or_owner(s.company_id)
        or (
          public.member_role(s.company_id) = 'employee'
          and s.status = 'aberta'
          and inventory_counts.counted_by = auth.uid()
        )
      )
  )
);
