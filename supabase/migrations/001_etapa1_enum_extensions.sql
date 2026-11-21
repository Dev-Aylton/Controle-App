create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.company_role as enum ('owner', 'manager', 'employee');
exception
  when duplicate_object then null;
end;
$$;
