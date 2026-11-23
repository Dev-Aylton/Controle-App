create or replace function public.register_movement(
  p_company_id uuid,
  p_product_id uuid,
  p_environment_id uuid,
  p_type text,
  p_quantity numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_signed numeric(14,3);
  v_current numeric(14,3);
  v_kind public.stock_movement_type;
  v_excess numeric(14,3);
begin
  if not coalesce(public.is_admin(), false)
    and not coalesce(public.is_active_member(p_company_id), false)
  then
    raise exception 'active membership required';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if p_type not in ('entrada','saida','perda') then raise exception 'invalid movement type'; end if;

  v_kind := p_type::public.stock_movement_type;
  if v_kind = 'entrada' then
    v_signed := p_quantity;
  else
    v_signed := -p_quantity;
    v_current := public.get_environment_balance(p_company_id,p_environment_id,p_product_id);
    v_excess := greatest(p_quantity - greatest(v_current,0),0);
  end if;

  insert into public.stock_movements(
    company_id,product_id,environment_id,type,
    quantity,signed_quantity,note,created_by
  )
  values(
    p_company_id,p_product_id,p_environment_id,v_kind,
    p_quantity,v_signed,p_note,auth.uid()
  )
  returning id into v_movement_id;

  if v_kind <> 'entrada' and v_excess > 0 then
    insert into public.audit_log(user_id,company_id,action,data)
    values(
      auth.uid(),p_company_id,'stock_divergence_detected',
      jsonb_build_object(
        'movement_id',v_movement_id,
        'product_id',p_product_id,
        'environment_id',p_environment_id,
        'available',greatest(v_current,0),
        'informed',p_quantity,
        'excess',v_excess,
        'movement_type',p_type
      )
    );
  end if;

  insert into public.audit_log(user_id,company_id,action,data)
  values(
    auth.uid(),p_company_id,'movement_registered',
    jsonb_build_object(
      'movement_id',v_movement_id,
      'product_id',p_product_id,
      'environment_id',p_environment_id,
      'type',p_type,
      'quantity',p_quantity,
      'available_before',greatest(v_current,0)
    )
  );
  return v_movement_id;
end;
$$;

revoke execute on function public.register_movement(uuid,uuid,uuid,text,numeric,text) from public, anon;
grant execute on function public.register_movement(uuid,uuid,uuid,text,numeric,text) to authenticated;
