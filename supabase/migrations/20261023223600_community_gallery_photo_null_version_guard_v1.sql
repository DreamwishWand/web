-- Reject missing expectedVersion; SQL NULL must not bypass optimistic concurrency.
create or replace function public.community_publish_gallery_photo_v1(
  p_auth_subject uuid, p_creator_profile_id uuid, p_work_id uuid,
  p_expected_version bigint, p_gallery_kind text, p_subject_id uuid,
  p_title text, p_description text, p_media_ids uuid[],
  p_cover_media_id uuid, p_originality_attested boolean, p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account uuid;
  v_subject public.gallery_verified_subjects%rowtype;
  v_work public.community_works%rowtype;
  v_bound public.gallery_photo_subjects%rowtype;
  v_creator uuid;
  v_work_id uuid;
  v_new boolean:=false;
  v_revision uuid;
  v_n integer;
  v_media uuid;
  v_media_order uuid[];
  v_resp jsonb;
  v_hash text;
  v_prior text;
  v_create jsonb;
  v_publish jsonb;
  v_previous_revision uuid;
  v_index integer:=0;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 160 then
    raise exception 'GALLERY_IDEMPOTENCY_KEY_INVALID';
  end if;
  if p_gallery_kind not in ('outdoor','indoor','tom_furniture','tom_clothing') then
    raise exception 'GALLERY_KIND_UNSUPPORTED';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 240
     or p_description is not null and length(p_description)>20000 then
    raise exception 'GALLERY_PRESENTATION_INVALID';
  end if;
  if not coalesce(p_originality_attested,false) then
    raise exception 'GALLERY_ORIGINALITY_ATTESTATION_REQUIRED';
  end if;
  if coalesce(cardinality(p_media_ids),0) not between 1 and 10
     or p_cover_media_id is null
     or not (p_cover_media_id=any(p_media_ids))
     or exists(select 1 from unnest(p_media_ids) m where m is null)
     or (select count(*) from unnest(p_media_ids) m) <>
        (select count(distinct m) from unnest(p_media_ids) m) then
    raise exception 'GALLERY_MEDIA_SELECTION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account::text||':'||p_idempotency_key,0));
  v_hash:=encode(digest(concat_ws('|',
    'photo_gallery_v1',coalesce(p_work_id::text,'new'),coalesce(p_expected_version::text,'new'),
    p_creator_profile_id::text,p_gallery_kind,p_subject_id::text,btrim(p_title),
    coalesce(p_description,''),array_to_string(p_media_ids,','),p_cover_media_id::text,
    p_originality_attested::text),'sha256'),'hex');
  select request_hash,response into v_prior,v_resp from public.idempotency_keys
  where account_id=v_account and idempotency_key=p_idempotency_key;
  if v_prior is not null then
    if v_prior<>v_hash then raise exception 'GALLERY_IDEMPOTENCY_CONFLICT'; end if;
    return v_resp;
  end if;

  select * into v_subject from public.gallery_verified_subjects
  where subject_id=p_subject_id and verification_state='verified' for share;
  if v_subject.subject_id is null or v_subject.gallery_kind<>p_gallery_kind then
    raise exception 'GALLERY_VERIFIED_SUBJECT_REQUIRED';
  end if;

  if not exists(select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id and c.owner_account_id=v_account
      and c.moderation_state='clear') then
    raise exception 'GALLERY_CREATOR_FORBIDDEN';
  end if;

  -- The pre-existing, public-media-signed canonical upload path must own the assets.
  foreach v_media in array p_media_ids loop
    if not exists(select 1 from public.media_assets m
      where m.media_id=v_media and m.owner_account_id=v_account
        and m.processing_state='ready' and m.moderation_state='clear'
        and m.purged_at is null and m.mime_type in ('image/jpeg','image/png','image/webp')
        and m.byte_size between 1 and 20971520
        and m.width>0 and m.height>0) then
      raise exception 'GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED';
    end if;
  end loop;

  -- Do not share public media IDs with unrelated Works: a second Work could
  -- otherwise keep the image publicly addressable after this Work is retired.
  if exists(
    select 1 from public.work_revision_media rm
    join public.community_work_revisions rr on rr.revision_id=rm.work_revision_id
    join public.community_works rw on rw.work_id=rr.work_id
    where rm.media_id=any(p_media_ids)
      and rw.work_id is distinct from p_work_id
      and rw.lifecycle_state='published' and rw.visibility='public'
      and rw.moderation_state='clear'
  ) then raise exception 'GALLERY_MEDIA_ALREADY_PUBLIC_ON_DIFFERENT_WORK'; end if;

  -- The cover leads the immutable order; the remaining images retain their supplied order.
  v_media_order:=array[p_cover_media_id]::uuid[];
  foreach v_media in array p_media_ids loop
    if v_media<>p_cover_media_id then v_media_order:=array_append(v_media_order,v_media); end if;
  end loop;

  if p_work_id is null then
    -- Both existing RPCs run in THIS PostgreSQL transaction. Any later error
    -- rolls back draft, media references, public search, events and idempotency.
    v_create:=public.community_create_gallery_work_v1(
      p_auth_subject,p_creator_profile_id,p_gallery_kind,p_idempotency_key||':create'
    );
    v_work_id:=(v_create->>'workId')::uuid;
    v_publish:=public.community_publish_gallery_v4(
      p_auth_subject,v_work_id,(v_create->>'rowVersion')::bigint,
      p_title,p_description,v_media_order,array[]::uuid[],array[]::bigint[],
      array[]::bigint[],null,p_idempotency_key||':publish'
    );
    v_revision:=(v_publish->>'revisionId')::uuid;
    v_new:=true;
    insert into public.gallery_photo_subjects(work_id,subject_id,owner_account_id,creator_profile_id)
    values(v_work_id,p_subject_id,v_account,p_creator_profile_id);
    select * into v_work from public.community_works where work_id=v_work_id for update;
  else
    v_work_id:=p_work_id;
    select * into v_work from public.community_works where work_id=v_work_id for update;
    if v_work.work_id is null or v_work.work_type<>'gallery'
        or v_work.owner_account_id<>v_account or v_work.creator_profile_id<>p_creator_profile_id then
      raise exception 'GALLERY_WORK_FORBIDDEN';
    end if;
    if p_expected_version is null or v_work.row_version<>p_expected_version then
      raise exception 'GALLERY_ROW_VERSION_CONFLICT';
    end if;
    if v_work.lifecycle_state<>'published' or v_work.visibility<>'public'
        or v_work.moderation_state<>'clear' then
      raise exception 'GALLERY_WORK_NOT_PUBLIC_EDITABLE';
    end if;
    select * into v_bound from public.gallery_photo_subjects where work_id=v_work_id;
    if v_bound.work_id is null or v_bound.subject_id<>p_subject_id
      or v_bound.creator_profile_id<>p_creator_profile_id
      or v_bound.owner_account_id<>v_account
      or not exists(select 1 from public.gallery_works g where g.work_id=v_work_id and g.gallery_kind=p_gallery_kind)
    then raise exception 'GALLERY_SUBJECT_OR_CREATOR_IMMUTABLE'; end if;
    -- A photo-only revision cannot silently rewrite Presets-originated artwork.
    if exists(select 1 from public.gallery_revision_presets gp
      join public.community_work_revisions cr on cr.revision_id=gp.gallery_revision_id
      where cr.work_id=v_work_id) then
      raise exception 'GALLERY_PRESET_DEPENDENCY_REQUIRES_09_INT';
    end if;
    v_previous_revision:=v_work.current_published_revision_id;
    select coalesce(max(revision_number),0)+1 into v_n
      from public.community_work_revisions where work_id=v_work_id;
    v_revision:=gen_random_uuid();
    insert into public.community_work_revisions(
      revision_id,work_id,revision_number,created_by_account_id,shared_metadata
    ) values(v_revision,v_work_id,v_n,v_account,
      jsonb_build_object('origin','gallery-photo-v1','verifiedSubjectId',p_subject_id));
    insert into public.gallery_work_revisions(revision_id,title,description,metadata)
    values(v_revision,btrim(p_title),p_description,jsonb_build_object('photoOnly',true));
    foreach v_media in array v_media_order loop
      insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
      values(v_revision,v_media,v_index,'gallery');
      v_index:=v_index+1;
    end loop;
    -- Existing seal_current_work_revision trigger seals atomically on pointer promotion.
    update public.community_works set current_published_revision_id=v_revision,
      updated_at=now() where work_id=v_work_id returning * into v_work;
    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
    ) values(v_work_id,v_work_id,'gallery',p_creator_profile_id,btrim(p_title),
      coalesce(p_description,''),array[]::text[],
      jsonb_build_object('galleryKind',p_gallery_kind,'subjectId',p_subject_id,'photoOnly',true),
      coalesce(v_work.published_at,now()),now())
    on conflict(entity_id) do update set
      title=excluded.title,text_content=excluded.text_content,
      facets=excluded.facets,updated_at=now();
    insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
    values('community_work',v_work_id,'work.presentation_updated',
      jsonb_build_object('workId',v_work_id,'revisionId',v_revision,
        'previousRevisionId',v_previous_revision,
        'subjectId',p_subject_id),
      'work.presentation_updated:'||v_revision::text);
  end if;

  update public.search_documents
    set facets=facets || jsonb_build_object('galleryKind',p_gallery_kind,
      'subjectId',p_subject_id,'subjectType',v_subject.subject_type,
      'baseItemId',v_subject.base_item_id,'photoOnly',true,
      'coverMediaId',p_cover_media_id),
      updated_at=now()
    where entity_id=v_work_id;

  insert into public.gallery_photo_revision_fields(
    revision_id,subject_id,cover_media_id,originality_attested
  ) values(v_revision,p_subject_id,p_cover_media_id,true);

  -- PUBLIC + current-revision is the only public-media grant. No source writer.
  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash,response,completed_at)
  values(v_account,p_idempotency_key,'community_publish_gallery_photo_v1',v_hash,
    jsonb_build_object('workId',v_work_id,'revisionId',v_revision,'rowVersion',v_work.row_version,
      'visibility','public','lifecycleState','published',
      'creatorProfileId',p_creator_profile_id,'galleryKind',p_gallery_kind,
      'subjectId',p_subject_id,'subjectType',v_subject.subject_type,
      'canonicalTargetId',v_subject.canonical_target_id,
      'baseItemId',v_subject.base_item_id,
      'platform',v_subject.platform,'gameVersion',v_subject.game_version,
      'buildId',v_subject.build_id,'profileSchema',v_subject.profile_schema,
      'coverMediaId',p_cover_media_id,'mediaIds',to_jsonb(v_media_order),
      'created',v_new),now())
  returning response into v_resp;
  return v_resp;
end $$;


create or replace function public.community_delete_gallery_photo_v1(
  p_auth_subject uuid,p_work_id uuid,p_expected_version bigint,p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,public,private as $$
declare
  v_account uuid;
  v_work public.community_works%rowtype;
  v_resp jsonb;
  v_hash text;v_old_hash text;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 160 then
    raise exception 'GALLERY_IDEMPOTENCY_KEY_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account::text||':'||p_idempotency_key,0));
  v_hash:=encode(digest(concat_ws('|','delete_gallery_photo_v1',p_work_id::text,p_expected_version::text),'sha256'),'hex');
  select request_hash,response into v_old_hash,v_resp from public.idempotency_keys
  where account_id=v_account and idempotency_key=p_idempotency_key;
  if v_old_hash is not null then
    if v_old_hash<>v_hash then raise exception 'GALLERY_IDEMPOTENCY_CONFLICT'; end if;
    return v_resp;
  end if;
  select * into v_work from public.community_works where work_id=p_work_id for update;
  if v_work.work_id is null or v_work.owner_account_id<>v_account or v_work.work_type<>'gallery'
     or not exists(select 1 from public.gallery_photo_subjects where work_id=p_work_id) then
    raise exception 'GALLERY_WORK_FORBIDDEN';
  end if;
  if p_expected_version is null or v_work.row_version<>p_expected_version then raise exception 'GALLERY_ROW_VERSION_CONFLICT'; end if;
  if v_work.lifecycle_state<>'published' or v_work.visibility<>'public' then
    raise exception 'GALLERY_PUBLIC_DELETE_ONLY';
  end if;
  if exists(select 1 from public.preset_artifacts where associated_gallery_work_id=p_work_id)
     or exists(select 1 from public.gallery_revision_presets gp
       join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id
       where r.work_id=p_work_id) then
    raise exception 'GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED';
  end if;
  -- Do not try to convert free PUBLIC Work to a server-private archive.
  v_resp:=public.community_delete_work(p_auth_subject,p_work_id,p_expected_version,p_idempotency_key||':delete');
  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash,response,completed_at)
  values(v_account,p_idempotency_key,'community_delete_gallery_photo_v1',v_hash,v_resp,now());
  return v_resp;
end $$;

