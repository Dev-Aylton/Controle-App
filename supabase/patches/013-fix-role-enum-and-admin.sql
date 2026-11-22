drop function if exists public.promote_to_manager(uuid);
create or replace function public.promote_to_manager(p_membership_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_target public.memberships%rowtype;
begin
  select * into v_target from public.memberships where id=p_membership_id;
  if v_target.id is null then raise exception 'membership not found'; end if;
  if not v_target.active then raise exception 'cannot promote a deactivated membership'; end if;
  if v_target.role in ('owner','manager') then raise exception 'cannot promote this role'; end if;
  if v_target.role<>'employee' then raise exception 'only active employees can be promoted'; end if;
  if not coalesce(public.is_admin(),false)
    and not exists (
      select 1 from public.memberships m
      where m.user_id=auth.uid() and m.company_id=v_target.company_id
        and m.active and m.role='owner'
    )
  then raise exception 'only an admin or company owner can promote members'; end if;
  update public.memberships set role='manager',code_id=null where id=p_membership_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_target.company_id,'promote_to_manager',
    jsonb_build_object('membership_id',p_membership_id,'promoted_user_id',v_target.user_id,'support',coalesce(public.is_admin(),false)));
end;
$$;
revoke execute on function public.promote_to_manager(uuid) from public,anon;
grant execute on function public.promote_to_manager(uuid) to authenticated;

drop function if exists public.complete_pending_loss_reason(uuid,uuid);
create or replace function public.complete_pending_loss_reason(p_movement_id uuid,p_reason_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_pending public.loss_reason_pending%rowtype; v_movement public.stock_movements%rowtype;
begin
  select * into v_pending from public.loss_reason_pending where movement_id=p_movement_id;
  if v_pending.movement_id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if v_pending.reason_id is not null then raise exception 'Motivo da perda já informado'; end if;
  select * into v_movement from public.stock_movements where id=p_movement_id and type='perda';
  if v_movement.id is null then raise exception 'Movimento de perda não encontrado'; end if;
  if not exists(select 1 from public.loss_reasons r where r.id=p_reason_id and r.company_id=v_movement.company_id and r.active)
  then raise exception 'Motivo de perda inválido'; end if;
  if not coalesce(public.is_admin(),false)
    and not coalesce(public.is_manager_or_owner(v_movement.company_id),false)
    and v_movement.created_by<>auth.uid()
  then raise exception 'Funcionário só pode informar motivo da própria perda'; end if;
  update public.loss_reason_pending
  set reason_id=p_reason_id,completed_at=timezone('utc',now()),completed_by=auth.uid()
  where movement_id=p_movement_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_movement.company_id,'loss_reason_completed',
    jsonb_build_object('movement_id',p_movement_id,'reason_id',p_reason_id,'support',coalesce(public.is_admin(),false)));
end;
$$;
revoke execute on function public.complete_pending_loss_reason(uuid,uuid) from public,anon;
grant execute on function public.complete_pending_loss_reason(uuid,uuid) to authenticated;
