import { withSupabase } from 'npm:@supabase/server';

type RetentionJob = {
  retentionJobId: string;
  deletionEventId: string;
  accountId: string;
  stage: 'content_payload' | 'operational_detail';
  attempts: number;
  mediaStorageKeys: string[];
  artifactBlobCount: number;
};

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'retention worker failed');
  }
  return String(error ?? 'retention worker failed');
}

const KNOWN_STAGING_PROJECT_REF = 'ptpdoxhrqopvczpclcij';

function resolveMediaBucket(): string {
  const explicit = Deno.env.get('COMMUNITY_MEDIA_BUCKET')?.trim();
  if (explicit) return explicit;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (supabaseUrl.includes(KNOWN_STAGING_PROJECT_REF)) {
    return 'community-media-staging';
  }

  throw new Error('COMMUNITY_MEDIA_BUCKET is required outside the known staging project.');
}

const MEDIA_BUCKET = resolveMediaBucket();

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return reply({ ok: false, error: 'POST required' }, 405);
    }

    const workerToken = req.headers.get('x-community-worker-token') ?? '';
    if (!workerToken) {
      return reply({ ok: false, error: 'WORKER_AUTH_REQUIRED' }, 401);
    }

    const { data: workerAuthorized, error: workerAuthError } =
      await ctx.supabaseAdmin.rpc('community_verify_worker_token', {
        p_worker_name: 'retention_cleanup',
        p_token: workerToken
      });

    if (workerAuthError || workerAuthorized !== true) {
      return reply({ ok: false, error: 'WORKER_AUTH_INVALID' }, 401);
    }

    const { data: ddvBindingPurge, error: ddvBindingPurgeError } =
      await ctx.supabaseAdmin.rpc('community_purge_expired_ddv_binding_tombstones');

    if (ddvBindingPurgeError) {
      return reply({
        ok: false,
        error: 'DDV_BINDING_TOMBSTONE_PURGE_FAILED',
        message: ddvBindingPurgeError.message
      }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const requestedLimit = Number((body as { limit?: unknown }).limit ?? 10);
    const limit = Math.max(1, Math.min(50, Math.trunc(requestedLimit || 10)));
    const lockToken = crypto.randomUUID();

    const { data: claimed, error: claimError } = await ctx.supabaseAdmin.rpc(
      'community_claim_account_retention_jobs',
      {
        p_limit: limit,
        p_lock_token: lockToken
      }
    );

    if (claimError) {
      return reply({ ok: false, error: 'CLAIM_FAILED', message: claimError.message }, 500);
    }

    const jobs = Array.isArray(claimed?.jobs) ? (claimed.jobs as RetentionJob[]) : [];
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      const complete = async () => {
        const { data, error } = await ctx.supabaseAdmin.rpc(
          'community_complete_account_retention_job',
          {
            p_retention_job_id: job.retentionJobId,
            p_lock_token: lockToken
          }
        );
        if (error) throw error;
        return data;
      };

      const fail = async (error: unknown) => {
        const { data, error: failError } = await ctx.supabaseAdmin.rpc(
          'community_fail_account_retention_job',
          {
            p_retention_job_id: job.retentionJobId,
            p_lock_token: lockToken,
            p_error: messageOf(error)
          }
        );
        if (failError) throw failError;
        return data;
      };

      try {
        if (job.stage === 'content_payload') {
          if (job.artifactBlobCount > 0) {
            throw new Error('Preset artifact storage purge adapter is not available');
          }

          const keys = Array.isArray(job.mediaStorageKeys)
            ? job.mediaStorageKeys.filter((key) => typeof key === 'string' && key.length > 0)
            : [];

          for (let offset = 0; offset < keys.length; offset += 100) {
            const batch = keys.slice(offset, offset + 100);
            const { error: removeError } =
              await ctx.supabaseAdmin.storage.from(MEDIA_BUCKET).remove(batch);
            if (removeError) throw removeError;
          }
        }

        const completed = await complete();
        results.push({
          retentionJobId: job.retentionJobId,
          stage: job.stage,
          ok: true,
          outcome: 'completed',
          state: completed?.state ?? 'completed'
        });
      } catch (error) {
        const failed = await fail(error);
        results.push({
          retentionJobId: job.retentionJobId,
          stage: job.stage,
          ok: false,
          outcome: 'failed',
          state: failed?.state ?? null
        });
      }
    }

    // Reuse the SAME pg_cron #33 -> Vault token -> retention_cleanup worker.
    // Orphan work is bounded and claimed with a DB lease. Storage remove and
    // DB completion deliberately live on opposite sides of an idempotent retry.
    let galleryOrphans: {claimed:number;completed:number;failed:number;cleanupBlocked?:string;workerFailure?:string} = {claimed:0,completed:0,failed:0};
    try {
      // Existing Gallery orphan claim is still SQL-testable, but Storage.remove
      // MUST NOT execute before an authorized disposable Actor/Origin acceptance.
      // Fail closed without consuming leases or running unrelated account jobs.
      const {data:cleanupGate,error:cleanupGateError}=await ctx.supabaseAdmin.rpc(
        'community_gallery_physical_cleanup_gate_v1'
      );
      if(cleanupGateError) throw cleanupGateError;
      if(cleanupGate?.physicalDeleteAuthorized!==true) {
        galleryOrphans.cleanupBlocked=String(cleanupGate?.reason??'GALLERY_PHYSICAL_CLEANUP_NOT_ACCEPTED');
      } else {
      const galleryLockToken = crypto.randomUUID();
      const {data: galleryClaim,error:galleryClaimError} = await ctx.supabaseAdmin.rpc(
        'community_claim_gallery_media_orphans_v1',
        {p_limit:Math.min(limit,20),p_lock_token:galleryLockToken}
      );
      if (galleryClaimError) throw galleryClaimError;
      const orphanJobs = Array.isArray(galleryClaim?.jobs) ? galleryClaim.jobs as Array<{storageKey:string}> : [];
      galleryOrphans.claimed=orphanJobs.length;
      for(const orphan of orphanJobs){
        try{
          const key=String(orphan.storageKey);
          const {error:removeError}=await ctx.supabaseAdmin.storage.from(MEDIA_BUCKET).remove([key]);
          if(removeError){
            const {error:infoError}=await ctx.supabaseAdmin.storage.from(MEDIA_BUCKET).info(key);
            if(Number(infoError?.status)!==404)throw removeError;
          }
          // Must prove object is physically absent from origin metadata before
          // committing DB cleanup; CDN old-token policy belongs to #116.
          const {data:stillThere,error:infoError}=await ctx.supabaseAdmin.storage.from(MEDIA_BUCKET).info(key);
          if(stillThere || Number(infoError?.status)!==404)
            throw new Error('GALLERY_ORPHAN_STORAGE_REMOVAL_NOT_CONFIRMED');
          const {error:doneError}=await ctx.supabaseAdmin.rpc(
            'community_complete_gallery_media_orphan_v1',
            {p_storage_key:key,p_lock_token:galleryLockToken}
          );
          if(doneError)throw doneError;
          galleryOrphans.completed++;
        }catch(error){
          galleryOrphans.failed++;
          const {error:failedRpcError}=await ctx.supabaseAdmin.rpc(
            'community_fail_gallery_media_orphan_v1',
            {p_storage_key:String(orphan.storageKey),p_lock_token:galleryLockToken,
              p_error:messageOf(error)}
          );
          if(failedRpcError) {
            // Reclaim after the DB lease expires; fail-closed without a delete
            // of metadata or a false success result.
            galleryOrphans.workerFailure='GALLERY_ORPHAN_FAILURE_ACK_FAILED';
          }
        }
      }
      }
    } catch(error){
      galleryOrphans.workerFailure='GALLERY_ORPHAN_CLAIM_FAILED';
    }

    // Aggregate-only capacity telemetry. TTL FINALIZED purge is intentionally
    // absent: #128 requires signed Storage + Privacy/Legal/Ops acceptance.
    const {data:galleryCapacityMetrics,error:galleryCapacityError} =
      await ctx.supabaseAdmin.rpc('community_gallery_media_capacity_ops_v1');
    if(galleryCapacityError) {
      galleryOrphans.workerFailure='GALLERY_CAPACITY_TELEMETRY_FAILED';
    }

    // Existing Cron run emits aggregate operator-alert status without issuing
    // new network notifications or exposing owner IDs / signed Media tokens.
    const {data:galleryAdmissionAlert,error:galleryAdmissionAlertError} =
      await ctx.supabaseAdmin.rpc('community_gallery_global_capacity_alert_v1');
    if(galleryAdmissionAlertError) {
      galleryOrphans.workerFailure='GALLERY_GLOBAL_ALERT_UNAVAILABLE';
    }

    return reply({
      ok: true,
      claimed: jobs.length,
      completed: results.filter((result) => result.ok === true).length,
      failed: results.filter((result) => result.ok !== true).length,
      ddvBindingTombstonesPurged: Number(ddvBindingPurge?.purged ?? 0),
      galleryOrphans,
      galleryCapacityMetrics:galleryCapacityError ? null : galleryCapacityMetrics,
      galleryAdmissionAlert:galleryAdmissionAlertError ? null : galleryAdmissionAlert,
      results
    }, galleryOrphans.workerFailure ? 503 : 200);
  })
};
