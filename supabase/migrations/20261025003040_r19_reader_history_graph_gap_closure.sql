-- Source140: narrow post-incident Reader/History authority delta after accepted Source139.
-- No Provider promotion, automatic Resolution, physical Remove or Stage deployment.
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
      or pa.associated_gallery_work_id=p_work_id
      or exists(
        select 1 from public.gallery_revision_presets gp
        join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
        where gp.preset_revision_id=pr.preset_revision_id and wr.work_id=p_work_id
      )
    )
 );$r19$;

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
   select pa.associated_gallery_work_id as work_id
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

-- A saved target can be a Work OR a Preset Artifact. A SECURITY DEFINER
-- list projection must not rely on underlying table RLS.
create or replace function private.preset_storage_saved_target_quarantined_r19(
 p_target_entity_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog,public,private as $r19$
 select coalesce(private.preset_storage_work_quarantined_r19(p_target_entity_id),false)
 or exists(
  select 1 from public.preset_artifacts pa
  where pa.preset_artifact_id=p_target_entity_id
    and private.preset_storage_work_quarantined_r19(pa.community_work_id)
 );$r19$;
revoke all on function private.preset_storage_saved_target_quarantined_r19(uuid)
 from public,anon,authenticated,service_role;

create or replace function public.community_get_work(
  p_auth_subject uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_title text;
  v_description text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.can_access_work(p_work_id,v_account_id) then
    raise exception 'Work is not accessible';
  end if;

  perform private.preset_storage_assert_work_readable_r19(p_work_id);
  select * into v_work from public.community_works where work_id=p_work_id;
  if v_work.current_published_revision_id is not null then
    select title,description into v_title,v_description
    from public.gallery_work_revisions
    where revision_id=v_work.current_published_revision_id;
  end if;

  return jsonb_build_object(
    'workId',v_work.work_id,
    'workType',v_work.work_type,
    'creatorProfileId',v_work.creator_profile_id,
    'lifecycleState',v_work.lifecycle_state,
    'visibility',v_work.visibility,
    'moderationState',v_work.moderation_state,
    'currentPublishedRevisionId',v_work.current_published_revision_id,
    'rowVersion',v_work.row_version,
    'title',v_title,
    'description',v_description
  );
end;
$$;

create or replace function public.community_get_saved(
  p_auth_subject uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_result jsonb;
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'p_limit must be between 1 and 100'; end if;
  v_account_id := private.resolve_active_account(p_auth_subject);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'targetEntityId',s.target_entity_id,
      'savedAt',s.created_at,
      'accessible',private.can_access_entity(s.target_entity_id,v_account_id)
    )
    order by s.created_at desc
  ),'[]'::jsonb)
  into v_result
  from (
    select * from public.saved_items
    where account_id=v_account_id
      and not private.preset_storage_saved_target_quarantined_r19(target_entity_id)
    order by created_at desc
    limit p_limit
  ) s;

  return v_result;
end;
$$;

create or replace function public.community_get_my_gallery_v1(
  p_auth_subject uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_my_works jsonb;
  v_saved jsonb;
begin
  if p_limit not between 1 and 100 then raise exception 'p_limit must be between 1 and 100'; end if;
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select coalesce(jsonb_agg(jsonb_build_object(
    'workId',w.work_id,
    'creatorProfileId',w.creator_profile_id,
    'galleryKind',g.gallery_kind,
    'lifecycleState',w.lifecycle_state,
    'visibility',w.visibility,
    'moderationState',w.moderation_state,
    'rowVersion',w.row_version,
    'title',r.title,
    'publishedAt',w.published_at
  ) order by coalesce(w.published_at,w.updated_at) desc,w.work_id),'[]'::jsonb)
  into v_my_works
  from (
    select * from public.community_works
    where owner_account_id=v_account_id and work_type='gallery'
      and lifecycle_state<>'deleted'
      and not private.preset_storage_work_quarantined_r19(work_id)
    order by coalesce(published_at,updated_at) desc,work_id
    limit p_limit
  ) w
  join public.gallery_works g on g.work_id=w.work_id
  left join public.gallery_work_revisions r on r.revision_id=w.current_published_revision_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'targetEntityId',s.target_entity_id,
    'savedAt',s.created_at,
    'accessible',private.can_access_entity(s.target_entity_id,v_account_id),
    'work',case when private.can_access_entity(s.target_entity_id,v_account_id) then (
      select jsonb_build_object(
        'workId',w.work_id,
        'creatorProfileId',w.creator_profile_id,
        'galleryKind',g.gallery_kind,
        'title',r.title,
        'moderationState',w.moderation_state,
        'lifecycleState',w.lifecycle_state
      )
      from public.community_works w
      join public.gallery_works g on g.work_id=w.work_id
      left join public.gallery_work_revisions r on r.revision_id=w.current_published_revision_id
      where w.work_id=s.target_entity_id and w.work_type='gallery'
    ) else null end
  ) order by s.created_at desc),'[]'::jsonb)
  into v_saved
  from (
    select * from public.saved_items
    where account_id=v_account_id
      and not private.preset_storage_saved_target_quarantined_r19(target_entity_id)
    order by created_at desc
    limit p_limit
  ) s;

  return jsonb_build_object('myWorks',v_my_works,'saved',v_saved);
end
$$;

-- Cover-only historical Gallery media is also a reference: it may be
-- omitted from work_revision_media, but must still be incident-suppressed.
create or replace function private.preset_storage_media_quarantined_r19(
 p_media_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog,public,private as $r19$
 select exists(
  select 1 from public.work_revision_media rm
  join public.community_work_revisions wr on wr.revision_id=rm.work_revision_id
  where rm.media_id=p_media_id
    and private.preset_storage_work_quarantined_r19(wr.work_id)
 ) or exists(
  select 1 from public.gallery_photo_revision_fields f
  join public.community_work_revisions wr on wr.revision_id=f.revision_id
  where f.cover_media_id=p_media_id
    and private.preset_storage_work_quarantined_r19(wr.work_id)
 );$r19$;
revoke all on function private.preset_storage_media_quarantined_r19(uuid)
 from public,anon,authenticated,service_role;

create or replace function public.community_gallery_media_gateway_v1(
  p_media_id uuid
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $gallery140$
declare v_gallery_managed boolean:=false;
 v_media jsonb;
begin
 perform public.community_preset_storage_assert_media_not_quarantined_r19(p_media_id);
 -- Historical revisions remain part of the Gallery security boundary:
 -- do not fall through to the legacy 300-second token issuer when a
 -- Gallery image is no longer the current publicly discoverable revision.
 select exists(
  select 1 from public.work_revision_media rm
  join public.community_work_revisions r on r.revision_id=rm.work_revision_id
  join public.gallery_photo_subjects g on g.work_id=r.work_id
  where rm.media_id=p_media_id
 ) OR EXISTS(
   -- A cover is an authoritative Gallery revision reference even when
   -- the WorkRevision Media membership is absent/inconsistent. It is
   -- never permission to stream unless the positive membership test
   -- below independently succeeds.
   SELECT 1 FROM public.gallery_photo_revision_fields f
   JOIN public.community_work_revisions r ON r.revision_id=f.revision_id
   JOIN public.gallery_photo_subjects g ON g.work_id=r.work_id
   WHERE f.cover_media_id=p_media_id
 ) INTO v_gallery_managed;
 if not v_gallery_managed then
   return jsonb_build_object('galleryManaged',false,'publiclyAccessible',false);
 end if;
 select jsonb_build_object(
    'mediaId',m.media_id,'storageKey',m.storage_key,
    'mimeType',m.mime_type,'byteSize',m.byte_size,
    'width',m.width,'height',m.height,'checksumSha256',m.checksum_sha256)
 into v_media
 from public.work_revision_media rm
 join public.community_work_revisions r on r.revision_id=rm.work_revision_id
 join public.gallery_photo_subjects g on g.work_id=r.work_id
 join public.community_works w on w.work_id=g.work_id
 join public.media_assets m on m.media_id=rm.media_id
 where rm.media_id=p_media_id
   and w.current_published_revision_id=r.revision_id
   and private.is_discoverable_work(w.work_id)
   and m.processing_state='ready' and m.moderation_state='clear'
   and m.purged_at is null
   and m.mime_type in ('image/jpeg','image/png','image/webp')
   and m.byte_size between 1 and 20971520
   and m.width>0 and m.height>0
 order by r.created_at desc limit 1;
 if v_media is null then
    return jsonb_build_object('galleryManaged',true,'publiclyAccessible',false);
 end if;
 return v_media||jsonb_build_object('galleryManaged',true,'publiclyAccessible',true);
end $gallery140$;

revoke all on function public.community_get_work(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.community_get_work(uuid,uuid) to service_role;
revoke all on function public.community_get_saved(uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.community_get_saved(uuid,integer) to service_role;
revoke all on function public.community_get_my_gallery_v1(uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.community_get_my_gallery_v1(uuid,integer) to service_role;
revoke all on function public.community_gallery_media_gateway_v1(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.community_gallery_media_gateway_v1(uuid) to service_role;

-- Source139 canonical lacks the Stage-only Scene public SQL definition.
-- Any known Stage-only one-UUID signature must have its EXECUTE path denied
-- AFTER the Operator quiesces/replaces all old Edge/worker bundles. Never
-- migrate this alone while old Scene publisher code is live.
do $r19$
begin
 if to_regprocedure('public.community_get_scene_preset_public_v1(uuid)') is not null then
   execute 'revoke execute on function public.community_get_scene_preset_public_v1(uuid) from public,anon,authenticated,service_role';
 end if;
end;$r19$;
