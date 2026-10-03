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

const MEDIA_BUCKET = 'community-media-staging';
const WEP_PRESET_RETENTION_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/wep-preset-retention`;

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
            const adapterResponse = await fetch(WEP_PRESET_RETENTION_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-community-worker-token': workerToken
              },
              body: JSON.stringify({
                retentionJobId: job.retentionJobId,
                lockToken
              })
            });

            const adapterBody = await adapterResponse.json().catch(() => ({}));
            if (!adapterResponse.ok || adapterBody?.ok !== true) {
              const adapterError =
                adapterBody && typeof adapterBody === 'object' && 'error' in adapterBody
                  ? String((adapterBody as { error?: unknown }).error ?? 'WEP retention adapter failed')
                  : 'WEP retention adapter failed';
              throw new Error(`Preset artifact purge adapter failed: ${adapterError}`);
            }

            if (Number(adapterBody?.remaining ?? 0) !== 0) {
              throw new Error('Preset artifact purge adapter left unpurged blobs');
            }
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

    return reply({
      ok: true,
      claimed: jobs.length,
      completed: results.filter((result) => result.ok === true).length,
      failed: results.filter((result) => result.ok !== true).length,
      results
    });
  })
};
