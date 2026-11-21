-- #124: GLOBAL capacity admission, layered on existing per-account 10/200MiB.
-- Provisional staging ceiling only. Separate physical Storage quota unknown.
-- Existing policy singleton serves as the cross-account serialization mutex.
alter table private.gallery_media_capacity_policy_v1
 add column if not exists global_unbound_intent_ceiling integer
    not null default 100 check(global_unbound_intent_ceiling between 20 and 10000),
 add column if not exists global_reserved_byte_ceiling bigint
    not null default 2097152000 check(global_reserved_byte_ceiling between 209715200 and 107374182400),
 add column if not exists global_oldest_due_max_hours integer
    not null default 6 check(global_oldest_due_max_hours between 1 and 168),
 add column if not exists global_backpressure_enabled boolean not null default true;

create or replace function private.gallery_global_capacity_admission_v1(
 p_new_bytes bigint)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_policy private.gallery_media_capacity_policy_v1%rowtype;
v_count bigint;v_bytes bigint;v_oldest timestamptz;
begin
 if p_new_bytes is null or p_new_bytes not between 1 and 20971520
 then raise exception 'GALLERY_UPLOAD_INTENT_INVALID';end if;
 -- Caller holds its Wand Account FOR UPDATE. All Gallery prepares acquire
 -- this single policy-row lock in the same order, across ALL accounts.
 select * into v_policy from private.gallery_media_capacity_policy_v1
 where singleton=true for update;
 if not coalesce(v_policy.global_backpressure_enabled,false) then
   return jsonb_build_object('backpressureActive',false);
 end if;
 select count(*),coalesce(sum(expected_bytes),0),
  min(expires_at+interval '5 minutes') filter(
   where state in ('pending','aborted')
     and expires_at+interval '5 minutes'<=now())
 into v_count,v_bytes,v_oldest
 from public.community_media_upload_intents i
 left join public.media_assets m on m.storage_key=i.storage_key
 where not (
   i.state='finalized' and m.media_id is not null and
   (exists(select 1 from public.work_revision_media r where r.media_id=m.media_id)
    or exists(select 1 from public.gallery_photo_revision_fields f where f.cover_media_id=m.media_id)
    or exists(select 1 from public.creator_profiles c where c.avatar_media_id=m.media_id))
 );
 if v_count >= v_policy.global_unbound_intent_ceiling then
   raise exception 'GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED';end if;
 if v_bytes+p_new_bytes > v_policy.global_reserved_byte_ceiling then
   raise exception 'GALLERY_GLOBAL_RESERVED_BYTES_EXCEEDED';end if;
 if v_oldest is not null
    and v_oldest < now()-make_interval(hours=>v_policy.global_oldest_due_max_hours)
 then raise exception 'GALLERY_GLOBAL_CLEANUP_STALLED';end if;
 return jsonb_build_object('backpressureActive',true,
   'globalUnboundIntents',v_count,'globalReservedBytes',v_bytes,
   'globalMaxUnboundIntents',v_policy.global_unbound_intent_ceiling,
   'globalMaxReservedBytes',v_policy.global_reserved_byte_ceiling,
   'oldestDueAt',v_oldest);
end $$;
revoke all on function private.gallery_global_capacity_admission_v1(bigint) from public,anon,authenticated;

create or replace function public.community_gallery_media_intent_open_v1(
 p_auth_subject uuid,p_storage_key text,p_mime_type text,p_expected_bytes bigint)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_policy private.gallery_media_capacity_policy_v1%rowtype;
v_capacity jsonb;v_global jsonb;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 if p_storage_key is null or p_storage_key !~ ('^'||p_auth_subject::text||'/[0-9a-f-]{36}[.](jpg|png|webp)$')
   or p_mime_type not in ('image/jpeg','image/png','image/webp')
   or p_expected_bytes not between 1 and 20971520
 then raise exception 'GALLERY_UPLOAD_INTENT_INVALID';end if;
 -- Lock order is Account -> global singleton. Serializes same-account and
 -- cross-account admission and prevents bursting past global ceilings.
 perform 1 from public.wand_accounts where account_id=v_account for update;
 if not found then raise exception 'GALLERY_UPLOAD_FORBIDDEN';end if;
 v_global:=private.gallery_global_capacity_admission_v1(p_expected_bytes);
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
  'globalAdmission',v_global,
  'ttlActive',false,'reuseExpiresAt',null);
exception when unique_violation then
 raise exception 'GALLERY_UPLOAD_KEY_REUSED';
end $$;
revoke all on function public.community_gallery_media_intent_open_v1(uuid,text,text,bigint)
 from public,anon,authenticated;
grant execute on function public.community_gallery_media_intent_open_v1(uuid,text,text,bigint)
 to service_role;

-- Expose red/yellow summary without leaking account IDs/Storage keys.
create or replace function public.community_gallery_global_capacity_alert_v1()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare p private.gallery_media_capacity_policy_v1%rowtype;
 c jsonb;v_due bigint;v_bytes bigint;v_count bigint;v_oldest timestamptz;
 v_status text:='normal';v_reason text:='WITHIN_PROVISIONAL_CEILINGS';
begin
 select * into p from private.gallery_media_capacity_policy_v1 where singleton=true;
 c:=public.community_gallery_media_capacity_ops_v1();
 v_due:=(c->>'expiredUncollected')::bigint;
 v_bytes:=(c->>'reservedUnboundBytes')::bigint;
 v_count:=(c->>'pending')::bigint+(c->>'aborted')::bigint+
   (c->>'finalizedMaybeUnbound')::bigint;
 v_oldest:=(c->>'oldestPendingCleanupSince')::timestamptz;
 if not p.global_backpressure_enabled then
   v_status:='disabled';v_reason:='OPERATOR_BACKPRESSURE_DISABLED';
 elsif v_count>=p.global_unbound_intent_ceiling or
       v_bytes>=p.global_reserved_byte_ceiling then
   v_status:='critical';v_reason:='GLOBAL_CAPACITY_SATURATED';
 elsif v_oldest is not null and v_oldest<now()-make_interval(hours=>p.global_oldest_due_max_hours) then
   v_status:='critical';v_reason:='CLEANUP_QUEUE_STALLED';
 elsif v_count*10>=p.global_unbound_intent_ceiling*8 or
   v_bytes*10>=p.global_reserved_byte_ceiling*8 or
   v_due>p.global_unbound_intent_ceiling/5 then
   v_status:='warning';v_reason:='BACKLOG_APPROACHING_LIMIT';
 end if;
 return jsonb_build_object('contract','ddv.gallery-global-admission-alert@1',
 'status',v_status,'reason',v_reason,'provisional',true,
 'globalUnboundCount',v_count,'globalReservedBytes',v_bytes,
 'oldestDueAt',v_oldest,'expiredUncollected',v_due,
 'globalCountCeiling',p.global_unbound_intent_ceiling,
 'globalByteCeiling',p.global_reserved_byte_ceiling,
 'backpressureEnforced',p.global_backpressure_enabled,
 'workerMaxPerHour',20,'ttlFinalizedEnabled',false);
end $$;
revoke all on function public.community_gallery_global_capacity_alert_v1()
 from public,anon,authenticated;
grant execute on function public.community_gallery_global_capacity_alert_v1()
 to service_role;
