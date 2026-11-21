-- 09-INT-GALLERY-CROSS-PRODUCT-DEPENDENCY-COVERAGE-V1 / Issue #119
-- Read-only upgrade of PR #113's existing service-only function. No mutations.
-- PR #129 owner-only preflight consumes this unchanged function name/contract.
-- Source version: Nintendo Switch DDV 1.25.0 BID52BD625D9B4E0053 schema624.
-- Never infer a complete dependent registry from zero observed rows.
create or replace function private.gallery_photo_dependency_snapshot_v1(p_gallery_work_id uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,public,private,extensions
as $snapshot$
declare
  w public.community_works%rowtype;
  v_photo record;
  v_has_photo boolean:=false;
  v_version text:='SEMANTICS_UNKNOWN';
  v_revisions jsonb:='[]'::jsonb;
  v_linked jsonb:='[]'::jsonb;
  v_associated jsonb:='[]'::jsonb;
  v_has_association boolean:=false;
  v_mismatch integer:=0;
  v_creator_mismatch integer:=0;
  v_revision_count integer:=0;
  v_current_exists boolean:=false;
  v_public_preset_links integer:=0;
  v_graph jsonb;
  v_hash text;
begin
  select * into w from public.community_works
  where work_id=p_gallery_work_id and work_type='gallery';
  if w.work_id is null then raise exception 'GALLERY_DEPENDENCY_WORK_NOT_FOUND'; end if;

  select count(*)::integer,
    coalesce(bool_or(revision_id=w.current_published_revision_id),false),
    coalesce(jsonb_agg(jsonb_build_object(
      'workRevisionId',revision_id,
      'revisionNumber',revision_number,
      'sealed',sealed_at is not null,
      'current',revision_id=w.current_published_revision_id
    ) order by revision_number,revision_id),'[]'::jsonb)
  into v_revision_count,v_current_exists,v_revisions
  from public.community_work_revisions where work_id=w.work_id;

  select s.subject_id,vs.platform,vs.game_version,vs.build_id,vs.profile_schema,
         vs.verification_state,vs.subject_type
  into v_photo
  from public.gallery_photo_subjects s
  join public.gallery_verified_subjects vs on vs.subject_id=s.subject_id
  where s.work_id=w.work_id;
  v_has_photo:=found;
  if v_has_photo then
    v_version:=case when v_photo.platform='switch' and v_photo.game_version='1.25.0'
      and v_photo.build_id='52BD625D9B4E0053' and v_photo.profile_schema=624
      and v_photo.verification_state='verified' then 'VERIFIED'
      else 'VERSION_UNSUPPORTED' end;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind',pa.preset_type,
    'presetArtifactId',pa.preset_artifact_id,
    'presetRevisionId',pr.preset_revision_id,
    'galleryRevisionId',gp.gallery_revision_id,
    'currentGalleryRevision',gp.gallery_revision_id=w.current_published_revision_id,
    'presetWorkId',pa.community_work_id,
    'ownerAccountId',pa.owner_account_id,
    'creatorProfileId',pa.creator_profile_id,
    'ownerMatchesGallery',pa.owner_account_id=w.owner_account_id,
    'creatorMatchesGallery',pa.creator_profile_id=w.creator_profile_id,
    'dependentCurrentPublished',(
      pw.lifecycle_state='published' and pw.visibility='public'
      and pw.moderation_state='clear'
      and exists (select 1 from public.preset_revision_publications rp
        join public.community_work_revisions pwr on pwr.revision_id=rp.work_revision_id
        where rp.preset_revision_id=pr.preset_revision_id
          and pwr.work_id=pa.community_work_id
          and pwr.revision_id=pw.current_published_revision_id)),
    'state',case when gp.gallery_revision_id=w.current_published_revision_id
      and pw.lifecycle_state='published' and pw.visibility='public'
      and pw.moderation_state='clear'
      and exists (select 1 from public.preset_revision_publications rp
        join public.community_work_revisions pwr on pwr.revision_id=rp.work_revision_id
        where rp.preset_revision_id=pr.preset_revision_id
          and pwr.work_id=pa.community_work_id
          and pwr.revision_id=pw.current_published_revision_id)
      then 'public_active' else 'historical_reference' end
  ) order by gp.gallery_revision_id,pr.preset_revision_id),'[]'::jsonb),
  count(*) filter(where pa.owner_account_id is distinct from w.owner_account_id),
  count(*) filter(where pa.creator_profile_id is distinct from w.creator_profile_id),
  count(*) filter(where gp.gallery_revision_id=w.current_published_revision_id
    and pw.lifecycle_state='published' and pw.visibility='public'
    and pw.moderation_state='clear'
    and exists (select 1 from public.preset_revision_publications rp
      join public.community_work_revisions pwr on pwr.revision_id=rp.work_revision_id
      where rp.preset_revision_id=pr.preset_revision_id
        and pwr.work_id=pa.community_work_id
        and pwr.revision_id=pw.current_published_revision_id))
  into v_linked,v_mismatch,v_creator_mismatch,v_public_preset_links
  from public.gallery_revision_presets gp
  join public.community_work_revisions gr on gr.revision_id=gp.gallery_revision_id
  join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
  join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
  left join public.community_works pw on pw.work_id=pa.community_work_id
  where gr.work_id=w.work_id;

  select exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='preset_artifacts'
      and column_name='associated_gallery_work_id')
  into v_has_association;
  if v_has_association then
    execute $assoc$
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind',pa.preset_type,
        'presetArtifactId',pa.preset_artifact_id,
        'presetWorkId',pa.community_work_id,
        'ownerAccountId',pa.owner_account_id,
        'creatorProfileId',pa.creator_profile_id,
        'ownerMatchesGallery',pa.owner_account_id=$2,
        'creatorMatchesGallery',pa.creator_profile_id=$3,
        'state',case when pw.lifecycle_state='published' and pw.visibility='public'
          and pw.moderation_state='clear' then 'public_active'
          else 'private_retained' end
      ) order by pa.preset_artifact_id),'[]'::jsonb)
      from public.preset_artifacts pa
      left join public.community_works pw on pw.work_id=pa.community_work_id
      where pa.associated_gallery_work_id=$1
    $assoc$ into v_associated using w.work_id,w.owner_account_id,w.creator_profile_id;
  end if;

  v_mismatch:=v_mismatch+coalesce((
    select count(*)::integer from jsonb_array_elements(v_associated) r
    where (r->>'ownerMatchesGallery')::boolean is distinct from true),0);
  v_creator_mismatch:=v_creator_mismatch+coalesce((
    select count(*)::integer from jsonb_array_elements(v_associated) r
    where (r->>'creatorMatchesGallery')::boolean is distinct from true),0);

  v_graph:=jsonb_build_object(
    'galleryWorkId',w.work_id,'ownerAccountId',w.owner_account_id,
    'creatorProfileId',w.creator_profile_id,'rowVersion',w.row_version,
    'currentPublishedRevisionId',w.current_published_revision_id,
    'revisions',v_revisions,'linkedPresetRevisionReferences',v_linked,
    'associatedPresetArtifacts',v_associated);
  v_hash:=encode(extensions.digest(convert_to(v_graph::text,'UTF8'),'sha256'),'hex');

  return jsonb_build_object(
    'contract','ddv.gallery-public-dependency-retirement@1',
    'coverageContract','ddv.gallery-cross-product-coverage@1',
    'galleryWorkId',w.work_id,'galleryCurrentRevisionId',w.current_published_revision_id,
    'galleryOwnerAccountId',w.owner_account_id,'galleryCreatorProfileId',w.creator_profile_id,
    'galleryRowVersion',w.row_version,
    'graphFingerprintSha256',v_hash,
    'snapshotNotAnAtomicMutationFence',true,
    'workRevisions',v_revisions,
    'workRevisionCount',v_revision_count,
    'currentRevisionExists',v_current_exists,
    'sourceVersionState',v_version,
    'linkedPresetRevisionReferences',v_linked,
    'associatedPresetArtifacts',v_associated,
    'activeCurrentGalleryPresetRevisionLinks',v_public_preset_links,
    'ownerMismatchEdgeCount',v_mismatch,
    'creatorMismatchEdgeCount',v_creator_mismatch,
    'relationCoverage',jsonb_build_object(
      'gallery_work_revisions',case when v_revision_count>0 then 'VERIFIED' else 'VERIFIED_EMPTY' end,
      'gallery_revision_presets',case when jsonb_array_length(v_linked)>0 then 'VERIFIED' else 'VERIFIED_EMPTY' end,
      'preset_artifacts_associated_gallery_work_id',case
        when not v_has_association then 'REGISTRY_MISSING'
        when jsonb_array_length(v_associated)>0 then 'VERIFIED'
        else 'VERIFIED_EMPTY' end,
      'preset_revision_publications','VERIFIED',
      'gallery_photo_subject_binding',case when v_has_photo then v_version
        else 'SEMANTICS_UNKNOWN' end,
      'media_and_cover','03_COMM_CLOUD_PRESERVATION_PREFLIGHT',
      'creator_owner','VERIFIED'),
    'coverageClassification',jsonb_build_object(
      'scene','SEMANTICS_UNKNOWN',
      'biome','SEMANTICS_UNKNOWN',
      'floating_island','SEMANTICS_UNKNOWN',
      'tom_furniture','SEMANTICS_UNKNOWN',
      'tom_clothing','SEMANTICS_UNKNOWN',
      'native_listing','REGISTRY_MISSING'),
    -- Preserve PR #113 and PR #129 backward-compatible fields.
    'coverage',jsonb_build_object(
      'scene',case when v_has_association then 'partial' else 'unknown_not_deployed' end,
      'biome','unknown_not_deployed',
      'floating_island','unknown_not_deployed',
      'tom_furniture','unknown_not_deployed',
      'tom_clothing','unknown_not_deployed',
      'native_listing','unknown_not_deployed'),
    'missingDependencySources',jsonb_build_array(
      'NATIVE_IN_GAME_LISTING_REGISTRY_NOT_DEPLOYED',
      'BIOME_FLOATING_ISLAND_TOM_PRESET_PUBLICATION_SEMANTICS_NOT_CLOSED',
      'SCENE_PRESET_COMPLETENESS_NOT_PROVEN',
      'PRODUCT_PUBLIC_DISCOVERY_REUSE_REFERENCES_NOT_FULLY_ENUMERATED'),
    'blockedRetirementReasons',
      jsonb_build_array('GALLERY_DEPENDENCY_GRAPH_INCOMPLETE',
        'GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN',
        'GALLERY_CLOUD_PRIVATE_PRESERVATION_NOT_ACCEPTED')
      ||case when not v_current_exists then jsonb_build_array('GALLERY_CURRENT_REVISION_MISSING')
        else '[]'::jsonb end
      ||case when v_version<>'VERIFIED' then jsonb_build_array('GALLERY_VERSION_OR_PHOTO_SUBJECT_NOT_VERIFIED')
        else '[]'::jsonb end
      ||case when v_mismatch>0 or v_creator_mismatch>0 then
        jsonb_build_array('GALLERY_CROSS_OWNER_DEPENDENCY_REQUIRES_REVIEW')
        else '[]'::jsonb end,
    'graphComplete',false,
    'retirementAuthorized',false,
    'issuedSignedUrlRevocationProven',false
  );
end $snapshot$;
revoke all on function private.gallery_photo_dependency_snapshot_v1(uuid)
  from public,anon,authenticated;
grant execute on function private.gallery_photo_dependency_snapshot_v1(uuid)
  to service_role;
