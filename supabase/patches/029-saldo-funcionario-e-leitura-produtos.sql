-- Funcionários podem consultar o saldo consolidado da empresa.
create or replace function public.get_stock_balance(p_company_id uuid, p_environment_id uuid default null)
returns table(product_id uuid, environment_id uuid, balance numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_active_member(p_company_id), false)
  then
    raise exception 'active membership required';
  end if;
  return query
    select m.product_id, m.environment_id, sum(m.signed_quantity)::numeric(14,3)
    from public.stock_movements m
    where m.company_id = p_company_id
      and (p_environment_id is null or m.environment_id = p_environment_id)
    group by m.product_id, m.environment_id;
end;
$$;

revoke execute on function public.get_stock_balance(uuid,uuid) from public, anon;
grant execute on function public.get_stock_balance(uuid,uuid) to authenticated;

-- Inclui todas as colunas públicas do cadastro mestre que são usadas pela tela
-- de produtos. min_stock e max_stock continuam disponíveis apenas por RPC.
grant select (
  id,
  company_id,
  category_id,
  name,
  sku,
  unit,
  weight_g,
  volume_ml,
  dose_ml,
  photo_path,
  active,
  created_at,
  created_by
) on public.products to authenticated;
