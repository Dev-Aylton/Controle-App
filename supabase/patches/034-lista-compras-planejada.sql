create or replace function public.get_purchase_list(p_company_id uuid, p_environment_id uuid default null)
returns table(
  product_id uuid,
  product_name text,
  environment_id uuid,
  environment_name text,
  balance numeric,
  min_stock numeric,
  max_stock numeric,
  suggested_qty numeric,
  unit_cost numeric,
  estimated_cost numeric
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
    where e.id=p_environment_id and e.company_id=p_company_id and e.active
  ) then raise exception 'Ambiente inválido'; end if;

  return query
    with envs as (
      select e.id,e.name
      from public.environments e
      where e.company_id=p_company_id
        and e.active
        and (p_environment_id is null or e.id=p_environment_id)
    ),
    balances as (
      select m.product_id,m.environment_id,sum(m.signed_quantity)::numeric(14,3) as balance
      from public.stock_movements m
      where m.company_id=p_company_id
      group by m.product_id,m.environment_id
    )
    select
      p.id,
      p.name::text,
      e.id,
      e.name::text,
      coalesce(b.balance,0)::numeric(14,3),
      p.min_stock,
      p.max_stock,
      greatest(
        0,
        case
          when p.max_stock is not null then p.max_stock-coalesce(b.balance,0)
          when coalesce(b.balance,0)<coalesce(p.min_stock,0) then coalesce(p.min_stock,0)-coalesce(b.balance,0)
          else 0
        end
      )::numeric(14,3),
      c.unit_cost,
      greatest(
        0,
        case
          when p.max_stock is not null then p.max_stock-coalesce(b.balance,0)
          when coalesce(b.balance,0)<coalesce(p.min_stock,0) then coalesce(p.min_stock,0)-coalesce(b.balance,0)
          else 0
        end
      )::numeric(14,3) * c.unit_cost
    from public.products p
    cross join envs e
    left join balances b on b.product_id=p.id and b.environment_id=e.id
    left join public.product_costs c on c.product_id=p.id and c.company_id=p_company_id
    where p.company_id=p_company_id
      and p.active
      and p.min_stock is not null
    order by p.name,e.name;
end;
$$;

revoke execute on function public.get_purchase_list(uuid,uuid) from public, anon;
grant execute on function public.get_purchase_list(uuid,uuid) to authenticated;
