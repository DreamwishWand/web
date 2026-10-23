-- 03-COMM-GALLERY-PUBLIC-WORK-LIFECYCLE-V1
-- New photo-only entrypoint; existing Gallery/Q&A/Presets writers are untouched.
-- Public client cannot insert source verification facts.

create table if not exists public.gallery_verified_subjects (
  subject_id uuid primary key default gen_random_uuid(),
  gallery_kind text not null check (gallery_kind in ('outdoor','indoor','tom_furniture','tom_clothing')),
  subject_kind text not null check (subject_kind in ('biome','floating_island','room','base_item')),
  canonical_subject_key text not null check (char_length(canonical_subject_key) between 1 and 160),
  base_item_id bigint,
  platform text not null check (platform in ('switch','steam')),
  game_version text not null check (char_length(game_version) between 1 and 100),
  build_identity text not null check (char_length(build_identity) between 1 and 160),
  source_reference text not null check (char_length(source_reference) between 1 and 512),
  verified_state text not null default 'unverified' check (verified_state in ('unverified','verified','withdrawn')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gallery_subject_kind_pair check (
    (gallery_kind='outdoor' and subject_kind in ('biome','floating_island') and base_item_id is null) or
    (gallery_kind='indoor' and subject_kind='room' and base_item_id is null) or
    (gallery_kind in ('tom_furniture','tom_clothing') and subject_kind='base_item'
      and base_item_id>0 and canonical_subject_key=base_item_id::text)
  ),
  constraint gallery_subject_verification_guard check (
    verified_state<>'verified' or verified_at is not null
  ),
  unique (gallery_kind,subject_kind,canonical_subject_key,platform,game_version,build_identity)
);
alter table public.gallery_verified_subjects enable row level security;
revoke all on public.gallery_verified_subjects from public,anon,authenticated;
grant select on public.gallery_verified_subjects to service_role;

create table if not exists public.gallery_photo_subject_bindings (
  work_id uuid primary key references public.gallery_works(work_id),
  subject_id uuid not null references public.gallery_verified_subjects(subject_id),
  creator_profile_id uuid not null references public.creator_profiles(creator_profile_id),
  owner_account_id uuid not null references public.wand_accounts(account_id),
  origin_media_id uuid not null references public.media_assets(media_id),
  created_at timestamptz not null default now()
);
create index if not exists gallery_photo_subject_bindings_subject_idx
  on public.gallery_photo_subject_bindings(subject_id);
create index if not exists gallery_photo_subject_bindings_origin_media_idx
  on public.gallery_photo_subject_bindings(origin_media_id);
alter table public.gallery_photo_subject_bindings enable row level security;
revoke all on public.gallery_photo_subject_bindings from public,anon,authenticated;
grant select on public.gallery_photo_subject_bindings to service_role;

create or replace function private.gallery_photo_validate_media_v1(
  p_owner uuid,p_media uuid[],p_cover uuid
) returns void language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_count integer; v_id uuid;
begin
  v_count:=coalesce(cardinality(p_media),0);
  if v_count not between 1 and 10 then raise exception 'GALLERY_MEDIA_COUNT_INVALID'; end if;
  if p_cover is null or not (p_cover=any(p_media)) then raise exception 'GALLERY_COVER_NOT_INCLUDED'; end if;
  if exists(select 1 from unnest(p_media) x where x is null)
     or (select count(distinct x) from unnest(p_media) x)<>v_count then
    raise exception 'GALLERY_MEDIA_DUPLICATED';
  end if;
  foreach v_id in array p_media loop
    if not exists(
      select 1 from public.media_assets m
      where m.media_id=v_id and m.owner_account_id=p_owner
        and m.processing_state='ready' and m.moderation_state='clear'
        and m.purged_at is null
        and m.mime_type in ('image/png','image/jpeg','image/webp')
        and m.byte_size between 1 and 10485760
        and m.width between 1 and 16000 and m.height between 1 and 16000
        and m.checksum_sha256 ~ '^[[:xdigit:]]{64}$'
    ) then raise exception 'GALLERY_MEDIA_NOT_VERIFIED_OR_NOT_OWNED'; end if;
  end loop;
end $$;
revoke all on function private.gallery_photo_validate_media_v1(uuid,uuid[],uuid)
 from public,anon,authenticated,service_role;

create or replace function private.gallery_photo_write_revision_v1(
  p_work uuid,p_owner uuid,p_title text,p_description text,p_media uuid[],
  p_cover uuid,p_subject uuid,p_revision_number integer
) returns uuid language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_rev uuid:=gen_random_uuid(); v_media uuid; v_ord integer:=0;
begin
  insert into public.community_work_revisions
   (revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
  values (v_rev,p_work,p_revision_number,p_owner,
    jsonb_build_object('origin','gallery-photo-v1','subjectId',p_subject));
  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values (v_rev,btrim(p_title),p_description,
    jsonb_build_object('photoOnly',true,'subjectId',p_subject,
      'coverMediaId',p_cover,'mediaCount',cardinality(p_media)));
  foreach v_media in array p_media loop
    insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values(v_rev,v_media,v_ord,'gallery');
    v_ord:=v_ord+1;
  end loop;
  return v_rev;
end $$;
revoke all on function private.gallery_photo_write_revision_v1(uuid,uuid,text,text,uuid[],uuid,uuid,integer)
 from public,anon,authenticated,service_role;

create or replace function public.community_publish_gallery_photo_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_subject_id uuid,
  p_title text,
  p_description text,
  p_media_ids uuid[],
  p_cover_media_id uuid,
  p_original_work_attested boolean,
  p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,public,private as $$
declare
 v_account uuid; v_subject public.gallery_verified_subjects%rowtype;
 v_work uuid:=gen_random_uuid(); v_rev uuid; v_state public.community_works%rowtype;
 v_hash text; v_oldhash text; v_response jsonb;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 if coalesce(char_length(btrim(p_idempotency_key)),0) not between 1 and 200
 then raise exception 'GALLERY_IDEMPOTENCY_REQUIRED'; end if;
 if coalesce(char_length(btrim(p_title)),0) not between 1 and 240
 then raise exception 'GALLERY_TITLE_INVALID'; end if;
 if p_description is not null and char_length(p_description)>20000
 then raise exception 'GALLERY_DESCRIPTION_TOO_LONG'; end if;
 if p_original_work_attested is distinct from true then
   raise exception 'GALLERY_ORIGINALITY_ATTESTATION_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_account::text||':'||p_idempotency_key,0));
 v_hash:=encode(digest(jsonb_build_object(
   'op','gallery_photo_create_v1','creator',p_creator_profile_id,'subject',p_subject_id,
   'title',btrim(p_title),'description',p_description,'media',p_media_ids,
   'cover',p_cover_media_id,'attested',p_original_work_attested)::text,'sha256'),'hex');
 select request_hash,response into v_oldhash,v_response
 from public.idempotency_keys
 where account_id=v_account and idempotency_key=p_idempotency_key;
 if found then
   if v_oldhash<>v_hash then raise exception 'GALLERY_IDEMPOTENCY_CONFLICT'; end if;
   return v_response;
 end if;
 if not exists(select 1 from public.creator_profiles
     where creator_profile_id=p_creator_profile_id and owner_account_id=v_account
     and moderation_state='clear' and profile_visibility='public') then
   raise exception 'GALLERY_CREATOR_UNAVAILABLE'; end if;
 select * into v_subject from public.gallery_verified_subjects where subject_id=p_subject_id;
 if v_subject.subject_id is null or v_subject.verified_state<>'verified'
     or v_subject.platform<>'switch' or v_subject.game_version<>'1.25.0'
     or v_subject.build_identity<>'52BD625D9B4E0053'
 then raise exception 'GALLERY_SUBJECT_NOT_VERIFIED_FOR_TARGET'; end if;
 perform private.gallery_photo_validate_media_v1(v_account,p_media_ids,p_cover_media_id);
 insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
 values(v_account,p_idempotency_key,'gallery_photo_create_v1',v_hash);
 insert into public.community_entities(entity_id,entity_type)
 values(v_work,'community_work');
 insert into public.community_works
  (work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
 values(v_work,v_account,p_creator_profile_id,'gallery','draft','public');
 insert into public.gallery_works(work_id,gallery_kind)
 values(v_work,v_subject.gallery_kind);
 insert into public.gallery_work_settings(work_id,comments_enabled)
 values(v_work,true);
 insert into public.gallery_photo_subject_bindings
  (work_id,subject_id,creator_profile_id,owner_account_id,origin_media_id)
 values(v_work,p_subject_id,p_creator_profile_id,v_account,p_cover_media_id);
 insert into public.community_entity_origins(entity_id,origin_kind)
 values(v_work,private.community_origin_kind_for_account(v_account));
 v_rev:=private.gallery_photo_write_revision_v1(
   v_work,v_account,p_title,p_description,p_media_ids,p_cover_media_id,p_subject_id,1);
 update public.community_works set
   lifecycle_state='published',visibility='public',
   current_published_revision_id=v_rev,published_at=now(),updated_at=now()
 where work_id=v_work returning * into v_state;
 insert into public.search_documents
  (entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at)
 values(v_work,v_work,'gallery',p_creator_profile_id,btrim(p_title),
   coalesce(p_description,''),array[]::text[],
   jsonb_build_object('galleryKind',v_subject.gallery_kind,'subjectKind',v_subject.subject_kind,
   'subjectId',p_subject_id,'commentsEnabled',true),v_state.published_at);
 insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
 values('community_work',v_work,'work.published',
   jsonb_build_object('workId',v_work,'revisionId',v_rev,'subjectId',p_subject_id),
   'gallery_photo.publish:'||v_rev::text);
 v_response:=jsonb_build_object('workId',v_work,'revisionId',v_rev,
   'rowVersion',v_state.row_version,'subjectId',p_subject_id,
   'galleryKind',v_subject.gallery_kind,'lifecycleState','published','visibility','public');
 update public.idempotency_keys set response=v_response,completed_at=now()
 where account_id=v_account and idempotency_key=p_idempotency_key;
 return v_response;
end $$;

create or replace function public.community_update_gallery_photo_v1(
 p_auth_subject uuid,p_work_id uuid,p_expected_version bigint,
 p_title text,p_description text,p_media_ids uuid[],p_cover_media_id uuid,
 p_subject_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,public,private as $$
declare
 v_account uuid; v_work public.community_works%rowtype;
 v_binding public.gallery_photo_subject_bindings%rowtype;
 v_rev uuid; v_rev_num integer; v_overlap integer;
 v_hash text; v_oldhash text; v_response jsonb;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 if coalesce(char_length(btrim(p_idempotency_key)),0) not between 1 and 200
 then raise exception 'GALLERY_IDEMPOTENCY_REQUIRED'; end if;
 if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
   raise exception 'GALLERY_TITLE_INVALID'; end if;
 if p_description is not null and char_length(p_description)>20000 then
   raise exception 'GALLERY_DESCRIPTION_TOO_LONG'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_account::text||':'||p_idempotency_key,0));
 v_hash:=encode(digest(jsonb_build_object('op','gallery_photo_update_v1',
   'work',p_work_id,'version',p_expected_version,'subject',p_subject_id,
   'title',btrim(p_title),'description',p_description,'media',p_media_ids,
   'cover',p_cover_media_id)::text,'sha256'),'hex');
 select request_hash,response into v_oldhash,v_response from public.idempotency_keys
 where account_id=v_account and idempotency_key=p_idempotency_key;
 if found then
   if v_oldhash<>v_hash then raise exception 'GALLERY_IDEMPOTENCY_CONFLICT'; end if;
   return v_response;
 end if;
 select * into v_work from public.community_works where work_id=p_work_id for update;
 if v_work.work_id is null or v_work.work_type<>'gallery' then raise exception 'GALLERY_WORK_NOT_FOUND'; end if;
 if v_work.owner_account_id<>v_account then raise exception 'GALLERY_NOT_OWNER'; end if;
 if v_work.row_version<>p_expected_version then raise exception 'GALLERY_VERSION_CONFLICT'; end if;
 if v_work.lifecycle_state<>'published' or v_work.visibility<>'public' or
    v_work.moderation_state<>'clear' then raise exception 'GALLERY_WORK_NOT_EDITABLE'; end if;
 select * into v_binding from public.gallery_photo_subject_bindings where work_id=p_work_id;
 if v_binding.work_id is null or v_binding.subject_id<>p_subject_id or
   v_binding.owner_account_id<>v_account or v_binding.creator_profile_id<>v_work.creator_profile_id
 then raise exception 'GALLERY_SUBJECT_IDENTITY_IMMUTABLE'; end if;
 if not exists(select 1 from public.gallery_verified_subjects s
   where s.subject_id=p_subject_id and s.verified_state='verified'
   and s.platform='switch' and s.game_version='1.25.0'
   and s.build_identity='52BD625D9B4E0053')
 then raise exception 'GALLERY_SUBJECT_NO_LONGER_VERIFIED'; end if;
 perform private.gallery_photo_validate_media_v1(v_account,p_media_ids,p_cover_media_id);
 select count(*) into v_overlap from public.work_revision_media wrm
 where wrm.work_revision_id=v_work.current_published_revision_id
 and wrm.media_id=any(p_media_ids);
 if v_overlap=0 then raise exception 'GALLERY_UPDATE_ARTWORK_CONTINUITY_REQUIRED'; end if;
 insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
 values(v_account,p_idempotency_key,'gallery_photo_update_v1',v_hash);
 select coalesce(max(revision_number),0)+1 into v_rev_num
 from public.community_work_revisions where work_id=p_work_id;
 v_rev:=private.gallery_photo_write_revision_v1(p_work_id,v_account,p_title,p_description,
   p_media_ids,p_cover_media_id,p_subject_id,v_rev_num);
 update public.community_works set current_published_revision_id=v_rev,updated_at=now()
 where work_id=p_work_id returning * into v_work;
 update public.search_documents set title=btrim(p_title),
   text_content=coalesce(p_description,''),updated_at=now()
 where work_id=p_work_id;
 insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
 values('community_work',p_work_id,'work.presentation_updated',
  jsonb_build_object('workId',p_work_id,'revisionId',v_rev,'previousRevisionId',
   (select revision_id from public.community_work_revisions where work_id=p_work_id
    and revision_number=v_rev_num-1 limit 1)),
  'gallery_photo.updated:'||v_rev::text);
 v_response:=jsonb_build_object('workId',p_work_id,'revisionId',v_rev,
  'rowVersion',v_work.row_version,'subjectId',p_subject_id,'lifecycleState','published');
 update public.idempotency_keys set response=v_response,completed_at=now()
 where account_id=v_account and idempotency_key=p_idempotency_key;
 return v_response;
end $$;

create or replace function public.community_retire_gallery_photo_v1(
 p_auth_subject uuid,p_work_id uuid,p_expected_version bigint,
 p_mode text,p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,public,private as $$
declare
 v_account uuid; v_work public.community_works%rowtype;
 v_response jsonb; v_hash text; v_oldhash text; v_child record;
 v_children integer:=0;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 if coalesce(char_length(btrim(p_idempotency_key)),0) not between 1 and 200
 then raise exception 'GALLERY_IDEMPOTENCY_REQUIRED'; end if;
 if p_mode not in ('delete','keep_private') then raise exception 'GALLERY_RETIRE_MODE_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_account::text||':'||p_idempotency_key,0));
 v_hash:=encode(digest(jsonb_build_object('op','gallery_photo_retire_v1','work',p_work_id,
  'version',p_expected_version,'mode',p_mode)::text,'sha256'),'hex');
 select request_hash,response into v_oldhash,v_response from public.idempotency_keys
 where account_id=v_account and idempotency_key=p_idempotency_key;
 if found then
  if v_oldhash<>v_hash then raise exception 'GALLERY_IDEMPOTENCY_CONFLICT'; end if;
  return v_response;
 end if;
 select * into v_work from public.community_works where work_id=p_work_id for update;
 if v_work.work_id is null or v_work.work_type<>'gallery'
   or not exists(select 1 from public.gallery_photo_subject_bindings where work_id=p_work_id)
 then raise exception 'GALLERY_WORK_NOT_FOUND'; end if;
 if v_work.owner_account_id<>v_account then raise exception 'GALLERY_NOT_OWNER'; end if;
 if v_work.row_version<>p_expected_version then raise exception 'GALLERY_VERSION_CONFLICT'; end if;
 if v_work.lifecycle_state<>'published' or v_work.visibility<>'public'
 then raise exception 'GALLERY_WORK_NOT_PUBLIC'; end if;
 -- No Cloud-proven private preservation authority exists yet: fail closed.
 if p_mode='keep_private' then raise exception 'GALLERY_CLOUD_PRIVATE_PRESERVATION_REQUIRED'; end if;
 insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
 values(v_account,p_idempotency_key,'gallery_photo_retire_v1',v_hash);
 -- Known linked Preset Work IDs must be same owner. Retirement is one DB transaction.
 -- Other listing types and native codes need 09 INT's positive binding contract.
 for v_child in
  select distinct pa.community_work_id,pa.owner_account_id
  from public.preset_artifacts pa
  where pa.associated_gallery_work_id=p_work_id and pa.community_work_id is not null
  order by pa.community_work_id
 loop
  if v_child.owner_account_id<>v_account then
    raise exception 'GALLERY_DEPENDENCY_OWNER_MISMATCH'; end if;
  if not exists(select 1 from public.community_works cw
    where cw.work_id=v_child.community_work_id and cw.work_type='preset'
      and cw.owner_account_id=v_account) then
    raise exception 'GALLERY_DEPENDENCY_NOT_SAFE_TO_RETIRE'; end if;
  update public.community_works set lifecycle_state='unpublished',updated_at=now()
    where work_id=v_child.community_work_id and lifecycle_state='published';
  delete from public.search_documents where work_id=v_child.community_work_id;
  v_children:=v_children+1;
 end loop;
 update public.community_works
 set lifecycle_state='deleted',updated_at=now()
 where work_id=p_work_id returning * into v_work;
 update public.community_entities set deleted_at=coalesce(deleted_at,now())
 where entity_id=p_work_id;
 delete from public.search_documents where work_id=p_work_id;
 insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
 values('community_work',p_work_id,'work.deleted',
   jsonb_build_object('workId',p_work_id,'dependentPresetWorkCount',v_children,
   'publicMediaRevokedForNewRequests',true),
  'gallery_photo.deleted:'||p_work_id::text||':'||v_work.row_version::text);
 v_response:=jsonb_build_object('workId',p_work_id,'rowVersion',v_work.row_version,
   'lifecycleState','deleted','publicAccess','revoked','dependentPresetWorkCount',v_children);
 update public.idempotency_keys set response=v_response,completed_at=now()
 where account_id=v_account and idempotency_key=p_idempotency_key;
 return v_response;
end $$;

revoke execute on function public.community_publish_gallery_photo_v1(uuid,uuid,uuid,text,text,uuid[],uuid,boolean,text)
 from public,anon,authenticated;
revoke execute on function public.community_update_gallery_photo_v1(uuid,uuid,bigint,text,text,uuid[],uuid,uuid,text)
 from public,anon,authenticated;
revoke execute on function public.community_retire_gallery_photo_v1(uuid,uuid,bigint,text,text)
 from public,anon,authenticated;
grant execute on function public.community_publish_gallery_photo_v1(uuid,uuid,uuid,text,text,uuid[],uuid,boolean,text)
 to service_role;
grant execute on function public.community_update_gallery_photo_v1(uuid,uuid,bigint,text,text,uuid[],uuid,uuid,text)
 to service_role;
grant execute on function public.community_retire_gallery_photo_v1(uuid,uuid,bigint,text,text)
 to service_role;
