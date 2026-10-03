-- Known-staging-only WEP Preset Artifact Storage bootstrap.
-- This file is not part of the production migration chain.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'wand-preset-artifacts-staging',
  'wand-preset-artifacts-staging',
  false,
  26214400,
  array['application/json']::text[]
)
on conflict(id) do update
set name=excluded.name,
    public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;
