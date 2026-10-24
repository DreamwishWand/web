-- R14 actual root->Artifact->PresetWork->GalleryWork locks; no public GRANT.
create or replace function private.gallery_v4_atomic_lock_scoped_r14(
  p_auth_subject uuid,p_owner uuid,p_gallery uuid,p_requested uuid[]
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,private
as $atomic$
declare
  v_snapshot jsonb;
  v_after jsonb;
  v_id uuid;
  v_seen uuid;
  v_target public.community_works%rowtype;
  v_kind text;
begin
  -- The account root ALWAYS comes first. Privacy uses FOR UPDATE on same
  -- root but does not acquire Artifact/Work locks or do Cloud cleanup.
  select a.account_id into v_seen
  from public.wand_accounts a
  where a.account_id=p_owner and a.status='active' and a.deleted_at is null
  for share;
  if v_seen is null then raise exception 'R14_ACCOUNT_NOT_ACTIVE'; end if;

  if private.resolve_active_account(p_auth_subject) is distinct from p_owner then
    raise exception 'R14_ACTOR_OR_PRIVACY_STALE';
  end if;

  v_snapshot:=private.gallery_v4_scoped_graph_r14(p_gallery,p_requested);
  if jsonb_array_length(v_snapshot->'artifacts')>1 then
    raise exception 'R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED';
  end if;
  if exists (
    select 1 from public.preset_artifacts pa
    where pa.preset_artifact_id in (
      select value::uuid from jsonb_array_elements_text(v_snapshot->'artifactIds')
    ) and (pa.preset_type<>'scene' or pa.owner_account_id<>p_owner
               or pa.community_work_id is null)
  ) then raise exception 'R14_PRESET_KIND_OR_OWNER_NOT_ENROLLED'; end if;

  for v_id in select value::uuid from jsonb_array_elements_text(v_snapshot->'artifactIds')
     order by value::uuid loop
    select preset_artifact_id into v_seen
    from public.preset_artifacts where preset_artifact_id=v_id for update nowait;
    if v_seen is null then raise exception 'R14_ARTIFACT_ROSTER_CHANGED_RETRY_WHOLE_TRANSACTION'; end if;
  end loop;

  for v_id in select value::uuid from jsonb_array_elements_text(v_snapshot->'presetWorkIds')
     order by value::uuid loop
    select work_id into v_seen from public.community_works
    where work_id=v_id and owner_account_id=p_owner and work_type='preset'
    for update nowait;
    if v_seen is null then raise exception 'R14_PRESET_WORK_OWNER_ROSTER_CHANGED'; end if;
  end loop;

  for v_id in select value::uuid from jsonb_array_elements_text(v_snapshot->'galleryWorkIds')
     order by value::uuid loop
    select work_id into v_seen from public.community_works
    where work_id=v_id and owner_account_id=p_owner and work_type='gallery'
    for update nowait;
    if v_seen is null then raise exception 'R14_GALLERY_WORK_OWNER_ROSTER_CHANGED'; end if;
  end loop;

  v_after:=private.gallery_v4_scoped_graph_r14(p_gallery,p_requested);
  if v_after is distinct from v_snapshot then
    raise exception 'R14_GRAPH_CHANGED_RETRY_WHOLE_TRANSACTION';
  end if;

  select * into v_target from public.community_works where work_id=p_gallery;
  if v_target.work_id is null or v_target.owner_account_id<>p_owner then
    raise exception 'R14_GALLERY_WORK_OWNER_INVALID';
  end if;
  if exists (
    select 1 from public.preset_artifacts pa
    where pa.preset_artifact_id in (
      select value::uuid from jsonb_array_elements_text(v_after->'artifactIds')
    ) and pa.creator_profile_id is distinct from v_target.creator_profile_id
  ) then raise exception 'R14_CREATOR_GRAPH_MISMATCH'; end if;

  -- Reauthorize under root + Artifact + every related Work lock, including
  -- retired identity, current Session revocation via the Edge, and Privacy.
  if private.resolve_active_account(p_auth_subject) is distinct from p_owner then
    raise exception 'R14_ACTOR_OR_PRIVACY_STALE';
  end if;
end;
$atomic$;
