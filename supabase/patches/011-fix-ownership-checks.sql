drop function if exists public.promote_to_manager(uuid);
create or replace function public.promote_to_manager(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_target public.memberships%rowtype;
begin
  select * into v_target from public.memberships where id=p_membership_id;
  if v_target.id is null then raise exception 'membership not found'; end if;
  if not v_target.active then raise exception 'cannot promote a deactivated membership'; end if;
  if v_target.role='owner' then raise exception 'cannot promote an owner'; end if;
  if v_target.role='manager' then raise exception 'cannot promote a manager'; end if;
  if v_target.role<> 'employee' then raise exception 'only active employees can be promoted'; end if;
  if not coalesce(public.is_admin(),false)
    and coalesce(public.member_role(v_target.company_id),'')<> 'owner'
  then raise exception 'only an admin or company owner can promote members'; end if;
  update public.memberships set role='manager',code_id=null where id=p_membership_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_target.company_id,'promote_to_manager',
    jsonb_build_object('membership_id',p_membership_id,'promoted_user_id',v_target.user_id));
end;
$$;
revoke execute on function public.promote_to_manager(uuid) from public,anon;
grant execute on function public.promote_to_manager(uuid) to authenticated;

drop function if exists public.deactivate_member(uuid);
create or replace function public.deactivate_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_target public.memberships%rowtype; v_caller public.company_role;
begin
  select * into v_target from public.memberships where id=p_membership_id;
  if v_target.id is null then raise exception 'membership not found'; end if;
  if v_target.user_id=auth.uid() then raise exception 'a member cannot deactivate themselves'; end if;
  if exists(select 1 from public.app_admins where user_id=v_target.user_id)
  then raise exception 'the application admin cannot be deactivated'; end if;
  if coalesce(public.is_admin(),false) then null;
  else
    v_caller:=public.member_role(v_target.company_id);
    if v_caller='owner' and v_target.role in ('manager','employee') then null;
    elsif v_caller='manager' and v_target.role='employee'
      and coalesce(public.is_active_member(v_target.company_id),false) then null;
    else raise exception 'not authorized to deactivate this membership'; end if;
  end if;
  update public.memberships
  set active=false,deactivated_at=timezone('utc',now()),deactivated_by=auth.uid()
  where id=p_membership_id;
  insert into public.audit_log(user_id,company_id,action,data)
  values(auth.uid(),v_target.company_id,'deactivate_member',
    jsonb_build_object('membership_id',p_membership_id,'deactivated_user_id',v_target.user_id,'previous_role',v_target.role));
end;
$$;
revoke execute on function public.deactivate_member(uuid) from public,anon;
grant execute on function public.deactivate_member(uuid) to authenticated;

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
  if coalesce(public.is_admin(),false) then raise exception 'Administrador não pode completar motivos de perda'; end if;
  if not coalesce(public.is_active_member(v_movement.company_id),false) then raise exception 'Membro ativo necessário'; end if;
  if not exists(select 1 from public.loss_reasons r where r.id=p_reason_id and r.company_id=v_movement.company_id and r.active)
  then raise exception 'Motivo de perda inválido'; end if;
  if not coalesce(public.is_manager_or_owner(v_movement.company_id),false)
    and v_movement.created_by<>auth.uid()
  then raise exception 'Funcionário só pode informar motivo da própria perda'; end if;
  update public.loss_reason_pending
  set reason_id=p_reason_id,completed_at=timezone('utc',now()),completed_by=auth.uid()
  where movement_id=p_movement_id;
end;
$$;
revoke execute on function public.complete_pending_loss_reason(uuid,uuid) from public,anon;
grant execute on function public.complete_pending_loss_reason(uuid,uuid) to authenticated;
