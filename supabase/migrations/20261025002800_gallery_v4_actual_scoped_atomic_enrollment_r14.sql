-- 03 COMM R14 Issue #119. Additive Owner Source runtime enrollment, not the
-- 09 INT validation-only Python wrapper and NOT global all-writer acceptance.
-- Existing v4 signature, no new Edge RPC or public positive authority.
-- Scope: Gallery no-Preset publication, or a single linked SCENE preset;
-- every unenumerated preset kind/source fails closed.
create or replace function private.gallery_v4_scoped_graph_r14(
  p_gallery_work_id uuid,p_requested_revisions uuid[]
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $graph$
declare
  v_artifacts uuid[]:=array[]::uuid[];
  v_preset_works uuid[]:=array[]::uuid[];
  v_galleries uuid[]:=array[]::uuid[];
  v_allworks uuid[]:=array[]::uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(distinct artifact_id order by artifact_id),array[]::uuid[])
    into v_artifacts from (
      select pr.preset_artifact_id artifact_id
      from public.preset_revisions pr
      where pr.preset_revision_id=any(p_requested_revisions)
      union
      select pa.preset_artifact_id artifact_id
      from public.preset_artifacts pa
      where pa.associated_gallery_work_id=p_gallery_work_id
      union
      select pr.preset_artifact_id artifact_id
      from public.gallery_revision_presets gp
      join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
      join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id
      where r.work_id=p_gallery_work_id
    ) paths where artifact_id is not null;

  if (select count(distinct r.preset_revision_id)
      from public.preset_revisions r
      where r.preset_revision_id=any(p_requested_revisions))
      <> cardinality(p_requested_revisions) then
    raise exception 'R14_PRESET_REVISION_UNRESOLVED';
  end if;

  select coalesce(array_agg(distinct community_work_id order by community_work_id),array[]::uuid[])
  into v_preset_works
  from public.preset_artifacts
  where preset_artifact_id=any(v_artifacts) and community_work_id is not null;

  select coalesce(array_agg(distinct gallery_work_id order by gallery_work_id),array[]::uuid[])
  into v_galleries
  from (
    select p_gallery_work_id gallery_work_id
    union select pa.associated_gallery_work_id
      from public.preset_artifacts pa
      where pa.preset_artifact_id=any(v_artifacts)
    union select gr.work_id
      from public.gallery_revision_presets gp
      join public.community_work_revisions gr on gr.revision_id=gp.gallery_revision_id
      join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
      where pr.preset_artifact_id=any(v_artifacts)
  ) refs where gallery_work_id is not null;

  select coalesce(array_agg(distinct id order by id),array[]::uuid[])
    into v_allworks
  from (
    select unnest(v_preset_works) as id
    union select unnest(v_galleries) as id
  ) ids;

  v_result:=jsonb_build_object(
    'registry','gallery-scene-scoped@r14',
    'artifactIds',to_jsonb(v_artifacts),
    'presetWorkIds',to_jsonb(v_preset_works),
    'galleryWorkIds',to_jsonb(v_galleries),
    'artifacts',coalesce((select jsonb_agg(to_jsonb(pa) order by pa.preset_artifact_id)
       from public.preset_artifacts pa where pa.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'presetRevisions',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.preset_revision_id)
       from public.preset_revisions pr where pr.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'presetPublications',coalesce((select jsonb_agg(to_jsonb(pp) order by pp.work_revision_id)
       from public.preset_revision_publications pp
       join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
       where pr.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'historicalPresetLinks',coalesce((select jsonb_agg(to_jsonb(gp)
       order by gp.gallery_revision_id,gp.preset_revision_id)
       from public.gallery_revision_presets gp
       join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
       where pr.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'works',coalesce((select jsonb_agg(to_jsonb(w) order by w.work_id)
       from public.community_works w where w.work_id=any(v_allworks)),'[]'::jsonb),
    'workRevisions',coalesce((select jsonb_agg(to_jsonb(r) order by r.revision_id)
       from public.community_work_revisions r where r.work_id=any(v_allworks)),'[]'::jsonb),
    'mediaReferences',coalesce((select jsonb_agg(to_jsonb(rm)
       order by rm.work_revision_id,rm.ordinal)
       from public.work_revision_media rm
       join public.community_work_revisions wr on wr.revision_id=rm.work_revision_id
       where wr.work_id=any(v_galleries)),'[]'::jsonb),
    'coverReferences',coalesce((select jsonb_agg(to_jsonb(cf)
       order by cf.revision_id)
       from public.gallery_photo_revision_fields cf
       join public.community_work_revisions wr on wr.revision_id=cf.revision_id
       where wr.work_id=any(v_galleries)),'[]'::jsonb)
  );
  return v_result;
end;
$graph$;
revoke all on function private.gallery_v4_scoped_graph_r14(uuid,uuid[])
  from public,anon,authenticated,service_role;

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
revoke all on function private.gallery_v4_atomic_lock_scoped_r14(uuid,uuid,uuid,uuid[])
  from public,anon,authenticated,service_role;

-- Existing REAL PUBLIC RPC body, same signature and downstream validation.
create or replace function public.community_publish_gallery_v4(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_title text,
  p_description text,
  p_media_ids uuid[],
  p_preset_revision_ids uuid[] default array[]::uuid[],
  p_used_item_ids bigint[] default array[]::bigint[],
  p_featured_item_ids bigint[] default array[]::bigint[],
  p_moodboard_snapshot_ref text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_gallery_kind text;
  v_revision_id uuid;
  v_revision_number integer;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_media_id uuid;
  v_preset_revision_id uuid;
  v_item_id bigint;
  v_ordinal integer:=0;
  v_media_count integer;
  v_preset_count integer;
  v_used_count integer;
  v_featured_count integer;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  -- R14 ACTUAL writer enrollment: account root precedes every Artifact/Work
  -- and idempotency advisory lock. Any 55P03 aborts the entire RPC.
  perform private.gallery_v4_atomic_lock_scoped_r14(
    p_auth_subject,v_account_id,p_work_id,
    coalesce(p_preset_revision_ids,array[]::uuid[])
  );
  v_media_count:=coalesce(cardinality(p_media_ids),0);
  v_preset_count:=coalesce(cardinality(p_preset_revision_ids),0);
  v_used_count:=coalesce(cardinality(p_used_item_ids),0);
  v_featured_count:=coalesce(cardinality(p_featured_item_ids),0);

  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Gallery title must be 1-240 characters';
  end if;
  if p_description is not null and char_length(p_description)>20000 then
    raise exception 'Gallery description exceeds 20000 characters';
  end if;
  if v_media_count not between 1 and 10 then
    raise exception 'Gallery publication requires 1-10 media assets';
  end if;
  if v_preset_count>1 then
    raise exception 'Gallery publication supports at most one Wand Preset';
  end if;
  if v_used_count>200 then
    raise exception 'Gallery publication supports at most 200 Used Items';
  end if;
  if v_featured_count>20 then
    raise exception 'Gallery publication supports at most 20 Featured Items';
  end if;
  if p_moodboard_snapshot_ref is not null
     and char_length(btrim(p_moodboard_snapshot_ref)) not between 1 and 512 then
    raise exception 'Moodboard snapshot reference must be 1-512 characters';
  end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;

  if (select count(*) from unnest(p_media_ids) x)
     <> (select count(distinct x) from unnest(p_media_ids) x) then
    raise exception 'Gallery media IDs must be unique';
  end if;
  if v_preset_count>0 and
     (select count(*) from unnest(p_preset_revision_ids) x)
     <> (select count(distinct x) from unnest(p_preset_revision_ids) x) then
    raise exception 'Gallery Preset revision IDs must be unique';
  end if;
  if v_used_count>0 and
     (select count(*) from unnest(p_used_item_ids) x)
     <> (select count(distinct x) from unnest(p_used_item_ids) x) then
    raise exception 'Used Item IDs must be unique';
  end if;
  if v_featured_count>0 and
     (select count(*) from unnest(p_featured_item_ids) x)
     <> (select count(distinct x) from unnest(p_featured_item_ids) x) then
    raise exception 'Featured Item IDs must be unique';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_featured_item_ids,array[]::bigint[])) f
    where not (f=any(coalesce(p_used_item_ids,array[]::bigint[])))
  ) then
    raise exception 'Featured Items must be a subset of Used Items';
  end if;
  if exists(select 1 from unnest(coalesce(p_used_item_ids,array[]::bigint[])) x where x<=0) then
    raise exception 'Used Item IDs must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|',
      'publish_gallery_v4',p_work_id::text,p_expected_version::text,btrim(p_title),coalesce(p_description,''),
      array_to_string(p_media_ids,','),
      array_to_string(coalesce(p_preset_revision_ids,array[]::uuid[]),','),
      array_to_string(coalesce(p_used_item_ids,array[]::bigint[]),','),
      array_to_string(coalesce(p_featured_item_ids,array[]::bigint[]),','),
      coalesce(p_moodboard_snapshot_ref,'')
    ),'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works where work_id=p_work_id for update;
  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.work_type<>'gallery' then raise exception 'Work is not Gallery'; end if;
  if v_work.visibility<>'public' then raise exception 'Gallery launch publication must be PUBLIC'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.moderation_state<>'clear' then raise exception 'Work is moderation-blocked'; end if;
  if v_work.lifecycle_state not in ('draft','unpublished') then
    raise exception 'Work cannot be published from current lifecycle';
  end if;

  select gallery_kind into v_gallery_kind
  from public.gallery_works where work_id=p_work_id;
  if v_gallery_kind is null or v_gallery_kind='dreamsnap' then
    raise exception 'Gallery Golden Vertical excludes DreamSnaps';
  end if;

  foreach v_media_id in array p_media_ids loop
    if not exists(
      select 1 from public.media_assets m
      where m.media_id=v_media_id
        and m.owner_account_id=v_account_id
        and m.processing_state='ready'
        and m.moderation_state='clear'
        and m.purged_at is null
    ) then
      raise exception 'Media asset is not owner-controlled and READY';
    end if;
  end loop;

  foreach v_preset_revision_id in array coalesce(p_preset_revision_ids,array[]::uuid[]) loop
    if not exists(
      select 1
      from public.preset_revisions pr
      join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
      join public.community_works pw on pw.work_id=pa.community_work_id
      where pr.preset_revision_id=v_preset_revision_id
        and pa.owner_account_id=v_account_id
        and pw.lifecycle_state='published'
        and pw.visibility in ('public','unlisted')
        and pw.moderation_state='clear'
    ) then raise exception 'Preset revision is not an accessible published owner Preset'; end if;
  end loop;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'publish_gallery_v4',v_request_hash);

  select coalesce(max(revision_number),0)+1 into v_revision_number
  from public.community_work_revisions where work_id=p_work_id;

  v_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_revision_id,p_work_id,v_revision_number,v_account_id,
    jsonb_build_object('origin','gallery-golden-v1')
  );

  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values(
    v_revision_id,btrim(p_title),p_description,
    jsonb_strip_nulls(jsonb_build_object(
      'moodboardSnapshotRef',nullif(btrim(coalesce(p_moodboard_snapshot_ref,'')),''),
      'usedItemCount',v_used_count,
      'featuredItemCount',v_featured_count
    ))
  );

  foreach v_media_id in array p_media_ids loop
    insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values(v_revision_id,v_media_id,v_ordinal,'gallery');
    v_ordinal:=v_ordinal+1;
  end loop;

  foreach v_preset_revision_id in array coalesce(p_preset_revision_ids,array[]::uuid[]) loop
    insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
    values(v_revision_id,v_preset_revision_id);
  end loop;

  foreach v_item_id in array coalesce(p_used_item_ids,array[]::bigint[]) loop
    insert into public.gallery_revision_items(gallery_revision_id,item_id,featured)
    values(
      v_revision_id,v_item_id,
      v_item_id=any(coalesce(p_featured_item_ids,array[]::bigint[]))
    );
  end loop;

  update public.community_works
  set lifecycle_state='published',
      visibility='public',
      current_published_revision_id=v_revision_id,
      published_at=now(),
      updated_at=now()
  where work_id=p_work_id
  returning * into v_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    p_work_id,p_work_id,'gallery',v_work.creator_profile_id,btrim(p_title),coalesce(p_description,''),
    array[]::text[],
    jsonb_build_object('galleryKind',v_gallery_kind,'commentsEnabled',true),
    v_work.published_at,now()
  )
  on conflict(entity_id) do update set
    creator_profile_id=excluded.creator_profile_id,
    title=excluded.title,text_content=excluded.text_content,
    tags=excluded.tags,facets=excluded.facets,
    published_at=excluded.published_at,updated_at=now();

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',p_work_id,'work.published',
    jsonb_build_object(
      'workId',p_work_id,'revisionId',v_revision_id,
      'mediaIds',to_jsonb(p_media_ids),
      'presetRevisionIds',to_jsonb(coalesce(p_preset_revision_ids,array[]::uuid[])),
      'usedItemIds',to_jsonb(coalesce(p_used_item_ids,array[]::bigint[])),
      'featuredItemIds',to_jsonb(coalesce(p_featured_item_ids,array[]::bigint[]))
    ),
    'work.published:' || v_revision_id::text
  );

  v_response:=jsonb_build_object(
    'workId',p_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version,'visibility','public'
  );
  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$;
