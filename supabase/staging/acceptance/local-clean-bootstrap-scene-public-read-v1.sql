-- 03 COMM PR134: read-only Scene public current revision functional contract.
-- DO NOT run against Staging/Production: synthetic disposable local DB only.
-- No actual Storage bytes/signed JWT/Cloud/legacy paired Scene Writer are claimed.
begin;
do $scene$
declare
  v_auth uuid;
  v_owner uuid;
  v_creator uuid;
  v_pub jsonb;
  v_pvt jsonb;
  v_first jsonb;
  v_next jsonb;
  v_old uuid;
  v_new_revision uuid:=gen_random_uuid();
  v_new_work_revision uuid:=gen_random_uuid();
  v_blob uuid;
  v_bad boolean:=false;
  v_tag text:=gen_random_uuid()::text;
begin
  select ai.provider_subject::uuid, c.owner_account_id, c.creator_profile_id
  into v_auth,v_owner,v_creator
  from public.creator_profiles c
  join public.auth_identities ai on ai.account_id=c.owner_account_id
  where c.handle='isolated_bootstrap_creator' and ai.provider='supabase' limit 1;
  if v_auth is null then raise exception 'LOCAL_SCENE_ACTOR_MISSING';end if;
  update public.creator_profiles set profile_visibility='public',moderation_state='clear'
  where creator_profile_id=v_creator;

  if to_regprocedure('public.community_get_scene_preset_public_v1(uuid)') is null
    or not has_function_privilege('service_role','public.community_get_scene_preset_public_v1(uuid)','EXECUTE')
    or has_function_privilege('anon','public.community_get_scene_preset_public_v1(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.community_get_scene_preset_public_v1(uuid)','EXECUTE')
  then raise exception 'SCENE_PUBLIC_READ_RPC_ACL_INVALID';end if;

  -- The historic lifecycle writers were intentionally NOT restored.
  if to_regprocedure('public.community_delete_scene_preset_v1(uuid,uuid,text)') is not null
    or to_regprocedure('public.community_unpublish_scene_preset_v1(uuid,uuid,text)') is not null
  then raise exception 'UNVERIFIED_SCENE_LIFECYCLE_WRITER_PRESENT';end if;

  v_pub:=public.community_publish_preset_envelope(
    v_auth,v_creator,'public','scene','Synthetic Scene Public',null,
    'ci-only/scene-public-'||v_tag||'.json',
    1,'application/json',321,repeat('c',64),
    jsonb_build_object('fixture','first'),'scene-public:'||v_tag
  );
  if v_pub->>'workId' is null then raise exception 'SCENE_GENERIC_PUBLISH_FAILED';end if;
  -- Same request/key must return the same row, not create another Revision.
  if public.community_publish_preset_envelope(
    v_auth,v_creator,'public','scene','Synthetic Scene Public',null,
    'ci-only/scene-public-'||v_tag||'.json',1,'application/json',321,
    repeat('c',64),jsonb_build_object('fixture','first'),'scene-public:'||v_tag
  )->>'presetRevisionId' is distinct from v_pub->>'presetRevisionId'
  then raise exception 'SCENE_GENERIC_PUBLISH_IDEMPOTENCY_FAILED';end if;

  v_first:=public.community_get_scene_preset_public_v1((v_pub->>'workId')::uuid);
  if (v_first->>'presetRevisionId')::uuid is distinct from (v_pub->>'presetRevisionId')::uuid
    or (v_first->>'workRevisionId')::uuid is distinct from (v_pub->>'workRevisionId')::uuid
    or v_first->>'presetType' is distinct from 'scene'
    or v_first->>'title' is distinct from 'Synthetic Scene Public'
    or v_first->>'schemaVersion' is distinct from '1'
    or v_first->>'galleryWorkId' is not null
    or v_first->>'coverMediaId' is not null
    or v_first->'mediaIds' <> '[]'::jsonb
    or v_first ? 'storageKey'
  then raise exception 'SCENE_PUBLIC_CURRENT_REVISION_CONTRACT_INCORRECT';end if;
  v_old:=(v_pub->>'presetRevisionId')::uuid;

  -- A newer, sealed WorkRevision and PresetRevision must replace the CURRENT
  -- public view. These are synthetic SQL fixture writes rolled back below.
  select artifact_blob_id into v_blob
  from public.preset_revisions where preset_revision_id=v_old;
  insert into public.preset_revisions(
    preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,
    metadata,created_by_account_id
  ) values(
    v_new_revision,(v_pub->>'presetArtifactId')::uuid,2,v_blob,
    jsonb_build_object('fixture','second'),v_owner
  );
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_new_work_revision,(v_pub->>'workId')::uuid,2,v_owner,
    jsonb_build_object('title','Synthetic Scene Revised','description','Second revision')
  );
  insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
  values(v_new_work_revision,v_new_revision);
  update public.community_works
  set current_published_revision_id=v_new_work_revision
  where work_id=(v_pub->>'workId')::uuid;

  v_next:=public.community_get_scene_preset_public_v1((v_pub->>'workId')::uuid);
  if (v_next->>'presetRevisionId')::uuid is distinct from v_new_revision
    or (v_next->>'workRevisionId')::uuid is distinct from v_new_work_revision
    or (v_next->>'presetRevisionNumber')::integer <> 2
    or v_next->>'title' <> 'Synthetic Scene Revised'
    or v_next->'metadata'->>'fixture' <> 'second'
    or (v_next->>'presetRevisionId')::uuid = v_old
  then raise exception 'SCENE_PUBLIC_HISTORY_OR_CURRENT_POINTER_BROKEN';end if;

  v_pvt:=public.community_publish_preset_envelope(
    v_auth,v_creator,'private','scene','Private Scene',null,
    'ci-only/scene-private-'||v_tag||'.json',
    1,'application/json',100,repeat('d',64),
    '{}'::jsonb,'scene-private:'||v_tag
  );
  v_bad:=false;
  begin
    perform public.community_get_scene_preset_public_v1((v_pvt->>'workId')::uuid);
  exception when others then
    if position('Scene Preset is not publicly accessible' in sqlerrm)>0
      then v_bad:=true;
    else raise;end if;
  end;
  if not v_bad then raise exception 'SCENE_PRIVATE_PUBLIC_READ_LEAK';end if;

  -- Public read must fail once the Work leaves discoverability, even though
  -- its immutable historic revision and ArtifactBlob still exist.
  update public.community_works
  set moderation_state='restricted'
  where work_id=(v_pub->>'workId')::uuid;
  v_bad:=false;
  begin
    perform public.community_get_scene_preset_public_v1((v_pub->>'workId')::uuid);
  exception when others then
    if position('Scene Preset is not publicly accessible' in sqlerrm)>0
      then v_bad:=true;
    else raise;end if;
  end;
  if not v_bad then raise exception 'SCENE_HIDDEN_PUBLIC_READ_LEAK';end if;

  raise notice 'LOCAL_SCENE_PUBLIC_CURRENT_REVISION_IDEMPOTENCY_PRIVACY_ROLLBACK_PASS';
end
$scene$;
rollback;
