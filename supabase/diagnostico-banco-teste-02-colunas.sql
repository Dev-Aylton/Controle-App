-- Consulta 2/5: colunas das tabelas financeiras.
-- Execute este arquivo sozinho no SQL Editor do projeto Supabase de testes.

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'products',
    'product_costs',
    'product_environment_pricing',
    'sales_import_batches',
    'sales_import_items'
  )
order by table_name, ordinal_position;
