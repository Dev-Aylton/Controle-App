create table if not exists public.loss_reasons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  constraint loss_reasons_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists loss_reasons_unique_active_name
  on public.loss_reasons(company_id, lower(name))
  where active;

create table if not exists public.loss_reason_pending (
  movement_id uuid primary key references public.stock_movements(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  reason_id uuid references public.loss_reasons(id),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  constraint loss_reason_pending_completed_consistency
    check ((reason_id is null and completed_at is null) or (reason_id is not null and completed_at is not null))
);

create or replace function public.record_pending_loss_reason()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.type = 'perda' then
    insert into public.loss_reason_pending(movement_id, company_id)
    values (new.id, new.company_id)
    on conflict (movement_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_movements_pending_loss_reason on public.stock_movements;
create trigger stock_movements_pending_loss_reason
after insert on public.stock_movements
for each row execute function public.record_pending_loss_reason();

create or replace function public.list_loss_reasons(p_company_id uuid)
returns table(reason_id uuid, name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_member(p_company_id) then
    raise exception 'Membro ativo necessário';
  end if;
  return query
    select r.id, r.name::text
    from public.loss_reasons r
    where r.company_id = p_company_id and r.active
    order by r.name;
end;
$$;

create or replace function public.get_pending_loss_reasons(p_company_id uuid)
returns table(
  movement_id uuid, product_id uuid, product_name text, environment_id uuid,
  environment_name text, quantity numeric, created_at timestamptz, created_by uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'Somente administrador, proprietário ou gerente pode listar motivos pendentes';
  end if;
  return query
    select m.id, m.product_id, p.name::text, m.environment_id, e.name::text,
      m.quantity, m.created_at, m.created_by
    from public.loss_reason_pending l
    join public.stock_movements m on m.id = l.movement_id
    join public.products p on p.id = m.product_id
    join public.environments e on e.id = m.environment_id
    where l.company_id = p_company_id and l.reason_id is null
    order by m.created_at desc, m.id;
end;
$$;

create or replace function public.complete_pending_loss_reason(p_movement_id uuid, p_reason_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pending public.loss_reason_pending%rowtype;
  movement public.stock_movements%rowtype;
begin
  select * into pending from public.loss_reason_pending where movement_id = p_movement_id;
  if pending.movement_id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if pending.reason_id is not null then raise exception 'Motivo da perda já informado'; end if;
  select * into movement from public.stock_movements where id = p_movement_id and type = 'perda';
  if movement.id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if not coalesce(public.is_active_member(movement.company_id), false)
    and not coalesce(public.is_admin(), false) then
    raise exception 'Membro ativo necessário';
  end if;
  if not exists (
    select 1 from public.loss_reasons r
    where r.id = p_reason_id and r.company_id = movement.company_id and r.active
  ) then raise exception 'Motivo de perda inválido'; end if;
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(movement.company_id), false) then
    if movement.created_by <> auth.uid() then
      raise exception 'Funcionário só pode informar motivo da própria perda';
    end if;
  end if;
  update public.loss_reason_pending
  set reason_id = p_reason_id, completed_at = timezone('utc', now()), completed_by = auth.uid()
  where movement_id = p_movement_id;
end;
$$;

create or replace function public.get_my_pending_loss_reasons(p_company_id uuid)
returns table(
  movement_id uuid, product_id uuid, product_name text, environment_id uuid,
  environment_name text, quantity numeric, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_member(p_company_id) then
    raise exception 'Membro ativo necessário';
  end if;
  return query
    select m.id, m.product_id, p.name::text, m.environment_id, e.name::text,
      m.quantity, m.created_at
    from public.loss_reason_pending l
    join public.stock_movements m on m.id = l.movement_id
    join public.products p on p.id = m.product_id
    join public.environments e on e.id = m.environment_id
    where l.company_id = p_company_id
      and l.reason_id is null
      and m.created_by = auth.uid()
    order by m.created_at desc, m.id;
end;
$$;

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
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'Somente administrador, proprietário ou gerente pode consultar a lista de compras';
  end if;
  if p_environment_id is not null and not exists (
    select 1 from public.environments e
    where e.id = p_environment_id and e.company_id = p_company_id and e.active
  ) then raise exception 'Ambiente inválido'; end if;
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
      c.unit_cost,
      greatest(
        1,
        case
          when p.max_stock is not null then p.max_stock - coalesce(b.balance, 0)
          else p.min_stock - coalesce(b.balance, 0)
        end
      )::numeric(14,3) * c.unit_cost
    from public.products p
    cross join envs e
    left join balances b on b.product_id = p.id and b.environment_id = e.id
    left join public.product_costs c on c.product_id = p.id and c.company_id = p_company_id
    where p.company_id = p_company_id
      and p.active
      and p.min_stock is not null
      and coalesce(b.balance, 0) <= p.min_stock
    order by coalesce(b.balance, 0) asc, p.name, e.name;
end;
$$;

alter table public.loss_reasons enable row level security;
alter table public.loss_reason_pending enable row level security;

revoke all on table public.loss_reasons, public.loss_reason_pending from public, anon, authenticated;
grant select on public.loss_reasons to authenticated;
grant select on public.loss_reason_pending to authenticated;
grant select, insert, update on public.loss_reasons to service_role;
grant select, insert, update on public.loss_reason_pending to service_role;

drop policy if exists loss_reasons_member_select on public.loss_reasons;
create policy loss_reasons_member_select on public.loss_reasons
for select to authenticated
using (public.is_active_member(company_id));

drop policy if exists loss_pending_own_or_leader_select on public.loss_reason_pending;
create policy loss_pending_own_or_leader_select on public.loss_reason_pending
for select to authenticated
using (
  public.is_admin()
  or public.is_manager_or_owner(company_id)
  or exists (
    select 1 from public.stock_movements m
    where m.id = loss_reason_pending.movement_id
      and m.created_by = auth.uid()
  )
);

revoke execute on function public.list_loss_reasons(uuid) from public, anon;
revoke execute on function public.get_pending_loss_reasons(uuid) from public, anon;
revoke execute on function public.complete_pending_loss_reason(uuid, uuid) from public, anon;
revoke execute on function public.get_my_pending_loss_reasons(uuid) from public, anon;
revoke execute on function public.get_purchase_list(uuid, uuid) from public, anon;
grant execute on function public.list_loss_reasons(uuid) to authenticated;
grant execute on function public.get_pending_loss_reasons(uuid) to authenticated;
grant execute on function public.complete_pending_loss_reason(uuid, uuid) to authenticated;
grant execute on function public.get_my_pending_loss_reasons(uuid) to authenticated;
grant execute on function public.get_purchase_list(uuid, uuid) to authenticated;

revoke execute on function public.record_pending_loss_reason() from public, anon, authenticated;
