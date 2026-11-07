-- 09-INT-GALLERY-PHOTO-SUBJECT-AND-RETIREMENT-V1
-- Additive cross-product negative gate over the ONE accepted 03 COMM API.
-- No replacement for community_publish_gallery_photo_v1 or related Edges.
-- This migration must be ordered AFTER PR #108 and MAY precede PR #102.
--
-- Dependent read model is service-only. Missing types are UNKNOWN, not empty.
create or replace function private.gallery_photo_dependency_snapshot_v1(p_gallery_work_id uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,public,private
as $$
declare
  v_gallery public.community_works%rowtype;
  v_historical jsonb:='[]'::jsonb;
  v_associated jsonb:='[]'::jsonb;
  v_scene_deployed boolean:=false;
begin
  select * into v_gallery from public.community_works
  where work_id=p_gallery_work_id and work_type='gallery';
  if v_gallery.work_id is null then
    raise exception 'GALLERY_DEPENDENCY_WORK_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind',pa.preset_type,
    'presetArtifactId',pa.preset_artifact_id,
    'presetRevisionId',pr.preset_revision_id,
    'galleryRevisionId',gp.gallery_revision_id,
    'currentGalleryRevision',gp.gallery_revision_id=v_gallery.current_published_revision_id,
    'presetWorkId',pa.community_work_id,
    'ownerAccountId',pa.owner_account_id,
    'creatorProfileId',pa.creator_profile_id,
    'state',case when gp.gallery_revision_id=v_gallery.current_published_revision_id
      and pw.lifecycle_state='published' and pw.visibility='public'
      and pw.moderation_state='clear' then 'public_active'
      else 'historical_reference' end
  )), '[]'::jsonb)
  into v_historical
  from public.gallery_revision_presets gp
  join public.community_work_revisions gr on gr.revision_id=gp.gallery_revision_id
  join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
  join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
  left join public.community_works pw on pw.work_id=pa.community_work_id
  where gr.work_id=p_gallery_work_id;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='preset_artifacts'
      and column_name='associated_gallery_work_id'
  ) into v_scene_deployed;

  if v_scene_deployed then
    execute $query$
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind',pa.preset_type,
        'presetArtifactId',pa.preset_artifact_id,
        'presetWorkId',pa.community_work_id,
        'ownerAccountId',pa.owner_account_id,
        'creatorProfileId',pa.creator_profile_id,
        'state',case when pw.lifecycle_state='published'
          and pw.visibility='public' and pw.moderation_state='clear'
          then 'public_active' else 'private_retained' end
      )), '[]'::jsonb)
      from public.preset_artifacts pa
      left join public.community_works pw on pw.work_id=pa.community_work_id
      where pa.associated_gallery_work_id=$1
    $query$ into v_associated using p_gallery_work_id;
  end if;

  return jsonb_build_object(
    'contract','ddv.gallery-public-dependency-retirement@1',
    'galleryWorkId',p_gallery_work_id,
    'galleryCurrentRevisionId',v_gallery.current_published_revision_id,
    'galleryOwnerAccountId',v_gallery.owner_account_id,
    'galleryCreatorProfileId',v_gallery.creator_profile_id,
    'linkedPresetRevisionReferences',v_historical,
    'associatedPresetArtifacts',v_associated,
    'coverage',jsonb_build_object(
      'scene',case when v_scene_deployed then 'partial' else 'unknown_not_deployed' end,
      'biome','unknown_not_deployed',
      'floating_island','unknown_not_deployed',
      'tom_furniture','unknown_not_deployed',
      'tom_clothing','unknown_not_deployed',
      'native_listing','unknown_not_deployed'
    ),
    'graphComplete',false,
    'retirementAuthorized',false,
    'issuedSignedUrlRevocationProven',false
  );
end $$;
revoke all on function private.gallery_photo_dependency_snapshot_v1(uuid)
  from public,anon,authenticated;
grant execute on function private.gallery_photo_dependency_snapshot_v1(uuid)
  to service_role;

-- Cannot honestly claim immediate deletion while old Storage signed URLs
-- may remain usable for 300 seconds. Rejected operations roll back atomically.
-- Accepted 03 COMM publish/update and moderator hide/report paths are untouched.
create or replace function private.gallery_photo_issued_url_retirement_gate_v1()
returns trigger language plpgsql
set search_path=pg_catalog,public,private
as $$
begin
  if old.lifecycle_state='published' and old.visibility='public'
    and new.lifecycle_state='deleted'
    and exists(select 1 from public.gallery_photo_subjects p
               where p.work_id=old.work_id) then
    raise exception 'GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN';
  end if;
  return new;
end $$;
drop trigger if exists gallery_photo_issued_url_retirement_gate on public.community_works;
create trigger gallery_photo_issued_url_retirement_gate
  before update on public.community_works for each row
  execute function private.gallery_photo_issued_url_retirement_gate_v1();
revoke all on function private.gallery_photo_issued_url_retirement_gate_v1()
  from public,anon,authenticated,service_role;
