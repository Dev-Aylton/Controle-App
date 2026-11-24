create or replace function public.get_audit_page(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_action text default null,
  p_user text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_rows jsonb;
  v_total integer;
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id))
  then raise exception 'not authorized to view audit'; end if;
  if p_from is null or p_to is null or p_to < p_from
  then raise exception 'invalid period'; end if;
  if p_limit < 1 or p_limit > 100
  then raise exception 'limit must be between 1 and 100'; end if;
  if p_offset < 0
  then raise exception 'invalid offset'; end if;

  with filtered as (
    select
      a.id,
      a.action,
      coalesce(pr.name, 'Usuário sem nome') as user_name,
      a.created_at,
      a.acted_as_support,
      case
        when a.action like 'products_%' then 'Produtos'
        when a.action like 'environments_%' then 'Ambientes'
        when a.action like 'product_categories_%' then 'Categorias'
        when a.action like 'movement_%' or a.action in ('transfer_registered','stock_zeroed') then 'Estoque'
        when a.action like 'inventory_%' then 'Inventário'
        when a.action like 'sales_%' then 'Vendas'
        when a.action in ('promote_to_manager','deactivate_member','reactivate_member','join_company_with_code') then 'Equipe'
        else 'Empresa'
      end as object_name,
      case
        when a.action = 'movement_registered' then
          'Movimentação: ' || coalesce(a.data->>'type','') || ' • quantidade ' || coalesce(a.data->>'quantity','')
        when a.action = 'movement_reversed' then 'Movimentação estornada'
        when a.action = 'transfer_registered' then 'Transferência entre ambientes registrada'
        when a.action = 'inventory_opened' then 'Contagem de inventário iniciada'
        when a.action = 'inventory_finished' then 'Inventário finalizado'
        when a.action = 'stock_zeroed' then 'Estoque zerado'
        when a.action = 'sales_import_applied' then 'Venda importada'
        when a.action = 'sales_import_undone' then 'Importação de vendas desfeita'
        when a.action = 'products_imported' then
          'Produtos importados • ' || coalesce(a.data->>'created','0') || ' criado(s), '
          || coalesce(a.data->>'updated','0') || ' atualizado(s)'
        when a.action = 'rotate_company_code' then 'Código da empresa alterado'
        when a.action = 'deactivate_member' then 'Membro desativado'
        when a.action = 'reactivate_member' then 'Membro reativado'
        else 'Operação registrada'
      end as summary
    from public.audit_log a
    left join public.profiles pr on pr.id=a.user_id
    where a.company_id=p_company_id
      and a.created_at between p_from and p_to
      and (nullif(btrim(coalesce(p_action,'')),'') is null or a.action ilike '%' || p_action || '%')
      and (nullif(btrim(coalesce(p_user,'')),'') is null or coalesce(pr.name,'Usuário sem nome') ilike '%' || p_user || '%')
  ), searched as (
    select *
    from filtered
    where nullif(btrim(coalesce(p_search,'')),'') is null
      or action ilike '%' || p_search || '%'
      or object_name ilike '%' || p_search || '%'
      or user_name ilike '%' || p_search || '%'
      or summary ilike '%' || p_search || '%'
  )
  select
    (select count(*)::integer from searched),
    (
      select coalesce(jsonb_agg(to_jsonb(page_rows) order by page_rows.created_at desc, page_rows.id desc),'[]'::jsonb)
      from (
        select *
        from searched
        order by created_at desc,id desc
        limit p_limit offset p_offset
      ) page_rows
    )
  into v_total,v_rows;

  return jsonb_build_object('rows',v_rows,'total',v_total);
end;
$$;

revoke all on function public.get_audit_page(uuid,timestamptz,timestamptz,text,text,text,integer,integer) from public, anon;
grant execute on function public.get_audit_page(uuid,timestamptz,timestamptz,text,text,text,integer,integer) to authenticated;
