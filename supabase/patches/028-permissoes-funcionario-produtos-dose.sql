-- Funcionários podem cadastrar produtos novos, mas não podem alterar ou desativar cadastros existentes.
grant select (
  id,
  company_id,
  category_id,
  name,
  sku,
  unit,
  weight_g,
  volume_ml,
  dose_ml,
  photo_path,
  active,
  created_at,
  created_by
) on public.products to authenticated;

drop policy if exists "products_employee_create" on public.products;
create policy "products_employee_create"
on public.products for insert
to authenticated
with check (public.is_admin() or public.is_active_member(company_id));

-- Funcionários podem enviar fotos de produtos novos; gestores continuam podendo
-- substituir todas as fotos da empresa.
drop policy if exists "company_product_photos_insert_members" on storage.objects;
create policy "company_product_photos_insert_members"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-photos'
  and split_part(name, '/', 1) = 'companies'
  and split_part(name, '/', 3) = 'products'
  and public.is_active_member(split_part(name, '/', 2)::uuid)
);

-- Movimentação por dose é operacional e segura para membros ativos da empresa.
create or replace function public.register_dose_movement(
  p_company_id uuid,
  p_product_id uuid,
  p_environment_id uuid,
  p_kind text,
  p_doses numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_doses_per_unit integer;
  v_quantity numeric(14,3);
  v_movement_id uuid;
begin
  if not coalesce(public.is_admin(), false) and not coalesce(public.is_active_member(p_company_id), false) then
    raise exception 'Membro ativo necessário para lançar dose';
  end if;
  if p_kind not in ('entrada','saida','perda') then raise exception 'Tipo de dose inválido'; end if;
  if p_doses is null or p_doses <= 0 then raise exception 'Quantidade de doses deve ser positiva'; end if;
  select * into v_product
  from public.products
  where id = p_product_id and company_id = p_company_id and active;
  if v_product.id is null then raise exception 'Produto inválido'; end if;
  if not exists (
    select 1 from public.environments e
    where e.id=p_environment_id and e.company_id=p_company_id and e.active
  ) then raise exception 'Ambiente inválido'; end if;
  if v_product.volume_ml is null or v_product.dose_ml is null
    or v_product.volume_ml <= 0 or v_product.dose_ml <= 0 then
    raise exception 'Produto sem volume ou dose cadastrados';
  end if;
  v_doses_per_unit := floor(v_product.volume_ml / v_product.dose_ml)::integer;
  if v_doses_per_unit < 1 then raise exception 'Produto não possui dose válida'; end if;
  v_quantity := (p_doses / v_doses_per_unit)::numeric(14,3);
  v_movement_id := public.register_movement(
    p_company_id, p_product_id, p_environment_id, p_kind, v_quantity, p_note
  );
  return v_movement_id;
end;
$$;

revoke execute on function public.register_dose_movement(uuid,uuid,uuid,text,numeric,text) from public, anon;
grant execute on function public.register_dose_movement(uuid,uuid,uuid,text,numeric,text) to authenticated;
