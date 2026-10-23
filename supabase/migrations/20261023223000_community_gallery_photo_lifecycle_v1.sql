-- 03-COMM-GALLERY-PUBLIC-WORK-LIFECYCLE-V1
-- A narrowly scoped, fail-closed photo-only Gallery contract.
-- 09 INT must explicitly seed reviewed v1.25.0 subject IDs; no inference from screenshots.
create table if not exists public.gallery_verified_subjects (
  subject_id uuid primary key default gen_random_uuid(),
  gallery_kind text not null check (gallery_kind in ('outdoor','indoor','tom_furniture','tom_clothing')),
  subject_type text not null check (subject_type in ('biome','floating_island','room','tom_furniture','tom_clothing')),
  canonical_target_id text not null check (length(btrim(canonical_target_id)) between 1 and 160),
  base_item_id bigint,
  platform text not null check (platform='switch'),
  game_version text not null check (game_version='1.25.0'),
  build_id text not null check (build_id='52BD625D9B4E0053'),
  profile_schema integer not null check (profile_schema=624),
  evidence_ref text not null check (length(btrim(evidence_ref)) between 5 and 512),
  verification_state text not null default 'pending' check(verification_state in ('pending','verified','revoked')),
  created_at timestamptz not null default now(),
  unique(platform,build_id,subject_type,canonical_target_id,base_item_id),
  check (
    (gallery_kind='outdoor' and subject_type in ('biome','floating_island') and base_item_id is null) or
    (gallery_kind='indoor' and subject_type='room' and base_item_id is null) or
    (gallery_kind='tom_furniture' and subject_type='tom_furniture' and base_item_id>0) or
    (gallery_kind='tom_clothing' and subject_type='tom_clothing' and base_item_id>0)
  )
);
alter table public.gallery_verified_subjects enable row level security;
revoke all on public.gallery_verified_subjects from public,anon,authenticated;
grant select,insert,update,delete on public.gallery_verified_subjects to service_role;

create table if not exists public.gallery_photo_subjects (
  work_id uuid primary key references public.gallery_works(work_id),
  subject_id uuid not null references public.gallery_verified_subjects(subject_id),
  owner_account_id uuid not null references public.wand_accounts(account_id),
  creator_profile_id uuid not null references public.creator_profiles(creator_profile_id),
  created_at timestamptz not null default now()
);
create index if not exists gallery_photo_subjects_subject_idx on public.gallery_photo_subjects(subject_id);
alter table public.gallery_photo_subjects enable row level security;
revoke all on public.gallery_photo_subjects from public,anon,authenticated;
grant select,insert on public.gallery_photo_subjects to service_role;
-- Subject binding is immutable, even for elevated callers.
create or replace function private.gallery_photo_subject_immutable_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'GALLERY_SUBJECT_IMMUTABLE'; end $$;
drop trigger if exists gallery_photo_subject_immutable on public.gallery_photo_subjects;
create trigger gallery_photo_subject_immutable before update or delete
on public.gallery_photo_subjects for each row execute function private.gallery_photo_subject_immutable_v1();

create table if not exists public.gallery_photo_revision_fields (
  revision_id uuid primary key references public.gallery_work_revisions(revision_id),
  subject_id uuid not null references public.gallery_verified_subjects(subject_id),
  cover_media_id uuid not null references public.media_assets(media_id),
  originality_attested boolean not null check (originality_attested),
  created_at timestamptz not null default now()
);
create index if not exists gallery_photo_revision_fields_subject_idx on public.gallery_photo_revision_fields(subject_id);
alter table public.gallery_photo_revision_fields enable row level security;
revoke all on public.gallery_photo_revision_fields from public,anon,authenticated;
grant select,insert on public.gallery_photo_revision_fields to service_role;
drop trigger if exists gallery_photo_revision_immutable on public.gallery_photo_revision_fields;
create trigger gallery_photo_revision_immutable before update or delete
on public.gallery_photo_revision_fields for each row execute function private.gallery_photo_subject_immutable_v1();

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
    if v_work.row_version<>p_expected_version then
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
    select coalesce(max(revision_number),0)+1 into v_n
      from public.community_work_revisions where work_id=v_work_id;
    v_revision:=gen_random_uuid();
    insert into public.community_work_revisions(
      revision_id,work_id,revision_number,created_by_account_id,shared_metadata,sealed_at
    ) values(v_revision,v_work_id,v_n,v_account,
      jsonb_build_object('origin','gallery-photo-v1','verifiedSubjectId',p_subject_id),now());
    insert into public.gallery_work_revisions(revision_id,title,description,metadata)
    values(v_revision,btrim(p_title),p_description,jsonb_build_object('photoOnly',true));
    foreach v_media in array v_media_order loop
      insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
      values(v_revision,v_media,v_index,'gallery');
      v_index:=v_index+1;
    end loop;
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
        'previousRevisionId',v_work.current_published_revision_id,
        'subjectId',p_subject_id),
      'work.presentation_updated:'||v_revision::text);
  end if;

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

-- Server-authoritative public projection: existing visibility/moderation validation
-- is reused, then the immutable subject+cover binding is appended.
create or replace function public.community_get_gallery_photo_public_v1(p_work_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare v_pub jsonb; v_subject jsonb;
begin
  v_pub:=public.community_get_gallery_public_v1(p_work_id);
  select jsonb_build_object(
    'subjectId',s.subject_id,'subjectType',s.subject_type,
    'canonicalTargetId',s.canonical_target_id,'baseItemId',s.base_item_id,
    'platform',s.platform,'gameVersion',s.game_version,'buildId',s.build_id,
    'profileSchema',s.profile_schema,'evidenceRef',s.evidence_ref,
    'coverMediaId',rf.cover_media_id,'photoOnly',true
  ) into v_subject
  from public.gallery_photo_subjects b
  join public.gallery_verified_subjects s on s.subject_id=b.subject_id
  join public.community_works w on w.work_id=b.work_id
  join public.gallery_photo_revision_fields rf
    on rf.revision_id=w.current_published_revision_id and rf.subject_id=b.subject_id
  where b.work_id=p_work_id;
  if v_subject is null then raise exception 'GALLERY_PHOTO_PUBLIC_BINDING_MISSING'; end if;
  return v_pub||v_subject;
end $$;

-- Photo-only Free DELETE. Dependents must be retired by 09 INT inside an
-- atomic transaction first; do NOT claim cross-artifact retirement here.
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
  if v_work.row_version<>p_expected_version then raise exception 'GALLERY_ROW_VERSION_CONFLICT'; end if;
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

-- Stop legacy generic API from silently turning classified photo works private
-- without an authorized Wand Cloud preservation proof.
create or replace function private.gallery_photo_public_retirement_guard_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $$
begin
  if old.lifecycle_state='published' and old.visibility='public'
    and exists(select 1 from public.gallery_photo_subjects b where b.work_id=old.work_id)
    and (new.lifecycle_state in ('unpublished','deleted') or new.visibility<>'public') then
    if new.lifecycle_state='unpublished' or new.visibility<>'public' then
      raise exception 'GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED';
    end if;
    if exists(select 1 from public.preset_artifacts pa where pa.associated_gallery_work_id=old.work_id)
       or exists(select 1 from public.gallery_revision_presets gp
          join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id
          where r.work_id=old.work_id) then
      raise exception 'GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists gallery_photo_public_retirement_guard on public.community_works;
create trigger gallery_photo_public_retirement_guard before update on public.community_works
for each row execute function private.gallery_photo_public_retirement_guard_v1();

revoke execute on function public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text) to service_role;
revoke execute on function public.community_get_gallery_photo_public_v1(uuid) from public,anon,authenticated;
grant execute on function public.community_get_gallery_photo_public_v1(uuid) to service_role;
revoke execute on function public.community_delete_gallery_photo_v1(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.community_delete_gallery_photo_v1(uuid,uuid,bigint,text) to service_role;
revoke execute on function private.gallery_photo_subject_immutable_v1() from public,anon,authenticated,service_role;
revoke execute on function private.gallery_photo_public_retirement_guard_v1() from public,anon,authenticated,service_role;
