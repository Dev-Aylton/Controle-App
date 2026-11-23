alter table public.sales_import_batches
  add column if not exists source_hash text;

create unique index if not exists sales_import_batches_unique_source
  on public.sales_import_batches(company_id, environment_id, lower(coalesce(source_hash, '')))
  where source_hash is not null and status = 'applied';
