create or replace function public.community_gallery_photo_media_preflight_r17(
  p_auth_subject uuid,p_gallery_work_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,extensions
as $r17$
declare
  v_account uuid;
  v_work public.community_works%rowtype;
  v_photo public.gallery_photo_subjects%rowtype;
  v_revisions jsonb:='[]'::jsonb;
  v_media jsonb:='[]'::jsonb;
  v_covers jsonb:='[]'::jsonb;
  v_direct_count bigint:=0;
  v_historical_count bigint:=0;
  v_media_count bigint:=0;
  v_unready_count bigint:=0;
  v_cover_mismatch_count bigint:=0;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  if v_account is null then
    raise exception 'R17_PHOTO_PREFLIGHT_FORBIDDEN';
  end if;
  select * into v_work from public.community_works
    where work_id=p_gallery_work_id and work_type='gallery'
      and owner_account_id=v_account;
  if v_work.work_id is null
     or not exists(
       select 1 from public.creator_profiles c
       where c.creator_profile_id=v_work.creator_profile_id
         and c.owner_account_id=v_account
     )
  then raise exception 'R17_PHOTO_PREFLIGHT_FORBIDDEN';end if;
  select * into v_photo from public.gallery_photo_subjects
    where work_id=v_work.work_id
      and owner_account_id=v_account
      and creator_profile_id=v_work.creator_profile_id;
  if v_photo.work_id is null then
    raise exception 'R17_PHOTO_PREFLIGHT_FORBIDDEN';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'revisionId',r.revision_id,
      'revisionNumber',r.revision_number,
      'isCurrent',r.revision_id=v_work.current_published_revision_id,
      'sealed',r.sealed_at is not null
    ) order by r.revision_number,r.revision_id),'[]'::jsonb)
    into v_revisions
    from public.community_work_revisions r where r.work_id=v_work.work_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'revisionId',r.revision_id,'revisionNumber',r.revision_number,
      'isCurrent',r.revision_id=v_work.current_published_revision_id,
      'mediaId',rm.media_id,'ordinal',rm.ordinal,'role',rm.role,
      'metadataOwnerMatches',coalesce(m.owner_account_id=v_account,false),
      'metadataReady',coalesce(
        m.processing_state='ready' and m.moderation_state='clear'
        and m.purged_at is null and m.byte_size>0
        and m.checksum_sha256 ~ '^[0-9a-f]{64}$',false),
      'declaredSha256',m.checksum_sha256,
      'declaredByteSize',m.byte_size,'declaredMimeType',m.mime_type,
      'alsoOnOtherCurrentPublicWork',exists(
        select 1 from public.work_revision_media other_rm
        join public.community_works other_w
          on other_w.current_published_revision_id=other_rm.work_revision_id
        where other_rm.media_id=rm.media_id
          and other_w.work_id<>v_work.work_id
          and other_w.lifecycle_state='published'
          and other_w.visibility='public'
          and other_w.moderation_state='clear')
    ) order by r.revision_number,rm.ordinal,rm.media_id),'[]'::jsonb),
    count(*),
    count(*) filter(where m.media_id is null
      or m.owner_account_id is distinct from v_account
      or m.processing_state is distinct from 'ready'
      or m.moderation_state is distinct from 'clear'
      or m.purged_at is not null
      or m.byte_size<=0
      or m.checksum_sha256 is null
      or m.checksum_sha256 !~ '^[0-9a-f]{64}$')
    into v_media,v_media_count,v_unready_count
    from public.community_work_revisions r
    join public.work_revision_media rm on rm.work_revision_id=r.revision_id
    left join public.media_assets m on m.media_id=rm.media_id
    where r.work_id=v_work.work_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'revisionId',r.revision_id,'revisionNumber',r.revision_number,
      'isCurrent',r.revision_id=v_work.current_published_revision_id,
      'coverMediaId',f.cover_media_id,'subjectMatches',f.subject_id=v_photo.subject_id,
      'coverInRevisionMedia',exists(
        select 1 from public.work_revision_media rm
        where rm.work_revision_id=r.revision_id
          and rm.media_id=f.cover_media_id),
      'coverFirst',exists(
        select 1 from public.work_revision_media rm
        where rm.work_revision_id=r.revision_id
          and rm.media_id=f.cover_media_id and rm.ordinal=0)
    ) order by r.revision_number,r.revision_id),'[]'::jsonb),
    count(*) filter(where f.subject_id is distinct from v_photo.subject_id
      or not exists(
        select 1 from public.work_revision_media rm
        where rm.work_revision_id=r.revision_id
          and rm.media_id=f.cover_media_id))
    into v_covers,v_cover_mismatch_count
    from public.community_work_revisions r
    join public.gallery_photo_revision_fields f on f.revision_id=r.revision_id
    where r.work_id=v_work.work_id;
  select count(*) into v_direct_count
    from public.preset_artifacts pa
    where pa.associated_gallery_work_id=v_work.work_id;
  select count(*) into v_historical_count
    from public.gallery_revision_presets gp
    join public.community_work_revisions gr
      on gr.revision_id=gp.gallery_revision_id
    where gr.work_id=v_work.work_id;
  return jsonb_build_object(
    'schemaVersion',1,
    'contract','ddv.gallery-photo-media-readonly@r17',
    'workId',v_work.work_id,
    'ownerAccountId',v_account,
    'creatorProfileId',v_work.creator_profile_id,
    'subjectId',v_photo.subject_id,
    'rowVersion',v_work.row_version,
    'currentPublishedRevisionId',v_work.current_published_revision_id,
    'lifecycleState',v_work.lifecycle_state,
    'visibility',v_work.visibility,
    'moderationState',v_work.moderation_state,
    'workRevisions',v_revisions,
    'mediaReferences',v_media,
    'coverReferences',v_covers,
    'knownDependencyCounts',jsonb_build_object(
      'directPresetArtifacts',v_direct_count,
      'historicalGalleryRevisionPresets',v_historical_count,
      'mediaReferences',v_media_count,
      'unreadyOrForeignMediaReferences',v_unready_count,
      'coverSubjectOrReferenceMismatch',v_cover_mismatch_count),
    'sourceStorageState','DATABASE_METADATA_ONLY',
    'actualStorageBytesVerified',false,
    'metadataSha256IsStorageProof',false,
    'priorSignedUrlsRevoked',false,
    'cdnBrowserPurgeProven',false,
    'storageIssuerGraphComplete',false,
    'graphComplete',false,
    'snapshotNotAtomicMutationFence',true,
    'mutationAuthorized',false,
    'saveRevisionAuthorized',false,
    'pairedGalleryPublishAuthorized',false,
    'retirementAuthorized',false,
    'physicalCleanupAuthorized',false,
    'blockedReasons',jsonb_build_array(
      'ACTUAL_STORAGE_BYTES_SHA256_NOT_VERIFIED',
      'PHOTO_COVER_ISSUER_GRAPH_INCOMPLETE',
      'OLD_SIGNED_URL_REPLAY_NOT_PROVEN',
      'HISTORICAL_MEDIA_REFERENCE_CLOSURE_INCOMPLETE',
      'ALL_FACET_WRITER_REGISTRY_INCOMPLETE',
      'PREFLIGHT_NOT_AN_ATOMIC_WRITER_FENCE'
    ) || case when v_direct_count>0 or v_historical_count>0
        then jsonb_build_array('PHOTO_SCENE_DEPENDENCY_NOT_ENROLLED')
        else '[]'::jsonb end
      || case when v_unready_count>0 or v_cover_mismatch_count>0
        then jsonb_build_array('MEDIA_COVER_METADATA_INCONSISTENT')
        else '[]'::jsonb end);
end;$r17$;
revoke all on function public.community_gallery_photo_media_preflight_r17(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.community_gallery_photo_media_preflight_r17(uuid,uuid)
  to service_role;
