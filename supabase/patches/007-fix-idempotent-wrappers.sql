drop function if exists public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid);
drop function if exists public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid);

create or replace function public.register_movement_idempotent(
  p_company_id uuid,
  p_product_id uuid,
  p_environment_id uuid,
  p_type text,
  p_quantity numeric,
  p_note text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_movement_id uuid;
begin
  if p_client_request_id is not null then
    select r.movement_id into v_existing
    from public.movement_client_requests r
    where r.company_id=p_company_id
      and r.user_id=auth.uid()
      and r.client_request_id=p_client_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;

  v_movement_id := public.register_movement(
    p_company_id,p_product_id,p_environment_id,p_type,p_quantity,p_note
  );
  if p_client_request_id is not null then
    insert into public.movement_client_requests(company_id,user_id,client_request_id,movement_id,result)
    values(p_company_id,auth.uid(),p_client_request_id,v_movement_id,jsonb_build_object('movement_id',v_movement_id))
    on conflict do nothing;
  end if;
  return v_movement_id;
end;
$$;

create or replace function public.register_transfer_idempotent(
  p_company_id uuid,
  p_product_id uuid,
  p_from_environment_id uuid,
  p_to_environment_id uuid,
  p_quantity numeric,
  p_note text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_transfer_group_id uuid;
begin
  if p_client_request_id is not null then
    select r.movement_id into v_existing
    from public.movement_client_requests r
    where r.company_id=p_company_id
      and r.user_id=auth.uid()
      and r.client_request_id=p_client_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;

  v_transfer_group_id := public.register_transfer(
    p_company_id,p_product_id,p_from_environment_id,p_to_environment_id,p_quantity,p_note
  );
  if p_client_request_id is not null then
    insert into public.movement_client_requests(company_id,user_id,client_request_id,movement_id,result)
    values(p_company_id,auth.uid(),p_client_request_id,v_transfer_group_id,jsonb_build_object('transfer_group_id',v_transfer_group_id))
    on conflict do nothing;
  end if;
  return v_transfer_group_id;
end;
$$;

revoke execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) from public, anon;
revoke execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) from public, anon;
grant execute on function public.register_movement_idempotent(uuid,uuid,uuid,text,numeric,text,uuid) to authenticated;
grant execute on function public.register_transfer_idempotent(uuid,uuid,uuid,uuid,numeric,text,uuid) to authenticated;
