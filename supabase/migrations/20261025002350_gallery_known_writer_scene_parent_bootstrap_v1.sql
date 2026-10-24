-- 03 COMM / 09 INT: create the Scene Preset association parent before
-- 20261025002400 Gallery known-reference Writer Fence trigger creation.
-- Historically added to Staging by an out-of-tree Scene Preset migration;
-- confirmed current staging contract: nullable UUID, no default, FK to
-- public.gallery_works(work_id), name specified below.
-- Only DDL parity: no positive Gallery retirement/Cloud/public writer enable.
alter table public.preset_artifacts
 add column if not exists associated_gallery_work_id uuid;

do $bootstrap_fk$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.preset_artifacts'::regclass
      and conname='preset_artifacts_associated_gallery_work_id_fkey'
  ) then
    alter table public.preset_artifacts
      add constraint preset_artifacts_associated_gallery_work_id_fkey
      foreign key (associated_gallery_work_id)
      references public.gallery_works(work_id);
  end if;
end
$bootstrap_fk$;

-- Restore the ACTIVE Staging immutability invariant lost with the historical
-- Scene product migration. Adding the column/FK alone is NOT sufficient:
-- after the first PresetRevision, its Gallery association is identity data.
-- Keep this trigger ordinary SECURITY INVOKER (same as Staging), NOT an
-- authorization route for Gallery retirement / Cloud / native save writes.
create or replace function public.guard_preset_artifact_identity()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $preset_identity$
begin
  if exists (
    select 1 from public.preset_revisions pr
    where pr.preset_artifact_id=old.preset_artifact_id
  ) and (
    new.owner_account_id is distinct from old.owner_account_id
    or new.creator_profile_id is distinct from old.creator_profile_id
    or new.community_work_id is distinct from old.community_work_id
    or new.associated_gallery_work_id is distinct from old.associated_gallery_work_id
    or new.preset_type is distinct from old.preset_type
  ) then
    raise exception 'PresetArtifact identity is immutable after first revision';
  end if;
  return new;
end
$preset_identity$;

-- The original preset_artifacts_identity_guard trigger remains installed.
-- Preserve the existing trigger-function privileges: not a client RPC.
revoke execute on function public.guard_preset_artifact_identity()
  from public,anon,authenticated;


-- Functional parity: service-only read of PUBLIC Scene Preset current revision.
-- This is NOT the legacy paired-Gallery publisher or any lifecycle writer.
-- Canonical generic Presets may have no associated Gallery Work; historic Scene
-- products must validate their current Gallery revision and exact Preset link.
-- Never expose ArtifactBlob.storage_key, raw Media Storage paths, private Work,
-- draft/historical revisions, or stale Gallery cover/media to this projection.
create or replace function public.community_get_scene_preset_public_v1(
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $scene_read$
declare
  v_work public.community_works%rowtype;
  v_preset public.preset_artifacts%rowtype;
  v_preset_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_gallery public.community_works%rowtype;
  v_title text;
  v_description text;
  v_media_ids jsonb:='[]'::jsonb;
  v_cover uuid;
begin
  if p_work_id is null or not private.is_discoverable_work(p_work_id) then
    raise exception 'Scene Preset is not publicly accessible';
  end if;

  select * into v_work from public.community_works
  where work_id=p_work_id and work_type='preset';
  if v_work.work_id is null then
    raise exception 'Scene Preset is not publicly accessible';
  end if;

  select * into v_preset from public.preset_artifacts
  where community_work_id=v_work.work_id and preset_type='scene'
    and owner_account_id=v_work.owner_account_id
    and creator_profile_id=v_work.creator_profile_id;
  if v_preset.preset_artifact_id is null then
    raise exception 'Scene Preset publication relationship is unavailable';
  end if;

  select pr.* into v_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id
    and pr.preset_artifact_id=v_preset.preset_artifact_id;
  if v_preset_revision.preset_revision_id is null then
    raise exception 'Published Scene Preset revision is unavailable';
  end if;

  select * into v_blob from public.artifact_blobs
  where blob_id=v_preset_revision.artifact_blob_id and purged_at is null;
  if v_blob.blob_id is null then
    raise exception 'Published Scene Preset ArtifactBlob is unavailable';
  end if;

  select r.shared_metadata->>'title',r.shared_metadata->>'description'
  into v_title,v_description
  from public.community_work_revisions r
  where r.revision_id=v_work.current_published_revision_id
    and r.work_id=v_work.work_id;
  if not found then
    raise exception 'Published Scene Preset WorkRevision is unavailable';
  end if;

  if v_preset.associated_gallery_work_id is not null then
    if not private.is_discoverable_work(v_preset.associated_gallery_work_id) then
      raise exception 'Associated Gallery Work is not publicly accessible';
    end if;
    select * into v_gallery from public.community_works
    where work_id=v_preset.associated_gallery_work_id and work_type='gallery'
      and owner_account_id=v_preset.owner_account_id
      and creator_profile_id=v_preset.creator_profile_id;
    if v_gallery.work_id is null or not exists (
      select 1 from public.gallery_revision_presets gp
      where gp.gallery_revision_id=v_gallery.current_published_revision_id
        and gp.preset_revision_id=v_preset_revision.preset_revision_id
    ) then
      raise exception 'Associated Gallery current revision is not linked to Scene Preset';
    end if;

    -- Reject incomplete READY/CLEAR Gallery media rather than exposing mixed
    -- revision data or a stale/historical cover reference.
    if exists (
      select 1 from public.work_revision_media wrm
      left join public.media_assets m on m.media_id=wrm.media_id
      where wrm.work_revision_id=v_gallery.current_published_revision_id
        and (m.media_id is null or m.processing_state<>'ready'
          or m.moderation_state<>'clear' or m.purged_at is not null)
    ) then raise exception 'Associated Gallery media is not publicly ready'; end if;

    select coalesce(jsonb_agg(wrm.media_id order by wrm.ordinal),'[]'::jsonb)
    into v_media_ids from public.work_revision_media wrm
    where wrm.work_revision_id=v_gallery.current_published_revision_id;

    select f.cover_media_id into v_cover
    from public.gallery_photo_revision_fields f
    join public.media_assets m on m.media_id=f.cover_media_id
    where f.revision_id=v_gallery.current_published_revision_id
      and m.processing_state='ready' and m.moderation_state='clear' and m.purged_at is null;

    if exists (
      select 1 from public.gallery_photo_revision_fields f
      where f.revision_id=v_gallery.current_published_revision_id
    ) and v_cover is null then
      raise exception 'Associated Gallery current cover is not publicly ready';
    end if;
  end if;

  return jsonb_build_object(
    'workId',v_work.work_id,
    'workRevisionId',v_work.current_published_revision_id,
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_preset_revision.preset_revision_id,
    'presetRevisionNumber',v_preset_revision.revision_number,
    'presetType','scene',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'title',v_title,
    'description',v_description,
    'metadata',v_preset_revision.metadata,
    'schemaVersion',v_blob.schema_version,
    'byteSize',v_blob.byte_size,
    'checksumSha256',v_blob.checksum_sha256,
    'galleryWorkId',v_gallery.work_id,
    'galleryWorkRevisionId',v_gallery.current_published_revision_id,
    'mediaIds',v_media_ids,
    'coverMediaId',v_cover,
    'publishedAt',v_work.published_at
  );
end
$scene_read$;

revoke all on function public.community_get_scene_preset_public_v1(uuid)
  from public,anon,authenticated;
grant execute on function public.community_get_scene_preset_public_v1(uuid)
  to service_role;


-- 03 COMM #119 R5 fail-closed OWNER-ONLY gap containment.
-- 09 INT R6 is a synthetic candidate, NOT an approved global lock contract.
-- Generic owner transitions on Preset Works are disabled for all five Wand
-- Preset facets, avoiding false confidence in incomplete Gallery backlinks.
-- This is intentionally limited to owner RPCs; native moderator response and
-- privacy account tombstoning MUST remain operative. Direct database writers
-- and other Gallery mutations are NOT globally fenced by this addition.
-- Do not treat this as authorizing positive Gallery Retirement/Cloud/TTL.
create or replace function public.community_change_work_visibility(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_visibility text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_title text;
  v_description text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash := encode(digest(
    concat_ws('|','change_work_visibility',p_work_id::text,p_expected_version::text,p_visibility),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;

  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state='deleted' then raise exception 'Deleted work cannot change visibility'; end if;

  -- Fail closed for ALL Wand Preset types: the canonical Gallery/Preset
  -- all-writer graph+ordered transaction protocol is NOT accepted.
  -- This blocks ONLY generic owner lifecycle/visibility RPCs; moderation
  -- and account erasure use separate verified authority routes.
  -- Keep the check BEFORE idempotency insertion/outbox/work mutation.
  if v_work.work_type='preset' then
    raise exception 'PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED';
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'change_work_visibility',v_request_hash);

  update public.community_works
  set visibility=p_visibility::visibility_state
  where work_id=p_work_id
  returning * into v_work;

  if v_work.lifecycle_state='published'
     and v_work.visibility='public'
     and v_work.moderation_state='clear' then
    if v_work.work_type='gallery' then
      select title,description into v_title,v_description
      from public.gallery_work_revisions
      where revision_id=v_work.current_published_revision_id;
    else
      select
        shared_metadata->>'title',
        shared_metadata->>'description'
      into v_title,v_description
      from public.community_work_revisions
      where revision_id=v_work.current_published_revision_id;
    end if;

    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at
    ) values (
      v_work.work_id,v_work.work_id,v_work.work_type,v_work.creator_profile_id,
      coalesce(v_title,''),coalesce(v_description,''),coalesce(v_work.published_at,now()),now()
    )
    on conflict (entity_id) do update set
      work_type=excluded.work_type,
      creator_profile_id=excluded.creator_profile_id,
      title=excluded.title,
      text_content=excluded.text_content,
      published_at=excluded.published_at,
      updated_at=now();
  else
    delete from public.search_documents where entity_id=p_work_id;
  end if;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',p_work_id,'work.visibility_changed',
    jsonb_build_object('workId',p_work_id,'visibility',v_work.visibility),
    'work.visibility_changed:' || p_work_id::text || ':' || v_work.row_version::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,'visibility',v_work.visibility,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$$;


create or replace function public.community_unpublish_work(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash := encode(digest(
    concat_ws('|','unpublish_work',p_work_id::text,p_expected_version::text),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;

  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state<>'published' then raise exception 'Only published work can be unpublished'; end if;

  -- Fail closed for ALL Wand Preset types: the canonical Gallery/Preset
  -- all-writer graph+ordered transaction protocol is NOT accepted.
  -- This blocks ONLY generic owner lifecycle/visibility RPCs; moderation
  -- and account erasure use separate verified authority routes.
  -- Keep the check BEFORE idempotency insertion/outbox/work mutation.
  if v_work.work_type='preset' then
    raise exception 'PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED';
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'unpublish_work',v_request_hash);

  update public.community_works
  set lifecycle_state='unpublished'
  where work_id=p_work_id
  returning * into v_work;

  delete from public.search_documents where entity_id=p_work_id;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',p_work_id,'work.unpublished',
    jsonb_build_object('workId',p_work_id),
    'work.unpublished:' || p_work_id::text || ':' || v_work.row_version::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,'lifecycleState',v_work.lifecycle_state,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$$;


create or replace function public.community_delete_work(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash := encode(digest(
    concat_ws('|','delete_work',p_work_id::text,p_expected_version::text),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;

  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state='deleted' then raise exception 'Work is already deleted'; end if;

  -- Fail closed for ALL Wand Preset types: the canonical Gallery/Preset
  -- all-writer graph+ordered transaction protocol is NOT accepted.
  -- This blocks ONLY generic owner lifecycle/visibility RPCs; moderation
  -- and account erasure use separate verified authority routes.
  -- Keep the check BEFORE idempotency insertion/outbox/work mutation.
  if v_work.work_type='preset' then
    raise exception 'PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED';
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'delete_work',v_request_hash);

  update public.community_works
  set lifecycle_state='deleted'
  where work_id=p_work_id
  returning * into v_work;

  update public.community_entities
  set deleted_at=coalesce(deleted_at,now())
  where entity_id=p_work_id;

  delete from public.search_documents where entity_id=p_work_id;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',p_work_id,'work.deleted',
    jsonb_build_object('workId',p_work_id),
    'work.deleted:' || p_work_id::text || ':' || v_work.row_version::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,'lifecycleState',v_work.lifecycle_state,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$$;


revoke execute on function public.community_change_work_visibility(uuid,uuid,bigint,text,text)
  from public,anon,authenticated;
revoke execute on function public.community_unpublish_work(uuid,uuid,bigint,text)
  from public,anon,authenticated;
revoke execute on function public.community_delete_work(uuid,uuid,bigint,text)
  from public,anon,authenticated;
grant execute on function public.community_change_work_visibility(uuid,uuid,bigint,text,text)
  to service_role;
grant execute on function public.community_unpublish_work(uuid,uuid,bigint,text)
  to service_role;
grant execute on function public.community_delete_work(uuid,uuid,bigint,text)
  to service_role;


-- 03 COMM / 09 INT R6: OWNER-ONLY, READ-ONLY Scene revision readiness.
-- This observes both historical GalleryRevisionPreset links and the immutable
-- Gallery association field; it never mutates a revision, locks a graph or
-- authorizes a lifecycle writer. A graph fingerprint is advisory, NOT a fence.
create or replace function public.community_scene_revision_readiness_v1(
  p_auth_subject uuid,
  p_preset_artifact_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,extensions
as $scene_readiness$
declare
  v_owner uuid;
  v_artifact public.preset_artifacts%rowtype;
  v_work public.community_works%rowtype;
  v_owned_gallery public.community_works%rowtype;
  v_revision_count integer:=0;
  v_latest_revision integer:=0;
  v_current_preset_revision uuid;
  v_current_blob public.artifact_blobs%rowtype;
  v_assoc_ids uuid[]:=array[]::uuid[];
  v_link_ids uuid[]:=array[]::uuid[];
  v_all_ids uuid[]:=array[]::uuid[];
  v_cross_owner integer:=0;
  v_referenced_unknown integer:=0;
  v_current_gallery_matches integer:=0;
  v_ref_hash text;
  v_scoped_edges text[];
  v_scoped_edge_sha256 text;
  v_blocked jsonb;
begin
  v_owner:=private.resolve_active_account(p_auth_subject);
  if p_preset_artifact_id is null then
    raise exception 'SCENE_REVISION_NOT_OWNER_OR_UNAVAILABLE';
  end if;
  select * into v_artifact
  from public.preset_artifacts
  where preset_artifact_id=p_preset_artifact_id
    and preset_type='scene'
    and owner_account_id=v_owner;
  if v_artifact.preset_artifact_id is null then
    raise exception 'SCENE_REVISION_NOT_OWNER_OR_UNAVAILABLE';
  end if;
  select * into v_work from public.community_works
  where work_id=v_artifact.community_work_id
    and owner_account_id=v_owner
    and creator_profile_id=v_artifact.creator_profile_id
    and work_type='preset';
  if v_work.work_id is null then
    raise exception 'SCENE_REVISION_NOT_OWNER_OR_UNAVAILABLE';
  end if;

  select count(*)::integer,coalesce(max(pr.revision_number),0)::integer
  into v_revision_count,v_latest_revision
  from public.preset_revisions pr
  where pr.preset_artifact_id=v_artifact.preset_artifact_id;

  select pr.preset_revision_id into v_current_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id
    and pr.preset_artifact_id=v_artifact.preset_artifact_id;

  select b.* into v_current_blob
  from public.preset_revisions pr
  join public.artifact_blobs b on b.blob_id=pr.artifact_blob_id
  where pr.preset_revision_id=v_current_preset_revision and b.purged_at is null;

  select coalesce(array_agg(distinct x.gallery_id order by x.gallery_id),array[]::uuid[])
  into v_link_ids
  from (
    select cwr.work_id as gallery_id
    from public.gallery_revision_presets grp
    join public.community_work_revisions cwr
      on cwr.revision_id=grp.gallery_revision_id
    join public.preset_revisions pr
      on pr.preset_revision_id=grp.preset_revision_id
    where pr.preset_artifact_id=v_artifact.preset_artifact_id
  ) x;

  if v_artifact.associated_gallery_work_id is not null then
    v_assoc_ids:=array[v_artifact.associated_gallery_work_id];
  end if;
  select coalesce(array_agg(distinct x.id order by x.id),array[]::uuid[])
  into v_all_ids from (
    select unnest(v_assoc_ids) as id
    union all
    select unnest(v_link_ids) as id
  ) x;

  -- A link to another account or a missing/non-Gallery Work is not treated
  -- as a safe empty dependency set; do not return foreign Work identifiers.
  select count(*) filter (
     where gw.work_id is not null
       and gw.owner_account_id=v_owner
       and gw.creator_profile_id=v_artifact.creator_profile_id
       and gw.work_type='gallery'
    )::integer,
    count(*) filter (
     where gw.work_id is null
       or gw.owner_account_id is distinct from v_owner
       or gw.creator_profile_id is distinct from v_artifact.creator_profile_id
       or gw.work_type is distinct from 'gallery'
    )::integer
  into v_current_gallery_matches,v_cross_owner
  from unnest(v_all_ids) x(id)
  left join public.community_works gw on gw.work_id=x.id;

  select count(*)::integer into v_referenced_unknown
  from public.gallery_revision_presets grp
  join public.community_work_revisions cwr
    on cwr.revision_id=grp.gallery_revision_id
  join public.preset_revisions pr
    on pr.preset_revision_id=grp.preset_revision_id
  where pr.preset_artifact_id=v_artifact.preset_artifact_id
    and not exists(
      select 1 from public.gallery_works g where g.work_id=cwr.work_id
    );

  -- Owner-scoped paired Gallery version hints, deliberately NONATOMIC.
  -- Never expose a foreign or unresolved associated Gallery Work ID/version.
  -- Even a valid owner snapshot MUST be re-read under the global writer locks
  -- before any future Save Revision or paired publication command.
  if v_artifact.associated_gallery_work_id is not null
    and v_cross_owner=0 and v_referenced_unknown=0
    and cardinality(v_all_ids)=1
    and v_all_ids[1]=v_artifact.associated_gallery_work_id
  then
    select * into v_owned_gallery from public.community_works
    where work_id=v_artifact.associated_gallery_work_id
      and owner_account_id=v_owner
      and creator_profile_id=v_artifact.creator_profile_id
      and work_type='gallery';
  end if;

  -- A versioned Scene-scoped history digest for future caller authorization.
  -- This owner-only read is NONATOMIC and cannot enable any positive writer.
  select coalesce(array_agg(e.edge order by e.edge),array[]::text[])
    into v_scoped_edges
  from (
    select distinct gp.gallery_revision_id::text||'/'||
      gp.preset_revision_id::text as edge
    from public.gallery_revision_presets gp
    join public.preset_revisions pr
      on pr.preset_revision_id=gp.preset_revision_id
    where pr.preset_artifact_id=v_artifact.preset_artifact_id
  ) e;
  v_scoped_edge_sha256:=encode(extensions.digest(convert_to(
    'scene-historical-edges-v1|'||v_artifact.preset_artifact_id::text||
    '|'||coalesce(v_artifact.associated_gallery_work_id::text,'')||
    '|'||array_to_string(v_scoped_edges,'|'),'UTF8'),'sha256'),'hex');

  -- Stable fingerprint is useful for human comparison, but does NOT
  -- replace transaction locks or under-lock recomputation.
  v_ref_hash:=encode(extensions.digest(
    convert_to(concat_ws('|',v_artifact.preset_artifact_id::text,
      v_artifact.community_work_id::text,v_work.row_version::text,
      coalesce(v_current_preset_revision::text,''),
      v_latest_revision::text,
      array_to_string(v_all_ids,',')),
    'UTF8'),'sha256'),'hex');

  v_blocked:=jsonb_build_array(
    'SCENE_REVISION_ATOMIC_WRITER_NOT_APPROVED',
    'GALLERY_ALL_WRITER_LOCK_PROTOCOL_UNVERIFIED',
    'SCENE_PAIRED_MEDIA_COVER_PUBLICATION_NOT_ACCEPTED',
    'SCENE_STORAGE_ROLLBACK_AND_RETRY_NOT_ACCEPTED'
  );
  if v_cross_owner>0 or v_referenced_unknown>0 then
    v_blocked:=v_blocked||jsonb_build_array(
      'SCENE_REFERENCE_IDENTITY_CONFLICT'
    );
  end if;
  if v_revision_count=0 then
    v_blocked:=v_blocked||jsonb_build_array(
      'SCENE_NO_REVISION'
    );
  end if;
  if v_current_preset_revision is null or v_current_blob.blob_id is null then
    v_blocked:=v_blocked||jsonb_build_array(
      'SCENE_CURRENT_ARTIFACT_UNAVAILABLE'
    );
  end if;

  return jsonb_build_object(
    'contract','ddv.scene-revision-readiness@1',
    'presetArtifactId',v_artifact.preset_artifact_id,
    'presetWorkId',v_work.work_id,
    'presetType',v_artifact.preset_type,
    'ownerEligible',true,
    'workRowVersion',v_work.row_version,
    'lifecycleState',v_work.lifecycle_state,
    'visibility',v_work.visibility,
    'currentPresetRevisionId',v_current_preset_revision,
    'revisionCount',v_revision_count,
    'latestRevisionNumber',v_latest_revision,
    'currentArtifactAvailable',v_current_blob.blob_id is not null,
    'hasAssociatedGallery',v_artifact.associated_gallery_work_id is not null,
    'pairedGalleryWorkId',v_owned_gallery.work_id,
    'pairedGalleryWorkRowVersion',v_owned_gallery.row_version,
    'pairedGalleryCurrentWorkRevisionId',
      v_owned_gallery.current_published_revision_id,
    'pairedGallerySnapshotIsAtomicFence',false,
    'knownHistoricalGalleryCount',cardinality(v_link_ids),
    'knownGalleryReferenceCount',cardinality(v_all_ids),
    'crossOwnerOrUnresolvedGalleryCount',v_cross_owner+v_referenced_unknown,
    'dependencyFingerprintSha256',v_ref_hash,
    'dependencyFingerprintIsAtomicFence',false,
    'historicalEdgeSetScope','scene-historical-edges-v1',
    'historicalEdgeSetSha256',v_scoped_edge_sha256,
    'historicalEdgeSetIsAtomicFence',false,
    'graphComplete',false,
    'saveRevisionAuthorized',false,
    'pairedGalleryPublishAuthorized',false,
    'unpublishAuthorized',false,
    'deleteAuthorized',false,
    'restoreAuthorized',false,
    'blockedReasons',v_blocked
  );
end
$scene_readiness$;

revoke all on function public.community_scene_revision_readiness_v1(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.community_scene_revision_readiness_v1(uuid,uuid)
  to service_role;


-- 03 COMM / Scene existing-revision + paired Gallery Media transaction candidate.
-- INERT in all deployed roles: NO service_role/anon/authenticated EXECUTE.
-- Invocable only by the database owner in ISOLATED regression fixtures.
-- R6/R7 global Writer Registry / inverse-lock paths and real signed Storage
-- bytes remain unaccepted; do NOT grant this RPC to an Edge/API role.
create or replace function private.scene_save_revision_paired_candidate_v1(
  p_auth_subject uuid,
  p_preset_artifact_id uuid,
  p_expected_preset_revision_id uuid,
  p_expected_preset_work_version bigint,
  p_expected_gallery_work_version bigint,
  p_artifact_blob_id uuid,
  p_media_ids uuid[],
  p_cover_media_id uuid,
  p_title text,
  p_description text,
  p_metadata jsonb,
  p_idempotency_key text,
  p_expected_historical_edge_set_sha256 text,
  p_expected_gallery_work_id uuid,
  p_expected_gallery_current_work_revision_id uuid,
  p_expected_creator_profile_id uuid,
  p_expected_artifact_checksum_sha256 text,
  p_expected_artifact_byte_size bigint
) returns jsonb language plpgsql
set search_path=pg_catalog,public,private,extensions
as $paired_scene_candidate$
declare
  v_account uuid;
  v_artifact public.preset_artifacts%rowtype;
  v_preset_work public.community_works%rowtype;
  v_gallery public.community_works%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_gallery_subject public.gallery_photo_subjects%rowtype;
  v_current_preset_revision uuid;
  v_current_links uuid[];
  v_backlinks_before text[];
  v_backlinks_locked text[];
  v_assoc uuid;
  v_gallery_ids uuid[];
  v_media uuid;
  v_media_row public.media_assets%rowtype;
  v_count int;
  v_response jsonb;
  v_hash text;
  v_existing_hash text;
  v_preset_revision_id uuid:=gen_random_uuid();
  v_preset_work_revision_id uuid:=gen_random_uuid();
  v_gallery_work_revision_id uuid:=gen_random_uuid();
  v_revision_number integer;
  v_preset_work_revision_number integer;
  v_gallery_work_revision_number integer;
  v_position integer;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  if coalesce(length(p_idempotency_key),0) not between 1 and 160 then
    raise exception 'SCENE_REVISION_IDEMPOTENCY_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('paired-scene:'||v_account::text||':'||p_idempotency_key,0));
  v_hash:=encode(extensions.digest(convert_to(
    jsonb_build_object('command','scene_save_revision_paired_candidate_v1',
      'artifact',p_preset_artifact_id,'expectedRevision',p_expected_preset_revision_id,
      'expectedPresetVersion',p_expected_preset_work_version,
      'expectedGalleryVersion',p_expected_gallery_work_version,
      'blob',p_artifact_blob_id,'media',to_jsonb(p_media_ids),
      'cover',p_cover_media_id,'title',p_title,'description',p_description,
      'metadata',coalesce(p_metadata,'{}'::jsonb),
      'historicalEdgePin',p_expected_historical_edge_set_sha256,
      'expectedGalleryWork',p_expected_gallery_work_id,
      'expectedGalleryCurrentRevision',p_expected_gallery_current_work_revision_id,
      'expectedCreator',p_expected_creator_profile_id,
      'expectedArtifactSha256',p_expected_artifact_checksum_sha256,
      'expectedArtifactBytes',p_expected_artifact_byte_size)::text,
      'UTF8'),'sha256'),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account and idempotency_key=p_idempotency_key;
  if found then
    if v_existing_hash is distinct from v_hash or v_response is null then
      raise exception 'SCENE_REVISION_IDEMPOTENCY_CONFLICT';
    end if;
    return v_response;
  end if;
  if p_expected_preset_revision_id is null
    or p_expected_preset_work_version is null
    or p_expected_gallery_work_version is null
    or p_artifact_blob_id is null
    or p_expected_historical_edge_set_sha256 is null
    or p_expected_historical_edge_set_sha256 !~ '^[0-9a-f]{64}$'
    or p_expected_gallery_work_id is null
    or p_expected_gallery_current_work_revision_id is null
    or p_expected_creator_profile_id is null
    or p_expected_artifact_checksum_sha256 is null
    or p_expected_artifact_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or p_expected_artifact_byte_size not between 1 and 26214400
    or p_preset_artifact_id is null
    or p_title is null or length(btrim(p_title)) not between 1 and 160
  then raise exception 'SCENE_REVISION_REQUIRED_FIELDS';end if;

  -- Provisional identities are read WITHOUT locking; recheck after acquiring
  -- Artifact -> PresetWork -> GalleryWork locks in that exact class order.
  select * into v_artifact from public.preset_artifacts
  where preset_artifact_id=p_preset_artifact_id
    and owner_account_id=v_account and preset_type='scene';
  if v_artifact.preset_artifact_id is null
    or v_artifact.associated_gallery_work_id is null
  then raise exception 'SCENE_REVISION_PAIRED_RELATION_REQUIRED';end if;
  v_assoc:=v_artifact.associated_gallery_work_id;

  -- Existing immutable Gallery revision references can point at older Works.
  -- This limited writer accepts exactly ONE existing Gallery Work across ALL
  -- historical and direct edges; unknown extra edges make it fail closed.
  select coalesce(array_agg(distinct x.gallery_id order by x.gallery_id),
                  array[]::uuid[]) into v_gallery_ids
  from (
    select v_assoc as gallery_id
    union all
    select wr.work_id
    from public.gallery_revision_presets gp
    join public.community_work_revisions wr
      on wr.revision_id=gp.gallery_revision_id
    join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
    where pr.preset_artifact_id=p_preset_artifact_id
  ) x;
  if cardinality(v_gallery_ids)<>1 or v_gallery_ids[1]<>v_assoc then
    raise exception 'SCENE_REVISION_MULTIPLE_GALLERY_BACKLINKS_UNSUPPORTED';
  end if;

  -- A distinct Gallery Work ID set cannot detect links added to a DIFFERENT
  -- revision of the SAME Gallery while waiting to acquire our Work locks.
  -- Record each immutable revision edge; compare again under those locks.
  -- This is a bounded candidate check, NOT a substitute for the R7 global
  -- all-writer graph registry or a caller-pinned atomic dependency fingerprint.
  select coalesce(array_agg(e.edge order by e.edge),array[]::text[])
    into v_backlinks_before
  from (
    select distinct gp.gallery_revision_id::text||'/'||
      gp.preset_revision_id::text as edge
    from public.gallery_revision_presets gp
    join public.preset_revisions pr
      on pr.preset_revision_id=gp.preset_revision_id
    where pr.preset_artifact_id=p_preset_artifact_id
  ) e;

  select * into v_artifact from public.preset_artifacts
    where preset_artifact_id=p_preset_artifact_id for update;
  if v_artifact.owner_account_id is distinct from v_account
    or v_artifact.preset_type<>'scene'
    or v_artifact.associated_gallery_work_id is distinct from v_assoc
    or v_artifact.associated_gallery_work_id is distinct from p_expected_gallery_work_id
    or v_artifact.creator_profile_id is distinct from p_expected_creator_profile_id
  then raise exception 'SCENE_REVISION_GRAPH_CHANGED';end if;
  select * into v_preset_work from public.community_works
    where work_id=v_artifact.community_work_id for update;
  select * into v_gallery from public.community_works
    where work_id=v_assoc for update;

  if v_preset_work.work_id is null or v_gallery.work_id is null
    or v_preset_work.work_type<>'preset' or v_gallery.work_type<>'gallery'
    or v_preset_work.owner_account_id is distinct from v_account
    or v_gallery.owner_account_id is distinct from v_account
    or v_preset_work.creator_profile_id is distinct from v_artifact.creator_profile_id
    or v_gallery.creator_profile_id is distinct from v_artifact.creator_profile_id
  then raise exception 'SCENE_REVISION_OWNERSHIP_GRAPH_INVALID';end if;
  if v_preset_work.row_version is distinct from p_expected_preset_work_version
    or v_gallery.row_version is distinct from p_expected_gallery_work_version
  then raise exception 'SCENE_REVISION_ROW_VERSION_CONFLICT';end if;
  -- Two Work versions alone do not prove the immutable current Gallery
  -- pointer is still the version whose Cover/Media the owner previewed.
  -- The identity is recomputed from locked DB rows, NEVER client authority.
  if v_gallery.current_published_revision_id is distinct from
      p_expected_gallery_current_work_revision_id
  then raise exception 'SCENE_REVISION_GALLERY_CURRENT_REVISION_STALE';end if;
  if v_preset_work.lifecycle_state<>'published'
    or v_gallery.lifecycle_state<>'published'
    or v_preset_work.visibility<>'public' or v_gallery.visibility<>'public'
    or v_preset_work.moderation_state<>'clear'
    or v_gallery.moderation_state<>'clear'
    or not private.is_discoverable_work(v_preset_work.work_id)
    or not private.is_discoverable_work(v_gallery.work_id)
  then raise exception 'SCENE_REVISION_PUBLIC_PAIR_REQUIRED';end if;

  -- Recheck the EXACT historical revision-edge set, not merely Gallery
  -- Work IDs: two revisions of one Gallery share the same Work ID.
  select coalesce(array_agg(e.edge order by e.edge),array[]::text[])
    into v_backlinks_locked
  from (
    select distinct gp.gallery_revision_id::text||'/'||
      gp.preset_revision_id::text as edge
    from public.gallery_revision_presets gp
    join public.preset_revisions pr
      on pr.preset_revision_id=gp.preset_revision_id
    where pr.preset_artifact_id=p_preset_artifact_id
  ) e;
  if v_backlinks_locked is distinct from v_backlinks_before then
    raise exception 'SCENE_REVISION_BACKLINK_SNAPSHOT_CHANGED';
  end if;

  -- Caller-pinned scoped history: a committed same-Gallery edge can change
  -- without incrementing either Work's rowVersion. Recheck AFTER locks.
  -- This is not an ALL-WRITER or all-product dependency graph seal.
  if encode(extensions.digest(convert_to(
      'scene-historical-edges-v1|'||v_artifact.preset_artifact_id::text||
      '|'||v_assoc::text||'|'||array_to_string(v_backlinks_locked,'|'),
      'UTF8'),'sha256'),'hex')
      is distinct from p_expected_historical_edge_set_sha256
  then raise exception 'SCENE_REVISION_CALLER_EDGE_FINGERPRINT_STALE';end if;

  -- No Gallery Work may be added, removed or redirected under locked check.
  select coalesce(array_agg(distinct wr.work_id order by wr.work_id),
                  array[]::uuid[]) into v_current_links
  from public.gallery_revision_presets gp
  join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
  join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
  where pr.preset_artifact_id=p_preset_artifact_id;
  if cardinality(v_current_links)<>1 or v_current_links[1]<>v_assoc then
    raise exception 'SCENE_REVISION_BACKLINK_CHANGED_OR_INCOMPLETE';end if;
  select pp.preset_revision_id into v_current_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_preset_work.current_published_revision_id
    and pr.preset_artifact_id=v_artifact.preset_artifact_id;
  if v_current_preset_revision is distinct from p_expected_preset_revision_id
    or not exists (
      select 1 from public.gallery_revision_presets gp
      where gp.gallery_revision_id=v_gallery.current_published_revision_id
        and gp.preset_revision_id=v_current_preset_revision
    )
  then raise exception 'SCENE_REVISION_CURRENT_LINK_STALE';end if;

  select * into v_gallery_subject from public.gallery_photo_subjects
  where work_id=v_gallery.work_id
    and owner_account_id=v_account
    and creator_profile_id=v_artifact.creator_profile_id;
  if v_gallery_subject.work_id is null or not exists (
    select 1 from public.gallery_verified_subjects vs
    where vs.subject_id=v_gallery_subject.subject_id
      and vs.platform='switch' and vs.game_version='1.25.0'
      and vs.build_id='52BD625D9B4E0053'
      and vs.profile_schema=624 and vs.verification_state='verified'
  ) then raise exception 'SCENE_REVISION_VERIFIED_SUBJECT_REQUIRED';end if;

  select * into v_blob from public.artifact_blobs where blob_id=p_artifact_blob_id;
  if v_blob.blob_id is null or v_blob.owner_account_id<>v_account
    or v_blob.purged_at is not null
    or v_blob.schema_version<>1 or v_blob.content_type<>'application/json'
    or v_blob.byte_size not between 1 and 26214400
    or v_blob.checksum_sha256 !~ '^[0-9a-fA-F]{64}$'
    or exists(select 1 from public.preset_revisions pr
              where pr.artifact_blob_id=v_blob.blob_id)
  then raise exception 'SCENE_REVISION_BLOB_INVALID_OR_REUSED';end if;
  -- Only compare caller expectations with the registered owner blob row.
  -- This does NOT attest that Storage bytes were fetched/hashed; a signed
  -- Storage byte-receipt/portable JSON validation path is still required.
  if lower(v_blob.checksum_sha256) is distinct from
       p_expected_artifact_checksum_sha256
    or v_blob.byte_size is distinct from p_expected_artifact_byte_size
  then raise exception 'SCENE_REVISION_REGISTERED_BLOB_EXPECTATION_STALE';end if;

  v_count:=coalesce(cardinality(p_media_ids),0);
  if v_count not between 1 and 10 or p_cover_media_id is null
    or not p_cover_media_id=any(p_media_ids)
    or (select count(distinct x) from unnest(p_media_ids) x)<>v_count
    or array_position(p_media_ids,null) is not null
  then raise exception 'SCENE_REVISION_MEDIA_COUNT_COVER_OR_UNIQUENESS_INVALID';end if;
  -- Sort actual Media locks for deterministic acquisition. This does not
  -- resolve older Gallery-first/Media-first deployed writers; never grant.
  for v_media in select distinct unnest(p_media_ids) id order by id loop
    select * into v_media_row from public.media_assets
    where media_id=v_media for share;
    if v_media_row.media_id is null
      or v_media_row.owner_account_id<>v_account
      or v_media_row.processing_state<>'ready'
      or v_media_row.moderation_state<>'clear'
      or v_media_row.purged_at is not null
      or v_media_row.mime_type not in ('image/jpeg','image/png','image/webp')
      or v_media_row.byte_size not between 1 and 20971520
      or coalesce(v_media_row.width,0)<=0 or coalesce(v_media_row.height,0)<=0
    then raise exception 'SCENE_REVISION_MEDIA_NOT_OWNER_READY_CLEAR';end if;
  end loop;

  -- The next set is one PostgreSQL transaction: immutable rows first,
  -- then both current pointers, Search, Outbox and Idempotency. An exception
  -- rolls it all back; no external Storage copy/removal is attempted here.
  select coalesce(max(revision_number),0)+1 into v_revision_number
    from public.preset_revisions where preset_artifact_id=p_preset_artifact_id;
  select coalesce(max(revision_number),0)+1 into v_preset_work_revision_number
    from public.community_work_revisions where work_id=v_preset_work.work_id;
  select coalesce(max(revision_number),0)+1 into v_gallery_work_revision_number
    from public.community_work_revisions where work_id=v_gallery.work_id;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account,p_idempotency_key,'scene_save_revision_paired_candidate_v1',v_hash);
  insert into public.preset_revisions(
    preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,
    metadata,created_by_account_id
  ) values(v_preset_revision_id,p_preset_artifact_id,v_revision_number,
           p_artifact_blob_id,coalesce(p_metadata,'{}'::jsonb),v_account);
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values
    (v_preset_work_revision_id,v_preset_work.work_id,
     v_preset_work_revision_number,v_account,
     jsonb_build_object('title',p_title,'description',p_description)),
    (v_gallery_work_revision_id,v_gallery.work_id,
     v_gallery_work_revision_number,v_account,
     jsonb_build_object('title',p_title,'description',p_description));
  insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
  values(v_preset_work_revision_id,v_preset_revision_id);
  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values(v_gallery_work_revision_id,p_title,p_description,'{}'::jsonb);
  insert into public.gallery_photo_revision_fields(
    revision_id,subject_id,cover_media_id,originality_attested
  ) values(v_gallery_work_revision_id,v_gallery_subject.subject_id,p_cover_media_id,true);
  for v_position in 1..v_count loop
    insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values(v_gallery_work_revision_id,p_media_ids[v_position],v_position-1,'gallery');
  end loop;
  insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
  values(v_gallery_work_revision_id,v_preset_revision_id);

  update public.community_works
  set current_published_revision_id=v_preset_work_revision_id,
      published_at=coalesce(published_at,now())
  where work_id=v_preset_work.work_id;
  update public.community_works
  set current_published_revision_id=v_gallery_work_revision_id,
      published_at=coalesce(published_at,now())
  where work_id=v_gallery.work_id;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at
  )
  select w.work_id,w.work_id,w.work_type,w.creator_profile_id,
    p_title,coalesce(p_description,''),coalesce(w.published_at,now()),now()
  from public.community_works w
  where w.work_id in (v_preset_work.work_id,v_gallery.work_id)
  on conflict(entity_id) do update set
    title=excluded.title,text_content=excluded.text_content,
    published_at=excluded.published_at,updated_at=now();
  insert into public.outbox_events(
    aggregate_type,aggregate_id,event_type,payload,dedupe_key
  ) values
   ('community_work',v_preset_work.work_id,'work.published',
    jsonb_build_object('revisionId',v_preset_work_revision_id,
      'presetRevisionId',v_preset_revision_id),
    'work.published:'||v_preset_work_revision_id::text),
   ('community_work',v_gallery.work_id,'work.published',
    jsonb_build_object('revisionId',v_gallery_work_revision_id,
      'presetRevisionId',v_preset_revision_id),
    'work.published:'||v_gallery_work_revision_id::text);

  v_response:=jsonb_build_object(
    'presetArtifactId',p_preset_artifact_id,
    'presetRevisionId',v_preset_revision_id,
    'presetWorkId',v_preset_work.work_id,
    'presetWorkRevisionId',v_preset_work_revision_id,
    'galleryWorkId',v_gallery.work_id,
    'galleryWorkRevisionId',v_gallery_work_revision_id,
    'previousGalleryWorkRevisionId',p_expected_gallery_current_work_revision_id,
    'artifactBlobId',v_blob.blob_id,
    'artifactChecksumSha256',lower(v_blob.checksum_sha256),
    'artifactByteSize',v_blob.byte_size,
    'artifactSchemaVersion',v_blob.schema_version,
    'mediaIds',to_jsonb(p_media_ids),
    'mediaCount',v_count,'coverMediaId',p_cover_media_id);
  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account and idempotency_key=p_idempotency_key;
  return v_response;
end
$paired_scene_candidate$;

-- NO Edge, authenticated/anon or service role can invoke this candidate.
revoke all on function private.scene_save_revision_paired_candidate_v1(
  uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text,text,uuid,uuid,uuid,text,bigint)
from public,anon,authenticated,service_role;
