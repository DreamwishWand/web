-- Isolated clean-bootstrap regression: Scene Gallery link is immutable once a
-- PresetRevision exists. Local disposable synthetic identities only.
-- NEVER apply this fixture on a live Staging or Production database.
begin;
do $accept$
declare
 v_auth uuid;
 v_creator uuid;
 v_gallery uuid;
 v_preset uuid;
 v_out jsonb;
 v_denied boolean := false;
 v_tag text := gen_random_uuid()::text;
 v_trigger_count integer;
begin
 select ai.provider_subject::uuid,c.creator_profile_id into v_auth,v_creator
 from public.creator_profiles c
 join public.auth_identities ai on ai.account_id=c.owner_account_id
 where c.handle='isolated_bootstrap_creator'
   and ai.provider='supabase'
 limit 1;
 select gw.work_id into v_gallery from public.gallery_works gw
 join public.community_works w on w.work_id=gw.work_id
 where w.creator_profile_id=v_creator limit 1;
 if v_auth is null or v_creator is null or v_gallery is null
 then raise exception 'LOCAL_SCENE_GUARD_FIXTURE_MISSING';end if;

 select count(*) into v_trigger_count from pg_trigger
 where tgrelid='public.preset_artifacts'::regclass
 and tgname='preset_artifacts_identity_guard'
 and not tgisinternal and tgenabled='O';
 if v_trigger_count<>1 then raise exception 'SCENE_IDENTITY_GUARD_TRIGGER_MISSING';end if;
 if position('associated_gallery_work_id' in pg_get_functiondef(
   'public.guard_preset_artifact_identity()'::regprocedure))=0
 then raise exception 'SCENE_GALLERY_IDENTITY_NOT_GUARDED';end if;
 if has_function_privilege('anon','public.guard_preset_artifact_identity()','EXECUTE')
    or has_function_privilege('authenticated','public.guard_preset_artifact_identity()','EXECUTE')
 then raise exception 'SCENE_GUARD_DIRECT_CLIENT_EXECUTE_EXPOSED';end if;

 v_out:=public.community_publish_preset_envelope(
   v_auth,v_creator,'private','scene','Isolated Guard Regression',null,
   'isolated-bootstrap-only/'||v_tag||'.json',
   1,'application/json',128,repeat('a',64),'{}'::jsonb,
   'isolated-scene-immutability:'||v_tag
 );
 v_preset:=(v_out->>'presetArtifactId')::uuid;
 if v_preset is null or not exists (
  select 1 from public.preset_revisions
  where preset_artifact_id=v_preset
 ) then raise exception 'SYNTHETIC_SCENE_REVISION_MISSING';end if;

 -- The new FK points to a valid synthetic Gallery Work. The rejection MUST
 -- come from the Preset immutable-identity guard, not the FK.
 begin
   update public.preset_artifacts
   set associated_gallery_work_id=v_gallery
   where preset_artifact_id=v_preset;
 exception when others then
   if position('PresetArtifact identity is immutable after first revision' in sqlerrm)>0
   then v_denied:=true;
   else raise;end if;
 end;
 if not v_denied then
   raise exception 'SCENE_GALLERY_ASSOCIATION_MUTATED_AFTER_REVISION';
 end if;
 if exists (
   select 1 from public.preset_artifacts
   where preset_artifact_id=v_preset and associated_gallery_work_id is not null
 ) then raise exception 'REJECTED_SCENE_GALLERY_ASSOCIATION_PERSISTED';end if;
 raise notice 'LOCAL_SCENE_GALLERY_IDENTITY_IMMUTABILITY_ROLLBACK_PASS';
end
$accept$;
rollback;
