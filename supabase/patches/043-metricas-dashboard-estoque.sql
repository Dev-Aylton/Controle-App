create or replace function public.get_dashboard_stock_metrics(p_company_id uuid)
returns table(
  products_without_movements integer,
  products_without_stock integer
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.is_admin()
    and not public.is_manager_or_owner(p_company_id)
  then
    raise exception 'not authorized to view dashboard metrics';
  end if;

  return query
  with product_balances as (
    select
      p.id as product_id,
      coalesce(sum(m.signed_quantity), 0) as total_balance,
      count(m.id) as movement_count
    from public.products p
    left join public.stock_movements m
      on m.company_id = p.company_id
      and m.product_id = p.id
    where p.company_id = p_company_id
      and p.active
    group by p.id
  )
  select
    count(*) filter (where movement_count = 0)::integer,
    count(*) filter (where total_balance = 0)::integer
  from product_balances;
end;
$$;

revoke all on function public.get_dashboard_stock_metrics(uuid) from public, anon;
grant execute on function public.get_dashboard_stock_metrics(uuid) to authenticated;
