create or replace function public.wep_get_claimed_retention_artifact_blobs(
  p_retention_job_id uuid,
  p_lock_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_job private.account_retention_jobs%rowtype;
  v_blobs jsonb;
begin
  if p_lock_token is null then
    raise exception 'Retention lock token is required';
  end if;

  select * into v_job
  from private.account_retention_jobs
  where retention_job_id=p_retention_job_id
    and state='processing'
    and lock_token=p_lock_token
    and stage='content_payload';

  if v_job.retention_job_id is null then
    raise exception 'Claimed content-retention job not found';
  end if;

  if private.community_account_has_retention_hold(v_job.account_id) then
    raise exception 'Retention hold became active';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'blobId',b.blob_id,
        'storageKey',b.storage_key,
        'byteSize',b.byte_size,
        'checksumSha256',b.checksum_sha256
      )
      order by b.blob_id
    ),
    '[]'::jsonb
  )
  into v_blobs
  from public.artifact_blobs b
  where b.owner_account_id=v_job.account_id
    and b.purged_at is null;

  return jsonb_build_object(
    'retentionJobId',v_job.retention_job_id,
    'accountId',v_job.account_id,
    'blobs',v_blobs
  );
end;
$$;

revoke execute on function public.wep_get_claimed_retention_artifact_blobs(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.wep_get_claimed_retention_artifact_blobs(uuid,uuid)
to service_role;
