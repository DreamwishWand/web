-- STAGING-ONLY adapter bootstrap. Do not treat these limits/provider as production canonical.\n
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'community-media-staging',
  'community-media-staging',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
