-- #124 additive operator-only throughput reality for existing capacity RPC.
-- The 20/hour figure is a nominal Worker claim budget, not physical
-- deletion throughput or measured provider performance. Physical gate OFF.
-- Metrics remain aggregate-only; no Account/Media IDs or Storage keys.
-- #124 operator-only aggregate, never exposes owner IDs, media keys or raw bytes.
-- Reuses per-account capacity computation as the SSoT for saturation.
create or replace function public.community_gallery_media_capacity_ops_v1()
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,private as $$
with by_owner as (
 select (private.gallery_media_capacity_snapshot_v1(x.owner_account_id)) metrics
 from (select distinct owner_account_id from public.community_media_upload_intents) x
), totals as (
 select coalesce(sum((metrics->>'activeUnboundCount')::bigint),0)::bigint active_count,
 coalesce(sum((metrics->>'reservedBytes')::bigint),0)::bigint reserved_bytes,
 count(*) filter(where
   (metrics->>'activeUnboundCount')::int >= (metrics->>'maxActiveUnbound')::int
   or (metrics->>'reservedBytes')::bigint >= (metrics->>'maxReservedBytes')::bigint
 )::integer saturated_accounts
 from by_owner
), counts as (
 select count(*) filter(where state='pending')::bigint pending,
 count(*) filter(where state='finalized' and media_id is not null
   and not exists(select 1 from public.work_revision_media r
     where r.media_id=community_media_upload_intents.media_id))::bigint finalized_maybe_unbound,
 count(*) filter(where state='aborted')::bigint aborted,
 count(*) filter(where state in ('pending','aborted')
   and expires_at+interval '5 minutes'<=now())::bigint expired_uncollected,
 count(*) filter(where state in ('pending','aborted')
   and cleanup_retry_at<=now() and expires_at+interval '5 minutes'<=now()
   and (cleanup_lease_until is null or cleanup_lease_until<=now()))::bigint cleanup_due,
 count(*) filter(where cleanup_attempt_count>0)::bigint retries,
 count(*) filter(where cleanup_last_error is not null)::bigint failures,
 max(cleanup_attempt_count)::integer max_attempts,
 min(expires_at+interval '5 minutes') filter(
   where state in ('pending','aborted') and expires_at+interval '5 minutes'<=now()
 ) as oldest_pending_cleanup_since
 from public.community_media_upload_intents
), throughput as (
 select count(*)::bigint worker_cleaned_last_hour
 from public.audit_events where action_type='gallery_media_orphan_cleaned'
 and created_at >= now()-interval '1 hour'
)
select jsonb_build_object(
 'contract','ddv.gallery-retention-capacity-ops@1',
 'ttlPhysicalDeletionEnabled',false,
 'reservedUnboundBytes',totals.reserved_bytes,
 'activeUnboundCount',totals.active_count,
 'saturatedAccounts',totals.saturated_accounts,
 'pending',counts.pending,'finalizedMaybeUnbound',counts.finalized_maybe_unbound,
 'aborted',counts.aborted,
 'expiredUncollected',counts.expired_uncollected,
 'cleanupDue',counts.cleanup_due,
 'oldestPendingCleanupSince',counts.oldest_pending_cleanup_since,
 'retryRecords',counts.retries,'failedRecords',counts.failures,
 'maxAttempts',coalesce(counts.max_attempts,0),
 'workerCleanedLastHour',throughput.worker_cleaned_last_hour,
 'workerMaxPerHourlyRun',20,
 'hourlyGlobalMaxAtCurrentCron',20,
 'maxPreparePerAccountHour',30,
 'workerMayNotOutpaceArrival',true,
 'physicalCleanupCurrentlyAuthorized',false,
 'effectivePhysicalCleanupPerHour',0,
 'nominalWorkerClaimCapacityPerHour',20,
 'cleanupDueLowerBoundAtNominalCapacityHours',case when counts.cleanup_due=0 then 0
   else ceil(counts.cleanup_due::numeric/20)::integer end,
 'providerStorageThroughputBenchmarked',false,
 'externalStorageRetryBehaviorAccepted',false,
 'safeCapacityCeilingsProven',false,
 'pendingAbortedOriginMayRetainBytes',true,
 'finalized72hExpiryActive',false)
from totals cross join counts cross join throughput
$$;
revoke all on function public.community_gallery_media_capacity_ops_v1() from public,anon,authenticated;
grant execute on function public.community_gallery_media_capacity_ops_v1() to service_role;