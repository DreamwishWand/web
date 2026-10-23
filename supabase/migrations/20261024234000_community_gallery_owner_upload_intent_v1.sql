-- 03 COMM #124: shared Community Media upload-intent journal for Gallery photos.
-- This is metadata for the EXISTING private Community Media Storage bucket,
-- never a second MediaAsset or a Gallery-specific Storage bucket.
create table if not exists public.community_media_upload_intents (
  storage_key text primary key,
  owner_account_id uuid not null references public.wand_accounts(account_id),
  auth_subject uuid not null,
  flow text not null default 'gallery_photo' check(flow='gallery_photo'),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  expected_bytes bigint not null check(expected_bytes between 1 and 20971520),
  state text not null default 'pending' check(state in ('pending','finalized','aborted')),
  media_id uuid unique references public.media_assets(media_id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '2 hours'),
  aborted_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((state='pending' and media_id is null and aborted_at is null)
      or (state='finalized' and media_id is not null and aborted_at is null)
      or (state='aborted' and aborted_at is not null))
);
create index if not exists community_media_upload_intents_owner_idx
  on public.community_media_upload_intents(owner_account_id,issued_at desc);
create index if not exists community_media_upload_intents_expiry_idx
  on public.community_media_upload_intents(expires_at) where state='aborted';
alter table public.community_media_upload_intents enable row level security;
revoke all on public.community_media_upload_intents from public,anon,authenticated;
grant select,insert,update,delete on public.community_media_upload_intents to service_role;

create or replace function public.community_gallery_media_intent_open_v1(
 p_auth_subject uuid,p_storage_key text,p_mime_type text,p_expected_bytes bigint)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 if p_storage_key is null or p_storage_key !~ ('^'||p_auth_subject::text||'/[0-9a-f-]{36}\\.(jpg|png|webp)$')
 or p_mime_type not in ('image/jpeg','image/png','image/webp')
 or p_expected_bytes not between 1 and 20971520 then
   raise exception 'GALLERY_UPLOAD_INTENT_INVALID';
 end if;
 insert into public.community_media_upload_intents(storage_key,owner_account_id,auth_subject,mime_type,expected_bytes)
 values(p_storage_key,v_account,p_auth_subject,p_mime_type,p_expected_bytes);
 return jsonb_build_object('storageKey',p_storage_key,'state','pending','expiresInSeconds',7200);
exception when unique_violation then
 raise exception 'GALLERY_UPLOAD_KEY_REUSED';
end $$;

create or replace function public.community_gallery_media_intent_probe_v1(
 p_auth_subject uuid,p_storage_key text)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $
declare v_account uuid;v_intent public.community_media_upload_intents%rowtype;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key and owner_account_id=v_account and auth_subject=p_auth_subject;
 if v_intent.storage_key is null then raise exception 'GALLERY_UPLOAD_FORBIDDEN'; end if;
 if v_intent.state='aborted' then raise exception 'GALLERY_UPLOAD_ABORTED'; end if;
 if v_intent.state='pending' and now()>v_intent.expires_at
 then raise exception 'GALLERY_UPLOAD_EXPIRED'; end if;
 return jsonb_build_object('state',v_intent.state,'mediaId',v_intent.media_id,
   'mimeType',v_intent.mime_type,'expectedBytes',v_intent.expected_bytes);
end $;
revoke all on function public.community_gallery_media_intent_probe_v1(uuid,text)
 from public,anon,authenticated;
grant execute on function public.community_gallery_media_intent_probe_v1(uuid,text) to service_role;

-- Cancel invalidates ALL Gallery finalize attempts; the old signed upload token
-- still lives for at most two hours. Never promise immediate object deletion.
create or replace function public.community_gallery_media_intent_cancel_v1(
 p_auth_subject uuid,p_storage_key text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_intent public.community_media_upload_intents%rowtype;
 v_media public.media_assets%rowtype;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key and owner_account_id=v_account and auth_subject=p_auth_subject
 for update;
 if v_intent.storage_key is null then raise exception 'GALLERY_UPLOAD_FORBIDDEN'; end if;
 if v_intent.state='aborted' then
   return jsonb_build_object('aborted',true,'alreadyAborted',true,
     'cleanupEligibleAt',v_intent.expires_at+interval '5 minutes');
 end if;
 if v_intent.media_id is not null or exists(select 1 from public.media_assets where storage_key=p_storage_key) then
   select * into v_media from public.media_assets
   where storage_key=p_storage_key and owner_account_id=v_account for update;
   if v_media.media_id is null then raise exception 'GALLERY_MEDIA_NOT_FOUND'; end if;
   if exists(select 1 from public.work_revision_media where media_id=v_media.media_id)
     or exists(select 1 from public.creator_profiles where avatar_media_id=v_media.media_id) then
       raise exception 'GALLERY_MEDIA_ALREADY_BOUND';
   end if;
   -- Publisher must lock READY Media FOR SHARE in same transaction (see guard below).
   update public.media_assets set processing_state='quarantined'
   where media_id=v_media.media_id;
 end if;
 update public.community_media_upload_intents
 set state='aborted',aborted_at=now(),updated_at=now()
 where storage_key=p_storage_key;
 return jsonb_build_object('aborted',true,'alreadyAborted',false,
   'cleanupEligibleAt',v_intent.expires_at+interval '5 minutes');
end $$;

create or replace function public.community_gallery_media_intent_complete_v1(
 p_auth_subject uuid,p_storage_key text,p_media_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_intent public.community_media_upload_intents%rowtype;
 v_media public.media_assets%rowtype;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key and owner_account_id=v_account and auth_subject=p_auth_subject
 for update;
 if v_intent.storage_key is null then raise exception 'GALLERY_UPLOAD_FORBIDDEN'; end if;
 if v_intent.state='aborted' then raise exception 'GALLERY_UPLOAD_ABORTED'; end if;
 if v_intent.state='finalized' then
   if v_intent.media_id is distinct from p_media_id then raise exception 'GALLERY_UPLOAD_REPLAY_CONFLICT'; end if;
 else
   if now()>v_intent.expires_at then raise exception 'GALLERY_UPLOAD_EXPIRED'; end if;
 end if;
 select * into v_media from public.media_assets
 where media_id=p_media_id and owner_account_id=v_account for share;
 if v_media.media_id is null or v_media.storage_key<>p_storage_key
 or v_media.mime_type<>v_intent.mime_type or v_media.byte_size<>v_intent.expected_bytes
 or v_media.processing_state<>'ready' or v_media.moderation_state<>'clear'
 or v_media.purged_at is not null or v_media.width<=0 or v_media.height<=0 then
   raise exception 'GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED';
 end if;
 if v_intent.state='pending' then
   update public.community_media_upload_intents set media_id=p_media_id,state='finalized',updated_at=now()
   where storage_key=p_storage_key;
 end if;
 return jsonb_build_object('mediaId',p_media_id,'storageKey',p_storage_key,
   'state','ready','moderationState','clear','mimeType',v_media.mime_type,
   'byteSize',v_media.byte_size,'width',v_media.width,'height',v_media.height,
   'checksumSha256',v_media.checksum_sha256,'replayed',v_intent.state='finalized');
end $$;

-- A cancelled signed upload key must never be registered via the older generic
-- "finalize" endpoint (which remains for other Community workstreams).
create or replace function private.community_media_reject_aborted_gallery_upload_v1()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 perform 1 from public.community_media_upload_intents i
  where i.storage_key=new.storage_key for share;
 if exists(select 1 from public.community_media_upload_intents i
  where i.storage_key=new.storage_key and i.state='aborted') then
   raise exception 'GALLERY_UPLOAD_ABORTED';
 end if;
 return new;
end $$;
drop trigger if exists community_media_reject_aborted_gallery_upload
 on public.media_assets;
create trigger community_media_reject_aborted_gallery_upload
 before insert on public.media_assets for each row
 execute function private.community_media_reject_aborted_gallery_upload_v1();

-- Work/Media atomicity: acquire a row-share lock before binding any image to
-- ANY published revision. This ensures cancellation cannot quarantine it
-- between Gallery readiness validation and new immutable link creation.
-- Applies to the existing work_revision_media (no new media model).
create or replace function private.community_media_lock_ready_gallery_link_v1()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_processing public.media_assets%rowtype;
begin
 if not exists(select 1 from public.community_work_revisions r
    join public.gallery_works g on g.work_id=r.work_id
    where r.revision_id=new.work_revision_id) then return new; end if;
 select * into v_processing from public.media_assets where media_id=new.media_id for share;
 if v_processing.media_id is null or v_processing.processing_state<>'ready'
 or v_processing.moderation_state<>'clear' or v_processing.purged_at is not null then
   raise exception 'GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED';
 end if;
 return new;
end $$;
drop trigger if exists community_media_lock_ready_gallery_link
 on public.work_revision_media;
create trigger community_media_lock_ready_gallery_link
 before insert on public.work_revision_media for each row
 execute function private.community_media_lock_ready_gallery_link_v1();


-- Cleanup must execute AFTER the signed upload token has expired and a grace
-- period has elapsed. Can be retried following an Storage remove failure.
create or replace function public.community_gallery_media_intent_cleanup_probe_v1(
 p_auth_subject uuid,p_storage_key text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $
declare v_account uuid;v_intent public.community_media_upload_intents%rowtype;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key and owner_account_id=v_account and auth_subject=p_auth_subject
 for update;
 if v_intent.storage_key is null then raise exception 'GALLERY_UPLOAD_FORBIDDEN'; end if;
 if v_intent.state<>'aborted' or now() < v_intent.expires_at+interval '5 minutes'
 then raise exception 'GALLERY_UPLOAD_CLEANUP_NOT_DUE'; end if;
 if exists(select 1 from public.media_assets m
   join public.work_revision_media r on r.media_id=m.media_id
   where m.storage_key=p_storage_key)
 or exists(select 1 from public.media_assets m
   join public.creator_profiles c on c.avatar_media_id=m.media_id
   where m.storage_key=p_storage_key) then
   raise exception 'GALLERY_MEDIA_ALREADY_BOUND';
 end if;
 return jsonb_build_object('storageKey',p_storage_key,'cleanupAllowed',true);
end $;

create or replace function public.community_gallery_media_intent_cleanup_finish_v1(
 p_auth_subject uuid,p_storage_key text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $
declare v_account uuid;v_intent public.community_media_upload_intents%rowtype;
 v_media public.media_assets%rowtype;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key and owner_account_id=v_account and auth_subject=p_auth_subject
 for update;
 if v_intent.storage_key is null or v_intent.state<>'aborted'
 or now()<v_intent.expires_at+interval '5 minutes'
 then raise exception 'GALLERY_UPLOAD_CLEANUP_NOT_DUE'; end if;
 select * into v_media from public.media_assets
 where storage_key=p_storage_key and owner_account_id=v_account for update;
 if v_media.media_id is not null then
   if v_media.processing_state<>'quarantined'
   or exists(select 1 from public.work_revision_media where media_id=v_media.media_id)
   or exists(select 1 from public.creator_profiles where avatar_media_id=v_media.media_id) then
     raise exception 'GALLERY_MEDIA_ALREADY_BOUND';
   end if;
   delete from public.media_assets where media_id=v_media.media_id;
   delete from public.community_entities where entity_id=v_media.media_id;
 end if;
 delete from public.community_media_upload_intents where storage_key=p_storage_key;
 return jsonb_build_object('cleaned',true,'storageKey',p_storage_key);
end $;
revoke all on function public.community_gallery_media_intent_cleanup_probe_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.community_gallery_media_intent_cleanup_finish_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.community_gallery_media_intent_cleanup_probe_v1(uuid,text) to service_role;
grant execute on function public.community_gallery_media_intent_cleanup_finish_v1(uuid,text) to service_role;

revoke all on function public.community_gallery_media_intent_open_v1(uuid,text,text,bigint) from public,anon,authenticated;
revoke all on function public.community_gallery_media_intent_cancel_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.community_gallery_media_intent_complete_v1(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.community_gallery_media_intent_open_v1(uuid,text,text,bigint) to service_role;
grant execute on function public.community_gallery_media_intent_cancel_v1(uuid,text) to service_role;
grant execute on function public.community_gallery_media_intent_complete_v1(uuid,text,uuid) to service_role;
revoke all on function private.community_media_reject_aborted_gallery_upload_v1() from public,anon,authenticated,service_role;
revoke all on function private.community_media_lock_ready_gallery_link_v1() from public,anon,authenticated,service_role;
