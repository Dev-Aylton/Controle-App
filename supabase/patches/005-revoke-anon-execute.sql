revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;

revoke execute on function public.member_role(uuid) from public, anon;
grant execute on function public.member_role(uuid) to authenticated;

revoke execute on function public.is_manager_or_owner(uuid) from public, anon;
grant execute on function public.is_manager_or_owner(uuid) to authenticated;

revoke execute on function public.rotate_company_code(uuid) from public, anon;
grant execute on function public.rotate_company_code(uuid) to authenticated;

revoke execute on function public.join_company_with_code(text) from public, anon;
grant execute on function public.join_company_with_code(text) to authenticated;

revoke execute on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;

revoke execute on function public.create_invite(uuid, text, public.company_role) from public, anon;
grant execute on function public.create_invite(uuid, text, public.company_role) to authenticated;

revoke execute on function public.promote_to_manager(uuid) from public, anon;
grant execute on function public.promote_to_manager(uuid) to authenticated;

revoke execute on function public.deactivate_member(uuid) from public, anon;
grant execute on function public.deactivate_member(uuid) to authenticated;

revoke execute on function public.upsert_product_cost(uuid, numeric) from public, anon;
grant execute on function public.upsert_product_cost(uuid, numeric) to authenticated;

revoke execute on function public.import_products(uuid, jsonb) from public, anon;
grant execute on function public.import_products(uuid, jsonb) to authenticated;
