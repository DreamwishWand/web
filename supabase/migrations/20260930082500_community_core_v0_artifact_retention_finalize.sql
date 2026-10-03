
create or replace function public.community_finalize_artifact_blob_purge(
  p_blob_id uuid,
  p_expected_storage_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_blob public.artifact_blobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_blob
  from public.artifact_blobs
  where blob_id=p_blob_id
  for update;

  if v_blob.blob_id is null then
    raise exception 'ArtifactBlob not found';
  end if;

  if v_blob.purged_at is not null then
    return jsonb_build_object(
      'blobId',v_blob.blob_id,
      'state','purged',
      'purgedAt',v_blob.purged_at,
      'idempotent',true
    );
  end if;

  if p_expected_storage_key is null
     or p_expected_storage_key <> v_blob.storage_key then
    raise exception 'ArtifactBlob storage key mismatch';
  end if;

  perform set_config('app.community_retention_redaction','on',true);

  update public.artifact_blobs
  set storage_key='purged:' || blob_id::text,
      content_type='application/x-purged',
      byte_size=0,
      checksum_sha256=repeat('0',64),
      purged_at=v_now
  where blob_id=p_blob_id;

  perform set_config('app.community_retention_redaction','off',true);

  return jsonb_build_object(
    'blobId',p_blob_id,
    'state','purged',
    'purgedAt',v_now,
    'idempotent',false
  );
end;
$$;

revoke execute on function public.community_finalize_artifact_blob_purge(uuid,text)
from public,anon,authenticated;
grant execute on function public.community_finalize_artifact_blob_purge(uuid,text)
to service_role;
