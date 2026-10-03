
create or replace function public.community_get_media_storage_key(
  p_auth_subject uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_media public.media_assets%rowtype;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.can_access_entity(p_media_id,v_account_id) then
    raise exception 'Media is not accessible';
  end if;

  select * into v_media
  from public.media_assets
  where media_id=p_media_id
    and processing_state='ready'
    and moderation_state='clear';

  if v_media.media_id is null then raise exception 'Media is not READY'; end if;

  return jsonb_build_object(
    'mediaId',v_media.media_id,
    'storageKey',v_media.storage_key,
    'mimeType',v_media.mime_type,
    'byteSize',v_media.byte_size,
    'width',v_media.width,
    'height',v_media.height,
    'checksumSha256',v_media.checksum_sha256
  );
end;
$$;

revoke execute on function public.community_get_media_storage_key(uuid,uuid)
from public, anon, authenticated;
grant execute on function public.community_get_media_storage_key(uuid,uuid)
to service_role;
