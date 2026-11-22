-- Consulta 1/5: tabelas esperadas e estado do RLS.
-- Execute este arquivo sozinho no SQL Editor do projeto Supabase de testes.
-- Retorna somente metadados; não lê dados operacionais.

with expected_tables(schema_name, table_name) as (
  values
    ('public', 'companies'),
    ('public', 'profiles'),
    ('public', 'memberships'),
    ('public', 'environments'),
    ('public', 'products'),
    ('public', 'product_costs'),
    ('public', 'product_environment_pricing'),
    ('public', 'stock_movements'),
    ('public', 'sales_product_map'),
    ('public', 'sales_import_batches'),
    ('public', 'sales_import_items'),
    ('public', 'audit_log'),
    ('public', 'app_admins'),
    ('auth', 'users'),
    ('auth', 'identities'),
    ('auth', 'sessions')
)
select
  expected.schema_name,
  expected.table_name,
  relation.oid is not null as exists,
  coalesce(relation.relrowsecurity, false) as rls_enabled,
  coalesce(relation.relforcerowsecurity, false) as rls_forced
from expected_tables expected
left join pg_class relation
  on relation.oid = to_regclass(format('%I.%I', expected.schema_name, expected.table_name))
order by expected.schema_name, expected.table_name;
