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

insert into private.community_action_rate_policies(
  bucket,window_seconds,max_actions,enabled,updated_at
) values (
  'preset_artifact_prepare',3600,30,true,now()
)
on conflict(bucket) do update
set window_seconds=excluded.window_seconds,
    max_actions=excluded.max_actions,
    enabled=excluded.enabled,
    updated_at=excluded.updated_at;
