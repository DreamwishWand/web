-- 09 INT reviewed Switch v1.25.0 verified subject enrollment, exact Core route audit.
-- Evidence: tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json
-- Git blob: 0140d2e416ecc1601f039e1fb1def277a6808e51
-- 13 exact SceneItemId values (save-local GridIDs / filenames are NOT identities).
-- Two current-profile platform audits agree on location routes; this is NOT
-- a list of public works, user-owned instances, or Preset writer eligibility.
-- Do not extrapolate to the 1.25.3 / schema626 build or other subject types.
do $seed$
declare
  rec record;
  v_existing public.gallery_verified_subjects%rowtype;
begin
  for rec in select * from (values
      ('1540000147','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/0/sceneItemId'),
      ('1540000148','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/1/sceneItemId'),
      ('1540000149','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/2/sceneItemId'),
      ('1540000150','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/3/sceneItemId'),
      ('1540000151','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/4/sceneItemId'),
      ('1540000152','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/5/sceneItemId'),
      ('1540000153','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/6/sceneItemId'),
      ('1540000154','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/7/sceneItemId'),
      ('1540000192','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/8/sceneItemId'),
      ('1540000193','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/9/sceneItemId'),
      ('1540000194','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/10/sceneItemId'),
      ('1540000238','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/11/sceneItemId'),
      ('1540000246','tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/12/sceneItemId')
  ) as verified(scene_item_id,evidence_ref)
  loop
    select * into v_existing from public.gallery_verified_subjects
    where platform='switch' and build_id='52BD625D9B4E0053'
      and subject_type='floating_island'
      and canonical_target_id=rec.scene_item_id
      and base_item_id is null for update;
    if v_existing.subject_id is not null then
      if v_existing.gallery_kind<>'outdoor'
        or v_existing.game_version<>'1.25.0'
        or v_existing.profile_schema<>624
        or v_existing.verification_state<>'verified'
        or v_existing.evidence_ref<>rec.evidence_ref then
        raise exception 'GALLERY_SUBJECT_EXISTING_EVIDENCE_CONFLICT';
      end if;
    else
      insert into public.gallery_verified_subjects(
        gallery_kind,subject_type,canonical_target_id,base_item_id,
        platform,game_version,build_id,profile_schema,
        evidence_ref,verification_state
      ) values(
        'outdoor','floating_island',rec.scene_item_id,null,
        'switch','1.25.0','52BD625D9B4E0053',624,
        rec.evidence_ref,'verified'
      );
    end if;
  end loop;
end $seed$;
