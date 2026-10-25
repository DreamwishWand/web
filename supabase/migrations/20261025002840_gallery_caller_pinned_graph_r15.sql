-- DDVRE 03 COMM R15 SOURCE-ONLY, INERT until signed Staging acceptance.
-- Additive migration, preserve 119 migrations & R12/R13/R14 lock contracts.

-- SHA input is PostgreSQL jsonb canonical text (sorted keys, UUID text, explicit nulls).
-- R14 sorts each array by typed identifier. Version domain-separates all future schemas.
create or replace function private.gallery_r15_canonical_snapshot(
  p_auth_subject uuid,p_work_id uuid,p_requested uuid[]
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $r15$
declare v_account uuid;v_graph jsonb;v_work public.community_works%rowtype;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  if v_account is null then raise exception 'R15_ACTOR_NOT_ACTIVE';end if;
  select * into v_work from public.community_works where work_id=p_work_id;
  if v_work.work_id is null or v_work.owner_account_id<>v_account or v_work.work_type<>'gallery'
  then raise exception 'R15_GALLERY_OWNER_INVALID';end if;
  v_graph:=private.gallery_v4_scoped_graph_r14(p_work_id,coalesce(p_requested,array[]::uuid[]));
  if jsonb_array_length(v_graph->'artifactIds')>1 then
    raise exception 'R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED';end if;
  if exists(select 1 from public.preset_artifacts pa
    where pa.preset_artifact_id in
      (select value::uuid from jsonb_array_elements_text(v_graph->'artifactIds'))
    and (pa.preset_type<>'scene' or pa.owner_account_id<>v_account
      or pa.creator_profile_id is distinct from v_work.creator_profile_id
      or pa.community_work_id is null))
  then raise exception 'R15_UNENROLLED_PRESET_OR_CREATOR';end if;
  if exists(select 1 from public.community_works w
    where w.work_id in (select value::uuid from jsonb_array_elements_text(v_graph->'presetWorkIds'))
      or w.work_id in (select value::uuid from jsonb_array_elements_text(v_graph->'galleryWorkIds'))
    group by w.owner_account_id,w.creator_profile_id
    having w.owner_account_id is distinct from v_account
      or w.creator_profile_id is distinct from v_work.creator_profile_id)
  then raise exception 'R15_CROSS_OWNER_CREATOR_GRAPH';end if;
  -- Include actor authority and root state, not just linked Work records.
  return jsonb_build_object(
    'registryVersion','gallery-scene-scoped@r15',
    'accountId',v_account,'authSubject',p_auth_subject,
    'ownerActive',true,'identityActive',true,
    'galleryWorkId',p_work_id,
    'requestedPresetRevisionIds',to_jsonb(coalesce(p_requested,array[]::uuid[])),
    'graph',v_graph);
end;$r15$;
revoke all on function private.gallery_r15_canonical_snapshot(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;

