-- Consulta 4/5: RPCs esperadas e marcadores do patch de exclusão de conta.
-- Execute este arquivo sozinho no SQL Editor do projeto Supabase de testes.

with expected_functions(function_name) as (
  values
    ('delete_my_account'),
    ('list_product_environment_pricing'),
    ('upsert_product_environment_pricing'),
    ('get_inventory_valuation'),
    ('import_sales_batch'),
    ('list_sales_imports'),
    ('get_purchase_list'),
    ('register_movement_idempotent'),
    ('register_transfer_idempotent'),
    ('get_team_members')
)
select
  expected.function_name,
  procedure.oid is not null as exists,
  case when procedure.oid is null then null
    else pg_get_function_identity_arguments(procedure.oid)
  end as arguments,
  procedure.prosecdef as security_definer,
  procedure.proconfig as function_settings,
  case when procedure.oid is null then false
    else has_function_privilege('anon', procedure.oid, 'EXECUTE')
  end as anon_can_execute,
  case when procedure.oid is null then false
    else has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  end as authenticated_can_execute,
  coalesce(procedure.prosrc ilike '%auth.identities%', false) as references_auth_identities,
  coalesce(procedure.prosrc ilike '%auth.sessions%', false) as references_auth_sessions,
  coalesce(procedure.prosrc ilike '%banned_until%', false) as disables_login,
  coalesce(procedure.prosrc ilike '%raw_user_meta_data%', false) as clears_user_metadata
from expected_functions expected
left join pg_proc procedure
  on procedure.proname = expected.function_name
left join pg_namespace namespace
  on namespace.oid = procedure.pronamespace
  and namespace.nspname = 'public'
where procedure.oid is null or namespace.oid is not null
order by expected.function_name, arguments;
