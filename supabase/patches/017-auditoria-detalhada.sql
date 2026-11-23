-- Torna o histórico operacional legível sem alterar a tabela de auditoria.

drop function if exists public.get_audit_log(uuid,timestamptz,timestamptz,int);

create or replace function public.get_audit_log(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 200
)
returns table(
  action text,
  object_name text,
  user_name text,
  created_at timestamptz,
  summary text,
  acted_as_support boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_manager_or_owner(p_company_id)) then
    raise exception 'Somente administrador, proprietário ou gerente pode consultar auditoria';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Período inválido';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Limite deve estar entre 1 e 1000';
  end if;

  return query
  select
    a.action,
    case
      when a.action like 'products_%' then 'Produtos'
      when a.action like 'environments_%' then 'Ambientes'
      when a.action like 'product_categories_%' then 'Categorias'
      when a.action like 'movement_%' or a.action = 'transfer_registered' or a.action = 'stock_zeroed' then 'Estoque'
      when a.action like 'inventory_%' then 'Inventário'
      when a.action = 'rotate_company_code' then 'Código da empresa'
      when a.action in ('promote_to_manager','deactivate_member','join_company_with_code','claim_invite') then 'Equipe'
      when a.action = 'create_invite' then 'Convites'
      when a.action like 'sales_%' then 'Vendas'
      else 'Empresa'
    end,
    coalesce(pr.name, 'Usuário sem nome'),
    a.created_at,
    case a.action
      when 'movement_registered' then
        'Movimentação: ' || coalesce(a.data->>'type','') || ' • '
        || coalesce((select p.name from public.products p where p.id = nullif(a.data->>'product_id','')::uuid),'Produto')
        || ' • quantidade '         || coalesce(a.data->>'quantity','')
      when 'movement_reversed' then 'Movimentação estornada'
      when 'transfer_registered' then 'Transferência entre ambientes registrada'
      when 'inventory_opened' then 'Contagem de inventário iniciada'
      when 'inventory_finished' then 'Inventário finalizado'
      when 'stock_zeroed' then 'Estoque zerado'
      when 'sales_import_applied' then
        'Venda importada • ' || coalesce(a.data->>'items','0') || ' item(ns) • '
        || coalesce(a.data->>'quantity','0') || ' unidade(s)'
      when 'sales_import_undone' then 'Importação de vendas desfeita'
      when 'products_imported' then
        'Produtos importados • ' || coalesce(a.data->>'created','0') || ' criado(s), '
        || coalesce(a.data->>'updated','0') || ' atualizado(s)'
      when 'products_created' then 'Produto cadastrado'
      when 'products_updated' then 'Produto atualizado'
      when 'products_deleted' then 'Produto desativado'
      when 'environments_created' then 'Ambiente criado'
      when 'environments_updated' then 'Ambiente atualizado'
      when 'product_categories_created' then 'Categoria criada'
      when 'product_categories_updated' then 'Categoria atualizada'
      when 'rotate_company_code' then 'Código da empresa alterado'
      when 'promote_to_manager' then 'Membro promovido a gerente'
      when 'deactivate_member' then 'Membro desativado'
      when 'join_company_with_code' then 'Pessoa entrou na empresa'
      when 'create_invite' then 'Convite enviado'
      else 'Operação registrada'
    end,
    a.acted_as_support
  from public.audit_log a
  left join public.profiles pr on pr.id = a.user_id
  where a.company_id = p_company_id
    and a.created_at >= p_from
    and a.created_at <= p_to
  order by a.created_at desc, a.id desc
  limit p_limit;
end;
$$;

revoke execute on function public.get_audit_log(uuid,timestamptz,timestamptz,int) from public, anon;
grant execute on function public.get_audit_log(uuid,timestamptz,timestamptz,int) to authenticated;
