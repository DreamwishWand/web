-- #124 Staging simulated 20 active + aged backlog; no origin or Storage mutate.
-- #124: source-backed transaction-scoped Global Backpressure acceptance.
-- Two ACTIVE genuine DB identities only, no JWT impersonation or Storage writes.
begin;
do $$
declare
  a uuid;b uuid;account_a uuid;account_b uuid;key_a text;key_b text;
  keys text[]:='{}';i int;bad boolean;v jsonb;ops jsonb;old_key text;
begin
 select ai.provider_subject::uuid,w.account_id into a,account_a
 from public.wand_accounts w join public.auth_identities ai
  on ai.account_id=w.account_id and ai.provider='supabase' and ai.identity_state='active'
 where w.status='active' order by w.account_id limit 1;
 select ai.provider_subject::uuid,w.account_id into b,account_b
 from public.wand_accounts w join public.auth_identities ai
  on ai.account_id=w.account_id and ai.provider='supabase' and ai.identity_state='active'
 where w.status='active' and w.account_id<>account_a order by w.account_id limit 1;
 if a is null or b is null then raise exception 'CAPACITY_TWO_ACTORS_NOT_AVAILABLE';end if;
 update private.gallery_media_capacity_policy_v1
   set global_unbound_intent_ceiling=20,global_reserved_byte_ceiling=2097152000,
       global_oldest_due_max_hours=6,global_backpressure_enabled=true
 where singleton=true;
 for i in 1..20 loop
  key_a:=case when i<=10 then a::text else b::text end
     ||'/'||gen_random_uuid()::text||'.png';
  perform public.community_gallery_media_intent_open_v1(
    case when i<=10 then a else b end,key_a,'image/png',1024);
  keys:=array_append(keys,key_a);
 end loop;
 bad:=false;
 begin
  perform public.community_gallery_media_intent_open_v1(
    a,a::text||'/'||gen_random_uuid()::text||'.png','image/png',1024);
 exception when others then
  if position('GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED' in sqlerrm)>0
   then bad:=true;else raise;end if;
 end;
 if not bad then raise exception 'GLOBAL_21ST_ADMISSION_ACCEPTED';end if;
 v:=public.community_gallery_global_capacity_alert_v1();
 if v->>'status'<>'critical' then raise exception 'BACKPRESSURE_ALERT_NOT_CRITICAL';end if;
 ops:=public.community_gallery_media_capacity_ops_v1();
 if (ops->>'physicalCleanupCurrentlyAuthorized')::boolean is distinct from false
 or (ops->>'effectivePhysicalCleanupPerHour')::int<>0
 or (ops->>'nominalWorkerClaimCapacityPerHour')::int<>20
 or (ops->>'providerStorageThroughputBenchmarked')::boolean is distinct from false
 or (ops->>'externalStorageRetryBehaviorAccepted')::boolean is distinct from false
 or (ops->>'safeCapacityCeilingsProven')::boolean is distinct from false
 or (ops->>'finalized72hExpiryActive')::boolean is distinct from false
 then raise exception 'OPERATOR_THROUGHPUT_CLAIMS_UNSAFE';end if;
 if (ops->>'cleanupDueLowerBoundAtNominalCapacityHours')::integer<>0
 then raise exception 'FUTURE_NOT_DUE_JOBS_MISCLASSIFIED';end if;
 -- A completed, positively verified cleanup would remove the journal
 -- atomically. This SQL-only fixture models that DB recovery, not bytes.
 delete from public.community_media_upload_intents where storage_key=keys[1];
 key_a:=a::text||'/'||gen_random_uuid()::text||'.png';
 perform public.community_gallery_media_intent_open_v1(a,key_a,'image/png',1024);
 -- Deliberately produce an aged *unclaimed* KEY without mutating immutable
 -- expiry. The max-count ceiling is relaxed in this rollback only.
 update private.gallery_media_capacity_policy_v1
    set global_unbound_intent_ceiling=100 where singleton=true;
 old_key:=a::text||'/'||gen_random_uuid()::text||'.png';
 insert into public.community_media_upload_intents(
  storage_key,owner_account_id,auth_subject,mime_type,expected_bytes,
  issued_at,expires_at,cleanup_retry_at)
 values(old_key,account_a,a,'image/png',1024,
  now()-interval '12 hours',now()-interval '10 hours',now()-interval '10 hours');
 bad:=false;
 begin
  perform public.community_gallery_media_intent_open_v1(
    b,b::text||'/'||gen_random_uuid()::text||'.png','image/png',1024);
 exception when others then
  if position('GALLERY_GLOBAL_CLEANUP_STALLED' in sqlerrm)>0
  then bad:=true;else raise;end if;
 end;
 if not bad then raise exception 'OLD_GLOBAL_CLEANUP_BYPASSED';end if;
 ops:=public.community_gallery_media_capacity_ops_v1();
 if (ops->>'expiredUncollected')::int<1
 or (ops->>'cleanupDueLowerBoundAtNominalCapacityHours')::int<1
 or (ops->>'effectivePhysicalCleanupPerHour')::int<>0
 then raise exception 'STALE_QUEUE_DID_NOT_REPORT_ZERO_EFFECTIVE_THROUGHPUT';end if;
 v:=public.community_gallery_global_capacity_alert_v1();
 if v->>'status'<>'critical' or v->>'reason'<>'CLEANUP_QUEUE_STALLED'
 then raise exception 'STALE_CLEANUP_NO_CRITICAL_ALERT';end if;
 delete from public.community_media_upload_intents where storage_key=old_key;
 -- Need free an account's active count before re-admission
 delete from public.community_media_upload_intents where storage_key=keys[11];
 perform public.community_gallery_media_intent_open_v1(
    b,b::text||'/'||gen_random_uuid()::text||'.png','image/png',1024);
 v:=public.community_gallery_global_capacity_alert_v1();
 if v->>'status'='critical' then raise exception 'CAPACITY_RECOVERY_STUCK';end if;
 if has_function_privilege('anon','public.community_gallery_global_capacity_alert_v1()','EXECUTE')
 or has_function_privilege('authenticated','private.gallery_global_capacity_admission_v1(bigint)','EXECUTE')
 then raise exception 'GLOBAL_CAPACITY_POLICY_ACL_BYPASS';end if;
 raise notice 'GALLERY_CAPACITY_EFFECTIVE_ZERO_CLEANUP_ROLLBACK_PASS';
end $$;
rollback;