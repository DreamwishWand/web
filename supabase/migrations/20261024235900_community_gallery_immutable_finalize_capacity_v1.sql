-- 03 COMM #124 / 06 PRODUCT #128. Additive Gallery intent timing/capacity.
-- TTL NEVER active on installation, never backfill legacy media or unknown times.
-- Intent remains the existing upload/media owner journal: no parallel MediaAsset.
create table if not exists private.gallery_media_capacity_policy_v1 (
 singleton boolean primary key default true check(singleton),
 max_active_unbound integer not null default 10 check(max_active_unbound between 1 and 100),
 max_reserved_bytes bigint not null default 209715200 check(max_reserved_bytes between 20971520 and 2147483648),
 quota_enabled boolean not null default true,
 expiry_enabled boolean not null default false,
 expire_hours integer not null default 72 check(expire_hours=72),
 -- Explicit further approval is mandatory before ANY worker can delete finalized media.
 physical_expiry_deletion_accepted boolean not null default false
    check(physical_expiry_deletion_accepted=false)
);
insert into private.gallery_media_capacity_policy_v1(singleton) values(true)
on conflict(singleton) do nothing;
revoke all on private.gallery_media_capacity_policy_v1 from public,anon,authenticated;
alter table public.community_media_upload_intents
 add column if not exists finalized_at timestamptz,
 add column if not exists reuse_expires_at timestamptz;
create index if not exists gallery_intent_capacity_owner_v1
  on public.community_media_upload_intents(owner_account_id,state);
create index if not exists gallery_intent_expiry_candidate_v1
  on public.community_media_upload_intents(reuse_expires_at)
  where state='finalized' and reuse_expires_at is not null;

create or replace function private.gallery_intent_immutable_finalize_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_policy private.gallery_media_capacity_policy_v1%rowtype;
begin
 if tg_op='INSERT' then
   if new.finalized_at is not null or new.reuse_expires_at is not null
   or new.state<>'pending' then
      raise exception 'GALLERY_FINALIZE_SERVER_ONLY';
   end if;
   return new;
 end if;
 -- No client, replay, preview or future service call can edit a clock once set.
 if new.issued_at is distinct from old.issued_at
   or new.expires_at is distinct from old.expires_at
   or new.owner_account_id is distinct from old.owner_account_id
   or new.auth_subject is distinct from old.auth_subject
   or new.expected_bytes is distinct from old.expected_bytes
   or new.mime_type is distinct from old.mime_type
   or new.finalized_at is distinct from old.finalized_at
   or new.reuse_expires_at is distinct from old.reuse_expires_at
     then raise exception 'GALLERY_FINALIZATION_IDENTITY_IMMUTABLE';end if;
 if new.state='finalized' and old.state='pending' then
   select * into v_policy from private.gallery_media_capacity_policy_v1 where singleton=true;
   if new.media_id is null then raise exception 'GALLERY_FINALIZE_MEDIA_REQUIRED';end if;
   new.finalized_at:=clock_timestamp();
   if coalesce(v_policy.expiry_enabled,false) and
       coalesce(v_policy.physical_expiry_deletion_accepted,false) then
     new.reuse_expires_at:=new.finalized_at+interval '72 hours';
   end if;
 elsif new.state='finalized' and old.state='aborted' then
   -- Older cleanup safeguard preserving a discovered reference. Never infer a
   -- successful client finalize time from an aborted/legacy artifact.
   new.finalized_at:=null;
   new.reuse_expires_at:=null;
 end if;
 -- A previously finalized timestamp remains immutable after owner abort,
 -- including any delayed cleanup and worker-retry updates.
 return new;
end $$;
drop trigger if exists gallery_intent_immutable_finalize_v1 on public.community_media_upload_intents;
create trigger gallery_intent_immutable_finalize_v1
before insert or update on public.community_media_upload_intents
for each row execute function private.gallery_intent_immutable_finalize_v1();

-- Shared trusted account accounting. Reserved bytes include aborted uploads
-- while the object can still exist. Only fully durable/referenced finalized
-- media stop counting as TEMPORARY; old historical revisions count as durable.
create or replace function private.gallery_media_capacity_snapshot_v1(p_account uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,private as $$
with outstanding as (
 select i.storage_key,i.expected_bytes,i.state,
  case when i.state='finalized' and m.media_id is not null and (
       exists(select 1 from public.work_revision_media rm where rm.media_id=m.media_id)
       or exists(select 1 from public.gallery_photo_revision_fields g where g.cover_media_id=m.media_id)
       or exists(select 1 from public.creator_profiles c where c.avatar_media_id=m.media_id)
  ) then true else false end as durable
 from public.community_media_upload_intents i
 left join public.media_assets m on m.storage_key=i.storage_key
 where i.owner_account_id=p_account
), counts as (
 select
 count(*) filter(where state='pending' or (state='finalized' and not durable))::integer as active_count,
 coalesce(sum(expected_bytes) filter(where not durable),0)::bigint as reserved_bytes,
 count(*) filter(where state='aborted')::integer as aborted_count,
 count(*) filter(where state='finalized' and not durable)::integer as finalized_unbound
 from outstanding
)
select jsonb_build_object(
 'activeUnboundCount',c.active_count,
 'reservedBytes',c.reserved_bytes,
 'abortedAwaitingPhysicalCleanup',c.aborted_count,
 'finalizedUnboundCount',c.finalized_unbound,
 'maxActiveUnbound',p.max_active_unbound,
 'maxReservedBytes',p.max_reserved_bytes,
 'quotaEnforced',p.quota_enabled,
 'ttlActive',p.expiry_enabled and p.physical_expiry_deletion_accepted)
from counts c cross join private.gallery_media_capacity_policy_v1 p where p.singleton=true
$$;
revoke all on function private.gallery_media_capacity_snapshot_v1(uuid) from public,anon,authenticated;

create or replace function public.community_gallery_media_intent_open_v1(
 p_auth_subject uuid,p_storage_key text,p_mime_type text,p_expected_bytes bigint)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_policy private.gallery_media_capacity_policy_v1%rowtype;
v_capacity jsonb;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 if p_storage_key is null or p_storage_key !~ ('^'||p_auth_subject::text||'/[0-9a-f-]{36}[.](jpg|png|webp)$')
   or p_mime_type not in ('image/jpeg','image/png','image/webp')
   or p_expected_bytes not between 1 and 20971520
 then raise exception 'GALLERY_UPLOAD_INTENT_INVALID';end if;
 -- Existing account row is a serialization mutex shared by all opens from
 -- this account. Concurrent app servers cannot defeat quota by racing SELECT.
 perform 1 from public.wand_accounts where account_id=v_account for update;
 if not found then raise exception 'GALLERY_UPLOAD_FORBIDDEN';end if;
 select * into v_policy from private.gallery_media_capacity_policy_v1 where singleton=true;
 v_capacity:=private.gallery_media_capacity_snapshot_v1(v_account);
 if v_policy.quota_enabled then
   if (v_capacity->>'activeUnboundCount')::int>=v_policy.max_active_unbound
   then raise exception 'GALLERY_UPLOAD_OUTSTANDING_COUNT_EXCEEDED';end if;
   if (v_capacity->>'reservedBytes')::bigint+p_expected_bytes>v_policy.max_reserved_bytes
   then raise exception 'GALLERY_UPLOAD_RESERVED_BYTES_EXCEEDED';end if;
 end if;
 insert into public.community_media_upload_intents(storage_key,owner_account_id,auth_subject,mime_type,expected_bytes)
 values(p_storage_key,v_account,p_auth_subject,p_mime_type,p_expected_bytes);
 return jsonb_build_object('storageKey',p_storage_key,'state','pending',
  'expiresInSeconds',7200,'reservedBytes',p_expected_bytes,
  'capacity',private.gallery_media_capacity_snapshot_v1(v_account),
  'ttlActive',false,'reuseExpiresAt',null);
exception when unique_violation then
 raise exception 'GALLERY_UPLOAD_KEY_REUSED';
end $$;

-- An owner may read the definitive journal state and quota, never an invented
-- 72-hour countdown while the TTL remains disabled.
create or replace function public.community_gallery_media_owner_status_v1(
 p_auth_subject uuid,p_storage_key text default null)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_intent public.community_media_upload_intents%rowtype;
v_media public.media_assets%rowtype;v_bound boolean:=false;
v_policy private.gallery_media_capacity_policy_v1%rowtype;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_policy from private.gallery_media_capacity_policy_v1 where singleton=true;
 if p_storage_key is null then
   return jsonb_build_object('contract','ddv.gallery-owned-media-status@1',
     'capacity',private.gallery_media_capacity_snapshot_v1(v_account),
     'ttlActive',false,'reuseExpiresAt',null);
 end if;
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key and auth_subject=p_auth_subject and owner_account_id=v_account;
 if v_intent.storage_key is null then raise exception 'GALLERY_UPLOAD_FORBIDDEN';end if;
 if v_intent.media_id is not null then
   select * into v_media from public.media_assets
   where media_id=v_intent.media_id and owner_account_id=v_account;
   select exists(select 1 from public.work_revision_media where media_id=v_intent.media_id)
     or exists(select 1 from public.gallery_photo_revision_fields where cover_media_id=v_intent.media_id)
     or exists(select 1 from public.creator_profiles where avatar_media_id=v_intent.media_id)
     into v_bound;
 end if;
 return jsonb_build_object(
  'contract','ddv.gallery-owned-media-status@1',
  'uploadState',v_intent.state,
  'mediaId',v_intent.media_id,
  'finalizedAt',v_intent.finalized_at,
  'temporary',not v_bound,
  'durablyReferenced',v_bound,
  'processingState',v_media.processing_state,
  'moderationState',v_media.moderation_state,
  'ttlActive',false,
  'reuseExpiresAt',null,
  'reuseEligible',v_intent.state='finalized' and not v_bound
     and v_media.processing_state='ready' and v_media.moderation_state='clear'
     and v_media.purged_at is null,
  'reuploadRequired',v_intent.state='aborted',
  'cleanupQueued',v_intent.state='aborted',
  'cleanupEligibleAt',case when v_intent.state='aborted'
       then v_intent.expires_at+interval '5 minutes' else null end,
  'capacity',private.gallery_media_capacity_snapshot_v1(v_account)
 );
end $$;
revoke all on function public.community_gallery_media_owner_status_v1(uuid,text)
 from public,anon,authenticated;
grant execute on function public.community_gallery_media_owner_status_v1(uuid,text)
 to service_role;

-- Service-only operator stats. No user IDs, storage keys, signed tokens,
-- image contents or private bytes leave the worker in these aggregates.
create or replace function public.community_gallery_media_capacity_ops_v1()
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,private as $$
with i as (
select count(*) filter(where state='pending') pending,
 count(*) filter(where state='finalized' and media_id is not null and not exists(
   select 1 from public.work_revision_media wr where wr.media_id=community_media_upload_intents.media_id
 )) finalized_maybe_unbound,
 count(*) filter(where state='aborted') aborted,
 count(*) filter(where state='aborted' and cleanup_retry_at<=now()
   and expires_at+interval '5 minutes'<=now()) cleanup_due,
 count(*) filter(where cleanup_attempt_count>0) retries,
 count(*) filter(where cleanup_last_error is not null) failures,
 max(cleanup_attempt_count) max_attempts,
 min(expires_at+interval '5 minutes') filter(where state='aborted') oldest_due
from public.community_media_upload_intents
),a as (
select count(*) saturated_accounts from (
select owner_account_id from public.community_media_upload_intents
group by owner_account_id having sum(expected_bytes)>=(select max_reserved_bytes from private.gallery_media_capacity_policy_v1)
) s
)
select jsonb_build_object('contract','ddv.gallery-retention-capacity-ops@1',
 'ttlPhysicalDeletionEnabled',false,
 'pending',i.pending,'finalizedMaybeUnbound',i.finalized_maybe_unbound,
 'aborted',i.aborted,'cleanupDue',i.cleanup_due,
 'retryRecords',i.retries,'failedRecords',i.failures,
 'maxAttempts',coalesce(i.max_attempts,0),
 'oldestDueAt',i.oldest_due,
 'saturatedAccounts',a.saturated_accounts,
 'workerMaxPerHourlyRun',20,
 'hourlyGlobalMaxAtCurrentCron',20,
 'maxPreparePerAccountHour',30,
 'workerMayNotOutpaceArrival',true)
from i cross join a
$$;
revoke all on function public.community_gallery_media_capacity_ops_v1() from public,anon,authenticated;
grant execute on function public.community_gallery_media_capacity_ops_v1() to service_role;
