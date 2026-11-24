begin;

update public.privacy_policy_releases
set is_current = false,
    status = 'retired'
where is_current = true
  and version <> '1.3.0';

insert into public.privacy_policy_releases(
  version,
  status,
  is_current,
  published_at,
  content_sha256
)
values(
  '1.3.0',
  'published',
  true,
  timezone('utc', now()),
  'c0b97aa6d5e0cc5f27b359b1a127e8de33bb390afda5dc2f6212a582fb99180d'
)
on conflict (version) do update
set status = excluded.status,
    is_current = excluded.is_current,
    published_at = coalesce(
      public.privacy_policy_releases.published_at,
      excluded.published_at
    ),
    content_sha256 = excluded.content_sha256;

commit;
