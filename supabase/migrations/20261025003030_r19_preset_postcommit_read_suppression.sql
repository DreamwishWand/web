-- Source139 add-only post-commit quarantine read barrier. All Source134-138 files untouched.
-- No Provider attestor, incident resolution, Physical Remove or positive publication enabled.
create or replace function private.preset_storage_work_quarantined_r19(
 p_work_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog,public,private as $r19$
 select exists(
  select 1
  from private.preset_storage_integrity_incidents_r18 i
  join private.preset_storage_reservations_r18 r on r.reservation_id=i.reservation_id
  join public.preset_revisions pr on pr.artifact_blob_id=r.committed_blob_id
  join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
  where i.incident_state='QUARANTINED_PENDING_OPERATOR'
    and (
      pa.community_work_id=p_work_id
      or exists(
        select 1 from public.gallery_revision_presets gp
        join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
        where gp.preset_revision_id=pr.preset_revision_id and wr.work_id=p_work_id
      )
    )
 );$r19$;
revoke all on function private.preset_storage_work_quarantined_r19(uuid)
 from public,anon,authenticated,service_role;
grant execute on function private.preset_storage_work_quarantined_r19(uuid) to anon,authenticated;

create or replace function private.preset_storage_blob_quarantined_r19(
 p_blob_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog,public,private as $r19$
 select exists(
  select 1 from private.preset_storage_reservations_r18 r
  join private.preset_storage_integrity_incidents_r18 i on i.reservation_id=r.reservation_id
  where r.committed_blob_id=p_blob_id
    and i.incident_state='QUARANTINED_PENDING_OPERATOR'
 );$r19$;
revoke all on function private.preset_storage_blob_quarantined_r19(uuid)
 from public,anon,authenticated,service_role;

create or replace function private.preset_storage_assert_work_readable_r19(
 p_work_id uuid
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,private as $r19$
begin
 if p_work_id is null or private.preset_storage_work_quarantined_r19(p_work_id)
 then raise exception 'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED';end if;
end;$r19$;
revoke all on function private.preset_storage_assert_work_readable_r19(uuid)
 from public,anon,authenticated,service_role;

create or replace function private.preset_storage_assert_blob_readable_r19(
 p_blob_id uuid
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,private as $r19$
begin
 if p_blob_id is null or private.preset_storage_blob_quarantined_r19(p_blob_id)
 then raise exception 'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED';end if;
end;$r19$;
revoke all on function private.preset_storage_assert_blob_readable_r19(uuid)
 from public,anon,authenticated,service_role;

create or replace function private.preset_storage_media_quarantined_r19(
 p_media_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog,public,private as $r19$
 select exists(
  select 1 from public.work_revision_media rm
  join public.community_work_revisions wr on wr.revision_id=rm.work_revision_id
  where rm.media_id=p_media_id
    and private.preset_storage_work_quarantined_r19(wr.work_id)
 );$r19$;
revoke all on function private.preset_storage_media_quarantined_r19(uuid)
 from public,anon,authenticated,service_role;
grant execute on function private.preset_storage_media_quarantined_r19(uuid) to anon,authenticated;
create or replace function public.community_preset_storage_assert_media_not_quarantined_r19(
 p_media_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public,private as $r19$
begin
 if p_media_id is null or private.preset_storage_media_quarantined_r19(p_media_id)
 then raise exception 'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED';end if;
 return true;
end;$r19$;
revoke all on function public.community_preset_storage_assert_media_not_quarantined_r19(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_assert_media_not_quarantined_r19(uuid)
 to service_role;

create table if not exists private.preset_storage_work_read_suppressions_r19(
 reservation_id uuid not null references private.preset_storage_reservations_r18(reservation_id),
 work_id uuid not null references public.community_works(work_id),
 first_incident_id uuid not null references private.preset_storage_integrity_incidents_r18(incident_id),
 suppression_state text not null default 'DENY_UNTIL_INDEPENDENT_OPERATOR_RESOLUTION'
  check(suppression_state='DENY_UNTIL_INDEPENDENT_OPERATOR_RESOLUTION'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(reservation_id,work_id)
);
alter table private.preset_storage_work_read_suppressions_r19 enable row level security;
revoke all on private.preset_storage_work_read_suppressions_r19 from public,anon,authenticated,service_role;

create or replace function private.preset_storage_incident_suppress_reads_r19()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $r19$
begin
  -- The Source137 Reporter holds Account SHARE > Reservation UPDATE before
  -- INSERT; a Source138 Commit for this reservation cannot race past it.
  insert into private.preset_storage_work_read_suppressions_r19(
   reservation_id,work_id,first_incident_id)
  select distinct new.reservation_id,affected.work_id,new.incident_id
  from private.preset_storage_reservations_r18 res
  join public.preset_revisions pr on pr.artifact_blob_id=res.committed_blob_id
  join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
  cross join lateral (
   select pa.community_work_id as work_id
   union
   select wr.work_id
   from public.gallery_revision_presets gp
   join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
   where gp.preset_revision_id=pr.preset_revision_id
  ) affected
  where res.reservation_id=new.reservation_id and affected.work_id is not null
  on conflict(reservation_id,work_id) do nothing;

  -- Denormalized Search contains public text and cannot remain searchable.
  delete from public.search_documents sd
  where exists(
   select 1 from private.preset_storage_work_read_suppressions_r19 s
   where s.reservation_id=new.reservation_id and s.work_id=sd.work_id
  );
  return new;
end;$r19$;
revoke all on function private.preset_storage_incident_suppress_reads_r19()
 from public,anon,authenticated,service_role;
drop trigger if exists preset_storage_incident_suppress_reads_r19
 on private.preset_storage_integrity_incidents_r18;
create trigger preset_storage_incident_suppress_reads_r19
 after insert on private.preset_storage_integrity_incidents_r18
 for each row execute function private.preset_storage_incident_suppress_reads_r19();

create or replace function private.preset_storage_search_reinsert_guard_r19()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $r19$
begin
 if private.preset_storage_work_quarantined_r19(new.work_id)
 then raise exception 'R19_PRESET_PROVIDER_INTEGRITY_SEARCH_SUPPRESSED';end if;
 return new;
end;$r19$;
revoke all on function private.preset_storage_search_reinsert_guard_r19()
 from public,anon,authenticated,service_role;
drop trigger if exists preset_storage_search_reinsert_guard_r19 on public.search_documents;
create trigger preset_storage_search_reinsert_guard_r19
 before insert or update on public.search_documents for each row
 execute function private.preset_storage_search_reinsert_guard_r19();

drop policy if exists preset_storage_work_incident_read_barrier_r19 on public.community_works;
create policy preset_storage_work_incident_read_barrier_r19
 on public.community_works as restrictive for select to anon,authenticated
 using (not private.preset_storage_work_quarantined_r19(work_id));
drop policy if exists preset_storage_search_incident_read_barrier_r19 on public.search_documents;
create policy preset_storage_search_incident_read_barrier_r19
 on public.search_documents as restrictive for select to anon,authenticated
 using (not private.preset_storage_work_quarantined_r19(work_id));
drop policy if exists preset_storage_artifact_incident_read_barrier_r19 on public.preset_artifacts;
drop policy if exists preset_storage_gallery_revision_link_read_barrier_r19 on public.gallery_revision_presets;
create policy preset_storage_gallery_revision_link_read_barrier_r19
 on public.gallery_revision_presets as restrictive for select to anon,authenticated
 using (not private.preset_storage_work_quarantined_r19((
  select wr.work_id from public.community_work_revisions wr
  where wr.revision_id=gallery_revision_id
 )));
drop policy if exists preset_storage_work_media_link_read_barrier_r19 on public.work_revision_media;
create policy preset_storage_work_media_link_read_barrier_r19
 on public.work_revision_media as restrictive for select to anon,authenticated
 using (not private.preset_storage_work_quarantined_r19((
  select wr.work_id from public.community_work_revisions wr
  where wr.revision_id=work_revision_id
 )));
drop policy if exists preset_storage_media_asset_read_barrier_r19 on public.media_assets;
create policy preset_storage_media_asset_read_barrier_r19
 on public.media_assets as restrictive for select to anon,authenticated
 using (not private.preset_storage_media_quarantined_r19(media_id));

create policy preset_storage_artifact_incident_read_barrier_r19
 on public.preset_artifacts as restrictive for select to anon,authenticated
 using (not private.preset_storage_work_quarantined_r19(community_work_id));

create or replace function public.wep_get_accessible_preset_blob(
  p_auth_subject uuid,
  p_preset_artifact_id uuid default null,
  p_preset_revision_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_work public.community_works%rowtype;
begin
  if (p_preset_artifact_id is null) = (p_preset_revision_id is null) then
    raise exception 'Exactly one Preset artifact or revision id is required';
  end if;

  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_preset_revision_id is not null then
    select pa.* into v_preset
    from public.preset_revisions pr
    join public.preset_artifacts pa
      on pa.preset_artifact_id=pr.preset_artifact_id
    where pr.preset_revision_id=p_preset_revision_id;

    if v_preset.preset_artifact_id is null then
      raise exception 'Preset revision not found';
    end if;

    if not private.can_access_entity(v_preset.preset_artifact_id,v_account_id) then
      raise exception 'Preset is not accessible';
    end if;

    select * into v_revision
    from public.preset_revisions
    where preset_revision_id=p_preset_revision_id;
  else
    select * into v_preset
    from public.preset_artifacts
    where preset_artifact_id=p_preset_artifact_id;

    if v_preset.preset_artifact_id is null then
      raise exception 'Preset not found';
    end if;

    if not private.can_access_entity(v_preset.preset_artifact_id,v_account_id) then
      raise exception 'Preset is not accessible';
    end if;

    select * into v_work
    from public.community_works
    where work_id=v_preset.community_work_id;

    if v_work.current_published_revision_id is null then
      raise exception 'Preset has no published revision';
    end if;

    select pr.* into v_revision
    from public.preset_revision_publications pp
    join public.preset_revisions pr
      on pr.preset_revision_id=pp.preset_revision_id
    where pp.work_revision_id=v_work.current_published_revision_id;
  end if;

  if v_revision.preset_revision_id is null then
    raise exception 'Published Preset revision not found';
  end if;

  select * into v_blob
  from public.artifact_blobs
  where blob_id=v_revision.artifact_blob_id;

  if v_blob.blob_id is null or v_blob.purged_at is not null then
    raise exception 'Preset artifact blob is unavailable';
  end if;

  perform private.preset_storage_assert_blob_readable_r19(v_blob.blob_id);
  return jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_revision.preset_revision_id,
    'presetType',v_preset.preset_type,
    'blobId',v_blob.blob_id,
    'storageKey',v_blob.storage_key,
    'schemaVersion',v_blob.schema_version,
    'contentType',v_blob.content_type,
    'byteSize',v_blob.byte_size,
    'checksumSha256',v_blob.checksum_sha256
  );
end;
$$;

create or replace function public.community_get_preset(
  p_auth_subject uuid,
  p_preset_artifact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_work public.community_works%rowtype;
  v_preset_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_title text;
  v_description text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.can_access_entity(p_preset_artifact_id,v_account_id) then
    raise exception 'Preset is not accessible';
  end if;

  select * into v_preset
  from public.preset_artifacts
  where preset_artifact_id=p_preset_artifact_id;

  select * into v_work
  from public.community_works
  where work_id=v_preset.community_work_id;
  perform private.preset_storage_assert_work_readable_r19(v_work.work_id);

  select pr.* into v_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id;

  select * into v_blob
  from public.artifact_blobs
  where blob_id=v_preset_revision.artifact_blob_id;

  select
    cwr.shared_metadata->>'title',
    cwr.shared_metadata->>'description'
  into v_title,v_description
  from public.community_work_revisions cwr
  where cwr.revision_id=v_work.current_published_revision_id;

  return jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_preset_revision.preset_revision_id,
    'presetType',v_preset.preset_type,
    'workId',v_work.work_id,
    'workRevisionId',v_work.current_published_revision_id,
    'title',v_title,
    'description',v_description,
    'schemaVersion',v_blob.schema_version,
    'contentType',v_blob.content_type,
    'byteSize',v_blob.byte_size,
    'checksumSha256',v_blob.checksum_sha256,
    'metadata',v_preset_revision.metadata
  );
end;
$$;

create or replace function public.community_get_gallery_public_v1(p_work_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work public.community_works%rowtype;
  v_result jsonb;
begin
  select * into v_work
  from public.community_works
  where work_id=p_work_id
    and work_type='gallery'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear';
  if v_work.work_id is null then
    raise exception 'Gallery Work is not publicly accessible';
  end if;

  perform private.preset_storage_assert_work_readable_r19(v_work.work_id);
  select jsonb_build_object(
    'workId',v_work.work_id,
    'workType','gallery',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'galleryKind',g.gallery_kind,
    'title',r.title,
    'description',r.description,
    'metadata',r.metadata,
    'publishedAt',v_work.published_at,
    'commentsEnabled',coalesce(s.comments_enabled,true),
    'mediaIds',coalesce((
      select jsonb_agg(m.media_id order by m.ordinal)
      from public.work_revision_media m
      where m.work_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'presetRevisionIds',coalesce((
      select jsonb_agg(p.preset_revision_id order by p.preset_revision_id)
      from public.gallery_revision_presets p
      where p.gallery_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'usedItems',coalesce((
      select jsonb_agg(
        jsonb_build_object('itemId',i.item_id,'featured',i.featured)
        order by i.featured desc,i.item_id
      )
      from public.gallery_revision_items i
      where i.gallery_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'comments',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'commentId',c.comment_id,
          'creatorProfileId',c.creator_profile_id,
          'parentCommentId',c.parent_comment_id,
          'body',c.body,
          'createdAt',c.created_at
        ) order by c.created_at,c.comment_id
      )
      from public.comments c
      where c.target_entity_id=p_work_id
        and c.lifecycle_state<>'deleted'
        and c.moderation_state='clear'
        and not private.is_account_privacy_suppressed(c.author_account_id)
    ),'[]'::jsonb)
  ) into v_result
  from public.gallery_works g
  join public.gallery_work_revisions r
    on r.revision_id=v_work.current_published_revision_id
  left join public.gallery_work_settings s on s.work_id=v_work.work_id
  where g.work_id=v_work.work_id;

  return v_result;
end
$$;

create or replace function public.community_get_gallery_v1(
  p_auth_subject uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_public jsonb;
  v_reaction_counts jsonb;
  v_reaction_kinds jsonb;
  v_own_reactions jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_work(p_work_id,v_account_id) then
    raise exception 'Work is not accessible';
  end if;
  select * into v_work from public.community_works
  where work_id=p_work_id and work_type='gallery';
  if v_work.work_id is null then raise exception 'Gallery Work not found'; end if;
  perform private.preset_storage_assert_work_readable_r19(v_work.work_id);

  if v_work.lifecycle_state='published'
     and v_work.visibility='public'
     and v_work.moderation_state='clear' then
    v_public:=public.community_get_gallery_public_v1(p_work_id);
  else
    select jsonb_build_object(
      'workId',v_work.work_id,
      'workType','gallery',
      'creatorProfileId',v_work.creator_profile_id,
      'lifecycleState',v_work.lifecycle_state,
      'visibility',v_work.visibility,
      'moderationState',v_work.moderation_state,
      'rowVersion',v_work.row_version,
      'commentsEnabled',coalesce(s.comments_enabled,true),
      'title',r.title,
      'description',r.description,
      'metadata',r.metadata
    ) into v_public
    from public.gallery_work_settings s
    left join public.gallery_work_revisions r
      on r.revision_id=v_work.current_published_revision_id
    where s.work_id=v_work.work_id;
  end if;

  select coalesce(jsonb_agg(x.reaction_kind order by x.reaction_kind),'[]'::jsonb)
  into v_reaction_kinds
  from (
    select distinct reaction_kind
    from public.reactions
    where target_entity_id=p_work_id
  ) x;

  select coalesce(jsonb_agg(
    jsonb_build_object('kind',x.reaction_kind,'count',x.n)
    order by x.reaction_kind
  ),'[]'::jsonb)
  into v_reaction_counts
  from (
    select reaction_kind,count(*)::integer n
    from public.reactions
    where target_entity_id=p_work_id
    group by reaction_kind
  ) x;

  select coalesce(jsonb_agg(reaction_kind order by reaction_kind),'[]'::jsonb)
  into v_own_reactions
  from public.reactions
  where target_entity_id=p_work_id and account_id=v_account_id;

  return v_public || jsonb_build_object(
    'isOwner',v_work.owner_account_id=v_account_id,
    'reactionKinds',v_reaction_kinds,
    'viewerReactionKinds',v_own_reactions,
    'reactionCounts',case when v_work.owner_account_id=v_account_id or private.is_staff(v_account_id)
      then v_reaction_counts else null end
  );
end
$$;


-- Authorized preflight is NOT a resolution, not a provider attestation,
-- and must never modify the immutable Incident history.
create or replace function public.community_preset_storage_resolution_readiness_r19(
 p_auth_subject uuid,p_reservation_id uuid,p_expected_version bigint,p_expected_fence bigint
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r19$
declare v_owner uuid;v_res private.preset_storage_reservations_r18%rowtype;
 v_count bigint;v_old_count bigint;
begin
 v_owner:=private.resolve_active_account(p_auth_subject);
 perform 1 from public.wand_accounts a
  where a.account_id=v_owner and a.status='active' and a.deleted_at is null for share;
 if not found or private.is_account_privacy_suppressed(v_owner)
  then raise exception 'R19_PRESET_RESOLUTION_ACTOR_INACTIVE';end if;
 select * into v_res from private.preset_storage_reservations_r18 r
  where r.reservation_id=p_reservation_id and r.owner_account_id=v_owner for update;
 if v_res.reservation_id is null then raise exception 'R19_PRESET_RESOLUTION_NOT_OWNED';end if;
 if v_res.state_version<>p_expected_version or v_res.lease_fence<>p_expected_fence
  then raise exception 'R19_PRESET_RESOLUTION_STALE_VERSION_OR_FENCE';end if;
 if not exists(select 1 from public.creator_profiles c
   where c.creator_profile_id=v_res.creator_profile_id and c.owner_account_id=v_owner
   and c.moderation_state='clear')
 then raise exception 'R19_PRESET_RESOLUTION_CREATOR_NOT_CLEAR';end if;
 select count(*),count(*) filter(where observed_lease_fence<>v_res.lease_fence)
  into v_count,v_old_count
  from private.preset_storage_integrity_incidents_r18
  where reservation_id=v_res.reservation_id and incident_state='QUARANTINED_PENDING_OPERATOR';
 return jsonb_build_object('contract','ddv.provider-resolution-preflight@r19-work',
  'reservationId',v_res.reservation_id,'stateVersion',v_res.state_version,
  'leaseFence',v_res.lease_fence,'unresolvedIncidentCount',v_count,
  'historicalFenceIncidentCount',v_old_count,'operatorApprovalRequired',true,
  'independentProviderVersionAndBytesRequired',true,
  'currentHistoricalCloudLegalReferencesProven',false,
  'versionFencedResolutionAuthorized',false,'publicationAuthorized',false,
  'physicalCleanupAuthorized',false,'incidentHistoryImmutable',true);
end;$r19$;
revoke all on function public.community_preset_storage_resolution_readiness_r19(uuid,uuid,bigint,bigint)
 from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_resolution_readiness_r19(uuid,uuid,bigint,bigint)
 to service_role;

create or replace function public.community_preset_storage_cleanup_inventory_r19(
 p_auth_subject uuid,p_storage_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r19$
declare v_owner uuid;v_res private.preset_storage_reservations_r18%rowtype;
 v_presets bigint;v_galleries bigint;v_incidents bigint;v_key_match_count bigint;
begin
 v_owner:=private.resolve_active_account(p_auth_subject);
 perform 1 from public.wand_accounts a
  where a.account_id=v_owner and a.status='active' and a.deleted_at is null for share;
 if not found or private.is_account_privacy_suppressed(v_owner)
 then raise exception 'R19_PRESET_CLEANUP_OWNER_INACTIVE';end if;
 select count(*) into v_key_match_count
  from private.preset_storage_reservations_r18 r
  where r.owner_account_id=v_owner
    and (r.published_storage_key=p_storage_key or r.source_staging_key=p_storage_key);
 if v_key_match_count<>1 then
  raise exception 'R19_PRESET_CLEANUP_KEY_UNKNOWN_OR_AMBIGUOUS';end if;
 select * into v_res from private.preset_storage_reservations_r18 r
  where r.owner_account_id=v_owner
    and (r.published_storage_key=p_storage_key or r.source_staging_key=p_storage_key)
  for update;
 if v_res.reservation_id is null then
  raise exception 'R19_PRESET_CLEANUP_KEY_UNOWNED_OR_UNKNOWN';end if;
 select count(*) into v_incidents from private.preset_storage_integrity_incidents_r18 i
  where i.reservation_id=v_res.reservation_id and i.incident_state='QUARANTINED_PENDING_OPERATOR';
 select count(*) into v_presets from public.preset_revisions pr
  where pr.artifact_blob_id=v_res.committed_blob_id;
 select count(*) into v_galleries from public.gallery_revision_presets gp
  join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
  where pr.artifact_blob_id=v_res.committed_blob_id;
 return jsonb_build_object('contract','ddv.preset-cleanup-reference-inventory@r19-work',
  'reservationId',v_res.reservation_id,'stateVersion',v_res.state_version,
  'leaseFence',v_res.lease_fence,'unresolvedIncidentCount',v_incidents,
  'historicalPresetReferenceCount',v_presets,'historicalGalleryReferenceCount',v_galleries,
  'sceneIndependentReferenceGraphProven',false,
  'cloudAndLinkedProfileReferenceGraphProven',false,
  'legalHoldAndModeratorClearanceProven',false,
  'previouslyIssuedBearerAndCdnRevocationProven',false,
  'allCurrentHistoricalAndCloudReferencesProven',false,
  'cleanupClaimAuthorized',false,'physicalDeleteAuthorized',false);
end;$r19$;
revoke all on function public.community_preset_storage_cleanup_inventory_r19(uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_cleanup_inventory_r19(uuid,text)
 to service_role;

-- Source-only gate remains closed. Supabase Storage signed bearer already
-- issued before quarantine cannot be revoked with this SQL alone.
do $r19_failclosed$
begin
 if exists(select 1 from private.preset_storage_release_gate_r18
           where enabled or provider_precondition_accepted)
 then raise exception 'R19_PRESET_POSITIVE_PROVIDER_RELEASE_GATE_UNEXPECTEDLY_OPEN';end if;
 if has_function_privilege('service_role',
   'private.preset_storage_commit_candidate_r18(uuid,uuid,bigint,uuid,bigint,text,text,text,jsonb)','EXECUTE')
 then raise exception 'R19_PRESET_PRIVATE_COMMIT_EXPOSED';end if;
end;$r19_failclosed$;
