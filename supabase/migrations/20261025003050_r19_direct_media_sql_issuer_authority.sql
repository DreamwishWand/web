-- Source141 additive direct SQL issuer fence. Source140 historical/Cover-only untouched.
-- PUBLIC V2 retains the effective DreamSnaps/Gallery criteria byte-for-byte,
-- except for its mandatory first-statement Incident guard.
create or replace function public.community_get_public_media_storage_v2(
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
  perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id);
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
    and (
      exists(
        select 1
        from public.work_revision_media wrm
        join public.community_work_revisions r on r.revision_id=wrm.work_revision_id
        join public.community_works w
          on w.work_id=r.work_id
         and w.current_published_revision_id=r.revision_id
        where wrm.media_id=m.media_id
          and w.work_type='gallery'
          and private.is_discoverable_work(w.work_id)
      )
      or exists(
        select 1
        from public.work_revision_media wrm
        join public.dreamsnap_gallery_publications gp on gp.revision_id=wrm.work_revision_id
        join public.dreamsnap_entries e on e.entry_id=gp.entry_id
        join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
        join public.community_works w on w.work_id=gp.work_id
        where wrm.media_id=m.media_id
          and gp.publication_state='published'
          and c.is_synthetic=false
          and c.lifecycle_state in ('results','closed')
          and e.entry_state='entered'
          and e.eligibility_state='eligible'
          and w.lifecycle_state='published'
          and w.visibility='public'
          and w.moderation_state='clear'
      )
      or exists(
        select 1
        from public.work_revision_media wrm
        join public.dreamsnap_entries e on e.entry_revision_id=wrm.work_revision_id
        join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
        join public.community_works w on w.work_id=e.work_id
        where wrm.media_id=m.media_id
          and c.is_synthetic=false
          and c.lifecycle_state in ('results','closed')
          and e.entry_state='entered'
          and e.eligibility_state='eligible'
          and w.moderation_state='clear'
      )
    );

  if v_result is null then raise exception 'Public media is not accessible'; end if;
  return v_result;
end
$$;
revoke all on function public.community_get_public_media_storage_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function public.community_get_public_media_storage_v2(uuid) to service_role;

-- Owner direct issuer has an existing authenticated owner/moderator/classification
-- contract. Preserve the original implementation and its dependencies as a
-- private, non-callable implementation while gating the original public signature.
-- This transaction is safe for same-schema migration reapplication.
do $owner_issuer141$
begin
 if to_regprocedure('private.community_gallery_owner_media_read_unfenced_r19(uuid,uuid)') is null then
  if to_regprocedure('public.community_gallery_owner_media_read_v1(uuid,uuid)') is null then
   raise exception 'R19_OWNER_MEDIA_ISSUER_SIGNATURE_MISSING';
  end if;
  alter function public.community_gallery_owner_media_read_v1(uuid,uuid)
    rename to community_gallery_owner_media_read_unfenced_r19;
  alter function public.community_gallery_owner_media_read_unfenced_r19(uuid,uuid)
    set schema private;
 end if;
end
$owner_issuer141$;
revoke all on function private.community_gallery_owner_media_read_unfenced_r19(uuid,uuid)
 from public,anon,authenticated,service_role;

create or replace function public.community_gallery_owner_media_read_v1(
 p_auth_subject uuid,
 p_media_id uuid
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $owner_guard141$
begin
 perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id);
 return private.community_gallery_owner_media_read_unfenced_r19(p_auth_subject,p_media_id);
end
$owner_guard141$;
revoke all on function public.community_gallery_owner_media_read_v1(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.community_gallery_owner_media_read_v1(uuid,uuid)
 to service_role;
