alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.companies enable row level security;
alter table public.company_codes enable row level security;
alter table public.memberships enable row level security;
alter table public.company_invites enable row level security;
alter table public.audit_log enable row level security;

revoke all on table
  public.profiles,
  public.app_admins,
  public.companies,
  public.company_codes,
  public.memberships,
  public.company_invites,
  public.audit_log
from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update(name, avatar_url) on public.profiles to authenticated;

grant select on public.app_admins to authenticated;

grant select, insert(name, phone, photo) on public.companies to authenticated;
grant update(name, phone, photo) on public.companies to authenticated;

grant select on public.company_codes to authenticated;
grant select on public.memberships to authenticated;

grant select on public.company_invites to authenticated;

grant select on public.audit_log to authenticated;

grant usage, select on sequence public.audit_log_id_seq to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.member_role(uuid) to authenticated;
grant execute on function public.is_manager_or_owner(uuid) to authenticated;
grant execute on function public.rotate_company_code(uuid) to authenticated;
grant execute on function public.join_company_with_code(text) to authenticated;
grant execute on function public.claim_invites() to authenticated;
grant execute on function public.create_invite(uuid, text, public.company_role) to authenticated;
grant execute on function public.promote_to_manager(uuid) to authenticated;
grant execute on function public.deactivate_member(uuid) to authenticated;

revoke execute on function public.secure_company_code(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_owner_limit() from public, anon, authenticated;
revoke execute on function public.enforce_single_app_admin() from public, anon, authenticated;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "app_admins_select_admin" on public.app_admins;
create policy "app_admins_select_admin"
on public.app_admins for select
to authenticated
using (public.is_admin());

drop policy if exists "companies_select_active_members_or_admin" on public.companies;
create policy "companies_select_active_members_or_admin"
on public.companies for select
to authenticated
using (public.is_admin() or public.is_active_member(id));

drop policy if exists "companies_insert_admin" on public.companies;
create policy "companies_insert_admin"
on public.companies for insert
to authenticated
with check (public.is_admin());

drop policy if exists "companies_update_admin_owner_manager" on public.companies;
create policy "companies_update_admin_owner_manager"
on public.companies for update
to authenticated
using (public.is_admin() or public.is_manager_or_owner(id))
with check (public.is_admin() or public.is_manager_or_owner(id));

drop policy if exists "company_codes_select_admin_owner_manager" on public.company_codes;
create policy "company_codes_select_admin_owner_manager"
on public.company_codes for select
to authenticated
using (
  public.is_admin()
  or public.is_manager_or_owner(company_id)
);

drop policy if exists "memberships_select_self_or_leaders" on public.memberships;
create policy "memberships_select_self_or_leaders"
on public.memberships for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or public.is_manager_or_owner(company_id)
);

drop policy if exists "invites_select_admin_owner" on public.company_invites;
create policy "invites_select_admin_owner"
on public.company_invites for select
to authenticated
using (
  public.is_admin()
  or public.member_role(company_id) = 'owner'
);

drop policy if exists "audit_select_admin_owner_manager" on public.audit_log;
create policy "audit_select_admin_owner_manager"
on public.audit_log for select
to authenticated
using (
  public.is_admin()
  or (
    company_id is not null
    and public.is_manager_or_owner(company_id)
  )
);

drop policy if exists "company_photos_select_members" on storage.objects;
create policy "company_photos_select_members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_active_member(
      split_part(name, '/', 2)::uuid
    )
  )
);

drop policy if exists "company_photos_insert_leaders" on storage.objects;
create policy "company_photos_insert_leaders"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_manager_or_owner(split_part(name, '/', 2)::uuid)
  )
);

drop policy if exists "company_photos_update_leaders" on storage.objects;
create policy "company_photos_update_leaders"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_manager_or_owner(split_part(name, '/', 2)::uuid)
  )
)
with check (
  bucket_id = 'company-photos'
  and (
    public.is_admin()
    or public.is_manager_or_owner(split_part(name, '/', 2)::uuid)
  )
);
