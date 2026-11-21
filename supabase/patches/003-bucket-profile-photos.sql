-- Cria o bucket privado de fotos de perfil e políticas por pasta do usuário.
-- Idempotente; não remove dados existentes.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_photos_select_owner" on storage.objects;
create policy "profile_photos_select_owner"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "profile_photos_insert_owner" on storage.objects;
create policy "profile_photos_insert_owner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "profile_photos_update_owner" on storage.objects;
create policy "profile_photos_update_owner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "profile_photos_delete_owner" on storage.objects;
create policy "profile_photos_delete_owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);
