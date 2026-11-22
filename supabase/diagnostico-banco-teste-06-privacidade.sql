-- Execute esta consulta no mesmo projeto Supabase configurado em .env.test.
-- O resultado reúne os objetos e permissões necessários ao fluxo de privacidade.
with expected_functions(function_name) as (
  values
    ('delete_my_account'),
    ('request_account_deletion'),
    ('get_account_deletion_status'),
    ('reactivate_my_account'),
    ('get_privacy_policy_status'),
    ('accept_current_privacy_policy'),
    ('claim_expired_account_deletions'),
    ('release_expired_account_deletion'),
    ('finalize_expired_account_deletion')
),
function_status as (
  select
    expected.function_name,
    procedure.oid is not null as exists,
    case when procedure.oid is null then null
      else pg_get_function_identity_arguments(procedure.oid)
    end as arguments,
    coalesce(procedure.prosecdef, false) as security_definer,
    procedure.proconfig as function_settings,
    case when procedure.oid is null then false
      else has_function_privilege('anon', procedure.oid, 'EXECUTE')
    end as anon_can_execute,
    case when procedure.oid is null then false
      else has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    end as authenticated_can_execute,
    case when procedure.oid is null then false
      else has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    end as service_role_can_execute,
    case expected.function_name
      when 'delete_my_account' then coalesce(procedure.prosrc ilike '%request_account_deletion%', false)
      when 'request_account_deletion' then coalesce(procedure.prosrc ilike '%interval ''90 days''%', false)
      when 'reactivate_my_account' then coalesce(procedure.prosrc ilike '%status = ''cancelled''%', false)
      else procedure.oid is not null
    end as expected_body_marker
  from expected_functions expected
  left join pg_proc procedure
    on procedure.proname = expected.function_name
  left join pg_namespace namespace
    on namespace.oid = procedure.pronamespace
    and namespace.nspname = 'public'
  where procedure.oid is null or namespace.oid is not null
),
expected_tables(table_name) as (
  values
    ('account_deletion_requests'),
    ('privacy_policy_releases'),
    ('privacy_policy_acceptances')
),
table_status as (
  select
    expected.table_name,
    relation.oid is not null as exists,
    coalesce(relation.relrowsecurity, false) as rls_enabled,
    case when relation.oid is null then false
      else has_table_privilege('authenticated', relation.oid, 'SELECT')
    end as authenticated_can_select_directly,
    case when relation.oid is null then false
      else has_table_privilege('service_role', relation.oid, 'SELECT')
    end as service_role_can_select_directly
  from expected_tables expected
  left join pg_class relation
    on relation.relname = expected.table_name
  left join pg_namespace namespace
    on namespace.oid = relation.relnamespace
    and namespace.nspname = 'public'
  where relation.oid is null or namespace.oid is not null
)
select jsonb_build_object(
  'functions',
  coalesce((select jsonb_agg(to_jsonb(function_status) order by function_name) from function_status), '[]'::jsonb),
  'tables',
  coalesce((select jsonb_agg(to_jsonb(table_status) order by table_name) from table_status), '[]'::jsonb)
) as privacy_migration_status;
