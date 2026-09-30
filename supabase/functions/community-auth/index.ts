import { withSupabase } from 'npm:@supabase/server';

type CleanupJob = {
  cleanupJobId: string;
  accountId: string;
  provider: string;
  providerSubject: string;
  attempts: number;
};

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const value = (error as { status?: unknown }).status;
  return typeof value === 'number' ? value : null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'provider cleanup failed');
  }
  return String(error ?? 'provider cleanup failed');
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return reply({ ok: false, error: 'POST required' }, 405);
    }

    let requestedLimit = 10;
    try {
      const body = await req.json().catch(() => ({}));
      requestedLimit = Number((body as { limit?: unknown }).limit ?? 10);
    } catch {
      return reply({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const limit = Math.max(1, Math.min(50, Math.trunc(requestedLimit || 10)));
    const lockToken = crypto.randomUUID();

    const { data: claimed, error: claimError } = await ctx.supabaseAdmin.rpc(
      'community_claim_provider_cleanup_jobs',
      {
        p_limit: limit,
        p_lock_token: lockToken
      }
    );

    if (claimError) {
      return reply({ ok: false, error: 'CLAIM_FAILED', message: claimError.message }, 500);
    }

    const jobs = Array.isArray(claimed?.jobs) ? (claimed.jobs as CleanupJob[]) : [];
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      const complete = async () => {
        const { data, error } = await ctx.supabaseAdmin.rpc(
          'community_complete_provider_cleanup',
          {
            p_cleanup_job_id: job.cleanupJobId,
            p_lock_token: lockToken
          }
        );
        if (error) throw error;
        return data;
      };

      const fail = async (error: unknown) => {
        const { data, error: failError } = await ctx.supabaseAdmin.rpc(
          'community_fail_provider_cleanup',
          {
            p_cleanup_job_id: job.cleanupJobId,
            p_lock_token: lockToken,
            p_error: messageOf(error)
          }
        );
        if (failError) throw failError;
        return data;
      };

      if (job.provider !== 'supabase') {
        const failed = await fail(new Error('Unsupported provider cleanup target'));
        results.push({
          cleanupJobId: job.cleanupJobId,
          ok: false,
          outcome: 'unsupported_provider',
          state: failed?.state ?? null
        });
        continue;
      }

      const { data: existing, error: lookupError } =
        await ctx.supabaseAdmin.auth.admin.getUserById(job.providerSubject);

      if (lookupError) {
        if (statusOf(lookupError) === 404) {
          const completed = await complete();
          results.push({
            cleanupJobId: job.cleanupJobId,
            ok: true,
            outcome: 'already_absent',
            state: completed?.state ?? 'completed'
          });
          continue;
        }

        const failed = await fail(lookupError);
        results.push({
          cleanupJobId: job.cleanupJobId,
          ok: false,
          outcome: 'lookup_failed',
          state: failed?.state ?? null
        });
        continue;
      }

      if (!existing?.user) {
        const completed = await complete();
        results.push({
          cleanupJobId: job.cleanupJobId,
          ok: true,
          outcome: 'already_absent',
          state: completed?.state ?? 'completed'
        });
        continue;
      }

      const { error: deleteError } =
        await ctx.supabaseAdmin.auth.admin.deleteUser(job.providerSubject);

      if (deleteError) {
        const failed = await fail(deleteError);
        results.push({
          cleanupJobId: job.cleanupJobId,
          ok: false,
          outcome: 'delete_failed',
          state: failed?.state ?? null
        });
        continue;
      }

      const completed = await complete();
      results.push({
        cleanupJobId: job.cleanupJobId,
        ok: true,
        outcome: 'deleted',
        state: completed?.state ?? 'completed'
      });
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
