-- Correção idempotente para bancos da Etapa 1 que já aplicaram as migrations.
-- Nenhuma tabela ou dado é recriado/removido.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.secure_company_code(p_company_id uuid)
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $function$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  byte_value integer;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..10 loop
      byte_value := (get_byte(extensions.gen_random_bytes(1), 0) & 127) % length(alphabet);
      candidate := candidate || substr(alphabet, byte_value + 1, 1);
    end loop;
    candidate := substr(candidate, 1, 5) || '-' || substr(candidate, 6, 5);
    begin
      perform 1 from public.company_codes where code = candidate;
      if not found then
        return candidate;
      end if;
    end;
  end loop;
end;
$function$;
