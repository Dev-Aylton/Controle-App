drop function if exists public.apply_movement_entry_batch(uuid,uuid,jsonb,uuid);

create or replace function public.apply_movement_entry_batch(
  p_company_id uuid,
  p_environment_id uuid,
  p_entries jsonb,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
  v_entry jsonb;
  v_product_id uuid;
  v_quantity numeric(14,3);
  v_note text;
  v_movement_ids jsonb := '[]'::jsonb;
  v_movement_id uuid;
  v_seen jsonb := '[]'::jsonb;
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_active_member(p_company_id), false)
  then
    raise exception 'Membro ativo necessário';
  end if;

  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) = 0
  then
    raise exception 'Adicione ao menos uma entrada';
  end if;

  if not exists (
    select 1
    from public.environments e
    where e.id = p_environment_id
      and e.company_id = p_company_id
      and e.active
  ) then
    raise exception 'Ambiente inválido';
  end if;

  if p_client_request_id is not null then
    insert into public.movement_client_requests(
      company_id,
      user_id,
      client_request_id,
      movement_id,
      result
    )
    values(
      p_company_id,
      auth.uid(),
      p_client_request_id,
      null,
      jsonb_build_object('status', 'processing')
    )
    on conflict do nothing;

    select r.result
    into v_existing
    from public.movement_client_requests r
    where r.company_id = p_company_id
      and r.user_id = auth.uid()
      and r.client_request_id = p_client_request_id
    for update;

    if v_existing is not null
      and coalesce(v_existing->>'status', '') <> 'processing'
    then
      return v_existing;
    end if;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_product_id := nullif(v_entry->>'product_id', '')::uuid;
    v_quantity := nullif(v_entry->>'quantity', '')::numeric;
    v_note := nullif(btrim(coalesce(v_entry->>'note', '')), '');

    if v_product_id is null or v_quantity is null or v_quantity <= 0
    then
      raise exception 'Entrada inválida';
    end if;

    if v_seen ? v_product_id::text then
      raise exception 'Produto duplicado no lote';
    end if;
    v_seen := v_seen || jsonb_build_array(v_product_id);

    if not exists (
      select 1
      from public.products p
      where p.id = v_product_id
        and p.company_id = p_company_id
        and p.active
    ) then
      raise exception 'Produto inválido';
    end if;
  end loop;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_product_id := (v_entry->>'product_id')::uuid;
    v_quantity := (v_entry->>'quantity')::numeric;
    v_note := nullif(btrim(coalesce(v_entry->>'note', '')), '');

    v_movement_id := public.register_movement(
      p_company_id,
      v_product_id,
      p_environment_id,
      'entrada',
      v_quantity,
      v_note
    );
    v_movement_ids := v_movement_ids || jsonb_build_object('movement_id', v_movement_id);
  end loop;

  v_existing := jsonb_build_object(
    'applied', jsonb_array_length(v_movement_ids),
    'movement_ids', v_movement_ids
  );

  if p_client_request_id is not null then
    update public.movement_client_requests
    set result = v_existing
    where company_id = p_company_id
      and user_id = auth.uid()
      and client_request_id = p_client_request_id;
  end if;

  return v_existing;
end;
$$;

revoke execute on function public.apply_movement_entry_batch(uuid,uuid,jsonb,uuid) from public, anon;
grant execute on function public.apply_movement_entry_batch(uuid,uuid,jsonb,uuid) to authenticated;
