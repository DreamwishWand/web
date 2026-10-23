-- Community-owned cleanup for finalized media that never became Gallery Work media.
-- Used by Scene Preset publication failure handling. No Preset/Gallery relationship is defined here.

create or replace function public.community_prepare_unattached_media_discard_v1(
  p_auth_subject uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_media public.media_assets%rowtype;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select * into v_media
  from public.media_assets
  where media_id=p_media_id and owner_account_id=v_account_id;

  if v_media.media_id is null then
    raise exception 'Media is not owned by actor';
  end if;
  if exists(select 1 from public.work_revision_media where media_id=p_media_id) then
    raise exception 'Published or revision-bound media cannot be discarded';
  end if;
  if exists(select 1 from public.creator_profiles where avatar_media_id=p_media_id) then
    raise exception 'Creator avatar media cannot be discarded';
  end if;

  return jsonb_build_object(
    'mediaId',p_media_id,
    'storageKey',v_media.storage_key,
    'discardable',true
  );
end
$$;

create or replace function public.community_finalize_unattached_media_discard_v1(
  p_auth_subject uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_media public.media_assets%rowtype;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select * into v_media
  from public.media_assets
  where media_id=p_media_id and owner_account_id=v_account_id
  for update;

  if v_media.media_id is null then
    raise exception 'Media is not owned by actor';
  end if;
  if exists(select 1 from public.work_revision_media where media_id=p_media_id) then
    raise exception 'Published or revision-bound media cannot be discarded';
  end if;
  if exists(select 1 from public.creator_profiles where avatar_media_id=p_media_id) then
    raise exception 'Creator avatar media cannot be discarded';
  end if;

  delete from public.media_assets where media_id=p_media_id;
  delete from public.community_entities where entity_id=p_media_id;

  return jsonb_build_object('mediaId',p_media_id,'discarded',true);
end
$$;

revoke execute on function public.community_prepare_unattached_media_discard_v1(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_finalize_unattached_media_discard_v1(uuid,uuid)
from public,anon,authenticated;

grant execute on function public.community_prepare_unattached_media_discard_v1(uuid,uuid)
to service_role;
grant execute on function public.community_finalize_unattached_media_discard_v1(uuid,uuid)
to service_role;
