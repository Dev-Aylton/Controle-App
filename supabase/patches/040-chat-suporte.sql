create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open','closed')),
  archived_by_user boolean not null default false,
  archived_by_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now())
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  hidden_by_user boolean not null default false,
  hidden_by_admin boolean not null default false,
  read_by_user_at timestamptz,
  read_by_admin_at timestamptz,
  sent_at timestamptz not null default timezone('utc',now()),
  constraint support_messages_content
    check (nullif(btrim(coalesce(body,'')), '') is not null or attachment_path is not null)
);

create index if not exists support_messages_conversation_sent
  on public.support_messages(conversation_id,sent_at desc);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
revoke all on table public.support_conversations, public.support_messages
  from public, anon, authenticated;
grant select on table public.support_conversations, public.support_messages
  to authenticated;

drop policy if exists support_conversations_participants on public.support_conversations;
create policy support_conversations_participants
on public.support_conversations for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists support_messages_participants on public.support_messages;
create policy support_messages_participants
on public.support_messages for select to authenticated
using (
  exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and (c.user_id = auth.uid() or public.is_admin())
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array[
    'image/jpeg','image/png','image/webp','application/pdf',
    'text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/zip'
  ]
)
on conflict (id) do update
  set public=excluded.public,
      file_size_limit=excluded.file_size_limit,
      allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists support_attachment_participants on storage.objects;
create policy support_attachment_participants
on storage.objects for all to authenticated
using (
  bucket_id='support-attachments'
  and exists (
    select 1
    from public.support_conversations c
    where c.id::text=split_part(name,'/',1)
      and (c.user_id=auth.uid() or public.is_admin())
  )
)
with check (
  bucket_id='support-attachments'
  and exists (
    select 1
    from public.support_conversations c
    where c.id::text=split_part(name,'/',1)
      and (c.user_id=auth.uid() or public.is_admin())
  )
);

drop function if exists public.support_get_or_create_conversation();
create or replace function public.support_get_or_create_conversation()
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if public.is_admin() then raise exception 'administrator must open a specific conversation'; end if;
  insert into public.support_conversations(user_id)
  values(auth.uid())
  on conflict(user_id) do update
    set updated_at=timezone('utc',now())
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.support_list_conversations();
create or replace function public.support_list_conversations()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'administrator required'; end if;
  return coalesce((
    select jsonb_agg(conversation_json order by conversation_updated_at desc)
    from (
      select jsonb_build_object(
        'id',c.id,
        'user_id',c.user_id,
        'status',c.status,
        'archived_by_user',c.archived_by_user,
        'archived_by_admin',c.archived_by_admin,
        'created_at',c.created_at,
        'updated_at',c.updated_at,
        'user_name',coalesce(p.name,u.email,'Usuário sem nome'),
        'user_email',u.email,
        'unread_count',(
          select count(*)
          from public.support_messages m
          where m.conversation_id=c.id
            and m.sender_id<>auth.uid()
            and m.read_by_admin_at is null
            and not m.hidden_by_admin
        )
      ) as conversation_json,
      c.updated_at as conversation_updated_at
      from public.support_conversations c
      left join public.profiles p on p.id=c.user_id
      left join auth.users u on u.id=c.user_id
    ) items
  ),'[]'::jsonb);
end;
$$;

drop function if exists public.support_list_messages(uuid);
create or replace function public.support_list_messages(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_conversation public.support_conversations%rowtype;
begin
  select * into v_conversation
  from public.support_conversations c
  where c.id=p_conversation_id;
  if v_conversation.id is null then raise exception 'conversation not found'; end if;
  if not public.is_admin() and v_conversation.user_id<>auth.uid()
  then raise exception 'conversation access denied'; end if;
  return coalesce((
    select jsonb_agg(message_json order by message_sent_at asc)
    from (
      select jsonb_build_object(
        'id',m.id,
        'sender_id',m.sender_id,
        'body',m.body,
        'attachment_path',m.attachment_path,
        'attachment_name',m.attachment_name,
        'attachment_type',m.attachment_type,
        'attachment_size',m.attachment_size,
        'sent_at',m.sent_at,
        'read_by_user_at',m.read_by_user_at,
        'read_by_admin_at',m.read_by_admin_at,
        'hidden_by_user',m.hidden_by_user,
        'hidden_by_admin',m.hidden_by_admin
      ) as message_json,
      m.sent_at as message_sent_at
      from public.support_messages m
      where m.conversation_id=p_conversation_id
        and (
          (public.is_admin() and not m.hidden_by_admin)
          or (not public.is_admin() and not m.hidden_by_user)
        )
    ) items
  ),'[]'::jsonb);
end;
$$;

drop function if exists public.support_send_message(uuid,text,text,text,text,integer);
create or replace function public.support_send_message(
  p_conversation_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_type text default null,
  p_attachment_size integer default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_conversation public.support_conversations%rowtype;
  v_message_id uuid;
begin
  select * into v_conversation
  from public.support_conversations c
  where c.id=p_conversation_id;
  if v_conversation.id is null then raise exception 'conversation not found'; end if;
  if not public.is_admin() and v_conversation.user_id<>auth.uid()
  then raise exception 'conversation access denied'; end if;
  if char_length(coalesce(p_body,'')) > 4000
  then raise exception 'message too long'; end if;
  if p_attachment_size is not null
    and p_attachment_size > 10485760
  then raise exception 'attachment too large'; end if;
  if p_attachment_name is not null
    and char_length(p_attachment_name) > 255
  then raise exception 'attachment name too long'; end if;
  if p_attachment_path is not null
    and not p_attachment_path like p_conversation_id::text || '/%'
  then raise exception 'attachment belongs to another conversation'; end if;
  if nullif(btrim(coalesce(p_body,'')), '') is null
    and p_attachment_path is null
  then raise exception 'message content required'; end if;

  insert into public.support_messages(
    conversation_id,sender_id,body,attachment_path,
    attachment_name,attachment_type,attachment_size,
    read_by_user_at,read_by_admin_at
  )
  values(
    p_conversation_id,auth.uid(),nullif(btrim(coalesce(p_body,'')),''),
    p_attachment_path,p_attachment_name,p_attachment_type,p_attachment_size,
    case when public.is_admin() then null else timezone('utc',now()) end,
    case when public.is_admin() then timezone('utc',now()) else null end
  )
  returning id into v_message_id;

  update public.support_conversations
  set updated_at=timezone('utc',now()),
      status='open',
      archived_by_user=false
  where id=p_conversation_id;
  return v_message_id;
end;
$$;

drop function if exists public.support_mark_read(uuid);
create or replace function public.support_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_conversation public.support_conversations%rowtype;
begin
  select * into v_conversation
  from public.support_conversations c
  where c.id=p_conversation_id;
  if v_conversation.id is null then raise exception 'conversation not found'; end if;
  if not public.is_admin() and v_conversation.user_id<>auth.uid()
  then raise exception 'conversation access denied'; end if;
  if public.is_admin() then
    update public.support_messages
    set read_by_admin_at=timezone('utc',now())
    where conversation_id=p_conversation_id
      and sender_id<>auth.uid()
      and read_by_admin_at is null;
  else
    update public.support_messages
    set read_by_user_at=timezone('utc',now())
    where conversation_id=p_conversation_id
      and sender_id<>auth.uid()
      and read_by_user_at is null;
  end if;
end;
$$;

drop function if exists public.support_archive_conversation(uuid);
create or replace function public.support_archive_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_conversation public.support_conversations%rowtype;
begin
  select * into v_conversation
  from public.support_conversations c
  where c.id=p_conversation_id;
  if v_conversation.id is null then raise exception 'conversation not found'; end if;
  if not public.is_admin() and v_conversation.user_id<>auth.uid()
  then raise exception 'conversation access denied'; end if;
  if public.is_admin() then
    update public.support_conversations set archived_by_admin=true, updated_at=timezone('utc',now()) where id=p_conversation_id;
  else
    update public.support_conversations set archived_by_user=true, updated_at=timezone('utc',now()) where id=p_conversation_id;
  end if;
end;
$$;

drop function if exists public.support_unarchive_conversation(uuid);
create or replace function public.support_unarchive_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_conversation public.support_conversations%rowtype;
begin
  select * into v_conversation
  from public.support_conversations c
  where c.id=p_conversation_id;
  if v_conversation.id is null then raise exception 'conversation not found'; end if;
  if not public.is_admin() and v_conversation.user_id<>auth.uid()
  then raise exception 'conversation access denied'; end if;
  if public.is_admin() then
    update public.support_conversations set archived_by_admin=false, updated_at=timezone('utc',now()) where id=p_conversation_id;
  else
    update public.support_conversations set archived_by_user=false, updated_at=timezone('utc',now()) where id=p_conversation_id;
  end if;
end;
$$;

drop function if exists public.support_hide_message(uuid);
create or replace function public.support_hide_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_message public.support_messages%rowtype;
  v_conversation public.support_conversations%rowtype;
begin
  select * into v_message
  from public.support_messages m
  where m.id=p_message_id;
  if v_message.id is null then raise exception 'message not found'; end if;
  select * into v_conversation
  from public.support_conversations c
  where c.id=v_message.conversation_id;
  if not public.is_admin() and v_conversation.user_id<>auth.uid()
  then raise exception 'conversation access denied'; end if;
  if public.is_admin() then
    update public.support_messages set hidden_by_admin=true where id=p_message_id;
  else
    update public.support_messages set hidden_by_user=true where id=p_message_id;
  end if;
end;
$$;

drop function if exists public.support_unread_count();
create or replace function public.support_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then return 0; end if;
  if public.is_admin() then
    select count(*) into v_count
    from public.support_messages m
    join public.support_conversations c on c.id=m.conversation_id
    where m.sender_id<>auth.uid()
      and m.read_by_admin_at is null
      and not m.hidden_by_admin
      and not c.archived_by_admin;
  else
    select count(*) into v_count
    from public.support_messages m
    join public.support_conversations c on c.id=m.conversation_id
    where c.user_id=auth.uid()
      and m.sender_id<>auth.uid()
      and m.read_by_user_at is null
      and not m.hidden_by_user
      and not c.archived_by_user;
  end if;
  return coalesce(v_count,0);
end;
$$;

revoke execute on function public.support_get_or_create_conversation() from public, anon;
revoke execute on function public.support_list_conversations() from public, anon;
revoke execute on function public.support_list_messages(uuid) from public, anon;
revoke execute on function public.support_send_message(uuid,text,text,text,text,integer) from public, anon;
revoke execute on function public.support_mark_read(uuid) from public, anon;
revoke execute on function public.support_archive_conversation(uuid) from public, anon;
revoke execute on function public.support_unarchive_conversation(uuid) from public, anon;
revoke execute on function public.support_hide_message(uuid) from public, anon;
revoke execute on function public.support_unread_count() from public, anon;

grant execute on function public.support_get_or_create_conversation() to authenticated;
grant execute on function public.support_list_conversations() to authenticated;
grant execute on function public.support_list_messages(uuid) to authenticated;
grant execute on function public.support_send_message(uuid,text,text,text,text,integer) to authenticated;
grant execute on function public.support_mark_read(uuid) to authenticated;
grant execute on function public.support_archive_conversation(uuid) to authenticated;
grant execute on function public.support_unarchive_conversation(uuid) to authenticated;
grant execute on function public.support_hide_message(uuid) to authenticated;
grant execute on function public.support_unread_count() to authenticated;
