create or replace function public.community_get_public_media_storage_v1(
  p_media_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'mediaId',m.media_id,
    'storageKey',m.storage_key,
    'mimeType',m.mime_type,
    'byteSize',m.byte_size,
    'width',m.width,
    'height',m.height,
    'checksumSha256',m.checksum_sha256
  )
  into v_result
  from public.media_assets m
  where m.media_id=p_media_id
    and m.processing_state='ready'
    and m.moderation_state='clear'
    and m.purged_at is null
    and exists (
      select 1
      from public.work_revision_media wrm
      join public.community_work_revisions r
        on r.revision_id=wrm.work_revision_id
      join public.community_works w
        on w.work_id=r.work_id
       and w.current_published_revision_id=r.revision_id
      where wrm.media_id=m.media_id
        and w.work_type='gallery'
        and w.lifecycle_state='published'
        and w.visibility='public'
        and w.moderation_state='clear'
        and private.is_discoverable_work(w.work_id)
    );

  if v_result is null then
    raise exception 'Public media is not accessible';
  end if;

  return v_result;
end
$$;

revoke execute on function public.community_get_public_media_storage_v1(uuid)
from public,anon,authenticated;
grant execute on function public.community_get_public_media_storage_v1(uuid)
to service_role;
