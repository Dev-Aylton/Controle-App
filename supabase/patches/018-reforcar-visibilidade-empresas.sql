-- Garante que apenas administradores vejam todas as empresas.
-- Proprietários, gerentes e funcionários continuam limitados aos vínculos ativos.

drop policy if exists "companies_select_active_members_or_admin" on public.companies;
create policy "companies_select_active_members_or_admin"
on public.companies for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.memberships m
    where m.company_id = public.companies.id
      and m.user_id = auth.uid()
      and m.active
  )
);
