-- Consulta 5/5: triggers e constraints das tabelas relacionadas.
-- Execute este arquivo sozinho no SQL Editor do projeto Supabase de testes.

select
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'table_name', event_object_table,
        'trigger_name', trigger_name,
        'timing', action_timing,
        'event', event_manipulation
      )
      order by event_object_table, trigger_name, event_manipulation
    )
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table in (
        'product_environment_pricing',
        'sales_import_batches',
        'sales_import_items'
      )
  ), '[]'::jsonb) as triggers,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'table_name', relation.relname,
        'constraint_name', constraint_row.conname,
        'constraint_type', constraint_row.contype,
        'definition', pg_get_constraintdef(constraint_row.oid)
      )
      order by relation.relname, constraint_row.conname
    )
    from pg_constraint constraint_row
    join pg_class relation on relation.oid = constraint_row.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'products',
        'product_environment_pricing',
        'sales_import_batches',
        'sales_import_items'
      )
  ), '[]'::jsonb) as constraints;
