-- 09 INT reviewed v1.25.0 Core evidence-only subject enrollment.
-- One real semantic subject, NOT a user Work or Gallery content seed.
-- Canonical target is the exact numeric SceneItemId in the promoted Core
-- ddv.outdoor-location-ref@1 for Floating Island Urban, not its grid ID 760,
-- its GridDataPath, a localized display string, or a screenshot label.
-- Authority: static/ddv/core/world/v1.25/direct-root-editor-document-contract-v125.json
--   representativeProofTarget.locationRef.sceneItemId = 1540000147
--   exact Nintendo Switch v1.25.0 BID 52BD625D9B4E0053 schema624
--   representative location resolution confirmed; no writer permission.
do $seed$
declare v_existing public.gallery_verified_subjects%rowtype;
begin
  select * into v_existing from public.gallery_verified_subjects
  where platform='switch' and build_id='52BD625D9B4E0053'
    and subject_type='floating_island' and canonical_target_id='1540000147'
    and base_item_id is null for update;
  if v_existing.subject_id is not null then
    if v_existing.gallery_kind<>'outdoor'
      or v_existing.verification_state<>'verified'
      or v_existing.evidence_ref<>
         'static/ddv/core/world/v1.25/direct-root-editor-document-contract-v125.json#representativeProofTarget.locationRef'
    then
      raise exception 'GALLERY_SUBJECT_EXISTING_EVIDENCE_CONFLICT';
    end if;
  else
    insert into public.gallery_verified_subjects(
      gallery_kind,subject_type,canonical_target_id,base_item_id,
      platform,game_version,build_id,profile_schema,
      evidence_ref,verification_state
    ) values(
      'outdoor','floating_island','1540000147',null,
      'switch','1.25.0','52BD625D9B4E0053',624,
      'static/ddv/core/world/v1.25/direct-root-editor-document-contract-v125.json#representativeProofTarget.locationRef',
      'verified'
    );
  end if;
end $seed$;
