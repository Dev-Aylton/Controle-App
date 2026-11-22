-- Consulta 3/5: políticas RLS e permissões SQL.
-- Execute este arquivo sozinho no SQL Editor do projeto Supabase de testes.

select
  'policy' as record_type,
  schemaname as schema_name,
  tablename as object_name,
  policyname as name,
  jsonb_build_object(
    'roles', roles,
    'command', cmd,
    'using', qual,
    'with_check', with_check
  ) as details
from pg_policies
where schemaname = 'public'
  and tablename in (
    'product_environment_pricing',
    'sales_product_map',
    'sales_import_batches',
    'sales_import_items',
    'stock_movements',
    'audit_log'
  )

union all

select
  'grant' as record_type,
  table_schema as schema_name,
  table_name as object_name,
  privilege_type as name,
  jsonb_build_object(
    'grantee', grantee,
    'privilege_type', privilege_type,
    'is_grantable', is_grantable
  ) as details
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'product_environment_pricing',
    'sales_product_map',
    'sales_import_batches',
    'sales_import_items',
    'stock_movements',
    'audit_log'
  )
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by record_type, object_name, name;
