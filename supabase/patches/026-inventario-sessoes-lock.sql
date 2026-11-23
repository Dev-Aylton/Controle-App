create unique index if not exists inventory_sessions_one_open_per_environment
  on public.inventory_sessions(company_id, environment_id)
  where status = 'aberta';

create or replace function public.open_inventory_session(p_company_id uuid, p_environment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_existing public.inventory_sessions%rowtype;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_active_member(p_company_id), false)
  then
    raise exception 'active membership required';
  end if;
  if not exists (
    select 1
    from public.environments e
    where e.id = p_environment_id
      and e.company_id = p_company_id
      and e.active
  ) then
    raise exception 'environment does not belong to company';
  end if;

  select *
  into v_existing
  from public.inventory_sessions s
  where s.company_id = p_company_id
    and s.environment_id = p_environment_id
    and s.status = 'aberta'
  for update;

  if v_existing.id is not null then
    return v_existing.id;
  end if;

  insert into public.inventory_sessions(company_id, environment_id, status, opened_by)
  values (p_company_id, p_environment_id, 'aberta', auth.uid())
  returning id into v_session_id;
  return v_session_id;
end;
$$;

revoke execute on function public.open_inventory_session(uuid,uuid) from public, anon;
grant execute on function public.open_inventory_session(uuid,uuid) to authenticated;

create or replace function public.finish_inventory_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.inventory_sessions%rowtype;
  v_count public.inventory_counts%rowtype;
  v_current numeric(14,3);
  v_difference numeric(14,3);
  v_created_count integer := 0;
  v_differences jsonb := '[]'::jsonb;
begin
  select *
  into v_session
  from public.inventory_sessions s
  where s.id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'inventory session not found';
  end if;
  if v_session.status = 'finalizada' then
    return jsonb_build_object('already_finalized', true, 'adjustments', 0, 'differences', '[]'::jsonb);
  end if;
  if v_session.status <> 'aberta' then
    raise exception 'inventory session is not open';
  end if;
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(v_session.company_id), false)
  then
    raise exception 'only owner or manager can finish inventory';
  end if;

  for v_count in
    select *
    from public.inventory_counts c
    where c.session_id = p_session_id
    for update
  loop
    v_current := public.get_environment_balance(v_session.company_id,v_session.environment_id,v_count.product_id);
    v_difference := v_count.counted_quantity-v_current;
    if v_difference <> 0 then
      insert into public.stock_movements(
        company_id,product_id,environment_id,type,
        quantity,signed_quantity,inventory_session_id,note,created_by
      )
      values(
        v_session.company_id,v_count.product_id,v_session.environment_id,
        'ajuste_inventario',abs(v_difference),v_difference,p_session_id,
        'ajuste de inventário',auth.uid()
      );
      v_created_count := v_created_count+1;
      v_differences := v_differences || jsonb_build_object(
        'product_id',v_count.product_id,
        'difference',v_difference
      );
    end if;
  end loop;

  update public.inventory_sessions
  set status='finalizada', finished_at=timezone('utc',now())
  where id=p_session_id;

  insert into public.audit_log(user_id,company_id,action,data)
  values(
    auth.uid(),v_session.company_id,'inventory_finished',
    jsonb_build_object(
      'session_id',p_session_id,
      'adjustments',v_created_count,
      'differences',v_differences
    )
  );
  return jsonb_build_object(
    'adjustments',v_created_count,
    'differences',v_differences
  );
end;
$$;

revoke execute on function public.finish_inventory_session(uuid) from public, anon;
grant execute on function public.finish_inventory_session(uuid) to authenticated;

create or replace function public.apply_inventory_count_batch(
  p_company_id uuid,
  p_environment_id uuid,
  p_counts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_row jsonb;
  v_product_id uuid;
  v_quantity numeric(14,3);
  v_current numeric(14,3);
  v_difference numeric(14,3);
  v_applied integer := 0;
  v_differences jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_counts) is distinct from 'array' or jsonb_array_length(p_counts) = 0
  then raise exception 'Nenhuma contagem válida foi enviada';
  end if;
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_manager_or_owner(p_company_id), false)
  then
    raise exception 'only owner or manager can apply inventory count';
  end if;

  select s.id
  into v_session_id
  from public.inventory_sessions s
  where s.company_id=p_company_id
    and s.environment_id=p_environment_id
    and s.status='aberta'
  for update;

  if v_session_id is null then
    insert into public.inventory_sessions(company_id,environment_id,status,opened_by)
    values(p_company_id,p_environment_id,'aberta',auth.uid())
    returning id into v_session_id;
  end if;

  for v_row in select * from jsonb_array_elements(p_counts)
  loop
    v_product_id := nullif(v_row->>'product_id','')::uuid;
    v_quantity := (v_row->>'counted_quantity')::numeric;
    if v_product_id is null or v_quantity is null or v_quantity<0
    then raise exception 'Linha de contagem inválida';
    end if;
    if not exists (
      select 1 from public.products p
      where p.id=v_product_id and p.company_id=p_company_id
    ) then raise exception 'Produto não pertence à empresa';
    end if;

    insert into public.inventory_counts(session_id,product_id,counted_quantity,counted_by)
    values(v_session_id,v_product_id,v_quantity,auth.uid())
    on conflict (session_id,product_id) do update
      set counted_quantity=excluded.counted_quantity,
          counted_by=auth.uid(),
          counted_at=timezone('utc',now());
    v_applied := v_applied+1;
  end loop;

  for v_row in select * from jsonb_array_elements(p_counts)
  loop
    v_product_id := nullif(v_row->>'product_id','')::uuid;
    v_quantity := (v_row->>'counted_quantity')::numeric;
    v_current := public.get_environment_balance(p_company_id,p_environment_id,v_product_id);
    v_difference := v_quantity-v_current;
    if v_difference<>0 then
      insert into public.stock_movements(
        company_id,product_id,environment_id,type,
        quantity,signed_quantity,inventory_session_id,note,created_by
      )
      values(
        p_company_id,v_product_id,p_environment_id,'ajuste_inventario',
        abs(v_difference),v_difference,v_session_id,'ajuste de contagem importada',auth.uid()
      );
      v_differences := v_differences || jsonb_build_object(
        'product_id',v_product_id,
        'difference',v_difference
      );
    end if;
  end loop;

  update public.inventory_sessions
  set status='finalizada',finished_at=timezone('utc',now())
  where id=v_session_id;

  insert into public.audit_log(user_id,company_id,action,data)
  values(
    auth.uid(),p_company_id,'inventory_imported',
    jsonb_build_object(
      'session_id',v_session_id,
      'applied',v_applied,
      'differences',v_differences
    )
  );
  return jsonb_build_object(
    'session_id',v_session_id,
    'applied',v_applied,
    'differences',v_differences
  );
end;
$$;

revoke execute on function public.apply_inventory_count_batch(uuid,uuid,jsonb) from public, anon;
grant execute on function public.apply_inventory_count_batch(uuid,uuid,jsonb) to authenticated;
