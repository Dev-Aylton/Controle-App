-- Coluna opcional para avatares padrão escolhidos pelo usuário.

alter table public.profiles
  add column if not exists avatar_key text;
